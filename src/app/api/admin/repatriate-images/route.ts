import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { supabase } from '../../../../services/supabase';
import { getR2Config } from '../../../../utils/r2Config';

// Identifiants R2 : app_secrets (admin) puis variables R2_* ; voir utils/r2Config.

function isCandidateImageUrl(url: string, cleanPublicUrl: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (cleanPublicUrl && url.startsWith(cleanPublicUrl)) return false;
  if (url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com')) return false;
  if (url.includes('images.unsplash.com') || url.includes('unsplash.com') || url.includes('pexels.com') || url.includes('pixabay.com')) return true;
  return /\.(png|jpg|jpeg|webp|svg|gif|avif)($|\?)/i.test(url);
}

/**
 * Télécharge une image externe via son URL et l'envoie sur Cloudflare R2
 */
async function mirrorExternalImageToR2(
  externalUrl: string,
  s3Client: S3Client,
  bucket: string,
  publicUrl: string
): Promise<string | null> {
  try {
    const cleanPublicUrl = publicUrl.replace(/\/+$/, '');
    if (!isCandidateImageUrl(externalUrl, cleanPublicUrl)) {
      return null;
    }

    // Télécharger le fichier distant
    const response = await fetch(externalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image') && !contentType.includes('octet-stream') && !externalUrl.includes('unsplash')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Déterminer l'extension
    let ext = 'webp';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('svg')) ext = 'svg';

    const key = `cdn-repatriated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'image/webp',
    }));

    return `${cleanPublicUrl}/${key}`;
  } catch (err) {
    console.error(`Erreur rapatriement image [${externalUrl}]:`, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Session admin, ou appel interne de la tâche planifiée (x-internal-secret).
    // L'ancien passe-partout « system-cron-bypass » est supprimé.
    const isAuth = await isAdminRequest(req);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { accountId, accessKey, secretKey, bucket, publicUrl } = await getR2Config();

    if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
      return NextResponse.json({
        success: false,
        error: "Configuration Cloudflare R2 incomplète. Veuillez d'abord renseigner vos clés dans Paramètres > Clés API & Services."
      }, { status: 400 });
    }

    const cleanPublicUrl = publicUrl.replace(/\/+$/, '');

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });

    const urlMap = new Map<string, string>();
    let processedCount = 0;

    // 1. Table `media_assets`
    try {
      const { data: mediaAssets } = await supabase.from('media_assets').select('*');
      if (mediaAssets && mediaAssets.length > 0) {
        for (const asset of mediaAssets) {
          if (isCandidateImageUrl(asset.url, cleanPublicUrl)) {
            const newCdnUrl = await mirrorExternalImageToR2(asset.url, s3Client, bucket, cleanPublicUrl);
            if (newCdnUrl) {
              urlMap.set(asset.url, newCdnUrl);
              await supabase.from('media_assets').update({ url: newCdnUrl }).eq('id', asset.id);
              processedCount++;
            }
          }
        }
      }
    } catch (e) {
      console.error("Erreur table media_assets:", e);
    }

    // 2. Table `media_library`
    try {
      const { data: mediaLib } = await supabase.from('media_library').select('*');
      if (mediaLib && mediaLib.length > 0) {
        for (const asset of mediaLib) {
          if (isCandidateImageUrl(asset.url, cleanPublicUrl)) {
            const newCdnUrl = await mirrorExternalImageToR2(asset.url, s3Client, bucket, cleanPublicUrl);
            if (newCdnUrl) {
              urlMap.set(asset.url, newCdnUrl);
              await supabase.from('media_library').update({ url: newCdnUrl }).eq('id', asset.id);
              processedCount++;
            }
          }
        }
      }
    } catch (e) {
      // Ignorer si la table n'existe pas
    }

    // 3. Pages dynamiques (`dynamic_pages`)
    try {
      const { data: pages } = await supabase.from('dynamic_pages').select('id, slug, sections');
      if (pages && pages.length > 0) {
        for (const page of pages) {
          let pageUpdated = false;
          let sectionsStr = JSON.stringify(page.sections);

          const candidateMatches = Array.from(sectionsStr.matchAll(/https?:\/\/[^"\s\\]+/gi))
            .map((m: any) => String(m[0]))
            .filter(u => isCandidateImageUrl(u, cleanPublicUrl));

          const uniqueUrls = Array.from(new Set(candidateMatches));

          for (const extUrl of uniqueUrls) {
            let cdnUrl = urlMap.get(extUrl);
            if (!cdnUrl) {
              cdnUrl = (await mirrorExternalImageToR2(extUrl, s3Client, bucket, cleanPublicUrl)) || undefined;
              if (cdnUrl) {
                urlMap.set(extUrl, cdnUrl);
                processedCount++;
              }
            }
            if (cdnUrl) {
              sectionsStr = sectionsStr.replaceAll(extUrl, cdnUrl);
              pageUpdated = true;
            }
          }

          if (pageUpdated) {
            const updatedSections = JSON.parse(sectionsStr);
            await supabase.from('dynamic_pages').update({ sections: updatedSections }).eq('id', page.id);
          }
        }
      }
    } catch (e) {
      console.error("Erreur dynamic_pages:", e);
    }

    // 4. Articles de blog (`blog_posts`)
    try {
      const { data: posts } = await supabase.from('blog_posts').select('id, cover_image, content');
      if (posts && posts.length > 0) {
        for (const post of posts) {
          let postUpdated = false;
          let cover = post.cover_image;
          let content = post.content || '';

          if (isCandidateImageUrl(cover, cleanPublicUrl)) {
            let cdnUrl = urlMap.get(cover);
            if (!cdnUrl) {
              cdnUrl = (await mirrorExternalImageToR2(cover, s3Client, bucket, cleanPublicUrl)) || undefined;
              if (cdnUrl) {
                urlMap.set(cover, cdnUrl);
                processedCount++;
              }
            }
            if (cdnUrl) {
              cover = cdnUrl;
              postUpdated = true;
            }
          }

          const candidateContentUrls = Array.from(content.matchAll(/https?:\/\/[^"\s\\]+/gi))
            .map((m: any) => String(m[0]))
            .filter(u => isCandidateImageUrl(u, cleanPublicUrl));

          for (const extUrl of Array.from(new Set(candidateContentUrls))) {
            let cdnUrl = urlMap.get(extUrl);
            if (!cdnUrl) {
              cdnUrl = (await mirrorExternalImageToR2(extUrl, s3Client, bucket, cleanPublicUrl)) || undefined;
              if (cdnUrl) {
                urlMap.set(extUrl, cdnUrl);
                processedCount++;
              }
            }
            if (cdnUrl) {
              content = content.replaceAll(extUrl, cdnUrl);
              postUpdated = true;
            }
          }

          if (postUpdated) {
            await supabase.from('blog_posts').update({ cover_image: cover, content }).eq('id', post.id);
          }
        }
      }
    } catch (e) {
      console.error("Erreur blog_posts:", e);
    }

    return NextResponse.json({
      success: true,
      message: processedCount > 0
        ? `Rapatriement réussi ! ${processedCount} image(s) externe(s) ont été rapatriées et basculées sur votre CDN Cloudflare R2.`
        : "Toutes vos images sont déjà hébergées sur votre CDN Cloudflare R2 ! Aucune image externe restante.",
      processedCount,
      mirroredCount: urlMap.size,
    });
  } catch (err: any) {
    console.error("[Repatriate Images Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
