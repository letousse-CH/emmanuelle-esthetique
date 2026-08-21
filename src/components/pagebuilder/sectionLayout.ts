import type { Variants } from 'motion/react';

/**
 * Réglages de mise en forme communs à toutes les sections.
 *
 * Ils vivent dans `SectionWrapper`, donc une seule implémentation les rend
 * disponibles sur les trente-trois sections d'un coup — bien plus sûr que
 * d'ajouter les mêmes options à trente-trois composants.
 *
 * Toutes les valeurs viennent d'échelles fermées. C'est délibéré : un champ
 * libre en pixels laisserait produire une page cassée sur téléphone, ce que le
 * constructeur doit rendre impossible.
 */

export type Density = 'none' | 'compact' | 'normal' | 'airy';
export type Width = 'narrow' | 'contained' | 'wide' | 'full';
export type Align = 'left' | 'center';

export interface SectionLayout {
  density?: Density;
  width?: Width;
  align?: Align;
  animation?: Animation;
  theme?: Theme;
  bg_pattern?: SectionPattern;
  bg_pattern_scale?: SectionPatternScale;
  bg_pattern_repeat?: SectionPatternRepeat;
  bg_pattern_opacity?: number;
}

export type Animation = 'none' | 'fade' | 'rise' | 'stagger';
export type Theme = 'light' | 'dark' | 'surface' | 'primary';
export type SectionPattern = 'none' | 'dots' | 'grid' | 'blueprint' | 'waves' | 'topography' | 'diagonal' | 'hexagons' | 'crosses';
export type SectionPatternScale = 'small' | 'normal' | 'large' | 'xlarge';
export type SectionPatternRepeat = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

export const SECTION_PATTERN_OPTIONS: { value: SectionPattern; label: string; hint: string }[] = [
  { value: 'none', label: 'Aucun', hint: 'Fond uni.' },
  { value: 'dots', label: 'Points', hint: 'Grille de points.' },
  { value: 'grid', label: 'Grille', hint: 'Quadrillage moderne.' },
  { value: 'blueprint', label: 'Millimétré', hint: 'Grille d’architecte.' },
  { value: 'waves', label: 'Vagues', hint: 'Ondes fluides.' },
  { value: 'topography', label: 'Topo', hint: 'Lignes de relief.' },
  { value: 'diagonal', label: 'Diagonales', hint: 'Hachures élégantes.' },
  { value: 'hexagons', label: 'Hexagones', hint: 'Maillage alvéolé.' },
  { value: 'crosses', label: 'Croisillons', hint: 'Motif en croix.' },
];

export const SECTION_PATTERN_SCALE_OPTIONS: { value: SectionPatternScale; label: string }[] = [
  { value: 'small', label: 'Petit (20px)' },
  { value: 'normal', label: 'Moyen (40px)' },
  { value: 'large', label: 'Grand (80px)' },
  { value: 'xlarge', label: 'Très grand (120px)' },
];

export const SECTION_PATTERN_REPEAT_OPTIONS: { value: SectionPatternRepeat; label: string }[] = [
  { value: 'repeat', label: 'Répéter (Tapis)' },
  { value: 'repeat-x', label: 'Répéter H (Horizontal)' },
  { value: 'repeat-y', label: 'Répéter V (Vertical)' },
  { value: 'no-repeat', label: 'Unique (Centre)' },
];

/**
 * Variante d'un bouton de section.
 *
 * Le réglage s'appelait « Couleur du bouton » et proposait « Vert » ou
 * « Blanc » : les deux teintes du site d'origine, écrites en dur. Il ne voulait
 * plus rien dire dès qu'un client choisissait sa propre palette. On raisonne
 * désormais en **rôle** — principal, secondaire, discret — et ce sont les
 * jetons de « Design & Style » qui décident de la couleur.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export const BUTTON_VARIANT_OPTIONS: { value: ButtonVariant; label: string; hint: string }[] = [
  { value: 'primary', label: 'Principal', hint: "L'action que vous voulez voir cliquée." },
  { value: 'secondary', label: 'Secondaire', hint: 'Action de repli, en contour.' },
  { value: 'ghost', label: 'Discret', hint: 'Sans fond ni bordure.' },
];

/**
 * Lit l'ancien réglage aussi bien que le nouveau.
 *
 * Les pages déjà enregistrées portent `green` ou `white` : elles doivent
 * continuer à s'afficher comme avant, sans migration de base.
 */
export function buttonVariantOf(value: unknown): ButtonVariant {
  if (value === 'secondary' || value === 'white') return 'secondary';
  if (value === 'ghost') return 'ghost';
  return 'primary';
}

