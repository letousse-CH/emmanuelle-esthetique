import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_PAGES = [
  { name: 'admin-dashboard', url: 'http://localhost:5173/admin', label: 'Tableau de bord Administration' },
  { name: 'admin-caisse', url: 'http://localhost:5173/admin/caisse', label: 'Module Caisse Enregistreuse Suisse' },
  { name: 'admin-pages', url: 'http://localhost:5173/admin/pages', label: 'PageBuilder Visuel & Sections' },
  { name: 'admin-settings', url: 'http://localhost:5173/admin/settings', label: 'Paramètres & Configuration 1-Click' },
  { name: 'admin-medias', url: 'http://localhost:5173/admin/medias', label: 'Médiathèque & CDN Cloudflare R2' },
];

async function main() {
  console.log("1. Récupération de la configuration R2...");
  const { data: s } = await supabase.from('settings').select('key, value').like('key', 'r2_%');
  const map = Object.fromEntries((s ?? []).map(r => [r.key, r.value]));

  const cleanPublicUrl = map.r2_public_url.replace(/\/+$/, '');
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${map.r2_account_id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: map.r2_access_key_id, secretAccessKey: map.r2_secret_access_key },
    forcePathStyle: true,
  });

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const capturedUrls = {};

  for (const item of ADMIN_PAGES) {
    const tmpPath = `/tmp/${item.name}.png`;
    console.log(`2. Capture d'écran Chrome Headless pour : ${item.url}`);
    
    try {
      execSync(`"${chromePath}" --headless --disable-gpu --window-size=1600,1000 --screenshot="${tmpPath}" "${item.url}"`, {
        timeout: 15000,
        stdio: 'ignore'
      });

      if (fs.existsSync(tmpPath)) {
        const buffer = fs.readFileSync(tmpPath);
        const key = `admin-real-screenshot-${item.name}-${Date.now()}.png`;

        console.log(`3. Envoi sur le CDN Cloudflare R2 : ${key}...`);
        await s3Client.send(new PutObjectCommand({
          Bucket: map.r2_bucket_name,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
        }));

        const cdnUrl = `${cleanPublicUrl}/${key}`;
        capturedUrls[item.name] = cdnUrl;
        console.log(`✅ Upload réussi : ${cdnUrl}`);

        // Ajouter dans media_assets
        await supabase.from('media_assets').insert({
          file_name: `${item.label}.png`,
          url: cdnUrl,
          alt_text: item.label,
        });
      }
    } catch (err) {
      console.error(`Erreur capture ${item.name}:`, err.message);
    }
  }

  console.log("\n📸 Captures d'écran réelles publiées sur le CDN Cloudflare R2 :");
  console.log(JSON.stringify(capturedUrls, null, 2));

  // Écrire les URL dans un fichier de sortie pour update-home-showcase
  fs.writeFileSync('./scripts/admin-screenshots-urls.json', JSON.stringify(capturedUrls, null, 2));
}

main();
