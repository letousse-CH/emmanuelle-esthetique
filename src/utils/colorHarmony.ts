/**
 * Fabrication d'une palette cohérente à partir d'une seule couleur.
 *
 * Le panneau « Design & Style » demandait six couleurs sans dire comment les
 * accorder. Choisir un primaire est à la portée de tout le monde ; choisir un
 * fond, une surface, deux niveaux de texte et une bordure qui tiennent ensemble
 * est un métier. On dérive donc les cinq autres de la première, selon une
 * harmonie explicite.
 *
 * Deux garde-fous, vérifiés par le code et non laissés au jugement :
 *
 * — **Le texte reste lisible.** La luminosité du texte et du texte secondaire
 *   est poussée jusqu'à atteindre le seuil AA du WCAG sur le fond retenu
 *   (4,5:1 pour le texte courant, 4,5:1 aussi pour le secondaire, qui porte de
 *   l'information). Une palette jolie mais illisible n'est pas une palette.
 *
 * — **Rien n'est inventé hors de la teinte choisie**, sauf harmonie qui le
 *   demande explicitement (complémentaire, analogue).
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export type Harmony = 'camaieu' | 'complementaire' | 'analogue' | 'neutre';

export interface HarmonySpec {
  id: Harmony;
  label: string;
  description: string;
}

export const HARMONIES: HarmonySpec[] = [
  { id: 'camaieu', label: 'Camaïeu', description: 'Tout dans votre teinte. Doux, très sûr, un peu sage.' },
  { id: 'complementaire', label: 'Complémentaire', description: 'Le texte prend la teinte opposée. Contrasté, affirmé.' },
  { id: 'analogue', label: 'Analogue', description: 'Une teinte voisine pour le texte. Nuancé sans heurt.' },
  { id: 'neutre', label: 'Neutre', description: 'Votre couleur en accent, le reste en gris. Le plus discret.' },
];

// ── Conversions ────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / delta + 2) * 60;
    else h = ((rn - gn) / delta + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;

  const [r, g, b] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] : [c, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb[0], rgb[1], rgb[2]) : null;
}

// ── Contraste ──────────────────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Ajuste la luminosité d'une couleur jusqu'à ce qu'elle atteigne le contraste
 * demandé sur un fond donné. On s'éloigne du fond, jamais l'inverse : une
 * couleur de texte doit devenir plus sombre sur clair, plus claire sur sombre.
 */
function ensureContrast(color: Hsl, background: string, target: number): Hsl {
  const backgroundIsLight = relativeLuminance(background) > 0.4;
  const step = backgroundIsLight ? -2 : 2;
  const adjusted = { ...color };

  for (let i = 0; i < 50; i += 1) {
    if (contrastRatio(hslToHex(adjusted), background) >= target) break;
    adjusted.l = Math.max(0, Math.min(100, adjusted.l + step));
    if (adjusted.l === 0 || adjusted.l === 100) break;
  }
  return adjusted;
}

// ── Génération ─────────────────────────────────────────────────────────────

export interface GeneratedPalette extends Record<string, string> {
  style_color_primary: string;
  style_color_bg: string;
  style_color_surface: string;
  style_color_text: string;
  style_color_text_muted: string;
  style_color_border: string;
}

/**
 * Décline une palette complète.
 *
 * `dark` bascule l'ambiance : même teinte de base, fond sombre. Ce n'est pas
 * une inversion mécanique — sur fond sombre, la surface s'éclaircit au lieu de
 * s'assombrir, sinon les cartes disparaissent dans la page.
 */
