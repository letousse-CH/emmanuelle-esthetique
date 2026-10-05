import { NextResponse, type NextRequest } from 'next/server';
import { getOfferForPage } from '../../../../../services/offersServer';

export const runtime = 'nodejs';

/** Hôtes d'images autorisés : ceux de la médiathèque (R2, Supabase Storage). Pas de proxy ouvert. */
function allowedHost(host: string): boolean {
  const r2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '';
  let r2Host = '';
  try { r2Host = r2 ? new URL(r2).hostname : ''; } catch { /* variable mal formée */ }
  return host.endsWith('.r2.dev') || host.endsWith('.supabase.co') || (!!r2Host && host === r2Host);
}

/**
 * GET /api/offers/<id>/visuel[?download=1]
 *
 * Le visuel de l'offre, servi depuis le domaine du site. Le partage natif (la
 * photo jointe au message, vers Instagram, WhatsApp…) et le bouton
 * « Télécharger » ont besoin d'une image de même origine : l'URL R2 directe
 * serait bloquée par le navigateur (CORS, attribut `download` ignoré).
 * Seules les offres publiées sont servies ; un brouillon répond 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOfferForPage(id);
  const src = data?.offer.image_url;
  if (!src) return NextResponse.json({ error: 'Visuel introuvable.' }, { status: 404 });

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ error: 'Visuel introuvable.' }, { status: 404 });
  }
  if (url.protocol !== 'https:' || !allowedHost(url.hostname)) {
    return NextResponse.json({ error: 'Hôte d’image non autorisé.' }, { status: 400 });
  }

  const upstream = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Visuel momentanément indisponible.' }, { status: 502 });
  }
  const type = upstream.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) return NextResponse.json({ error: 'Ce fichier n’est pas une image.' }, { status: 415 });

  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=600, s-maxage=3600',
  };
  if (req.nextUrl.searchParams.get('download') === '1') {
    headers['Content-Disposition'] = `attachment; filename="offre-du-moment.${ext}"`;
  }
  return new NextResponse(upstream.body, { headers });
}
