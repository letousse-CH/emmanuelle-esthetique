import type { SectionType } from './wireframes.config';

/**
 * Catalogue des sections, rangé par intention.
 *
 * Une liste plate de trente-trois sections est inutilisable : personne ne
 * parcourt trente-trois vignettes pour trouver un bouton d'appel à l'action.
 * Le classement se fait donc par **ce qu'on cherche à obtenir** — ouvrir une
 * page, convaincre, rassurer, faire agir — et non par forme technique.
 *
 * Les mots-clés alimentent la recherche : ils couvrent les synonymes qu'un
 * utilisateur tapera spontanément (« prix » pour la tarification, « avis »
 * pour les témoignages).
 */

export interface CatalogCategory {
  id: string;
  label: string;
  hint: string;
  types: (SectionType | string)[];
}

export const SECTION_CATALOG: CatalogCategory[] = [
  {
    id: 'ouverture',
    label: 'Ouverture',
    hint: 'Le premier écran, celui qui décide si on reste',
    types: ['hero_turnkey_voice', 'hero_1', 'hero_2', 'hero_3', 'hero_4', 'hero_5', 'hero_split_badge', 'hero_video', 'banner_1'],
  },
  {
    id: 'contenu',
    label: 'Contenu & Blog',
    hint: 'Expliquer, raconter, développer et afficher vos articles',
    types: ['intro_1', 'text_1', 'text_image_1', 'blog_grid_1', 'voice_showcase_1'],
  },
  {
    id: 'offre',
    label: 'Offre',
    hint: 'Ce que vous proposez, et comment ça se passe',
    types: ['turnkey_bento_grid', 'client_needs_matrix', 'turnkey_steps_1', 'admin_mockups_gallery', 'features_1', 'features_2', 'features_3', 'features_grid_offset', 'bento_grid_1', 'steps_1', 'timeline_1'],
  },
  {
    id: 'preuve',
    label: 'Preuve',
    hint: 'Ce qui lève le doute : avis, chiffres, références',
    types: ['turnkey_testimonials_1', 'testimonial_1', 'testimonial_2', 'reviews_1', 'stats_1', 'stats_2', 'stats_3', 'logos_1'],
  },
  {
    id: 'conversion',
    label: 'Conversion',
    hint: "Prix, comparaison, appel à l'action",
    types: ['turnkey_offer_pricing', 'pricing_1', 'pricing_2', 'pricing_cards_modern', 'compare_1', 'newsletter_1', 'cta_1', 'cta_2', 'cta_3'],
  },
  {
    id: 'visuel',
    label: 'Visuel',
    hint: 'Montrer plutôt que décrire',
    types: ['gallery_grid', 'gallery_carousel', 'gallery_masonry', 'marquee_1'],
  },
  {
    id: 'humain',
    label: 'Humain & contact',
    hint: 'Qui vous êtes, comment vous joindre',
    types: ['team_1', 'contact_1'],
  },
  {
    id: 'questions',
    label: 'Questions',
    hint: 'Répondre avant qu’on demande',
    types: ['turnkey_faq_accordion', 'faq_1', 'faq_2', 'faq_accordion_modern'],
  },
];

/** Synonymes de recherche, par section. */
export const SECTION_KEYWORDS: Record<string, string> = {
  hero_1: 'banniere accueil couverture image plein ecran',
  hero_2: 'banniere accueil centre simple titre',
  hero_3: 'banniere portrait photo arche',
  hero_4: 'banniere editorial photo magazine',
  hero_5: 'bandeau titre de page entete',
  hero_split_badge: 'banniere modern hero split badge tailwind ui',
  banner_1: 'annonce promotion alerte information ruban',
  intro_1: 'introduction citation presentation',
  text_1: 'paragraphe article redaction contenu libre',
  text_image_1: 'texte image cote a cote illustration',
  features_1: 'points cles liste avantages benefices',
  features_2: 'atouts cartes grille trois colonnes',
  features_3: 'offres formules comparees prestations',
  features_grid_offset: 'atouts grille 2x2 puces icones tailwind ui',
  steps_1: 'etapes processus methode deroulement numerote',
  timeline_1: 'chronologie parcours histoire etapes',
  testimonial_1: 'temoignage avis citation client',
  testimonial_2: 'temoignages avis clients grille trois',
  reviews_1: 'avis notes etoiles clients google',
  stats_1: 'chiffres statistiques resultats nombres',
  stats_2: 'chiffres bandeau compteurs resultats',
  logos_1: 'logos references partenaires marques confiance',
  pricing_1: 'prix tarif abonnement forfait offre',
  pricing_2: 'prix tarif cartes abonnement',
  pricing_cards_modern: 'prix tarif 3 tiers populaire tailwind ui',
  compare_1: 'comparatif tableau avant apres concurrence',
  cta_1: 'appel action bouton contact conversion',
  cta_2: 'appel action bandeau bouton conversion',
  cta_3: 'appel action discret ligne bouton',
  gallery_grid: 'galerie photos images grille portfolio',
  gallery_carousel: 'galerie carrousel defilement photos',
  gallery_masonry: 'galerie cascade pinterest photos',
  marquee_1: 'bandeau defilant texte animation ruban',
  team_1: 'equipe collaborateurs portraits personnes',
  contact_1: 'contact adresse telephone email horaires coordonnees',
  faq_1: 'questions reponses faq accordeon',
  faq_2: 'questions reponses faq colonnes',
  faq_accordion_modern: 'questions reponses faq accordeon moderne tailwind ui',
};

/** Retire accents et casse — pour que « télephone » trouve « téléphone ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function searchSections(
  query: string,
  labels: Record<string, string>,
): (SectionType | string)[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const all = SECTION_CATALOG.flatMap((c) => c.types);
  return all.filter((type) => {
    const haystack = `${normalize(labels[type] ?? '')} ${SECTION_KEYWORDS[type] ?? ''} ${type}`;
    return haystack.includes(q);
  });
}

/** Catégorie d'une section — sert à l'afficher en légende dans les résultats. */
export function categoryOf(type: string): CatalogCategory | undefined {
  return SECTION_CATALOG.find((c) => c.types.includes(type));
}
