import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { getR2PublicUrl } from '../../../../../utils/r2Config';

/**
 * Relais des photos (et des musiques des Reels) de la médiathèque.
 *
 * Le bucket R2 n'envoie pas d'en-tête CORS : une photo chargée directement
 * « salirait » le canvas, qui refuserait alors d'exporter le JPEG, et une
 * musique ne pourrait pas être décodée pour le montage. Servies depuis le
 * site, elles deviennent de même origine. Réservé à l'admin, et limité aux
 * hôtes de la médiathèque (pas de relais ouvert vers n'importe quelle URL).
 * Netlify limite une réponse à 6 Mo : les musiques s'en tiennent à 4 Mo.
 */
export const runtime = 'nodejs';

const EXTRA_HOSTS = ['images.pexels.com', 'images.unsplash.com'];
const MAX_BYTES = 6 * 1024 * 1024;

async function allowedHosts(): Promise<Set<string>> {
  const hosts = new Set(EXTRA_HOSTS);
  for (const u of [await getR2PublicUrl(), process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '']) {
    try { if (u) hosts.add(new URL(u).host); } catch { /* adresse mal formée */ }
  }
  return hosts;
}

export async function GET(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  let target: URL;
  try {
    target = new URL(req.nextUrl.searchParams.get('url') || '');
  } catch {
    return NextResponse.json({ error: 'Adresse invalide.' }, { status: 400 });
  }
  if (target.protocol !== 'https:' || !(await allowedHosts()).has(target.host)) {
    return NextResponse.json({ error: 'Cette image ne vient pas de la médiathèque.' }, { status: 403 });
  }

  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !(type.startsWith('image/') || type.startsWith('audio/'))) {
      return NextResponse.json({ error: `Image indisponible (${res.status}).` }, { status: 502 });
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) return NextResponse.json({ error: 'Fichier trop lourd (6 Mo au plus).' }, { status: 413 });
    return new NextResponse(body, {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'Image injoignable.' }, { status: 504 });
  }
}
