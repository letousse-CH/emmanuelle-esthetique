/**
 * Refonte du site en silo — crée les pages en BROUILLON.
 *
 *   npx tsx scripts/seed-site-v2.ts            # essai : liste ce qui serait écrit
 *   npx tsx scripts/seed-site-v2.ts --write    # écrit les brouillons
 *
 * Ce que le script écrit (et rien d'autre) :
 *   - `dynamic_pages` : une ligne par page, slug préfixé `brouillon/`, published = false.
 *     Les pages en ligne ne sont jamais touchées.
 *   - `settings` : `navigation_menu_draft` (menu du brouillon) et les clés SEO
 *     `seo_pages_brouillon_*` (titre, description…) — aucune clé utilisée par le
 *     site en ligne.
 *
 * Rejouable : chaque page est mise à jour par slug. Attention, rejouer écrase les
 * modifications faites dans le page builder sur les brouillons.
 *
 * Prévisualisation locale : `npm run dev:brouillons`, puis http://localhost:5180.
 * Mise en ligne : `scripts/publish-site-v2.mjs`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { ContentBlock, ContentSection, ContentStructure, SectionLayout, PriceItem, OfferItem, CardItem } from '../src/components/blocks/types';
import { uid } from '../src/components/blocks/types';
import { CARTE, EPILATION_SUCRE_TEXT, chf, getCategory, getItem, itemPriceLabel, type CarteCategoryId, type CarteGroup, type CarteItem } from '../src/constants/carteSoins';

// ─── Environnement ────────────────────────────────────────────────────────────

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

// ─── Coordonnées (à confirmer avec Emmanuelle avant la mise en ligne) ─────────

const PHONE = '+41 78 225 76 36';
const EMAIL = 'e.letousse@gmail.com';
const ADDRESS = 'Chemin de la Marouette 19, 1607 Palézieux (VD)';
const HOURS = 'Du lundi au samedi, de 9 h à 18 h, sur rendez-vous';

// ─── Bibliothèque d'images (media_assets) ─────────────────────────────────────

const R2 = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/';
const IMG = {
  // Photos de la cabine (vraies photos)
  cabineSalon: { url: `${R2}1790524746001-cabinet-hypnose-oron-palezieux-gare-02.webp`, alt: 'Cabine de soins privée à Palézieux-Gare : table de soin, fauteuils et tableau marin' },
  cabineTable: { url: `${R2}1790524741683-cabinet-hypnose-oron-palezieux-gare-01.webp`, alt: 'Cabine de soins à Palézieux-Gare : table de soin et étagères, lumière douce' },
  cabineFauteuil: { url: `${R2}1790524749679-cabinet-hypnose-oron-palezieux-gare-04.webp`, alt: 'Coin détente de la cabine avec bouquet de fleurs, à Palézieux-Gare' },
  cabineLarge: { url: `${R2}1790524727824-WhatsApp-Image-2026-09-27-at-17.51.49.webp`, alt: 'Vue de la cabine de soins Emmanuelle Esthétique à Palézieux-Gare' },
  cabineSoin: { url: `${R2}1790524735770-WhatsApp-Image-2026-09-27-at-17.51.48.webp`, alt: 'Table de soin recouverte d’un plaid rose dans la cabine de Palézieux-Gare' },
  cabineFleurs: { url: `${R2}1790524755404-cabinet-hypnose-oron-palezieux-gare-07.webp`, alt: 'Fauteuil et bouquet de fleurs dans la cabine de soins, Palézieux-Gare' },
  phytomer: { url: `${R2}1790524738941-WhatsApp-Image-2026-09-27-at-17.51.49--2-.webp`, alt: 'Produits Phytomer et orchidée blanche dans la cabine de Palézieux-Gare' },
  mer: { url: `${R2}1789999272375-prise-de-rdv.webp`, alt: 'Côte bretonne, phare et mer turquoise : l’univers de la cosmétique marine Phytomer' },
  epilation: { url: `${R2}1789998853978-e-pilation.jpg`, alt: 'Jambes lisses et douces après une épilation à la cire douce ou au sucre' },
  // Photos libres de la bibliothèque (à remplacer par des photos de la cabine)
  soinVisage: { url: 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Soin du visage : massage relaxant du visage sur table de soin' },
  soinVisage2: { url: 'https://images.pexels.com/photos/6076149/pexels-photo-6076149.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Esthéticienne réalisant un soin du visage' },
  massage: { url: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Massage relaxant du dos, bougies et lumière douce' },
  regard: { url: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Mise en beauté du regard : soin des cils et des sourcils' },
  cadeau: { url: 'https://images.pexels.com/photos/5725888/pexels-photo-5725888.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Bon cadeau : boîte cadeau blanche et ruban rose' },
} as const;

// ─── Fabriques de blocs ───────────────────────────────────────────────────────

type B = ContentBlock;
const heading = (text: string, level: 1 | 2 | 3 = 2, o: Record<string, unknown> = {}): B => ({ id: uid(), type: 'heading', text, level, align: 'left', ...o }) as B;
const prose = (html: string, o: Record<string, unknown> = {}): B => ({ id: uid(), type: 'text', html, ...o }) as B;
const image = (img: { url: string; alt: string }, o: Record<string, unknown> = {}): B => ({ id: uid(), type: 'image', url: img.url, alt: img.alt, ratio: '4/5', size: 'full', fit: 'cover', ...o }) as B;
const button = (text: string, url: string, variant: 'primary' | 'secondary' | 'link' = 'primary', o: Record<string, unknown> = {}): B => ({ id: uid(), type: 'button', text, url, variant, align: 'left', ...o }) as B;
const hero = (o: { eyebrow?: string; title: string; text?: string; ctaText?: string; ctaUrl?: string; secondaryText?: string; secondaryUrl?: string; align?: 'left' | 'center'; size?: 'medium' | 'large' }): B =>
  ({ id: uid(), type: 'hero', align: 'left', size: 'large', ...o }) as B;
const quote = (q: string, o: Record<string, unknown> = {}): B => ({ id: uid(), type: 'quote', quote: q, align: 'center', ...o }) as B;
const divider = (): B => ({ id: uid(), type: 'divider', style: 'short' }) as B;
const spacer = (height: 'small' | 'medium' | 'large' = 'small'): B => ({ id: uid(), type: 'spacer', height }) as B;
const cards = (o: { eyebrow?: string; title?: string; intro?: string; cols: 2 | 3 | 4; style?: 'plain' | 'tinted' | 'outlined'; items: Array<Omit<CardItem, 'id'>> }): B =>
  ({ id: uid(), type: 'cards', style: 'tinted', ...o, items: o.items.map((i) => ({ id: uid(), ...i })) }) as B;
const steps = (o: { eyebrow?: string; title?: string; intro?: string; items: Array<{ title: string; text: string }> }): B =>
  ({ id: uid(), type: 'steps', ...o, items: o.items.map((i) => ({ id: uid(), ...i })) }) as B;
const offers = (o: { eyebrow?: string; title?: string; intro?: string; offers: Array<Omit<OfferItem, 'id'>>; footnote?: string }): B =>
  ({ id: uid(), type: 'offers', ...o, offers: o.offers.map((i) => ({ id: uid(), ...i })) }) as B;
const pricelist = (o: { eyebrow?: string; title?: string; intro?: string; level?: 2 | 3; items: Array<Omit<PriceItem, 'id'>>; footnote?: string; linkText?: string; linkUrl?: string }): B =>
  ({ id: uid(), type: 'pricelist', ...o, items: o.items.map((i) => ({ id: uid(), ...i })) }) as B;
const faq = (o: { eyebrow?: string; title?: string; intro?: string; items: Array<{ question: string; answer: string }> }): B =>
  ({ id: uid(), type: 'faq', ...o, items: o.items.map((i) => ({ id: uid(), ...i })) }) as B;
const callout = (o: { eyebrow?: string; title: string; text?: string; ctaText?: string; ctaUrl?: string }): B => ({ id: uid(), type: 'callout', ...o }) as B;
const gallery = (o: { title?: string; variant?: 'grid' | 'carousel' | 'masonry'; cols?: 2 | 3 | 4; images: Array<{ url: string; alt: string; caption?: string }> }): B =>
  ({ id: uid(), type: 'gallery', variant: 'grid', cols: 3, ...o, images: o.images.map((i) => ({ id: uid(), ...i })) }) as B;
const marquee = (items: string[]): B => ({ id: uid(), type: 'marquee', items, separator: '●', speed: 'slow' }) as B;
const contact = (o: { title?: string; text?: string }): B =>
  ({ id: uid(), type: 'contact', ...o, address: ADDRESS, phone: PHONE, email: EMAIL, hours: HOURS }) as B;
const contactForm = (): B => ({ id: uid(), type: 'contact_form' }) as B;
const googleReviews = (title: string): B => ({ id: uid(), type: 'google_reviews', title, max: 3 }) as B;

function section(layout: SectionLayout, cols: B[][], o: Partial<ContentSection> = {}): ContentSection {
  return { id: uid(), layout, paddingY: 'medium', background: 'transparent', columns: cols.map((blocks) => ({ id: uid(), blocks })), ...o };
}

/** En-tête de page : texte à gauche, photo à droite, fond crème. */
function heroSplit(o: Parameters<typeof hero>[0], img: { url: string; alt: string }, ratio: '4/5' | '3/4' | '4/3' = '4/5'): ContentSection {
  return section('2-col-60-40', [[hero(o)], [image(img, { ratio })]], { alignItems: 'center', paddingY: 'large', background: 'warm' });
}

/** Bandeau de fin de page : appel à réserver sur fond lagon. */
const closingCallout = (title = 'Réservez votre moment', text = `${HOURS}. Réponse sous 24 h.`) =>
  section('1-col', [[callout({ title, text, ctaText: 'Prendre rendez-vous', ctaUrl: '/contact' })]], { background: 'accent', paddingY: 'large', width: 'narrow' });

// ─── Aides carte → blocs ──────────────────────────────────────────────────────

const priceNote = (i: CarteItem) => (i.variants?.length ? `· ${i.variants[0].duration}` : i.duration ? `· ${i.duration}` : undefined);

function priceItems(items: CarteItem[], withDescription = false): Array<Omit<PriceItem, 'id'>> {
  return items.map((i) => ({
    name: i.name,
    duration: i.duration,
    price: itemPriceLabel(i),
    ...(withDescription && i.description ? { description: i.description } : {}),
  }));
}

