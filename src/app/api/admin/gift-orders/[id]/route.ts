import { NextResponse, type NextRequest } from 'next/server';
import {
  GiftOrderError, cancelGiftOrder, confirmGiftOrder, resendGiftCard,
} from '../../../../../services/giftOrders';
import { BAD_JSON, readJson, requireAdmin } from '../../../bookings/_shared';

// Rendu des PDF joints au bon : API Node.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/gift-orders/:id  { action, motif? }
 *  - `paiement_recu` : émet la facture (TWINT) et le bon, puis envoie le bon.
 *    Un second appel sur une commande payée ne refait rien.
 *  - `renvoyer`      : renvoie le bon d'une commande payée.
 *  - `annuler`       : annule une commande non payée (motif facultatif).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();
  const { action, motif } = body as { action?: unknown; motif?: unknown };

  try {
    if (action === 'paiement_recu') return NextResponse.json(await confirmGiftOrder(id));
    if (action === 'renvoyer') return NextResponse.json(await resendGiftCard(id));
    if (action === 'annuler') {
      return NextResponse.json({ order: await cancelGiftOrder(id, typeof motif === 'string' ? motif : '') });
    }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err) {
    if (err instanceof GiftOrderError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[/api/admin/gift-orders] Erreur inattendue:', err);
    return NextResponse.json({ error: 'Erreur interne. Merci de réessayer.' }, { status: 500 });
  }
}
