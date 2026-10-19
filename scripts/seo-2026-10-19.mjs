/**
 * Audit SEO du 2026-10-19 : la part du plan qui vit en base (réglages et pages).
 *
 *   node scripts/seo-2026-10-19.mjs            # essai : affiche ce qui changerait
 *   node scripts/seo-2026-10-19.mjs --write    # applique
 *
 * Ce que le script écrit :
 *  - titres et descriptions (accueil, contact), image de partage de
 *    /soins/visage et /bon-cadeau (photos de la cabine au lieu de Pexels) ;
 *  - le graphe Schema.org : intitulé de métier, présentation, domaines de
 *    compétence, photos du lieu, moyens de paiement (lus par app/layout.tsx) ;
 *  - l'accueil : H1, réponse de la FAQ sur les rendez-vous (texte visible et
 *    FAQPage, qui sortent du même bloc), textes alternatifs des photos ;
 *  - la page /venir (créée publiée), son lien dans le pied de page et depuis
 *    la page Contact ;
 *  - le blog : titre, accroche et balises de /blog, piliers éditoriaux alignés
 *    sur la carte (ils guident la rédaction IA des articles), et le ton de
 *    marque corrigé (« cocon à domicile » → cabine privée).
 *
 * Chaque valeur d'avant est vérifiée : si elle a changé depuis l'audit (la page
 * a été retouchée dans l'éditeur), le script s'arrête au lieu d'écraser. Une
 * copie de tout ce qui est remplacé est écrite dans scripts/backups/.
 *
 * ⚠️ À lancer après le déploiement du code : l'ancien layout.tsx ne lit pas les
 * nouveaux réglages Schema.org (sans danger, mais sans effet).
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
console.log(`Base : ${url}${write ? '' : '   (essai — rien n’est écrit)'}\n`);

const R2 = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev';
const PHOTO = {
  tableSoin: `${R2}/1791296583792-cabine-soins-esthetiques-palezieux-gare-portrait_89C6873.CR2.webp`,
  vueCabine: `${R2}/1791296588293-cabine-soins-esthetiques-palezieux-gare-portrait_89C6887.CR2.webp`,
};

// ── Réglages ────────────────────────────────────────────────────────────────
const SETTINGS = {
  seo_home_title: 'Institut de beauté à Palézieux-Gare | Emmanuelle Esthétique',
  seo_home_description:
    'Institut de beauté à Palézieux-Gare (VD) : soins du visage et du corps Phytomer, épilation au sucre, mains et pieds. Cabine privée, sur rendez-vous.',
  seo_contact_title: 'Rendez-vous et accès | Esthéticienne à Palézieux-Gare',
  'seo_pages_soins_visage_og_image': PHOTO.tableSoin,
  'seo_pages_bon-cadeau_og_image': PHOTO.vueCabine,

  business_job_title: 'Esthéticienne',
  business_owner_bio:
    'Esthéticienne depuis plus de 20 ans, passée par le Skin Spa Clarins Vevey, le Lausanne Palace et Thalasso en ville.',
  business_knows_about: [
    'Soins du visage Phytomer',
    'Massages et rituels du corps',
    'Épilation à la cire douce et à la pâte de sucre',
    'Beauté des mains et des pieds',
    'Beauté du regard',
  ].join('\n'),
  // Pas la photo « cabinet-hypnose-…-02 » proposée par l'audit : même pièce,
  // mais un nom de fichier hérité d'un autre site ; les photos pro sont mieux nommées.
  business_images: [
    `${R2}/1790524727824-WhatsApp-Image-2026-09-27-at-17.51.49.webp`,
    PHOTO.tableSoin,
    PHOTO.vueCabine,
  ].join('\n'),
  business_payment_accepted: 'TWINT, espèces, cartes bancaires, bons cadeaux',

  seo_pages_venir_title: 'Institut de beauté près d’Oron, Châtel-Saint-Denis et Lavaux | Emmanuelle Esthétique',
  seo_pages_venir_description:
    'Venir à Emmanuelle Esthétique depuis Oron, Châtel-Saint-Denis, Chexbres ou Lavaux : à 2 minutes à pied de la gare CFF de Palézieux, parking gratuit.',
  seo_pages_venir_og_image: PHOTO.vueCabine,

  // Blog : piliers éditoriaux (Réglages › Éditorial & Marque), lus par la
  // génération d'idées et de plans. Les anciens parlaient de Gua Sha, de Head
  // Spa et de cosmétique naturelle, absents de la carte.
  site_blog_topics: [
    '1. Soins du visage Phytomer : comprendre l’état de sa peau (déshydratée, terne, sensible, premières rides), choisir entre les protocoles de la carte, ce qui se passe pendant le soin en cabine.',
    '2. Épilation à la cire douce et à la pâte de sucre : peaux sensibles, repousse et poils incarnés, préparer sa peau et en prendre soin après l’épilation.',
    '3. Massages et rituels du corps : déroulé du grand massage relaxant (60 ou 90 min), gommage aux sels marins, soin détox du dos, ce que l’on ressent pendant et après.',
    '4. Beauté des mains et des pieds : soins Prestige « Spa », entretien des ongles et des cuticules entre deux rendez-vous.',
    '5. Beauté du regard : teinture des cils et des sourcils, réhaussement de cils — tenue, préparation, entretien.',
    '6. La cosmétique marine Phytomer : algues, sels marins, boue marine — ce que contiennent les soins et ce qu’ils apportent à la peau.',
    '7. Sa peau au fil des saisons : adapter ses gestes au froid, au soleil et à la fatigue entre deux soins en institut.',
  ].join('\n'),
  blog_heading: 'Conseils d’esthéticienne',
  blog_intro:
    'Soins du visage Phytomer, épilation au sucre, massages, mains et pieds : Emmanuelle partage ce que plus de 20 ans de métier lui ont appris sur la peau et sur les soins.',
  seo_pages_blog_title: 'Conseils beauté d’esthéticienne | Emmanuelle Esthétique',
  seo_pages_blog_description:
    'Conseils d’esthéticienne pour la peau, l’épilation au sucre, les massages et les soins marins Phytomer, par Emmanuelle Esthétique à Palézieux-Gare.',
};

// Corrections ciblées dans des textes éditoriaux plus longs : seule la
// formule fautive est remplacée, le reste du réglage est laissé tel quel.
const TEXT_FIXES = {
  site_brand_tone: [
    'dans un cocon à domicile à Palézieux.',
    'dans une cabine privée à Palézieux-Gare.',
  ],
  site_tone_of_voice: [
    'comme une esthéticienne qui accueille chez elle.',
    'comme une esthéticienne qui vous accueille dans sa cabine.',
  ],
};

const VENIR_LINK = { name: 'Comment venir', path: '/venir' };

// ── Accueil : valeurs attendues (état du 2026-10-19) et nouvelles valeurs ───
const HOME_H1 = { from: 'Soins marins Phytomer à Palézieux-Gare', to: 'Institut de beauté et soins marins Phytomer à Palézieux-Gare' };
const FAQ_RDV = {
  id: '221069c9-3bab-4291-aa94-f36284ddd650',
  from: 'Uniquement sur rendez-vous, du lundi au samedi, de 9 h à 18 h, sur rendez-vous. Écrivez via le formulaire de contact, par e-mail ou par téléphone : vous recevez une réponse sous 24 h.',
  to: 'Sur rendez-vous, du lundi au samedi, de 9 h à 18 h. Écrivez via le formulaire de contact, par e-mail ou par téléphone : vous recevez une réponse sous 24 h.',
};
// Texte alternatif par photo (fin de l'URL), seulement là où il est vide.
const ALTS = {
  '89C6873.CR2.webp': 'Table de soin et étagère de produits Phytomer dans la cabine de Palézieux-Gare',
  '89C6848.CR2.webp': 'Bocal de coquillages dans la cabine de soins de Palézieux-Gare',
  '89C6853.CR2.webp': 'Étagère de produits Phytomer et linge de soin dans la cabine de Palézieux-Gare',
  '89C6869.CR2.webp': 'Visuel Phytomer dans la cabine de soins de Palézieux-Gare',
  '89C6887.CR2.webp': 'Cabine de soins de Palézieux-Gare : table de massage, fauteuils et lumière naturelle',
  '89C6858.CR2.webp': 'Soins du visage Phytomer présentés dans la cabine de Palézieux-Gare',
};

// ── Page /venir : uniquement des faits déjà publiés sur la page Contact ────
const id = () => randomUUID();
const section = (blocks, extra = {}) => ({
  id: id(), layout: '1-col', paddingY: 'large', background: 'transparent',
  columns: [{ id: id(), blocks }], ...extra,
});
const VENIR_CONTENT = [
  section([{
    id: id(), type: 'hero', size: 'medium', align: 'center',
    eyebrow: 'Accès & trajets',
    title: 'Institut de beauté près d’Oron, Châtel-Saint-Denis et Lavaux',
    text: 'La cabine privée d’Emmanuelle Esthétique est à deux minutes à pied de la gare CFF de Palézieux, avec une place de parking gratuite devant la porte. Elle accueille les clientes de Palézieux, Oron, Puidoux, Chexbres, Châtel-Saint-Denis, Lavaux, Vevey et de la Broye.',
    ctaText: 'Prendre rendez-vous', ctaUrl: '/reservation',
    secondaryText: 'Voir la carte des soins', secondaryUrl: '/soins',
  }], { width: 'narrow', background: 'warm' }),
  section([
    { id: id(), type: 'heading', level: 2, align: 'left', eyebrow: 'En train', text: 'Depuis la gare CFF de Palézieux' },
    { id: id(), type: 'text', html:
      '<p>La gare de Palézieux est à 2 minutes à pied de la cabine.</p>' +
      '<ul>' +
      '<li><strong>Depuis Oron, Puidoux et Romont</strong> : S4 directe.</li>' +
      '<li><strong>Depuis Vevey et la Riviera</strong> : S4, 17 min.</li>' +
      '<li><strong>Depuis Lausanne</strong> : IR15, 18 min.</li>' +
      '<li><strong>Depuis Fribourg</strong> : IR15, 25 min.</li>' +
      '<li><strong>Depuis Bulle</strong> : 12 min.</li>' +
      '</ul>' },
    { id: id(), type: 'heading', level: 2, align: 'left', eyebrow: 'En voiture', text: 'Par l’A12 ou l’A9, parking gratuit' },
    { id: id(), type: 'text', html:
      '<ul>' +
      '<li><strong>Autoroute A12</strong>, sortie Châtillens / Oron : à 5 min de la cabine.</li>' +
      '<li><strong>Autoroute A9</strong>, sortie Chexbres depuis la Riviera et Lavaux : à 15 min.</li>' +
      '</ul>' +
      '<p>Une place de parking gratuite est disponible devant la cabine.</p>' },
  ], { width: 'narrow' }),
  section([{
    id: id(), type: 'contact', title: 'Adresse et horaires',
    address: 'Chemin de la Marouette 19, 1607 Palézieux (VD)',
    phone: '+41 78 225 76 36',
    hours: 'Du lundi au samedi, de 9 h à 18 h, sur rendez-vous',
  }], { width: 'narrow', background: 'surface' }),
  section([{
    id: id(), type: 'callout', title: 'Offrez-vous une parenthèse',
    text: 'Soins du visage et du corps Phytomer, mains et pieds, regard, épilation. Réponse sous 24 h.',
    ctaText: 'Prendre rendez-vous', ctaUrl: '/reservation',
  }], { background: 'dark' }),
];

const CONTACT_LINK_HTML =
  '<p><a href="/venir">Venir depuis Oron, Châtel-Saint-Denis ou Lavaux : trajets en train et en voiture</a></p>';

// ────────────────────────────────────────────────────────────────────────────
const backup = { date: new Date().toISOString(), settings: {}, pages: {} };
const changes = [];

const { data: rows, error: setErr } = await db.from('settings').select('key, value')
  .in('key', [...Object.keys(SETTINGS), ...Object.keys(TEXT_FIXES), 'footer_legal_links']);
if (setErr) throw setErr;
const current = Object.fromEntries(rows.map((r) => [r.key, r.value]));

const settingUpserts = [];
for (const [k, v] of Object.entries(SETTINGS)) {
  if (current[k] === v) continue;
  backup.settings[k] = current[k] ?? null;
  settingUpserts.push({ key: k, value: v });
  changes.push(`réglage ${k}\n    avant : ${JSON.stringify(current[k] ?? null)}\n    après : ${JSON.stringify(v)}`);
}

for (const [k, [from, to]] of Object.entries(TEXT_FIXES)) {
  const value = current[k] ?? '';
  if (value.includes(to)) continue;
  if (!value.includes(from)) {
    console.warn(`⚠️ ${k} : formule « ${from} » introuvable, réglage laissé tel quel.`);
    continue;
  }
  backup.settings[k] = value;
  settingUpserts.push({ key: k, value: value.replace(from, to) });
  changes.push(`réglage ${k} : « ${from} » → « ${to} »`);
}

let legal = [];
try { legal = JSON.parse(current.footer_legal_links || '[]'); } catch { throw new Error('footer_legal_links illisible'); }
if (!legal.some((l) => l.path === VENIR_LINK.path)) {
  backup.settings.footer_legal_links = current.footer_legal_links ?? null;
  const next = [VENIR_LINK, ...legal];
  settingUpserts.push({ key: 'footer_legal_links', value: JSON.stringify(next) });
  changes.push(`réglage footer_legal_links : + « ${VENIR_LINK.name} » → ${VENIR_LINK.path}`);
}

// Accueil
const { data: home, error: homeErr } = await db.from('dynamic_pages')
  .select('id, slug, content, content_version').eq('slug', 'home').single();
if (homeErr) throw homeErr;
if (home.content_version !== 2 || !Array.isArray(home.content)) throw new Error('Accueil : pas au format v2.');
const homeContent = structuredClone(home.content);
const blocks = homeContent.flatMap((s) => s.columns?.flatMap((c) => c.blocks ?? []) ?? []);
let homeChanged = false;

const hero = blocks.find((b) => b.type === 'hero');
if (hero?.title === HOME_H1.to) { /* déjà fait */ }
else if (hero?.title === HOME_H1.from) { hero.title = HOME_H1.to; homeChanged = true; changes.push(`accueil H1 : « ${HOME_H1.from} » → « ${HOME_H1.to} »`); }
else throw new Error(`Accueil : H1 inattendu (« ${hero?.title} ») — retouché depuis l’audit ?`);

