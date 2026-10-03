/**
 * Moteur de disponibilité des réservations — PUR.
 *
 * Aucun import Supabase, réseau ni horloge cachée : toutes les données entrent
 * en paramètres (réglages, blocages, rendez-vous du jour, « maintenant »), ce
 * qui le rend testable (`scripts/test-booking-engine.ts`) et rejouable à
 * l'identique pour la re-vérification après INSERT.
 *
 * Modèle (voir PLAN-RESERVATIONS.md §1 et §3) :
 *  - rendez-vous à horaire arrêté (`horaire_fixe = true`) : bloquent
 *    `[début, début + durée + buffer]` ;
 *  - demandes « souples » (`en_attente`, `horaire_fixe = false`) : n'ont pas
 *    d'heure, elles occupent de la capacité dans leur période. Le moteur les
 *    PLACE une à une, par ordre `(created_at, id)`, au premier créneau libre de
 *    leur période. Deux demandes du même matin ne se bloquent donc pas tant
 *    qu'il reste de la place ;
 *  - blocages (`booking_blocks`) : retirés des fenêtres d'ouverture, SANS buffer ;
 *  - tout se calcule en heure de Zurich, jamais en heure du serveur (UTC sur
 *    Netlify).
 */

import {
  ACTIVE_STATUSES,
  minutesToTime,
  timeToMinutes,
  type AvailableDaySlots,
  type Booking,
  type BookingBlock,
  type BookingConflict,
  type BookingPeriode,
  type BookingSettings,
  type BookingStatus,
  type PeriodeDispo,
  type PublicCalendar,
  type TimeSlot,
} from '../types/booking';

// ── Fuseau horaire : Europe/Zurich ───────────────────────────────────────────

export const ZURICH_TZ = 'Europe/Zurich';

const zurichFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZURICH_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface ZurichNow {
  /** YYYY-MM-DD à Zurich */
  date: string;
  /** minutes écoulées depuis minuit, heure de Zurich */
  minutes: number;
}

/** Date et heure de Zurich pour un instant donné (défaut : maintenant). */
export function zurichNow(at: Date = new Date()): ZurichNow {
  const parts: Record<string, string> = {};
  for (const p of zurichFormatter.formatToParts(at)) parts[p.type] = p.value;
  const hour = parseInt(parts.hour, 10) % 24; // certaines implémentations renvoient « 24 » à minuit
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + parseInt(parts.minute, 10),
  };
}

/** « Aujourd'hui » à Zurich (YYYY-MM-DD) — jamais `toISOString().split('T')`. */
export function zurichToday(at: Date = new Date()): string {
  return zurichNow(at).date;
}

/**
 * Instant (UTC) correspondant à une date et une heure LOCALES de Zurich.
 * Sert à la fenêtre FreeBusy de Google Agenda (minuit Zurich → minuit Zurich).
 */
export function zurichInstant(date: string, minutes = 0): Date {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  const guess = Date.UTC(y, m - 1, d, 0, 0) + minutes * 60_000;
  const offsetAt = (ms: number): number => {
    const z = zurichNow(new Date(ms));
    const [zy, zm, zd] = z.date.split('-').map((x) => parseInt(x, 10));
    return Date.UTC(zy, zm - 1, zd, 0, 0) + z.minutes * 60_000 - ms;
  };
  const first = offsetAt(guess);
  let result = guess - first;
  const second = offsetAt(result);
  if (second !== first) result = guess - second; // bascule heure d'été/hiver
  return new Date(result);
}

// ── Dates calendaires (YYYY-MM-DD), sans fuseau ──────────────────────────────

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s: unknown): s is string {
  return typeof s === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s);
}

/** Numéro de jour (jours depuis 1970) d'une date calendaire. */
function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates (b − a). */
export function diffDays(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a);
}

/** 0 = dimanche … 6 = samedi */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export function jourLabel(date: string): string {
  return JOURS[dayOfWeek(date)];
}

// ── Types du moteur ──────────────────────────────────────────────────────────

export interface Interval { start: number; end: number }

