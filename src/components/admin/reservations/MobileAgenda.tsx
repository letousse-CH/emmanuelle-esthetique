"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CalendarOff, ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import type { AgendaData, Booking, BookingPeriode } from '../../../types/booking';
import { ACTIVE_STATUSES, PERIODE_LABEL, minutesToTime, timeToMinutes } from '../../../types/booking';
import { Button } from '../ui';
import { BottomSheet, EmptyState, Skeleton } from '../mobile/ui';
import { HATCH, bookingClass, bookingEnd, buildDay, layoutLanes, shortName } from './AgendaView';
import type { DayModel } from './AgendaView';
import ListView from './ListView';
import SwipeArea from './SwipeArea';
import SyncClientsButton from './SyncClientsButton';
import TodoView from './TodoView';
import {
  DEFAULT_COUPURE,
  addDays,
  addMonths,
  cap,
  dayOfMonth,
  daysBetween,
  formatDateLong,
  formatDayMonth,
  formatMonthYear,
  formatWeekdayShort,
  fullName,
  nowMinutesZurich,
  weekStart,
  weekdayIndex,
} from './lib';

/**
 * Écran « Agenda » du téléphone (< 1024 px) : l'écran principal d'Emmanuelle.
 *
 * Quatre vues : Jour (par défaut, sur aujourd'hui), Semaine compacte, Liste, et
 * la file « À traiter ». Cet écran ne charge rien lui-même : l'écran de page lui
 * donne les rendez-vous et l'agenda de la plage affichée, ce qui permet de le
 * rendre avec des données d'exemple.
 */

export type MobileVue = 'jour' | 'semaine' | 'liste' | 'a-traiter';

/** Plage d'agenda à charger pour afficher `date` : la semaine, plus celles d'avant et d'après (glisser sans attente). */
export function agendaRange(date: string): { from: string; to: string } {
  const from = addDays(weekStart(date), -7);
  return { from, to: addDays(from, 20) };
}

const PX_PER_MIN = 1.2;

export interface MobileAgendaProps {
  vue: MobileVue;
  onVue: (v: MobileVue) => void;
  date: string;
  onDate: (d: string) => void;
  today: string;
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingsError: string | null;
  onRetryBookings: () => void;
  agenda: AgendaData | null;
  agendaLoading: boolean;
  agendaError: string | null;
  onRetryAgenda: () => void;
  visitsByClient: Map<string, number>;
  coupure: string;
  onOpen: (id: string) => void;
  onNew: (date?: string, time?: string | null) => void;
  onOpenBlocks: (date?: string) => void;
  onReload: () => void;
}

