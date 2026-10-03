import { NextResponse, type NextRequest } from 'next/server';
import { getAdminCatalog } from '../../../../services/booking';
import { errorResponse, requireAdmin } from '../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/services-catalog → { services: AdminCatalogItem[] }
 * TOUS les services actifs (prestations, forfaits, options) avec catégorie, prix et durée,
 * sans le filtre « réservable en ligne » du catalogue public.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ services: await getAdminCatalog() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/services-catalog');
  }
}
