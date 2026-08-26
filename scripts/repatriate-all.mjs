import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching R2 settings from Supabase...");
  const { data: s } = await supabase.from('settings').select('key, value').like('key', 'r2_%');
  const map = Object.fromEntries((s ?? []).map(r => [r.key, r.value]));

  console.log("R2 Config:", map);

  const cleanPublicUrl = map.r2_public_url.replace(/\/+$/, '');

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${map.r2_account_id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: map.r2_access_key_id, secretAccessKey: map.r2_secret_access_key },
    forcePathStyle: true,
  });

  const urlMap = new Map();
  let count = 0;

  // 1. media_assets
  const { data: mediaAssets } = await supabase.from('media_assets').select('*');
  console.log(`Auditing ${mediaAssets?.length || 0} media assets...`);

  if (mediaAssets) {
    for (const asset of mediaAssets) {
      if (asset.url && !asset.url.startsWith(cleanPublicUrl) && (asset.url.startsWith('http://') || asset.url.startsWith('https://'))) {
        let cdnUrl = urlMap.get(asset.url);
        if (!cdnUrl) {
          try {
            console.log(`Downloading external asset: ${asset.url}`);
            const res = await fetch(asset.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const contentType = res.headers.get('content-type') || 'image/jpeg';
              const key = `cdn-repatriated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
              await s3Client.send(new PutObjectCommand({ Bucket: map.r2_bucket_name, Key: key, Body: buffer, ContentType: contentType }));
              cdnUrl = `${cleanPublicUrl}/${key}`;
              urlMap.set(asset.url, cdnUrl);
            }
          } catch (e) {
            console.error(`Failed to download ${asset.url}:`, e);
          }
        }

        if (cdnUrl) {
          await supabase.from('media_assets').update({ url: cdnUrl }).eq('id', asset.id);
          console.log(`Updated media asset ${asset.file_name} -> ${cdnUrl}`);
          count++;
        }
      }
    }
  }

  // 2. dynamic_pages
  const { data: pages } = await supabase.from('dynamic_pages').select('id, slug, sections');
  console.log(`Auditing ${pages?.length || 0} dynamic pages...`);

  if (pages) {
    for (const page of pages) {
      let pageUpdated = false;
      let sectionsStr = JSON.stringify(page.sections);
      const matches = Array.from(sectionsStr.matchAll(/https?:\/\/[^"\s\\]+/gi)).map(m => m[0]);
      
      for (const extUrl of Array.from(new Set(matches))) {
        if ((extUrl.includes('unsplash.com') || extUrl.includes('pixabay.com')) && !extUrl.startsWith(cleanPublicUrl)) {
          let cdnUrl = urlMap.get(extUrl);
          if (!cdnUrl) {
            try {
              console.log(`Downloading section image: ${extUrl}`);
              const res = await fetch(extUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
              if (res.ok) {
                const buffer = Buffer.from(await res.arrayBuffer());
                const contentType = res.headers.get('content-type') || 'image/jpeg';
                const key = `cdn-repatriated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
                await s3Client.send(new PutObjectCommand({ Bucket: map.r2_bucket_name, Key: key, Body: buffer, ContentType: contentType }));
                cdnUrl = `${cleanPublicUrl}/${key}`;
                urlMap.set(extUrl, cdnUrl);
              }
            } catch (e) {
              console.error(`Failed section image ${extUrl}:`, e);
            }
          }
          if (cdnUrl) {
            sectionsStr = sectionsStr.replaceAll(extUrl, cdnUrl);
            pageUpdated = true;
            count++;
          }
        }
      }

      if (pageUpdated) {
        await supabase.from('dynamic_pages').update({ sections: JSON.parse(sectionsStr) }).eq('id', page.id);
        console.log(`Updated page ${page.slug} with new CDN image URLs!`);
      }
    }
  }

  // 3. blog_posts
  const { data: posts } = await supabase.from('blog_posts').select('id, cover_image, content');
  console.log(`Auditing ${posts?.length || 0} blog posts...`);

  if (posts) {
    for (const post of posts) {
      let postUpdated = false;
      let cover = post.cover_image;
      let content = post.content || '';

      if (cover && (cover.includes('unsplash.com') || cover.includes('pixabay.com')) && !cover.startsWith(cleanPublicUrl)) {
        let cdnUrl = urlMap.get(cover);
        if (!cdnUrl) {
          try {
            console.log(`Downloading blog cover: ${cover}`);
            const res = await fetch(cover, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const contentType = res.headers.get('content-type') || 'image/jpeg';
              const key = `cdn-repatriated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
              await s3Client.send(new PutObjectCommand({ Bucket: map.r2_bucket_name, Key: key, Body: buffer, ContentType: contentType }));
              cdnUrl = `${cleanPublicUrl}/${key}`;
              urlMap.set(cover, cdnUrl);
            }
          } catch (e) {
            console.error(`Failed blog cover ${cover}:`, e);
          }
        }
        if (cdnUrl) {
          cover = cdnUrl;
          postUpdated = true;
          count++;
        }
      }

      if (postUpdated) {
        await supabase.from('blog_posts').update({ cover_image: cover, content }).eq('id', post.id);
        console.log(`Updated blog post ${post.id}`);
      }
    }
  }

  console.log(`FINISHED! Total images repatriated to R2 CDN: ${count}`);
}

main();
