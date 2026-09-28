/**
 * Description de chaque bloc : libellé, catégorie, champs du formulaire,
 * valeurs par défaut. C'est la source unique pour l'inspecteur (formulaire
 * généré), la bibliothèque (recherche, catégories) et l'IA (schéma envoyé au
 * modèle). Un champ marqué `style: true` n'apparaît qu'en mode « Mise en
 * page » : en mode « Contenu », Emmanuelle ne voit que textes, images et liens.
 */
import type { BlockType, ContentBlock } from './types';
import { uid } from './types';

export type FieldKind =
  | 'text' | 'textarea' | 'richtext' | 'image' | 'url'
  | 'select' | 'toggle' | 'number' | 'list' | 'stringlist';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  style?: boolean;
  help?: string;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  /** Pour `list` : champs de chaque élément. */
  itemFields?: FieldDef[];
  itemLabel?: string;
  /** Pour `list` : fabrique d'un nouvel élément. */
  newItem?: () => Record<string, unknown>;
  min?: number;
  max?: number;
}

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  category: BlockCategory;
  keywords: string;
  fields: FieldDef[];
  create: () => ContentBlock;
  /** Masqué de la bibliothèque (types conservés pour la compatibilité). */
  hidden?: boolean;
}

export type BlockCategory = 'texte' | 'media' | 'offre' | 'preuve' | 'action' | 'structure';

export const CATEGORY_LABELS: Record<BlockCategory, { label: string; hint: string }> = {
  texte: { label: 'Texte', hint: 'Titres, paragraphes, citations' },
  media: { label: 'Images & vidéo', hint: 'Montrer plutôt que décrire' },
  offre: { label: 'Offre', hint: 'Soins, tarifs, déroulement' },
  preuve: { label: 'Confiance', hint: 'Avis, chiffres, questions' },
  action: { label: 'Contact & action', hint: 'Faire réserver, faire écrire' },
  structure: { label: 'Mise en forme', hint: 'Espaces et séparateurs' },
};

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centré' },
  { value: 'right', label: 'Droite' },
];

