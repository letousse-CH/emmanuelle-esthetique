import { NextResponse, type NextRequest } from 'next/server';
import { getBookingSettings, updateBookingSettings, validateSettingsPatch } from '../../../../services/booking';
import { BAD_JSON, errorResponse, readJson, requireAdmin } from '../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/booking-settings → { settings } */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ settings: await getBookingSettings() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-settings GET');
  }
}

async function save(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();

  try {
    const patch = validateSettingsPatch(body); // 400 si forme, bornes ou plages invalides
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun réglage valide à enregistrer.' }, { status: 400 });
    }
    const result = await updateBookingSettings(patch);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ success: true, settings: result.data });
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-settings');
  }
}

/** PUT /api/admin/booking-settings — validation stricte (jours_ouverture, fin > début, bornes). */
export async function PUT(req: NextRequest) {
  return save(req);
}

/** PATCH accepté comme alias de PUT (mise à jour partielle dans les deux cas). */
export async function PATCH(req: NextRequest) {
  return save(req);
}
