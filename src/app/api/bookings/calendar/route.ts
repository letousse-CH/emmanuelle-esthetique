import { NextResponse, type NextRequest } from 'next/server';
import { getPublicCalendar, parseDurationMinutes } from '../../../../services/booking';
import { diffDays, isValidDateStr } from '../../../../services/bookingEngine';
import { errorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&duration=MIN
 * Pour chaque jour, le matin et l'après-midi sont-ils disponibles ? (60 jours au plus)
 * Sert à griser les jours fermés ou complets dans le formulaire.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json({ error: 'Dates invalides. Format attendu : YYYY-MM-DD.' }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: 'La date de fin précède la date de début.' }, { status: 400 });
  }
  if (diffDays(from, to) >= 60) {
    return NextResponse.json({ error: 'La période demandée ne peut pas dépasser 60 jours.' }, { status: 400 });
  }
  const duration = sp.get('duration') ? parseDurationMinutes(sp.get('duration'), 60) : 60;
  if (!Number.isFinite(duration) || duration < 5 || duration > 600) {
    return NextResponse.json({ error: 'Durée invalide (5 à 600 minutes).' }, { status: 400 });
  }

  try {
    const calendar = await getPublicCalendar(from, to, duration);
    return NextResponse.json(calendar, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/bookings/calendar');
  }
}