const FONT_SIZE_MAP: Record<string, string> = {
  'text-xs': '0.75rem',
  'text-sm': '0.875rem',
  'text-base': '1rem',
  'text-lg': '1.125rem',
  'text-xl': '1.25rem',
  'text-2xl': '1.5rem',
  'text-3xl': '1.875rem',
  'text-4xl': '2.25rem',
  'text-5xl': '3rem',
  'text-6xl': '3.75rem',
  'text-7xl': '4.5rem',
};

const SIZE_CLASS_REGEX = /(?:^|\s)(?:(?:sm|md|lg|xl|2xl):)?text-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g;

/**
 * Retourne la classe de taille de police pour un titre de section en remplaçant les classes de taille par défaut.
 */
export function getTitleFontClass(data: any, fallback: string): string {
  const custom = data?.title_size || data?.title_font_size;
  if (custom && typeof custom === 'string' && custom.trim().length > 0) {
    return `${fallback.replace(SIZE_CLASS_REGEX, '')} ${custom}`.trim();
  }
  return fallback;
}

/**
 * Retourne la classe de taille de police pour un contenu/description de section.
 */
export function getContentFontClass(data: any, fallback: string): string {
  const custom = data?.content_size || data?.content_font_size;
  if (custom && typeof custom === 'string' && custom.trim().length > 0) {
    return `${fallback.replace(SIZE_CLASS_REGEX, '')} ${custom}`.trim();
  }
  return fallback;
}

/**
 * Style inline pour forcer la taille du titre en priorité sur le CSS global.
 */
export function getTitleFontStyle(data: any): React.CSSProperties | undefined {
  const custom = data?.title_size || data?.title_font_size;
  if (custom && typeof custom === 'string' && custom.trim()) {
    const val = custom.trim();
    const pxRem = FONT_SIZE_MAP[val] || (val.includes('rem') || val.includes('px') ? val : undefined);
    if (pxRem) return { fontSize: pxRem };
  }
  return undefined;
}

/**
 * Style inline pour forcer la taille du texte en priorité sur le CSS global.
 */
export function getContentFontStyle(data: any): React.CSSProperties | undefined {
  const custom = data?.content_size || data?.content_font_size;
  if (custom && typeof custom === 'string' && custom.trim()) {
    const val = custom.trim();
    const pxRem = FONT_SIZE_MAP[val] || (val.includes('rem') || val.includes('px') ? val : undefined);
    if (pxRem) return { fontSize: pxRem };
  }
  return undefined;
}

/**
 * Espacement vertical. Chaque cran double presque le précédent : un écart plus
 * fin serait invisible, et l'utilisateur croirait le réglage cassé.
 *
 * `none` retire tout l'espace — dans les deux sens — pour coller deux sections
 * l'une contre l'autre ou poser une bande pleine largeur.
 */
export const DENSITY_CLASS: Record<Density, string> = {
  none: 'py-0 px-0',
  compact: 'py-10 md:py-14',
  normal: 'py-20 md:py-28',
  airy: 'py-32 md:py-44',
};

/** Largeur du contenu. `full` sert aux galeries et aux bandeaux. */
export const WIDTH_CLASS: Record<Width, string> = {
  narrow: 'max-w-3xl mx-auto',
  contained: 'max-w-5xl mx-auto',
  wide: 'max-w-7xl mx-auto',
  full: 'max-w-none',
};

export const ALIGN_CLASS: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
};

/** Libellés affichés dans l'éditeur — en français, sans jargon. */
export const LAYOUT_OPTIONS = {
  theme: [
    { value: 'light', label: 'Clair (Fond site)' },
    { value: 'dark', label: 'Foncé (Sombre site)' },
    { value: 'surface', label: 'Surface (Blocs)' },
    { value: 'primary', label: 'Primaire (Accent)' },
  ],
  density: [
    { value: 'none', label: 'Aucun' },
    { value: 'compact', label: 'Serré' },
    { value: 'normal', label: 'Normal' },
    { value: 'airy', label: 'Aéré' },
  ],
  width: [
    { value: 'narrow', label: 'Étroit' },
    { value: 'contained', label: 'Standard' },
    { value: 'wide', label: 'Large' },
    { value: 'full', label: 'Pleine largeur' },
  ],
  align: [
    { value: 'left', label: 'À gauche' },
    { value: 'center', label: 'Centré' },
  ],
  animation: [
    { value: 'none', label: 'Aucune' },
    { value: 'fade', label: 'Apparition' },
    { value: 'rise', label: 'Montée' },
    { value: 'stagger', label: 'En cascade' },
  ],
  title_size: [
    { value: '', label: 'Défaut' },
    { value: 'text-2xl', label: 'Moyen' },
    { value: 'text-3xl', label: 'Grand' },
    { value: 'text-4xl', label: 'Très Grand' },
    { value: 'text-5xl', label: 'Énorme' },
    { value: 'text-6xl', label: 'Gigantesque' },
  ],
  content_size: [
    { value: '', label: 'Défaut' },
    { value: 'text-xs', label: 'Très Petit' },
    { value: 'text-sm', label: 'Petit' },
    { value: 'text-base', label: 'Normal' },
    { value: 'text-lg', label: 'Grand' },
    { value: 'text-xl', label: 'Très Grand' },
  ],
  image_side: [
    { value: 'left', label: 'À gauche' },
    { value: 'right', label: 'À droite' },
  ],
} as const;