export function generatePalette(
  baseHex: string,
  harmony: Harmony = 'camaieu',
  dark = false,
): GeneratedPalette | null {
  const base = hexToHsl(baseHex);
  if (!base) return null;

  // Un primaire trop pâle ou trop terne ne tient pas le rôle d'accent.
  const rawPrimary: Hsl = {
    h: base.h,
    s: Math.max(base.s, 18),
    l: Math.min(Math.max(base.l, dark ? 45 : 28), dark ? 72 : 62),
  };

  const textHue =
    harmony === 'complementaire' ? base.h + 180 :
    harmony === 'analogue' ? base.h + 32 :
    base.h;

  const tintSat = harmony === 'neutre' ? 0 : Math.min(base.s, 30);

  const bg: Hsl = dark
    ? { h: base.h, s: tintSat * 0.35, l: 8 }
    : { h: base.h, s: tintSat * 0.25, l: 98 };
  const surface: Hsl = dark
    ? { h: base.h, s: tintSat * 0.3, l: 14 }
    : { h: base.h, s: tintSat * 0.2, l: 100 };
  const border: Hsl = dark
    ? { h: base.h, s: tintSat * 0.3, l: 22 }
    : { h: base.h, s: tintSat * 0.35, l: 90 };

  const bgHex = hslToHex(bg);

  /*
    Le primaire sert aussi de couleur de lien (`.text-primary`). Un jaune ou un
    vert clair posé tel quel sur un fond blanc tombait à 1,6:1 — invisible. On
    l'assombrit (ou on l'éclaircit sur fond sombre) jusqu'au seuil AA, en
    gardant sa teinte et sa saturation : l'accent reste reconnaissable.
  */
  const primary = ensureContrast(rawPrimary, bgHex, 4.5);

  const text = ensureContrast(
    { h: textHue, s: harmony === 'neutre' ? 6 : Math.min(base.s * 0.45, 30), l: dark ? 96 : 16 },
    bgHex,
    7,
  );
  const muted = ensureContrast(
    { h: textHue, s: harmony === 'neutre' ? 5 : Math.min(base.s * 0.3, 22), l: dark ? 72 : 42 },
    bgHex,
    4.5,
  );

  return {
    style_color_primary: baseHex.toUpperCase(),
    style_color_bg: bgHex,
    style_color_surface: hslToHex(surface),
    style_color_text: hslToHex(text),
    style_color_text_muted: hslToHex(muted),
    style_color_border: hslToHex(border),
  };
}

// ── Extraction depuis une image ────────────────────────────────────────────

/**
 * Teintes dominantes d'une image.
 *
 * Quantification simple : on réduit l'image, on regroupe les pixels par paquets
 * de couleur, on écarte le presque-blanc, le presque-noir et le gris — un logo
 * posé sur fond blanc rendrait sinon « blanc » comme couleur dominante — puis on
 * retient les paquets les plus fournis, en évitant deux teintes voisines.
 *
 * Lève une erreur explicite si l'image refuse d'être lue : un fichier servi
 * sans en-tête CORS ne peut pas être analysé dans le navigateur, et c'est une
 * information utile à afficher plutôt qu'un échec muet.
 */
export async function extractColorsFromImage(src: string, count = 6): Promise<string[]> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("L'image n'a pas pu être chargée."));
  });

  const size = 120;
  const canvas = document.createElement('canvas');
  const ratio = image.naturalWidth / image.naturalHeight || 1;
  canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
  canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Analyse impossible sur cet appareil.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    throw new Error(
      "Ce fichier n'autorise pas son analyse depuis le navigateur. Téléversez-le dans vos médias, puis réessayez.",
    );
  }

  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;

    const { s, l } = rgbToHsl(r, g, b);
    if (l > 92 || l < 8 || s < 10) continue; // fonds et gris : sans intérêt

    const key = [r, g, b].map((v) => Math.round(v / 24)).join(',');
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));

  // Deux teintes trop proches n'apportent rien : on garde la plus représentée.
  const distinct: string[] = [];
  for (const hex of sorted) {
    const hsl = hexToHsl(hex);
    if (!hsl) continue;
    const tooClose = distinct.some((kept) => {
      const other = hexToHsl(kept);
      if (!other) return false;
      const delta = Math.min(Math.abs(other.h - hsl.h), 360 - Math.abs(other.h - hsl.h));
      return delta < 22 && Math.abs(other.l - hsl.l) < 18;
    });
    if (!tooClose) distinct.push(hex);
    if (distinct.length >= count) break;
  }

  if (distinct.length === 0) throw new Error("Aucune couleur franche n'a été trouvée dans cette image.");
  return distinct;
}

// ── Boutons ────────────────────────────────────────────────────────────────

/**
 * Styles de bouton proposés automatiquement.
 *
 * Dix-huit couleurs à renseigner — fond, texte, bordure, et les mêmes au
 * survol, pour trois variantes — c'est le genre de formulaire qu'on abandonne.
 * On propose donc trois traitements cohérents, dérivés de la palette, que l'on
 * retouche ensuite si on y tient.
 *
 * Le texte de chaque bouton est vérifié contre son propre fond : un bouton
 * dont le libellé ne se lit pas n'est pas un bouton.
 */
export type ButtonStyleId = 'plein' | 'contour' | 'doux';

export interface ButtonStyleSpec {
  id: ButtonStyleId;
  label: string;
  description: string;
}

export const BUTTON_STYLES: ButtonStyleSpec[] = [
  { id: 'plein', label: 'Plein', description: 'Aplat de couleur. L’action se voit de loin.' },
  { id: 'contour', label: 'Contour', description: 'Trait fin, fond transparent. Discret et net.' },
  { id: 'doux', label: 'Doux', description: 'Teinte claire de votre couleur. Posé, peu agressif.' },
];

