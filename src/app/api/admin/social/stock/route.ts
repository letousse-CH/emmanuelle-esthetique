import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { getSecretOrEnv } from '../../../../../services/secrets';

/**
 * Recherche de vidéos libres de droits (Pexels) pour les Reels.
 *
 * GET ?q=facial+massage → vidéos verticales, avec le fichier MP4 le plus
 * proche de 1080 × 1920 et le nom de l'auteur (crédit). La clé Pexels reste
 * sur le serveur. Les fichiers de videos.pexels.com sont servis avec un CORS
 * ouvert : le navigateur peut les monter directement dans le canvas.
 * GET sans q → { configured } (la clé est-elle renseignée ?).
 */
export const runtime = 'nodejs';

interface PexelsFile { link: string; width: number; height: number; file_type: string; quality: string | null }
interface PexelsVideo {
  id: number;
  duration: number;
  image: string;
  url: string;
  user: { name: string };
  video_files: PexelsFile[];
}

export async function GET(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  const key = await getSecretOrEnv('pexels_api_key');
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return NextResponse.json({ configured: Boolean(key) });
  if (!key) {
    return NextResponse.json({ error: 'Clé Pexels absente : Réseaux sociaux › Comptes › Banque de vidéos.' }, { status: 501 });
  }

  const url = `https://api.pexels.com/videos/search?${new URLSearchParams({ query: q, orientation: 'portrait', size: 'medium', per_page: '15' })}`;
  try {
    const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
    if (res.status === 401) return NextResponse.json({ error: 'Pexels refuse la clé : vérifiez-la.' }, { status: 502 });
    if (!res.ok) return NextResponse.json({ error: `Pexels indisponible (${res.status}).` }, { status: 502 });
    const data = (await res.json()) as { videos?: PexelsVideo[] };
    const videos = (data.videos ?? [])
      .map((v) => {
        // Le MP4 vertical le plus proche de 1080 px de large, sans dépasser 1440.
        const file = v.video_files
          .filter((f) => f.file_type === 'video/mp4' && f.height > f.width && f.width <= 1440)
          .sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080))[0];
        return file ? { id: v.id, duration: v.duration, thumb: v.image, url: file.link, width: file.width, height: file.height, credit: v.user?.name || 'Pexels', page: v.url } : null;
      })
      .filter(Boolean);
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ error: 'Pexels ne répond pas. Réessayez.' }, { status: 504 });
  }
}