/** Valeurs appliquées quand la section ne précise rien. */
export const LAYOUT_DEFAULTS: Required<Omit<SectionLayout, 'theme'>> & { theme: Theme } = {
  density: 'normal',
  width: 'wide',
  align: 'left',
  animation: 'rise',
  theme: 'light',
  bg_pattern: 'none',
  bg_pattern_scale: 'normal',
  bg_pattern_repeat: 'repeat',
  bg_pattern_opacity: 12,
};


/**
 * Taille du texte des cartes.
 *
 * Trois tailles courantes en accès rapide, et un champ libre : le besoin
 * « grossir un peu ce bloc-là » ne se laisse pas enfermer dans trois crans.
 * La valeur est une longueur CSS (`rem` de préférence) ; vide = la taille du
 * gabarit de la section.
 *
 * ⚠️ Elle n'est **pas** appliquée par une classe Tailwind : `GlobalStyles`
 * impose l'échelle typographique du site avec `!important`, et une classe de
 * même spécificité ne l'emporte jamais. La règle vit dans `index.css`, sur
 * `[data-cards-size] [data-cards]`.
 */
export const CARD_TEXT_SIZE_PRESETS = [
  { value: '0.875rem', label: 'Petit' },
  { value: '', label: 'Normal' },
  { value: '1.125rem', label: 'Grand' },
] as const;

/** Mêmes crans pour le titre de carte, à son échelle. */
export const CARD_TITLE_SIZE_PRESETS = [
  { value: '1.125rem', label: 'Petit' },
  { value: '', label: 'Normal' },
  { value: '1.75rem', label: 'Grand' },
] as const;

/**
 * Rapport titre de carte / texte de carte.
 *
 * Il était d'abord fixé à 1,45 : à la taille « Petit », le titre ressortait
 * alors **plus gros** qu'à la taille normale — l'inverse de ce qu'on demandait.
 * 1,25 garde une hiérarchie visible tout en restant monotone d'un cran à
 * l'autre.
 */
export const CARD_TITLE_RATIO = 1.25;

// ── Hero plein écran ───────────────────────────────────────────────────────

/**
 * Répartition image / texte du hero plein écran.
 *
 * La proportion était figée à 58 % / 42 %, image à gauche, sans recouvrement.
 * C'est un parti pris parmi d'autres : une image au tiers laisse la place à un
 * titre long, une image à deux tiers porte une photo qui vaut le détour, et le
 * texte qui mord un peu sur l'image donne la mise en page « magazine » qu'on ne
 * pouvait obtenir autrement.
 */
export type HeroImageWidth = 'third' | 'half' | 'twoThirds';

/**
 * Gabarit de colonnes, selon la part de l'image **et le côté où elle se pose**.
 *
 * ⚠️ `order-last` déplace l'élément, pas la largeur de la colonne : avec un seul
 * gabarit, poser l'image à droite lui donnait la largeur prévue pour le texte.
 * Les deux jeux sont donc miroirs l'un de l'autre.
 */
export const HERO_IMAGE_WIDTH_CLASS: Record<HeroImageWidth, string> = {
  third: 'md:grid-cols-[33%_67%]',
  half: 'md:grid-cols-[50%_50%]',
  twoThirds: 'md:grid-cols-[67%_33%]',
};

export const HERO_IMAGE_WIDTH_CLASS_RIGHT: Record<HeroImageWidth, string> = {
  third: 'md:grid-cols-[67%_33%]',
  half: 'md:grid-cols-[50%_50%]',
  twoThirds: 'md:grid-cols-[33%_67%]',
};

export const HERO_IMAGE_WIDTH_OPTIONS = [
  { value: 'third', label: 'Un tiers' },
  { value: 'half', label: 'La moitié' },
  { value: 'twoThirds', label: 'Deux tiers' },
] as const;

