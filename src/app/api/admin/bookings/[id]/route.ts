import { NextResponse, type NextRequest } from 'next/server';
import { getBookingById, updateBookingStatus, type BookingStatus } from '../../../../../services/booking';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';

export const runtime = 'nodejs';

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return validateSupabaseToken(token);
}

/**
 * GET /api/admin/bookings/[id]
 * Détails complets d'une réservation.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  const booking = await getBookingById(id);

  if (!booking) {
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}

/**
 * PATCH /api/admin/bookings/[id]
 * Mise à jour du statut ou des notes de l'administratrice.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { statut, notes_admin } = body || {};

  if (statut && !['en_attente', 'confirme', 'refuse', 'annule', 'termine'].includes(statut)) {
    return NextResponse.json({ error: 'Statut de réservation invalide' }, { status: 400 });
  }

  try {
    const result = await updateBookingStatus(id, statut as BookingStatus, notes_admin);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, booking: result.booking });
  } catch (err: any) {
    console.error('[/api/admin/bookings/[id] PATCH] Erreur:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
