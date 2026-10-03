import { NextResponse, type NextRequest } from 'next/server';
import { createBooking, getBookings, type BookingInput, type BookingStatus } from '../../../services/booking';
import { checkRateLimit } from '../../../utils/rateLimit';
import { validateSupabaseToken } from '../../../utils/apiAuth';

export const runtime = 'nodejs';

/**
 * POST /api/bookings
 * Création d'une réservation publique par une cliente.
 * Protégé par rate limiter (5 réservations par tranche de 5 minutes par IP).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  const rateCheck = await checkRateLimit(ip, { windowMs: 5 * 60_000, maxRequests: 5 });
  if (!rateCheck.success) {
    return NextResponse.json(
      { error: 'Trop de tentatives de réservation. Veuillez patienter quelques minutes.' },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const {
    nom,
    prenom,
    telephone,
    email,
    code_postal,
    ville,
    service_id,
    service_nom,
    service_prix_chf,
    service_duree_minutes,
    options,
    offer_of_month_id,
    date_rdv,
    heure_rdv,
    notes_cliente,
  } = body || {};

  if (!nom || !prenom || !telephone || !service_nom || !date_rdv || !heure_rdv) {
    return NextResponse.json(
      { error: 'Champs obligatoires manquants : nom, prénom, téléphone, soin, date et heure.' },
      { status: 400 }
    );
  }

  const bookingInput: BookingInput = {
    nom: String(nom).trim(),
    prenom: String(prenom).trim(),
    telephone: String(telephone).trim(),
    email: email ? String(email).trim().toLowerCase() : null,
    code_postal: code_postal ? String(code_postal).trim() : null,
    ville: ville ? String(ville).trim() : null,
    service_id: service_id ? String(service_id).trim() : null,
    service_nom: String(service_nom).trim(),
    service_prix_chf: Number(service_prix_chf) || 0,
    service_duree_minutes: service_duree_minutes ? Number(service_duree_minutes) : undefined,
    options: Array.isArray(options) ? options : [],
    offer_of_month_id: offer_of_month_id ? String(offer_of_month_id).trim() : null,
    date_rdv: String(date_rdv).trim(),
    heure_rdv: String(heure_rdv).trim(),
    notes_cliente: notes_cliente ? String(notes_cliente).trim() : null,
  };

  const result = await createBooking(bookingInput);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    success: true,
    booking: result.booking,
    message: 'Votre demande de rendez-vous a bien été prise en compte.',
  });
}

/**
 * GET /api/bookings
 * Consultation des réservations (Réservé à l'administrateur).
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const statut = (searchParams.get('statut') as BookingStatus) || undefined;
  const clientId = searchParams.get('clientId') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

  try {
    const bookings = await getBookings({ date, startDate, endDate, statut, clientId, limit });
    return NextResponse.json({ bookings });
  } catch (err: any) {
    console.error('[/api/bookings GET] Erreur:', err);
    return NextResponse.json({ error: 'Erreur lors de la récupération des réservations.' }, { status: 500 });
  }
}