/**
 * Texte de présentation de chaque soin : deux paragraphes, le déroulé (repris
 * de la carte) et une ligne « idéal si ». Les protocoles du visage et du corps
 * suivent ceux de Phytomer (Peau Nette Express, Hydra Originel, Expert
 * Jeunesse, Voile de Satin, Bulle des Mers, massage Signature Spa). Rien n'est
 * promis qui ne figure pas dans la carte : on décrit le geste et ce qu'on ressent.
 */
const SOIN_TEXT: Record<string, { paras: string[]; bullets?: string[]; ideal?: string }> = {
  'peau-nette-eclat-express': {
    paras: [
      'Le rendez-vous le plus court de la carte, pensé pour les jours où le temps manque mais où la peau a besoin d’un vrai nettoyage. Un nettoyage profond sous serviettes chaudes prépare la peau, un gommage marin enzymatique la débarrasse de ce qui la ternit, puis un masque chauffant détoxifiant travaille en profondeur avant l’hydratation.',
      'Vous repartez avec un teint plus net et plus lumineux, en 40 minutes seulement : un format qui s’intègre facilement à une journée chargée.',
    ],
    bullets: ['Nettoyage profond désincrustant sous serviettes chaudes', 'Gommage marin enzymatique', 'Masque chauffant détoxifiant', 'Hydratation personnalisée'],
    ideal: 'Idéal si votre peau est terne ou fatiguée et que vous souhaitez un coup d’éclat immédiat.',
  },
  'hydra-originel': {
    paras: [
      'C’est le soin d’hydratation de la carte : un véritable bain de confort pour les peaux qui tiraillent, manquent de souplesse ou de lumière. Il s’appuie sur des algues bio tissées, aux textures très sensorielles, appliquées après un gommage velours qui prépare la peau à recevoir tous leurs bienfaits.',
      'Le modelage du visage et du décolleté en est le cœur : lent, enveloppant, il dénoue les traits et invite à lâcher prise. Le soin s’achève par un masque crémeux à l’algue Nori. La peau est repulpée, sa barrière cutanée restaurée, le visage détendu.',
    ],
    bullets: ['Gommage velours', 'Modelage délassant du visage et du décolleté', 'Masque crémeux à l’algue Nori'],
    ideal: 'Idéal si votre peau est déshydratée, tendue ou en manque de confort.',
  },
  'expert-jeunesse': {
    paras: [
      'Le protocole anti-âge le plus complet de la carte. Il s’adresse à celles qui souhaitent agir sur les rides installées et sur la fermeté du visage, avec des gestes précis plutôt que des promesses spectaculaires.',
      'Le modelage remodelant, inspiré des techniques de digito-pression, travaille le visage en profondeur pour redessiner l’ovale. Il est suivi de la pose d’un masque plastifiant tenseur, aux actifs marins purs, qui lisse visiblement les rides et tonifie les traits. Les résultats varient selon chaque peau.',
    ],
    bullets: ['Modelage remodelant ciblé, inspiré des techniques de digito-pression', 'Masque plastifiant tenseur aux actifs marins purs'],
    ideal: 'Idéal si vous souhaitez lisser les rides installées et retrouver de la fermeté.',
  },
  'voile-de-satin': {
    paras: [
      'Un gommage complet du corps aux cristaux de sels marins, qui exfolient en douceur tout en reminéralisant la peau. Les cristaux sont travaillés en gestes enveloppants, des épaules aux pieds, pour éliminer les cellules mortes et raviver le grain de peau.',
      'Un lait satinant onctueux est ensuite appliqué et massé : la peau est douce, veloutée, comme neuve. Un soin simple et très sensoriel pour se sentir bien dans sa peau.',
    ],
    bullets: ['Exfoliation complète aux cristaux de sels marins reminéralisants', 'Application onctueuse et massée de lait satinant'],
    ideal: 'Idéal si votre peau est sèche, terne, ou que vous voulez retrouver une peau neuve.',
  },
  'bulles-des-mers': {
    paras: [
      'Un soin dédié au dos, là où s’accumulent les tensions. Il commence par un gommage purifiant, puis une boue marine auto-chauffante est posée sous occlusion thermique : elle chauffe, minéralise et décontracte pendant que la peau se purifie.',
      'Un modelage délassant des trapèzes, de la nuque et du dos, à l’huile végétale précieuse, prolonge l’effet et relâche les épaules. Une vraie pause pour celles qui portent tout sur leur dos.',
    ],
    bullets: ['Gommage purifiant du dos', 'Boue marine auto-chauffante décontracturante, sous occlusion thermique', 'Modelage des trapèzes, de la nuque et du dos à l’huile végétale précieuse'],
    ideal: 'Idéal si vous avez le dos et la nuque tendus, ou besoin d’une pause détox.',
  },
  'grand-massage-relaxant': {
    paras: [
      'La signature spa de la cabine : un massage complet du corps, entièrement sur-mesure. Avant de commencer, on prend le temps de parler de vos besoins du jour — un dos chargé, des jambes lourdes, une fatigue plus diffuse — pour composer le massage qui vous convient.',
      'Effleurages profonds, drainages doux et pressions dénouantes s’enchaînent à l’huile marine satinante au parfum printanier. 60 minutes suffisent pour relâcher les tensions ; 90 minutes laissent davantage de temps à chaque geste.',
    ],
    ideal: 'Idéal si vous cherchez une vraie déconnexion et une détente profonde.',
  },
  'echappee-belle': {
    paras: [
      'Le rituel complet, pour un rendez-vous qui prend soin de vous des pieds à la tête. Vous commencez par le gommage complet du corps Voile de Satin ou par un massage ciblé du dos, selon ce dont vous avez envie.',
      'Vous enchaînez ensuite avec le Soin Hydra Originel complet : bain d’hydratation aux algues, modelage du visage et du décolleté, masque à l’algue Nori. Une parenthèse de 1h45 pour tout relâcher.',
    ],
    ideal: 'Idéal pour s’offrir une vraie pause, ou pour offrir un moment d’exception en bon cadeau.',
  },
  'prestige-mains': {
    paras: [
      'Une manucure « Spa » complète : le limage est fait sur-mesure selon la forme de vos ongles, et les cuticules sont travaillées avec précision. La mise en beauté de l’ongle fait partie du soin, elle n’est pas un supplément.',
      'Le gommage aux sels fins marins affine le grain de peau, un masque régénérant tiède nourrit, puis un modelage décontractant de l’avant-bras et de la main relâche les tensions.',
    ],
    bullets: ['Limage sur-mesure', 'Travail précis des cuticules', 'Gommage aux sels fins marins', 'Masque régénérant tiède', 'Modelage décontractant de l’avant-bras et de la main'],
    ideal: 'Idéal si vos mains travaillent beaucoup ou si vous voulez simplement prendre soin d’elles.',
  },
  'prestige-pieds': {
    paras: [
      'Un soin des pieds « Spa » complet, du premier geste à la dernière minute de détente. Les callosités sont éliminées, l’ongle est mis en forme et les cuticules soignées : les pieds retrouvent douceur et confort.',
      'Un gommage exfoliant en profondeur, un masque adoucissant sous serviettes chaudes puis un modelage défatigant de la voûte plantaire et des mollets terminent le soin. On en ressort les jambes plus légères.',
    ],
    bullets: ['Élimination des callosités', 'Mise en forme de l’ongle et soin des cuticules', 'Gommage exfoliant en profondeur', 'Masque adoucissant sous serviettes chaudes', 'Modelage défatigant de la voûte plantaire et des mollets'],
    ideal: 'Idéal si vous êtes beaucoup debout ou que vos pieds méritent une vraie pause.',
  },
  'teinture-cils': {
    paras: [
      'La teinture fonce et intensifie la couleur de vos cils naturels, souvent clairs ou peu visibles. Le regard gagne en profondeur, sans avoir à mettre du mascara chaque matin.',
      'C’est un geste rapide et confortable, pour un regard naturel mais affirmé.',
    ],
    ideal: 'Idéal si vos cils sont clairs et que vous souhaitez un regard plus expressif.',
  },
  'teinture-sourcils': {
    paras: [
      'La teinture donne au sourcil une couleur plus soutenue et structure visuellement le regard. Elle met en valeur la forme naturelle de vos sourcils, sans les alourdir.',
      'Elle se complète, si vous le souhaitez, d’une épilation à la cire douce pour une ligne nette.',
    ],
    ideal: 'Idéal si vos sourcils sont clairs, clairsemés ou manquent de définition.',
  },
  'duo-regard': {
    paras: [
      'La teinture des cils et celle des sourcils réunies en une seule prestation, pour un regard plus dessiné dans son ensemble.',
      'Vous gagnez du temps et l’harmonie entre cils et sourcils : un regard net et naturel, sans maquillage.',
    ],
    ideal: 'Idéal si vous voulez un regard mis en valeur en une seule fois.',
  },
  'rehaussement-cils': {
    paras: [
      'Le réhaussement recourbe vos cils naturels de la racine à la pointe. Ils paraissent plus longs et plus ouverts, et le regard s’éclaire, sans extension.',
      'Le résultat est naturel, adapté à la longueur et à la courbe de vos propres cils.',
    ],
    ideal: 'Idéal si vous voulez ouvrir le regard tout en gardant vos cils naturels.',
  },
  'forfait-douceur': {
    paras: [
      'Pour les jours où l’on veut être nette, simplement et rapidement : demi-jambes, aisselles et maillot au choix — classique, échancré ou intégral — en une seule séance.',
      'Tout est compris dans un prix unique, sans supplément selon le maillot que vous choisissez.',
    ],
    bullets: ['Demi-jambes', 'Aisselles', 'Maillot au choix'],
    ideal: 'Idéal pour une formule essentielle, rapide et nette.',
  },
  'forfait-integral': {
    paras: [
      'Le rituel complet du corps, sans compromis : jambes complètes, aisselles et maillot au choix — classique, échancré ou intégral —, épilés avec soin, à la cire douce ou au sucre.',
      'Une seule séance, un prix unique tout compris, et la peau lisse et douce des pieds à l’aine.',
    ],
    bullets: ['Jambes complètes', 'Aisselles', 'Maillot au choix'],
    ideal: 'Idéal si vous voulez une épilation complète en une seule fois.',
  },
};

