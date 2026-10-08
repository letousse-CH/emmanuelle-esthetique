import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { DriveError, disconnect, driveStatus, saveClientCredentials } from '../../../../services/googleDrive';

export const runtime = 'nodejs';

/**
 * Archivage des justificatifs dans Google Drive : état (GET), identifiants du
 * client OAuth (POST), déconnexion (DELETE). Voir services/googleDrive.ts.
 */
async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return !!token && (await validateSupabaseToken(token));
}

function fail(err: unknown) {
  if (err instanceof DriveError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  console.error('[google-drive]', err);
  return NextResponse.json({ error: 'Erreur Google Drive inattendue.' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  try { return NextResponse.json(await driveStatus()); } catch (err) { return fail(err); }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { clientId?: unknown; clientSecret?: unknown };
  try {
    await saveClientCredentials(String(body.clientId ?? ''), String(body.clientSecret ?? ''));
    return NextResponse.json(await driveStatus());
  } catch (err) { return fail(err); }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  try {
    await disconnect();
    return NextResponse.json(await driveStatus());
  } catch (err) { return fail(err); }
}
