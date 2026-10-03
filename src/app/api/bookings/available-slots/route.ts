import { NextResponse, type NextRequest } from 'next/server';
import {
  getAvailableSlots,
  getBookingSettings,
  parseDurationMinutes,
  resolveServiceDuration,
} from '../../../../services/booking';
import { dateBoundsError, isValidDateStr, zurichNow } from '../../../../services/bookingEngine';
import { errorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/bookings/available-slots?date=YYYY-MM-DD&duration=MIN
 * Disponibilité d'un jour (matin / après-midi + créneaux indicatifs).
 * 400 date invalide ou hors bornes · 503 si la base n'est pas joignable (jamais « tout libre »).
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const date = sp.get('date');
  if (!isValidDateStr(date)) {
    return NextResponse.json({ error: 'Date invalide. Le format attendu est YYYY-MM-DD.' }, { status: 400 });
  }

  let duration = 60;
  const durationParam = sp.get('duration');
  const serviceId = sp.get('serviceId');
  if (durationParam) duration = parseDurationMinutes(durationParam, 60);
  else if (serviceId) duration = resolveServiceDuration(serviceId, 60);
  if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
    return NextResponse.json({ error: 'Durée invalide (5 à 600 minutes).' }, { status: 400 });
  }

  try {
    const settings = await getBookingSettings({ strict: true });
    const bounds = dateBoundsError(date, settings, zurichNow());
    if (bounds) return NextResponse.json({ error: bounds }, { status: 400 });

    const result = await getAvailableSlots(date, duration);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err, '/api/bookings/available-slots');
  }
}
