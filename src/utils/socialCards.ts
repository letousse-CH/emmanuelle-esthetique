/**
 * Rendu canvas des visuels de carrousel Instagram/LinkedIn, aux couleurs et
 * polices de marque en vigueur (mêmes réglages Supabase que GlobalStyles —
 * "Design & Style" de l'admin, éditables et donc pertinentes sur un site
 * cloné depuis ce template).
 *
 * On interroge directement la table `settings` plutôt que de lire les
 * variables CSS : GlobalStyles ne les injecte qu'après son propre fetch
 * asynchrone, avec un défaut transitoire (police Next.js du layout) avant
 * ça — lire les variables CSS créerait une course où un rendu déclenché tôt
 * capturerait la mauvaise police.
 */
import { supabase } from '../services/supabase';
import { SITE_CONFIG } from '../config/site';

export interface BrandTokens {
  accent: string;
  dark: string;
  headingFont: string;
  bodyFont: string;
  siteName: string;
}

const FALLBACK_BRAND: BrandTokens = {
  accent: '#8A9A7B',
  dark: '#3A3730',
  headingFont: 'Cormorant Garamond',
  bodyFont: 'Inter',
  siteName: SITE_CONFIG.name,
};

const BRAND_SETTING_KEYS = ['style_color_primary', 'style_color_btn_dark_bg', 'style_font_headings', 'style_font_body'] as const;

// Les réglages « Design & Style » de l'admin font autorité, comme dans
// GlobalStyles : on ne retombe sur FALLBACK_BRAND que si la valeur est vide.
function isOldStyleDefault(_key: string, value: string): boolean {
  // La table `settings` fait autorité (même règle que GlobalStyles) : seule une
  // valeur vide justifie de retomber sur FALLBACK_BRAND.
  return !value;
}

export async function fetchBrandTokens(siteName?: string): Promise<BrandTokens> {
  const brand: BrandTokens = { ...FALLBACK_BRAND, siteName: siteName || FALLBACK_BRAND.siteName };
  try {
    const { data, error } = await supabase.from('settings').select('key, value').in('key', BRAND_SETTING_KEYS);
    if (error || !data) return brand;
    const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
    if (map.style_color_primary && !isOldStyleDefault('style_color_primary', map.style_color_primary)) brand.accent = map.style_color_primary;
    if (map.style_color_btn_dark_bg && !isOldStyleDefault('style_color_btn_dark_bg', map.style_color_btn_dark_bg)) brand.dark = map.style_color_btn_dark_bg;
    if (map.style_font_headings && !isOldStyleDefault('style_font_headings', map.style_font_headings)) brand.headingFont = map.style_font_headings;
    if (map.style_font_body) brand.bodyFont = map.style_font_body;
  } catch {
    // Réseau indisponible : on garde le fallback de marque par défaut.
  }
  return brand;
}

/**
 * Formats de visuel par plateforme. Instagram publie en portrait 4:5,
 * LinkedIn rend au mieux en carré dans le fil, et Facebook en paysage 1.91:1.
 */
export type SocialCardFormat = 'instagram-portrait' | 'linkedin-square' | 'facebook-landscape';

interface FormatSpec {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  maxFontSize: number;
  minFontSize: number;
}

export const CARD_FORMATS: Record<SocialCardFormat, FormatSpec> = {
  'instagram-portrait': { width: 1080, height: 1350, paddingX: 110, paddingY: 170, maxFontSize: 78, minFontSize: 32 },
  'linkedin-square':    { width: 1200, height: 1200, paddingX: 130, paddingY: 170, maxFontSize: 82, minFontSize: 34 },
  'facebook-landscape': { width: 1200, height: 630,  paddingX: 110, paddingY: 84,  maxFontSize: 64, minFontSize: 26 },
};

export const FORMAT_LABELS: Record<SocialCardFormat, string> = {
  'instagram-portrait': '1080 × 1350 · portrait',
  'linkedin-square': '1200 × 1200 · carré',
  'facebook-landscape': '1200 × 630 · paysage',
};

interface SlideRenderOptions {
  canvas: HTMLCanvasElement;
  text: string;
  highlight?: string;
  number: number;
  total: number;
  dark: boolean;
  brand: BrandTokens;
  /** Fraction de la taille nominale. 1 pour le visuel exportable, moins pour une miniature. */
  scale?: number;
}

