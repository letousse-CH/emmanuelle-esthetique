/**
 * Couleur d'une catégorie de prestations : un repère pour l'œil, pas une
 * information (le nom de la catégorie est toujours écrit à côté). La même
 * catégorie a la même couleur à l'écran d'encaissement et dans le catalogue.
 * Une seule famille de tons, distincts deux à deux ; l'ordre suit celui des catégories.
 */
// Tirées de la palette de l'admin : marine, safran, lagon, sauge, sable, ardoise, bleu nuit, terre.
export const CATEGORY_COLORS = ['#4F6B89', '#DD9030', '#2E8676', '#8A9A7B', '#B79E78', '#7D8896', '#2B4764', '#A97C5E'];

/** Couleur des produits de revente (hors catégories de soins). */
export const PRODUCT_COLOR = '#78716C';

/** Catégorie inconnue ou absente (« Divers »). */
export const ORPHAN_COLOR = '#A8A29E';

export function categoryColor(categories: { id: string }[], id: string | null | undefined): string {
  const i = categories.findIndex((c) => c.id === id);
  return i >= 0 ? CATEGORY_COLORS[i % CATEGORY_COLORS.length] : ORPHAN_COLOR;
}
