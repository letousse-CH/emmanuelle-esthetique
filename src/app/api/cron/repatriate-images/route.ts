import { NextResponse, NextRequest } from 'next/server';
import { hasCronSecret, internalHeaders } from '../../../../utils/apiAuth';

/**
 * Route Cron planifiée pour rapatrier automatiquement les images externes vers me CDN R2.
 */
export async function GET(req: NextRequest) {
  try {
    // Refus par défaut : sans CRON_SECRET configuré, personne n'entre.
    if (!process.env.CRON_SECRET) {
      console.error('[cron/repatriate-images] CRON_SECRET manquant : accès refusé par défaut.');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!hasCronSecret(bearer)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Origine fixée par l'environnement plutôt que par l'en-tête Host, pour ne
    // jamais envoyer le secret interne vers un domaine fourni par la requête.
    const origin = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

    // Déclencher le rapatriement d'images via l'API interne
    const internalRes = await fetch(`${origin}/api/admin/repatriate-images`, {
      method: 'POST',
      headers: internalHeaders(),
    });

    const data = await internalRes.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