interface HookCardOptions {
  canvas: HTMLCanvasElement;
  text: string;
  highlight?: string;
  dark: boolean;
  brand: BrandTokens;
  format: SocialCardFormat;
  /** Fraction de la taille nominale. 1 pour le visuel exportable, moins pour une miniature. */
  scale?: number;
}

/** Échelle des miniatures affichées dans les listes (~190 px de large). */
export const THUMBNAIL_SCALE = 0.25;

/**
 * S'assure que le <link> Google Fonts pour cette police existe dans le
 * document. GlobalStyles l'injecte déjà globalement, mais de façon
 * asynchrone (fetch des réglages puis rendu du <link>) — sur un premier
 * chargement rapide, le canvas peut se dessiner avant que ce <link> existe.
 * On l'ajoute nous-même ici de façon idempotente pour ne jamais dépendre
 * de ce timing.
 */
function ensureGoogleFontLink(family: string) {
  if (typeof document === 'undefined') return;
  const id = `social-card-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

async function ensureFontsLoaded(brand: BrandTokens) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  ensureGoogleFontLink(brand.headingFont);
  ensureGoogleFontLink(brand.bodyFont);
  try {
    // Le <link> vient peut-être d'être inséré : laisser une chance au CSSOM
    // de l'enregistrer avant d'interroger document.fonts.
    await Promise.all([
      document.fonts.load(`700 60px "${brand.headingFont}"`),
      document.fonts.load(`600 26px "${brand.bodyFont}"`),
    ]);
    await document.fonts.load(`700 60px "${brand.headingFont}"`);
    await document.fonts.ready;
  } catch {
    // Police toujours indisponible : on dessine avec le fallback système.
  }
}

const stripPunctuation = (w: string) => w.toLowerCase().replace(/^[.,!?;:«»"()]+|[.,!?;:«»"()]+$/g, '');

/**
 * Largeur d'une espace pour la police courante du contexte.
 *
 * `measureText(' ')` et `measureText('mot ')` ne sont pas fiables : les
 * navigateurs appliquent le « white space processing » du HTML et suppriment
 * les espaces de début/fin, si bien que la mesure renvoie la largeur du mot
 * seul. On la déduit donc d'une différence entre deux chaînes où l'espace est
 * interne, donc conservé.
 */
function measureSpace(ctx: CanvasRenderingContext2D): number {
  return ctx.measureText('A A').width - ctx.measureText('AA').width;
}

/**
 * Cœur de rendu partagé par tous les visuels : fond de marque, titre centré à
 * taille adaptative, mots du « highlight » à la couleur d'accent, compteur
 * facultatif et signature du site en pied.
 */
async function drawCard(
  opts: { canvas: HTMLCanvasElement; text: string; highlight?: string; dark: boolean; brand: BrandTokens; scale?: number },
  spec: FormatSpec,
  counter?: { number: number; total: number },
): Promise<void> {
  const { canvas, text, highlight, dark, brand } = opts;
  const { width: WIDTH, height: HEIGHT, paddingX: PADDING_X, paddingY: PADDING_Y } = spec;

  // Le dessin reste exprimé dans les dimensions nominales du format ; seule la
  // taille réelle du canvas change. Une miniature n'a pas besoin des 1,4 million
  // de pixels du visuel téléchargeable — mise à l'échelle du contexte plutôt que
  // de chaque police et marge, la mise en page reste rigoureusement identique.
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (scale !== 1) ctx.setTransform(scale, 0, 0, scale, 0, 0);

  await ensureFontsLoaded(brand);

  const bg = dark ? brand.dark : '#FFFFFF';
  const fg = dark ? '#FFFFFF' : brand.dark;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const maxWidth = WIDTH - PADDING_X * 2;
  const maxHeight = HEIGHT - PADDING_Y * 2;
  const words = text.trim().split(/\s+/).filter(Boolean);

  const highlightWords = highlight ? highlight.trim().split(/\s+/).filter(Boolean) : [];
  let hlStart = -1;
  if (highlightWords.length > 0) {
    const lowerWords = words.map(stripPunctuation);
    const lowerHl = highlightWords.map(stripPunctuation);
    for (let i = 0; i <= lowerWords.length - lowerHl.length; i++) {
      if (lowerHl.every((hw, j) => lowerWords[i + j] === hw)) { hlStart = i; break; }
    }
  }
  const hlEnd = hlStart >= 0 ? hlStart + highlightWords.length - 1 : -1;

  /** Découpe le texte en lignes pour une taille de police donnée. */
  const layoutAt = (size: number) => {
    ctx.font = `700 ${size}px "${brand.headingFont}"`;
    const spaceWidth = measureSpace(ctx);
    const result: { words: string[]; startIdx: number }[] = [];
    let current: string[] = [];
    let lineStartIdx = 0;
    let width = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wordWidth = ctx.measureText(w).width;
      const pieceWidth = current.length ? spaceWidth + wordWidth : wordWidth;
      if (width + pieceWidth > maxWidth && current.length > 0) {
        result.push({ words: current, startIdx: lineStartIdx });
        current = [w];
        lineStartIdx = i;
        width = wordWidth;
      } else {
        current.push(w);
        width += pieceWidth;
      }
    }
    if (current.length) result.push({ words: current, startIdx: lineStartIdx });
    return result;
  };

  let fontSize = spec.maxFontSize;
  let lines = layoutAt(fontSize);
  let lineHeight = fontSize * 1.24;
  while (fontSize > spec.minFontSize && lines.length * lineHeight > maxHeight) {
    fontSize -= 4;
    lines = layoutAt(fontSize);
    lineHeight = fontSize * 1.24;
  }

  // Un texte trop long tient parfois encore hors cadre à la taille minimale :
  // on borne alors le nombre de lignes et on marque la coupe, plutôt que de
  // laisser le texte déborder du visuel.
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[lines.length - 1];
    const lastWords = [...last.words];
    lastWords[lastWords.length - 1] = `${lastWords[lastWords.length - 1]}…`;
    lines[lines.length - 1] = { ...last, words: lastWords };
  }

  ctx.font = `700 ${fontSize}px "${brand.headingFont}"`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const spaceWidth = measureSpace(ctx);

  const totalTextHeight = lines.length * lineHeight;
  let y = (HEIGHT - totalTextHeight) / 2 + fontSize * 0.82;

  for (const line of lines) {
    const wordWidths = line.words.map((w) => ctx.measureText(w).width);
    const lineWidth = wordWidths.reduce((sum, w) => sum + w, 0) + spaceWidth * (line.words.length - 1);
    let x = (WIDTH - lineWidth) / 2;

    let wIdx = line.startIdx;
    for (let k = 0; k < line.words.length; k++, wIdx++) {
      const isHl = hlStart >= 0 && wIdx >= hlStart && wIdx <= hlEnd;
      ctx.fillStyle = isHl ? brand.accent : fg;
      ctx.fillText(line.words[k], x, y);
      x += wordWidths[k] + spaceWidth;
    }
    y += lineHeight;
  }

  // Marge du pied bornée : sur le format paysage, une marge proportionnelle
  // collerait la signature au bord.
  const edge = Math.max(48, Math.round(HEIGHT * 0.055));

  if (counter) {
    ctx.font = `600 26px "${brand.bodyFont}"`;
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${String(counter.number).padStart(2, '0')} / ${String(counter.total).padStart(2, '0')}`,
      WIDTH - 74,
      edge + 22,
    );
  }

  ctx.font = `600 24px "${brand.bodyFont}"`;
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';
  ctx.textAlign = 'center';
  ctx.fillText(brand.siteName.toUpperCase(), WIDTH / 2, HEIGHT - edge);
}

/** Slide de carrousel Instagram (portrait 4:5), numérotée. */
export async function renderCarouselSlide(opts: SlideRenderOptions): Promise<void> {
  const { canvas, text, highlight, dark, brand, number, total, scale } = opts;
  await drawCard({ canvas, text, highlight, dark, brand, scale }, CARD_FORMATS['instagram-portrait'], { number, total });
}

/**
 * Visuel unique portant le hook, au format de la plateforme visée — l'équivalent
 * d'une seule diapo du carrousel pour LinkedIn et Facebook.
 */
export async function renderHookCard(opts: HookCardOptions): Promise<void> {
  const { canvas, text, highlight, dark, brand, format, scale } = opts;
  await drawCard({ canvas, text, highlight, dark, brand, scale }, CARD_FORMATS[format]);
}

/** Force le téléchargement d'un canvas en PNG. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png', 1);
}

/** Télécharge une image distante (ex: photo de couverture d'article). */
export async function downloadImageFromUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    // CORS ou hébergeur externe : on ouvre l'image, l'utilisateur fait "Enregistrer sous".
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
