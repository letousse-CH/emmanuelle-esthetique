"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarOff, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import type { AgendaData, Booking, BookingBlock, BookingPeriode, PlageHoraire } from '../../../types/booking';
import { ACTIVE_STATUSES, PERIODE_LABEL, minutesToTime, timeToMinutes } from '../../../types/booking';
import { Button } from '../ui';
import { useMediaQuery } from './hooks';
import {
  DEFAULT_COUPURE,
  addDays,
  adminFetch,
  cap,
  daysBetween,
  errorMessage,
  formatDateLong,
  formatDayMonth,
  formatDateShort,
  fullName,
  nowMinutesZurich,
  periodeOf,
  weekStart,
  weekdayIndex,
} from './lib';

const PX_PER_MIN = 1;

interface DayModel {
  date: string;
  plages: PlageHoraire[];
  blocks: BookingBlock[];
  fixed: Booking[];
  soft: Record<BookingPeriode, Booking[]>;
}

function buildDay(date: string, data: AgendaData, coupure: string): DayModel {
  const cfg = data.settings?.jours_ouverture?.[String(weekdayIndex(date))];
  const plages = cfg && cfg.ouvert ? [...(cfg.plages ?? [])].sort((a, b) => a.debut.localeCompare(b.debut)) : [];
  const blocks = (data.blocks ?? []).filter((b) => b.date_debut <= date && (b.date_fin || b.date_debut) >= date);
  const dayBookings = (data.bookings ?? []).filter((b) => b.date_rdv === date && ACTIVE_STATUSES.includes(b.statut));
  const fixed = dayBookings.filter((b) => b.horaire_fixe || b.statut !== 'en_attente').sort((a, b) => a.heure_rdv.localeCompare(b.heure_rdv));
  const soft: Record<BookingPeriode, Booking[]> = { matin: [], apres_midi: [] };
  for (const b of dayBookings) {
    if (b.statut === 'en_attente' && !b.horaire_fixe) {
      soft[b.periode ?? periodeOf(b.heure_rdv, coupure)].push(b);
    }
  }
  for (const k of ['matin', 'apres_midi'] as BookingPeriode[]) soft[k].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { date, plages, blocks, fixed, soft };
}

function hoursLabel(d: DayModel): string {
  if (d.plages.length === 0) return 'Fermé';
  return d.plages.map((p) => `${p.debut}–${p.fin}`).join(' · ');
}

function bookingEnd(b: Booking): number {
  return timeToMinutes(b.heure_rdv) + Math.max(15, b.service_duree_minutes || 60);
}

/** Répartit les rendez-vous qui se chevauchent côte à côte. */
function layoutLanes(items: Booking[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach((c) => out.set(c.id, { lane: c.lane, lanes }));
    cluster = [];
    laneEnds = [];
  };
  for (const b of items) {
    const start = timeToMinutes(b.heure_rdv);
    if (cluster.length && start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = bookingEnd(b);
    clusterEnd = Math.max(clusterEnd, bookingEnd(b));
    cluster.push({ id: b.id, lane });
  }
  if (cluster.length) flush();
  return out;
}

const HATCH: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(87,83,78,0.28) 0, rgba(87,83,78,0.28) 5px, rgba(87,83,78,0.08) 5px, rgba(87,83,78,0.08) 11px)',
};

function bookingClass(b: Booking): string {
  if (b.statut === 'termine') return 'bg-stone-300 text-stone-900 border-stone-400';
  if (b.statut === 'en_attente') return 'bg-amber-100 text-amber-950 border-amber-500';
  return 'bg-accent text-accent-fg border-transparent';
}

function shortName(b: Booking) {
  return `${b.prenom} ${(b.nom || '').charAt(0)}.`.trim();
}