const faqItem = blocks.filter((b) => b.type === 'faq').flatMap((b) => b.items ?? []).find((i) => i.id === FAQ_RDV.id);
if (!faqItem) throw new Error('Accueil : question « Comment prendre rendez-vous ? » introuvable.');
if (faqItem.answer === FAQ_RDV.to) { /* déjà fait */ }
else if (faqItem.answer === FAQ_RDV.from) { faqItem.answer = FAQ_RDV.to; homeChanged = true; changes.push('accueil FAQ « Comment prendre rendez-vous ? » : réponse sans le double « sur rendez-vous »'); }
else throw new Error(`Accueil : réponse FAQ inattendue (« ${faqItem.answer} »).`);

const images = [
  ...blocks.filter((b) => b.type === 'image'),
  ...blocks.filter((b) => b.type === 'gallery').flatMap((b) => b.images ?? []),
];
for (const img of images) {
  const suffix = Object.keys(ALTS).find((s) => img.url?.endsWith(s));
  if (suffix && !img.alt?.trim()) {
    img.alt = ALTS[suffix];
    homeChanged = true;
    changes.push(`accueil alt …${suffix} : « ${ALTS[suffix]} »`);
  }
}
if (homeChanged) backup.pages.home = home.content;

// Contact : lien vers /venir à la fin du bloc « Comment venir »
const { data: contact, error: contactErr } = await db.from('dynamic_pages')
  .select('id, content, content_version').eq('slug', 'contact').single();
