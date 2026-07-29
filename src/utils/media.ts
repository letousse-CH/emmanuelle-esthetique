const SUPABASE_MEDIAS = 'https://xyzyhzdabmbqyycxcpgl.supabase.co/storage/v1/object/public/medias/';

export const R2_PUBLIC_URL = 
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL : '') || 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_R2_PUBLIC_URL : '') || 
  '';

export function proxyUrl(url: string): string {
  if (!url) return url;
  // Anciens URLs Supabase → redirigés vers R2
  if (url.startsWith(SUPABASE_MEDIAS)) {
    const filename = url.slice(SUPABASE_MEDIAS.length);
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${filename}` : url;
  }
  return url;
}

