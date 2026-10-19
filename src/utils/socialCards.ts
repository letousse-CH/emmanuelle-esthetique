/**
 * Rendu canvas des visuels de carrousel Instagram, Stories 9:16, Facebook,
 * Fiche Google Business Profile et LinkedIn, aux couleurs et polices de marque
 * d'Emmanuelle Esthétique (beige crème #FAF7F2, sauge #8A9A7B, turquoise marin
 * #60B9C2, brun profond #3A3730, Cormorant Garamond & Inter).
 *
 * On interroge directement la table `settings` plutôt que de lire les
 * variables CSS : GlobalStyles ne les injecte qu'après son propre fetch
 * asynchrone, avec un défaut transitoire avant ça — lire les variables CSS
 * créerait une course où un rendu déclenché tôt capturerait la mauvaise police.
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
  siteName: SITE_CONFIG.name || 'Emmanuelle Esthétique',
};

const BRAND_SETTING_KEYS = [
  'style_color_primary',
  'style_color_text',
  'style_font_headings',
  'style_font_body',
  'business_name',
] as const;

export async function fetchBrandTokens(siteName?: string): Promise<BrandTokens> {
  const resolvedDefaultName = (siteName && siteName.trim()) || FALLBACK_BRAND.siteName || 'Emmanuelle Esthétique';
  const brand: BrandTokens = { ...FALLBACK_BRAND, siteName: resolvedDefaultName };
  try {
    const { data, error } = await supabase.from('settings').select('key, value').in('key', BRAND_SETTING_KEYS);
    if (error || !data) return brand;
    const map = Object.fromEntries(
      (data as { key: string; value: string | null }[]).map((r) => [r.key, (r.value ?? '').trim()]),
    );
    if (map.style_color_primary) brand.accent = map.style_color_primary;
    if (map.style_color_text) brand.dark = map.style_color_text;
    if (map.style_font_headings) brand.headingFont = map.style_font_headings;
    if (map.style_font_body) brand.bodyFont = map.style_font_body;
    if (map.business_name) {
      brand.siteName = map.business_name;
    } else if (!brand.siteName) {
      brand.siteName = 'Emmanuelle Esthétique';
    }
  } catch {
    // Réseau indisponible : on garde le fallback de marque par défaut.
  }
  return brand;
}

/**
 * Formats de visuel par plateforme :
 * - Instagram carrousel en portrait 4:5 (1080 × 1350)
 * - Instagram Story en vertical 9:16 (1080 × 1920)
 * - LinkedIn en carré 1:1 (1200 × 1200)
 * - Facebook en paysage 1.91:1 (1200 × 630)
 * - Google Business Profile en 4:3 (1200 × 900)
 */
export type SocialCardFormat =
  | 'instagram-portrait'
  | 'instagram-story'
  | 'linkedin-square'
  | 'facebook-landscape'
  | 'google-business';

export interface FormatSpec {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  maxFontSize: number;
  minFontSize: number;
}

export const CARD_FORMATS: Record<SocialCardFormat, FormatSpec> = {
  'instagram-portrait': { width: 1080, height: 1350, paddingX: 110, paddingY: 170, maxFontSize: 78, minFontSize: 32 },
  'instagram-story':    { width: 1080, height: 1920, paddingX: 110, paddingY: 260, maxFontSize: 80, minFontSize: 34 },
  'linkedin-square':    { width: 1200, height: 1200, paddingX: 130, paddingY: 170, maxFontSize: 82, minFontSize: 34 },
  'facebook-landscape': { width: 1200, height: 630,  paddingX: 110, paddingY: 84,  maxFontSize: 64, minFontSize: 26 },
  'google-business':    { width: 1200, height: 900,  paddingX: 110, paddingY: 120, maxFontSize: 68, minFontSize: 28 },
};

export const FORMAT_LABELS: Record<SocialCardFormat, string> = {
  'instagram-portrait': '1080 × 1350 · portrait',
  'instagram-story': '1080 × 1920 · Story verticale',
  'linkedin-square': '1200 × 1200 · carré',
  'facebook-landscape': '1200 × 630 · paysage',
  'google-business': '1200 × 900 · Fiche Google',
};

/**
 * Thèmes visuels signature d'Emmanuelle Esthétique.
 */
export type SocialVisualTheme = 'creme' | 'marin' | 'sauge' | 'photo' | 'citation';

export const VISUAL_THEMES: {
  id: SocialVisualTheme;
  label: string;
  description: string;
  previewBg: string;
  previewFg: string;
  previewAccent: string;
}[] = [
  {
    id: 'creme',
    label: 'Éditorial Crème',
    description: 'Fond beige crème doux, filet sauge et typographie brun profond.',
    previewBg: '#FAF7F2',
    previewFg: '#3A3730',
    previewAccent: '#8A9A7B',
  },
  {
    id: 'marin',
    label: 'Marin Phytomer',
    description: 'Bleu océan profond inspiré des soins Phytomer et éclat turquoise.',
    previewBg: '#1E3A40',
    previewFg: '#FAF7F2',
    previewAccent: '#60B9C2',
  },
  {
    id: 'sauge',
    label: 'Douceur Sauge',
    description: 'Vert sauge botanique apaisant, naturel et lumineux.',
    previewBg: '#8A9A7B',
    previewFg: '#FAF7F2',
    previewAccent: '#F1EAE0',
  },
  {
    id: 'photo',
    label: 'Photo de Soin',
    description: 'Photo de cabine en plein écran sous un voile sombre chaleureux.',
    previewBg: '#2B2520',
    previewFg: '#FAF7F2',
    previewAccent: '#DFC8A8',
  },
  {
    id: 'citation',
    label: 'Carte Conseil',
    description: 'Guillemets en filigrane, pastille « Conseil Beauté » et signature.',
    previewBg: '#F1EAE0',
    previewFg: '#3A3730',
    previewAccent: '#8A9A7B',
  },
];

