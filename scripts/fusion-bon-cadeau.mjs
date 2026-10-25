/**
 * Fusion de « Bon cadeau » et de « Commander un bon cadeau » (2026-10-25) :
 * `/bon-cadeau` affiche désormais l'en-tête et le parcours de commande (code,
 * `app/(public)/bon-cadeau/page.tsx`), puis le contenu de la page du page
 * builder. Ce script retire de ce contenu ce que le code affiche déjà :
 *
 *   - la section d'en-tête (bloc hero « Offrez une parenthèse de douceur ») ;
 *   - les trois cartes « montant libre / soin précis / en PDF », que répète le
 *     premier écran du parcours ;
 *   - l'encart final « Commander en ligne », qui renverrait à la même page.
 *
 * Restent les conditions (« Bon à savoir ») et la FAQ, dont la réponse sur le
 * paiement parle du bouton TWINT (le code QR n'est plus affiché en ligne).
 *
 *   node scripts/fusion-bon-cadeau.mjs            # essai : affiche ce qui serait fait
 *   node scripts/fusion-bon-cadeau.mjs --write    # applique
 *
 * ⚠️ À lancer APRÈS la mise en ligne du code qui sert la page fusionnée :
 * l'ancien code afficherait /bon-cadeau sans en-tête ni bouton de commande.
 *
 * Une section n'est retirée que si elle contient encore son bloc d'origine, et
 * la réponse de la FAQ n'est remplacée que si elle porte encore le texte
 * d'origine. Une copie du contenu d'avant est écrite dans scripts/backups/.
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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
const db = createClient(url, key, { auth: { persistSession: false } });
console.log(`Base : ${url}`);

// [section, bloc qu'elle doit encore contenir, ce que c'est]
const REMOVE = [
  ['06cbe6f1-117c-4285-b4e1-6fde4281e490', '4fac3d2d-2b3d-41cb-a4bf-8700f81f433a', 'en-tête « Offrez une parenthèse de douceur »'],
  ['4c8696b4-9f5b-4c83-a843-0575dcad4995', '5f7a5d56-d31a-4331-961f-3c593e8a1b44', 'cartes « montant libre / soin précis / en PDF »'],
  ['a2a3875a-fa2a-4a18-b6b8-3fdc507fd147', '1b3a320a-ef03-4a25-a8f0-c14c357a86cd', 'encart « Commander en ligne »'],
];

const FAQ_ID = 'c412180b-b175-41a4-ac14-5efae2ded735';
const PAY_ITEM = '2f6b1c7e-5a0d-4c1e-9a43-bc0de6a1f824';
const PAY_BEFORE = 'Par TWINT, pour l’instant uniquement. Après votre commande, le montant à payer et le code TWINT s’affichent à l’écran ; ils vous sont aussi envoyés par e-mail.';
const PAY_AFTER = 'Par TWINT, pour l’instant uniquement. Après votre commande, un bouton « Payer avec TWINT » s’affiche, avec le montant et la référence de la commande déjà remplis ; il vous est aussi envoyé par e-mail.';

const { data: page, error } = await db
  .from('dynamic_pages')
  .select('id, slug, content, content_version')
  .eq('slug', 'bon-cadeau')
  .maybeSingle();
if (error) throw new Error(error.message);
if (!page) throw new Error('Page « bon-cadeau » introuvable.');
if (page.content_version !== 2 || !Array.isArray(page.content)) throw new Error('La page n’est pas au format v2 : rien à faire ici.');

const blockIds = (section) => (section.columns ?? []).flatMap((c) => (c.blocks ?? []).map((b) => b.id));
let applied = 0;

const content = [];
for (const section of page.content) {
  const rule = REMOVE.find(([id]) => id === section.id);
  if (!rule) { content.push(section); continue; }
  if (!blockIds(section).includes(rule[1])) {
    console.log(`! ${rule[2]} : retouchée depuis l'éditeur, laissée telle quelle.`);
    content.push(section);
    continue;
  }
  applied++;
  console.log(`✓ section retirée : ${rule[2]}`);
}
for (const [id, , label] of REMOVE) {
  if (!page.content.some((s) => s.id === id)) console.log(`= ${label} : déjà retirée.`);
}

const faq = content.flatMap((s) => (s.columns ?? []).flatMap((c) => c.blocks ?? [])).find((b) => b.id === FAQ_ID);
const item = faq?.items?.find((i) => i.id === PAY_ITEM);
if (!item) console.log('– FAQ « Comment payer » absente : rien à remplacer.');
else if (item.answer === PAY_AFTER) console.log('= FAQ « Comment payer » : déjà à jour.');
else if (item.answer !== PAY_BEFORE) console.log(`! FAQ « Comment payer » : retouchée depuis l'éditeur, laissée telle quelle → « ${item.answer.slice(0, 80)} »`);
else { item.answer = PAY_AFTER; applied++; console.log('✓ FAQ « Comment payer » : le bouton TWINT remplace le code.'); }

// Un lien vers l'ancienne adresse qui resterait (redirigée en 301, mais autant viser juste).
const json = JSON.stringify(content);
const leftovers = json.split('/bon-cadeau/commander').length - 1;
const finalContent = leftovers ? JSON.parse(json.replaceAll('/bon-cadeau/commander', '/bon-cadeau')) : content;
if (leftovers) { applied += leftovers; console.log(`✓ ${leftovers} lien(s) vers /bon-cadeau/commander → /bon-cadeau`); }

if (applied === 0) {
  console.log('Rien à changer.');
  process.exit(0);
}
if (!write) {
  console.log(`\n${applied} changement(s). Essai seulement : relancez avec --write pour appliquer.`);
  process.exit(0);
}

mkdirSync('scripts/backups', { recursive: true });
const backup = `scripts/backups/bon-cadeau-avant-fusion-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(backup, JSON.stringify({ id: page.id, slug: page.slug, content: page.content }, null, 2));
console.log(`Copie de sauvegarde : ${backup}`);

const { error: upErr } = await db
  .from('dynamic_pages')
  .update({ content: finalContent, updated_at: new Date().toISOString() })
  .eq('id', page.id);
if (upErr) throw new Error(`Écriture refusée : ${upErr.message}`);
console.log(`${applied} changement(s) appliqué(s). La page se met à jour sur le site en une minute (régénération).`);