export type EngineSettings = Pick<
  BookingSettings,
  | 'buffer_minutes'
  | 'anticipation_min_heures'
  | 'anticipation_max_jours'
  | 'jours_ouverture'
  | 'pas_creneau_minutes'
  | 'heure_coupure_periode'
> & { fermetures_exceptionnelles?: string[] };

/** Sous-ensemble de `Booking` lu par le moteur. */
export interface EngineBooking {
  id: string;
  created_at: string;
  date_rdv: string;
  heure_rdv: string;
  service_duree_minutes: number;
  statut: BookingStatus;
  horaire_fixe: boolean;
  periode?: BookingPeriode | null;
  nom?: string;
  prenom?: string;
}

export interface Placement {
  booking_id: string;
  /** HH:mm — où la demande souple est « posée » pour le calcul */
  heure: string;
  periode: BookingPeriode;
}

export interface DayInput {
  date: string;
  /** durée totale (soin + options) de la nouvelle demande, en minutes */
  duration: number;
  settings: EngineSettings;
  blocks: BookingBlock[];
  /** rendez-vous (toutes dates admises : le moteur filtre sur `date`) */
  bookings: EngineBooking[];
  /** occupations externes (Google Agenda), en minutes Zurich du jour */
  externalBusy?: Interval[];
  now: ZurichNow;
  /** rendez-vous à ignorer (déplacement d'un rdv existant) */
  excludeId?: string;
  /**
   * `public` (défaut) : bornes d'anticipation appliquées, demandes souples
   * comptées comme occupation. `admin` : aucune borne, les demandes souples
   * restent flexibles (Emmanuelle a le dernier mot), seuls les rdv arrêtés,
   * blocages et horaires comptent.
   */
  mode?: 'public' | 'admin';
  /**
   * Mode `public` sans les bornes de date ni le délai d'anticipation : sert à
   * vérifier une demande souple déjà déposée (re-vérification, déplacement admin).
   */
  ignoreBounds?: boolean;
}

export interface DayResult extends AvailableDaySlots {
  motif?: string;
  /** où chaque demande souple du jour a été placée */
  placements: Placement[];
  /** demandes souples qui ne tiennent plus (agenda modifié depuis) */
  surcapacite: string[];
}

// ── Intervalles ──────────────────────────────────────────────────────────────

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

function subtractIntervals(windows: Interval[], cuts: Interval[]): Interval[] {
  let result = windows.map((w) => ({ ...w }));
  for (const c of cuts) {
    const next: Interval[] = [];
    for (const w of result) {
      if (c.end <= w.start || c.start >= w.end) {
        next.push(w);
        continue;
      }
      if (c.start > w.start) next.push({ start: w.start, end: c.start });
      if (c.end < w.end) next.push({ start: c.end, end: w.end });
    }
    result = next;
  }
  return result;
}

// ── Horaires, périodes, blocages ─────────────────────────────────────────────

export function periodeOfMinutes(minutes: number, settings: Pick<EngineSettings, 'heure_coupure_periode'>): BookingPeriode {
  return minutes < timeToMinutes(settings.heure_coupure_periode || '13:00') ? 'matin' : 'apres_midi';
}

export function periodeOfTime(hhmm: string, settings: Pick<EngineSettings, 'heure_coupure_periode'>): BookingPeriode {
  return periodeOfMinutes(timeToMinutes(hhmm), settings);
}

/** Plages d'ouverture du jour (fusionnées). Vide si fermé ou fermeture exceptionnelle. */
export function openingWindows(date: string, settings: EngineSettings): Interval[] {
  if (settings.fermetures_exceptionnelles?.includes(date)) return [];
  const cfg = settings.jours_ouverture?.[String(dayOfWeek(date))];
  if (!cfg || !cfg.ouvert || !Array.isArray(cfg.plages)) return [];
  return mergeIntervals(
    cfg.plages
      .filter((p) => isValidTimeStr(p?.debut) && isValidTimeStr(p?.fin))
      .map((p) => ({ start: timeToMinutes(p.debut), end: timeToMinutes(p.fin) })),
  );
}

