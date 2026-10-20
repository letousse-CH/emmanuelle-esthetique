/**
 * Visuels des publications Instagram / Facebook, dessinés aux couleurs du site.
 *
 * Tout vient de la charte publique (« Design & Style ») : couleur principale,
 * polices des titres et du texte, logos de l'en-tête et du pied de page, et
 * l'algue de `public/images/algue.svg`. Les trois mises en page reprennent des
 * blocs du site : la photo plein cadre de l'en-tête, la page éditoriale (photo
 * puis texte sur blanc, surtitre espacé précédé d'un filet), et l'encart
 * marine de l'offre du moment (dégradé lagon → marine, grande algue). Angles
 * nets, comme les boutons et les photos du site.
 *
 * Le même dessin sert à l'aperçu et au JPEG envoyé à Meta : ce qu'on voit est
 * ce qui part.
 */
import type { SocialVisual, VisualFormat, VisualLayout } from '../types/social';
import { SITE_CONFIG } from '../config/site';

export const VISUAL_SIZE: Record<VisualFormat, { w: number; h: number }> = {
  // 4:5, le format qui occupe le plus de place dans le fil Instagram.
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  // 9:16 : stories et Reels.
  story: { w: 1080, h: 1920 },
};

export const LAYOUTS: { id: VisualLayout; label: string; hint: string }[] = [
  { id: 'photo', label: 'Photo', hint: 'Photo plein cadre, texte sur un voile marine' },
  { id: 'editorial', label: 'Éditorial', hint: 'Photo en haut, texte sur blanc, comme les pages du site' },
  { id: 'marine', label: 'Marine', hint: 'Dégradé lagon et algue, comme l’encart « offre du moment »' },
];

export const FORMATS: { id: VisualFormat; label: string }[] = [
  { id: 'portrait', label: 'Portrait 4:5' },
  { id: 'square', label: 'Carré 1:1' },
];

// ── Charte ───────────────────────────────────────────────────────────────────

export interface VisualBrand {
  primary: string;
  /** Turquoise de l'algue et du logo (`--pb-accent` des blocs du site). */
  accent: string;
  text: string;
  muted: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  logoDark: string | null;
  logoLight: string | null;
  /** Adresse imprimée en pied de visuel. */
  signature: string;
}

const BRAND_KEYS = [
  'style_color_primary', 'style_color_text', 'style_color_text_muted', 'style_color_border',
  'style_font_headings', 'style_font_body', 'global_logo', 'footer_logo', 'business_address_city',
];

/** Même turquoise que `--pb-accent` dans blocks.css (le site ne l'expose pas en réglage). */
const ALGUE = '#60B9C2';

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

function siteHost(): string {
  for (const candidate of [SITE_CONFIG.url, typeof window !== 'undefined' ? window.location.origin : '']) {
    try {
      const host = new URL(candidate).hostname.replace(/^www\./, '');
      if (host && !/localhost|127\.0\.0\.1/.test(host)) return host;
    } catch { /* adresse vide */ }
  }
  return '';
}

export async function loadVisualBrand(
  client: { from: (t: string) => any },
): Promise<VisualBrand> {
  const { data } = await client.from('settings').select('key, value').in('key', BRAND_KEYS);
  const s: Record<string, string> = Object.fromEntries(((data ?? []) as any[]).map((r) => [r.key, String(r.value ?? '').trim()]));
  return {
    primary: isHex(s.style_color_primary) ? s.style_color_primary : '#12283A',
    accent: ALGUE,
    text: isHex(s.style_color_text) ? s.style_color_text : '#22252A',
    muted: isHex(s.style_color_text_muted) ? s.style_color_text_muted : '#6C757D',
    border: isHex(s.style_color_border) ? s.style_color_border : '#E7EBEE',
    headingFont: s.style_font_headings || 'Lora',
    bodyFont: s.style_font_body || 'Open Sans',
    logoDark: s.global_logo || null,
    logoLight: s.footer_logo || null,
    signature: siteHost() || s.business_address_city || '',
  };
}

// ── Ressources (photos, logos, polices, algue) ───────────────────────────────