const R2_LIBRARY_BASE = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev/';

export interface MediaLibraryPhoto {
  id: string;
  label: string;
  category: string;
  url: string;
  fileName?: string;
  fromLibrary?: boolean;
}

/**
 * Catalogue de repli des photos officielles de la médiathèque d'Emmanuelle Esthétique
 * (issues de R2 / media_assets et seederEmmanuelle.ts).
 */
export const BRAND_PHOTOS: MediaLibraryPhoto[] = [
  {
    id: 'r2-visage-phytomer',
    label: 'Soin visage & rituels Phytomer',
    category: 'Visage',
    url: `${R2_LIBRARY_BASE}1790524738941-WhatsApp-Image-2026-09-27-at-17.51.49--2-.webp`,
    fileName: 'soins-visages-phytomer.webp',
  },
  {
    id: 'r2-cabine-palezieux',
    label: 'La cabine de soins à Palézieux-Gare',
    category: 'Institut',
    url: `${R2_LIBRARY_BASE}1791296588293-cabine-soins-esthetiques-palezieux-gare-portrait_89C6887.CR2.webp`,
    fileName: 'cabine-soins-esthetiques-palezieux-gare-portrait.webp',
  },
  {
    id: 'r2-cabine-confort',
    label: 'Table chauffante & cocon de soin',
    category: 'Institut',
    url: `${R2_LIBRARY_BASE}1791296585438-cabine-soins-esthetiques-palezieux-gare-portrait_89C6881.CR2.webp`,
    fileName: 'cabine-confort-palezieux-gare.webp',
  },
  {
    id: 'r2-epilation-douce',
    label: 'Épilation douce & pâte de sucre',
    category: 'Épilation',
    url: `${R2_LIBRARY_BASE}1789998853978-e-pilation.jpg`,
    fileName: 'epilation.jpg',
  },
  {
    id: 'r2-prise-rdv-marin',
    label: 'Parenthèse marine & rendez-vous',
    category: 'Phytomer',
    url: `${R2_LIBRARY_BASE}1789999272375-prise-de-rdv.webp`,
    fileName: 'prise-de-rdv-algues-marines.webp',
  },
  {
    id: 'visage-phytomer',
    label: 'Soin du visage Phytomer',
    category: 'Visage',
    url: 'https://images.pexels.com/photos/5659016/pexels-photo-5659016.jpeg',
  },
  {
    id: 'massage-cranien',
    label: 'Massage crânien & détente',
    category: 'Massage',
    url: 'https://images.pexels.com/photos/6663371/pexels-photo-6663371.jpeg',
  },
  {
    id: 'massage-corps',
    label: 'Massage corps relaxant',
    category: 'Massage',
    url: 'https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg',
  },
  {
    id: 'beaute-regard',
    label: 'Beauté du regard & cils',
    category: 'Regard',
    url: 'https://images.pexels.com/photos/6954214/pexels-photo-6954214.jpeg',
  },
  {
    id: 'soin-anti-age',
    label: 'Soin jeunesse & éclat',
    category: 'Visage',
    url: 'https://images.pexels.com/photos/5659020/pexels-photo-5659020.jpeg',
  },
  {
    id: 'cocon-cabine',
    label: 'Ambiance cocon de la cabine',
    category: 'Institut',
    url: 'https://images.pexels.com/photos/3865800/pexels-photo-3865800.jpeg',
  },
  {
    id: 'mer-phytomer',
    label: 'Eau marine Phytomer',
    category: 'Phytomer',
    url: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg',
  },
  {
    id: 'ecume-marine',
    label: 'Écume & minéraux marins',
    category: 'Phytomer',
    url: 'https://images.pexels.com/photos/462162/pexels-photo-462162.jpeg',
  },
];

const normalizeSearchText = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function inferCategoryFromAsset(fileName: string, altText: string): string {
  const hay = normalizeSearchText(`${fileName} ${altText}`);
  if (/epilation|cire|sucre/.test(hay)) return 'Épilation';
  if (/visage|facial|eclat|jeunesse|anti-age|1790587791640/.test(hay)) return 'Visage';
  if (/corps|massage|rituel|minceur|dos|cranien|1790587819698/.test(hay)) return 'Massage';
  if (/regard|cil|sourcil|maquillage|portrait|1790593008713|1790587847303/.test(hay)) return 'Regard';
  if (/main|pied|ongle/.test(hay)) return 'Mains & Pieds';
  if (/creme|texture|produit|serum|compose-marin/.test(hay)) return 'Produits';
  if (/algue|mer|marin|mont-saint-michel|phytomer/.test(hay)) return 'Phytomer';
  if (/cabine|salon|institut|palezieux|accueil/.test(hay)) return 'Institut';
  return 'Bibliothèque';
}