const eyebrow: FieldDef = { key: 'eyebrow', label: 'Surtitre', kind: 'text', help: 'Petite ligne en capitales au-dessus du titre.' };
const title: FieldDef = { key: 'title', label: 'Titre', kind: 'text' };
const intro: FieldDef = { key: 'intro', label: 'Introduction', kind: 'textarea' };

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  heading: {
    type: 'heading', label: 'Titre', description: 'Un titre avec surtitre et chapeau optionnels.', category: 'texte',
    keywords: 'titre h1 h2 intertitre entete surtitre',
    fields: [
      eyebrow,
      { key: 'text', label: 'Titre', kind: 'text' },
      { key: 'lead', label: 'Chapeau', kind: 'textarea', help: 'Une ou deux phrases sous le titre.' },
      { key: 'level', label: 'Niveau', kind: 'select', style: true, help: 'Un seul titre principal (H1) par page.', options: [{ value: 1, label: 'Titre principal (H1)' }, { value: 2, label: 'Titre de section (H2)' }, { value: 3, label: 'Sous-titre (H3)' }] },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: ALIGN_OPTIONS },
    ],
    create: () => ({ id: uid(), type: 'heading', text: 'Votre titre', level: 2, align: 'left' }),
  },
  text: {
    type: 'text', label: 'Texte', description: 'Paragraphes, listes, liens, intertitres.', category: 'texte',
    keywords: 'paragraphe texte contenu redaction article liste',
    fields: [
      { key: 'html', label: 'Texte', kind: 'richtext' },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: [...ALIGN_OPTIONS, { value: 'justify', label: 'Justifié' }] },
    ],
    create: () => ({ id: uid(), type: 'text', html: '<p>Votre texte ici.</p>' }),
  },
  quote: {
    type: 'quote', label: 'Citation', description: 'Une phrase mise en valeur.', category: 'texte',
    keywords: 'citation phrase exergue parole',
    fields: [
      { key: 'quote', label: 'Citation', kind: 'textarea' },
      { key: 'author', label: 'Auteur', kind: 'text' },
      { key: 'role', label: 'Précision', kind: 'text' },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: ALIGN_OPTIONS },
    ],
    create: () => ({ id: uid(), type: 'quote', quote: '« Prendre soin, c\'est d\'abord prendre le temps. »' }),
  },
  checklist: {
    type: 'checklist', label: 'Liste cochée', description: 'Des points avec une coche.', category: 'texte',
    keywords: 'liste puces coches inclus avantages',
    fields: [title, { key: 'items', label: 'Points', kind: 'stringlist' }],
    create: () => ({ id: uid(), type: 'checklist', title: '', items: ['Premier point', 'Deuxième point', 'Troisième point'] }),
  },
  hero: {
    type: 'hero', label: 'En-tête de page', description: 'Grand titre d\'ouverture avec bouton.', category: 'texte',
    keywords: 'banniere hero accueil ouverture entete couverture grand titre',
    fields: [
      eyebrow,
      { key: 'title', label: 'Titre', kind: 'text' },
      { key: 'text', label: 'Texte', kind: 'textarea' },
      { key: 'ctaText', label: 'Bouton principal', kind: 'text' },
      { key: 'ctaUrl', label: 'Lien du bouton', kind: 'url' },
      { key: 'secondaryText', label: 'Bouton secondaire', kind: 'text' },
      { key: 'secondaryUrl', label: 'Lien du bouton secondaire', kind: 'url' },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: ALIGN_OPTIONS.slice(0, 2) },
      { key: 'size', label: 'Taille du titre', kind: 'select', style: true, options: [{ value: 'medium', label: 'Moyenne' }, { value: 'large', label: 'Grande' }] },
    ],
    create: () => ({ id: uid(), type: 'hero', eyebrow: 'Institut · Palézieux-Gare', title: 'Titre de la page', text: 'Une phrase d\'accueil claire.', ctaText: 'Prendre rendez-vous', ctaUrl: '/contact', align: 'left', size: 'large' }),
  },
  image: {
    type: 'image', label: 'Image', description: 'Une photo, avec légende.', category: 'media',
    keywords: 'image photo illustration visuel',
    fields: [
      { key: 'url', label: 'Image', kind: 'image' },
      { key: 'alt', label: 'Description (référencement)', kind: 'text', help: 'Ce que montre la photo, en une phrase.' },
      { key: 'caption', label: 'Légende', kind: 'text' },
      { key: 'fill', label: 'Remplir la colonne (bord à bord)', kind: 'toggle', style: true },
      { key: 'ratio', label: 'Format', kind: 'select', style: true, options: [{ value: 'auto', label: 'Original' }, { value: '16/9', label: 'Paysage 16:9' }, { value: '4/3', label: 'Paysage 4:3' }, { value: '1/1', label: 'Carré' }, { value: '4/5', label: 'Portrait 4:5' }, { value: '3/4', label: 'Portrait 3:4' }] },
      { key: 'size', label: 'Largeur', kind: 'select', style: true, options: [{ value: 'small', label: 'Petite' }, { value: 'medium', label: 'Moyenne' }, { value: 'large', label: 'Grande' }, { value: 'full', label: 'Toute la colonne' }] },
      { key: 'fit', label: 'Cadrage', kind: 'select', style: true, options: [{ value: 'cover', label: 'Remplir' }, { value: 'contain', label: 'Image entière' }] },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: ALIGN_OPTIONS },
    ],
    create: () => ({ id: uid(), type: 'image', url: '', alt: '', ratio: '4/3', size: 'full', fit: 'cover' }),
  },
  gallery: {
    type: 'gallery', label: 'Galerie', description: 'Plusieurs photos en grille, carrousel ou cascade.', category: 'media',
    keywords: 'galerie photos images portfolio carrousel grille cascade',
    fields: [
      title,
      { key: 'variant', label: 'Présentation', kind: 'select', style: true, options: [{ value: 'grid', label: 'Grille' }, { value: 'carousel', label: 'Carrousel' }, { value: 'masonry', label: 'Cascade' }] },
      { key: 'cols', label: 'Colonnes', kind: 'select', style: true, options: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }] },
      {
        key: 'images', label: 'Photos', kind: 'list', itemLabel: 'Photo',
        itemFields: [{ key: 'url', label: 'Image', kind: 'image' }, { key: 'alt', label: 'Description', kind: 'text' }, { key: 'caption', label: 'Légende', kind: 'text' }],
        newItem: () => ({ id: uid(), url: '', alt: '' }),
      },
    ],
    create: () => ({ id: uid(), type: 'gallery', variant: 'grid', cols: 3, images: [] }),
  },
  video: {
    type: 'video', label: 'Vidéo', description: 'YouTube, Vimeo ou fichier vidéo.', category: 'media',
    keywords: 'video youtube vimeo film',
    fields: [{ key: 'url', label: 'Adresse de la vidéo', kind: 'url' }, { key: 'caption', label: 'Légende', kind: 'text' }],
    create: () => ({ id: uid(), type: 'video', url: '' }),
  },
  marquee: {
    type: 'marquee', label: 'Bandeau défilant', description: 'Une ligne de mots qui défile.', category: 'media',
    keywords: 'bandeau defilant ruban marquee animation',
    fields: [
      { key: 'items', label: 'Éléments', kind: 'stringlist' },
      { key: 'separator', label: 'Séparateur', kind: 'text', style: true },
      { key: 'speed', label: 'Vitesse', kind: 'select', style: true, options: [{ value: 'slow', label: 'Lente' }, { value: 'normal', label: 'Normale' }, { value: 'fast', label: 'Rapide' }] },
      { key: 'italic', label: 'Italique', kind: 'toggle', style: true },
    ],
    create: () => ({ id: uid(), type: 'marquee', items: ['Soins visage', 'Head Spa', 'Massages', 'Beauté du regard'], separator: '●', speed: 'normal' }),
  },
  cards: {
    type: 'cards', label: 'Cartes', description: 'Une grille de cartes (soins, atouts, univers).', category: 'offre',
    keywords: 'cartes grille atouts points cles avantages univers soins prestations features',
    fields: [
      eyebrow, title, intro,
      {
        key: 'items', label: 'Cartes', kind: 'list', itemLabel: 'Carte',
        itemFields: [
          { key: 'title', label: 'Titre', kind: 'text' },
          { key: 'text', label: 'Texte', kind: 'textarea' },
          { key: 'image', label: 'Image (optionnelle)', kind: 'image' },
          { key: 'linkText', label: 'Texte du lien', kind: 'text' },
          { key: 'linkUrl', label: 'Lien', kind: 'url' },
        ],
        newItem: () => ({ id: uid(), title: 'Nouvelle carte', text: '' }),
      },
      { key: 'cols', label: 'Colonnes', kind: 'select', style: true, options: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }] },
      { key: 'imagePosition', label: 'Position de l\'image', kind: 'select', options: [{ value: 'top', label: 'Au-dessus du texte' }, { value: 'left', label: 'À gauche du texte' }] },
      { key: 'style', label: 'Style des cartes', kind: 'select', style: true, options: [{ value: 'plain', label: 'Sans fond' }, { value: 'tinted', label: 'Fond teinté' }, { value: 'outlined', label: 'Filet' }] },
    ],
    create: () => ({ id: uid(), type: 'cards', title: 'Nos atouts', cols: 3, style: 'tinted', items: [
      { id: uid(), title: 'Premier atout', text: 'Une phrase qui l\'explique.' },
      { id: uid(), title: 'Deuxième atout', text: 'Une phrase qui l\'explique.' },
      { id: uid(), title: 'Troisième atout', text: 'Une phrase qui l\'explique.' },
    ] }),
  },
  steps: {
    type: 'steps', label: 'Étapes', description: 'Le déroulement, étape par étape.', category: 'offre',
    keywords: 'etapes deroulement processus methode protocole numerote chronologie',
    fields: [
      eyebrow, title, intro,
      {
        key: 'items', label: 'Étapes', kind: 'list', itemLabel: 'Étape',
        itemFields: [{ key: 'title', label: 'Titre', kind: 'text' }, { key: 'text', label: 'Texte', kind: 'textarea' }],
        newItem: () => ({ id: uid(), title: 'Nouvelle étape', text: '' }),
      },
    ],
    create: () => ({ id: uid(), type: 'steps', title: 'Le déroulement du soin', items: [
      { id: uid(), title: 'Accueil', text: 'On fait le point ensemble.' },
      { id: uid(), title: 'Le soin', text: 'Le protocole, adapté à votre peau.' },
      { id: uid(), title: 'Conseils', text: 'Ce que vous pouvez faire à la maison.' },
    ] }),
  },
  offers: {
    type: 'offers', label: 'Tarifs', description: 'Un ou plusieurs soins avec prix et bouton.', category: 'offre',
    keywords: 'prix tarif offre formule forfait pricing reservation',
    fields: [
      eyebrow, title, intro,
      {
        key: 'offers', label: 'Offres', kind: 'list', itemLabel: 'Offre',
        itemFields: [
          { key: 'name', label: 'Nom', kind: 'text' },
          { key: 'badge', label: 'Pastille', kind: 'text', placeholder: 'Le plus demandé' },
          { key: 'price', label: 'Prix', kind: 'text', placeholder: 'CHF 130' },
          { key: 'priceNote', label: 'Précision', kind: 'text', placeholder: '· 60 minutes' },
          { key: 'description', label: 'Description', kind: 'textarea' },
          { key: 'bullets', label: 'Inclus', kind: 'stringlist' },
          { key: 'ctaText', label: 'Bouton', kind: 'text' },
          { key: 'ctaUrl', label: 'Lien du bouton', kind: 'url' },
          { key: 'highlight', label: 'Mettre en avant', kind: 'toggle' },
        ],
        newItem: () => ({ id: uid(), name: 'Nouveau soin', price: 'CHF', bullets: [], ctaText: 'Réserver', ctaUrl: '/contact' }),
      },
      { key: 'footnote', label: 'Note sous les tarifs', kind: 'textarea' },
    ],
    create: () => ({ id: uid(), type: 'offers', title: 'Tarif', offers: [
      { id: uid(), name: 'Soin visage', price: 'CHF 130', priceNote: '· 60 minutes', description: '', bullets: ['Diagnostic de peau', 'Massage manuel'], ctaText: 'Réserver ce soin', ctaUrl: '/contact' },
    ], footnote: 'Paiement en cabine : TWINT, espèces, cartes.' }),
  },
  pricelist: {
    type: 'pricelist', label: 'Carte des tarifs', description: 'Une ligne par soin : nom, durée, prix. Idéal pour la carte complète.', category: 'offre',
    keywords: 'tarifs prix carte liste soins epilation tableau',
    fields: [
      eyebrow, title, intro,
      { key: 'level', label: 'Niveau du titre', kind: 'select', style: true, help: 'Sous-titre (H3) quand la liste est rangée sous un titre de section.', options: [{ value: 2, label: 'Titre de section (H2)' }, { value: 3, label: 'Sous-titre (H3)' }] },
      {
        key: 'items', label: 'Soins', kind: 'list', itemLabel: 'Soin',
        itemFields: [
          { key: 'name', label: 'Nom', kind: 'text' },
          { key: 'duration', label: 'Durée', kind: 'text', placeholder: '60 min' },
          { key: 'price', label: 'Prix', kind: 'text', placeholder: 'CHF 90' },
          { key: 'description', label: 'Description', kind: 'textarea' },
        ],
        newItem: () => ({ id: uid(), name: 'Nouveau soin', price: 'CHF' }),
      },
      { key: 'footnote', label: 'Note sous la liste', kind: 'textarea' },
      { key: 'linkText', label: 'Texte du lien', kind: 'text' },
      { key: 'linkUrl', label: 'Lien', kind: 'url' },
    ],
    create: () => ({ id: uid(), type: 'pricelist', title: 'Tarifs', items: [
      { id: uid(), name: 'Premier soin', duration: '60 min', price: 'CHF 100' },
      { id: uid(), name: 'Deuxième soin', price: 'CHF 50' },
    ] }),
  },
  faq: {
    type: 'faq', label: 'Questions fréquentes', description: 'Questions dépliables (données structurées Google incluses).', category: 'preuve',
    keywords: 'faq questions reponses accordeon',
    fields: [
      eyebrow, title, intro,
      {
        key: 'items', label: 'Questions', kind: 'list', itemLabel: 'Question',
        itemFields: [{ key: 'question', label: 'Question', kind: 'text' }, { key: 'answer', label: 'Réponse', kind: 'textarea' }],
        newItem: () => ({ id: uid(), question: 'Nouvelle question ?', answer: '' }),
      },
    ],
    create: () => ({ id: uid(), type: 'faq', title: 'Questions fréquentes', items: [
      { id: uid(), question: 'Comment prendre rendez-vous ?', answer: 'Par le formulaire de contact ou par téléphone.' },
    ] }),
  },
  stats: {
    type: 'stats', label: 'Chiffres', description: 'Quelques chiffres clés en bande.', category: 'preuve',
    keywords: 'chiffres statistiques nombres resultats compteurs',
    fields: [
      eyebrow, title,
      {
        key: 'items', label: 'Chiffres', kind: 'list', itemLabel: 'Chiffre',
        itemFields: [{ key: 'value', label: 'Valeur', kind: 'text' }, { key: 'label', label: 'Légende', kind: 'text' }],
        newItem: () => ({ id: uid(), value: '10', label: 'légende' }),
      },
    ],
    create: () => ({ id: uid(), type: 'stats', items: [
      { id: uid(), value: '20+', label: 'années d\'expérience' },
      { id: uid(), value: '2 min', label: 'de la gare CFF' },
      { id: uid(), value: '100 %', label: 'sur rendez-vous' },
    ] }),
  },
  testimonials: {
    type: 'testimonials', label: 'Témoignages', description: 'Avis de clientes, saisis à la main (uniquement réels).', category: 'preuve',
    keywords: 'temoignages avis clientes citations',
    fields: [
      title,
      {
        key: 'items', label: 'Témoignages', kind: 'list', itemLabel: 'Témoignage',
        itemFields: [{ key: 'quote', label: 'Texte', kind: 'textarea' }, { key: 'author', label: 'Prénom', kind: 'text' }, { key: 'role', label: 'Précision', kind: 'text' }],
        newItem: () => ({ id: uid(), quote: '', author: '' }),
      },
    ],
    create: () => ({ id: uid(), type: 'testimonials', title: 'Elles en parlent', items: [] }),
  },
  google_reviews: {
    type: 'google_reviews', label: 'Avis Google', description: 'Les vrais avis de la fiche Google, mis à jour tout seuls.', category: 'preuve',
    keywords: 'avis google etoiles notes',
    fields: [title, { key: 'max', label: 'Nombre d\'avis', kind: 'number', min: 1, max: 6 }],
    create: () => ({ id: uid(), type: 'google_reviews', title: 'Vos avis', max: 3 }),
  },
  button: {
    type: 'button', label: 'Bouton', description: 'Un ou deux boutons.', category: 'action',
    keywords: 'bouton lien cta reserver appel action',
    fields: [
      { key: 'text', label: 'Texte', kind: 'text' },
      { key: 'url', label: 'Lien', kind: 'url' },
      { key: 'secondaryText', label: 'Second bouton', kind: 'text' },
      { key: 'secondaryUrl', label: 'Lien du second bouton', kind: 'url' },
      { key: 'variant', label: 'Style', kind: 'select', style: true, options: [{ value: 'primary', label: 'Plein' }, { value: 'secondary', label: 'Contour' }, { value: 'link', label: 'Lien souligné' }] },
      { key: 'align', label: 'Alignement', kind: 'select', style: true, options: ALIGN_OPTIONS },
      { key: 'newTab', label: 'Ouvrir dans un nouvel onglet', kind: 'toggle', style: true },
    ],
    create: () => ({ id: uid(), type: 'button', text: 'Prendre rendez-vous', url: '/contact', variant: 'primary', align: 'left' }),
  },
  callout: {
    type: 'callout', label: 'Appel à réserver', description: 'Titre, phrase et bouton, centrés — à poser sur un fond coloré.', category: 'action',
    keywords: 'appel action cta bandeau reserver conclusion',
    fields: [
      eyebrow,
      { key: 'title', label: 'Titre', kind: 'text' },
      { key: 'text', label: 'Texte', kind: 'textarea' },
      { key: 'ctaText', label: 'Bouton', kind: 'text' },
      { key: 'ctaUrl', label: 'Lien du bouton', kind: 'url' },
    ],
    create: () => ({ id: uid(), type: 'callout', title: 'Réserver votre soin', text: 'Je vous réponds sous 24 h.', ctaText: 'Écrire à Emmanuelle', ctaUrl: '/contact' }),
  },
  contact: {
    type: 'contact', label: 'Coordonnées', description: 'Adresse, téléphone, e-mail, horaires.', category: 'action',
    keywords: 'contact adresse telephone email horaires coordonnees plan',
    fields: [
      title,
      { key: 'text', label: 'Texte', kind: 'textarea' },
      { key: 'address', label: 'Adresse', kind: 'text' },
      { key: 'phone', label: 'Téléphone', kind: 'text' },
      { key: 'email', label: 'E-mail', kind: 'text' },
      { key: 'hours', label: 'Horaires', kind: 'text' },
    ],
    create: () => ({ id: uid(), type: 'contact', title: 'Coordonnées' }),
  },
  contact_form: {
    type: 'contact_form', label: 'Formulaire de contact', description: 'Le formulaire d\'envoi de message (réponse par e-mail).', category: 'action',
    keywords: 'formulaire contact message ecrire rendez-vous',
    fields: [],
    create: () => ({ id: uid(), type: 'contact_form' }),
  },
  spacer: {
    type: 'spacer', label: 'Espace', description: 'Un espace vertical.', category: 'structure', keywords: 'espace marge vide',
    fields: [{ key: 'height', label: 'Hauteur', kind: 'select', options: [{ value: 'small', label: 'Petit' }, { value: 'medium', label: 'Moyen' }, { value: 'large', label: 'Grand' }] }],
    create: () => ({ id: uid(), type: 'spacer', height: 'medium' }),
  },
  divider: {
    type: 'divider', label: 'Séparateur', description: 'Un filet horizontal.', category: 'structure', keywords: 'separateur ligne filet trait',
    fields: [{ key: 'style', label: 'Style', kind: 'select', options: [{ value: 'line', label: 'Pleine largeur' }, { value: 'short', label: 'Court' }] }],
    create: () => ({ id: uid(), type: 'divider', style: 'short' }),
  },
  legacy_section: {
    type: 'legacy_section', label: 'Section existante', description: 'Section de l\'ancien constructeur, conservée à l\'identique.', category: 'structure',
    keywords: '', hidden: true,
    fields: [],
    create: () => ({ id: uid(), type: 'legacy_section', section: { type: 'text_1', data: {} } }),
  },
};

export const LIBRARY_BLOCKS = (Object.values(BLOCK_META) as BlockMeta[]).filter((m) => !m.hidden);

export function createBlock(type: BlockType): ContentBlock {
  return BLOCK_META[type].create();
}

/** Premier texte lisible d'un bloc — pour les listes et les fils d'Ariane de l'éditeur. */
export function blockSummary(block: ContentBlock): string {
  const b = block as unknown as Record<string, unknown>;
  const raw = [b.title, b.text, b.quote, b.html, b.name, b.question].find((v) => typeof v === 'string' && v.trim());
  if (block.type === 'legacy_section') return String((block.section.data as Record<string, unknown>).title ?? block.section.type);
  return raw ? String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) : '';
}