export default function AgendaView({
  refreshKey,
  today,
  onOpenBooking,
  onNewAt,
  onOpenBlocks,
}: {
  refreshKey: number;
  today: string;
  onOpenBooking: (id: string) => void;
  onNewAt: (date: string, heure: string | null) => void;
  onOpenBlocks: () => void;
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<'semaine' | 'jour'>('semaine');
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = mode === 'semaine' ? weekStart(anchor) : anchor;
  const to = mode === 'semaine' ? addDays(from, 6) : anchor;

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminFetch<AgendaData>(`/api/admin/bookings/agenda?from=${from}&to=${to}`)
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to, refreshKey]);

  const coupure = data?.settings?.heure_coupure_periode || DEFAULT_COUPURE;
  const days = useMemo(() => (data ? daysBetween(from, to).map((d) => buildDay(d, data, coupure)) : []), [data, from, to, coupure]);

  const step = mode === 'semaine' ? 7 : 1;
  const label =
    mode === 'semaine'
      ? `Semaine du ${formatDayMonth(from)} au ${formatDayMonth(to)}`
      : cap(formatDateLong(anchor));
  const pas = data?.settings?.pas_creneau_minutes || 15;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor(addDays(anchor, -step))}
            aria-label={mode === 'semaine' ? 'Semaine précédente' : 'Jour précédent'}
            className="grid size-12 place-items-center rounded-lg border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(addDays(anchor, step))}
            aria-label={mode === 'semaine' ? 'Semaine suivante' : 'Jour suivant'}
            className="grid size-12 place-items-center rounded-lg border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <Button className="h-12" onClick={() => setAnchor(today)}>
          Aujourd’hui
        </Button>
        <p className="order-last w-full text-[17px] font-semibold text-stone-950 sm:order-none sm:w-auto sm:flex-1 sm:px-2" aria-live="polite">
          {label}
          {loading && <Loader2 size={15} className="ml-2 inline animate-spin text-stone-500" aria-label="Chargement" />}
        </p>
        <div role="group" aria-label="Affichage" className="ml-auto inline-flex rounded-lg bg-stone-100 p-1">
          {(['jour', 'semaine'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-10 rounded-md px-4 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                mode === m ? 'bg-white font-semibold text-stone-950 shadow-xs ring-1 ring-stone-200' : 'font-medium text-stone-700'
              }`}
            >
              {m === 'jour' ? 'Jour' : 'Semaine'}
            </button>
          ))}
        </div>
      </div>

      {/* Légende */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-stone-800" aria-label="Légende">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded-sm bg-accent" aria-hidden="true" /> Rendez-vous fixé
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded-sm border-2 border-dashed border-amber-600 bg-amber-50" aria-hidden="true" /> Demande à fixer
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded-sm border border-stone-400" style={HATCH} aria-hidden="true" /> Indisponible
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded-sm border border-stone-300 bg-white" aria-hidden="true" /> Heures d’ouverture
        </li>
        <li>
          <button type="button" onClick={onOpenBlocks} className="inline-flex min-h-8 items-center gap-1 font-semibold text-accent underline underline-offset-2 hover:no-underline">
            <CalendarOff size={14} aria-hidden="true" /> Gérer mes indisponibilités
          </button>
        </li>
      </ul>

      {error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[14.5px] font-medium text-red-900">
          {error}
        </p>
      )}

      {data && (isDesktop && mode === 'semaine' ? (
        <WeekGrid days={days} today={today} pas={pas} coupure={coupure} onOpenBooking={onOpenBooking} onNewAt={onNewAt} />
      ) : (
        <DayList days={days} today={today} onOpenBooking={onOpenBooking} onNewAt={onNewAt} />
      ))}
      {!data && loading && <p className="py-10 text-center text-[15px] text-stone-700">Chargement de l’agenda…</p>}
    </div>
  );
}

// ── Grille semaine (ordinateur) ─────────────────────────────────────────────

function WeekGrid({
  days,
  today,
  pas,
  coupure,
  onOpenBooking,
  onNewAt,
}: {
  days: DayModel[];
  today: string;
  pas: number;
  coupure: string;
  onOpenBooking: (id: string) => void;
  onNewAt: (date: string, heure: string | null) => void;
}) {
  const [nowMin, setNowMin] = useState(() => nowMinutesZurich());
  useEffect(() => {
    const t = window.setInterval(() => setNowMin(nowMinutesZurich()), 60000);
    return () => window.clearInterval(t);
  }, []);

  // Bornes verticales : heures d'ouverture de la semaine, élargies aux rendez-vous hors horaires.
  let min = Infinity;
  let max = -Infinity;
  for (const d of days) {
    for (const p of d.plages) {
      min = Math.min(min, timeToMinutes(p.debut));
      max = Math.max(max, timeToMinutes(p.fin));
    }
    for (const b of d.fixed) {
      min = Math.min(min, timeToMinutes(b.heure_rdv));
      max = Math.max(max, bookingEnd(b));
    }
    for (const b of d.blocks) {
      if (b.heure_debut && b.heure_fin) {
        min = Math.min(min, timeToMinutes(b.heure_debut));
        max = Math.max(max, timeToMinutes(b.heure_fin));
      }
    }
  }
  if (!Number.isFinite(min)) min = 8 * 60;
  if (!Number.isFinite(max)) max = 19 * 60;
  const gridMin = Math.max(0, Math.floor(min / 60) * 60 - 0);
  const gridMax = Math.min(24 * 60, Math.ceil(max / 60) * 60);
  const height = (gridMax - gridMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = gridMin; m < gridMax; m += 60) hours.push(m);
  const cut = timeToMinutes(coupure);
  const y = (m: number) => (m - gridMin) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-300 bg-white">
      <div className="min-w-[56rem]">
        {/* En-têtes */}
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-stone-300 bg-stone-50">
          <div />
          {days.map((d) => {
            const isToday = d.date === today;
            const nSoft = d.soft.matin.length + d.soft.apres_midi.length;
            return (
              <div key={d.date} className="flex items-center justify-between gap-1 border-l border-stone-200 px-2 py-2">
                <div className="min-w-0">
                  <p className={`text-[14px] font-semibold leading-tight ${isToday ? 'text-accent' : 'text-stone-950'}`}>
                    {cap(formatDateShort(d.date))}
                  </p>
                  {isToday && <p className="text-[11.5px] font-bold text-accent">Aujourd’hui</p>}
                  {d.plages.length === 0 && <p className="text-[12.5px] text-stone-700">Fermé</p>}
                  {nSoft > 0 && <p className="text-[12.5px] font-semibold text-amber-900">{nSoft} à fixer</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onNewAt(d.date, null)}
                  aria-label={`Ajouter un rendez-vous le ${formatDateLong(d.date)}`}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-stone-300 bg-white text-stone-800 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Plus size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          {/* Axe des heures */}
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-[12px] text-stone-600" style={{ top: y(m) + 0 }}>
                {minutesToTime(m)}
              </span>
            ))}
          </div>

          {days.map((d) => {
            const lanes = layoutLanes(d.fixed);
            const open = d.plages.length > 0;
            const start = open ? Math.min(...d.plages.map((p) => timeToMinutes(p.debut))) : gridMin;
            const end = open ? Math.max(...d.plages.map((p) => timeToMinutes(p.fin))) : gridMax;
            const bands: { periode: BookingPeriode; from: number; to: number }[] = [
              { periode: 'matin', from: start, to: Math.min(cut, end) },
              { periode: 'apres_midi', from: Math.max(cut, start), to: end },
            ];
            return (
              <div
                key={d.date}
                role="group"
                aria-label={cap(formatDateLong(d.date))}
                className={`relative border-l border-stone-200 ${open ? 'bg-stone-100' : 'bg-stone-100'} ${d.date === today ? 'ring-1 ring-inset ring-accent/30' : ''}`}
                style={{ height, cursor: 'copy' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const m = gridMin + Math.floor((e.clientY - rect.top) / PX_PER_MIN / pas) * pas;
                  onNewAt(d.date, minutesToTime(Math.max(0, m)));
                }}
              >
                {/* Heures d'ouverture */}
                {d.plages.map((p, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 bg-white"
                    style={{ top: y(timeToMinutes(p.debut)), height: (timeToMinutes(p.fin) - timeToMinutes(p.debut)) * PX_PER_MIN }}
                  />
                ))}
                {/* Lignes d'heures */}
                {hours.map((m) => (
                  <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-stone-200" style={{ top: y(m) }} />
                ))}

                {/* Indisponibilités */}
                {d.blocks.map((b) => {
                  const partial = Boolean(b.heure_debut && b.heure_fin);
                  const top = partial ? y(timeToMinutes(b.heure_debut as string)) : 0;
                  const h = partial ? (timeToMinutes(b.heure_fin as string) - timeToMinutes(b.heure_debut as string)) * PX_PER_MIN : height;
                  return (
                    <div
                      key={b.id}
                      className="pointer-events-none absolute inset-x-0 z-10 overflow-hidden border-y border-stone-400 px-1.5 py-1 text-[12px] font-semibold text-stone-900"
                      style={{ ...HATCH, top, height: h }}
                    >
                      <span className="rounded bg-white/85 px-1">{b.motif || 'Indisponible'}</span>
                    </div>
                  );
                })}

                {/* Demandes à fixer */}
                {bands.map((band) => {
                  const list = d.soft[band.periode];
                  if (list.length === 0) return null;
                  const top = y(band.from);
                  const h = Math.max(48, (band.to - band.from) * PX_PER_MIN);
                  return (
                    <div key={band.periode} className="absolute inset-x-0.5 z-20 flex gap-0.5" style={{ top, height: h }}>
                      {list.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenBooking(b.id);
                          }}
                          aria-label={`Demande à fixer, ${PERIODE_LABEL[band.periode].toLowerCase()} : ${fullName(b)}, ${b.service_nom}`}
                          className="flex min-w-0 flex-1 flex-col items-stretch justify-start overflow-hidden rounded-md border-2 border-dashed border-amber-600 bg-amber-50/90 px-1.5 py-1 text-left text-[12px] leading-tight text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          <span className="block font-bold">À fixer · {PERIODE_LABEL[band.periode]}</span>
                          <span className="block truncate font-semibold">{shortName(b)}</span>
                          <span className="block truncate">{b.service_nom}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}

                {/* Rendez-vous fixés */}
                {d.fixed.map((b) => {
                  const l = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
                  const startM = timeToMinutes(b.heure_rdv);
                  const h = Math.max(24, (bookingEnd(b) - startM) * PX_PER_MIN - 1);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBooking(b.id);
                      }}
                      aria-label={`${b.heure_rdv}, ${fullName(b)}, ${b.service_nom}`}
                      className={`absolute z-30 flex flex-col items-stretch justify-start overflow-hidden rounded-md border px-1.5 py-1 text-left text-[12px] leading-tight shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent ${bookingClass(b)}`}
                      style={{
                        top: y(startM),
                        height: h,
                        left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / l.lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-bold">
                        {b.heure_rdv} {shortName(b)}
                      </span>
                      {h >= 40 && <span className="block truncate opacity-95">{b.service_nom}</span>}
                    </button>
                  );
                })}

                {/* Heure actuelle */}
                {d.date === today && nowMin >= gridMin && nowMin <= gridMax && (
                  <div className="pointer-events-none absolute inset-x-0 z-40 border-t-2 border-red-600" style={{ top: y(nowMin) }}>
                    <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Liste par jour (téléphone, ou affichage « jour ») ───────────────────────

function DayList({
  days,
  today,
  onOpenBooking,
  onNewAt,
}: {
  days: DayModel[];
  today: string;
  onOpenBooking: (id: string) => void;
  onNewAt: (date: string, heure: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const empty = d.fixed.length === 0 && d.blocks.length === 0 && d.soft.matin.length === 0 && d.soft.apres_midi.length === 0;
        const isToday = d.date === today;
        return (
          <section
            key={d.date}
            aria-label={cap(formatDateLong(d.date))}
            className={`overflow-hidden rounded-2xl border bg-white ${isToday ? 'border-accent' : 'border-stone-300'}`}
          >
            <header className={`flex items-center justify-between gap-3 px-4 py-3 ${isToday ? 'bg-accent-soft' : 'bg-stone-50'}`}>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-stone-950">
                  {cap(formatDateLong(d.date))}
                  {isToday && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-fg">Aujourd’hui</span>}
                </h3>
                <p className="text-[13.5px] text-stone-700">{hoursLabel(d)}</p>
              </div>
              <button
                type="button"
                onClick={() => onNewAt(d.date, null)}
                aria-label={`Ajouter un rendez-vous le ${formatDateLong(d.date)}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-stone-300 bg-white text-stone-900 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Plus size={19} />
              </button>
            </header>

            {empty ? (
              <p className="px-4 py-3 text-[14px] text-stone-600">{d.plages.length ? 'Rien de prévu.' : 'Jour de fermeture.'}</p>
            ) : (
              <ul className="space-y-2 p-3">
                {d.blocks.map((b) => (
                  <li key={b.id} className="rounded-lg border border-stone-400 px-3 py-2 text-[14.5px] font-semibold text-stone-900" style={HATCH}>
                    <span className="rounded bg-white/85 px-1.5 py-0.5">
                      {b.heure_debut && b.heure_fin ? `${b.heure_debut} – ${b.heure_fin}` : 'Toute la journée'} · {b.motif || 'Indisponible'}
                    </span>
                  </li>
                ))}
                {(['matin', 'apres_midi'] as BookingPeriode[]).map((p) =>
                  d.soft[p].length === 0 ? null : (
                    <li key={p}>
                      <p className="mb-1 text-[12.5px] font-bold uppercase tracking-wide text-amber-900">{PERIODE_LABEL[p]} · à fixer</p>
                      <ul className="space-y-2">
                        {d.soft[p].map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => onOpenBooking(b.id)}
                              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border-2 border-dashed border-amber-600 bg-amber-50 px-3 py-2 text-left text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-[15.5px] font-semibold">{fullName(b)}</span>
                                <span className="block truncate text-[13.5px]">{b.service_nom}</span>
                              </span>
                              <ChevronRight size={18} className="shrink-0" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ),
                )}
                {d.fixed.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onOpenBooking(b.id)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent ${bookingClass(b)}`}
                    >
                      <span className="w-14 shrink-0 text-[15px] font-bold leading-tight">
                        {b.heure_rdv}
                        <span className="block text-[12px] font-medium opacity-90">{minutesToTime(bookingEnd(b))}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15.5px] font-semibold">{fullName(b)}</span>
                        <span className="block truncate text-[13.5px] opacity-95">{b.service_nom}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
