import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAvailability } from '../../../../../services/booking';
import { isValidDateStr } from '../../../../../services/bookingEngine';
import { errorResponse, requireAdmin } from '../../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/bookings/availability?date&duration&excludeId → { date, ouvert, slots }
 * Créneaux EXACTS pour fixer l'horaire définitif (le rendez-vous `excludeId` est ignoré,
 * pas de délai d'anticipation, les demandes souples restent flexibles).
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const date = sp.get('date');
  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: 'Date invalide. Format attendu : YYYY-MM-DD.' }, { status: 400 });
  }
  const duration = sp.get('duration') ? Number(sp.get('duration')) : 60;
  if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
    return NextResponse.json({ error: 'Durée invalide (5 à 600 minutes).' }, { status: 400 });
  }
  const excludeId = sp.get('excludeId') || undefined;

  try {
    return NextResponse.json(await getAdminAvailability(date, duration, excludeId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/availability');
  }
}