function offerFrom(id: string, o: { bullets?: string[]; description?: string; badge?: string; ctaText?: string; ctaUrl?: string; highlight?: boolean } = {}): Omit<OfferItem, 'id'> {
  const i = getItem(id);
  // Soin à deux durées : la seconde est rappelée dans la description.
  const alt = i.variants && i.variants.length > 1 ? ` Aussi en ${i.variants[1].duration} : ${chf(i.variants[1].price)}.` : '';
  const t = SOIN_TEXT[id];
  const long = t ? [...t.paras, ...(t.ideal ? [`§${t.ideal}`] : [])].join('\n\n') + (alt ? `\n\n§${alt.trim()}` : '') : undefined;
  return {
    name: i.name,
    price: chf(i.price),
    priceNote: priceNote(i),
    description: long ?? (`${o.description ?? i.description ?? ''}${alt}`.trim() || undefined),
    // Version courte, pour les cartes de l'accueil.
    ...({ short: o.description ?? t?.paras[0] } as object),
    bullets: t ? t.bullets : o.bullets,
    badge: o.badge,
    highlight: o.highlight,
    ctaText: o.ctaText ?? 'Réserver ce soin',
    ctaUrl: o.ctaUrl ?? '/contact',
  };
}

const fromPrice = (cat: CarteCategoryId) => {
  // Groupe principal seulement : les options du visage (CHF 25, 30) ne sont pas un « dès ».
  const prices = getCategory(cat).groups[0].items.map((i) => i.price);
  return chf(Math.min(...prices));
};

/**
 * Les soins ne se présentent pas comme des cartes de forfaits : chaque soin est
 * une ligne de menu de spa — nom en serif, durée et prix en petit au-dessus,
 * description et détail à côté, lien discret pour réserver. (La carte des
 * tarifs de /soins, elle, reste une liste.) Les blocs `offers` écrits plus bas
 * sont convertis ici : en lignes de menu, ou en cartes sans prix en vedette
 * pour l'accueil.
 */
