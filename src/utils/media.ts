/**
 * Réécriture des URLs de médias.
 *
 * Historique : les médias étaient stockés dans le bucket `medias` de Supabase
 * Storage avant la bascule vers Cloudflare R2. `proxyUrl` réécrit à la volée
 * les anciennes URLs encore présentes en base vers R2, quand R2 est configuré.
 *
 * Le préfixe Supabase est dérivé de NEXT_PUBLIC_SUPABASE_URL : il ne doit pas
 * être codé en dur, sinon un site cloné depuis ce template continue de pointer
 * sur le projet Supabase d'origine.
 */
const SUPABASE_URL =
  (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    : '') || '';

const SUPABASE_MEDIAS = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/medias/`
  : '';

export const R2_PUBLIC_URL =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL : '') ||
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_R2_PUBLIC_URL : '') ||
  '';

export function proxyUrl(url: string): string {
  if (!url) return url;
  // Anciennes URLs Supabase Storage → réécrites vers R2 si R2 est configuré.
  if (SUPABASE_MEDIAS && url.startsWith(SUPABASE_MEDIAS)) {
    const filename = url.slice(SUPABASE_MEDIAS.length);
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${filename}` : url;
  }
  return url;
}
