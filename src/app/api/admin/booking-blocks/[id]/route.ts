import { NextResponse, type NextRequest } from 'next/server';
import { deleteBlock, updateBlock } from '../../../../../services/booking';
import { BAD_JSON, errorResponse, readJson, requireAdmin } from '../../../bookings/_shared';

export const runtime = 'nodejs';

/** DELETE /api/admin/booking-blocks/[id] — supprime une indisponibilité. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await deleteBlock(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-blocks/[id] DELETE');
  }
}

/**
 * PATCH /api/admin/booking-blocks/[id] ← { date_debut, date_fin?, heure_debut?, heure_fin?, motif? }
 * → { block, impactes } : remplace la plage entière (mêmes règles qu'à la création).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();
  try {
    return NextResponse.json(await updateBlock(id, body));
  } catch (err) {
    return errorResponse(err, '/api/admin/booking-blocks/[id] PATCH');
  }
}
