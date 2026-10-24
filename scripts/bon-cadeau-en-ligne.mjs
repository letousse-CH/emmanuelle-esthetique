/**
 * Page « Bon cadeau » : les boutons mènent à la commande en ligne, et les textes
 * décrivent le nouveau parcours (dès CHF 100, TWINT, PDF par e-mail).
 *
 *   node scripts/bon-cadeau-en-ligne.mjs            # essai : affiche ce qui serait fait
 *   node scripts/bon-cadeau-en-ligne.mjs --write    # applique
 *
 * ⚠️ À lancer APRÈS la mise en ligne du code qui sert /bon-cadeau/commander,
 * la migration 20261024_bons_commande_en_ligne.sql et l'ouverture de la vente
 * (Caisse › Bons cadeaux › Réglages) : sinon les boutons mèneraient à une page
 * qui renvoie au contact.
 *
 * Chaque champ n'est remplacé que s'il porte encore le texte d'origine : un
 * texte retouché depuis l'éditeur est laissé tel quel, et signalé. Une copie du
 * contenu d'avant est écrite dans scripts/backups/.
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

const COMMANDE = '/bon-cadeau/commander';

// [id du bloc ou de l'élément, champ, texte d'origine, nouveau texte]
const CHANGES = [
  ['4fac3d2d-2b3d-41cb-a4bf-8700f81f433a', 'ctaUrl', '/contact', COMMANDE],
  ['4fac3d2d-2b3d-41cb-a4bf-8700f81f433a', 'ctaText', 'Commander un bon', 'Commander en ligne'],
  ['de1e0ee0-d0b2-4ca8-a30d-69f2ceca7dbd', 'text',
    'Choisissez le montant qui vous convient, dès CHF 50 : la bénéficiaire choisit le soin qui lui fait envie.',
    'Choisissez le montant qui vous convient, dès CHF 100 : la personne qui le reçoit choisit le soin qui lui fait envie.'],
  ['50cb4332-0a92-42a6-84af-4b4aa7e665a3', 'title', 'PDF ou papier', 'En PDF, par e-mail'],
  ['50cb4332-0a92-42a6-84af-4b4aa7e665a3', 'text',
    'Le bon vous est envoyé en PDF par e-mail dans les 24 h, ou remis dans une enveloppe cartonnée à retirer à la cabine de Palézieux-Gare.',
    'Vous payez par TWINT ; dès réception du paiement, le bon vous est envoyé en PDF, prêt à imprimer ou à transmettre, avec votre petit mot.'],
  ['7b05db52-14ed-407d-94d9-db33f8e8761e', 'answer',
    'Écrivez-moi via le formulaire de contact, par e-mail ou par téléphone : indiquez le montant ou le soin souhaité, le nom de la bénéficiaire et le mode de livraison. Je vous envoie le bon dans les 24 h.',
    'En ligne, en quelques minutes : choisissez un montant (dès CHF 100) ou un ou plusieurs soins de la carte, indiquez le nom de la personne qui recevra le bon et, si vous le souhaitez, un petit mot imprimé dessus. Vous payez par TWINT, et le bon vous parvient en PDF par e-mail dès réception du paiement.'],
  ['1b3a320a-ef03-4a25-a8f0-c14c357a86cd', 'text',
    'Indiquez-moi le montant ou le soin souhaité et le nom de la bénéficiaire.',
    'Un montant ou des soins de la carte, votre petit mot : le bon vous parvient en PDF par e-mail.'],
  ['1b3a320a-ef03-4a25-a8f0-c14c357a86cd', 'ctaUrl', '/reservation', COMMANDE],
  ['1b3a320a-ef03-4a25-a8f0-c14c357a86cd', 'ctaText', 'Prendre rendez-vous', 'Commander en ligne'],
];

// Question ajoutée à la FAQ (une seule fois).
const FAQ_ID = 'c412180b-b175-41a4-ac14-5efae2ded735';
const NEW_FAQ = {
  id: '2f6b1c7e-5a0d-4c1e-9a43-bc0de6a1f824',
  question: 'Comment payer le bon cadeau ?',
  answer: 'Par TWINT, pour l’instant uniquement. Après votre commande, le montant à payer et le code TWINT s’affichent à l’écran ; ils vous sont aussi envoyés par e-mail.',
};

const { data: page, error } = await db
  .from('dynamic_pages')
  .select('id, slug, content, content_version')
  .eq('slug', 'bon-cadeau')
  .maybeSingle();
if (error) throw new Error(`Lecture de la page : ${error.message}`);
if (!page) throw new Error('Page « bon-cadeau » introuvable.');
if (page.content_version !== 2 || !Array.isArray(page.content)) {
  throw new Error('La page « bon-cadeau » n\'est pas au format du page builder v2 : modifiez les boutons depuis l\'éditeur.');
}

const content = structuredClone(page.content);

/** Tous les objets qui portent un `id` (blocs et éléments de listes). */
function byId(node, out = new Map()) {
  if (Array.isArray(node)) node.forEach((n) => byId(n, out));
  else if (node && typeof node === 'object') {
    if (typeof node.id === 'string') out.set(node.id, node);
    Object.values(node).forEach((v) => byId(v, out));
  }
  return out;
}
const nodes = byId(content);

let applied = 0;
for (const [id, field, before, after] of CHANGES) {
  const node = nodes.get(id);
  if (!node) { console.log(`– ${id}.${field} : élément absent (supprimé depuis l'éditeur ?), laissé tel quel.`); continue; }
  if (node[field] === after) { console.log(`= ${field} : déjà à jour.`); continue; }
  if (node[field] !== before) { console.log(`! ${field} : retouché depuis l'éditeur, laissé tel quel → « ${String(node[field]).slice(0, 80)} »`); continue; }
  node[field] = after;
  applied++;
  console.log(`✓ ${field} : « ${String(before).slice(0, 50)} » → « ${String(after).slice(0, 60)} »`);
}

const faq = nodes.get(FAQ_ID);
if (faq && Array.isArray(faq.items)) {
  if (faq.items.some((i) => i.id === NEW_FAQ.id || i.question === NEW_FAQ.question)) {
    console.log('= FAQ « Comment payer » : déjà présente.');
  } else {
    faq.items.splice(1, 0, NEW_FAQ);
    applied++;
    console.log('✓ FAQ : question « Comment payer le bon cadeau ? » ajoutée en deuxième position.');
  }
} else {
  console.log('– FAQ absente : question non ajoutée.');
}

if (applied === 0) {
  console.log('Rien à changer.');
  process.exit(0);
}
if (!write) {
  console.log(`\n${applied} changement(s). Essai seulement : relancez avec --write pour appliquer.`);
  process.exit(0);
}

mkdirSync('scripts/backups', { recursive: true });
const backup = `scripts/backups/bon-cadeau-avant-commande-en-ligne-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(backup, JSON.stringify({ id: page.id, slug: page.slug, content: page.content }, null, 2));
console.log(`Copie de sauvegarde : ${backup}`);

const { error: upErr } = await db
  .from('dynamic_pages')
  .update({ content, updated_at: new Date().toISOString() })
  .eq('id', page.id);
if (upErr) throw new Error(`Écriture refusée : ${upErr.message}`);
console.log(`${applied} changement(s) appliqué(s). La page se met à jour sur le site en une minute (régénération).`);
