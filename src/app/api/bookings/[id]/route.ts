import { NextResponse, type NextRequest } from 'next/server';
import { updateBookingStatus, getBookingById, type BookingStatus } from '../../../../services/booking';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export const runtime = 'nodejs';

/**
 * PATCH /api/bookings/[id]
 * Met à jour le statut ou les notes admin d'une réservation.
 * Protégé : Administrateur uniquement.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Identifiant de réservation manquant.' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { statut, notes_admin } = body || {};

  const validStatuses: BookingStatus[] = ['en_attente', 'confirme', 'refuse', 'annule', 'termine'];
  if (statut && !validStatuses.includes(statut)) {
    return NextResponse.json({ error: `Statut invalide : ${statut}` }, { status: 400 });
  }

  try {
    const existing = await getBookingById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
    }

    const newStatus = (statut as BookingStatus) || existing.statut;
    const result = await updateBookingStatus(id, newStatus, notes_admin);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: 'Statut du rendez-vous mis à jour avec succès.',
    });
  } catch (err: any) {
    console.error('[/api/bookings/[id] PATCH] Erreur:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
  }
}

/**
 * GET /api/bookings/[id]
 * Détails d'une réservation (Administrateur).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) {
    return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ booking });
}
