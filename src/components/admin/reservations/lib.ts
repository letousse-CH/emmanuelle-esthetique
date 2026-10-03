"use client";

/**
 * Outils communs de l'écran Réservations : appels API authentifiés, dates en
 * heure de Zurich, libellés et liens de contact.
 *
 * Règle de dates : « aujourd'hui » se calcule en Europe/Zurich, jamais avec
 * `toISOString().split('T')` (qui répond en UTC et se trompe d'un jour entre
 * minuit et 1–2 h du matin). L'arithmétique sur des dates `YYYY-MM-DD` passe
 * par `Date.UTC`, donc sans aucune dérive due au fuseau ou à l'heure d'été.
 */

import { supabase } from '../../../services/supabase';
import type {
  Booking,
  BookingConflict,
  BookingPeriode,
  BookingStatus,
} from '../../../types/booking';
import { timeToMinutes } from '../../../types/booking';
import { toWhatsAppNumber, whatsappLink } from '../../../types/promotions';

export const TZ = 'Europe/Zurich';

// ── Appels API ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  conflicts?: BookingConflict[];
  constructor(message: string, status: number, conflicts?: BookingConflict[]) {
    super(message);
    this.status = status;
    this.conflicts = conflicts;
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

/** `fetch` avec le jeton de l'administratrice ; lève une `ApiError` lisible. */
export async function adminFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
    Authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new ApiError('Pas de connexion. Vérifiez votre réseau et réessayez.', 0);
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    let message = typeof json.error === 'string' ? json.error : '';
    if (!message) {
      if (res.status === 401 || res.status === 403) message = 'Votre session a expiré. Reconnectez-vous.';
      else if (res.status >= 500) message = 'Le serveur a rencontré un problème. Réessayez dans un instant.';
      else message = `Erreur ${res.status}`;
    }
    throw new ApiError(message, res.status, json.conflicts as BookingConflict[] | undefined);
  }
  return json as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Une erreur est survenue.';
}

// ── Dates (Europe/Zurich) ───────────────────────────────────────────────────

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hmFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Date du jour à Zurich, au format YYYY-MM-DD. */
export function todayZurich(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

/** Minutes écoulées depuis minuit, à Zurich. */
export function nowMinutesZurich(now: Date = new Date()): number {
  const parts = hmFormatter.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function parseYmd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  return [y, m, d];
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parseYmd(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** 0 = dimanche … 6 = samedi (même convention que `jours_ouverture`). */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = parseYmd(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Lundi de la semaine qui contient `iso`. */
export function weekStart(iso: string): string {
  const wd = weekdayIndex(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  for (let i = 0; i < 400 && cur <= to; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function utcDate(iso: string): Date {
  const [y, m, d] = parseYmd(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

/** « lundi 5 octobre » */
export function formatDateLong(iso: string): string {
  if (!iso) return '';
  return utcDate(iso).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** « lun. 5 oct. » */
export function formatDateShort(iso: string): string {
  if (!iso) return '';
  return utcDate(iso).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** « 05.10.2026 » */
export function formatDateNumeric(iso: string): string {
  if (!iso) return '';
  return utcDate(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/** « octobre 2026 » */
export function formatMonthYear(iso: string): string {
  return utcDate(iso).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** « lun. » */
export function formatWeekdayShort(iso: string): string {
  return utcDate(iso).toLocaleDateString('fr-CH', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
}

/** Jour du mois (1–31). */
export function dayOfMonth(iso: string): number {
  return parseYmd(iso)[2];
}

/** Même jour, `n` mois plus tard (ramené au dernier jour du mois si besoin). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parseYmd(iso);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function formatDayMonth(iso: string): string {
  return utcDate(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** Instant ISO → « 5 oct., 14:32 » à Zurich. */
export function formatInstant(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-CH', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** « il y a 3 h », « il y a 2 jours ». */
export function relativeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} jours`;
}

/** Ancienneté en jours (pour signaler les demandes qui traînent). */
export function ageInDays(iso: string, now: number = Date.now()): number {
  return Math.floor(Math.max(0, now - new Date(iso).getTime()) / 86400000);
}

export function formatDuration(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

// ── Périodes ────────────────────────────────────────────────────────────────

export const DEFAULT_COUPURE = '13:00';

export function periodeOf(heure: string, coupure: string = DEFAULT_COUPURE): BookingPeriode {
  return timeToMinutes(heure) < timeToMinutes(coupure) ? 'matin' : 'apres_midi';
}

/** Période demandée à l'origine par la cliente (même si le rdv a été déplacé). */
export function requestedPeriode(b: Booking, coupure: string = DEFAULT_COUPURE): BookingPeriode {
  return b.periode_demandee ?? b.periode ?? periodeOf(b.heure_rdv, coupure);
}

export function requestedDate(b: Booking): string {
  return b.date_demandee ?? b.date_rdv;
}

// ── Contact ─────────────────────────────────────────────────────────────────

export function telHref(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`;
}

export function waHref(tel: string, message: string): string | null {
  const n = toWhatsAppNumber(tel);
  return n ? whatsappLink(n, message) : null;
}

export function fullName(b: Pick<Booking, 'prenom' | 'nom'>): string {
  return `${b.prenom ?? ''} ${b.nom ?? ''}`.trim();
}

// ── Statuts ─────────────────────────────────────────────────────────────────

export const STATUS_STYLE: Record<BookingStatus, string> = {
  en_attente: 'bg-amber-50 text-amber-900 border-amber-300',
  confirme: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  termine: 'bg-slate-100 text-slate-800 border-slate-300',
  annule: 'bg-stone-100 text-stone-700 border-stone-300',
  refuse: 'bg-rose-50 text-rose-900 border-rose-300',
};

/** Prévenir l'application (menu latéral : pastille) qu'une réservation a changé. */
export function announceBookingsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('admin:bookings-changed'));
}

/** Aplatit une réponse qui pourrait être `{ settings }` ou l'objet lui-même. */
export function unwrap<T>(json: unknown, key: string): T {
  const o = json as Record<string, unknown>;
  return ((o && typeof o === 'object' && key in o ? o[key] : json) as unknown) as T;
}

/** Majuscule à la première lettre seulement (la classe CSS `capitalize` en met à chaque mot). */
export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Chiffres « nationaux » d'un numéro, pour comparer `079 123`, `+41 79 123 45 67`
 * et `0041791234567` : indicatif 41 et 0 initial retirés.
 */
export function nationalDigits(raw: string): string {
  const t = (raw ?? '').trim();
  let d = t.replace(/\D/g, '');
  if (t.startsWith('+') || t.startsWith('00')) {
    if (t.startsWith('00')) d = d.slice(2);
    if (d.startsWith('41')) d = d.slice(2);
  } else if (!d.startsWith('0') && d.startsWith('41') && d.length >= 11) {
    d = d.slice(2);
  }
  return d.replace(/^0+/, '');
}
