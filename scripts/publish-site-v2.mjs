/**
 * Mise en ligne de la refonte du site en silo (brouillons → production).
 *
 *   node scripts/publish-site-v2.mjs              # essai : montre ce qui serait fait
 *   node scripts/publish-site-v2.mjs --write      # applique
 *   node scripts/publish-site-v2.mjs --rollback backups/site-v2-<date>.json --write
 *
 * ORDRE À RESPECTER
 *   1. Fusionner la branche `feat/refonte-site-silo` dans `main` et attendre le
 *      déploiement Netlify : le code doit connaître les URL à plusieurs niveaux
 *      (`/soins/visage`) avant que les pages n'existent.
 *   2. Lancer ce script avec --write (quelques secondes ; le cache des pages se
 *      renouvelle en 60 s).
 *   3. Vérifier le site en ligne, puis soumettre le sitemap dans Google Search
 *      Console.
 *
 * Ce que fait --write :
 *   - sauvegarde JSON de tout ce qu'il va toucher (backups/site-v2-<date>.json,
 *     dossier ignoré par git) — c'est aussi le fichier du --rollback ;
 *   - pour chaque brouillon `brouillon/<x>` : si une page publiée porte déjà le
 *     slug `<x>`, elle est renommée `archive/<x>` et dépubliée ; puis le
 *     brouillon prend le slug `<x>` et est publié ;
 *   - dépublie les autres anciennes pages (sauf mentions-legales). Elles ne sont
 *     PAS supprimées, et leurs anciennes URL redirigent en 301 vers la nouvelle
 *     arborescence (src/config/legacyRedirects.ts) ;
 *   - copie les réglages SEO `seo_pages_brouillon_*` vers les vraies clés, le
 *     menu `navigation_menu_draft` vers `navigation_menu`, met à jour la
 *     fourchette de prix et le texte d'activité (« cabine privée ») ;
 *   - NE TOUCHE PAS au téléphone : voir l'avertissement affiché.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const write = process.argv.includes('--write');
const rollbackIdx = process.argv.indexOf('--rollback');
const rollbackFile = rollbackIdx > -1 ? process.argv[rollbackIdx + 1] : null;
const KEEP_AS_IS = new Set(['mentions-legales']);
const SEO_FIELDS = ['title', 'description', 'og_title', 'og_description', 'og_image', 'keywords'];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
const db = createClient(url, key, { auth: { persistSession: false } });

/** Même règle que getSeoPrefix() (src/services/pageMeta.ts). */
function seoPrefix(slug) {
  if (slug === 'home') return 'seo_home';
  if (['about', 'contact', 'mentions-legales'].includes(slug)) return `seo_${slug}`;
  return `seo_pages_${slug.replace(/\//g, '_')}`;
}

const must = (r, what) => {
  if (r.error) throw new Error(`${what} : ${r.error.message}`);
  return r.data;
};

async function rollback() {
  const m = JSON.parse(readFileSync(rollbackFile, 'utf8'));
  console.log(`Retour arrière depuis ${rollbackFile} (${m.at})\nBase : ${url}\nMode : ${write ? 'ÉCRITURE' : 'essai'}\n`);
  // Dans l'ordre inverse de l'application.
  for (const s of [...m.settings].reverse()) {
    console.log(`  réglage ${s.key} ← ${s.old === null ? '(supprimé)' : 'ancienne valeur'}`);
    if (!write) continue;
    if (s.old === null) must(await db.from('settings').delete().eq('key', s.key), s.key);
    else must(await db.from('settings').upsert({ key: s.key, value: s.old }, { onConflict: 'key' }), s.key);
  }
  for (const p of [...m.pages].reverse()) {
    console.log(`  page ${p.id.slice(0, 8)} : slug « ${p.to} » → « ${p.from} », published = ${p.wasPublished}`);
    if (!write) continue;
    must(await db.from('dynamic_pages').update({ slug: p.from, published: p.wasPublished }).eq('id', p.id), p.from);
  }
  console.log(write ? '\nRetour arrière appliqué.' : '\nEssai terminé — ajouter --write.');
}

