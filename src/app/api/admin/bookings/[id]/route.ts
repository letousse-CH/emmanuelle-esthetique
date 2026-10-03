import { NextResponse, type NextRequest } from 'next/server';
import { deleteBooking, getBookingDetail, updateBooking } from '../../../../../services/booking';
import { BAD_JSON, errorResponse, readJson, requireAdmin } from '../../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/bookings/[id] → BookingDetail (rendez-vous, fiche cliente, historique, journal). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(await getBookingDetail(id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/[id] GET');
  }
}

/**
 * PATCH /api/admin/bookings/[id] ← BookingPatch → { success, booking, warnings }
 * 409 { error, conflicts } si le créneau n'est pas libre (sauf `force: true`).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();

  try {
    const { booking, warnings } = await updateBooking(id, body as Parameters<typeof updateBooking>[1]);
    return NextResponse.json({ success: true, booking, warnings });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/[id] PATCH');
  }
}

/** DELETE /api/admin/bookings/[id] — seulement en_attente / refuse / annule, sinon 409. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteBooking(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/[id] DELETE');
  }
}
