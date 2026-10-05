/**
 * Pose l'encart « Offre du moment » sur la page d'accueil, juste sous l'en-tête.
 *
 *   node scripts/add-offer-section-home.mjs            # essai : affiche ce qui serait fait
 *   node scripts/add-offer-section-home.mjs --write    # applique
 *
 * ⚠️ À lancer APRÈS le déploiement du code qui connaît le bloc `current_offer`
 * (et après la migration 20261005_offres_du_moment.sql). Sur l'ancien code, le
 * bloc serait ignoré mais sa section resterait visible : une bande crème vide.
 *
 * La section ne contient que le bloc : sans offre en cours, le site ne la rend
 * pas du tout. Rien ne bouge donc sur l'accueil tant qu'aucune offre n'est active.
 *
 * Idempotent : ne fait rien si la page d'accueil contient déjà un bloc
 * « Offre du moment ». Une copie du contenu d'avant est écrite dans
 * scripts/backups/ pour pouvoir revenir en arrière.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const write = process.argv.includes('--write');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
const db = createClient(url, key, { auth: { persistSession: false } });

console.log(`Base : ${url}`);

// Même résolution que src/services/homePage.ts
const { data: setting } = await db.from('settings').select('value').eq('key', 'home_page_slug').maybeSingle();
const candidates = [String(setting?.value ?? '').trim(), 'home', 'accueil'].filter(Boolean);
let page = null;
for (const slug of candidates) {
  const { data, error } = await db.from('dynamic_pages').select('id, slug, content, content_version').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`Lecture de la page « ${slug} » : ${error.message}`);
  if (data) { page = data; break; }
}
if (!page) throw new Error(`Aucune page d'accueil trouvée (slugs essayés : ${candidates.join(', ')}).`);
if (page.content_version !== 2 || !Array.isArray(page.content)) {
  throw new Error(`La page « ${page.slug} » n'est pas au format du page builder v2 : ajoutez la section depuis l'éditeur (bibliothèque → Offre & soins → Offre du moment).`);
}

const content = page.content;
const already = content.some((s) => s.columns?.some((c) => c.blocks?.some((b) => b.type === 'current_offer')));
if (already) {
  console.log(`La page « ${page.slug} » contient déjà un bloc « Offre du moment » : rien à faire.`);
  process.exit(0);
}

const section = {
  id: randomUUID(),
  layout: '1-col',
  background: 'warm',
  paddingY: 'medium',
  innerPad: 'none',
  width: 'wide',
  columns: [{
    id: randomUUID(),
    blocks: [{
      id: randomUUID(),
      type: 'current_offer',
      eyebrow: 'Offre du moment',
      ctaText: 'Réserver cette offre',
      showPlaces: true,
      showConditions: true,
      imagePosition: 'left',
    }],
  }],
};

// Sous l'en-tête (première section), sinon en tête de page.
const at = content.length > 0 ? 1 : 0;
const next = [...content.slice(0, at), section, ...content.slice(at)];

console.log(`Page « ${page.slug} » : ${content.length} sections → section « Offre du moment » insérée en position ${at + 1}.`);
if (!write) {
  console.log('Essai seulement. Relancez avec --write pour appliquer.');
  process.exit(0);
}

mkdirSync('scripts/backups', { recursive: true });
const backup = `scripts/backups/home-avant-offre-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(backup, JSON.stringify({ id: page.id, slug: page.slug, content }, null, 2));
console.log(`Copie de sauvegarde : ${backup}`);

const { error } = await db.from('dynamic_pages').update({ content: next, updated_at: new Date().toISOString() }).eq('id', page.id);
if (error) throw new Error(`Écriture refusée : ${error.message}`);
console.log('Section ajoutée. Le site la montre dès qu\'une offre est en cours (régénération de la page : 60 s).');
