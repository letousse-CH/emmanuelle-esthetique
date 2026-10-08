import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';
import {
  RECEIPT_MEDIA_TYPES,
  scanReceipt,
  type ReceiptAccount,
  type ReceiptMediaType,
} from '../../../../../services/receiptScan';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Une fonction Netlify refuse les corps de plus de 6 Mo : le navigateur réduit
 * la photo avant l'envoi (≈ 0,5 Mo), cette limite n'arrête qu'un PDF trop lourd.
 */
const MAX_BASE64_LENGTH = 5_500_000;

/**
 * Lecture IA d'un ticket de caisse ou d'une facture (photo ou PDF).
 * N'enregistre rien : la route rend une proposition que l'exploitante relit,
 * puis le navigateur dépose la pièce dans le coffre et crée la dépense.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }

  let body: { fileBase64?: unknown; mediaType?: unknown; categories?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const base64 = typeof body.fileBase64 === 'string' ? body.fileBase64.replace(/^data:[^,]+,/, '') : '';
  const mediaType = String(body.mediaType || '') as ReceiptMediaType;
  if (!base64) return NextResponse.json({ error: 'Aucune pièce reçue.' }, { status: 400 });
  if (!RECEIPT_MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: 'Format non pris en charge : photo JPEG, PNG ou WebP, ou PDF.' }, { status: 415 });
  }
  if (base64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Pièce trop lourde (4 Mo au plus) : photographiez-la plutôt.' }, { status: 413 });
  }

  // Comptes de la base envoyés par l'admin ; à défaut, le plan comptable par défaut.
  const categories = Array.isArray(body.categories)
    ? (body.categories as Record<string, unknown>[])
        .filter((c) => c && typeof c.code === 'string' && typeof c.nom === 'string')
        .slice(0, 60)
        .map((c): ReceiptAccount => ({
          code: String(c.code).slice(0, 12),
          nom: String(c.nom).slice(0, 120),
          description: typeof c.description === 'string' ? c.description.slice(0, 300) : null,
          groupe: String(c.groupe || 'autre') as ReceiptAccount['groupe'],
        }))
    : null;

  // Date civile suisse : le serveur tourne en UTC.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());

  try {
    const data = await scanReceipt({ base64, mediaType, categories, today });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'not_configured') {
      return NextResponse.json(
        { error: "Clé Anthropic absente : renseignez-la dans Réglages → Clés API pour lire les tickets." },
        { status: 501 },
      );
    }
    console.error('[expenses/scan]', err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
