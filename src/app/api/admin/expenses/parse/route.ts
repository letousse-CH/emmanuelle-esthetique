import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';
import { RECEIPT_MEDIA_TYPES, type ReceiptMediaType } from '../../../../../services/receiptScan';
import { scanFactureAchat } from '../../../../../services/invoiceScan';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Corps Netlify limité à 6 Mo : PDF de 4 Mo au plus, photo réduite par le navigateur. */
const MAX_BASE64_LENGTH = 5_500_000;

/**
 * Lecture IA d'une facture fournisseur détaillée (photo ou PDF).
 * N'enregistre rien : la route rend une proposition que l'exploitante relit ;
 * l'import passe ensuite par `stock_importer_facture` (Postgres), qui rejoue
 * tous les contrôles.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }

  let body: { fileBase64?: unknown; mediaType?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const base64 = typeof body.fileBase64 === 'string' ? body.fileBase64.replace(/^data:[^,]+,/, '') : '';
  const mediaType = String(body.mediaType || '') as ReceiptMediaType;
  if (!base64) return NextResponse.json({ error: 'Aucune facture reçue.' }, { status: 400 });
  if (!RECEIPT_MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: 'Format non pris en charge : PDF, ou photo JPEG, PNG ou WebP.' }, { status: 415 });
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Facture trop lourde (4 Mo au plus).' }, { status: 413 });
  }

  try {
    return NextResponse.json({ data: await scanFactureAchat({ base64, mediaType }) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'not_configured') {
      return NextResponse.json(
        { error: 'Clé Anthropic absente : renseignez-la dans Réglages → Clés API pour lire les factures.' },
        { status: 501 },
      );
    }
    console.error('[expenses/parse]', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
