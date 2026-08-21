import { SECTION_DEFAULTS } from './usePageEditor';
import type { PageSection, SectionType } from './wireframes.config';

/**
 * Modèles de pages prêts à remplir.
 *
 * Le pari : quelqu'un qui ne connaît rien au web ne doit pas avoir à composer
 * une page à partir de blocs isolés. Il choisit un type de page, puis une
 * disposition parmi quelques propositions — et obtient une structure qui se
 * tient, dans le bon ordre, avec l'alternance clair/foncé déjà posée.
 *
 * Les modèles sont **déclaratifs** : on ne décrit que la séquence de sections
 * et les quelques réglages qui donnent son caractère à la disposition. Le
 * contenu de départ vient de `SECTION_DEFAULTS`, ce qui évite de dupliquer des
 * textes d'exemple à vingt endroits.
 */

export type TemplateCategory = 'accueil' | 'a-propos' | 'services' | 'contact' | 'tarifs';

export interface PageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  /** Ce que la disposition met en avant — aide au choix, pas au remplissage. */
  description: string;
  blueprint: { type: any; data?: Record<string, unknown> }[];
}

export const TEMPLATE_CATEGORIES: {
  id: TemplateCategory;
  label: string;
  hint: string;
}[] = [
  { id: 'accueil', label: 'Accueil', hint: "La page d'entrée du site" },
  { id: 'services', label: 'Prestations', hint: 'Ce que vous vendez' },
  { id: 'a-propos', label: 'À propos', hint: 'Qui vous êtes' },
  { id: 'tarifs', label: 'Tarifs', hint: 'Vos prix, clairement' },
  { id: 'contact', label: 'Contact', hint: 'Comment vous joindre' },
];

/* Alternance clair / foncé : une section sur deux ou trois passe en foncé, ce
   qui découpe la page visuellement sans que l'utilisateur ait à y penser. */
