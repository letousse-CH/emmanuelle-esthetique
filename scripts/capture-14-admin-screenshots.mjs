import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 14 captations distinctes de l'admin
const ADMIN_14_PAGES = [
  { key: 'dashboard', url: 'http://localhost:5173/admin?screenshot=true', label: 'Tableau de Bord - Vue d’ensemble' },
  { key: 'caisse', url: 'http://localhost:5173/admin/caisse?screenshot=true', label: 'Caisse Enregistreuse - Encaissement TWINT/CB' },
  { key: 'produits', url: 'http://localhost:5173/admin/caisse/produits?screenshot=true', label: 'Catalogue des Produits & Prestations' },
  { key: 'clients', url: 'http://localhost:5173/admin/caisse/clients?screenshot=true', label: 'Fichier Clients & Historique CRM' },
  { key: 'bons', url: 'http://localhost:5173/admin/caisse/bons?screenshot=true', label: 'Gestion des Bons Cadeaux (BON-2026)' },
  { key: 'journal', url: 'http://localhost:5173/admin/caisse/journal?screenshot=true', label: 'Journal des Recettes & Export Fiducie' },
  { key: 'pages', url: 'http://localhost:5173/admin/pages?screenshot=true', label: 'Gestionnaire de Pages Dynamiques' },
  { key: 'pagebuilder', url: 'http://localhost:5173/admin/pages/edit/2c1455cb-f205-4b3e-9f01-57e4036e03ab?screenshot=true', label: 'PageBuilder Visuel & Retouche Vocale' },
  { key: 'blog', url: 'http://localhost:5173/admin/blog?screenshot=true', label: 'Gestion du Blog & SEO' },
  { key: 'blog_new', url: 'http://localhost:5173/admin/blog/new?screenshot=true', label: 'Générateur d’Articles IA & Micro' },
  { key: 'medias', url: 'http://localhost:5173/admin/medias?screenshot=true', label: 'Médiathèque & Stockage CDN Cloudflare R2' },
  { key: 'settings', url: 'http://localhost:5173/admin/settings?screenshot=true', label: 'Paramètres & Clés API Services' },
  { key: 'events', url: 'http://localhost:5173/admin/events?screenshot=true', label: 'Ateliers & Billetterie Stripe' },
  { key: 'newsletter', url: 'http://localhost:5173/admin/newsletter?screenshot=true', label: 'Newsletter & Abonnés Email' },
];

async function main() {
  console.log("🚀 Lancement de Puppeteer Core pour capturer les 14 interfaces réelles APRES chargement complet...");
  
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
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  const resultMap = {};

  for (const pageItem of ADMIN_14_PAGES) {
    const tmpFile = `/tmp/capture_${pageItem.key}.png`;
    console.log(`📸 Navigation vers : ${pageItem.label} (${pageItem.url})...`);

    try {
      await page.goto(pageItem.url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Attendre 3 secondes supplémentaires que l'animation Framer Motion et les requêtes Supabase s'affichent
      await new Promise(res => setTimeout(res, 3000));

      await page.screenshot({ path: tmpFile, fullPage: false });

      if (fs.existsSync(tmpFile)) {
        const buffer = fs.readFileSync(tmpFile);
        const r2Key = `admin-screen-${pageItem.key}-${Date.now()}.png`;

        console.log(`☁️ Upload de la capture chargée vers Cloudflare R2 : ${r2Key}...`);
        await s3Client.send(new PutObjectCommand({
          Bucket: map.r2_bucket_name,
          Key: r2Key,
          Body: buffer,
          ContentType: 'image/png',
        }));

        const cdnUrl = `${cleanPublicUrl}/${r2Key}`;
        resultMap[pageItem.key] = cdnUrl;

        // Ajouter dans la médiathèque Supabase
        await supabase.from('media_assets').insert({
          file_name: `${pageItem.label}.png`,
          url: cdnUrl,
          alt_text: pageItem.label,
        });

        console.log(`✅ Capturé & Uploadé avec succès (${pageItem.key}) -> ${cdnUrl}`);
      }
    } catch (err) {
      console.error(`❌ Erreur capture ${pageItem.key}:`, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync('./scripts/admin-14-screenshots.json', JSON.stringify(resultMap, null, 2));
  console.log("\n🎉 LES 14 CAPTURES D'ÉCRAN RÉELLES FULLY RENDERED SONT SUR CLOUDFLARE R2 !");
  console.log(JSON.stringify(resultMap, null, 2));
}

main();
