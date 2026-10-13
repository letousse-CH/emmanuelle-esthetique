import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { DriveError, buildAuthUrl } from '../../../../services/googleDrive';
import { calendarStatus, disconnectCalendar } from '../../../../services/googleCalendar';
import { syncUpcomingGoogleEvents } from '../../../../services/booking';

export const runtime = 'nodejs';

/**
 * Connexion Google Agenda des réservations : état (GET), adresse de connexion
 * (POST { action: 'connect' }), envoi des rendez-vous à venir (POST { action: 'sync' }),
 * déconnexion (DELETE). Voir services/googleCalendar.ts.
 */
async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return !!token && (await validateSupabaseToken(token));
}

function fail(err: unknown) {
  if (err instanceof DriveError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  console.error('[google-calendar]', err);
  return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur Google Agenda inattendue.' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  try { return NextResponse.json(await calendarStatus()); } catch (err) { return fail(err); }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  try {
    if (body.action === 'connect') return NextResponse.json({ url: await buildAuthUrl(req.nextUrl.origin, 'calendar') });
    if (body.action === 'sync') {
      const result = await syncUpcomingGoogleEvents();
      return NextResponse.json({ ...(await calendarStatus()), ...result });
    }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err) { return fail(err); }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Session expirée, reconnectez-vous.' }, { status: 401 });
  try {
    await disconnectCalendar();
    return NextResponse.json(await calendarStatus());
  } catch (err) { return fail(err); }
}
