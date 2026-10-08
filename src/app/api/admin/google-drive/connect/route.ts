import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';
import { DriveError, buildAuthUrl } from '../../../../../services/googleDrive';

export const runtime = 'nodejs';

/** Rend l'adresse de consentement Google ; le navigateur s'y rend ensuite. */
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ url: await buildAuthUrl(req.nextUrl.origin) });
  } catch (err) {
    if (err instanceof DriveError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    throw err;
  }
}
