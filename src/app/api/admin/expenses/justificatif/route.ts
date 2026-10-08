import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';
import { DriveError, justificatifName, uploadToDrive } from '../../../../../services/googleDrive';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Corps limité à 6 Mo par Netlify : le navigateur réduit les photos avant l'envoi. */
const MAX_BASE64_LENGTH = 5_500_000;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Dépose un justificatif de dépense dans le Google Drive connecté et rend son
 * lien. N'écrit rien en base : le navigateur rattache ensuite le lien à la
 * dépense. 409 `not_connected` : Drive n'est pas branché, le navigateur garde
 * alors la pièce dans le coffre privé Supabase.
 */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const base64 = typeof body.fileBase64 === 'string' ? body.fileBase64.replace(/^data:[^,]+,/, '') : '';
  const mediaType = String(body.mediaType || '');
  const ext = EXTENSIONS[mediaType];
  if (!base64) return NextResponse.json({ error: 'Aucune pièce reçue.' }, { status: 400 });
  if (!ext) return NextResponse.json({ error: 'Format non pris en charge : JPEG, PNG, WebP ou PDF.' }, { status: 415 });
  if (base64.length > MAX_BASE64_LENGTH) return NextResponse.json({ error: 'Pièce trop lourde (4 Mo au plus).' }, { status: 413 });

  const date = String(body.date || '');
  try {
    const file = await uploadToDrive({
      bytes: Buffer.from(base64, 'base64'),
      mimeType: mediaType,
      date,
      name: justificatifName({ date, fournisseur: String(body.fournisseur || ''), montant: Number(body.montant) || null, ext }),
      description: typeof body.description === 'string' ? body.description.slice(0, 500) : undefined,
    });
    return NextResponse.json(file);
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error('[expenses/justificatif]', err);
    return NextResponse.json({ error: 'Dépôt sur Google Drive impossible, réessayez.' }, { status: 502 });
  }
}
