/**
 * Page builder v2 — modèle de données.
 *
 * Repris du builder de MatthieuLeTousse-Therapeute (sections > colonnes >
 * blocs, imbrication limitée à un niveau), avec des couleurs sémantiques
 * résolues depuis la charte du site (voir blocks.css) au lieu de teintes
 * écrites en dur. Tout nouveau type de bloc se déclare ici puis dans
 * blockMeta.ts (formulaire, bibliothèque, IA) et BlockRenderer.tsx (rendu).
 */

export type SectionLayout =
  | '1-col'
  | '2-col-equal'
  | '2-col-40-60'
  | '2-col-60-40'
  | '3-col-equal'
  | 'full-width';

export type VerticalPadding = 'none' | 'small' | 'medium' | 'large';
export type InnerPadding = 'none' | 'medium' | 'large';
export type SectionWidth = 'narrow' | 'contained' | 'wide' | 'full';
export type SectionAnimation = 'none' | 'fade' | 'rise';

/** Fonds proposés : uniquement des teintes de la charte. */
export type SectionBackground =
  | 'transparent' // fond du site
  | 'surface'     // gris écume
  | 'warm'        // crème
  | 'warm-strong' // sable
  | 'accent'      // lagon (pleine teinte)
  | 'dark';       // nuit (couleur primaire)

export type TextTone = 'auto' | 'light' | 'dark';
export type Align = 'left' | 'center' | 'right';

// ─── Blocs ────────────────────────────────────────────────────────────────────

export interface HeadingBlock { id: string; type: 'heading'; eyebrow?: string; text: string; level: 1 | 2 | 3; align?: Align; lead?: string }
export interface TextBlock { id: string; type: 'text'; html: string; align?: Align | 'justify' }
export interface ImageBlock {
  id: string; type: 'image'; url: string; alt: string; caption?: string;
  ratio?: 'auto' | '16/9' | '4/3' | '1/1' | '3/4' | '4/5';
  fit?: 'cover' | 'contain';
  size?: 'small' | 'medium' | 'large' | 'full';
  align?: Align;
  /** Remplit toute la hauteur de la colonne, bords à vif (photo d'ambiance). */
  fill?: boolean;
}
export interface ButtonBlock { id: string; type: 'button'; text: string; url: string; variant: 'primary' | 'secondary' | 'link'; align?: Align; newTab?: boolean; secondaryText?: string; secondaryUrl?: string }
export interface QuoteBlock { id: string; type: 'quote'; quote: string; author?: string; role?: string; align?: Align }
export interface VideoBlock { id: string; type: 'video'; url: string; caption?: string }
export interface SpacerBlock { id: string; type: 'spacer'; height: 'small' | 'medium' | 'large' }
export interface DividerBlock { id: string; type: 'divider'; style?: 'line' | 'short' }

export interface HeroBlock {
  id: string; type: 'hero'; eyebrow?: string; title: string; text?: string;
  ctaText?: string; ctaUrl?: string; secondaryText?: string; secondaryUrl?: string;
  align?: 'left' | 'center'; size?: 'medium' | 'large';
}

export interface CardItem { id: string; image?: string; title?: string; text: string; linkText?: string; linkUrl?: string }
export interface CardsBlock { id: string; type: 'cards'; eyebrow?: string; title?: string; intro?: string; cols: 2 | 3 | 4; style?: 'plain' | 'tinted' | 'outlined'; imagePosition?: 'top' | 'left'; layout?: 'grid' | 'carousel'; items: CardItem[] }

export interface FaqItem { id: string; question: string; answer: string }
export interface FaqBlock { id: string; type: 'faq'; eyebrow?: string; title?: string; intro?: string; items: FaqItem[] }

export interface StepItem { id: string; title: string; text: string }
export interface StepsBlock { id: string; type: 'steps'; eyebrow?: string; title?: string; intro?: string; items: StepItem[] }

export interface OfferItem {
  id: string; name: string; badge?: string; price: string; priceNote?: string;
  description?: string; bullets?: string[]; ctaText?: string; ctaUrl?: string; highlight?: boolean;
}
export interface OffersBlock { id: string; type: 'offers'; eyebrow?: string; title?: string; intro?: string; offers: OfferItem[]; footnote?: string }

export interface PriceItem { id: string; name: string; duration?: string; price: string; description?: string }
/** Liste de tarifs compacte (une ligne par prestation) — la « carte » d'un institut. */
export interface PriceListBlock {
  id: string; type: 'pricelist'; eyebrow?: string; title?: string; intro?: string; level?: 2 | 3;
  items: PriceItem[]; footnote?: string; linkText?: string; linkUrl?: string;
}

