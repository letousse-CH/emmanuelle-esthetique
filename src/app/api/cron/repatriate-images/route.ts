import { NextResponse, NextRequest } from 'next/server';

/**
 * Route Cron planifiée pour rapatrier automatiquement les images externes vers me CDN R2.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Si un CRON_SECRET est configuré, on vérifie la clé d'autorisation
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const host = req.headers.get('host') || 'localhost:5173';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    
    // Déclencher me rapatriement d'images via l'API interne
    const internalRes = await fetch(`${protocol}://${host}/api/admin/repatriate-images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer system-cron-bypass`,
      },
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
