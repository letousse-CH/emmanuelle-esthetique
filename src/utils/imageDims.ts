/**
 * Dimensions d'une image distante, lues dans l'en-tête du fichier (côté serveur).
 *
 * Le contenu des pages ne stocke pas la taille des photos ; sans `width` et
 * `height` sur le `<img>`, le navigateur ne réserve aucune place avant le
 * chargement et la page saute (CLS). On lit donc les premiers Ko de chaque
 * image (requête `Range`) et on en tire les dimensions — sans dépendance, pour
 * JPEG, PNG, WebP et GIF. Le résultat est gardé en mémoire : un rendu ISR
 * toutes les 60 s ne relit pas les mêmes fichiers.
 *
 * Toute erreur (hôte injoignable, format inconnu, délai dépassé) renvoie `null` :
 * l'image s'affiche alors comme avant, sans dimensions.
 */
export interface ImageDims { w: number; h: number }

const HEAD_BYTES = 128 * 1024;
// Large : une image que R2 n'a pas en cache met parfois plus de 10 s à répondre (mesuré). Une dimension
// manquante coûte un décalage de mise en page ; l'attente, elle, ne pèse que sur le rendu ISR en arrière-plan.
const TIMEOUT_MS = 15000;
const MEMO = new Map<string, ImageDims>();

export function parseImageDims(b: Uint8Array): ImageDims | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const len = b.length;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

  // PNG
  if (len >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') return { w: dv.getUint32(16), h: dv.getUint32(20) };
  // GIF
  if (len >= 10 && ascii(0, 3) === 'GIF') return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
  // WebP
  if (len >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = dv.getUint32(21, true);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') {
      return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
    return null;
  }
  // JPEG : on saute les segments jusqu'au premier « Start Of Frame ».
  if (len >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < len) {
      if (b[o] !== 0xff) { o++; continue; }
      const marker = b[o + 1];
      if (marker === 0xff) { o++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const segLen = dv.getUint16(o + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { w: dv.getUint16(o + 7), h: dv.getUint16(o + 5) };
      o += 2 + segLen;
    }
  }
  return null;
}

async function readHead(url: string): Promise<Uint8Array | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, signal: ctl.signal });
    if (!res.ok || !res.body) return null;
    // Un serveur qui ignore `Range` renvoie tout le fichier : on s'arrête à HEAD_BYTES.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    reader.cancel().catch(() => {});
    const out = new Uint8Array(Math.min(total, HEAD_BYTES));
    let off = 0;
    for (const c of chunks) {
      if (off >= out.length) break;
      out.set(c.subarray(0, out.length - off), off);
      off += c.length;
    }
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getImageDims(url: string): Promise<ImageDims | null> {
  const known = MEMO.get(url);
  if (known) return known;
  const head = await readHead(url);
  const dims = head ? parseImageDims(head) : null;
  if (dims && dims.w > 0 && dims.h > 0) {
    MEMO.set(url, dims);
    return dims;
  }
  return null;
}

/** Dimensions de plusieurs images, indexées par URL (les échecs sont omis). */
export async function getImageDimsMap(urls: string[]): Promise<Record<string, ImageDims>> {
  const unique = [...new Set(urls)];
  const found = await Promise.all(unique.map(async (u) => [u, await getImageDims(u)] as const));
  const out: Record<string, ImageDims> = {};
  for (const [u, d] of found) if (d) out[u] = d;
  return out;
}