export function blocksForDate(date: string, blocks: BookingBlock[]): BookingBlock[] {
  return blocks.filter((b) => b.date_debut <= date && date <= b.date_fin);
}

function blockInterval(b: BookingBlock): Interval | null {
  if (!b.heure_debut || !b.heure_fin) return null; // journée entière
  return { start: timeToMinutes(b.heure_debut), end: timeToMinutes(b.heure_fin) };
}

function isActive(b: Pick<EngineBooking, 'statut'>): boolean {
  return ACTIVE_STATUSES.includes(b.statut);
}

function compareSoft(a: EngineBooking, b: EngineBooking): number {
  if (a.created_at < b.created_at) return -1;
  if (a.created_at > b.created_at) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function bookingLabel(b: EngineBooking): string {
  const name = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim();
  return name || 'une autre cliente';
}

// ── Construction du jour ─────────────────────────────────────────────────────

interface DayModel {
  windows: Interval[];         // plages d'ouverture (sans blocages)
  free: Interval[];            // plages d'ouverture − blocages
  fullDayBlock: BookingBlock | null;
  obstacles: Interval[];       // rdv arrêtés + externes (buffer inclus)
  softs: EngineBooking[];      // demandes souples du jour, triées
}

function buildDay(input: DayInput, extraObstacles: Interval[] = []): DayModel {
  const { date, settings, blocks, bookings, excludeId } = input;
  const buf = Math.max(0, settings.buffer_minutes || 0);

  const windows = openingWindows(date, settings);
  const dayBlocks = blocksForDate(date, blocks);
  const fullDayBlock = dayBlocks.find((b) => !blockInterval(b)) ?? null;
  const cuts = dayBlocks.map(blockInterval).filter((x): x is Interval => x !== null);
  const free = fullDayBlock ? [] : subtractIntervals(windows, cuts);

  const obstacles: Interval[] = [...extraObstacles];
  const softs: EngineBooking[] = [];
  for (const b of bookings) {
    if (b.date_rdv !== date || b.id === excludeId || !isActive(b)) continue;
    const start = timeToMinutes(b.heure_rdv);
    const dur = Math.max(1, b.service_duree_minutes || 60);
    if (b.horaire_fixe) obstacles.push({ start, end: start + dur + buf });
    else if (b.statut === 'en_attente') softs.push(b);
  }
  for (const x of input.externalBusy ?? []) obstacles.push({ start: x.start, end: x.end + buf });
  softs.sort(compareSoft);

  return { windows, free, fullDayBlock, obstacles, softs };
}

/** Un créneau `[t, t + durée]` tient-il dans la plage libre, sans heurter un obstacle (+ buffer) ? */
function fits(t: number, duration: number, free: Interval[], obstacles: Interval[], buf: number): boolean {
  if (!free.some((w) => t >= w.start && t + duration <= w.end)) return false;
  for (const o of obstacles) {
    if (t < o.end && t + duration + buf > o.start) return false;
  }
  return true;
}

/** Heures de départ possibles sur la grille, ancrées sur le début de chaque plage d'ouverture. */
function candidates(windows: Interval[], duration: number, step: number): number[] {
  const out: number[] = [];
  const s = Math.max(1, step || 30);
  for (const w of windows) {
    for (let t = w.start; t + duration <= w.end; t += s) out.push(t);
  }
  return out;
}

/** Place les demandes souples (ordre `(created_at, id)`), renvoie positions + surcapacité. */
function placeSofts(
  day: DayModel,
  settings: EngineSettings,
): { obstacles: Interval[]; placements: Placement[]; surcapacite: string[] } {
  const buf = Math.max(0, settings.buffer_minutes || 0);
  const obstacles = day.obstacles.map((o) => ({ ...o }));
  const placements: Placement[] = [];
  const surcapacite: string[] = [];

  for (const s of day.softs) {
    const dur = Math.max(1, s.service_duree_minutes || 60);
    const periode = s.periode ?? periodeOfTime(s.heure_rdv, settings);
    const cands = candidates(day.windows, dur, settings.pas_creneau_minutes);
    const t = cands.find(
      (c) => periodeOfMinutes(c, settings) === periode && fits(c, dur, day.free, obstacles, buf),
    );
    if (t === undefined) {
      surcapacite.push(s.id);
    } else {
      obstacles.push({ start: t, end: t + dur + buf });
      placements.push({ booking_id: s.id, heure: minutesToTime(t), periode });
    }
  }
  return { obstacles, placements, surcapacite };
}

/** Plus petit départ autorisé (minutes du jour `date`) vu le délai d'anticipation minimum. */
function minAllowedStart(date: string, settings: EngineSettings, now: ZurichNow): number {
  const nowAbs = dayIndex(now.date) * 1440 + now.minutes;
  const limitAbs = nowAbs + Math.max(0, settings.anticipation_min_heures || 0) * 60;
  return limitAbs - dayIndex(date) * 1440;
}

/** `null` si la date est dans les bornes publiques, sinon la raison. */
export function dateBoundsError(date: string, settings: EngineSettings, now: ZurichNow): string | null {
  if (date < now.date) return 'Cette date est passée.';
  if (diffDays(now.date, date) > settings.anticipation_max_jours) {
    return `Les réservations ouvrent jusqu'à ${settings.anticipation_max_jours} jours à l'avance.`;
  }
  return null;
}

// ── Disponibilité d'un jour ──────────────────────────────────────────────────

const EMPTY_PERIODE: PeriodeDispo = { disponible: false, premier_creneau: null };

export function computeDay(input: DayInput): DayResult {
  const { date, settings } = input;
  const mode = input.mode ?? 'public';
  const buf = Math.max(0, settings.buffer_minutes || 0);
  const duration = Math.max(1, Math.round(input.duration || 60));

  const closed = (motif: string, extra: Partial<DayResult> = {}): DayResult => ({
    date,
    ouvert: false,
    motif,
    buffer_minutes: buf,
    service_duree_minutes: duration,
    periodes: {
      matin: { ...EMPTY_PERIODE, motif },
      apres_midi: { ...EMPTY_PERIODE, motif },
    },
    slots: [],
    placements: [],
    surcapacite: [],
    ...extra,
  });

  const enforceBounds = mode === 'public' && !input.ignoreBounds;
  if (enforceBounds) {
    const bounds = dateBoundsError(date, settings, input.now);
    if (bounds) return closed(bounds);
  }

  const day = buildDay(input);
  if (day.windows.length === 0) return closed('Fermé ce jour.');
  if (day.fullDayBlock) {
    // Le motif d'un blocage (« Rendez-vous médecin »…) reste interne : jamais exposé au public.
    return closed(mode === 'admin' && day.fullDayBlock.motif ? day.fullDayBlock.motif : 'Indisponible ce jour.');
  }

  // Mode admin : les demandes souples ne gênent pas (elles se re-placent).
  const placed =
    mode === 'public'
      ? placeSofts(day, settings)
      : { obstacles: day.obstacles, placements: [] as Placement[], surcapacite: [] as string[] };

  const minStart = enforceBounds ? minAllowedStart(date, settings, input.now) : -Infinity;

  const slots: TimeSlot[] = [];
  for (const t of candidates(day.windows, duration, settings.pas_creneau_minutes)) {
    let disponible = true;
    let motif: string | undefined;
    if (!day.free.some((w) => t >= w.start && t + duration <= w.end)) {
      disponible = false;
      motif = 'Indisponible';
    } else if (t < minStart) {
      disponible = false;
      motif = "Délai d'anticipation dépassé";
    } else if (!fits(t, duration, day.free, placed.obstacles, buf)) {
      disponible = false;
      motif = 'Déjà occupé';
    }
    slots.push({
      heure: minutesToTime(t),
      fin: minutesToTime(t + duration),
      disponible,
      periode: periodeOfMinutes(t, settings),
      ...(motif ? { motif } : {}),
    });
  }

  const periodes = { matin: { ...EMPTY_PERIODE }, apres_midi: { ...EMPTY_PERIODE } } as Record<BookingPeriode, PeriodeDispo>;
  for (const p of ['matin', 'apres_midi'] as BookingPeriode[]) {
    const inPeriod = slots.filter((s) => s.periode === p);
    const first = inPeriod.find((s) => s.disponible);
    if (first) periodes[p] = { disponible: true, premier_creneau: first.heure };
    else if (inPeriod.length === 0) periodes[p] = { ...EMPTY_PERIODE, motif: 'Aucun créneau ne correspond à la durée de ce soin.' };
    else if (inPeriod.every((s) => s.motif === "Délai d'anticipation dépassé")) {
      periodes[p] = { ...EMPTY_PERIODE, motif: "Délai d'anticipation dépassé" };
    } else periodes[p] = { ...EMPTY_PERIODE, motif: 'Complet' };
  }

  return {
    date,
    ouvert: true,
    buffer_minutes: buf,
    service_duree_minutes: duration,
    periodes,
    slots,
    placements: placed.placements,
    surcapacite: placed.surcapacite,
  };
}

/**
 * Calendrier public : pour chaque jour, matin / après-midi disponibles ?
 * (grise les jours fermés ou complets dans le formulaire). `externalBusyByDate`
 * est optionnel (occupations Google Agenda déjà converties en minutes).
 */
export function computeRange(
  from: string,
  to: string,
  base: Omit<DayInput, 'date' | 'externalBusy'> & { externalBusyByDate?: Record<string, Interval[]> },
): PublicCalendar {
  const byDate = new Map<string, EngineBooking[]>();
  for (const b of base.bookings) {
    if (b.date_rdv < from || b.date_rdv > to) continue;
    const arr = byDate.get(b.date_rdv) ?? [];
    arr.push(b);
    byDate.set(b.date_rdv, arr);
  }
  const jours: PublicCalendar['jours'] = {};
  for (const date of eachDay(from, to)) {
    const r = computeDay({
      ...base,
      date,
      bookings: byDate.get(date) ?? [],
      externalBusy: base.externalBusyByDate?.[date],
    });
    jours[date] = { matin: r.periodes.matin.disponible, apres_midi: r.periodes.apres_midi.disponible };
  }
  return { from, to, jours };
}

// ── Conflits d'un rendez-vous à horaire arrêté ───────────────────────────────

export interface FixedCheckInput {
  date: string;
  /** HH:mm */
  heure: string;
  /** durée totale en minutes */
  duration: number;
  settings: EngineSettings;
  blocks: BookingBlock[];
  bookings: EngineBooking[];
  externalBusy?: Interval[];
  excludeId?: string;
  now?: ZurichNow;
}

/**
 * Tout ce qui empêche (ou gêne) de poser un rendez-vous à `heure` : jour fermé
 * ou hors horaires, blocages, autres rendez-vous arrêtés (buffer compris),
 * occupations externes, et demandes souples qui n'auraient plus de place.
 * Liste vide = rien à signaler. L'admin peut passer outre (`force`).
 */
export function findFixedConflicts(input: FixedCheckInput): BookingConflict[] {
  const { date, settings } = input;
  const buf = Math.max(0, settings.buffer_minutes || 0);
  const duration = Math.max(1, Math.round(input.duration || 60));
  const t = timeToMinutes(input.heure);
  const end = t + duration;
  const conflicts: BookingConflict[] = [];
  const now = input.now ?? zurichNow();

  const dayInput: DayInput = { ...input, duration, now, mode: 'admin' };
  const day = buildDay(dayInput);

  // 1. Horaires d'ouverture
  const inWindow = day.windows.some((w) => t >= w.start && end <= w.end);
  if (!inWindow) {
    const cfg = settings.jours_ouverture?.[String(dayOfWeek(date))];
    const exceptionnel = settings.fermetures_exceptionnelles?.includes(date);
    let libelle: string;
    if (exceptionnel) libelle = 'Fermeture exceptionnelle ce jour.';
    else if (!cfg || !cfg.ouvert || day.windows.length === 0) libelle = `Jour de fermeture (${jourLabel(date)}).`;
    else {
      const plages = day.windows.map((w) => `${minutesToTime(w.start)}–${minutesToTime(w.end)}`).join(' et ');
      libelle = `En dehors des horaires d'ouverture (${plages}).`;
    }
    conflicts.push({ type: 'hors_horaires', libelle, debut: input.heure, fin: minutesToTime(end) });
  }

  // 2. Blocages
  for (const b of blocksForDate(date, input.blocks)) {
    const iv = blockInterval(b);
    if (!iv) {
      conflicts.push({
        type: 'blocage',
        libelle: b.motif ? `Journée bloquée : ${b.motif}` : 'Journée bloquée.',
        block_id: b.id,
      });
    } else if (t < iv.end && end > iv.start) {
      conflicts.push({
        type: 'blocage',
        libelle: `${b.motif ? `${b.motif} — ` : 'Plage bloquée '}${b.heure_debut}–${b.heure_fin}`,
        block_id: b.id,
        debut: b.heure_debut ?? undefined,
        fin: b.heure_fin ?? undefined,
      });
    }
  }

  // 3. Autres rendez-vous à horaire arrêté
  for (const b of input.bookings) {
    if (b.date_rdv !== date || b.id === input.excludeId || !isActive(b) || !b.horaire_fixe) continue;
    const s = timeToMinutes(b.heure_rdv);
    const dur = Math.max(1, b.service_duree_minutes || 60);
    if (t < s + dur + buf && end + buf > s) {
      conflicts.push({
        type: 'rdv',
        libelle: `Rendez-vous de ${bookingLabel(b)} (${b.heure_rdv}–${minutesToTime(s + dur)}).`,
        booking_id: b.id,
        debut: b.heure_rdv,
        fin: minutesToTime(s + dur),
      });
    }
  }

  // 4. Occupations externes (Google Agenda)
  for (const x of input.externalBusy ?? []) {
    if (t < x.end + buf && end + buf > x.start) {
      conflicts.push({
        type: 'rdv',
        libelle: `Google Agenda indique une occupation (${minutesToTime(x.start)}–${minutesToTime(x.end)}).`,
        debut: minutesToTime(x.start),
        fin: minutesToTime(x.end),
      });
    }
  }

  // 5. Demandes souples qui perdraient leur place
  const before = placeSofts(day, settings);
  const after = placeSofts(buildDay(dayInput, [{ start: t, end: end + buf }]), settings);
  const lost = after.surcapacite.filter((id) => !before.surcapacite.includes(id));
  for (const id of lost) {
    const b = day.softs.find((x) => x.id === id);
    if (!b) continue;
    const periode = b.periode ?? periodeOfTime(b.heure_rdv, settings);
    conflicts.push({
      type: 'rdv',
      libelle: `La demande de ${bookingLabel(b)} (${periode === 'matin' ? 'matin' : 'après-midi'}) n'aurait plus de place.`,
      booking_id: id,
    });
  }

  return conflicts;
}

// ── Google Agenda : instants → minutes Zurich d'un jour ──────────────────────

/** Convertit des occupations (instants ISO) en intervalles de minutes pour le jour Zurich `date`. */
export function busyFromInstants(date: string, list: Array<{ start: string; end: string }>): Interval[] {
  const out: Interval[] = [];
  for (const item of list) {
    const s = new Date(item.start);
    const e = new Date(item.end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
    const ps = zurichNow(s);
    const pe = zurichNow(e);
    if (pe.date < date || ps.date > date) continue;
    const start = ps.date < date ? 0 : ps.minutes;
    const end = pe.date > date ? 1440 : pe.minutes;
    if (end > start) out.push({ start, end });
  }
  return mergeIntervals(out);
}

/** Vue minimale d'un `Booking` pour le moteur (évite les conversions manuelles). */
export function toEngineBooking(b: Booking): EngineBooking {
  return b;
}
