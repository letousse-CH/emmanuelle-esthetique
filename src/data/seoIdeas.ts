/**
 * Structure des idées d'articles SEO utilisée par le hub SEO de l'admin
 * (/admin/seo) et par l'éditeur d'articles.
 *
 * `seoIdeas` est volontairement vide : les idées se génèrent depuis l'admin
 * (bouton « Générer des idées », route /api/generate-seo-ideas), à partir du
 * contexte d'activité et des piliers de contenu réglés dans
 * /admin/settings → « Éditorial & Marque ». Rien n'est codé en dur ici, pour
 * que le template reste réutilisable d'un site à l'autre.
 *
 * Les catégories ci-dessous reflètent les piliers de contenu du site ; si vous
 * les modifiez dans les réglages, alignez-les ici pour que les filtres et les
 * couleurs du hub SEO restent cohérents.
 */

export type SeoCategory =
  | 'Rituels de soin'       // Routines et gestes du quotidien, soin du visage à la maison
  | 'Gua Sha & massage'     // Auto-massage, Gua Sha, gestes de drainage
  | 'Head Spa'              // Soin et détente du cuir chevelu
  | 'Cosmétique naturelle'  // Ingrédients, lecture d'étiquettes, choix des produits
  | 'Peau & saisons'        // Adapter sa routine au froid, au soleil, à la fatigue
  | 'Bien-être';            // Prendre du temps pour soi, respiration, sommeil

export type Difficulty = 'faible' | 'moyen' | 'élevé';
export type Volume     = 'faible' | 'moyen' | 'élevé';
export type Intent     = 'informationnel' | 'transactionnel' | 'navigationnel';

export interface SeoIdea {
  id: string;
  category: SeoCategory;
  keyword: string;           // Requête exacte que les gens tapent
  question: string;          // Reformulation question
  difficulty: Difficulty;    // Difficulté SEO estimée
  volume: Volume;            // Volume de recherche estimé
  intent: Intent;
  suggestedTitle: string;    // Titre H1 recommandé (mot-clé dans les 4 premiers mots)
  suggestedSlug: string;     // URL optimisée
  suggestedIntro: string;    // Accroche d'introduction suggérée
  relatedQuestions: string[];// "People Also Ask" de Google
  secondaryKeywords?: string[];// Cluster sémantique — variations et termes associés
  contentTips: string[];     // Conseils de rédaction
  cta: string;               // CTA de fin d'article
  opportunity: string;       // Pourquoi cette requête est intéressante
}

/** Idées pré-enregistrées. Vide par défaut — à alimenter depuis /admin/seo. */
export const seoIdeas: SeoIdea[] = [];

export const CATEGORIES: SeoCategory[] = [
  'Rituels de soin',
  'Gua Sha & massage',
  'Head Spa',
  'Cosmétique naturelle',
  'Peau & saisons',
  'Bien-être',
];

export const CATEGORY_COLORS: Record<SeoCategory, string> = {
  'Rituels de soin':      'bg-sage/10 text-sage border-sage/30',
  'Gua Sha & massage':    'bg-teal-50 text-teal-700 border-teal-200',
  'Head Spa':             'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Cosmétique naturelle': 'bg-amber-50 text-amber-700 border-amber-200',
  'Peau & saisons':       'bg-orange-50 text-orange-700 border-orange-200',
  'Bien-être':            'bg-purple-50 text-purple-700 border-purple-200',
};

export const CATEGORY_EMOJIS: Record<SeoCategory, string> = {
  'Rituels de soin':      '🌿',
  'Gua Sha & massage':    '🤲',
  'Head Spa':             '💆',
  'Cosmétique naturelle': '🧴',
  'Peau & saisons':       '☀️',
  'Bien-être':            '🕯️',
};
