import { NextResponse, type NextRequest } from 'next/server';
import { deleteBlock } from '../../../../../services/booking';
import { errorResponse, requireAdmin } from '../../../bookings/_shared';

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