export interface VisualAssets {
  photo: CanvasImageSource | null;
  logoDark: CanvasImageSource | null;
  logoLight: CanvasImageSource | null;
  algue: CanvasImageSource | null;
}

const bitmapCache = new Map<string, Promise<ImageBitmap | null>>();

/**
 * Le bucket R2 n'envoie pas d'en-tête CORS : la photo passe par le relais du
 * site (même origine), sinon le canvas refuserait d'exporter le JPEG.
 */
export function loadBitmap(url: string | null, token: string): Promise<ImageBitmap | null> {
  if (!url) return Promise.resolve(null);
  const absolute = url.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
  const hit = bitmapCache.get(absolute);
  if (hit) return hit;
  const sameOrigin = typeof window !== 'undefined' && absolute.startsWith(window.location.origin);
  const fetchUrl = sameOrigin ? absolute : `/api/admin/social/photo?url=${encodeURIComponent(absolute)}`;
  const p = fetch(fetchUrl, { headers: sameOrigin ? {} : { Authorization: `Bearer ${token}` } })
    .then(async (res) => (res.ok ? createImageBitmap(await res.blob()) : null))
    .catch(() => null)
    .then((bmp) => {
      if (!bmp) bitmapCache.delete(absolute);
      return bmp;
    });
  bitmapCache.set(absolute, p);
  return p;
}

let alguePromise: Promise<HTMLImageElement | null> | null = null;

function loadAlgue(): Promise<HTMLImageElement | null> {
  if (alguePromise) return alguePromise;
  alguePromise = fetch('/images/algue.svg')
    .then((r) => (r.ok ? r.blob() : null))
    .then((blob) => new Promise<HTMLImageElement | null>((resolve) => {
      if (!blob) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    }))
    .catch(() => null);
  return alguePromise;
}

const fontsLoaded = new Map<string, Promise<void>>();

/** Mêmes familles que le site, chargées depuis Google Fonts (le site public les auto-héberge). */
export function ensureFonts(brand: VisualBrand): Promise<void> {
  const key = `${brand.headingFont}|${brand.bodyFont}`;
  const hit = fontsLoaded.get(key);
  if (hit) return hit;
  const p = (async () => {
    if (typeof document === 'undefined') return;
    const id = `social-visual-fonts-${key.replace(/[^a-z0-9]+/gi, '-')}`;
    if (!document.getElementById(id)) {
      const families = [...new Set([brand.headingFont, brand.bodyFont])]
        .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`)
        .join('&');
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families}&display=block`;
      document.head.appendChild(link);
      await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
    }
    await Promise.race([
      Promise.all([
        document.fonts.load(`600 80px "${brand.headingFont}"`),
        document.fonts.load(`700 24px "${brand.bodyFont}"`),
        document.fonts.load(`600 24px "${brand.bodyFont}"`),
      ]),
      new Promise((r) => setTimeout(r, 5000)),
    ]).catch(() => {});
  })();
  fontsLoaded.set(key, p);
  return p;
}

export async function loadVisualAssets(visual: SocialVisual, brand: VisualBrand, token: string): Promise<VisualAssets> {
  const [photo, logoDark, logoLight, algue] = await Promise.all([
    loadBitmap(visual.photo_url, token),
    loadBitmap(brand.logoDark, token),
    loadBitmap(brand.logoLight, token),
    loadAlgue(),
    ensureFonts(brand),
  ]);
  return { photo, logoDark, logoLight, algue };
}

// ── Outils de dessin ─────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Équivalent de `color-mix(in srgb, a t%, b)`. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function sizeOf(img: CanvasImageSource): { w: number; h: number } {
  const anyImg = img as any;
  // <video> : `width` est l'attribut HTML (0 par défaut), la taille réelle est videoWidth.
  return {
    w: anyImg.videoWidth || anyImg.naturalWidth || anyImg.width || 1,
    h: anyImg.videoHeight || anyImg.naturalHeight || anyImg.height || 1,
  };
}

/** `object-fit: cover`, centré. */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const { w: iw, h: ih } = sizeOf(img);
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