export const HERO_IMAGE_SIDE_OPTIONS = [
  { value: 'left', label: 'À gauche' },
  { value: 'right', label: 'À droite' },
] as const;

export const HERO_TEXT_OVERLAP_OPTIONS = [
  { value: 'none', label: 'Côte à côte' },
  { value: 'slight', label: 'Le texte mord un peu' },
  { value: 'over', label: 'Le texte passe dessus' },
] as const;

export type HeroTextOverlap = 'none' | 'slight' | 'over';

/**
 * Largeur du **bloc de texte** du hero — à ne pas confondre avec `image_width`,
 * qui répartit les colonnes de la grille.
 *
 * Quand le texte passe par-dessus l'image, c'est cette largeur qui décide de
 * l'ampleur du recouvrement : le bloc porte le fond opaque, il déborde donc sur
 * la photo à mesure qu'il s'élargit. Les classes gardent `max-w-md` en dessous
 * de `lg`, où les deux colonnes sont empilées et où élargir n'aurait pas de
 * sens — au-delà, la ligne deviendrait trop longue pour être lue.
 */
export type HeroTextWidth = 'narrow' | 'medium' | 'wide' | 'full';

export const HERO_TEXT_WIDTH_CLASS: Record<HeroTextWidth, string> = {
  narrow: 'max-w-md',
  medium: 'max-w-md lg:max-w-lg',
  wide: 'max-w-md lg:max-w-2xl',
  full: 'max-w-md lg:max-w-none',
};

export const HERO_TEXT_WIDTH_OPTIONS = [
  { value: 'narrow', label: 'Étroite' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'wide', label: 'Large' },
  { value: 'full', label: 'Toute la colonne' },
] as const;

/**
 * Typographie fluide du hero.
 *
 * Le titre était calé sur les points de rupture de l'écran (`text-4xl md:… lg:…`),
 * si bien qu'élargir ou rétrécir la colonne ne changeait rien : sur une colonne
 * étroite le titre débordait, sur une colonne large il flottait. Les tailles
 * ci-dessous sont exprimées en `cqw` — un pourcentage de la largeur du **bloc de
 * texte**, déclaré conteneur — donc le texte suit la colonne, à toutes les
 * largeurs d'écran. Les bornes `clamp()` reprennent les anciennes valeurs :
 * le minimum vaut le rendu mobile d'avant, le maximum reste lisible.
 */
export const HERO_FLUID_TITLE = 'clamp(2.25rem, 12.3cqw, 5rem)';
export const HERO_FLUID_DESCRIPTION = 'clamp(1.125rem, 3.9cqw, 1.5rem)';

// ── Animations ─────────────────────────────────────────────────────────────

/**
 * Variantes d'animation, consommées par `motion`.
 *
 * Elles sont distribuées aux sections par `SectionAnimationProvider` : chaque
 * élément animé lit `anim.item` / `anim.container`, si bien que le réglage
 * « Animation » du constructeur pilote réellement l'apparition.
 *
 * `none` renvoie des variantes vides plutôt que `undefined` : les sections
 * gardent leurs attributs `initial="hidden"` / `animate="visible"`, qui ne
 * résolvent alors plus rien. Rien ne bouge, sans branchement conditionnel dans
 * les trente-trois composants.
 *
 * `rise` reprend exactement les valeurs historiques : c'est la valeur par
 * défaut, elle ne doit rien changer à l'existant.
 */
export const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export interface SectionAnimationVariants {
  container: Variants;
  item: Variants;
  /**
   * Vrai quand la section est réglée sur « Aucune animation ».
   *
   * Treize éléments — cartes de grille, vignettes de galerie — portent leur
   * propre `initial` / `transition` en dur, hors des variantes partagées. Une
   * transition posée sur l'élément l'emporte sur celle de `MotionConfig` : ils
   * lisent ce drapeau pour se figer.
   */
  instant: boolean;
}

export function animationVariants(animation: Animation = 'rise'): SectionAnimationVariants {
  switch (animation) {
    case 'none':
      return { container: {}, item: {}, instant: true };
    case 'fade':
      return {
        container: { hidden: {}, visible: { transition: { staggerChildren: 0 } } },
        item: {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.6, ease: EASE } },
        },
        instant: false,
      };
    case 'stagger':
      return {
        container: { hidden: {}, visible: { transition: { staggerChildren: 0.22 } } },
        item: {
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
        },
        instant: false,
      };
    case 'rise':
    default:
      return {
        container: { hidden: {}, visible: { transition: { staggerChildren: 0.11 } } },
        item: {
          hidden: { opacity: 0, y: 28 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
        },
        instant: false,
      };
  }
}