export interface ChecklistBlock { id: string; type: 'checklist'; title?: string; items: string[] }
export interface CalloutBlock { id: string; type: 'callout'; eyebrow?: string; title: string; text?: string; ctaText?: string; ctaUrl?: string }
export interface StatItem { id: string; value: string; label: string }
export interface StatsBlock { id: string; type: 'stats'; eyebrow?: string; title?: string; items: StatItem[] }
export interface TestimonialItem { id: string; quote: string; author: string; role?: string }
export interface TestimonialsBlock { id: string; type: 'testimonials'; title?: string; items: TestimonialItem[] }
export interface GalleryImage { id: string; url: string; alt: string; caption?: string }
export interface GalleryBlock { id: string; type: 'gallery'; title?: string; variant: 'grid' | 'carousel' | 'masonry'; cols?: 2 | 3 | 4; images: GalleryImage[] }
export interface MarqueeBlock { id: string; type: 'marquee'; items: string[]; separator?: string; speed?: 'slow' | 'normal' | 'fast'; italic?: boolean }
export interface ContactBlock { id: string; type: 'contact'; title?: string; text?: string; address?: string; phone?: string; email?: string; hours?: string }
/** Formulaire de contact du site (envoi par e-mail via /api/contact). */
export interface ContactFormBlock { id: string; type: 'contact_form' }
export interface GoogleReviewsBlock { id: string; type: 'google_reviews'; title?: string; max?: number }
/**
 * Offre du moment : le contenu (image, titre, prix, dates, places) vient de
 * l'admin « Offre du moment » (table `monthly_offers`), jamais du bloc. Le bloc
 * ne règle que le cadre. Sans offre en cours, il ne rend rien — et la section
 * qui ne contient que lui disparaît du site.
 */
export interface CurrentOfferBlock {
  id: string; type: 'current_offer';
  eyebrow?: string; ctaText?: string;
  showConditions?: boolean; showPlaces?: boolean;
  imagePosition?: 'left' | 'right';
}

/**
 * Section Studio conservée telle quelle (conversion sans perte, ou section
 * fonctionnelle déjà existante : derniers articles, newsletter…). Rendue par
 * son composant d'origine.
 */
export interface LegacySectionBlock { id: string; type: 'legacy_section'; section: { type: string; data: Record<string, unknown> } }

export type ContentBlock =
  | HeadingBlock | TextBlock | ImageBlock | ButtonBlock | QuoteBlock | VideoBlock
  | SpacerBlock | DividerBlock | HeroBlock | CardsBlock | FaqBlock | StepsBlock
  | OffersBlock | PriceListBlock | ChecklistBlock | CalloutBlock | StatsBlock | TestimonialsBlock
  | GalleryBlock | MarqueeBlock | ContactBlock | ContactFormBlock | GoogleReviewsBlock | CurrentOfferBlock
  | LegacySectionBlock;

export type BlockType = ContentBlock['type'];

// ─── Structure ────────────────────────────────────────────────────────────────

export interface ContentColumn {
  id: string;
  blocks: ContentBlock[];
  background?: SectionBackground;
  textTone?: TextTone;
}

export interface SectionBgImage { url: string; opacity?: number; position?: string }

export interface ContentSection {
  id: string;
  layout: SectionLayout;
  paddingY: VerticalPadding;
  /** Marge intérieure autour de la grille : aucune, +40px (medium) ou +80px (large). */
  innerPad?: InnerPadding;
  width?: SectionWidth;
  background?: SectionBackground;
  textTone?: TextTone;
  alignItems?: 'top' | 'center' | 'bottom';
  bgImage?: SectionBgImage;
  minHeight?: 'auto' | 'half' | 'screen';
  animation?: SectionAnimation;
  /** Colonnes collées (pas d'espace) — pour une photo bord à bord. */
  flush?: boolean;
  /** Ordre inversé sur mobile (ex. image à droite qui doit passer au-dessus). */
  reverseOnMobile?: boolean;
  columns: ContentColumn[];
}

export type ContentStructure = ContentSection[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getColumnCount(layout: SectionLayout): number {
  switch (layout) {
    case '2-col-equal':
    case '2-col-40-60':
    case '2-col-60-40':
      return 2;
    case '3-col-equal':
      return 3;
    default:
      return 1;
  }
}

export function createSection(layout: SectionLayout = '1-col', initialBlocks?: ContentBlock[]): ContentSection {
  const count = getColumnCount(layout);
  return {
    id: uid(),
    layout,
    paddingY: 'medium',
    background: 'transparent',
    columns: Array.from({ length: count }, (_, i) => ({
      id: uid(),
      blocks: i === 0 && initialBlocks ? initialBlocks : [],
    })),
  };
}

/** Change le gabarit d'une section sans perdre de blocs (les colonnes en trop sont fusionnées dans la dernière). */
export function changeLayout(section: ContentSection, layout: SectionLayout): ContentSection {
  const count = getColumnCount(layout);
  const cols = section.columns.slice(0, count).map((c) => ({ ...c, blocks: [...c.blocks] }));
  while (cols.length < count) cols.push({ id: uid(), blocks: [] });
  const overflow = section.columns.slice(count).flatMap((c) => c.blocks);
  if (overflow.length) cols[cols.length - 1].blocks.push(...overflow);
  return { ...section, layout, columns: cols };
}

/** Copie profonde avec de nouveaux identifiants (dupliquer une section ou un bloc). */
export function cloneWithNewIds<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value));
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.id === 'string') obj.id = uid();
      // Les données d'une section Studio encapsulée ne portent pas d'id à régénérer.
      if (obj.type === 'legacy_section') return;
      Object.values(obj).forEach(walk);
    }
  };
  walk(copy);
  return copy;
}

export function isContentStructure(raw: unknown): raw is ContentStructure {
  return Array.isArray(raw) && raw.every((s) => s && typeof s === 'object' && Array.isArray((s as ContentSection).columns));
}
