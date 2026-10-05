/**
 * Sections prêtes à l'emploi (bibliothèque) et gabarits de pages. Chaque
 * fabrique renvoie une section neuve (identifiants uniques à chaque appel).
 */
import type { ContentSection, ContentStructure } from './types';
import { createSection } from './types';
import { createBlock } from './blockMeta';

export interface SectionPreset {
  id: string;
  label: string;
  hint: string;
  category: 'ouverture' | 'contenu' | 'offre' | 'confiance' | 'action' | 'fonction';
  keywords: string;
  build: () => ContentSection;
}

export const PRESET_CATEGORIES: Record<SectionPreset['category'], string> = {
  ouverture: 'Ouverture',
  contenu: 'Contenu',
  offre: 'Offre & soins',
  confiance: 'Confiance',
  action: 'Faire réserver',
  fonction: 'Fonctions du site',
};

function withProps(s: ContentSection, props: Partial<ContentSection>): ContentSection {
  return { ...s, ...props };
}

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'hero-photo', label: 'En-tête avec photo de fond', hint: 'Grand titre sur une photo d\'ambiance', category: 'ouverture',
    keywords: 'hero banniere couverture accueil photo fond',
    build: () => withProps(createSection('1-col', [createBlock('hero')]), { minHeight: 'half', alignItems: 'center', paddingY: 'large', bgImage: { url: '', opacity: 55 }, animation: 'rise' }),
  },
  {
    id: 'hero-split', label: 'En-tête texte + photo', hint: 'Titre à gauche, photo à droite', category: 'ouverture',
    keywords: 'hero split photo droite accueil',
    build: () => {
      const s = createSection('2-col-60-40', [createBlock('hero')]);
      s.columns[1].blocks = [createBlock('image')];
      return withProps(s, { alignItems: 'center', paddingY: 'large', background: 'warm' });
    },
  },
  {
    id: 'text', label: 'Texte', hint: 'Titre et paragraphes, colonne de lecture', category: 'contenu',
    keywords: 'texte paragraphe article redaction',
    build: () => withProps(createSection('1-col', [createBlock('heading'), createBlock('text')]), { width: 'narrow' }),
  },
  {
    id: 'text-image', label: 'Texte + image', hint: 'Deux colonnes, image à droite', category: 'contenu',
    keywords: 'texte image cote a cote illustration',
    build: () => {
      const s = createSection('2-col-equal', [createBlock('heading'), createBlock('text'), createBlock('button')]);
      s.columns[1].blocks = [createBlock('image')];
      return withProps(s, { alignItems: 'center', reverseOnMobile: true });
    },
  },
  {
    id: 'image-bleed', label: 'Photo bord à bord + texte', hint: 'Photo pleine hauteur, texte à côté', category: 'contenu',
    keywords: 'intro citation photo pleine hauteur presentation',
    build: () => {
      const img = createBlock('image');
      (img as { fill?: boolean }).fill = true;
      const s = createSection('2-col-equal', [img]);
      s.columns[1].blocks = [createBlock('heading'), createBlock('divider'), createBlock('text'), createBlock('button')];
      return withProps(s, { flush: true, paddingY: 'none', width: 'full', alignItems: 'center', background: 'warm' });
    },
  },
  {
    id: 'quote', label: 'Citation', hint: 'Une phrase forte, centrée', category: 'contenu',
    keywords: 'citation phrase exergue',
    build: () => {
      const q = createBlock('quote');
      (q as { align?: string }).align = 'center';
      return withProps(createSection('1-col', [q]), { width: 'narrow', background: 'warm' });
    },
  },
  {
    id: 'cards', label: 'Cartes', hint: 'Soins, univers ou atouts en grille', category: 'offre',
    keywords: 'cartes grille univers soins atouts',
    build: () => withProps(createSection('1-col', [createBlock('cards')]), { background: 'warm' }),
  },
  {
    id: 'steps', label: 'Déroulement', hint: 'Les étapes d\'un soin', category: 'offre',
    keywords: 'etapes deroulement protocole',
    build: () => withProps(createSection('1-col', [createBlock('steps')]), { background: 'warm' }),
  },
  {
    id: 'price', label: 'Tarif', hint: 'Prix, inclus et bouton de réservation', category: 'offre',
    keywords: 'prix tarif offre reservation',
    build: () => withProps(createSection('1-col', [createBlock('offers')]), { width: 'contained' }),
  },
  {
    id: 'pricelist', label: 'Carte des tarifs', hint: 'Une ligne par soin : nom, durée, prix', category: 'offre',
    keywords: 'tarifs prix carte liste soins epilation',
    build: () => withProps(createSection('1-col', [createBlock('pricelist')]), { width: 'narrow' }),
  },
  {
    id: 'current-offer', label: 'Offre du moment', hint: 'L\'offre en cours, à jour toute seule — masquée sans offre active', category: 'offre',
    keywords: 'offre moment promotion promo mois remise reserver',
    build: () => withProps(createSection('1-col', [createBlock('current_offer')]), { background: 'warm', paddingY: 'medium', width: 'wide' }),
  },
  {
    id: 'faq', label: 'Questions fréquentes', hint: 'Accordéon, compris par Google', category: 'confiance',
    keywords: 'faq questions reponses',
    build: () => withProps(createSection('1-col', [createBlock('faq')]), {}),
  },
  {
    id: 'stats', label: 'Chiffres clés', hint: 'Trois ou quatre chiffres en bande', category: 'confiance',
    keywords: 'chiffres statistiques',
    build: () => withProps(createSection('1-col', [createBlock('stats')]), { paddingY: 'small' }),
  },
  {
    id: 'reviews', label: 'Avis Google', hint: 'Les avis réels de la fiche Google', category: 'confiance',
    keywords: 'avis google etoiles',
    build: () => withProps(createSection('1-col', [createBlock('google_reviews')]), { background: 'surface' }),
  },
  {
    id: 'testimonials', label: 'Témoignages', hint: 'Avis saisis à la main', category: 'confiance',
    keywords: 'temoignages avis clientes',
    build: () => withProps(createSection('1-col', [createBlock('testimonials')]), {}),
  },
  {
    id: 'gallery', label: 'Galerie photos', hint: 'Grille, carrousel ou cascade', category: 'contenu',
    keywords: 'galerie photos images',
    build: () => withProps(createSection('1-col', [createBlock('gallery')]), {}),
  },
  {
    id: 'callout', label: 'Bandeau de réservation', hint: 'Titre, phrase et bouton sur fond lagon', category: 'action',
    keywords: 'cta appel action reserver bandeau',
    build: () => withProps(createSection('1-col', [createBlock('callout')]), { background: 'accent', paddingY: 'large' }),
  },
  {
    id: 'contact', label: 'Coordonnées', hint: 'Adresse, téléphone, horaires', category: 'action',
    keywords: 'contact adresse telephone',
    build: () => withProps(createSection('1-col', [createBlock('contact')]), { width: 'contained' }),
  },
  {
    id: 'contact-form', label: 'Formulaire de contact', hint: 'Message envoyé par e-mail', category: 'action',
    keywords: 'formulaire contact message ecrire',
    build: () => withProps(createSection('1-col', [createBlock('contact_form')]), { width: 'narrow' }),
  },
  {
    id: 'marquee', label: 'Bandeau défilant', hint: 'Une ligne de mots qui défile', category: 'contenu',
    keywords: 'bandeau defilant marquee',
    build: () => withProps(createSection('full-width', [createBlock('marquee')]), { paddingY: 'none', background: 'dark' }),
  },
  {
    id: 'blog', label: 'Derniers articles', hint: 'Les articles récents du blog', category: 'fonction',
    keywords: 'blog articles actualites',
    build: () => withProps(createSection('full-width', [{ id: crypto.randomUUID(), type: 'legacy_section', section: { type: 'blog_grid_1', data: { eyebrow: 'Le journal', title: 'Derniers articles', limit: 3 } } }]), { paddingY: 'none' }),
  },
  {
    id: 'newsletter', label: 'Inscription newsletter', hint: 'Formulaire d\'inscription', category: 'fonction',
    keywords: 'newsletter inscription email',
    build: () => withProps(createSection('full-width', [{ id: crypto.randomUUID(), type: 'legacy_section', section: { type: 'newsletter_1', data: { eyebrow: 'Newsletter', title: 'Recevoir les nouvelles de l\'institut', button_text: 'S\'inscrire' } } }]), { paddingY: 'none' }),
  },
];

export interface PageTemplate { id: string; label: string; hint: string; build: () => ContentStructure }

const byId = (id: string) => SECTION_PRESETS.find((p) => p.id === id)!.build();

export const PAGE_TEMPLATES: PageTemplate[] = [
  { id: 'soin', label: 'Page soin', hint: 'En-tête, présentation, déroulement, tarif, questions, réservation', build: () => ['hero-photo', 'text-image', 'steps', 'price', 'faq', 'callout'].map(byId) },
  { id: 'atelier', label: 'Page atelier', hint: 'En-tête, programme, tarif, questions, réservation', build: () => ['hero-split', 'text', 'steps', 'price', 'faq', 'callout'].map(byId) },
  { id: 'univers', label: 'Page univers', hint: 'En-tête, cartes des soins, avis, réservation', build: () => ['hero-photo', 'cards', 'reviews', 'callout'].map(byId) },
  { id: 'simple', label: 'Page simple', hint: 'Titre et texte (mentions, informations)', build: () => ['text'].map(byId) },
  { id: 'vide', label: 'Page vide', hint: 'Partir de zéro', build: () => [] },
];
