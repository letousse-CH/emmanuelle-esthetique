import { NextResponse, type NextRequest } from 'next/server';
import { syncBookingsToClients } from '../../../../../services/booking';
import { errorResponse, requireAdmin } from '../../../bookings/_shared';

export const runtime = 'nodejs';

/**
 * POST /api/admin/bookings/sync-clients → { rattaches, crees, ignores }
 * Rattache à la CRM les rendez-vous sans `client_id` (e-mail exact, puis téléphone normalisé ;
 * jamais par le nom seul). Les consentements promotionnels ne sont pas touchés.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await syncBookingsToClients());
  } catch (err) {
    return errorResponse(err, '/api/admin/bookings/sync-clients');
  }
}
