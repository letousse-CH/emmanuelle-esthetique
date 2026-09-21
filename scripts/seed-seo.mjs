#!/usr/bin/env node
/**
 * Script de seed SEO — Emmanuelle Esthétique
 *
 * Peuple `dynamic_pages` et `settings` avec l'arborescence SEO locale/GEO
 * définie dans src/services/seederEmmanuelle.ts.
 *
 * Requiert :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (⚠️ ne jamais exposer côté client)
 *
 * Usage :
 *   node scripts/seed-seo.mjs
 *
 * Sans risque : upsert par slug, ne supprime aucune page hors du registre.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Charge .env local sans dépendre de dotenv
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch (err) {
  console.warn('[seed-seo] .env introuvable, on continue avec les variables d\'environnement système.');
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL manquant dans .env');
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env');
  console.error('   → Récupérez-la sur https://supabase.com/dashboard → votre projet → Settings → API → service_role (Secret)');
  console.error('   → Ajoutez la ligne : SUPABASE_SERVICE_ROLE_KEY="<votre clé>"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Import dynamique du seeder TypeScript compilé (via tsx si dispo, sinon
// nous utilisons esbuild-runtime via node --loader). Ici, plus simple :
// importer un module JSON généré ou dupliquer le registre en pur ESM.
// Pour éviter les dépendances lourdes, ce script parse le .ts et évalue
// le registre via un import direct de la version transpilée à la volée.

// Approche pragmatique : importer directement le module TS via une compilation
// à la volée avec tsx si installé. Sinon on informe l'utilisateur.
let mod;
try {
  const { register } = await import('tsx/esm/api');
  register();
  mod = await import('../src/services/seederEmmanuelle.ts');
} catch (err) {
  console.error('❌ Impossible de charger le seeder TypeScript.');
  console.error('   → Installez tsx : npm i -D tsx');
  console.error('   Détail :', err?.message || err);
  process.exit(1);
}

const { EMMANUELLE_PAGES } = mod;

console.log(`\n🌿 Seed SEO Emmanuelle — ${EMMANUELLE_PAGES.length} pages à traiter\n`);

async function upsertPages() {
  let inserted = 0;
  let updated = 0;
  for (const page of EMMANUELLE_PAGES) {
    const { data: existing, error: selectErr } = await supabase
      .from('dynamic_pages')
      .select('id')
      .eq('slug', page.slug)
      .maybeSingle();
    if (selectErr) throw selectErr;
    if (existing) {
      const { error } = await supabase
        .from('dynamic_pages')
        .update({
          title: page.title,
          sections: page.sections,
          published: page.published,
        })
        .eq('id', existing.id);
      if (error) throw error;
      updated += 1;
      console.log(`   ✏️  Mis à jour  /${page.slug === 'home' ? '' : page.slug}`);
    } else {
      const { error } = await supabase.from('dynamic_pages').insert({
        title: page.title,
        slug: page.slug,
        sections: page.sections,
        published: page.published,
      });
      if (error) throw error;
      inserted += 1;
      console.log(`   ✨ Créé       /${page.slug === 'home' ? '' : page.slug}`);
    }
  }
  console.log(`\n✅ Pages : ${inserted} créées · ${updated} mises à jour`);
}

async function upsertSeoMeta() {
  const rows = [];
  for (const page of EMMANUELLE_PAGES) {
    const p = `seo_pages_${page.slug}_`;
    rows.push({ key: `${p}title`, value: page.seo.title });
    rows.push({ key: `${p}description`, value: page.seo.description });
    if (page.seo.og_title) rows.push({ key: `${p}og_title`, value: page.seo.og_title });
    if (page.seo.og_description)
      rows.push({ key: `${p}og_description`, value: page.seo.og_description });
    if (page.seo.keywords) rows.push({ key: `${p}keywords`, value: page.seo.keywords });
  }
  // Clés spéciales de la home
  const home = EMMANUELLE_PAGES.find((p) => p.slug === 'home');
  if (home) {
    rows.push({ key: 'seo_home_title', value: home.seo.title });
    rows.push({ key: 'seo_home_description', value: home.seo.description });
    if (home.seo.og_title) rows.push({ key: 'seo_home_og_title', value: home.seo.og_title });
    if (home.seo.og_description) rows.push({ key: 'seo_home_og_description', value: home.seo.og_description });
    if (home.seo.keywords) rows.push({ key: 'seo_home_keywords', value: home.seo.keywords });
  }
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  console.log(`✅ Meta SEO : ${rows.length} entrées settings mises à jour`);
}

async function upsertNavAndBusiness() {
  const nav = JSON.stringify([
    { name: 'Accueil', path: '/' },
    { name: 'Soins visage', path: '/soins-visage-palezieux' },
    { name: 'Soins corps', path: '/soins-corps-palezieux' },
    { name: 'Beauté du regard', path: '/beaute-du-regard-palezieux' },
    { name: 'Épilation', path: '/epilation-sucre-palezieux' },
    { name: 'Ateliers', path: '/ateliers-bien-etre-palezieux' },
    { name: 'À propos', path: '/a-propos' },
    { name: 'Contact', path: '/contact' },
  ]);
  const rows = [
    { key: 'navigation_menu', value: nav },
    { key: 'business_job_title', value: 'Esthéticienne diplômée · Institut à domicile' },
    { key: 'business_price_range', value: 'CHF 30 – CHF 170' },
    {
      key: 'business_area_served',
      value:
        'Palézieux-Gare, Palézieux-Village, Oron, Châtel-Saint-Denis, Chexbres, Puidoux, Rue, Bulle, Vevey, Lavaux, Broye',
    },
    {
      key: 'business_opening_hours',
      value: JSON.stringify([
        { days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], opens: '09:00', closes: '19:00' },
      ]),
    },
    { key: 'business_geo_lat', value: '46.5445' },
    { key: 'business_geo_lng', value: '6.8380' },
    { key: 'business_schema_type', value: 'BeautySalon' },
    { key: 'header_register_link', value: '/contact' },
  ];
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  console.log(`✅ Nav & business : ${rows.length} réglages mis à jour`);
}

try {
  await upsertPages();
  await upsertSeoMeta();
  await upsertNavAndBusiness();
  console.log('\n🎉 Seed SEO Emmanuelle terminé avec succès !\n');
  console.log('   → Lancez `npm run dev` et ouvrez http://localhost:3000/');
} catch (err) {
  console.error('\n❌ Erreur pendant le seed :', err?.message || err);
  console.error(err);
  process.exit(1);
}
