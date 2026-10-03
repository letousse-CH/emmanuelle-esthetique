/**
 * Calendrier en heure de Zurich. Le serveur, le navigateur et le téléphone
 * peuvent être dans un autre fuseau : tout « aujourd'hui » de l'accueil passe
 * par ici (jamais `toISOString().split('T')`, qui est en UTC).
 */

export const TZ = 'Europe/Zurich';

/** `YYYY-MM-DD` du jour civil à Zurich. */
export function zurichDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** Heure (0-23) à Zurich. */
export function zurichHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d);
  return parseInt(h, 10);
}

function parts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number);
  return [y, m, d];
}

/** Ajoute `n` jours à une date `YYYY-MM-DD` (calcul en UTC à midi : sans effet de l'heure d'été). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = parts(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + n, 12));
  return t.toISOString().slice(0, 10);
}

/** Lundi de la semaine de `dateStr`. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = parts(dateStr);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0 = dimanche
  return addDays(dateStr, -((dow + 6) % 7));
}

export function firstOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function firstOfPreviousMonth(dateStr: string): string {
  const [y, m] = parts(dateStr);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
}

/** Décalage de Zurich par rapport à UTC (ms) à l'instant `ts`. */
function offsetMs(ts: number): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const g = (t: string) => Number(f.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Instant ISO de minuit (heure de Zurich) au début de `dateStr`. */
export function zurichMidnightISO(dateStr: string): string {
  const [y, m, d] = parts(dateStr);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(guess);
  return new Date(guess - offsetMs(first)).toISOString();
}

/** Jour du mois (1-31) d'une date `YYYY-MM-DD`. */
export function dayOfMonth(dateStr: string): number {
  return parts(dateStr)[2];
}

export function daysInMonth(dateStr: string): number {
  const [y, m] = parts(dateStr);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
}

/** « mar. 7 oct. » depuis `YYYY-MM-DD`. */
export function formatShortDay(dateStr: string): string {
  const [y, m, d] = parts(dateStr);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
