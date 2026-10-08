import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';
import { DriveError, driveStatus, shareFolder, unshareFolder } from '../../../../../services/googleDrive';

export const runtime = 'nodejs';

/** Donne (POST { email }) ou retire (DELETE { id }) l'accès en lecture au dossier des justificatifs. */
async function handle(req: NextRequest, action: (body: Record<string, unknown>) => Promise<void>) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await action(body);
    return NextResponse.json(await driveStatus());
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error('[google-drive/share]', err);
    return NextResponse.json({ error: 'Partage impossible.' }, { status: 500 });
  }
}

export const POST = (req: NextRequest) => handle(req, (b) => shareFolder(String(b.email ?? '')));
export const DELETE = (req: NextRequest) => handle(req, (b) => unshareFolder(String(b.id ?? '')));
