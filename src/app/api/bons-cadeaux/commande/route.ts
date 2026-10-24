import { NextResponse, type NextRequest } from 'next/server';
import { GiftOrderError, createGiftOrder } from '../../../../services/giftOrders';
import { checkRateLimit } from '../../../../utils/rateLimit';
import { BAD_JSON, clientIp, readJson } from '../../bookings/_shared';

export const runtime = 'nodejs';

/**
 * POST /api/bons-cadeaux/commande
 * Dépose une COMMANDE de bon cadeau (montant libre ou soins de la carte), à
 * payer par TWINT. Aucun bon ni facture n'est émis ici : c'est l'exploitante
 * qui confirme le paiement depuis l'administration.
 *
 * 201 { success, order: GiftOrderPublicView } · 400 { error, fields } ·
 * 403 vente en ligne fermée · 429 débit · 503 base indisponible.
 * Champ-piège `champ_piege` rempli : 200 factice, rien n'est écrit.
 */
export async function POST(req: NextRequest) {
  const rate = await checkRateLimit(clientIp(req), { windowMs: 10 * 60_000, maxRequests: 5 });
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Trop de commandes en peu de temps. Merci de patienter quelques minutes.' },
      { status: 429 },
    );
  }

  const body = await readJson(req);
  if (body === null || typeof body !== 'object') return BAD_JSON();

  const trap = (body as Record<string, unknown>).champ_piege;
  if (typeof trap === 'string' && trap.trim() !== '') {
    return NextResponse.json({ success: true, order: null });
  }

  try {
    const order = await createGiftOrder(body);
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (err) {
    if (err instanceof GiftOrderError) {
      return NextResponse.json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) }, { status: err.status });
    }
    console.error('[/api/bons-cadeaux/commande] Erreur inattendue:', err);
    return NextResponse.json({ error: 'Erreur interne. Merci de réessayer.' }, { status: 500 });
  }
}
