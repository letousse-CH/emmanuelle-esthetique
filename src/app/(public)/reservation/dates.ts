/**
 * Dates du formulaire de réservation — tout se calcule en Europe/Zurich.
 *
 * Le navigateur de la cliente peut être dans n'importe quel fuseau, et un
 * `new Date().getDay()` ou un `toISOString().split('T')` décalent la date d'un
 * jour autour de minuit. Une date est donc toujours une chaîne `YYYY-MM-DD`,
 * manipulée par arithmétique de calendrier (midi UTC), jamais par l'heure locale.
 */

import type { BookingPeriode } from '../../../types/booking';

export const SALON_TIMEZONE = 'Europe/Zurich';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Le jour d'aujourd'hui à Palézieux (`YYYY-MM-DD`), quel que soit le fuseau du navigateur. */
export function todayZurich(now: Date = new Date()): string {
  // La locale `en-CA` formate en ISO (YYYY-MM-DD).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `true` si la chaîne est une vraie date du calendrier (pas le 31 février). */
export function isValidDateStr(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Midi UTC de la date : stable, sans effet de bord de fuseau ni d'heure d'été. */
function toUtcNoon(s: string): Date {
  return new Date(`${s}T12:00:00Z`);
}

export function addDays(s: string, n: number): string {
  const d = toUtcNoon(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = dimanche … 6 = samedi, pour la date du calendrier (pas pour l'heure du navigateur). */
export function weekdayOf(s: string): number {
  return toUtcNoon(s).getUTCDay();
}

/** Lundi = 0 … dimanche = 6. */
export function weekdayMondayFirst(s: string): number {
  return (weekdayOf(s) + 6) % 7;
}

/** `2026-10-05` → `lundi 5 octobre 2026`. */
export function formatDateLong(s: string): string {
  if (!isValidDateStr(s)) return s;
  return toUtcNoon(s).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `2026-10-05` → `lun. 5 oct.` */
export function formatDateShort(s: string): string {
  if (!isValidDateStr(s)) return s;
  return toUtcNoon(s).toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** `2026-10` → `octobre 2026`. */
export function formatMonthYear(ym: string): string {
  return toUtcNoon(`${ym}-01`).toLocaleDateString('fr-CH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `09:00` → `09h00`. */
export function formatHeure(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':');
  return `${h}h${m ?? '00'}`;
}

/** « Matin » / « Après-midi », suivi de « (dès 09h00) » quand le premier créneau est connu. */
export function periodeLabel(p: BookingPeriode, premierCreneau?: string | null): string {
  const base = p === 'matin' ? 'Matin' : 'Après-midi';
  return premierCreneau ? `${base} (dès ${formatHeure(premierCreneau)})` : base;
}
