import { NextResponse, type NextRequest } from 'next/server';
import { createAdminBooking, getBookings, type BookingStatus } from '../../../../services/booking';
import { isValidDateStr } from '../../../../services/bookingEngine';
import { BAD_JSON, errorResponse, readJson, requireAdmin } from '../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUTS = ['en_attente', 'confirme', 'refuse', 'annule', 'termine'];

/**
 * GET /api/admin/bookings?from&to&statut&clientId&q&limit → { bookings }
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;
  const statut = sp.get('statut') || undefined;
  if ((from && !isValidDateStr(from)) || (to && !isValidDateStr(to))) {
    return NextResponse.json({ error: 'Dates invalides. Format attendu : YYYY-MM-DD.' }, { status: 400 });
  }
  if (statut && !STATUTS.includes(statut)) {
    return NextResponse.json({ error: `Statut invalide : ${statut}` }, { status: 400 });
  }
  const limitRaw = sp.get('limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || (limit as number) < 1)) {
    return NextResponse.json({ error: 'Limite invalide.' }, { status: 400 });
  }

  try {
    const bookings = await getBookings({
      from,
      to,
      statut: statut as BookingStatus | undefined,
      clientId: sp.get('clientId') || undefined,
      q: sp.get('q') || undefined,
      limit,
    });
    return NextResponse.json({ bookings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings GET');
  }
}

/**
 * POST /api/admin/bookings ← BookingPatch (nom, prenom, telephone, service_nom|service_id, date_rdv, heure_rdv requis)
 * → 201 { booking, warnings } · 409 { error, conflicts } sauf `force`.
 * Défauts : statut 'confirme', horaire_fixe true, source 'admin', notify_client false.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();

  try {
    const { booking, warnings } = await createAdminBooking(body as Parameters<typeof createAdminBooking>[0]);
    return NextResponse.json({ success: true, booking, warnings }, { status: 201 });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings POST');
  }
}
