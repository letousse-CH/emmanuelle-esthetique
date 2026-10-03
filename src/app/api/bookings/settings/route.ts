import { NextResponse, type NextRequest } from 'next/server';
import { getBookingSettings, updateBookingSettings, type BookingSettings } from '../../../../services/booking';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export const runtime = 'nodejs';

/**
 * GET /api/bookings/settings
 * Récupère les paramètres de réservation (Admin).
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  try {
    const settings = await getBookingSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error('[/api/bookings/settings GET] Erreur:', err);
    return NextResponse.json({ error: 'Erreur lecture paramètres.' }, { status: 500 });
  }
}

/**
 * PATCH /api/bookings/settings
 * Met à jour les paramètres de réservation (Admin).
 */
export async function PATCH(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await validateSupabaseToken(token);

  if (!isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  try {
    const result = await updateBookingSettings(body as Partial<BookingSettings>);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
    return NextResponse.json({ success: true, settings: result.data });
  } catch (err: any) {
    console.error('[/api/bookings/settings PATCH] Erreur:', err);
    return NextResponse.json({ error: err?.message || 'Erreur mise à jour paramètres.' }, { status: 500 });
  }
}