async function publish() {
  console.log(`Base : ${url}\nMode : ${write ? 'ÉCRITURE' : 'essai (aucune écriture)'}\n`);
  const pages = must(await db.from('dynamic_pages').select('id, slug, title, published'), 'lecture des pages');
  const drafts = pages.filter((p) => p.slug.startsWith('brouillon/'));
  if (!drafts.length) throw new Error('Aucun brouillon `brouillon/…` : lancer d’abord `npx tsx scripts/seed-site-v2.ts --write`.');
  const newSlugs = new Set(drafts.map((d) => d.slug.replace(/^brouillon\//, '')));
  const live = pages.filter((p) => !p.slug.startsWith('brouillon/') && !p.slug.startsWith('archive/'));

  const manifest = { at: new Date().toISOString(), base: url, pages: [], settings: [] };
  const step = async (page, patch, label) => {
    console.log(`  ${label}`);
    manifest.pages.push({ id: page.id, from: page.slug, to: patch.slug ?? page.slug, wasPublished: page.published });
    if (write) must(await db.from('dynamic_pages').update(patch).eq('id', page.id), label);
  };

  console.log('1. Anciennes pages');
  for (const old of live) {
    if (KEEP_AS_IS.has(old.slug)) { console.log(`  = ${old.slug} (conservée telle quelle)`); continue; }
    if (newSlugs.has(old.slug)) {
      await step(old, { slug: `archive/${old.slug}`, published: false }, `${old.slug} → archive/${old.slug} (remplacée par le brouillon du même nom)`);
    } else if (old.published) {
      await step(old, { published: false }, `${old.slug} dépubliée (redirection 301 si prévue)`);
    }
  }

  console.log('\n2. Brouillons → pages publiées');
  for (const d of drafts) {
    const target = d.slug.replace(/^brouillon\//, '');
    await step(d, { slug: target, published: true }, `${d.slug} → /${target} (publiée)`);
  }

  console.log('\n3. Réglages');
  const allSettings = must(await db.from('settings').select('key, value'), 'lecture des réglages');
  const current = new Map(allSettings.map((s) => [s.key, s.value]));
  const setSetting = async (k, v, label) => {
    console.log(`  ${label}`);
    manifest.settings.push({ key: k, old: current.has(k) ? current.get(k) : null });
    if (write) must(await db.from('settings').upsert({ key: k, value: v }, { onConflict: 'key' }), k);
  };
  for (const slug of newSlugs) {
    for (const f of SEO_FIELDS) {
      const from = `seo_pages_brouillon_${slug.replace(/\//g, '_')}_${f}`;
      if (!current.has(from)) continue;
      await setSetting(`${seoPrefix(slug)}_${f}`, current.get(from), `SEO ${slug} · ${f}`);
    }
  }
  if (current.get('navigation_menu_draft')) await setSetting('navigation_menu', current.get('navigation_menu_draft'), 'menu de navigation (brouillon → production)');
  await setSetting('business_price_range', 'CHF 15 – CHF 230', 'fourchette de prix (CHF 15 – CHF 230, d’après la carte)');
  await setSetting(
    'site_activity_context',
    'Emmanuelle Esthétique — Institut de beauté et bien-être en cabine privée à Palézieux-Gare (Vaud, Suisse). Soins du visage et rituels du corps à la cosmétique marine Phytomer, beauté des mains et des pieds, beauté du regard, épilation à la cire douce et à la pâte de sucre, bons cadeaux. Sur rendez-vous.',
    'texte d’activité (prompts IA) : « cabine privée » au lieu de « à domicile »',
  );

  if (write) {
    mkdirSync('backups', { recursive: true });
    const file = `backups/site-v2-${manifest.at.replace(/[:.]/g, '-')}.json`;
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    console.log(`\nMise en ligne appliquée. Retour arrière possible : node scripts/publish-site-v2.mjs --rollback ${file} --write`);
  } else {
    console.log('\nEssai terminé — ajouter --write pour appliquer.');
  }

  const phone = current.get('business_phone');
  console.log(`\n⚠ À vérifier avec Emmanuelle : le réglage « business_phone » vaut « ${phone} » (${String(phone).replace(/\D/g, '').length} chiffres),`);
  console.log('  alors que les pages affichent +41 78 823 66 12. Corriger dans /admin/settings (onglet Entreprise) — il alimente le JSON-LD, le pied de page et llms.txt.');
}

(rollbackFile ? rollback() : publish()).catch((e) => {
  console.error(e);
  process.exit(1);
});
