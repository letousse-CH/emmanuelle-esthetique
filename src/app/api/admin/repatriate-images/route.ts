import { NextResponse, NextRequest } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { isAdminRequest } from '../../../../utils/apiAuth';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
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

    // Écritures avec la clé de service : la clé publique est refusée par RLS
    // sans erreur, et le bouton annonçait un succès sans rien avoir changé.
    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json({
        success: false,
        error: "Clé de service Supabase absente (SUPABASE_SERVICE_ROLE_KEY) : les pages ne peuvent pas être mises à jour.",
      }, { status: 501 });
    }

    const urlMap = new Map<string, string>();
    let processedCount = 0;

    /** Copie sur R2 (une seule fois par adresse) ; `undefined` si la copie échoue. */
    const mirror = async (extUrl: string): Promise<string | undefined> => {
      const known = urlMap.get(extUrl);
      if (known) return known;
      const cdnUrl = (await mirrorExternalImageToR2(extUrl, s3Client, bucket, cleanPublicUrl)) || undefined;
      if (cdnUrl) urlMap.set(extUrl, cdnUrl);
      return cdnUrl;
    };

    /** Remplace les images externes d'un texte (JSON ou HTML) ; renvoie le texte et le nombre d'images basculées. */
    const rewrite = async (text: string): Promise<{ text: string; count: number }> => {
      const urls = Array.from(new Set(
        Array.from(text.matchAll(/https?:\/\/[^"\s\\]+/gi))
          .map((m) => String(m[0]))
          .filter((u) => isCandidateImageUrl(u, cleanPublicUrl))
      ));
      let count = 0;
      for (const extUrl of urls) {
        const cdnUrl = await mirror(extUrl);
        if (cdnUrl) {
          text = text.replaceAll(extUrl, cdnUrl);
          count++;
        }
      }
      return { text, count };
    };

    // 1. Médiathèque (`media_assets`)
    try {
      const { data: mediaAssets } = await db.from('media_assets').select('id, url');
      for (const asset of mediaAssets ?? []) {
        if (!isCandidateImageUrl(asset.url, cleanPublicUrl)) continue;
        const cdnUrl = await mirror(asset.url);
        if (!cdnUrl) continue;
        const { error } = await db.from('media_assets').update({ url: cdnUrl }).eq('id', asset.id);
        if (error) console.error('media_assets:', error.message);
        else processedCount++;
      }
    } catch (e) {
      console.error("Erreur table media_assets:", e);
    }

    // 2. Pages : `content` (page builder v2, ce que lit le site) et `sections` (retour arrière).
    try {
      const { data: pages } = await db.from('dynamic_pages').select('id, sections, content');
      for (const page of pages ?? []) {
        const patch: Record<string, unknown> = {};
        let count = 0;
        for (const col of ['content', 'sections'] as const) {
          if (page[col] == null) continue;
          const before = JSON.stringify(page[col]);
          const after = await rewrite(before);
          if (after.text !== before) {
            patch[col] = JSON.parse(after.text);
            count += after.count;
          }
        }
        if (Object.keys(patch).length === 0) continue;
        const { error } = await db.from('dynamic_pages').update(patch).eq('id', page.id);
        if (error) console.error('dynamic_pages:', error.message);
        else processedCount += count;
      }
    } catch (e) {
      console.error("Erreur dynamic_pages:", e);
    }

    // 3. Articles du blog (`articles`)
    try {
      const { data: posts } = await db.from('articles').select('id, cover_image, content');
      for (const post of posts ?? []) {
        let cover = post.cover_image;
        let count = 0;
        if (isCandidateImageUrl(cover, cleanPublicUrl)) {
          const cdnUrl = await mirror(cover);
          if (cdnUrl) {
            cover = cdnUrl;
            count++;
          }
        }
        const body = await rewrite(post.content || '');
        count += body.count;
        if (count === 0) continue;
        const { error } = await db.from('articles').update({ cover_image: cover, content: body.text }).eq('id', post.id);
        if (error) console.error('articles:', error.message);
        else processedCount += count;
      }
    } catch (e) {
      console.error("Erreur articles:", e);
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
