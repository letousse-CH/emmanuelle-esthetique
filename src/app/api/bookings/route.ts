import { NextResponse, type NextRequest } from 'next/server';
import { createPublicBooking, isHoneypotTriggered } from '../../../services/booking';
import { isValidDateStr } from '../../../services/bookingEngine';
import { checkRateLimit } from '../../../utils/rateLimit';
import { BAD_JSON, clientIp, errorResponse, readJson } from './_shared';

export const runtime = 'nodejs';

/**
 * POST /api/bookings
 * Dépose une DEMANDE de rendez-vous (date + période). Prix, durée et options sont
 * retrouvés côté serveur : le corps n'est jamais cru sur parole.
 *
 * 201 { success, booking: PublicBookingView } · 400 validation · 409 période complète
 * · 422 soin inconnu · 429 débit · 503 base indisponible.
 * Champ-piège `champ_piege` rempli (`website` est ignoré) : 200 factice, rien n'est écrit.
 */
export async function POST(req: NextRequest) {
  const rate = await checkRateLimit(clientIp(req), { windowMs: 5 * 60_000, maxRequests: 5 });
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Trop de tentatives de réservation. Veuillez patienter quelques minutes.' },
      { status: 429 },
    );
  }

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();

  if (isHoneypotTriggered(body)) {
    const b = body as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      booking: {
        id: crypto.randomUUID(),
        service_nom: '',
        options: [],
        date_rdv: isValidDateStr(b.date_rdv) ? b.date_rdv : '',
        periode: b.periode === 'apres_midi' ? 'apres_midi' : 'matin',
        service_duree_minutes: 0,
        total_chf: 0,
      },
    });
  }

  try {
    const { view } = await createPublicBooking(body);
    return NextResponse.json(
      { success: true, booking: view, message: 'Votre demande de rendez-vous a bien été prise en compte.' },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err, '/api/bookings POST');
  }
}

/** OBSOLÈTE (410) : remplacée par GET /api/admin/bookings. */
export async function GET() {
  return NextResponse.json(
    { error: 'Route supprimée : utilisez /api/admin/bookings.' },
    { status: 410 },
  );
}