function expandOffers(content: ContentStructure, mode: 'rows' | 'cards'): ContentStructure {
  const out: ContentStructure = [];
  for (const sec of content) {
    const blocks = sec.columns.flatMap((c) => c.blocks);
    const offerBlocks = blocks.filter((b) => b.type === 'offers') as Array<Extract<B, { type: 'offers' }>>;
    if (!offerBlocks.length) { out.push(sec); continue; }
    const head = offerBlocks[0];
    const all = offerBlocks.flatMap((b) => b.offers);
    const meta = (o: OfferItem) => [o.priceNote?.replace(/^·\s*/, ''), o.price].filter(Boolean).join(' · ');
    // Sur l'accueil, la durée seulement : le prix vit dans la carte.
    const duration = (o: OfferItem) => o.priceNote?.replace(/^·\s*/, '');
    if (mode === 'cards') {
      out.push({
        ...sec,
        columns: [{ id: uid(), blocks: [cards({
          eyebrow: head.eyebrow, title: head.title, intro: head.intro, cols: 3, style: 'tinted',
          items: all.map((o) => ({ title: o.name, text: `${(o as OfferItem & { short?: string }).short ?? ''}${duration(o) ? ` ${duration(o)[0].toUpperCase()}${duration(o).slice(1)}.` : ''}`.trim(), linkText: o.ctaText, linkUrl: o.ctaUrl })),
        })] }],
      });
      continue;
    }
    out.push(section('1-col', [[
      heading(head.title ?? '', 2, { eyebrow: head.eyebrow }),
      ...(head.intro ? [prose(`<p>${head.intro}</p>`)] : []),
    ]], { width: 'narrow', paddingY: 'small', background: 'transparent' }));
    all.forEach((o, i) => {
      const bullets = o.bullets?.length ? `<ul>${o.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '';
      const paras = (o.description ?? '').split('\n\n').filter(Boolean);
      const body = paras.filter((x) => !x.startsWith('§')).map((x) => `<p>${x}</p>`).join('');
      const after = paras.filter((x) => x.startsWith('§')).map((x) => `<p><em>${x.slice(1)}</em></p>`).join('');
      out.push(section('2-col-40-60', [
        [heading(o.name, 3, { eyebrow: meta(o) })],
        [
          prose(`${body}${bullets}${after}`),
          button('Réserver ce soin', '/contact', 'link'),
        ],
      ], { paddingY: 'medium', alignItems: 'top', background: i % 2 ? 'surface' : 'transparent' }));
    });
  }
  return out;
}

// ─── Pages ────────────────────────────────────────────────────────────────────

interface PageDef {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
  keywords: string;
  content: ContentStructure;
}

const pages: PageDef[] = [];

// ── Accueil ──────────────────────────────────────────────────────────────────
pages.push({
  slug: 'home',
  title: 'Accueil',
  seoTitle: 'Emmanuelle Esthétique · Soins marins Phytomer à Palézieux',
  seoDescription:
    'Institut de beauté à Palézieux-Gare (VD) : soins du visage et du corps Phytomer, mains et pieds, regard, épilation. Cabine privée, sur rendez-vous.',
  ogImage: IMG.cabineLarge.url,
  keywords: 'institut de beauté Palézieux, esthéticienne Palézieux, soin visage Phytomer Vaud, massage Palézieux, épilation sucre Oron',
  content: [
    {
      ...section('1-col', [[hero({
        eyebrow: 'Institut de beauté · Cabine privée',
        title: 'Soins marins Phytomer à Palézieux-Gare',
        text: 'Un moment rien qu’à vous, dans une cabine privée à deux minutes à pied de la gare CFF : soins du visage et du corps signés Phytomer, mains et pieds, beauté du regard, épilation à la cire douce et au sucre.',
        ctaText: 'Prendre rendez-vous',
        ctaUrl: '/contact',
        secondaryText: 'Découvrir la carte des soins',
        secondaryUrl: '/soins',
      })]], { background: 'dark', minHeight: 'half', alignItems: 'center', paddingY: 'large', bgImage: { url: IMG.cabineLarge.url, opacity: 48 } }),
    },
    section('1-col', [[marquee(['Soins du visage Phytomer', 'Massages & rituels du corps', 'Mains & pieds « Spa »', 'Beauté du regard', 'Épilation cire douce & sucre'])]], { paddingY: 'small', background: 'warm-strong', width: 'full' }),
    section('2-col-equal', [
      [image(IMG.phytomer, { ratio: '4/5' })],
      [
        heading('Un cocon marin, à deux pas de la gare', 2, { eyebrow: 'Votre cabine à Palézieux-Gare' }),
        prose('<p>Ici, on prend le temps. Vous êtes accueillie dans une cabine privée, calme et lumineuse, où la mer n’est jamais loin : les textures, les parfums et les gestes des soins Phytomer viennent de la cosmétique marine bretonne.</p><p>Vous êtes seule dans la cabine, personne ne vous presse. Chaque rendez-vous commence et se termine par un temps d’échange, pour adapter le soin à ce dont votre peau et votre corps ont besoin ce jour-là.</p>'),
        button('Faire connaissance avec Emmanuelle', '/a-propos', 'link'),
      ],
    ], { alignItems: 'center', reverseOnMobile: false, paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'La carte',
      title: 'Six façons de prendre soin de vous',
      intro: 'Chaque univers a sa page, avec le détail des soins, les durées et les prix.',
      cols: 3,
      style: 'plain',
      items: [
        { image: IMG.soinVisage.url, title: 'Soins du visage Phytomer', text: `Trois protocoles marins de 40 à 75 minutes : coup d’éclat express, hydratation profonde ou correction rides et fermeté.`, linkText: 'Voir les soins du visage', linkUrl: '/soins/visage' },
        { image: IMG.massage.url, title: 'Massages & rituels du corps', text: `Gommage aux sels marins, détox du dos, grand massage relaxant de 60 ou 90 minutes, rituel visage et corps.`, linkText: 'Voir les rituels du corps', linkUrl: '/soins/corps' },
        { image: IMG.cabineSoin.url, title: 'Mains & pieds « Spa »', text: `Deux rituels complets qui allient soin des ongles, gommage, masque et modelage.`, linkText: 'Voir les soins mains et pieds', linkUrl: '/soins/mains-et-pieds' },
        { image: IMG.regard.url, title: 'Beauté du regard', text: `Teinture des cils et des sourcils, duo regard, réhaussement de cils.`, linkText: 'Voir la beauté du regard', linkUrl: '/soins/regard' },
        { image: IMG.epilation.url, title: 'Épilation cire douce & sucre', text: `Cire douce pour les peaux sensibles ou pâte de sucre 100 % naturelle, avec deux forfaits tout compris.`, linkText: 'Voir les épilations', linkUrl: '/soins/epilation' },
        { image: IMG.cadeau.url, title: 'Bon cadeau', text: 'Offrez une parenthèse de douceur : un montant libre ou un soin de la carte, pour un anniversaire, une fête ou sans occasion particulière.', linkText: 'Offrir un bon cadeau', linkUrl: '/bon-cadeau' },
      ],
    })]], { paddingY: 'large' }),
    section('1-col', [[
      heading('La force de la mer, au service de votre peau', 2, { eyebrow: 'Cosmétique marine Phytomer', align: 'center' }),
      prose('<p>Algues tissées bio, sels marins, boue marine auto-chauffante : chaque soin de la carte s’appuie sur les actifs de la mer, pour des textures délicates, des gestes précis et une efficacité visible.</p>', { align: 'center' }),
      button('Découvrir Phytomer', '/phytomer', 'primary', { align: 'center' }),
    ]], { background: 'dark', minHeight: 'half', alignItems: 'center', paddingY: 'large', width: 'narrow', bgImage: { url: IMG.mer.url, opacity: 45 } }),
    section('1-col', [[offers({
      eyebrow: 'Pour commencer',
      title: 'Nos soins signature',
      intro: 'Trois rendez-vous pour découvrir la cabine et l’univers Phytomer.',
      offers: [
        offerFrom('hydra-originel', { description: 'Un bain d’hydratation aux algues tissées bio : gommage velours, modelage du visage et du décolleté, masque crémeux à l’algue Nori.', ctaText: 'Voir les soins du visage', ctaUrl: '/soins/visage' }),
        offerFrom('grand-massage-relaxant', { description: 'Un massage complet du corps sur-mesure : effleurages profonds, drainages doux et pressions dénouantes à l’huile marine satinante.', ctaText: 'Voir les rituels du corps', ctaUrl: '/soins/corps' }),
        offerFrom('echappee-belle', { description: 'La synergie parfaite : gommage complet du corps ou massage ciblé du dos, puis Soin Hydra Originel complet.', badge: 'Visage & corps', highlight: true, ctaText: 'Voir les rituels du corps', ctaUrl: '/soins/corps' }),
      ],
    })]], { background: 'surface', paddingY: 'large' }),
    section('1-col', [[
      heading('Votre cabine, à Palézieux-Gare', 2, { eyebrow: 'Le lieu', align: 'center' }),
      gallery({ variant: 'grid', cols: 3, images: [IMG.cabineSalon, IMG.cabineTable, IMG.cabineFauteuil] }),
    ]], { paddingY: 'large' }),
    section('1-col', [[steps({
      eyebrow: 'Votre venue',
      title: 'Trois temps, sans hâte',
      items: [
        { title: 'Vous réservez', text: `Par le formulaire, par e-mail ou par téléphone. ${HOURS}. Réponse sous 24 h.` },
        { title: 'Vous êtes accueillie', text: 'La cabine est à 2 minutes à pied de la gare CFF de Palézieux, avec une place de parking gratuite devant la porte.' },
        { title: 'Vous lâchez prise', text: 'Un temps d’échange avant le soin, puis le soin lui-même, adapté à votre peau et à vos besoins du jour.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('1-col', [[googleReviews('Elles en parlent')]], { paddingY: 'medium' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Avant de prendre rendez-vous',
      items: [
        { question: 'Où se trouve l’institut Emmanuelle Esthétique ?', answer: `Dans une cabine privée à Palézieux-Gare, dans le canton de Vaud : ${ADDRESS}. Elle se trouve à deux minutes à pied de la gare CFF de Palézieux. Une place de parking gratuite est disponible devant la cabine.` },
        { question: 'Quels soins propose Emmanuelle Esthétique ?', answer: 'Des soins du visage et des rituels du corps à la cosmétique marine Phytomer, des soins des mains et des pieds, la beauté du regard (teinture des cils et des sourcils, réhaussement de cils) et l’épilation à la cire douce ou à la pâte de sucre. La carte complète, avec les prix, se trouve sur la page « Soins et tarifs ».' },
        { question: 'Comment prendre rendez-vous ?', answer: `Uniquement sur rendez-vous, ${HOURS.charAt(0).toLowerCase()}${HOURS.slice(1)}. Écrivez via le formulaire de contact, par e-mail ou par téléphone : vous recevez une réponse sous 24 h.` },
        { question: 'Que veut dire « soins Phytomer » ?', answer: 'Phytomer est une marque française de cosmétique marine. Les soins de la carte s’appuient sur ses produits professionnels (algues, sels marins, boue marine…) et sur des gestes manuels précis.' },
        { question: 'Je viens d’Oron, de Châtel-Saint-Denis ou de Chexbres : est-ce facile d’accès ?', answer: 'Oui. La cabine est à deux minutes à pied de la gare CFF de Palézieux et dispose d’une place de parking gratuite. Elle accueille les clientes de Palézieux, Oron, Puidoux, Chexbres, Châtel-Saint-Denis, Lavaux, Vevey et de la Broye.' },
        { question: 'Les soins sont-ils ouverts aux hommes ?', answer: 'Non, les soins sont réservés aux femmes.' },
        { question: 'Puis-je offrir un soin ?', answer: 'Oui : un bon cadeau Emmanuelle Esthétique peut être d’un montant libre ou d’un soin de la carte. Tous les détails sont sur la page « Bon cadeau ».' },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Offrez-vous une parenthèse'),
  ],
});

// ── Carte des soins & tarifs (hub du silo) ───────────────────────────────────
const carteSections: ContentSection[] = CARTE.map((cat, idx) => {
  const right: B[] = cat.groups.map((g: CarteGroup) =>
    pricelist({ title: g.title, intro: g.intro, level: 3, items: priceItems(g.items) }),
  );
  const left: B[] = [
    heading(cat.label, 2, { eyebrow: `${String(idx + 1).padStart(2, '0')}` }),
    prose(`<p>${cat.tagline}</p>`),
    button(`Découvrir les soins`, cat.path, 'link'),
  ];
  return section('2-col-40-60', [left, right], { background: idx % 2 === 0 ? 'transparent' : 'surface', paddingY: 'large', alignItems: 'top' });
});

pages.push({
  slug: 'soins',
  title: 'Soins et tarifs',
  seoTitle: 'Soins et tarifs à Palézieux-Gare | Emmanuelle Esthétique',
  seoDescription: 'La carte des soins et tarifs à Palézieux-Gare : visage et corps Phytomer, mains et pieds, regard, épilation. Durées et prix, de CHF 15 à CHF 230.',
  ogImage: IMG.cabineSalon.url,
  keywords: 'tarifs institut de beauté Palézieux, carte des soins, prix soin visage, prix massage, prix épilation Palézieux',
  content: [
    section('1-col', [[hero({
      eyebrow: 'La carte',
      title: 'Soins et tarifs à Palézieux-Gare',
      text: 'Soins du visage et du corps signés Phytomer, mains et pieds, beauté du regard, épilation : toute la carte d’Emmanuelle Esthétique, avec les durées et les prix. Chaque catégorie a sa page détaillée.',
      ctaText: 'Prendre rendez-vous',
      ctaUrl: '/contact',
      align: 'center',
      size: 'medium',
    })]], { background: 'warm', paddingY: 'large', width: 'narrow' }),
    ...carteSections,
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur la carte et les prix',
      items: [
        { question: 'Quelle est la fourchette de prix des soins ?', answer: `Les prestations vont de ${chf(15)} (épilation de la lèvre supérieure) à ${chf(230)} (Rituel Échappée Belle, visage et corps, 1h45). Les soins du visage Phytomer sont proposés de ${chf(90)} à ${chf(165)}.` },
        { question: 'Puis-je combiner un soin du visage et un soin du corps ?', answer: `Oui, avec le Rituel Échappée Belle (1h45, ${chf(230)}) : le gommage complet du corps Voile de Satin ou un massage ciblé du dos, suivi du Soin Hydra Originel complet.` },
        { question: 'Combien de temps durent les soins ?', answer: 'De 40 minutes (soin visage Peau Nette & Coup d’Éclat Express) à 1h45 (Rituel Échappée Belle). La durée de chaque soin est indiquée dans la carte.' },
        { question: 'Où ont lieu les soins ?', answer: `Dans une cabine privée à Palézieux-Gare (${ADDRESS}), à deux minutes à pied de la gare CFF, sur rendez-vous.` },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Un soin vous fait envie ?'),
  ],
});

// ── Soins du visage ──────────────────────────────────────────────────────────
pages.push({
  slug: 'soins/visage',
  title: 'Soins du visage',
  seoTitle: 'Soin du visage Phytomer à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Soins du visage Phytomer à Palézieux-Gare : Coup d’Éclat Express (40 min, CHF 90), Hydra Originel (60 min, CHF 140), Expert Jeunesse (75 min, CHF 165).',
  ogImage: IMG.soinVisage.url,
  keywords: 'soin du visage Palézieux, soin visage Phytomer Vaud, soin hydratant, soin anti-âge Oron, institut Palézieux',
  content: [
    heroSplit({
      eyebrow: 'Soins du visage · Phytomer',
      title: 'Soins du visage Phytomer à Palézieux-Gare',
      text: 'Trois protocoles marins pour révéler l’éclat de votre peau : un coup d’éclat express, un bain d’hydratation ou un soin de correction rides et fermeté. En cabine privée, à deux minutes de la gare CFF.',
      ctaText: 'Réserver mon soin',
      ctaUrl: '/contact',
      secondaryText: 'Voir tous les tarifs',
      secondaryUrl: '/soins',
    }, IMG.soinVisage),
    section('1-col', [[
      heading('Des protocoles marins, des gestes experts', 2, { eyebrow: 'Le soin' }),
      prose('<p>Les soins du visage d’Emmanuelle s’appuient sur les protocoles professionnels de Phytomer, maison de cosmétique marine née à Saint-Malo. Chacun associe des textures issues de la mer — algues bio, gommage enzymatique, masques chauffants ou plastifiants — à des manœuvres manuelles précises : ici, le geste compte autant que la formule.</p><p>Avant le soin, un temps d’échange permet de regarder ensemble ce dont votre peau a besoin ce jour-là. Ensuite, vous n’avez plus rien à faire : la lumière est douce, les serviettes sont chaudes et le temps est à vous.</p>'),
    ]], { width: 'narrow', paddingY: 'large' }),
    section('1-col', [[offers({
      eyebrow: 'Les trois soins',
      title: 'Choisir votre soin du visage',
      offers: [
        offerFrom('peau-nette-eclat-express', {
          description: 'Idéal pour un coup d’éclat immédiat.',
          bullets: ['Nettoyage profond désincrustant sous serviettes chaudes', 'Gommage marin enzymatique', 'Masque chauffant détoxifiant', 'Hydratation personnalisée'],
        }),
        offerFrom('hydra-originel', {
          description: 'Un véritable bain d’hydratation aux algues tissées bio. Repulpe les traits et restaure la barrière cutanée.',
          bullets: ['Gommage velours', 'Modelage délassant du visage et du décolleté', 'Masque crémeux à l’algue Nori'],
          highlight: true,
        }),
        offerFrom('expert-jeunesse', {
          description: 'Un protocole anti-âge intensif. Lisse visiblement les rides installées et tonifie l’ovale du visage.',
          bullets: ['Modelage remodelant ciblé, inspiré des techniques de digito-pression', 'Masque plastifiant tenseur aux actifs marins purs'],
        }),
      ],
    })]], { background: 'surface', paddingY: 'large' }),
    section('1-col', [[steps({
      eyebrow: 'Le déroulé',
      title: 'Un soin du visage, du début à la fin',
      items: [
        { title: 'On prend le temps d’échanger', text: 'Un moment pour parler de votre peau, de vos envies et de ce que vous ressentez ce jour-là. Le protocole se règle à partir de là.' },
        { title: 'Le soin', text: 'Nettoyage, gommage, modelage et masque s’enchaînent selon le protocole choisi, dans le calme de la cabine et sans que vous ayez rien à faire.' },
        { title: 'On se retrouve après', text: 'Un dernier échange pour parler de ce que votre peau a apprécié et de la façon de prolonger l’effet du soin chez vous.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'Vous hésitez ?',
      title: 'Quel soin du visage choisir ?',
      cols: 3,
      style: 'outlined',
      items: [
        { title: 'Retrouver de l’éclat rapidement', text: 'Le soin Peau Nette & Coup d’Éclat Express (40 min) : nettoyage profond, gommage et masque détoxifiant pour un éclat immédiat.' },
        { title: 'Une peau qui manque de confort', text: 'Le soin Hydra Originel (60 min) : un bain d’hydratation aux algues qui repulpe les traits et restaure la barrière cutanée.' },
        { title: 'Agir sur les rides et la fermeté', text: 'Le soin Expert Jeunesse (75 min) : modelage remodelant et masque tenseur pour lisser les rides installées et tonifier l’ovale.' },
      ],
    })]], { paddingY: 'large' }),
    section('2-col-40-60', [
      [
        heading('Prolongez votre soin', 2, { eyebrow: 'Les Privilèges Visage' }),
        prose('<p>Pendant votre soin du visage, ajoutez un temps pour le haut du corps : boue marine auto-chauffante le long de la colonne vertébrale, ou massage relaxant du cuir chevelu et de la nuque.</p>'),
      ],
      [pricelist({ items: priceItems(getCategory('visage').groups[1].items, true) })],
    ], { background: 'warm', paddingY: 'large', alignItems: 'center' }),
    section('2-col-equal', [
      [
        heading('Envie d’un moment complet ?', 2, { eyebrow: 'Visage & corps' }),
        prose(`<p>Le Rituel Échappée Belle (1h45, ${chf(230)}) associe le gommage complet du corps Voile de Satin ou un massage ciblé du dos au Soin Hydra Originel complet.</p>`),
        button('Découvrir les rituels du corps', '/soins/corps', 'secondary'),
      ],
      [
        heading('Pourquoi Phytomer ?', 2, { eyebrow: 'La cosmétique marine' }),
        prose('<p>Une maison bretonne, des actifs issus de la mer et des protocoles manuels pensés pour prolonger leur effet.</p>'),
        button('Découvrir Phytomer', '/phytomer', 'link'),
      ],
    ], { paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur les soins du visage',
      items: [
        { question: 'Quelle est la durée d’un soin du visage ?', answer: 'Selon la formule : 40 minutes pour le soin Peau Nette & Coup d’Éclat Express, 60 minutes pour Hydra Originel et 75 minutes pour Expert Jeunesse.' },
        { question: 'Quelle différence entre les trois soins du visage ?', answer: 'Peau Nette & Coup d’Éclat Express est un soin rapide de nettoyage, gommage et masque détoxifiant. Hydra Originel est un soin d’hydratation profonde aux algues. Expert Jeunesse est un protocole anti-âge qui associe un modelage remodelant et un masque tenseur.' },
        { question: 'Puis-je ajouter un soin du dos ou de la nuque pendant mon soin du visage ?', answer: `Oui : l’option Boue Marine Auto-Chauffante Dos (${chf(30)}) et l’option Massage Relaxant du Cuir Chevelu & Nuque de 15 minutes (${chf(25)}) se glissent pendant votre soin du visage.` },
        { question: 'Puis-je faire un soin du visage si j’ai la peau sensible ?', answer: 'Chaque soin est adapté à votre peau du jour lors de l’échange qui précède : signalez toute sensibilité, allergie ou traitement en cours avant de commencer, pour que le protocole soit ajusté.' },
        { question: 'Où ont lieu les soins du visage ?', answer: `Dans une cabine privée à Palézieux-Gare (${ADDRESS}), à deux minutes à pied de la gare CFF, sur rendez-vous.` },
      ],
    })]], { background: 'surface', paddingY: 'large' }),
    closingCallout('Réservez votre soin du visage'),
  ],
});

// ── Corps & massages ─────────────────────────────────────────────────────────
pages.push({
  slug: 'soins/corps',
  title: 'Massages et soins du corps',
  seoTitle: 'Massage et soins du corps à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Grand massage relaxant (60 ou 90 min), gommage aux sels marins, détox du dos et rituel visage & corps à Palézieux-Gare. Cabine privée, dès CHF 110.',
  ogImage: IMG.massage.url,
  keywords: 'massage relaxant Palézieux, soin du corps Palézieux, gommage sels marins, massage 90 minutes Oron, institut Palézieux',
  content: [
    heroSplit({
      eyebrow: 'Rituels & massages du corps',
      title: 'Massage et soins du corps à Palézieux-Gare',
      text: 'La rencontre entre le magnétisme marin et une gestuelle manuelle précise, enveloppante et décontractante : gommage aux sels marins, détox du dos, grand massage relaxant.',
      ctaText: 'Réserver mon rituel',
      ctaUrl: '/contact',
      secondaryText: 'Voir tous les tarifs',
      secondaryUrl: '/soins',
    }, IMG.massage),
    section('1-col', [[
      heading('Un temps rien que pour votre corps', 2, { eyebrow: 'Le rituel' }),
      prose('<p>Les rituels du corps se déroulent dans la cabine privée, sur une table de soin confortable, avec des huiles et des textures marines. Selon le soin, ils allient exfoliation, boue marine, modelage ou massage complet.</p><p>Chaque rendez-vous commence par un temps d’échange : le massage est adapté à vos besoins musculaires et énergétiques du jour.</p><p><em>Ces soins sont des soins de bien-être et de détente : ils ne remplacent pas un traitement médical ou de physiothérapie.</em></p>'),
    ]], { width: 'narrow', paddingY: 'large' }),
    section('1-col', [
      [
        offers({
          eyebrow: 'Les quatre rituels',
          title: 'Choisir votre rituel du corps',
          offers: [
            offerFrom('voile-de-satin', { bullets: ['Exfoliation aux cristaux de sels marins reminéralisants', 'Lait satinant onctueux, massé'], description: 'La peau est exfoliée, douce et veloutée.' }),
            offerFrom('bulles-des-mers', { bullets: ['Gommage purifiant du dos', 'Boue marine auto-chauffante décontracturante', 'Modelage des trapèzes, de la nuque et du dos à l’huile végétale précieuse'], description: 'Un soin détox et décontractant pour le haut du corps.' }),
          ],
        }),
        offers({
          offers: [
            offerFrom('grand-massage-relaxant', { bullets: ['Effleurages profonds, drainages doux, pressions dénouantes', 'Huile marine satinante au parfum printanier', 'Adapté à vos besoins du jour'], description: 'Un massage complet du corps sur-mesure : la signature spa de la cabine.', highlight: true }),
            offerFrom('echappee-belle', { bullets: ['Gommage complet Voile de Satin ou massage ciblé du dos', 'Soin Hydra Originel complet'], description: 'La synergie parfaite du visage et du corps.', badge: 'Visage & corps' }),
          ],
        }),
      ],
    ], { background: 'surface', paddingY: 'large' }),
    section('1-col', [[steps({
      eyebrow: 'Le déroulé',
      title: 'Un rituel du corps, du début à la fin',
      items: [
        { title: 'On fait le point', text: 'Un temps pour parler de ce dont votre corps a besoin aujourd’hui : dos chargé, jambes lourdes, envie de douceur ou de détente profonde.' },
        { title: 'Le rituel', text: 'Gommage, boue marine ou massage : les gestes s’enchaînent avec des textures marines, dans le calme de la cabine.' },
        { title: 'Vous prenez votre temps', text: 'Le rituel se termine sans précipitation : on vous laisse le temps de revenir doucement, avant de reprendre le fil de la journée.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'Vous hésitez ?',
      title: 'Quel rituel du corps choisir ?',
      cols: 2,
      style: 'outlined',
      items: [
        { title: 'Une peau douce et veloutée', text: 'Le soin Voile de Satin (45 min) : un gommage complet aux sels marins, suivi d’un lait satinant massé.' },
        { title: 'Un dos et une nuque tendus', text: 'Le soin Bulles des Mers (45 min) : gommage du dos, boue marine chauffante décontracturante et modelage délassant.' },
        { title: 'Lâcher prise complètement', text: 'Le Grand Massage Relaxant Marine (60 ou 90 min) : un massage complet du corps, sur-mesure.' },
        { title: 'Un moment complet visage et corps', text: 'Le Rituel Échappée Belle (1h45) : gommage du corps ou massage du dos, puis Soin Hydra Originel.' },
      ],
    })]], { paddingY: 'large' }),
    section('2-col-equal', [
      [
        heading('Pourquoi Phytomer ?', 2, { eyebrow: 'La cosmétique marine' }),
        prose('<p>Sels marins, boue marine, huile marine satinante : les rituels du corps s’appuient sur les textures de la cosmétique marine Phytomer.</p>'),
        button('Découvrir Phytomer', '/phytomer', 'link'),
      ],
      [
        heading('Un soin du visage en plus ?', 2, { eyebrow: 'Visage' }),
        prose('<p>Trois protocoles de 40 à 75 minutes, ou le Rituel Échappée Belle qui réunit visage et corps.</p>'),
        button('Voir les soins du visage', '/soins/visage', 'link'),
      ],
    ], { background: 'warm', paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur les massages et soins du corps',
      items: [
        { question: 'Quelle différence entre un massage de 60 et de 90 minutes ?', answer: `C’est le même Grand Massage Relaxant Marine, sur-mesure : ${chf(145)} pour 60 minutes, ${chf(210)} pour 90 minutes. Les 90 minutes laissent plus de temps aux effleurages profonds, aux drainages doux et aux pressions dénouantes.` },
        { question: 'Quelles huiles sont utilisées ?', answer: 'Le Grand Massage Relaxant Marine utilise une huile marine satinante au parfum printanier. Le soin Bulles des Mers utilise une huile végétale précieuse pour le modelage du dos.' },
        { question: 'Que fait la boue marine auto-chauffante ?', answer: 'Posée sur le dos, elle chauffe d’elle-même : cette chaleur décontracte les muscles pendant que ses actifs marins reminéralisent la peau. Elle est utilisée dans le soin Bulles des Mers, et en option pendant un soin du visage.' },
        { question: 'Ces massages sont-ils thérapeutiques ?', answer: 'Non : ce sont des soins de bien-être et de détente, à visée esthétique. Ils ne remplacent pas un traitement médical ou de physiothérapie.' },
        { question: 'Puis-je combiner un soin du corps et un soin du visage ?', answer: `Oui, avec le Rituel Échappée Belle (1h45, ${chf(230)}) : gommage complet du corps Voile de Satin ou massage ciblé du dos, suivi du Soin Hydra Originel complet.` },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Réservez votre rituel du corps'),
  ],
});

// ── Mains & pieds ────────────────────────────────────────────────────────────
pages.push({
  slug: 'soins/mains-et-pieds',
  title: 'Beauté des mains et des pieds',
  seoTitle: 'Soin des mains et des pieds à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Soin Prestige des Mains (60 min, CHF 85) et des Pieds (70 min, CHF 105) « Spa » à Palézieux-Gare : ongles, cuticules, gommage, masque et modelage.',
  ogImage: IMG.cabineSoin.url,
  keywords: 'soin des pieds Palézieux, soin des mains Palézieux, manucure spa, pédicure spa Oron, institut Palézieux',
  content: [
    heroSplit({
      eyebrow: 'Beauté des mains & des pieds',
      title: 'Soin des mains et des pieds à Palézieux-Gare',
      text: 'Des rituels « Spa » complets qui allient technicité ongulaire, exfoliation et relaxation profonde. La mise en beauté de l’ongle est naturellement intégrée au protocole.',
      ctaText: 'Réserver mon soin',
      ctaUrl: '/contact',
      secondaryText: 'Voir tous les tarifs',
      secondaryUrl: '/soins',
    }, IMG.cabineSoin, '4/3'),
    section('1-col', [[
      heading('Un rituel plutôt qu’un simple soin des ongles', 2, { eyebrow: 'Le soin' }),
      prose('<p>Ici, la beauté de l’ongle fait partie d’un soin complet : limage ou mise en forme, travail des cuticules, gommage aux sels marins, masque et modelage relaxant. Ce n’est pas une pause de dix minutes chez la manucure : c’est un vrai rituel « Spa », d’une heure ou plus.</p><p>Vous repartez avec des mains ou des pieds soignés, doux et détendus — et le sentiment d’avoir pris un moment pour vous.</p>'),
    ]], { width: 'narrow', paddingY: 'large' }),
    section('1-col', [[offers({
      eyebrow: 'Les deux rituels',
      title: 'Mains ou pieds « Spa »',
      offers: [
        offerFrom('prestige-mains', { bullets: ['Limage sur-mesure', 'Travail précis des cuticules', 'Gommage aux sels fins marins', 'Masque régénérant tiède', 'Modelage décontractant de l’avant-bras et de la main'], description: 'Un rituel complet pour des mains soignées et détendues.' }),
        offerFrom('prestige-pieds', { bullets: ['Élimination des callosités', 'Mise en forme de l’ongle et soin des cuticules', 'Gommage exfoliant en profondeur', 'Masque adoucissant sous serviettes chaudes', 'Modelage défatigant de la voûte plantaire et des mollets'], description: 'Un rituel complet pour des pieds doux et des jambes légères.' }),
      ],
    })]], { background: 'surface', paddingY: 'large' }),
    section('2-col-equal', [
      [
        heading('Un moment complet ?', 2, { eyebrow: 'À associer' }),
        prose('<p>Les rituels du corps et les soins du visage se réservent aussi à la cabine : gommage aux sels marins, grand massage relaxant, soins Phytomer.</p>'),
        button('Voir les rituels du corps', '/soins/corps', 'link'),
      ],
      [
        heading('Le soin du regard', 2, { eyebrow: 'Beauté du regard' }),
        prose('<p>Teinture des cils et des sourcils, duo regard, réhaussement de cils.</p>'),
        button('Voir la beauté du regard', '/soins/regard', 'link'),
      ],
    ], { paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur le soin des mains et des pieds',
      items: [
        { question: 'Combien de temps dure le soin des mains ?', answer: `Le Soin Prestige des Mains « Spa » dure 60 minutes (${chf(85)}).` },
        { question: 'Combien de temps dure le soin des pieds ?', answer: `Le Soin Prestige des Pieds « Spa » dure 70 minutes (${chf(105)}).` },
        { question: 'Le soin des pieds élimine-t-il les callosités ?', answer: 'Oui : l’élimination des callosités fait partie du protocole, suivie de la mise en forme de l’ongle, du soin des cuticules, d’un gommage exfoliant, d’un masque adoucissant et d’un modelage défatigant.' },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Réservez votre soin mains ou pieds'),
  ],
});

// ── Beauté du regard ─────────────────────────────────────────────────────────
pages.push({
  slug: 'soins/regard',
  title: 'Beauté du regard',
  seoTitle: 'Réhaussement de cils à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Teinture des cils (CHF 30) et des sourcils (CHF 22), duo regard (CHF 45) et réhaussement de cils (CHF 100) à Palézieux-Gare, en cabine privée.',
  ogImage: IMG.regard.url,
  keywords: 'réhaussement de cils Palézieux, teinture cils sourcils Palézieux, beauté du regard Oron, institut Palézieux',
  content: [
    heroSplit({
      eyebrow: 'Beauté du regard',
      title: 'Beauté du regard à Palézieux-Gare',
      text: 'Teinture des cils et des sourcils, duo regard, réhaussement de cils : une mise en valeur naturelle de la ligne du sourcil et de la profondeur du regard.',
      ctaText: 'Réserver mon soin',
      ctaUrl: '/contact',
      secondaryText: 'Voir tous les tarifs',
      secondaryUrl: '/soins',
    }, IMG.regard),
    section('1-col', [[
      heading('Un regard mis en valeur, sans excès', 2, { eyebrow: 'Les prestations' }),
      prose('<p>Ici, on cherche un résultat naturel : la teinture intensifie la couleur des cils et des sourcils, le réhaussement recourbe vos cils naturels pour ouvrir le regard. Chaque prestation se fait dans le calme de la cabine, sans précipitation.</p>'),
    ]], { width: 'narrow', paddingY: 'large' }),
    section('1-col', [[offers({
      offers: [
        offerFrom('teinture-cils'),
        offerFrom('teinture-sourcils'),
        offerFrom('duo-regard'),
        offerFrom('rehaussement-cils'),
      ],
    })]], { paddingY: 'small' }),
    section('2-col-equal', [
      [
        heading('Et les sourcils à la cire ?', 2, { eyebrow: 'Épilation' }),
        prose(`<p>L’épilation des sourcils à la cire douce se réserve séparément (${chf(22)}), ainsi que l’épilation du visage complet.</p>`),
        button('Voir les épilations', '/soins/epilation', 'link'),
      ],
      [
        heading('Un soin du visage ?', 2, { eyebrow: 'Visage' }),
        prose('<p>Trois protocoles marins Phytomer, de 40 à 75 minutes.</p>'),
        button('Voir les soins du visage', '/soins/visage', 'link'),
      ],
    ], { paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur la beauté du regard',
      items: [
        { question: 'Combien coûte un réhaussement de cils à Palézieux ?', answer: `Le réhaussement de cils est proposé à ${chf(100)} chez Emmanuelle Esthétique, à Palézieux-Gare.` },
        { question: 'Peut-on faire la teinture des cils et des sourcils ensemble ?', answer: `Oui, avec le Duo Regard (teinture des cils et des sourcils) à ${chf(45)}, au lieu de ${chf(52)} en les réservant séparément.` },
        { question: 'Où se déroulent les soins du regard ?', answer: `Dans une cabine privée à Palézieux-Gare (${ADDRESS}), à deux minutes à pied de la gare CFF, sur rendez-vous.` },
      ],
    })]], { background: 'surface', paddingY: 'large' }),
    closingCallout('Réservez votre soin du regard'),
  ],
});

// ── Épilation ────────────────────────────────────────────────────────────────
const epil = getCategory('epilation');
pages.push({
  slug: 'soins/epilation',
  title: 'Épilation à la cire douce et au sucre',
  seoTitle: 'Épilation au sucre à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Épilation à la cire douce et à la pâte de sucre naturelle à Palézieux-Gare : sourcils dès CHF 22, jambes complètes CHF 68, forfaits Douceur et Intégral.',
  ogImage: IMG.epilation.url,
  keywords: 'épilation cire douce Palézieux, épilation au sucre Palézieux, épilation orientale, épilation maillot Oron, institut Palézieux',
  content: [
    heroSplit({
      eyebrow: 'Épilation · Cire douce & pâte de sucre',
      title: 'Épilation à la cire douce et au sucre à Palézieux-Gare',
      text: epil.tagline,
      ctaText: 'Réserver mon épilation',
      ctaUrl: '/contact',
      secondaryText: 'Voir tous les tarifs',
      secondaryUrl: '/soins',
    }, IMG.epilation),
    section('1-col', [[cards({
      eyebrow: 'Deux méthodes',
      title: 'Cire douce ou pâte de sucre ?',
      cols: 2,
      style: 'tinted',
      items: [
        { title: 'La cire douce', text: 'Des cires douces de haute qualité, adaptées aux peaux sensibles, pour des épilations soignées, hygiéniques et confortables. Chaque épilation est suivie d’une application d’émulsion apaisante marine.' },
        { title: 'La pâte de sucre, méthode orientale', text: EPILATION_SUCRE_TEXT },
      ],
    })]], { paddingY: 'large' }),
    section('1-col', [[pricelist({
      eyebrow: 'Les tarifs',
      title: 'Épilations à l’unité',
      items: priceItems(epil.groups[0].items),
      footnote: 'Le maillot échancré ou intégral se réalise au sucre.',
    })]], { background: 'surface', paddingY: 'large', width: 'narrow' }),
    section('1-col', [[steps({
      eyebrow: 'Le déroulé',
      title: 'Une épilation, pas à pas',
      items: [
        { title: 'On choisit la méthode', text: 'Cire douce ou pâte de sucre : on décide ensemble, selon la zone et la sensibilité de votre peau.' },
        { title: 'L’épilation', text: 'Réalisée avec soin, dans des conditions hygiéniques et confortables, à la cire douce de haute qualité ou à la pâte de sucre naturelle.' },
        { title: 'L’émulsion apaisante', text: 'Chaque épilation est suivie d’une application d’émulsion apaisante marine, pour que la peau retrouve son confort.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('1-col', [[offers({
      eyebrow: epil.groups[1].title,
      title: 'Les forfaits, simples et tout compris',
      intro: 'Le maillot se choisit librement, classique, échancré ou intégral.',
      offers: [
        offerFrom('forfait-douceur', { bullets: ['Demi-jambes', 'Aisselles', 'Maillot au choix'], description: 'La formule essentielle, rapide et nette.', ctaText: 'Réserver ce forfait' }),
        offerFrom('forfait-integral', { bullets: ['Jambes complètes', 'Aisselles', 'Maillot au choix'], description: 'Le rituel complet corps, sans compromis.', highlight: true, ctaText: 'Réserver ce forfait' }),
      ],
    })]], { paddingY: 'large' }),
    section('2-col-equal', [
      [
        heading('Des sourcils soignés', 2, { eyebrow: 'Regard' }),
        prose('<p>Après l’épilation, la teinture des cils et des sourcils ou le réhaussement de cils complètent la mise en valeur du regard.</p>'),
        button('Voir la beauté du regard', '/soins/regard', 'link'),
      ],
      [
        heading('Une peau veloutée', 2, { eyebrow: 'Corps' }),
        prose('<p>Le soin Voile de Satin (gommage aux sels marins et lait satinant) prolonge la douceur d’une peau épilée.</p>'),
        button('Voir les rituels du corps', '/soins/corps', 'link'),
      ],
    ], { background: 'warm', paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur l’épilation',
      items: [
        { question: 'Quelle différence entre la cire douce et la pâte de sucre ?', answer: 'La cire douce est choisie pour sa qualité et sa tolérance sur les peaux sensibles ; la pâte de sucre est 100 % naturelle et réalisée selon la méthode orientale, qui extrait le poil avec douceur et réduit visiblement les repousses sous la peau.' },
        { question: 'Le maillot intégral se fait-il à la cire ou au sucre ?', answer: `Le maillot échancré ou intégral se réalise au sucre (${chf(55)}). Le maillot classique est à ${chf(28)}.` },
        { question: 'Combien coûte une épilation des jambes à Palézieux ?', answer: `Les jambes complètes sont à ${chf(68)} et les demi-jambes à ${chf(42)}. Le Forfait Intégral (jambes complètes, aisselles et maillot au choix) est à ${chf(125)}.` },
        { question: 'Que comprennent les forfaits ?', answer: `Le Forfait Douceur (${chf(95)}) comprend demi-jambes, aisselles et maillot au choix. Le Forfait Intégral (${chf(125)}) comprend jambes complètes, aisselles et maillot au choix, quel que soit le type de maillot.` },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Réservez votre épilation'),
  ],
});

// ── Phytomer ─────────────────────────────────────────────────────────────────
pages.push({
  slug: 'phytomer',
  title: 'Phytomer, la cosmétique marine',
  seoTitle: 'Phytomer, cosmétique marine à Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Pourquoi Emmanuelle Esthétique soigne avec Phytomer, cosmétique marine bretonne : algues, sels marins, boue marine. Visage et corps, à Palézieux-Gare.',
  ogImage: IMG.mer.url,
  keywords: 'Phytomer Palézieux, Phytomer Vaud, cosmétique marine, soin aux algues, institut Phytomer Suisse romande',
  content: [
    section('1-col', [[hero({
      eyebrow: 'Cosmétique marine',
      title: 'Phytomer : la cosmétique marine à Palézieux-Gare',
      text: 'Chez Emmanuelle Esthétique, les soins du visage et du corps s’appuient sur Phytomer, maison familiale bretonne spécialisée dans les cosmétiques marins.',
      ctaText: 'Voir les soins du visage',
      ctaUrl: '/soins/visage',
      secondaryText: 'Voir les rituels du corps',
      secondaryUrl: '/soins/corps',
    })]], { background: 'dark', minHeight: 'half', alignItems: 'center', paddingY: 'large', bgImage: { url: IMG.mer.url, opacity: 50 } }),
    section('2-col-equal', [
      [image(IMG.phytomer, { ratio: '4/5' })],
      [
        heading('Une maison familiale, née au bord de la mer', 2, { eyebrow: 'L’histoire' }),
        prose('<p>Phytomer est née à Saint-Malo au début des années 1970, quand son fondateur, Jean Gédouin, a eu l’idée de transformer la richesse de la mer en soins pour la peau. Son premier produit, OLIGOMER®, un concentré minéral à base d’eau de mer et d’algues, est toujours l’actif signature de la marque. La maison est restée familiale et en est aujourd’hui à sa troisième génération.</p><p>Ses laboratoires travaillent des algues et des plantes marines cultivées ou récoltées au bord de la baie du Mont-Saint-Michel, selon des méthodes éco-responsables. C’est la marque qu’Emmanuelle a choisie pour les soins du visage et du corps de sa cabine, pour la douceur de ses textures, l’exigence de ses formulations et la précision de ses protocoles.</p>'),
      ],
    ], { alignItems: 'center', paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'Ce qui fait la différence',
      title: 'La mer, au service de votre peau',
      cols: 3,
      style: 'tinted',
      items: [
        { title: 'Une symbiose avec la peau', text: 'Selon Phytomer, l’eau de mer présente une composition minérale proche de celle du plasma sanguin : elle apporte à la peau des éléments essentiels, en douceur.' },
        { title: 'L’actif signature OLIGOMER®', text: 'Un concentré d’eau de mer purifiée, au cœur des rituels Phytomer : il reminéralise la peau en minéraux et oligo-éléments.' },
        { title: 'Des textures sensorielles', text: 'Gommages, masques, huiles : des formules aux textures délicates, pour un soin qu’on a envie de refaire.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'Dans la cabine',
      title: 'Où retrouver les actifs marins ?',
      intro: 'La mer se retrouve dans chaque univers de la carte.',
      cols: 3,
      style: 'outlined',
      items: [
        { title: 'Soins du visage', text: 'Algues tissées bio du soin Hydra Originel, algue Nori du masque crémeux, gommage marin enzymatique, actifs marins purs du soin Expert Jeunesse.', linkText: 'Voir les soins du visage', linkUrl: '/soins/visage' },
        { title: 'Rituels du corps', text: 'Cristaux de sels marins, boue marine auto-chauffante, huile marine satinante au parfum printanier.', linkText: 'Voir les rituels du corps', linkUrl: '/soins/corps' },
        { title: 'Mains, pieds & épilation', text: 'Sels fins marins des gommages mains et pieds, émulsion apaisante marine après l’épilation.', linkText: 'Voir la carte complète', linkUrl: '/soins' },
      ],
    })]], { paddingY: 'large' }),
    section('1-col', [[
      heading('Des gestes autant que des formules', 2, { eyebrow: 'Les protocoles', align: 'center' }),
      prose('<p>Chez Phytomer, le geste compte autant que la formule : chaque soin de la carte associe les actifs marins à des manœuvres manuelles précises — modelage remodelant, digito-pression, massage enveloppant — pour prolonger leur effet.</p>', { align: 'center' }),
    ]], { width: 'narrow', paddingY: 'large', background: 'surface' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur Phytomer',
      items: [
        { question: 'Qu’est-ce que Phytomer ?', answer: 'Phytomer est une maison familiale bretonne de cosmétique marine. Ses produits associent des actifs issus de la mer (algues, sels marins, boue marine…) à des textures sensorielles.' },
        { question: 'Où faire un soin Phytomer près d’Oron, de Lavaux ou de Châtel-Saint-Denis ?', answer: `Chez Emmanuelle Esthétique, dans une cabine privée à Palézieux-Gare (${ADDRESS}), à deux minutes à pied de la gare CFF, sur rendez-vous.` },
        { question: 'Quels soins sont réalisés avec les produits Phytomer ?', answer: 'Les soins du visage et les rituels du corps de la carte, dont la boue marine auto-chauffante, les gommages aux sels marins et le Grand Massage Relaxant Marine.' },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Découvrez la mer en cabine'),
  ],
});

// ── À propos ─────────────────────────────────────────────────────────────────
pages.push({
  slug: 'a-propos',
  title: 'À propos',
  seoTitle: 'À propos d’Emmanuelle, esthéticienne à Palézieux',
  seoDescription: 'Emmanuelle, esthéticienne depuis plus de 20 ans, vous accueille dans sa cabine privée à Palézieux-Gare : soins Phytomer, écoute et douceur, sans jugement.',
  ogImage: IMG.cabineSalon.url,
  keywords: 'esthéticienne Palézieux, Emmanuelle Le Tousse, institut de beauté Palézieux-Gare, cabine privée',
  content: [
    heroSplit({
      eyebrow: 'Qui suis-je',
      title: 'Emmanuelle, esthéticienne à Palézieux-Gare',
      text: 'Esthéticienne depuis plus de 20 ans, je vous accueille dans ma cabine privée à Palézieux-Gare — un cocon pensé pour celles qui veulent enfin prendre le temps.',
      ctaText: 'Prendre rendez-vous',
      ctaUrl: '/contact',
      secondaryText: 'Découvrir les soins',
      secondaryUrl: '/soins',
    }, IMG.cabineSalon, '4/3'),
    section('1-col', [[
      heading('Prendre soin, c’est d’abord prendre le temps', 2, { eyebrow: 'Mon parcours' }),
      prose('<p>J’ai commencé l’esthétique il y a plus de 20 ans, formée aux techniques manuelles européennes et aux cosmétiques marins Phytomer. Passionnée depuis toujours par les rapports humains, j’aime ce métier parce qu’il me permet de passer mes journées à prendre soin de femmes qui ont envie de prendre soin d’elles.</p><p>Je les aide à lâcher prise par des soins esthétiques doux, pour qu’elles puissent enfin se retrouver et respirer.</p>'),
    ]], { width: 'narrow', paddingY: 'large' }),
    section('1-col', [[cards({
      eyebrow: 'Ma façon de travailler',
      title: 'Trois choses qui ne changent jamais',
      cols: 3,
      style: 'tinted',
      items: [
        { title: 'Des cosmétiques marins professionnels', text: 'Les soins s’appuient sur Phytomer, choisi pour sa composition, sa douceur et ses textures sensorielles. Rien d’invasif, rien de miracle : du soin, vraiment.', linkText: 'Découvrir Phytomer', linkUrl: '/phytomer' },
        { title: 'Du temps, vraiment', text: 'Chaque rendez-vous prévoit un moment d’échange avant et après le soin. On regarde ensemble ce dont votre peau a besoin ce jour-là.' },
        { title: 'Aucun jugement', text: 'Peau sensible, exigeante, pas de temps pour vous depuis des mois, premier rendez-vous en institut : rien de tout cela ne se commente. On part d’où vous en êtes.' },
      ],
    })]], { background: 'warm', paddingY: 'large' }),
    section('2-col-equal', [
      [image(IMG.cabineTable, { ratio: '4/3' })],
      [
        heading('Un cocon plutôt qu’un institut de centre-ville', 2, { eyebrow: 'Pourquoi une cabine privée' }),
        prose('<p>J’ai choisi de vous recevoir dans une cabine privée, à Palézieux-Gare, parce que la beauté et la détente demandent du calme. Vous êtes seule dans la cabine et personne ne vous presse.</p><p>C’est aussi une réponse concrète pour les habitantes de la région — Palézieux, Oron, Châtel-Saint-Denis, la Broye, Lavaux — qui ne veulent pas perdre leur pause détente dans les bouchons. La cabine est à 2 minutes de la gare, avec une place de parking gratuite.</p>'),
        button('Voir comment venir', '/contact', 'link'),
      ],
    ], { alignItems: 'center', paddingY: 'large' }),
    section('1-col', [[
      heading('La cabine', 2, { eyebrow: 'Le lieu', align: 'center' }),
      gallery({ variant: 'grid', cols: 3, images: [IMG.cabineFauteuil, IMG.cabineFleurs, IMG.cabineLarge] }),
    ]], { background: 'surface', paddingY: 'large' }),
    section('1-col', [[quote('Prendre soin, c’est d’abord prendre le temps.', { author: 'Emmanuelle' })]], { width: 'narrow', paddingY: 'large' }),
    closingCallout('Envie de faire connaissance ?', 'Écrivez-moi le soin qui vous intéresse et nous trouvons un créneau ensemble.'),
  ],
});

// ── Contact ──────────────────────────────────────────────────────────────────
pages.push({
  slug: 'contact',
  title: 'Contact, accès et horaires',
  seoTitle: 'Prendre rendez-vous à Palézieux-Gare | Emmanuelle Esthétique',
  seoDescription: `Réservez votre soin à Palézieux-Gare (${ADDRESS}), à 2 minutes de la gare CFF. Du lundi au samedi, 9 h–18 h, sur rendez-vous.`,
  ogImage: IMG.cabineFleurs.url,
  keywords: 'rendez-vous institut de beauté Palézieux, contact esthéticienne Palézieux, accès gare Palézieux, horaires',
  content: [
    section('1-col', [[hero({
      eyebrow: 'Contact & accès',
      title: 'Prendre rendez-vous à Palézieux-Gare',
      text: 'Le plus simple : le formulaire ci-dessous, un e-mail ou un appel. Vous recevez une réponse sous 24 h avec des propositions de créneaux.',
      align: 'center',
      size: 'medium',
    })]], { background: 'warm', paddingY: 'large', width: 'narrow' }),
    section('2-col-40-60', [
      [
        contact({ title: 'Coordonnées' }),
        divider(),
        heading('Comment venir', 3),
        prose('<p><strong>En train (CFF)</strong> : la gare de Palézieux est à 2 minutes à pied de la cabine. Depuis Lausanne : IR15, 18 min. Depuis Vevey et la Riviera : S4, 17 min. Depuis Fribourg : IR15, 25 min. Depuis Bulle : 12 min. Depuis Romont, Oron et Puidoux : S4 directe.</p><p><strong>En voiture</strong> : une place de parking gratuite est disponible devant la cabine. Autoroute A12, sortie Châtillens / Oron, à 5 min ; A9, sortie Chexbres depuis la Riviera, à 15 min.</p><p><strong>Bon à savoir</strong> : les soins sont réservés aux femmes. La cabine accueille les clientes de Palézieux, Oron, Puidoux, Chexbres, Châtel-Saint-Denis, Lavaux, Vevey et de la Broye.</p>'),
      ],
      [heading('Écrire à Emmanuelle', 2, { eyebrow: 'Formulaire' }), contactForm()],
    ], { paddingY: 'large', alignItems: 'top' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Accès et rendez-vous',
      items: [
        { question: 'Comment venir en transports publics ?', answer: 'La cabine est à 2 minutes à pied de la gare CFF de Palézieux. Depuis Lausanne : IR15, 18 minutes. Depuis Vevey et la Riviera : S4, 17 minutes. Depuis Fribourg : IR15, 25 minutes. Depuis Bulle : 12 minutes. Depuis Romont, Oron et Puidoux : S4 directe.' },
        { question: 'Y a-t-il un parking près de la cabine ?', answer: 'Oui, une place de parking gratuite est disponible devant la cabine, à Palézieux-Gare.' },
        { question: 'Quels sont les horaires ?', answer: `${HOURS}.` },
        { question: 'Comment prendre rendez-vous ?', answer: 'Avec le formulaire de contact de cette page, par e-mail ou par téléphone. Vous recevez une réponse sous 24 h.' },
        { question: 'Les soins sont-ils ouverts aux hommes ?', answer: 'Non, les soins sont réservés aux femmes.' },
        { question: 'Quels moyens de paiement sont acceptés ?', answer: 'TWINT, espèces, cartes bancaires et bons cadeaux Emmanuelle Esthétique.' },
        { question: 'Comment venir en voiture ?', answer: 'Autoroute A12, sortie Châtillens / Oron, à 5 minutes ; A9, sortie Chexbres depuis la Riviera, à 15 minutes. Une place de parking gratuite est disponible devant la cabine.' },
      ],
    })]], { background: 'surface', paddingY: 'large' }),
  ],
});

// ── Bon cadeau ───────────────────────────────────────────────────────────────
pages.push({
  slug: 'bon-cadeau',
  title: 'Bon cadeau',
  seoTitle: 'Bon cadeau institut de beauté Palézieux | Emmanuelle Esthétique',
  seoDescription: 'Offrez une parenthèse de douceur : bon cadeau Emmanuelle Esthétique, montant libre ou soin de la carte, valable 60 mois. Palézieux-Gare.',
  ogImage: IMG.cadeau.url,
  keywords: 'bon cadeau institut de beauté Palézieux, idée cadeau soin visage, offrir un massage Vaud',
  content: [
    heroSplit({
      eyebrow: 'Bon cadeau · Palézieux-Gare',
      title: 'Offrez une parenthèse de douceur',
      text: 'Un bon cadeau Emmanuelle Esthétique, du montant de votre choix ou pour un soin de la carte : soin du visage Phytomer, massage, rituel du corps.',
      ctaText: 'Commander un bon',
      ctaUrl: '/contact',
      secondaryText: 'Voir la carte des soins',
      secondaryUrl: '/soins',
    }, IMG.cadeau),
    section('1-col', [[cards({
      eyebrow: 'Trois façons d’offrir',
      title: 'Choisir le bon cadeau',
      cols: 3,
      style: 'tinted',
      items: [
        { title: 'Un montant libre', text: 'Choisissez le montant qui vous convient, dès CHF 50 : la bénéficiaire choisit le soin qui lui fait envie.' },
        { title: 'Un soin précis', text: 'Offrez un soin de la carte — soin du visage, massage, rituel du corps. Le bon indique le soin choisi.', linkText: 'Voir la carte des soins', linkUrl: '/soins' },
        { title: 'PDF ou papier', text: 'Le bon vous est envoyé en PDF par e-mail dans les 24 h, ou remis dans une enveloppe cartonnée à retirer à la cabine de Palézieux-Gare.' },
      ],
    })]], { paddingY: 'large' }),
    section('1-col', [[
      heading('Bon à savoir', 2, { eyebrow: 'Les conditions' }),
      prose('<p>Le bon cadeau est nominatif et valable 60 mois. Il s’utilise en paiement lors d’un rendez-vous à la cabine, à Palézieux-Gare.</p>'),
    ]], { width: 'narrow', background: 'warm', paddingY: 'large' }),
    section('1-col', [[faq({
      eyebrow: 'Questions fréquentes',
      title: 'Sur les bons cadeaux',
      items: [
        { question: 'Comment commander un bon cadeau ?', answer: 'Écrivez-moi via le formulaire de contact, par e-mail ou par téléphone : indiquez le montant ou le soin souhaité, le nom de la bénéficiaire et le mode de livraison. Je vous envoie le bon dans les 24 h.' },
        { question: 'Quelle est la durée de validité d’un bon cadeau ?', answer: 'Un bon cadeau Emmanuelle Esthétique est valable 60 mois.' },
        { question: 'Le bon peut-il couvrir un soin précis ?', answer: 'Oui : le bon peut être d’un montant libre ou pour un soin de la carte.' },
      ],
    })]], { paddingY: 'large' }),
    closingCallout('Commander un bon cadeau', 'Indiquez-moi le montant ou le soin souhaité et le nom de la bénéficiaire.'),
  ],
});

// ─── Menu du brouillon ────────────────────────────────────────────────────────

const NAV = [
  {
    name: 'Les soins',
    type: 'dropdown',
    children: [
      { name: 'La carte & les tarifs', path: '/soins' },
      { name: 'Soins du visage', path: '/soins/visage' },
      { name: 'Corps & massages', path: '/soins/corps' },
      { name: 'Mains & pieds', path: '/soins/mains-et-pieds' },
      { name: 'Beauté du regard', path: '/soins/regard' },
      { name: 'Épilation', path: '/soins/epilation' },
    ],
  },
  { name: 'Phytomer', path: '/phytomer' },
  { name: 'À propos', path: '/a-propos' },
  { name: 'Bon cadeau', path: '/bon-cadeau' },
  { name: 'Contact', path: '/contact' },
];

// ─── Écriture ─────────────────────────────────────────────────────────────────

const seoKey = (slug: string, field: string) => `seo_pages_brouillon_${slug.replace(/\//g, '_')}_${field}`;

async function main() {
  loadEnv();
  const write = process.argv.includes('--write');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log(`Base : ${url}\nMode : ${write ? 'ÉCRITURE (brouillons uniquement)' : 'essai (aucune écriture)'}\n`);

  for (const p of pages) {
    const expanded = expandOffers(p.content, p.slug === 'home' ? 'cards' : 'rows');
    const blocks = expanded.reduce((n, s) => n + s.columns.reduce((m, c) => m + c.blocks.length, 0), 0);
    console.log(`  brouillon/${p.slug.padEnd(24)} ${String(expanded.length).padStart(2)} sections, ${String(blocks).padStart(3)} blocs · ${p.seoTitle.length} car. de titre, ${p.seoDescription.length} de description`);
    if (p.seoTitle.length > 65) console.log(`    ⚠ titre SEO long (${p.seoTitle.length})`);
    if (p.seoDescription.length > 165) console.log(`    ⚠ description SEO longue (${p.seoDescription.length})`);
    if (!write) continue;

    const row = {
      slug: `brouillon/${p.slug}`,
      title: p.title,
      sections: [],
      content: expandOffers(p.content, p.slug === 'home' ? 'cards' : 'rows'),
      content_version: 2,
      published: false,
      show_header: true,
      show_footer: true,
    };
    const { error } = await db.from('dynamic_pages').upsert(row, { onConflict: 'slug' });
    if (error) throw new Error(`${p.slug} : ${error.message}`);

    const settings = [
      ['title', p.seoTitle],
      ['description', p.seoDescription],
      ['og_title', p.seoTitle],
      ['og_description', p.seoDescription],
      ['og_image', p.ogImage],
      ['keywords', p.keywords],
    ].map(([field, value]) => ({ key: seoKey(p.slug, field), value }));
    const { error: sErr } = await db.from('settings').upsert(settings, { onConflict: 'key' });
    if (sErr) throw new Error(`Réglages SEO de ${p.slug} : ${sErr.message}`);
  }

  if (write) {
    const { error } = await db.from('settings').upsert({ key: 'navigation_menu_draft', value: JSON.stringify(NAV) }, { onConflict: 'key' });
    if (error) throw new Error(`navigation_menu_draft : ${error.message}`);
  }
  console.log(write ? '\nBrouillons écrits. Aperçu : npm run dev:brouillons → http://localhost:5180' : '\nEssai terminé — relancer avec --write pour écrire.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