function cleanAssetLabel(fileName: string, altText: string | null): string {
  if (altText && altText.trim().length > 2) return altText.trim();
  const withoutTs = (fileName || '')
    .replace(/^\d{10,}-/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!withoutTs) return 'Photo de la bibliothèque';
  return withoutTs.charAt(0).toUpperCase() + withoutTs.slice(1);
}

let mediaLibraryCache: Promise<MediaLibraryPhoto[]> | null = null;

/**
 * Charge toutes les images de la bibliothèque (`media_assets` dans Supabase)
 * et les complète avec `BRAND_PHOTOS` pour garantir une galerie toujours riche.
 */
export async function fetchMediaLibraryPhotos(forceRefresh = false): Promise<MediaLibraryPhoto[]> {
  if (forceRefresh) mediaLibraryCache = null;
  if (mediaLibraryCache) return mediaLibraryCache;

  mediaLibraryCache = Promise.resolve(
    supabase
      .from('media_assets')
      .select('id, file_name, url, alt_text')
      .order('created_at', { ascending: false })
      .limit(200),
  )
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        mediaLibraryCache = null;
        return BRAND_PHOTOS;
      }
      const seenUrls = new Set<string>();
      const list: MediaLibraryPhoto[] = [];

      for (const row of data as { id: string; file_name: string; url: string; alt_text: string | null }[]) {
        if (!row.url || seenUrls.has(row.url)) continue;
        // Ignorer les fichiers non-images éventuels (ex: pdf, mp4)
        if (/\.(pdf|mp4|webm|mov)$/i.test(row.url)) continue;
        seenUrls.add(row.url);
        list.push({
          id: `lib-${row.id}`,
          label: cleanAssetLabel(row.file_name, row.alt_text),
          category: inferCategoryFromAsset(row.file_name, row.alt_text || ''),
          url: row.url,
          fileName: row.file_name,
          fromLibrary: true,
        });
      }

      for (const fallback of BRAND_PHOTOS) {
        if (!seenUrls.has(fallback.url)) {
          seenUrls.add(fallback.url);
          list.push(fallback);
        }
      }

      return list.length > 0 ? list : BRAND_PHOTOS;
    })
    .catch(() => {
      mediaLibraryCache = null;
      return BRAND_PHOTOS;
    });

  return mediaLibraryCache;
}

const TOPIC_PHOTO_MATCHERS: {
  topicRegex: RegExp;
  fileHints: string[];
  categories: string[];
}[] = [
  {
    topicRegex: /epilation|cire|sucre|poil|jambes|maillot|aisselle|forfait douceur|forfait integral/,
    fileHints: ['epilation (1)', 'epilation', '1789998853978'],
    categories: ['Épilation'],
  },
  {
    topicRegex: /regard|cil|sourcil|rehaussement|lash|teinture|maquillage/,
    fileHints: ['1790593008713', '1790587847303', 'portrait (1)', 'portrait'],
    categories: ['Regard'],
  },
  {
    topicRegex: /massage|corps|dos|nuque|cranien|head spa|detente|lacher-prise|relaxant|echappee belle|voile de satin|bulles des mers|boue/,
    fileHints: ['1790587819698', 'soins-corps', 'massage'],
    categories: ['Massage'],
  },
  {
    topicRegex: /main|pied|manucure|ongle/,
    fileHints: ['textures-cremes', 'compose-marin'],
    categories: ['Mains & Pieds', 'Produits'],
  },
  {
    topicRegex: /creme|serum|produit|routine|maison|gommage|masque|texture/,
    fileHints: ['creme de soin', 'textures-cremes (1)', 'textures-cremes', 'compose-marin'],
    categories: ['Produits', 'Visage'],
  },
  {
    topicRegex: /cadeau|bon cadeau|offrir|fete|noel|anniversaire/,
    fileHints: ['algues-marines', 'cabine', '1791296588293', '1789999272375'],
    categories: ['Institut', 'Phytomer'],
  },
  {
    topicRegex: /cabine|institut|palezieux|accueil|cocon|rendez-vous|gare/,
    fileHints: ['cabine', '1791296588293', '1791296585438', '1789999272375'],
    categories: ['Institut'],
  },
  {
    topicRegex: /visage|hydra|eclat|jeunesse|anti-age|ride|fermete|peau|tiraille|froid|hiver|automne|ete|printemps|phytomer|marin|algue/,
    fileHints: ['1790587791640', 'soins-visages', '1790524738941', 'algues-marines', 'compose-marin', 'le-mont-saint-michel'],
    categories: ['Visage', 'Phytomer'],
  },
];

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Sélectionne obligatoirement et intelligemment la meilleure image de la bibliothèque
 * (`media_assets` en priorité, sinon `BRAND_PHOTOS`) en fonction du sujet du post.
 * Utilise `seedOffset` pour varier les photos sur une série de publications.
 */