export function drawLogo(ctx: CanvasRenderingContext2D, img: CanvasImageSource | null, x: number, bottom: number, height: number, align: 'left' | 'center' = 'left') {
  if (!img) return;
  const { w, h } = sizeOf(img);
  const width = (w / h) * height;
  const left = align === 'center' ? x - width / 2 : x;
  ctx.drawImage(img, left, bottom - height, width, height);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Fit { size: number; lines: string[]; lineHeight: number }

/** Plus grande taille qui tient dans le cadre ; sinon la plus petite, coupée. */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  box: { width: number; height: number; maxLines: number },
  sizes: { max: number; min: number; leading: number },
): Fit {
  for (let size = sizes.max; size >= sizes.min; size -= 2) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, box.width);
    const lineHeight = size * sizes.leading;
    if (lines.length <= box.maxLines && lines.length * lineHeight <= box.height) return { size, lines, lineHeight };
  }
  ctx.font = font(sizes.min);
  const lines = wrap(ctx, text, box.width);
  const kept = lines.slice(0, box.maxLines);
  if (lines.length > box.maxLines) kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[\s,.;:]+$/, '')}…`;
  return { size: sizes.min, lines: kept, lineHeight: sizes.min * sizes.leading };
}

export function drawLines(ctx: CanvasRenderingContext2D, fit: Fit, x: number, top: number, align: CanvasTextAlign) {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  fit.lines.forEach((line, i) => {
    // Ligne de base à ~78 % de la hauteur de ligne : rendu proche du CSS.
    ctx.fillText(line, x, top + i * fit.lineHeight + fit.lineHeight * 0.78);
  });
}

/** Surtitre du site (`.pb-eyebrow`) : capitales très espacées, précédées d'un filet. */
export function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baseline: number,
  opts: { color: string; font: string; size: number; align: 'left' | 'center' },
) {
  const label = text.trim().toLocaleUpperCase('fr');
  if (!label) return;
  ctx.font = `700 ${opts.size}px "${opts.font}"`;
  const spacing = opts.size * 0.34;
  const chars = [...label];
  const textWidth = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width + spacing, -spacing);
  const rule = opts.size * 2;
  const gap = opts.size * 0.75;
  const total = rule + gap + textWidth;
  let cursor = opts.align === 'center' ? x - total / 2 : x;

  ctx.fillStyle = opts.color;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(cursor, baseline - opts.size * 0.36, rule, Math.max(1, opts.size / 12));
  ctx.globalAlpha = 1;
  cursor += rule + gap;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, baseline);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

export function drawSignature(ctx: CanvasRenderingContext2D, brand: VisualBrand, x: number, baseline: number, color: string, align: CanvasTextAlign) {
  if (!brand.signature) return;
  ctx.font = `600 26px "${brand.bodyFont}"`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(brand.signature, x, baseline);
}

export function drawAlgue(ctx: CanvasRenderingContext2D, algue: CanvasImageSource | null, cx: number, cy: number, size: number, rotateDeg: number, alpha: number) {
  if (!algue) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  ctx.drawImage(algue, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export const headingFont = (brand: VisualBrand) => (size: number) => `600 ${size}px "${brand.headingFont}"`;

// ── Mises en page ────────────────────────────────────────────────────────────

const M = 88;

/**
 * Marges hautes et basses. En story, Instagram pose le nom du compte en haut
 * (~ 250 px) et le champ de réponse en bas (~ 330 px) : rien d'important n'y va.
 */
export function insets(W: number, H: number): { top: number; bottom: number } {
  return H / W > 1.7 ? { top: 250, bottom: 330 } : { top: M, bottom: M };
}
// Lisible une fois le visuel réduit à la largeur d'un téléphone (~ 1/3).
export const LOGO_H = 66;
export const EYEBROW = 28;
export { M as MARGIN };

export function layoutPhoto(ctx: CanvasRenderingContext2D, W: number, H: number, v: SocialVisual, brand: VisualBrand, a: VisualAssets) {
  if (a.photo) drawCover(ctx, a.photo, 0, 0, W, H);
  else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, mix(brand.accent, '#0b3a44', 0.4));
    g.addColorStop(0.7, brand.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Voile marine, plus dense en bas, là où vit le texte.
  const veil = ctx.createLinearGradient(0, H * 0.25, 0, H);
  veil.addColorStop(0, rgba(brand.primary, 0));
  veil.addColorStop(0.35, rgba(brand.primary, 0.55));
  veil.addColorStop(0.65, rgba(brand.primary, 0.82));
  veil.addColorStop(1, rgba(brand.primary, 0.95));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  const logoBottom = H - insets(W, H).bottom;
  drawLogo(ctx, a.logoLight, M, logoBottom, LOGO_H);
  drawSignature(ctx, brand, W - M, logoBottom - LOGO_H / 2 + 9, 'rgba(255, 255, 255, 0.82)', 'right');

  const ruleY = logoBottom - LOGO_H - 40;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
  ctx.fillRect(M, ruleY, W - 2 * M, 1);

  ctx.fillStyle = '#FFFFFF';
  const fit = fitText(ctx, v.headline, headingFont(brand), { width: W - 2 * M, height: H * 0.36, maxLines: 4 }, { max: 86, min: 50, leading: 1.12 });
  const top = ruleY - 48 - fit.lines.length * fit.lineHeight;
  ctx.font = headingFont(brand)(fit.size);
  drawLines(ctx, fit, M, top, 'left');
  // Comme les sections sombres du site : surtitre en blanc, pas en couleur.
  drawEyebrow(ctx, v.eyebrow, M, top - 34, { color: '#FFFFFF', font: brand.bodyFont, size: EYEBROW, align: 'left' });
}

export function layoutEditorial(ctx: CanvasRenderingContext2D, W: number, H: number, v: SocialVisual, brand: VisualBrand, a: VisualAssets) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const photoH = Math.round(H * (H > W ? 0.55 : 0.5));
  if (a.photo) drawCover(ctx, a.photo, 0, 0, W, photoH);
  else {
    ctx.fillStyle = mix(brand.accent, '#FFFFFF', 0.14);
    ctx.fillRect(0, 0, W, photoH);
    drawAlgue(ctx, a.algue, W / 2, photoH / 2, photoH * 0.6, 0, 0.9);
  }

  const logoBottom = H - insets(W, H).bottom + 10;
  const ruleY = logoBottom - LOGO_H - 34;
  ctx.fillStyle = brand.border;
  ctx.fillRect(M, ruleY, W - 2 * M, 2);
  drawLogo(ctx, a.logoDark, M, logoBottom, LOGO_H);
  drawSignature(ctx, brand, W - M, logoBottom - LOGO_H / 2 + 9, brand.muted, 'right');

  const eyebrowBaseline = photoH + 82;
  drawEyebrow(ctx, v.eyebrow, M, eyebrowBaseline, { color: brand.primary, font: brand.bodyFont, size: EYEBROW, align: 'left' });
  const top = v.eyebrow.trim() ? eyebrowBaseline + 34 : photoH + 64;
  ctx.fillStyle = brand.primary;
  const fit = fitText(ctx, v.headline, headingFont(brand), { width: W - 2 * M, height: ruleY - 36 - top, maxLines: 4 }, { max: 84, min: 44, leading: 1.15 });
  ctx.font = headingFont(brand)(fit.size);
  drawLines(ctx, fit, M, top, 'left');
}


/** Fond « offre du moment » du site (`.pb-section-offer`) : dégradé lagon → marine, halos, grande algue. */
export function drawMarineBackground(ctx: CanvasRenderingContext2D, W: number, H: number, brand: VisualBrand, algue: CanvasImageSource | null) {
  const a = { algue };
  // Même fond que `.pb-section-offer` (blocks.css).
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, mix(brand.accent, '#0b3a44', 0.4));
  base.addColorStop(0.7, brand.primary);
  base.addColorStop(1, brand.primary);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const glow1 = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H) * 0.8);
  glow1.addColorStop(0, rgba(brand.accent, 0.5));
  glow1.addColorStop(1, rgba(brand.accent, 0));
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W, H, 0, W, H, Math.max(W, H) * 0.6);
  glow2.addColorStop(0, rgba(brand.accent, 0.24));
  glow2.addColorStop(1, rgba(brand.accent, 0));
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);
  drawAlgue(ctx, a.algue, W * 0.86, H * 0.86, W * 0.72, -14, 0.15);
}

export function layoutMarine(ctx: CanvasRenderingContext2D, W: number, H: number, v: SocialVisual, brand: VisualBrand, a: VisualAssets) {
  drawMarineBackground(ctx, W, H, brand, a.algue);

  const logoBottom = H - insets(W, H).bottom;
  drawLogo(ctx, a.logoLight, W / 2, logoBottom, LOGO_H, 'center');

  let textTop: number;
  let maxHeight: number;
  if (a.photo) {
    const story = H / W > 1.7;
    const size = Math.round(story ? W * 0.62 : H > W ? W * 0.5 : W * 0.38);
    const x = (W - size) / 2;
    const y = story ? insets(W, H).top + 60 : H > W ? 150 : 110;
    const offset = 16;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = brand.primary;
    ctx.fillRect(x, y, size, size);
    ctx.restore();
    drawCover(ctx, a.photo, x, y, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - offset, y - offset, size + 2 * offset, size + 2 * offset);
    textTop = y + size + offset + 92;
    maxHeight = logoBottom - LOGO_H - 56 - textTop;
  } else {
    textTop = H * 0.3;
    maxHeight = H * 0.42;
  }

  const hasEyebrow = Boolean(v.eyebrow.trim());
  ctx.fillStyle = '#FFFFFF';
  const fit = fitText(
    ctx, v.headline, headingFont(brand),
    { width: W - 2 * M - 40, height: maxHeight - (hasEyebrow ? 50 : 0), maxLines: a.photo ? 3 : 5 },
    a.photo ? { max: 68, min: 40, leading: 1.15 } : { max: 96, min: 54, leading: 1.12 },
  );
  const block = (hasEyebrow ? 50 : 0) + fit.lines.length * fit.lineHeight;
  const start = a.photo ? textTop : textTop + (maxHeight - block) / 2;
  if (hasEyebrow) drawEyebrow(ctx, v.eyebrow, W / 2, start, { color: brand.accent, font: brand.bodyFont, size: EYEBROW, align: 'center' });
  ctx.fillStyle = '#FFFFFF';
  ctx.font = headingFont(brand)(fit.size);
  drawLines(ctx, fit, W / 2, start + (hasEyebrow ? 22 : -fit.lineHeight * 0.2), 'center');
}

/** Dessine le visuel en taille réelle (1080 px de large). */
export function renderVisual(canvas: HTMLCanvasElement, v: SocialVisual, brand: VisualBrand, assets: VisualAssets): void {
  const { w, h } = VISUAL_SIZE[v.format];
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  if (v.layout === 'editorial') layoutEditorial(ctx, w, h, v, brand, assets);
  else if (v.layout === 'marine') layoutMarine(ctx, w, h, v, brand, assets);
  else layoutPhoto(ctx, w, h, v, brand, assets);
}

/** Empreinte de ce qui détermine le dessin : si elle change, on redépose le JPEG. */
export function visualHash(v: SocialVisual, brand: VisualBrand): string {
  const input = JSON.stringify([2, v.layout, v.format, v.eyebrow.trim(), v.headline.trim(), v.photo_url, brand]);
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Le visuel n’a pas pu être exporté.'))), 'image/jpeg', 0.9);
    } catch (err) {
      // Canvas « sali » par une image d'une autre origine.
      reject(new Error('Le visuel contient une image que le navigateur refuse d’exporter. Choisissez une photo de la médiathèque.'));
    }
  });
}

/** Dessine le visuel hors écran et le rend en JPEG : c'est ce fichier qui part chez Meta. */
export async function renderToJpeg(v: SocialVisual, brand: VisualBrand, token: string): Promise<Blob> {
  const assets = await loadVisualAssets(v, brand, token);
  if (v.photo_url && !assets.photo) {
    throw new Error('La photo choisie n’a pas pu être chargée. Choisissez-en une autre dans la médiathèque.');
  }
  const canvas = document.createElement('canvas');
  renderVisual(canvas, v, brand, assets);
  return canvasToJpeg(canvas);
}
