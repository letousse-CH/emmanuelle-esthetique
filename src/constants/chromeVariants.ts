/**
 * Modèles d'en-tête et de pied de page.
 *
 * Le site n'avait qu'une barre de menu et qu'un pied de page possibles : logo à
 * gauche, liens à droite, bouton d'action ; pied en trois colonnes avec image
 * d'ambiance. C'est un parti pris parmi d'autres, et il ne convient pas à tous
 * les métiers — une carte de visite en ligne n'a pas besoin de trois colonnes,
 * un site de contenu veut ses liens groupés par thème.
 *
 * Les modèles se choisissent depuis /admin/entete-pied. Chaque variante décrit
 * ce qu'elle change, pour qu'on n'ait pas à les essayer une par une.
 */

export type HeaderVariant = 'classique' | 'centre' | 'minimal' | 'plein';
export type FooterVariant = 'complet' | 'colonnes' | 'simple';

export interface ChromeVariantSpec<T extends string> {
  id: T;
  label: string;
  description: string;
  /** Ce à quoi la variante convient, en une phrase. */
  fits: string;
}

export const HEADER_VARIANTS: ChromeVariantSpec<HeaderVariant>[] = [
  {
    id: 'classique',
    label: 'Classique',
    description: 'Logo à gauche, liens à droite, bouton d’action au bout.',
    fits: 'Le choix par défaut. Va à peu près partout.',
  },
  {
    id: 'centre',
    label: 'Logo centré',
    description: 'Logo au milieu, liens répartis de part et d’autre.',
    fits: 'Marques de goût, boutiques, métiers de bouche.',
  },
  {
    id: 'minimal',
    label: 'Épuré',
    description: 'Logo seul et un menu qui s’ouvre, à tous les formats d’écran.',
    fits: 'Sites courts, portfolios, pages d’atterrissage.',
  },
  {
    id: 'plein',
    label: 'Bandeau plein',
    description: 'Barre opaque dès le chargement, posée sur toute la largeur.',
    fits: 'Quand la première section est claire et que la barre transparente disparaît.',
  },
];

export const FOOTER_VARIANTS: ChromeVariantSpec<FooterVariant>[] = [
  {
    id: 'complet',
    label: 'Complet',
    description: 'Visuel d’ambiance, accroche, réseaux, navigation et coordonnées.',
    fits: 'Sites riches, avec beaucoup de pages à donner à voir.',
  },
  {
    id: 'colonnes',
    label: 'Colonnes',
    description: 'Navigation et coordonnées côte à côte, sans visuel.',
    fits: 'Sobre et dense — services, cabinets, formation.',
  },
  {
    id: 'simple',
    label: 'Une ligne',
    description: 'Nom, liens légaux et réseaux sur une seule bande.',
    fits: 'Carte de visite en ligne, page unique.',
  },
];
