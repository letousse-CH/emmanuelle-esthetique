/**
 * Connexion Google Agenda (serveur uniquement).
 *
 * Chaque rendez-vous à horaire arrêté devient un événement de l'agenda réglé
 * dans Réglages › Réservations, et les occupations de cet agenda grisent les
 * créneaux de la réservation en ligne (services/booking.ts).
 *
 * Même client OAuth que Google Drive, mais une connexion à part (son propre
 * jeton de rafraîchissement) : le compte peut différer de celui du Drive, et
 * déconnecter l'un ne coupe pas l'autre. Portées : `calendar.events` (créer,
 * déplacer, retirer les événements) et `calendar.freebusy` (lire les
 * occupations, jamais le contenu des événements).
 *
 * Avant : un jeton d'accès figé, qui n'a jamais été saisi et qui aurait de
 * toute façon expiré au bout d'une heure — rien n'arrivait dans l'agenda.
 */
import { getSecret } from './secrets';
import { DriveError, clientCredentials, exchangeCode, storeSecret } from './googleDrive';

const KEYS = {
  refresh: 'google_calendar_refresh_token',
  account: 'google_calendar_account',
  lastError: 'google_calendar_last_error',
} as const;

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  account: string | null;
  /** Dernier refus de Google lors d'une synchronisation, effacé au premier succès. */
  lastError: string | null;
  error?: string;
}

let cachedToken: { token: string; exp: number } | null = null;

export async function isCalendarConnected(): Promise<boolean> {
  const [creds, refresh] = await Promise.all([clientCredentials(), getSecret(KEYS.refresh)]);
  return !!creds && !!refresh;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const [creds, refresh] = await Promise.all([clientCredentials(), getSecret(KEYS.refresh)]);
  if (!creds) throw new DriveError('Le client Google n’est pas configuré.', 409, 'not_configured');
  if (!refresh) throw new DriveError('Google Agenda n’est pas connecté.', 409, 'not_connected');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant') {
      throw new DriveError('L’accès à Google Agenda a été retiré ou a expiré : reconnectez-le dans Réglages › Réservations.', 409, 'not_connected');
    }
    throw new DriveError(`Google Agenda ne répond pas (${json.error ?? res.status}).`);
  }
  cachedToken = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function noteError(message: string | null): Promise<void> {
  if (message === (await getSecret(KEYS.lastError))) return;
  await storeSecret(KEYS.lastError, message ? message.slice(0, 500) : null).catch(() => undefined);
}

/**
 * Appel à l'API Google Agenda (`path` relatif à /calendar/v3/). Un refus est
 * noté pour l'admin, sauf « introuvable » : un événement retiré à la main dans
 * Google n'est pas une panne de la connexion.
 */
export async function gcal<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await noteError(message);
    throw err;
  }
  if (res.status === 204) {
    await noteError(null);
    return undefined as T;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const gone = res.status === 404 || res.status === 410;
    const message = `Google Agenda : ${(json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`}`;
    if (!gone) await noteError(message);
    throw new DriveError(message, gone ? 404 : 502);
  }
  await noteError(null);
  return json as T;
}

/** L'agenda principal porte pour titre l'adresse du compte. */
async function fetchAccount(): Promise<string> {
  const r = await gcal<{ summary?: string }>('calendars/primary/events?maxResults=1&fields=summary');
  return r.summary || 'compte Google';
}

export async function completeCalendarAuth(code: string, state: string, origin: string): Promise<void> {
  const tokens = await exchangeCode(code, state, origin, 'calendar');
  await storeSecret(KEYS.refresh, tokens.refresh_token);
  await storeSecret(KEYS.account, null);
  cachedToken = { token: tokens.access_token, exp: Date.now() + (tokens.expires_in ?? 3600) * 1000 };
  await storeSecret(KEYS.account, await fetchAccount());
}

export async function disconnectCalendar(): Promise<void> {
  const refresh = await getSecret(KEYS.refresh);
  if (refresh) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' }).catch(() => undefined);
  }
  cachedToken = null;
  // Les événements déjà créés restent dans l'agenda : ils appartiennent au compte Google.
  await storeSecret(KEYS.refresh, null);
  await storeSecret(KEYS.account, null);
  await storeSecret(KEYS.lastError, null);
}

export async function calendarStatus(): Promise<CalendarStatus> {
  const creds = await clientCredentials();
  const [refresh, account, lastError] = await Promise.all([getSecret(KEYS.refresh), getSecret(KEYS.account), getSecret(KEYS.lastError)]);
  const base: CalendarStatus = { configured: !!creds, connected: !!creds && !!refresh, account, lastError };
  if (!base.connected || base.account) return base;
  // Connexion interrompue après l'accord Google (API Agenda pas encore
  // activée…) : le compte se complète ici, sans reconnexion.
  try {
    base.account = await fetchAccount();
    await storeSecret(KEYS.account, base.account);
    return { ...base, lastError: null };
  } catch (err) {
    return { ...base, connected: !(err instanceof DriveError && err.code === 'not_connected'), error: err instanceof Error ? err.message : String(err) };
  }
}
