/**
 * Pose l'encart « Offrir un bon cadeau » (bloc `gift_cta`) sur les pages soins,
 * la carte des soins et l'accueil, juste avant leurs questions fréquentes.
 *
 *   node scripts/add-gift-sections.mjs            # essai : affiche ce qui serait fait
 *   node scripts/add-gift-sections.mjs --write    # applique
 *
 * ⚠️ À lancer APRÈS la mise en ligne du code qui connaît le bloc `gift_cta` :
 * sur l'ancien code, le bloc serait ignoré et sa section resterait vide.
 *
 * Idempotent : une page qui contient déjà un encart « Offrir » est laissée
 * telle quelle. Les textes se retouchent ensuite depuis l'éditeur. Une copie du
 * contenu d'avant est écrite dans scripts/backups/.
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

const SECONDARY = 'ou offrir un montant libre';
const TEXT = 'Un bon à son nom, avec votre petit mot imprimé : il arrive en PDF par e-mail, prêt à offrir ou à imprimer.';

const PAGES = [
  { slug: 'soins/visage', famille: 'visage', title: 'Offrez un soin du visage Phytomer', cta: 'Offrir un soin du visage' },
  { slug: 'soins/corps', famille: 'corps', title: 'Offrez un massage ou un rituel du corps', cta: 'Offrir un soin du corps' },
  { slug: 'soins/mains-et-pieds', famille: 'mains-pieds', title: 'Offrez des mains et des pieds choyés', cta: 'Offrir un soin des mains ou des pieds' },
  { slug: 'soins/regard', famille: 'regard', title: 'Offrez un regard sublimé', cta: 'Offrir un soin du regard' },
  { slug: 'soins/epilation', famille: 'epilation', title: 'Offrez une peau douce, en toute sérénité', cta: 'Offrir une épilation' },
  { slug: 'soins', famille: '', title: 'Offrez un soin de la carte', cta: 'Offrir un bon cadeau', position: 'right' },
  { slug: 'home', famille: '', title: 'Offrez une parenthèse de douceur', cta: 'Offrir un bon cadeau', position: 'right',
    text: 'Un soin du visage, un massage, un rituel ou un montant à choisir, avec votre petit mot imprimé sur le bon : il arrive en PDF par e-mail, prêt à offrir.' },
];

function section(p) {
  return {
    id: randomUUID(),
    layout: '1-col',
    background: 'warm',
    paddingY: 'large',
    width: 'wide',
    columns: [{
      id: randomUUID(),
      blocks: [{
        id: randomUUID(),
        type: 'gift_cta',
        eyebrow: 'Bon cadeau',
        title: p.title,
        text: p.text ?? TEXT,
        famille: p.famille,
        ctaText: p.cta,
        secondaryText: SECONDARY,
        imagePosition: p.position ?? 'left',
      }],
    }],
  };
}

const hasType = (s, type) => s.columns?.some((c) => c.blocks?.some((b) => b.type === type));

const plans = [];
for (const p of PAGES) {
  const { data: page, error } = await db
    .from('dynamic_pages')
    .select('id, slug, content, content_version, published')
    .eq('slug', p.slug)
    .maybeSingle();
  if (error) throw new Error(`Lecture de « ${p.slug} » : ${error.message}`);
  if (!page) { console.log(`– ${p.slug} : page absente, ignorée.`); continue; }
  if (page.content_version !== 2 || !Array.isArray(page.content)) {
    console.log(`– ${p.slug} : pas au format du page builder v2, ignorée (ajoutez l'encart depuis l'éditeur).`);
    continue;
  }
  if (page.content.some((s) => hasType(s, 'gift_cta'))) {
    console.log(`= ${p.slug} : contient déjà un encart « Offrir ».`);
    continue;
  }
  // Juste avant les questions fréquentes ; sinon avant la dernière section (l'appel à réserver).
  const faqAt = page.content.findIndex((s) => hasType(s, 'faq'));
  const at = faqAt >= 0 ? faqAt : Math.max(0, page.content.length - 1);
  const next = [...page.content.slice(0, at), section(p), ...page.content.slice(at)];
  plans.push({ page, next });
  console.log(`✓ ${p.slug} : encart « ${p.title} » en position ${at + 1} sur ${next.length}${faqAt >= 0 ? ' (avant la FAQ)' : ''}.`);
}

if (plans.length === 0) {
  console.log('Rien à changer.');
  process.exit(0);
}
if (!write) {
  console.log(`\n${plans.length} page(s) à compléter. Essai seulement : relancez avec --write pour appliquer.`);
  process.exit(0);
}

mkdirSync('scripts/backups', { recursive: true });
const backup = `scripts/backups/pages-avant-encart-cadeau-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(backup, JSON.stringify(plans.map(({ page }) => ({ id: page.id, slug: page.slug, content: page.content })), null, 2));
console.log(`Copie de sauvegarde : ${backup}`);

for (const { page, next } of plans) {
  const { error } = await db.from('dynamic_pages').update({ content: next, updated_at: new Date().toISOString() }).eq('id', page.id);
  if (error) throw new Error(`Écriture refusée pour « ${page.slug} » : ${error.message}`);
  console.log(`Écrit : ${page.slug}`);
}
console.log('Les pages se mettent à jour sur le site en une minute (régénération).');