export default function MobileAgenda(p: MobileAgendaProps) {
  const { vue, date, today, bookings, agenda } = p;
  const [monthOpen, setMonthOpen] = useState(false);
  const coupure = p.coupure || DEFAULT_COUPURE;
  const toCall = useMemo(() => bookings.filter((b) => b.statut === 'en_attente').length, [bookings]);

  // Pastilles du bandeau : rendez-vous fixés / demandes à fixer, par jour.
  const counts = useMemo(() => {
    const m = new Map<string, { rdv: number; demandes: number }>();
    for (const b of bookings) {
      if (!ACTIVE_STATUSES.includes(b.statut)) continue;
      const c = m.get(b.date_rdv) ?? { rdv: 0, demandes: 0 };
      if (b.statut === 'en_attente' && !b.horaire_fixe) c.demandes++;
      else c.rdv++;
      m.set(b.date_rdv, c);
    }
    return m;
  }, [bookings]);

  const closedWeekdays = useMemo(() => {
    const s = new Set<number>();
    const cfg = agenda?.settings?.jours_ouverture;
    if (cfg) for (let i = 0; i < 7; i++) if (!cfg[String(i)]?.ouvert) s.add(i);
    return s;
  }, [agenda]);

  const step = vue === 'semaine' ? 7 : 1;
  const covers = Boolean(agenda && agenda.from <= date && agenda.to >= date);
  const showDates = vue === 'jour' || vue === 'semaine';

  const day = useMemo<DayModel | null>(
    () => (agenda && vue === 'jour' && covers ? buildDay(date, agenda, coupure) : null),
    [agenda, vue, date, covers, coupure],
  );
  const week = useMemo<DayModel[]>(
    () => (agenda && vue === 'semaine' ? daysBetween(weekStart(date), addDays(weekStart(date), 6)).map((d) => buildDay(d, agenda, coupure)) : []),
    [agenda, vue, date, coupure],
  );

  const activeDates = useMemo(() => new Set(Array.from(counts.keys())), [counts]);

  return (
    <div className="space-y-4 pb-20">
      <h1 className="sr-only">Agenda</h1>

      <VueSwitch
        value={vue}
        onChange={p.onVue}
        options={[
          { value: 'jour', label: 'Jour' },
          { value: 'semaine', label: 'Semaine' },
          { value: 'liste', label: 'Liste' },
          { value: 'a-traiter', label: 'À traiter', count: toCall },
        ]}
      />

      {p.bookingsError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-950">
          <span>{p.bookingsError}</span>
          <Button onClick={p.onRetryBookings} icon={RefreshCw}>
            Réessayer
          </Button>
        </div>
      )}

      {showDates && (
        <>
          <DateBar vue={vue} date={date} today={today} step={step} onDate={p.onDate} onOpenMonth={() => setMonthOpen(true)} />
          {vue === 'jour' && (
            <DayStrip date={date} today={today} counts={counts} closedWeekdays={closedWeekdays} onPick={p.onDate} />
          )}
        </>
      )}

      {p.agendaError && showDates && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-950">
          <span>{p.agendaError}</span>
          <Button onClick={p.onRetryAgenda} icon={RefreshCw}>
            Réessayer
          </Button>
        </div>
      )}

      {vue === 'jour' && (
        <SwipeArea animKey={date} onSwipe={(d) => p.onDate(addDays(date, d))}>
          {day ? (
            <DayContent
              day={day}
              today={today}
              pas={agenda?.settings?.pas_creneau_minutes || 15}
              coupure={coupure}
              onOpen={p.onOpen}
              onNewAt={(t) => p.onNew(date, t)}
              onOpenBlocks={() => p.onOpenBlocks(date)}
            />
          ) : p.agendaError ? null : (
            <div className="space-y-3" aria-busy="true" aria-label="Chargement de la journée">
              <Skeleton className="h-14" />
              <Skeleton className="h-64" />
            </div>
          )}
        </SwipeArea>
      )}

      {vue === 'semaine' && (
        <SwipeArea animKey={weekStart(date)} onSwipe={(d) => p.onDate(addDays(date, d * 7))}>
          {agenda && week.length > 0 && covers ? (
            <WeekCompact
              days={week}
              today={today}
              onPickDay={(d) => {
                p.onDate(d);
                p.onVue('jour');
              }}
              onOpen={p.onOpen}
              onNewAt={(d) => p.onNew(d, null)}
              onOpenBlocks={() => p.onOpenBlocks(date)}
            />
          ) : p.agendaError ? null : (
            <div className="space-y-3" aria-busy="true" aria-label="Chargement de la semaine">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}
        </SwipeArea>
      )}

      {vue === 'liste' &&
        (p.bookingsLoading && bookings.length === 0 ? (
          <Skeleton className="h-64" />
        ) : (
          <ListView bookings={bookings} today={today} coupure={coupure} onOpen={p.onOpen} />
        ))}

      {vue === 'a-traiter' &&
        (p.bookingsLoading && bookings.length === 0 ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : (
          <TodoView bookings={bookings} visitsByClient={p.visitsByClient} coupure={coupure} onOpen={p.onOpen} />
        ))}

      <details className="rounded-2xl border border-stone-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-[15px] font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          Outils
        </summary>
        <div className="space-y-4 border-t border-stone-200 p-4">
          <Button icon={CalendarOff} className="w-full" onClick={() => p.onOpenBlocks()}>
            Mes indisponibilités
          </Button>
          <SyncClientsButton onDone={p.onReload} />
        </div>
      </details>

      <AgendaFab onClick={() => (vue === 'jour' ? p.onNew(date, null) : p.onNew())} />

      <MonthSheet
        open={monthOpen}
        onClose={() => setMonthOpen(false)}
        date={date}
        today={today}
        activeDates={activeDates}
        onPick={(d) => {
          setMonthOpen(false);
          p.onDate(d);
          if (vue !== 'jour' && vue !== 'semaine') p.onVue('jour');
        }}
      />
    </div>
  );
}

// ── Choix de la vue ─────────────────────────────────────────────────────────