if (contactErr) throw contactErr;
const contactContent = structuredClone(contact.content);
const access = contactContent.flatMap((s) => s.columns?.flatMap((c) => c.blocks ?? []) ?? [])
  .find((b) => b.type === 'text' && b.html?.includes('<strong>En train (CFF)</strong>'));
if (!access) throw new Error('Contact : bloc « Comment venir » introuvable.');
let contactChanged = false;
if (!access.html.includes('href="/venir"')) {
  access.html += CONTACT_LINK_HTML;
  contactChanged = true;
  backup.pages.contact = contact.content;
  changes.push('contact : lien vers /venir sous « Comment venir »');
}

// /venir
const { data: venir } = await db.from('dynamic_pages').select('id, published').eq('slug', 'venir').maybeSingle();
if (!venir) changes.push('page /venir : créée et publiée (hero H1, train, voiture, adresse, appel à réserver)');

// ────────────────────────────────────────────────────────────────────────────
console.log(changes.length ? changes.map((c) => `• ${c}`).join('\n') : 'Rien à faire : tout est déjà en place.');
if (!write || !changes.length) process.exit(0);

mkdirSync('scripts/backups', { recursive: true });
const file = `scripts/backups/seo-2026-10-19-${backup.date.replace(/[:.]/g, '-')}.json`;
writeFileSync(file, JSON.stringify(backup, null, 2));
console.log(`\nSauvegarde : ${file}`);

if (settingUpserts.length) {
  const { error } = await db.from('settings').upsert(settingUpserts, { onConflict: 'key' });
  if (error) throw new Error(`Réglages : ${error.message}`);
}
const now = new Date().toISOString();
if (homeChanged) {
  const { error } = await db.from('dynamic_pages').update({ content: homeContent, updated_at: now }).eq('id', home.id);
  if (error) throw new Error(`Accueil : ${error.message}`);
}
if (contactChanged) {
  const { error } = await db.from('dynamic_pages').update({ content: contactContent, updated_at: now }).eq('id', contact.id);
  if (error) throw new Error(`Contact : ${error.message}`);
}
if (!venir) {
  const { error } = await db.from('dynamic_pages').insert({
    title: 'Venir à l’institut', slug: 'venir', sections: [], content: VENIR_CONTENT, content_version: 2,
    published: true, show_header: true, show_footer: true,
  });
  if (error) throw new Error(`Page /venir : ${error.message}`);
}
console.log('Appliqué. Les pages se régénèrent d’elles-mêmes en une minute (ISR), le sitemap en une heure.');
