/**
 * Images optimisées à la volée (redimensionnées, converties en WebP, cache long)
 * par l'endpoint `/_next/image` — servi par Next en local et par l'Image CDN de
 * Netlify en production.
 *
 * Les images des pages viennent de la base (contenu éditable, hébergées sur
 * Cloudflare R2 sans en-tête de cache) : on ne peut pas les redimensionner à la
 * main. Ce module fabrique le `srcset` d'un `<img>` ordinaire — les styles, les
 * classes et la parallaxe des blocs restent donc exactement les mêmes, ce que
 * `next/image` (qui impose son propre style en ligne) ne garantirait pas.
 *
 * Pur et sans dépendance : utilisable côté serveur comme dans un composant client.
 */

/**
 * Largeurs demandées. Elles doivent figurer dans `images.deviceSizes` /
 * `imageSizes` (valeurs par défaut de Next, non redéfinies dans next.config.ts),
 * sinon l'endpoint répond 400 et l'image disparaît.
 */
export const IMAGE_WIDTHS = [384, 640, 828, 1200, 1920] as const;

/**
 * Qualités autorisées : doivent figurer dans `images.qualities` (next.config.ts), sinon l'optimiseur répond 400.
 * 75 partout ; 70 pour l'image d'en-tête (LCP), où le poids compte plus que la finesse.
 */
export const QUALITY = 75;
export const QUALITY_HERO = 70;

// Doit refléter `images.remotePatterns` de next.config.ts : une URL qui n'y
// figure pas ferait répondre 400 à l'optimiseur.
const REMOTE_HOSTS: (string | RegExp)[] = [
  /\.r2\.dev$/,
  /\.supabase\.co$/,
  'images.unsplash.com',
  'images.pexels.com',
];

const R2_PUBLIC_URL =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL : '') || '';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const R2_HOST = R2_PUBLIC_URL ? hostOf(R2_PUBLIC_URL) : '';

/** Vrai si l'image peut passer par l'optimiseur (hôte autorisé, format raster non animé). */
export function isOptimizable(url: string | undefined | null): url is string {
  if (!url || !/^https:\/\//i.test(url)) return false;
  const host = hostOf(url);
  if (!host) return false;
  const allowed = host === R2_HOST || REMOTE_HOSTS.some((h) => (typeof h === 'string' ? h === host : h.test(host)));
  if (!allowed) return false;
  // SVG : déjà vectoriel. GIF : l'optimiseur en ferait une image fixe.
  const path = url.split(/[?#]/)[0].toLowerCase();
  return !/\.(svg|gif)$/.test(path);
}

export function optimizedUrl(url: string, width: number, quality: number = QUALITY): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

export interface OptimizedImgProps {
  src: string;
  srcSet?: string;
  sizes?: string;
}

/**
 * `src`, `srcSet` et `sizes` d'un `<img>`. Sans `sizes`, le navigateur suppose
 * 100vw : passer une valeur réaliste (largeur réelle de l'image dans la page).
 * URL non optimisable → l'URL d'origine, inchangée.
 */
export function optimizedImgProps(url: string, sizes: string, widths: readonly number[] = IMAGE_WIDTHS, quality: number = QUALITY): OptimizedImgProps {
  if (!isOptimizable(url)) return { src: url };
  return {
    // Repli des navigateurs sans srcset, et valeur retenue par les robots.
    src: optimizedUrl(url, widths[Math.min(2, widths.length - 1)], quality),
    srcSet: widths.map((w) => `${optimizedUrl(url, w, quality)} ${w}w`).join(', '),
    sizes,
  };
}
