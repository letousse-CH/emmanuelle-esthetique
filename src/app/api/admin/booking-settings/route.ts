import { NextResponse, type NextRequest } from 'next/server';
import { getBookingSettings, updateBookingSettings } from '../../../../services/booking';
import { validateSupabaseToken } from '../../../../utils/apiAuth';

export const runtime = 'nodejs';

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return validateSupabaseToken(token);
}

/**
 * GET /api/admin/booking-settings
 * Lecture des paramètres de réservation.
 */
export async function GET(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const settings = await getBookingSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/booking-settings
 * Mise à jour des paramètres de réservation (buffer, plages matin/après-midi, GCal sync).
 */
export async function PUT(req: NextRequest) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  try {
    const result = await updateBookingSettings(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, settings: result.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
