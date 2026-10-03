import { NextResponse, type NextRequest } from 'next/server';
import { createBlock, listBlocks } from '../../../../services/booking';
import { isValidDateStr } from '../../../../services/bookingEngine';
import { BAD_JSON, errorResponse, readJson, requireAdmin } from '../../bookings/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/booking-blocks?from&to → { blocks } (indisponibilités qui touchent la période). */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from') || undefined;
  const to = sp.get('to') || undefined;
  if ((from && !isValidDateStr(from)) || (to && !isValidDateStr(to))) {
    return NextResponse.json({ error: 'Dates invalides. Format attendu : YYYY-MM-DD.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ blocks: await listBlocks({ from, to }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-blocks GET');
  }
}

/**
 * POST /api/admin/booking-blocks ← { date_debut, date_fin?, heure_debut?, heure_fin?, motif? }
 * → 201 { block, impactes: Booking[] } : rendez-vous actifs touchés, À SIGNALER à l'utilisatrice
 * (ils ne sont jamais annulés automatiquement).
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();
  try {
    return NextResponse.json(await createBlock(body), { status: 201 });
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-blocks POST');
  }
}