/**
 * Comme le `SegmentedControl` du kit, mais les segments se partagent la place
 * selon leur texte : quatre libellés (dont « À traiter » et sa pastille) tiennent
 * sur 343 px sans être tronqués.
 */
function VueSwitch({
  value,
  onChange,
  options,
}: {
  value: MobileVue;
  onChange: (v: MobileVue) => void;
  options: { value: MobileVue; label: string; count?: number }[];
}) {
  return (
    <div role="radiogroup" aria-label="Vue de l’agenda" className="flex w-full gap-0.5 rounded-2xl bg-stone-100 p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              onChange(options[(i + dir + options.length) % options.length].value);
            }}
            className={`flex min-h-11 min-w-0 flex-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-[15px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              active ? 'bg-white font-semibold text-stone-950 shadow-[0_1px_3px_rgba(28,25,23,0.12)]' : 'font-medium text-stone-700 active:bg-white/60'
            }`}
          >
            {o.label}
            {o.count ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[12px] font-bold leading-none text-white">
                <span className="sr-only">{`${o.count} demande${o.count > 1 ? 's' : ''}`}</span>
                <span aria-hidden="true">{o.count}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bouton « + » flottant, au-dessus de la barre d'onglets. Écrit ici plutôt que
 * pris du kit : la feuille de style du site public (`main button.rounded-full`)
 * force `position: relative` sur les boutons ronds d'un <main> et le `Fab` du
 * kit cesserait de flotter ; `rounded-[28px]` dessine le même rond sans cette règle.
 */
function AgendaFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nouveau rendez-vous"
      className="admin-fab fixed right-4 z-30 inline-flex size-14 cursor-pointer items-center justify-center rounded-[28px] bg-accent text-accent-fg shadow-[0_6px_20px_rgba(28,25,23,0.22)] transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white lg:hidden"
      style={{ bottom: 'calc(var(--admin-tabbar-h, 0px) + env(safe-area-inset-bottom) + 1rem)' }}
    >
      <Plus size={24} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

// ── Date et flèches ─────────────────────────────────────────────────────────

function dayTitle(date: string, today: string): { title: string; sub: string } {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  const long = cap(formatDateLong(date));
  if (diff === 0) return { title: 'Aujourd’hui', sub: formatDateLong(date) };
  if (diff === 1) return { title: 'Demain', sub: formatDateLong(date) };
  if (diff === -1) return { title: 'Hier', sub: formatDateLong(date) };
  return { title: long, sub: diff > 0 ? `dans ${diff} jours` : `il y a ${-diff} jours` };
}

function DateBar({
  vue,
  date,
  today,
  step,
  onDate,
  onOpenMonth,
}: {
  vue: MobileVue;
  date: string;
  today: string;
  step: number;
  onDate: (d: string) => void;
  onOpenMonth: () => void;
}) {
  const ws = weekStart(date);
  const isWeek = vue === 'semaine';
  const atToday = isWeek ? ws === weekStart(today) : date === today;
  const t = isWeek
    ? {
        title: ws === weekStart(today) ? 'Cette semaine' : `${dayOfMonth(ws)} – ${formatDayMonth(addDays(ws, 6))}`,
        sub: formatMonthYear(date),
      }
    : dayTitle(date, today);
  const nav = (n: number) => onDate(addDays(date, n * step));
  const arrow =
    'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-stone-200 bg-white text-stone-900 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenMonth}
        aria-label={`${t.title}. Ouvrir le calendrier du mois`}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        aria-live="polite"
      >
        <span className="min-w-0">
          <span className="block truncate text-[20px] font-semibold leading-tight tracking-tight text-stone-950">{t.title}</span>
          <span className="block truncate text-[13px] leading-tight text-stone-600">{t.sub}</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-stone-500" aria-hidden="true" />
      </button>
      {!atToday && (
        <button
          type="button"
          onClick={() => onDate(today)}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full bg-accent-soft px-3.5 text-[14px] font-semibold text-accent active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          Aujourd’hui
        </button>
      )}
      <button type="button" onClick={() => nav(-1)} aria-label={isWeek ? 'Semaine précédente' : 'Jour précédent'} className={arrow}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => nav(1)} aria-label={isWeek ? 'Semaine suivante' : 'Jour suivant'} className={arrow}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Bandeau des jours ───────────────────────────────────────────────────────

function DayStrip({
  date,
  today,
  counts,
  closedWeekdays,
  onPick,
}: {
  date: string;
  today: string;
  counts: Map<string, { rdv: number; demandes: number }>;
  closedWeekdays: Set<number>;
  onPick: (d: string) => void;
}) {
  const ws = weekStart(date);
  const days = daysBetween(ws, addDays(ws, 6));
  return (
    <div
      role="group"
      aria-label="Jours de la semaine"
      className="sticky z-20 -mx-4 border-b border-stone-200 bg-stone-50/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-5"
      style={{ top: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      <div className="flex gap-1">
        {days.map((d) => {
          const sel = d === date;
          const isToday = d === today;
          const c = counts.get(d);
          const closed = closedWeekdays.has(weekdayIndex(d));
          const label =
            `${cap(formatDateLong(d))}` +
            (c?.rdv ? `, ${c.rdv} rendez-vous` : '') +
            (c?.demandes ? `, ${c.demandes} demande${c.demandes > 1 ? 's' : ''} à fixer` : '') +
            (closed ? ', fermé' : '');
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-label={label}
              aria-current={sel ? 'date' : undefined}
              data-selected={sel}
              className={`flex min-h-[4.75rem] min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                sel ? 'bg-accent text-accent-fg shadow-sm' : 'text-stone-900 active:bg-stone-200/70'
              }`}
            >
              <span className={`text-[12px] font-medium uppercase ${sel ? 'text-accent-fg/85' : closed ? 'text-stone-400' : 'text-stone-600'}`}>
                {formatWeekdayShort(d)}
              </span>
              <span
                className={`text-[19px] font-semibold leading-none tabular-nums ${
                  sel ? '' : isToday ? 'text-accent' : closed ? 'text-stone-400' : ''
                }`}
              >
                {dayOfMonth(d)}
              </span>
              {isToday && !sel && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
              <span className="mt-auto flex h-5 items-center gap-0.5" aria-hidden="true">
                {c?.rdv ? (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold leading-none ${
                      sel ? 'bg-white text-stone-900' : 'bg-accent text-accent-fg'
                    }`}
                  >
                    {c.rdv}
                  </span>
                ) : null}
                {c?.demandes ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[12px] font-bold leading-none text-white">
                    {c.demandes}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendrier du mois (feuille) ────────────────────────────────────────────

function MonthSheet({
  open,
  onClose,
  date,
  today,
  activeDates,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  today: string;
  activeDates: Set<string>;
  onPick: (d: string) => void;
}) {
  const [cursor, setCursor] = useState(date);
  useEffect(() => {
    if (open) setCursor(date);
  }, [open, date]);
  const first = `${cursor.slice(0, 7)}-01`;
  const gridStart = weekStart(first);
  const month = cursor.slice(0, 7);
  const cells = daysBetween(gridStart, addDays(gridStart, 41)).filter((_, i, a) => i < 35 || a[i].slice(0, 7) === month);
  const arrow =
    'grid size-11 cursor-pointer place-items-center rounded-full border border-stone-200 bg-white text-stone-900 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Choisir un jour"
      footer={
        <Button variant="primary" className="w-full" onClick={() => onPick(today)}>
          Aujourd’hui
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <button type="button" className={arrow} aria-label="Mois précédent" onClick={() => setCursor(addMonths(first, -1))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <p className="text-[17px] font-semibold text-stone-950" aria-live="polite">
          {cap(formatMonthYear(first))}
        </p>
        <button type="button" className={arrow} aria-label="Mois suivant" onClick={() => setCursor(addMonths(first, 1))}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {daysBetween(gridStart, addDays(gridStart, 6)).map((d) => (
          <span key={d} className="pb-1 text-[12px] font-medium uppercase text-stone-600">
            {formatWeekdayShort(d)}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const sel = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-label={cap(formatDateLong(d))}
              aria-current={sel ? 'date' : undefined}
              className={`relative mx-auto grid size-11 cursor-pointer place-items-center rounded-full text-[16px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                sel
                  ? 'bg-accent font-semibold text-accent-fg'
                  : d === today
                    ? 'font-bold text-accent ring-1 ring-accent'
                    : inMonth
                      ? 'text-stone-900 active:bg-stone-100'
                      : 'text-stone-400'
              }`}
            >
              {dayOfMonth(d)}
              {activeDates.has(d) && (
                <span className={`absolute bottom-1 size-1.5 rounded-full ${sel ? 'bg-accent-fg' : 'bg-accent'}`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

// ── Une journée : demandes à fixer + chronologie ────────────────────────────

function hoursLabel(d: DayModel): string {
  return d.plages.length === 0 ? 'Fermé' : d.plages.map((p) => `${p.debut}–${p.fin}`).join(' · ');
}

function DayContent({
  day,
  today,
  pas,
  coupure,
  onOpen,
  onNewAt,
  onOpenBlocks,
}: {
  day: DayModel;
  today: string;
  pas: number;
  coupure: string;
  onOpen: (id: string) => void;
  onNewAt: (time: string | null) => void;
  onOpenBlocks: () => void;
}) {
  const nSoft = day.soft.matin.length + day.soft.apres_midi.length;
  const closedEmpty = day.plages.length === 0 && day.fixed.length === 0;
  return (
    <section aria-label={cap(formatDateLong(day.date))} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[15px] text-stone-700">
          <span className="font-semibold text-stone-950">{hoursLabel(day)}</span>
          <span className="block text-[13px] text-stone-600">
            {day.fixed.length} rendez-vous{nSoft > 0 ? ` · ${nSoft} demande${nSoft > 1 ? 's' : ''} à fixer` : ''}
          </span>
        </p>
        <Button icon={CalendarOff} onClick={onOpenBlocks} className="shrink-0">
          Je ne travaille pas
        </Button>
      </div>

      {nSoft > 0 && (
        <ul className="space-y-2" aria-label="Demandes à fixer ce jour">
          {(['matin', 'apres_midi'] as BookingPeriode[]).flatMap((per) =>
            day.soft[per].map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 px-4 py-2.5 text-left text-amber-950 active:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold uppercase tracking-wide text-amber-900">{PERIODE_LABEL[per]} · à fixer</span>
                    <span className="block truncate text-[16px] font-semibold">{fullName(b)}</span>
                    <span className="block truncate text-[14px]">{b.service_nom}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0" aria-hidden="true" />
                </button>
              </li>
            )),
          )}
        </ul>
      )}

      {closedEmpty ? (
        <EmptyState
          icon={CalendarCheck}
          title="Jour de fermeture"
          description="Rien n’est prévu ce jour-là."
          action={
            <Button variant="primary" onClick={() => onNewAt(null)}>
              Ajouter quand même un rendez-vous
            </Button>
          }
        />
      ) : (
        <>
          <Timeline day={day} today={today} pas={pas} coupure={coupure} onOpen={onOpen} onNewAt={onNewAt} />
          {day.fixed.length === 0 && nSoft === 0 && (
            <p className="text-center text-[14px] text-stone-600">Rien de prévu. Touchez une heure libre pour ajouter un rendez-vous.</p>
          )}
        </>
      )}
    </section>
  );
}

function Timeline({
  day,
  today,
  pas,
  coupure,
  onOpen,
  onNewAt,
}: {
  day: DayModel;
  today: string;
  pas: number;
  coupure: string;
  onOpen: (id: string) => void;
  onNewAt: (time: string | null) => void;
}) {
  const [nowMin, setNowMin] = useState(() => nowMinutesZurich());
  useEffect(() => {
    const t = window.setInterval(() => setNowMin(nowMinutesZurich()), 60000);
    return () => window.clearInterval(t);
  }, []);

  let min = Infinity;
  let max = -Infinity;
  for (const p of day.plages) {
    min = Math.min(min, timeToMinutes(p.debut));
    max = Math.max(max, timeToMinutes(p.fin));
  }
  for (const b of day.fixed) {
    min = Math.min(min, timeToMinutes(b.heure_rdv));
    max = Math.max(max, bookingEnd(b));
  }
  for (const b of day.blocks) {
    if (b.heure_debut && b.heure_fin) {
      min = Math.min(min, timeToMinutes(b.heure_debut));
      max = Math.max(max, timeToMinutes(b.heure_fin));
    }
  }
  if (!Number.isFinite(min)) min = 8 * 60;
  if (!Number.isFinite(max)) max = 19 * 60;
  const gridMin = Math.max(0, Math.floor(min / 60) * 60);
  const gridMax = Math.min(24 * 60, Math.max(Math.ceil(max / 60) * 60, gridMin + 180));
  const height = (gridMax - gridMin) * PX_PER_MIN;
  const y = (m: number) => (m - gridMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = gridMin; m < gridMax; m += 60) hours.push(m);
  const lanes = layoutLanes(day.fixed);
  const cut = timeToMinutes(coupure);
  const start = day.plages.length ? Math.min(...day.plages.map((p) => timeToMinutes(p.debut))) : gridMin;
  const end = day.plages.length ? Math.max(...day.plages.map((p) => timeToMinutes(p.fin))) : gridMax;
  const bands = [
    { periode: 'matin' as BookingPeriode, from: start, to: Math.min(cut, end) },
    { periode: 'apres_midi' as BookingPeriode, from: Math.max(cut, start), to: end },
  ].filter((b) => day.soft[b.periode].length > 0 && b.to > b.from);
  const isToday = day.date === today;
  const nowRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  // Aujourd'hui : l'heure actuelle est ramenée au milieu de l'écran, une fois.
  useEffect(() => {
    if (!isToday || scrolledFor.current === day.date) return;
    scrolledFor.current = day.date;
    nowRef.current?.scrollIntoView({ block: 'center' });
  }, [isToday, day.date]);

  return (
    <div className="flex select-none rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <div className="relative w-12 shrink-0" style={{ height }} aria-hidden="true">
        {hours.map((m, i) => (
          <span
            key={m}
            className="absolute right-2 text-[12px] tabular-nums text-stone-600"
            style={{ top: y(m), transform: i === 0 ? 'translateY(4px)' : 'translateY(-50%)' }}
          >
            {minutesToTime(m)}
          </span>
        ))}
      </div>
      <div
        role="group"
        aria-label="Chronologie de la journée. Touchez une heure libre pour ajouter un rendez-vous."
        className="relative min-w-0 flex-1 cursor-copy overflow-hidden rounded-r-2xl bg-stone-100"
        style={{ height }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const m = gridMin + Math.floor((e.clientY - rect.top) / PX_PER_MIN / pas) * pas;
          onNewAt(minutesToTime(Math.max(0, Math.min(m, 24 * 60 - pas))));
        }}
      >
        {day.plages.map((p, i) => (
          <div
            key={i}
            className="absolute inset-x-0 bg-white"
            style={{ top: y(timeToMinutes(p.debut)), height: (timeToMinutes(p.fin) - timeToMinutes(p.debut)) * PX_PER_MIN }}
          />
        ))}
        {hours.map((m) => (
          <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-stone-200" style={{ top: y(m) }} />
        ))}

        {day.blocks.map((b) => {
          const partial = Boolean(b.heure_debut && b.heure_fin);
          const top = partial ? y(timeToMinutes(b.heure_debut as string)) : 0;
          const h = partial ? (timeToMinutes(b.heure_fin as string) - timeToMinutes(b.heure_debut as string)) * PX_PER_MIN : height;
          return (
            <div
              key={b.id}
              className="pointer-events-none absolute inset-x-0 z-10 overflow-hidden border-y border-stone-400 px-2 py-1.5 text-[13px] font-semibold text-stone-900"
              style={{ ...HATCH, top, height: h }}
            >
              <span className="rounded bg-white/90 px-1.5 py-0.5">{b.motif || 'Indisponible'}</span>
            </div>
          );
        })}

        {bands.map((band) => {
          const n = day.soft[band.periode].length;
          return (
            <div
              key={band.periode}
              className="pointer-events-none absolute inset-x-1 z-20 rounded-xl border-2 border-dashed border-amber-500 bg-amber-100/40"
              style={{ top: y(band.from) + 1, height: (band.to - band.from) * PX_PER_MIN - 2 }}
            >
              <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-bold text-amber-900">
                {PERIODE_LABEL[band.periode]} · {n} à fixer
              </span>
            </div>
          );
        })}

        {day.fixed.map((b) => {
          const l = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
          const startM = timeToMinutes(b.heure_rdv);
          const h = Math.max(30, (bookingEnd(b) - startM) * PX_PER_MIN - 2);
          return (
            <button
              key={b.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(b.id);
              }}
              aria-label={`${b.heure_rdv}, ${fullName(b)}, ${b.service_nom}`}
              className={`absolute z-30 flex cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-xl border px-2.5 py-1 text-left leading-tight shadow-[0_1px_2px_rgba(28,25,23,0.12)] active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-accent ${bookingClass(b)}`}
              style={{
                top: y(startM) + 1,
                height: h,
                left: `calc(${(l.lane / l.lanes) * 100}% + 3px)`,
                width: `calc(${100 / l.lanes}% - 6px)`,
              }}
            >
              <span className="block truncate text-[14px] font-bold">
                {b.heure_rdv} · {l.lanes > 1 ? shortName(b) : fullName(b)}
              </span>
              {h >= 52 && <span className="block truncate text-[13px] opacity-95">{b.service_nom}</span>}
            </button>
          );
        })}

        {isToday && nowMin >= gridMin && nowMin <= gridMax && (
          <div
            ref={nowRef}
            className="pointer-events-none absolute inset-x-0 z-40 border-t-2 border-red-600"
            style={{ top: y(nowMin), scrollMarginTop: '12rem' }}
          >
            <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-600" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Semaine compacte ────────────────────────────────────────────────────────

function WeekCompact({
  days,
  today,
  onPickDay,
  onOpen,
  onNewAt,
  onOpenBlocks,
}: {
  days: DayModel[];
  today: string;
  onPickDay: (d: string) => void;
  onOpen: (id: string) => void;
  onNewAt: (d: string) => void;
  onOpenBlocks: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button icon={CalendarOff} onClick={onOpenBlocks}>
          Je ne travaille pas
        </Button>
      </div>
      <ul className="space-y-2">
        {days.map((d) => {
          const isToday = d.date === today;
          const nSoft = d.soft.matin.length + d.soft.apres_midi.length;
          const empty = d.fixed.length === 0 && nSoft === 0 && d.blocks.length === 0;
          return (
            <li
              key={d.date}
              className={`flex items-stretch overflow-hidden rounded-2xl border bg-white ${isToday ? 'border-accent' : 'border-stone-200'}`}
            >
              <button
                type="button"
                onClick={() => onPickDay(d.date)}
                aria-label={`Voir la journée du ${formatDateLong(d.date)}`}
                className={`flex w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 ${
                  isToday ? 'bg-accent text-accent-fg' : d.plages.length ? 'bg-stone-50 text-stone-900' : 'bg-stone-50 text-stone-400'
                }`}
              >
                <span className="text-[12px] font-medium uppercase">{formatWeekdayShort(d.date)}</span>
                <span className="text-[22px] font-semibold leading-none tabular-nums">{dayOfMonth(d.date)}</span>
              </button>
              <div className="min-w-0 flex-1 space-y-1.5 px-3 py-2.5">
                {d.blocks.map((b) => (
                  <p key={b.id} className="rounded-lg border border-stone-400 px-2 py-1 text-[13px] font-semibold text-stone-900" style={HATCH}>
                    <span className="rounded bg-white/90 px-1">
                      {b.heure_debut && b.heure_fin ? `${b.heure_debut}–${b.heure_fin}` : 'Toute la journée'} · {b.motif || 'Indisponible'}
                    </span>
                  </p>
                ))}
                {(['matin', 'apres_midi'] as BookingPeriode[]).flatMap((per) =>
                  d.soft[per].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onOpen(b.id)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-amber-500 bg-amber-50 px-2.5 py-1 text-left text-[14px] text-amber-950 active:bg-amber-100"
                    >
                      <span className="shrink-0 text-[12px] font-bold uppercase">{PERIODE_LABEL[per]}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{fullName(b)}</span>
                    </button>
                  )),
                )}
                {d.fixed.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpen(b.id)}
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1 text-left text-[14px] active:brightness-95 ${bookingClass(b)}`}
                  >
                    <span className="shrink-0 font-bold tabular-nums">{b.heure_rdv}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{shortName(b)}</span>
                      <span className="opacity-90"> · {b.service_nom}</span>
                    </span>
                  </button>
                ))}
                {empty && <p className="py-2 text-[14px] text-stone-500">{d.plages.length ? 'Rien de prévu' : 'Fermé'}</p>}
              </div>
              <button
                type="button"
                onClick={() => onNewAt(d.date)}
                aria-label={`Ajouter un rendez-vous le ${formatDateLong(d.date)}`}
                className="grid w-12 shrink-0 cursor-pointer place-items-center border-l border-stone-100 text-stone-700 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
