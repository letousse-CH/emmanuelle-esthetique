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
 * Catégories génériques du template. Elles servent de filtres au hub SEO ;
 * adaptez-les au métier du site, en gardant les trois tables ci-dessous
 * alignées sur le type SeoCategory.
 */

export type SeoCategory =
  | 'Prestations'   // Ce que vous vendez : pages et articles de service
  | 'Conseils'      // Savoir-faire, méthode, pédagogie
  | 'Coulisses'     // Métier, équipe, façon de travailler
  | 'Actualité'     // Nouveautés, saisonnalité, événements
  | 'Local'         // Ville, région, zone d'intervention
  | 'Questions';    // Réponses aux questions fréquentes des clients

export type Difficulty = 'faible' | 'moyen' | 'élevé';
export type Volume     = 'faible' | 'moyen' | 'élevé';
export type Intent     = 'informationnel' | 'transactionnel' | 'navigationnel';
export type FunnelLevel = 'découverte' | 'comparaison' | 'conversion';

export interface SeoIdea {
  id: string;
  category: SeoCategory;
  keyword: string;           // Requête exacte que les gens tapent
  question: string;          // Reformulation question
  difficulty: Difficulty;    // Difficulté SEO estimée
  volume: Volume;            // Volume de recherche estimé
  intent: Intent;
  funnel_level?: FunnelLevel;// Niveau d'entonnoir (découverte, comparaison, conversion)
  suggestedTitle: string;    // Titre H1 recommandé (mot-clé dans les 4 premiers mots)
  suggestedSlug: string;     // URL optimisée
  suggestedIntro: string;    // Accroche d'introduction suggérée
  relatedQuestions: string[];// "People Also Ask" de Google
  aiPrompts?: string[];      // Prompts types posés aux IA (ChatGPT, Perplexity...)
  communityQuestions?: string[]; // Questions posées sur Reddit & Forums
  geoCitationTips?: string[];    // Conseils de structuration GEO pour être cité par les moteurs IA
  rel_bridge?: string;       // Pont commercial vers les offres et services de la marque
  secondaryKeywords?: string[];// Cluster sémantique — variations et termes associés
  contentTips: string[];     // Conseils de rédaction
  cta: string;               // CTA de fin d'article
  opportunity: string;       // Pourquoi cette requête est intéressante
}

/** Idées pré-enregistrées. Vide par défaut — à alimenter depuis /admin/seo. */
export const seoIdeas: SeoIdea[] = [];

export const CATEGORIES: SeoCategory[] = [
  'Prestations',
  'Conseils',
  'Coulisses',
  'Actualité',
  'Local',
  'Questions',];

export const CATEGORY_COLORS: Record<SeoCategory, string> = {
  'Prestations':  'bg-sky-50 text-sky-700 border-sky-200',
  'Conseils':     'bg-teal-50 text-teal-700 border-teal-200',
  'Coulisses':    'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Actualité':    'bg-amber-50 text-amber-700 border-amber-200',
  'Local':        'bg-lime-50 text-lime-700 border-lime-200',
  'Questions':    'bg-stone-50 text-stone-700 border-stone-200',
};

/**
 * Icône de chaque catégorie.
 *
 * ⚠️ Cette table s'appelait `CATEGORY_EMOJIS` et contenait, par copier-coller,
 * les **valeurs de `CATEGORY_COLORS`**. Les pastilles de filtre affichaient
 * donc « bg-sky-50 text-sky-700 border-sky-200 Prestations » au lieu du nom de
 * la catégorie. On nomme ici des icônes plutôt que des émojis : le reste du
 * back-office en utilise déjà, et une icône se lit à toutes les tailles.
 */
export type CategoryIcon =
  | 'sparkles' | 'lightbulb' | 'users' | 'calendar' | 'map-pin' | 'help-circle';

export const CATEGORY_ICONS: Record<SeoCategory, CategoryIcon> = {
  'Prestations':  'sparkles',
  'Conseils':     'lightbulb',
  'Coulisses':    'users',
  'Actualité':    'calendar',
  'Local':        'map-pin',
  'Questions':    'help-circle',
};

/** Ce que recouvre chaque catégorie, affiché en aide dans le hub SEO. */
export const CATEGORY_HINTS: Record<SeoCategory, string> = {
  'Prestations': 'Ce que vous vendez : pages et articles de service.',
  'Conseils':    'Votre savoir-faire, expliqué : méthode, pédagogie.',
  'Coulisses':   'Le métier, l’équipe, votre façon de travailler.',
  'Actualité':   'Nouveautés, saisonnalité, événements.',
  'Local':       'Votre ville, votre région, votre zone d’intervention.',
  'Questions':   'Les questions que vos clients posent vraiment.',
};