export function pickBestLibraryPhoto(
  contextText: string,
  photos: MediaLibraryPhoto[] = BRAND_PHOTOS,
  seedOffset = 0,
): string {
  const pool = photos && photos.length > 0 ? photos : BRAND_PHOTOS;
  const libraryOnly = pool.filter((p) => p.fromLibrary);
  const activePool = libraryOnly.length > 0 ? libraryOnly : pool;

  const normText = normalizeSearchText(contextText || 'Emmanuelle Esthétique');
  const hash = simpleHash(normText) + Math.max(0, seedOffset);

  for (const rule of TOPIC_PHOTO_MATCHERS) {
    if (rule.topicRegex.test(normText)) {
      // 1. Chercher une correspondance par nom de fichier dans la bibliothèque
      const byHint = activePool.filter((p) => {
        const hay = normalizeSearchText(`${p.fileName || ''} ${p.label} ${p.url}`);
        return rule.fileHints.some((hint) => hay.includes(normalizeSearchText(hint)));
      });
      if (byHint.length > 0) {
        return byHint[hash % byHint.length].url;
      }

      // 2. Chercher par catégorie dans la bibliothèque
      const byCat = pool.filter((p) => rule.categories.includes(p.category));
      if (byCat.length > 0) {
        return byCat[hash % byCat.length].url;
      }
    }
  }

  // 3. Rotation harmonieuse sur toutes les photos de la bibliothèque
  return activePool[hash % activePool.length]?.url || BRAND_PHOTOS[0].url;
}


export interface SlideRenderOptions {
  canvas: HTMLCanvasElement;
  text: string;
  highlight?: string;
  number: number;
  total: number;
  dark: boolean;
  brand: BrandTokens;
  /** Thème visuel Emmanuelle Esthétique (optionnel). */
  theme?: SocialVisualTheme;
  /** URL de la photo de fond quand `theme === 'photo'`. */
  bgImageUrl?: string;
  /** Pastille affichée en haut du visuel (ex: "CONSEIL BEAUTÉ"). */
  badgeText?: string;
  /** Bouton / invitation en bas du visuel. */
  ctaText?: string;
  /** Fraction de la taille nominale. 1 pour le visuel exportable, moins pour une miniature. */
  scale?: number;
}

export interface HookCardOptions {
  canvas: HTMLCanvasElement;
  text: string;
  highlight?: string;
  dark: boolean;
  brand: BrandTokens;
  format: SocialCardFormat;
  /** Thème visuel Emmanuelle Esthétique (optionnel). */
  theme?: SocialVisualTheme;
  /** URL de la photo de fond quand `theme === 'photo'`. */
  bgImageUrl?: string;
  /** Pastille affichée en haut du visuel. */
  badgeText?: string;
  /** Bouton / invitation en bas du visuel (ex: fiche Google Business). */
  ctaText?: string;
  /** Fraction de la taille nominale. 1 pour le visuel exportable, moins pour une miniature. */
  scale?: number;
}

export interface StorySlideRenderOptions {
  canvas: HTMLCanvasElement;
  text: string;
  highlight?: string;
  number?: number;
  total?: number;
  dark?: boolean;
  brand: BrandTokens;
  theme?: SocialVisualTheme;
  bgImageUrl?: string;
  badgeText?: string;
  ctaText?: string;
  scale?: number;
}

/** Échelle des miniatures affichées dans les listes (~190 px de large). */
export const THUMBNAIL_SCALE = 0.25;

/** Cache mémoire des images chargées avec CORS pour un redessin instantané. */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined' || !url) return Promise.resolve(null);
  const cached = imageCache.get(url);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 6500);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

