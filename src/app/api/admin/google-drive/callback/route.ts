import { NextResponse, type NextRequest } from 'next/server';
import { completeAuth, statePurpose } from '../../../../../services/googleDrive';
import { completeCalendarAuth } from '../../../../../services/googleCalendar';
import { syncUpcomingGoogleEvents, updateBookingSettings } from '../../../../../services/booking';

export const runtime = 'nodejs';

/**
 * Retour de Google après le consentement, commun à Google Drive et à Google
 * Agenda (une seule URI de redirection à déclarer dans Google Cloud). Pas de
 * session admin ici (redirection de navigateur) : c'est le `state` signé, émis
 * pour une admin connectée, qui authentifie la demande et désigne la connexion.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const denied = req.nextUrl.searchParams.get('error');
  const calendar = statePurpose(state) === 'calendar';

  const back = calendar
    ? new URL('/admin/settings?tab=booking', req.nextUrl.origin)
    : new URL('/admin/caisse/depenses', req.nextUrl.origin);
  const flag = calendar ? 'gcal' : 'drive';

  if (denied || !code) {
    back.searchParams.set(flag, 'erreur');
    back.searchParams.set('message', denied === 'access_denied' ? 'Connexion annulée.' : 'Google n’a pas renvoyé d’autorisation.');
    return NextResponse.redirect(back);
  }
  try {
    if (calendar) {
      await completeCalendarAuth(code, state, req.nextUrl.origin);
      // Connecter l'agenda, c'est vouloir la synchronisation : on l'active et
      // on y envoie tout de suite les rendez-vous déjà confirmés.
      const saved = await updateBookingSettings({ gcal_sync_enabled: true });
      if (!saved.success) throw new Error(saved.error || 'Activation de la synchronisation impossible.');
      const { created, failed } = await syncUpcomingGoogleEvents();
      back.searchParams.set('envoyes', String(created));
      if (failed) back.searchParams.set('echecs', String(failed));
    } else {
      await completeAuth(code, state, req.nextUrl.origin);
    }
    back.searchParams.set(flag, 'ok');
  } catch (err) {
    console.error(`[google-${calendar ? 'calendar' : 'drive'}/callback]`, err);
    back.searchParams.set(flag, 'erreur');
    back.searchParams.set('message', err instanceof Error ? err.message : 'Connexion à Google impossible.');
  }
  return NextResponse.redirect(back);
}
