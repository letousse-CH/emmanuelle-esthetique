/**
 * Conversion des sections de l'ancien constructeur (Studio : `{ type, data }`)
 * vers la structure v2 (sections > colonnes > blocs).
 *
 * Utilisée à la lecture tant qu'une page n'a pas été réenregistrée avec le
 * nouvel éditeur, et par le script de migration. Toute section sans
 * équivalent devient un bloc `legacy_section`, rendu par son composant
 * d'origine : la conversion ne perd jamais de contenu.
 */
import type {
  ContentStructure, ContentSection, ContentBlock, SectionBackground, VerticalPadding,
  SectionWidth, SectionLayout,
} from './types';
import { uid, getColumnCount } from './types';

type D = Record<string, any>;
export interface StudioSection { type: string; data?: D }

export interface ConversionReport {
  converted: Record<string, number>;
  legacy: Record<string, number>;
  warnings: string[];
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Champ texte simple : on retire le balisage, on garde les sauts de ligne. */
function plain(v: unknown): string {
  return str(v)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/** Champ destiné à un bloc texte riche : paragraphes HTML. */
function richHtml(v: unknown): string {
  const s = str(v).trim();
  if (!s) return '';
  if (/<(p|ul|ol|h[1-6]|blockquote)\b/i.test(s)) return s;
  return s
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const KNOWN_BG: Record<string, SectionBackground> = {
  '#12283a': 'dark',
  '#60b9c2': 'accent',
  '#faf7f2': 'warm',
  '#f1eae0': 'warm-strong',
  '#f6f8f9': 'surface',
};

function background(d: D, report?: ConversionReport): SectionBackground {
  const color = str(d.bg_color).trim().toLowerCase();
  if (color && KNOWN_BG[color]) return KNOWN_BG[color];
  if (d.theme === 'dark' || d.theme === 'primary') return 'dark';
  if (d.theme === 'surface') return 'surface';
  if (color && color !== '#ffffff' && color !== '#fff' && color !== 'transparent') {
    report?.warnings.push(`Couleur de fond ${color} sans équivalent dans la charte : remplacée par le fond du site.`);
  }
  return 'transparent';
}

function padding(d: D, fallback: VerticalPadding = 'medium'): VerticalPadding {
  switch (d.density) {
    case 'none': return 'none';
    case 'compact': return 'small';
    case 'airy': return 'large';
    case 'normal': return 'medium';
    default: return fallback;
  }
}

function width(d: D, fallback: SectionWidth = 'wide'): SectionWidth {
  return ['narrow', 'contained', 'wide', 'full'].includes(d.width) ? d.width : fallback;
}

function section(d: D, layout: SectionLayout, columns: ContentBlock[][], extra: Partial<ContentSection> = {}, report?: ConversionReport): ContentSection {
  const count = getColumnCount(layout);
  const cols = Array.from({ length: count }, (_, i) => ({ id: uid(), blocks: columns[i] ?? [] }));
  const s: ContentSection = {
    id: uid(),
    layout,
    paddingY: padding(d),
    width: width(d),
    background: background(d, report),
    alignItems: 'top',
    animation: 'rise',
    columns: cols,
    ...extra,
  };
  if (d.bg_image && !extra.bgImage) {
    s.bgImage = { url: str(d.bg_image), opacity: typeof d.bg_image_opacity === 'number' ? d.bg_image_opacity : 50, position: str(d.bg_image_position) || 'center' };
  }
  return s;
}

function heading(d: D, key = 'title', level: 1 | 2 | 3 = 2, withLead = false): ContentBlock[] {
  const text = plain(d[key]);
  if (!text && !d.eyebrow) return [];
  return [{ id: uid(), type: 'heading', eyebrow: plain(d.eyebrow) || undefined, text, level, lead: withLead ? plain(d.description) || undefined : undefined }];
}

function button(d: D, textKey = 'cta_text', hrefKey = 'cta_href', align?: 'left' | 'center'): ContentBlock[] {
  const text = plain(d[textKey]);
  if (!text) return [];
  const variant = d.button_style === 'secondary' || d.button_style === 'white' ? 'secondary' : 'primary';
  return [{ id: uid(), type: 'button', text, url: str(d[hrefKey]) || '/contact', variant, align }];
}

function image(url: unknown, alt: unknown, extra: Partial<Extract<ContentBlock, { type: 'image' }>> = {}): ContentBlock[] {
  if (!str(url)) return [];
  return [{ id: uid(), type: 'image', url: str(url), alt: plain(alt), ratio: '4/5', fit: 'cover', size: 'full', ...extra }];
}

const stripNumber = (s: string) => s.replace(/^\s*\d+\s*[.)–-]\s*/, '');

// ─── Convertisseurs par type ─────────────────────────────────────────────────

type Converter = (d: D, report: ConversionReport) => ContentSection | null;

const CONVERTERS: Record<string, Converter> = {
  hero_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'hero', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title), text: plain(d.description) || undefined,
    ctaText: plain(d.cta_text) || undefined, ctaUrl: str(d.cta_href) || undefined, align: 'left', size: 'large',
  }]], { minHeight: 'half', alignItems: 'center', bgImage: d.image_url || d.bg_image ? { url: str(d.bg_image || d.image_url), opacity: d.bg_image_opacity ?? 55, position: str(d.bg_image_position) || 'center' } : undefined }, r),

  hero_2: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'hero', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title), text: plain(d.description) || undefined,
    ctaText: plain(d.cta_text) || undefined, ctaUrl: str(d.cta_href) || undefined, align: 'left', size: 'large',
  }]], { minHeight: 'half', alignItems: 'center', paddingY: 'large' }, r),

  hero_split_badge: (d, r) => {
    const img = str(d.image_url || d.image);
    const hero: ContentBlock = {
      id: uid(), type: 'hero', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title), text: plain(d.description) || undefined,
      ctaText: plain(d.primary_cta_text || d.cta_text) || undefined, ctaUrl: str(d.primary_cta_href || d.cta_href) || undefined,
      secondaryText: plain(d.secondary_cta_text) || undefined, secondaryUrl: str(d.secondary_cta_href) || undefined, align: 'left', size: 'large',
    };
    return section(d, img ? '2-col-60-40' : '1-col', [[hero], image(img, d.title, { ratio: '4/5' })], { alignItems: 'center', minHeight: 'half', paddingY: 'large' }, r);
  },

  intro_1: (d, r) => {
    const right = d.image_side === 'right' || d.image_position === 'right';
    const text: ContentBlock[] = [
      ...(d.eyebrow || d.quote ? [{ id: uid(), type: 'heading', eyebrow: plain(d.eyebrow) || undefined, text: plain(d.quote), level: 2 } as ContentBlock] : []),
      { id: uid(), type: 'divider', style: 'short' },
      ...(d.text ? [{ id: uid(), type: 'text', html: richHtml(d.text) } as ContentBlock] : []),
      ...button({ ...d, cta_text: d.cta_text === undefined ? 'En savoir plus' : d.cta_text }),
    ];
    const img = image(d.image_url, d.image_alt || d.quote, { fill: true });
    if (!img.length) return section(d, '1-col', [text], { width: 'narrow' }, r);
    return section(d, '2-col-equal', right ? [text, img] : [img, text], {
      flush: true, paddingY: 'none', width: 'full', alignItems: 'center', reverseOnMobile: right,
    }, r);
  },

  text_1: (d, r) => section(d, '1-col', [[...heading(d), { id: uid(), type: 'text', html: richHtml(d.content) }]], { width: width(d, 'narrow') }, r),

  text_image_1: (d, r) => {
    const right = d.image_position === 'right';
    const narrowImg = d.ratio === 'third' || d.ratio === 'quarter';
    const layout: SectionLayout = !narrowImg ? '2-col-equal' : right ? '2-col-60-40' : '2-col-40-60';
    const text: ContentBlock[] = [
      ...heading(d),
      ...(d.content ? [{ id: uid(), type: 'text', html: richHtml(d.content) } as ContentBlock] : []),
      ...button(d),
    ];
    const img = image(d.image_url, d.image_alt || d.title);
    if (!img.length) return section(d, '1-col', [text], { width: 'contained' }, r);
    return section(d, layout, right ? [text, img] : [img, text], { alignItems: 'center', reverseOnMobile: right }, r);
  },

  features_2: (d, r) => {
    const cards = Array.isArray(d.cards) ? d.cards : [];
    const blocks: ContentBlock[] = [{
      id: uid(), type: 'cards', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
      cols: cards.length === 2 || cards.length === 4 ? 2 : 3, style: 'tinted',
      items: cards.map((c: D) => ({
        id: uid(), title: plain(c.title) || undefined, text: plain(c.description), image: str(c.icon_image || c.image) || undefined,
        linkText: plain(c.link_text) || undefined, linkUrl: str(c.link_href) || undefined,
      })),
    }];
    if (d.content) blocks.push({ id: uid(), type: 'text', html: richHtml(d.content) });
    return section(d, '1-col', [blocks], {}, r);
  },

  features_grid_offset: (d, r) => {
    const items = Array.isArray(d.items) ? d.items : Array.isArray(d.cards) ? d.cards : [];
    return section(d, '1-col', [[{
      id: uid(), type: 'cards', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
      cols: 2, style: 'tinted',
      items: items.map((c: D) => ({ id: uid(), title: plain(c.title) || undefined, text: plain(c.description) })),
    }]], {}, r);
  },

  steps_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'steps', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
    items: (Array.isArray(d.cards) ? d.cards : []).map((c: D) => ({ id: uid(), title: stripNumber(plain(c.title)), text: plain(c.description) })),
  }]], {}, r),

  stats_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'stats', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined,
    items: (Array.isArray(d.cards) ? d.cards : []).map((c: D) => ({ id: uid(), value: plain(c.value), label: plain(c.label) })),
  }]], {}, r),

  pricing_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'offers', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
    offers: [{
      id: uid(), name: '', badge: plain(d.badge) || undefined, price: plain(d.price), priceNote: plain(d.price_note) || undefined,
      bullets: (Array.isArray(d.items) ? d.items : []).map(plain), ctaText: plain(d.cta_text) || undefined, ctaUrl: str(d.cta_href) || '/contact',
    }],
    footnote: plain(d.footnote) || undefined,
  }]], { width: 'contained' }, r),

  pricing_cards_modern: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'offers', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
    offers: (Array.isArray(d.tiers) ? d.tiers : Array.isArray(d.plans) ? d.plans : []).map((t: D) => ({
      id: uid(), name: plain(t.name), price: plain(t.price), priceNote: plain(t.period) || undefined, description: plain(t.description) || undefined,
      bullets: (Array.isArray(t.features) ? t.features : []).map(plain), ctaText: plain(t.cta_text) || undefined, ctaUrl: str(t.cta_href) || '/contact',
      highlight: !!t.popular, badge: plain(t.badge) || (t.popular ? 'Le plus demandé' : undefined),
    })),
  }]], {}, r),

  faq_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'faq', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
    items: (Array.isArray(d.cards) ? d.cards : []).map((c: D) => ({ id: uid(), question: plain(c.question), answer: plain(c.answer) })),
  }]], {}, r),

  faq_accordion_modern: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'faq', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title) || undefined, intro: plain(d.description) || undefined,
    items: (Array.isArray(d.items) ? d.items : Array.isArray(d.cards) ? d.cards : []).map((c: D) => ({ id: uid(), question: plain(c.question), answer: plain(c.answer) })),
  }]], {}, r),

  cta_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'callout', eyebrow: plain(d.eyebrow) || undefined, title: plain(d.title), text: plain(d.description) || undefined,
    ctaText: plain(d.cta_text) || undefined, ctaUrl: str(d.cta_href) || '/contact',
  }]], { paddingY: padding(d, 'large') }, r),

  marquee_1: (d, r) => section(d, 'full-width', [[{
    id: uid(), type: 'marquee', items: (Array.isArray(d.items) ? d.items : []).map(plain), separator: str(d.separator) || '●',
    speed: ['slow', 'normal', 'fast'].includes(d.speed) ? d.speed : 'normal', italic: !!d.italic,
  }]], { paddingY: 'none', animation: 'none' }, r),

  contact_1: (d, r) => section(d, '1-col', [[{
    id: uid(), type: 'contact', title: plain(d.title) || undefined, text: plain(d.description) || undefined,
    address: plain(d.address) || undefined, phone: plain(d.phone) || undefined, email: plain(d.email) || undefined, hours: plain(d.hours) || undefined,
  }]], { width: 'contained' }, r),
};

export function convertStudioSections(sections: StudioSection[] | null | undefined, report?: ConversionReport): ContentStructure {
  const rep: ConversionReport = report ?? { converted: {}, legacy: {}, warnings: [] };
  const out: ContentStructure = [];
  for (const s of sections ?? []) {
    if (!s || typeof s.type !== 'string') continue;
    const conv = CONVERTERS[s.type];
    const converted = conv ? conv(s.data ?? {}, rep) : null;
    if (converted) {
      rep.converted[s.type] = (rep.converted[s.type] ?? 0) + 1;
      out.push(converted);
    } else {
      rep.legacy[s.type] = (rep.legacy[s.type] ?? 0) + 1;
      out.push({
        id: uid(), layout: 'full-width', paddingY: 'none', background: 'transparent',
        columns: [{ id: uid(), blocks: [{ id: uid(), type: 'legacy_section', section: { type: s.type, data: s.data ?? {} } }] }],
      });
    }
  }
  return out;
}