const dark = { theme: 'dark' as const };

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Accueil ───────────────────────────────────────────────────────────────
  {
    id: 'accueil-moderne-bento',
    name: 'Tendance Bento & Vidéo',
    category: 'accueil',
    description: "Layout moderne style Apple avec hero vidéo, grille Bento et capture d'email.",
    blueprint: [
      { type: 'hero_video' },
      { type: 'bento_grid_1' },
      { type: 'stats_3', data: dark },
      { type: 'newsletter_1' },
      { type: 'cta_2' },
    ],
  },
  {
    id: 'accueil-classique',
    name: 'Classique',
    category: 'accueil',
    description: "Le parcours éprouvé : on annonce, on explique, on rassure, on invite.",
    blueprint: [
      { type: 'hero_1' },
      { type: 'intro_1' },
      { type: 'features_2' },
      { type: 'testimonial_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'accueil-visuel',
    name: 'Vitrine visuelle',
    category: 'accueil',
    description: 'Pour un métier qui se montre : images d’abord, texte ensuite.',
    blueprint: [
      { type: 'hero_4' },
      { type: 'gallery_grid' },
      { type: 'text_image_1' },
      { type: 'reviews_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'accueil-preuve',
    name: 'La preuve d’abord',
    category: 'accueil',
    description: 'Chiffres et références en haut de page, pour lever le doute tout de suite.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'logos_1' },
      { type: 'stats_1', data: dark },
      { type: 'features_2' },
      { type: 'testimonial_1' },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'accueil-offre',
    name: 'Offre et prix',
    category: 'accueil',
    description: 'Quand le prix est un argument : il arrive tôt, suivi des objections.',
    blueprint: [
      { type: 'hero_1' },
      { type: 'features_1' },
      { type: 'pricing_1', data: dark },
      { type: 'faq_1' },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'accueil-editorial',
    name: 'Éditorial',
    category: 'accueil',
    description: 'Beaucoup de texte, peu de blocs — pour un propos qui se lit.',
    blueprint: [
      { type: 'hero_3' },
      { type: 'text_1' },
      { type: 'text_image_1' },
      { type: 'marquee_1' },
      { type: 'cta_1' },
    ],
  },

  // ── Prestations ───────────────────────────────────────────────────────────
  {
    id: 'services-grille',
    name: 'Grille de prestations',
    category: 'services',
    description: 'Toutes vos prestations d’un coup d’œil, puis les prix.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_3' },
      { type: 'pricing_1', data: dark },
      { type: 'faq_1' },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'services-detaille',
    name: 'Détaillé',
    category: 'services',
    description: 'Chaque prestation développée, texte et image en vis-à-vis.',
    blueprint: [
      { type: 'hero_1' },
      { type: 'text_image_1', data: { image_position: 'left' } },
      { type: 'text_image_1', data: { image_position: 'right' } },
      { type: 'features_2', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'services-catalogue',
    name: 'Catalogue illustré',
    category: 'services',
    description: 'Pour les métiers où l’on achète avec les yeux.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'gallery_grid' },
      { type: 'features_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'services-comparatif',
    name: 'Formules comparées',
    category: 'services',
    description: 'Trois formules côte à côte, pour aider à choisir plutôt qu’à hésiter.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_3' },
      { type: 'pricing_1' },
      { type: 'testimonial_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'services-une',
    name: 'Une seule prestation',
    category: 'services',
    description: 'Une page dédiée à une offre unique, traitée à fond.',
    blueprint: [
      { type: 'hero_1' },
      { type: 'text_1' },
      { type: 'features_1' },
      { type: 'timeline_1', data: dark },
      { type: 'faq_1' },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'services-preuve',
    name: 'Avec résultats',
    category: 'services',
    description: 'Prestations, puis chiffres et avis pour appuyer.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_2' },
      { type: 'stats_1', data: dark },
      { type: 'reviews_1' },
      { type: 'cta_1' },
    ],
  },

  // ── À propos ──────────────────────────────────────────────────────────────
  {
    id: 'apropos-portrait',
    name: 'Portrait',
    category: 'a-propos',
    description: 'Centré sur la personne : visage, parcours, étapes.',
    blueprint: [
      { type: 'hero_3' },
      { type: 'text_image_1' },
      { type: 'timeline_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'apropos-histoire',
    name: 'Notre histoire',
    category: 'a-propos',
    description: 'Un récit, illustré, qui finit sur des chiffres.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'text_1' },
      { type: 'gallery_masonry' },
      { type: 'stats_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'apropos-equipe',
    name: 'L’équipe',
    category: 'a-propos',
    description: 'Quand plusieurs personnes font le métier.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_3' },
      { type: 'gallery_grid', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'apropos-valeurs',
    name: 'Nos valeurs',
    category: 'a-propos',
    description: 'Ce à quoi vous tenez, appuyé par un témoignage.',
    blueprint: [
      { type: 'hero_5' },
      { type: 'features_2' },
      { type: 'testimonial_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'apropos-simple',
    name: 'Court et net',
    category: 'a-propos',
    description: 'Trois blocs. Quand il n’y a pas grand-chose à raconter, autant l’assumer.',
    blueprint: [{ type: 'hero_2' }, { type: 'text_1' }, { type: 'cta_1' }],
  },

  // ── Tarifs ────────────────────────────────────────────────────────────────
  {
    id: 'tarifs-grille',
    name: 'Grille tarifaire',
    category: 'tarifs',
    description: 'Les prix, puis les questions qu’ils soulèvent.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'pricing_1' },
      { type: 'faq_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'tarifs-preuve',
    name: 'Prix justifiés',
    category: 'tarifs',
    description: 'Le prix encadré par ce qui le rend légitime.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_1' },
      { type: 'pricing_1', data: dark },
      { type: 'testimonial_1' },
      { type: 'stats_1' },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'tarifs-simple',
    name: 'Un seul prix',
    category: 'tarifs',
    description: 'Une offre, un montant, un bouton.',
    blueprint: [{ type: 'hero_2' }, { type: 'pricing_1' }, { type: 'cta_1' }],
  },

  // ── Contact ───────────────────────────────────────────────────────────────
  {
    id: 'contact-simple',
    name: 'Simple',
    category: 'contact',
    description: 'L’essentiel : où vous êtes, comment vous joindre.',
    blueprint: [{ type: 'hero_2' }, { type: 'text_1' }, { type: 'cta_1' }],
  },
  {
    id: 'contact-faq',
    name: 'Avec questions fréquentes',
    category: 'contact',
    description: 'Répond avant qu’on demande — et allège votre boîte mail.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'text_1' },
      { type: 'faq_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'contact-rassurant',
    name: 'Rassurant',
    category: 'contact',
    description: 'Pour les métiers où l’on hésite à faire le premier pas.',
    blueprint: [
      { type: 'hero_2' },
      { type: 'features_1' },
      { type: 'testimonial_1', data: dark },
      { type: 'cta_1' },
    ],
  },
  {
    id: 'contact-visuel',
    name: 'Visuel',
    category: 'contact',
    description: 'Une image forte, puis les informations pratiques.',
    blueprint: [{ type: 'hero_4' }, { type: 'text_image_1' }, { type: 'cta_1' }],
  },
];

/**
 * Construit les sections d'un modèle.
 *
 * Le contenu de départ vient de `SECTION_DEFAULTS` ; les surcharges du modèle
 * s'appliquent par-dessus. Une copie profonde est indispensable : sans elle,
 * deux pages créées depuis le même modèle partageraient leurs tableaux, et
 * modifier l'une modifierait l'autre.
 */
export function buildTemplateSections(template: PageTemplate): PageSection[] {
  return template.blueprint.map(({ type, data }) => ({
    type,
    data: {
      ...structuredClone(SECTION_DEFAULTS[type] ?? {}),
      ...(data ? structuredClone(data) : {}),
    },
  })) as PageSection[];
}