function ensureGoogleFontLink(family: string) {
  if (typeof document === 'undefined') return;
  const id = `social-card-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}

async function ensureFontsLoaded(brand: BrandTokens) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  ensureGoogleFontLink(brand.headingFont);
  ensureGoogleFontLink(brand.bodyFont);
  try {
    await Promise.all([
      document.fonts.load(`700 60px "${brand.headingFont}"`),
      document.fonts.load(`400 italic 44px "${brand.headingFont}"`),
      document.fonts.load(`600 26px "${brand.bodyFont}"`),
    ]);
    await document.fonts.ready;
  } catch {
    // Police toujours indisponible : on dessine avec le fallback système.
  }
}

const stripPunctuation = (w: string) => w.toLowerCase().replace(/^[.,!?;:«»"()’']+|[,!?;:«»"()’'.]+$/g, '');

function measureSpace(ctx: CanvasRenderingContext2D): number {
  return ctx.measureText('A A').width - ctx.measureText('AA').width;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const canvasRatio = width / height;
  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > canvasRatio) {
    drawH = height;
    drawW = height * imgRatio;
    offsetX = (width - drawW) / 2;
  } else {
    drawW = width;
    drawH = width / imgRatio;
    offsetY = (height - drawH) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

interface ResolvedPalette {
  fg: string;
  accent: string;
  mutedFg: string;
  frameStroke: string;
  pillBg: string;
  pillFg: string;
  ctaBg: string;
  ctaFg: string;
  eyebrow: string;
}

/**
 * Prépare l'arrière-plan (toujours illustré par une image de la bibliothèque)
 * et les couleurs d'habillage selon le thème choisi.
 */
async function renderThemeBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  brand: BrandTokens,
  dark: boolean,
  theme?: SocialVisualTheme,
  bgImageUrl?: string,
  contextText?: string,
): Promise<ResolvedPalette> {
  const activeTheme: SocialVisualTheme = theme || 'photo';
  const resolvedImgUrl = bgImageUrl || pickBestLibraryPhoto(contextText || brand.siteName || 'Emmanuelle Esthétique');
  const img = await loadCorsImage(resolvedImgUrl);

  if (activeTheme === 'photo') {
    if (img) {
      drawCoverImage(ctx, img, width, height);
    } else {
      const fallbackGrad = ctx.createLinearGradient(0, 0, width, height);
      fallbackGrad.addColorStop(0, '#3D342C');
      fallbackGrad.addColorStop(0.5, '#2A231E');
      fallbackGrad.addColorStop(1, '#1E2F33');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // Voile sombre chaleureux rgba(35, 30, 25, 0.58) enrichi en haut et en bas
    const veil = ctx.createLinearGradient(0, 0, 0, height);
    veil.addColorStop(0, 'rgba(30, 25, 20, 0.48)');
    veil.addColorStop(0.5, 'rgba(35, 30, 25, 0.56)');
    veil.addColorStop(1, 'rgba(24, 20, 16, 0.76)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, width, height);

    return {
      fg: '#FAF7F2',
      accent: '#DFC8A8',
      mutedFg: 'rgba(250, 247, 242, 0.76)',
      frameStroke: 'rgba(250, 247, 242, 0.24)',
      pillBg: 'rgba(250, 247, 242, 0.2)',
      pillFg: '#FAF7F2',
      ctaBg: '#FAF7F2',
      ctaFg: '#3A3730',
      eyebrow: 'PALÉZIEUX-GARE · INSTITUT DE BEAUTÉ',
    };
  }

  if (activeTheme === 'marin') {
    if (img) {
      drawCoverImage(ctx, img, width, height);
      const veil = ctx.createLinearGradient(0, 0, width, height);
      veil.addColorStop(0, dark ? 'rgba(20, 42, 48, 0.72)' : 'rgba(26, 52, 58, 0.70)');
      veil.addColorStop(1, dark ? 'rgba(32, 64, 72, 0.82)' : 'rgba(38, 73, 82, 0.80)');
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, width, height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (dark) {
        grad.addColorStop(0, '#193238');
        grad.addColorStop(1, '#264952');
      } else {
        grad.addColorStop(0, '#1E3A40');
        grad.addColorStop(1, '#2A4D54');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Halo lumineux subtil inspiré de l'eau marine Phytomer
    const radial = ctx.createRadialGradient(width * 0.5, height * 0.25, 40, width * 0.5, height * 0.25, width * 0.7);
    radial.addColorStop(0, 'rgba(96, 185, 194, 0.16)');
    radial.addColorStop(1, 'rgba(96, 185, 194, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    return {
      fg: '#FAF7F2',
      accent: '#60B9C2',
      mutedFg: 'rgba(250, 247, 242, 0.72)',
      frameStroke: 'rgba(96, 185, 194, 0.32)',
      pillBg: 'rgba(96, 185, 194, 0.24)',
      pillFg: '#FAF7F2',
      ctaBg: '#60B9C2',
      ctaFg: '#162C30',
      eyebrow: 'SOINS MARINS PHYTOMER · PALÉZIEUX',
    };
  }

  if (activeTheme === 'sauge') {
    if (img) {
      drawCoverImage(ctx, img, width, height);
    }
    if (dark) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, img ? 'rgba(65, 78, 56, 0.74)' : '#6F8060');
      grad.addColorStop(1, img ? 'rgba(47, 56, 43, 0.84)' : '#8A9A7B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      return {
        fg: '#FAF7F2',
        accent: '#F3E8D6',
        mutedFg: 'rgba(250, 247, 242, 0.75)',
        frameStroke: 'rgba(250, 247, 242, 0.28)',
        pillBg: 'rgba(250, 247, 242, 0.22)',
        pillFg: '#FAF7F2',
        ctaBg: '#FAF7F2',
        ctaFg: '#3A3730',
        eyebrow: 'BEAUTÉ NATURELLE · PALÉZIEUX-GARE',
      };
    } else {
      ctx.fillStyle = img ? 'rgba(235, 240, 232, 0.82)' : '#EBF0E8';
      ctx.fillRect(0, 0, width, height);
      return {
        fg: '#2F362B',
        accent: '#5C6F4D',
        mutedFg: 'rgba(47, 54, 43, 0.68)',
        frameStroke: 'rgba(138, 154, 123, 0.42)',
        pillBg: '#8A9A7B',
        pillFg: '#FAF7F2',
        ctaBg: '#3A3730',
        ctaFg: '#FAF7F2',
        eyebrow: 'BEAUTÉ NATURELLE · PALÉZIEUX-GARE',
      };
    }
  }

  if (activeTheme === 'citation') {
    if (img) {
      drawCoverImage(ctx, img, width, height);
      ctx.fillStyle = 'rgba(241, 234, 224, 0.84)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#F1EAE0';
      ctx.fillRect(0, 0, width, height);
    }

    // Grands guillemets décoratifs en filigrane
    ctx.save();
    ctx.font = `700 ${Math.round(width * 0.28)}px "${brand.headingFont}"`;
    ctx.fillStyle = 'rgba(138, 154, 123, 0.16)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('«', 68, 70);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('»', width - 68, height - 70);
    ctx.restore();

    return {
      fg: '#3A3730',
      accent: '#718262',
      mutedFg: 'rgba(58, 55, 48, 0.65)',
      frameStroke: 'rgba(58, 55, 48, 0.22)',
      pillBg: '#8A9A7B',
      pillFg: '#FAF7F2',
      ctaBg: '#3A3730',
      ctaFg: '#FAF7F2',
      eyebrow: 'CONSEIL BEAUTÉ · PALÉZIEUX-GARE',
    };
  }

  // Thème 'creme' (Éditorial Crème & Sauge sur photo de la bibliothèque voilée)
  if (img) {
    drawCoverImage(ctx, img, width, height);
  }
  ctx.fillStyle = img
    ? (dark ? 'rgba(243, 236, 225, 0.82)' : 'rgba(250, 247, 242, 0.82)')
    : (dark ? '#F3ECE1' : '#FAF7F2');
  ctx.fillRect(0, 0, width, height);

  return {
    fg: brand.dark || '#3A3730',
    accent: brand.accent || '#768767',
    mutedFg: 'rgba(58, 55, 48, 0.65)',
    frameStroke: 'rgba(138, 154, 123, 0.36)',
    pillBg: '#8A9A7B',
    pillFg: '#FAF7F2',
    ctaBg: '#3A3730',
    ctaFg: '#FAF7F2',
    eyebrow: 'PALÉZIEUX-GARE · INSTITUT DE BEAUTÉ',
  };
}

/**
 * Cœur de rendu partagé par les carrousels et les cartes d'accroche.
 */
async function drawCard(
  opts: {
    canvas: HTMLCanvasElement;
    text: string;
    highlight?: string;
    dark: boolean;
    brand: BrandTokens;
    theme?: SocialVisualTheme;
    bgImageUrl?: string;
    badgeText?: string;
    ctaText?: string;
    scale?: number;
  },
  spec: FormatSpec,
  counter?: { number: number; total: number },
): Promise<void> {
  const { canvas, text, highlight, dark, brand, theme, bgImageUrl, badgeText, ctaText } = opts;
  const { width: WIDTH, height: HEIGHT, paddingX: PADDING_X, paddingY: PADDING_Y } = spec;

  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  if (scale !== 1) ctx.setTransform(scale, 0, 0, scale, 0, 0);

  await ensureFontsLoaded(brand);

  const palette = await renderThemeBackground(ctx, WIDTH, HEIGHT, brand, dark, theme, bgImageUrl, text);

  // Filet intérieur éditorial fin
  const frameInset = Math.round(Math.min(WIDTH, HEIGHT) * 0.036);
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(frameInset, frameInset, WIDTH - frameInset * 2, HEIGHT - frameInset * 2);

  const edge = Math.max(54, Math.round(HEIGHT * 0.062));

  // En-tête : Pastille Conseil Beauté (si 'citation' ou badgeText fourni) ou surtitre discret
  const effectiveBadge = badgeText || (theme === 'citation' ? 'CONSEIL BEAUTÉ' : undefined);
  if (effectiveBadge && HEIGHT >= 750) {
    ctx.font = `600 21px "${brand.bodyFont}"`;
    const badgeLabel = effectiveBadge.toUpperCase();
    const textW = ctx.measureText(badgeLabel).width;
    const pillW = textW + 48;
    const pillH = 44;
    const pillX = counter ? PADDING_X : (WIDTH - pillW) / 2;
    const pillY = edge - 6;

    ctx.fillStyle = palette.pillBg;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 22);
    ctx.fill();

    ctx.fillStyle = palette.pillFg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeLabel, pillX + pillW / 2, pillY + pillH / 2 + 1);
  } else if (HEIGHT >= 750) {
    // Sous-titre discret en haut à gauche
    ctx.font = `600 19px "${brand.bodyFont}"`;
    ctx.fillStyle = palette.mutedFg;
    ctx.textAlign = counter ? 'left' : 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      palette.eyebrow,
      counter ? PADDING_X : WIDTH / 2,
      edge + 20,
    );
  }

  // Compteur de slide en haut à droite
  if (counter) {
    ctx.font = `600 24px "${brand.bodyFont}"`;
    ctx.fillStyle = palette.mutedFg;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      `${String(counter.number).padStart(2, '0')} / ${String(counter.total).padStart(2, '0')}`,
      WIDTH - PADDING_X,
      edge + 20,
    );
  }

  // Zone de texte centrale
  const extraBottomSpace = ctaText ? 68 : 0;
  const maxWidth = WIDTH - PADDING_X * 2;
  const maxHeight = HEIGHT - PADDING_Y * 2 - extraBottomSpace;
  const words = text.trim().split(/\s+/).filter(Boolean);

  const highlightWords = highlight ? highlight.trim().split(/\s+/).filter(Boolean) : [];
  let hlStart = -1;
  if (highlightWords.length > 0) {
    const lowerWords = words.map(stripPunctuation);
    const lowerHl = highlightWords.map(stripPunctuation);
    for (let i = 0; i <= lowerWords.length - lowerHl.length; i++) {
      if (lowerHl.every((hw, j) => lowerWords[i + j] === hw)) {
        hlStart = i;
        break;
      }
    }
  }
  const hlEnd = hlStart >= 0 ? hlStart + highlightWords.length - 1 : -1;

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
  const verticalCenterOffset = ctaText ? -24 : 0;
  let y = (HEIGHT - totalTextHeight) / 2 + fontSize * 0.82 + verticalCenterOffset;

  // Petit filet décoratif au-dessus du texte sur les grands formats
  if (HEIGHT >= 850) {
    const lineY = y - fontSize * 0.82 - 32;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 32, lineY);
    ctx.lineTo(WIDTH / 2 + 32, lineY);
    ctx.stroke();
  }

  for (const line of lines) {
    const wordWidths = line.words.map((w) => ctx.measureText(w).width);
    const lineWidth = wordWidths.reduce((sum, w) => sum + w, 0) + spaceWidth * (line.words.length - 1);
    let x = (WIDTH - lineWidth) / 2;

    let wIdx = line.startIdx;
    for (let k = 0; k < line.words.length; k++, wIdx++) {
      const isHl = hlStart >= 0 && wIdx >= hlStart && wIdx <= hlEnd;
      ctx.fillStyle = isHl ? palette.accent : palette.fg;
      ctx.fillText(line.words[k], x, y);
      x += wordWidths[k] + spaceWidth;
    }
    y += lineHeight;
  }

  // Bouton / pastille d'invitation en bas (ex: Fiche Google Business)
  if (ctaText) {
    ctx.font = `600 22px "${brand.bodyFont}"`;
    const ctaW = Math.min(WIDTH - PADDING_X * 2, ctx.measureText(ctaText).width + 56);
    const ctaH = 52;
    const ctaX = (WIDTH - ctaW) / 2;
    const ctaY = HEIGHT - edge - 88;

    ctx.fillStyle = palette.ctaBg;
    drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 26);
    ctx.fill();

    ctx.fillStyle = palette.ctaFg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctaText, WIDTH / 2, ctaY + ctaH / 2 + 1);
  }

  // Signature du pied de carte
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (theme === 'citation') {
    ctx.font = `400 italic 28px "${brand.headingFont}"`;
    ctx.fillStyle = palette.fg;
    ctx.fillText(`${brand.siteName || 'Emmanuelle Esthétique'} · Palézieux-Gare`, WIDTH / 2, HEIGHT - edge);
  } else {
    ctx.font = `600 22px "${brand.bodyFont}"`;
    ctx.fillStyle = palette.mutedFg;
    ctx.fillText((brand.siteName || 'Emmanuelle Esthétique').toUpperCase(), WIDTH / 2, HEIGHT - edge);
  }

  ctx.restore();
}

/** Slide de carrousel Instagram (portrait 4:5), numérotée. */
export async function renderCarouselSlide(opts: SlideRenderOptions): Promise<void> {
  const { canvas, text, highlight, dark, brand, number, total, theme, bgImageUrl, badgeText, ctaText, scale } = opts;
  await drawCard(
    { canvas, text, highlight, dark, brand, theme, bgImageUrl, badgeText, ctaText, scale },
    CARD_FORMATS['instagram-portrait'],
    { number, total },
  );
}

/**
 * Visuel unique portant le hook, au format de la plateforme visée
 * (LinkedIn carré, Facebook paysage, Google Business 4:3, etc.).
 */
export async function renderHookCard(opts: HookCardOptions): Promise<void> {
  const { canvas, text, highlight, dark, brand, format, theme, bgImageUrl, badgeText, ctaText, scale } = opts;
  await drawCard(
    { canvas, text, highlight, dark, brand, theme, bgImageUrl, badgeText, ctaText, scale },
    CARD_FORMATS[format],
  );
}

/**
 * Rendu dédié aux Stories verticales 9:16 (1080 × 1920) :
 * - Barre d'étape de Story en haut + pastille d'étape (« 01 · ACCROCHE », « 02 · LE SOIN », « 03 · RENDEZ-VOUS »)
 * - Texte central impactant en grand corps
 * - Pilule d'invitation en bas + signature Palézieux-Gare
 */
export async function renderStorySlide(opts: StorySlideRenderOptions): Promise<void> {
  const {
    canvas,
    text,
    highlight,
    number = 1,
    total = 3,
    dark = false,
    brand,
    theme = 'photo',
    bgImageUrl,
    badgeText,
    ctaText,
    scale: rawScale,
  } = opts;

  const spec = CARD_FORMATS['instagram-story'];
  const { width: WIDTH, height: HEIGHT, paddingX: PADDING_X, paddingY: PADDING_Y } = spec;

  const scale = rawScale && rawScale > 0 ? rawScale : 1;
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  if (scale !== 1) ctx.setTransform(scale, 0, 0, scale, 0, 0);

  await ensureFontsLoaded(brand);

  const palette = await renderThemeBackground(ctx, WIDTH, HEIGHT, brand, dark, theme, bgImageUrl, text);

  // Cadre fin intérieur adapté au format vertical
  const frameInset = 42;
  ctx.strokeStyle = palette.frameStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(frameInset, frameInset, WIDTH - frameInset * 2, HEIGHT - frameInset * 2);

  // Barres de progression Story en haut
  const barTop = 86;
  const barGap = 14;
  const totalBars = Math.max(1, total);
  const barWidth = (WIDTH - PADDING_X * 2 - barGap * (totalBars - 1)) / totalBars;
  for (let i = 0; i < totalBars; i++) {
    ctx.fillStyle = i < number ? palette.accent : palette.frameStroke;
    drawRoundedRect(ctx, PADDING_X + i * (barWidth + barGap), barTop, barWidth, 6, 3);
    ctx.fill();
  }

  // Pastille d'étape en haut
  const defaultStepLabels = ['L’OBSERVATION', 'LE SECRET DE SOIN', 'VOTRE PARENTHÈSE'];
  const stepText = (badgeText || defaultStepLabels[(number - 1) % defaultStepLabels.length] || `ÉTAPE ${number}/${total}`).toUpperCase();
  ctx.font = `600 22px "${brand.bodyFont}"`;
  const pillW = ctx.measureText(stepText).width + 56;
  const pillH = 50;
  const pillX = (WIDTH - pillW) / 2;
  const pillY = 148;

  ctx.fillStyle = palette.pillBg;
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 25);
  ctx.fill();

  ctx.fillStyle = palette.pillFg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stepText, WIDTH / 2, pillY + pillH / 2 + 1);

  // Texte central impactant
  const maxWidth = WIDTH - PADDING_X * 2;
  const maxHeight = HEIGHT - PADDING_Y * 2 - 140;
  const words = text.trim().split(/\s+/).filter(Boolean);

  const highlightWords = highlight ? highlight.trim().split(/\s+/).filter(Boolean) : [];
  let hlStart = -1;
  if (highlightWords.length > 0) {
    const lowerWords = words.map(stripPunctuation);
    const lowerHl = highlightWords.map(stripPunctuation);
    for (let i = 0; i <= lowerWords.length - lowerHl.length; i++) {
      if (lowerHl.every((hw, j) => lowerWords[i + j] === hw)) {
        hlStart = i;
        break;
      }
    }
  }
  const hlEnd = hlStart >= 0 ? hlStart + highlightWords.length - 1 : -1;

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
  let lineHeight = fontSize * 1.26;
  while (fontSize > spec.minFontSize && lines.length * lineHeight > maxHeight) {
    fontSize -= 4;
    lines = layoutAt(fontSize);
    lineHeight = fontSize * 1.26;
  }

  ctx.font = `700 ${fontSize}px "${brand.headingFont}"`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const spaceWidth = measureSpace(ctx);

  const totalTextHeight = lines.length * lineHeight;
  let y = (HEIGHT - totalTextHeight) / 2 + fontSize * 0.8;

  // Filet décoratif supérieur
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 40, y - fontSize * 0.8 - 44);
  ctx.lineTo(WIDTH / 2 + 40, y - fontSize * 0.8 - 44);
  ctx.stroke();

  for (const line of lines) {
    const wordWidths = line.words.map((w) => ctx.measureText(w).width);
    const lineWidth = wordWidths.reduce((sum, w) => sum + w, 0) + spaceWidth * (line.words.length - 1);
    let x = (WIDTH - lineWidth) / 2;

    let wIdx = line.startIdx;
    for (let k = 0; k < line.words.length; k++, wIdx++) {
      const isHl = hlStart >= 0 && wIdx >= hlStart && wIdx <= hlEnd;
      ctx.fillStyle = isHl ? palette.accent : palette.fg;
      ctx.fillText(line.words[k], x, y);
      x += wordWidths[k] + spaceWidth;
    }
    y += lineHeight;
  }

  // Pilule d'invitation en bas de la Story
  const effectiveCta =
    ctaText ||
    (number === total
      ? 'Réserver votre soin · Lien en bio'
      : 'Toucher pour la suite →');

  ctx.font = `600 24px "${brand.bodyFont}"`;
  const ctaW = Math.min(WIDTH - PADDING_X * 2, ctx.measureText(effectiveCta).width + 72);
  const ctaH = 64;
  const ctaX = (WIDTH - ctaW) / 2;
  const ctaY = HEIGHT - 280;

  ctx.fillStyle = number === total ? palette.ctaBg : palette.pillBg;
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, 32);
  ctx.fill();

  ctx.fillStyle = number === total ? palette.ctaFg : palette.pillFg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(effectiveCta, WIDTH / 2, ctaY + ctaH / 2 + 1);

  // Signature en pied de Story
  ctx.font = `600 22px "${brand.bodyFont}"`;
  ctx.fillStyle = palette.mutedFg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    `${(brand.siteName || 'Emmanuelle Esthétique').toUpperCase()} · PALÉZIEUX-GARE`,
    WIDTH / 2,
    HEIGHT - 130,
  );

  ctx.restore();
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
