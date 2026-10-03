import { NextResponse, type NextRequest } from 'next/server';
import { getAgendaData } from '../../../../../services/booking';
import { diffDays, isValidDateStr } from '../../../../../services/bookingEngine';
import { errorResponse, requireAdmin } from '../../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/bookings/agenda?from&to → AgendaData (62 jours au plus). */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json({ error: 'Dates invalides. Format attendu : YYYY-MM-DD.' }, { status: 400 });
  }
  if (to < from) return NextResponse.json({ error: 'La date de fin précède la date de début.' }, { status: 400 });
  if (diffDays(from, to) > 62) {
    return NextResponse.json({ error: 'La période demandée ne peut pas dépasser 62 jours.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getAgendaData(from, to), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/agenda');
  }
}