/** Noir ou blanc — celui des deux qui se lit le mieux sur ce fond. */
function readableOn(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#111111', background)
    ? '#FFFFFF'
    : '#111111';
}

/** Décale la luminosité d'une couleur, sans toucher à sa teinte. */
function shift(hex: string, delta: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ ...hsl, l: Math.max(0, Math.min(100, hsl.l + delta)) });
}

export interface PaletteInput {
  primary: string;
  bg: string;
  surface: string;
  text: string;
  border: string;
}

/** Les dix-huit jetons de bouton, dérivés de la palette. */
export function generateButtonStyles(
  palette: PaletteInput,
  style: ButtonStyleId,
): Record<string, string> {
  const { primary, bg, surface, text, border } = palette;
  const bgIsDark = relativeLuminance(bg) < 0.4;
  const towardContrast = bgIsDark ? 8 : -8;

  // Teinte très claire du primaire, posée sur le fond : sert au style « doux ».
  const primaryHsl = hexToHsl(primary);
  const soft = primaryHsl
    ? hslToHex({ h: primaryHsl.h, s: Math.min(primaryHsl.s, 45), l: bgIsDark ? 18 : 93 })
    : surface;

  /*
    Couleur d'accent lisible sur une surface donnée. Le primaire posé tel quel
    sur une surface teintée — le fond d'un bouton discret au survol, un aplat
    doux — pouvait tomber à 3,5:1 : lisible pour un œil neuf, plus du tout à
    la fin de la journée.
  */
  const accentOn = (surfaceHex: string) =>
    primaryHsl ? hslToHex(ensureContrast(primaryHsl, surfaceHex, 4.5)) : text;

  if (style === 'contour') {
    return {
      style_btn_primary_bg: 'transparent',
      style_btn_primary_text: primary,
      style_btn_primary_border: primary,
      style_btn_primary_hover_bg: primary,
      style_btn_primary_hover_text: readableOn(primary),
      style_btn_primary_hover_border: primary,

      style_btn_secondary_bg: 'transparent',
      style_btn_secondary_text: text,
      style_btn_secondary_border: border,
      style_btn_secondary_hover_bg: surface,
      style_btn_secondary_hover_text: text,
      style_btn_secondary_hover_border: text,

      style_btn_ghost_bg: 'transparent',
      style_btn_ghost_text: text,
      style_btn_ghost_border: 'transparent',
      style_btn_ghost_hover_bg: surface,
      style_btn_ghost_hover_text: accentOn(surface),
      style_btn_ghost_hover_border: 'transparent',
    };
  }

  if (style === 'doux') {
    const softHover = shift(soft, bgIsDark ? 6 : -6);
    return {
      style_btn_primary_bg: soft,
      style_btn_primary_text: accentOn(soft),
      style_btn_primary_border: 'transparent',
      // Le libellé est recalculé sur le fond **du survol** : l'aplat change de
      // luminosité, le texte doit suivre.
      style_btn_primary_hover_bg: softHover,
      style_btn_primary_hover_text: accentOn(softHover),
      style_btn_primary_hover_border: 'transparent',

      style_btn_secondary_bg: surface,
      style_btn_secondary_text: text,
      style_btn_secondary_border: border,
      style_btn_secondary_hover_bg: shift(surface, towardContrast / 2),
      style_btn_secondary_hover_text: text,
      style_btn_secondary_hover_border: border,

      style_btn_ghost_bg: 'transparent',
      style_btn_ghost_text: text,
      style_btn_ghost_border: 'transparent',
      style_btn_ghost_hover_bg: soft,
      style_btn_ghost_hover_text: accentOn(soft),
      style_btn_ghost_hover_border: 'transparent',
    };
  }

  // « Plein » — le cas par défaut.
  const onPrimary = readableOn(primary);
  return {
    style_btn_primary_bg: primary,
    style_btn_primary_text: onPrimary,
    style_btn_primary_border: primary,
    style_btn_primary_hover_bg: shift(primary, towardContrast),
    style_btn_primary_hover_text: onPrimary,
    style_btn_primary_hover_border: shift(primary, towardContrast),

    style_btn_secondary_bg: 'transparent',
    style_btn_secondary_text: text,
    style_btn_secondary_border: border,
    style_btn_secondary_hover_bg: surface,
    style_btn_secondary_hover_text: text,
    style_btn_secondary_hover_border: text,

    style_btn_ghost_bg: 'transparent',
    style_btn_ghost_text: text,
    style_btn_ghost_border: 'transparent',
    style_btn_ghost_hover_bg: surface,
    style_btn_ghost_hover_text: accentOn(surface),
    style_btn_ghost_hover_border: 'transparent',
  };
}
