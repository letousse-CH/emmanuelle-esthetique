"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PublicCalendar } from '../../../types/booking';
import { addDays, formatDateLong, formatMonthYear, weekdayMondayFirst } from './dates';

interface DayCalendarProps {
  /** Premier et dernier jour proposés (Europe/Zurich, `YYYY-MM-DD`). */
  from: string;
  to: string;
  /** Disponibilité par jour et par période, telle que renvoyée par l'API. */
  jours: PublicCalendar['jours'];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Calendrier mensuel des jours réservables.
 *
 * Un jour qui n'est pas dans la réponse du serveur, fermé, bloqué ou complet
 * est grisé et non cliquable : la cliente ne peut pas choisir une date que
 * l'institut ne peut pas honorer. Navigation clavier : flèches ← → ↑ ↓.
 */
export default function DayCalendar({ from, to, jours, selected, today, onSelect }: DayCalendarProps) {
  const initialYm = (selected && selected >= from && selected <= to ? selected : from).slice(0, 7);
  const [ym, setYm] = useState<string>(initialYm);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocus = useRef<string | null>(null);

  // Si la date sélectionnée change depuis l'extérieur (1er jour libre, paramètre d'URL), on suit.
  useEffect(() => {
    if (selected && selected >= from && selected <= to) setYm(selected.slice(0, 7));
  }, [selected, from, to]);

  const isAvailable = (d: string) => {
    if (d < from || d > to) return false;
    const j = jours[d];
    return !!j && (j.matin || j.apres_midi);
  };

  const cells = useMemo(() => {
    const first = `${ym}-01`;
    const out: Array<string | null> = Array(weekdayMondayFirst(first)).fill(null);
    let d = first;
    while (d.startsWith(ym)) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [ym]);

  const firstYm = from.slice(0, 7);
  const lastYm = to.slice(0, 7);

  const tabbableDate = useMemo(() => {
    if (selected && selected.startsWith(ym) && isAvailable(selected)) return selected;
    return cells.find((c): c is string => !!c && isAvailable(c)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, selected, jours, from, to, ym]);

  useEffect(() => {
    if (pendingFocus.current) {
      buttonRefs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  }, [ym]);

  const moveFocus = (fromDate: string, step: number) => {
    let d = fromDate;
    for (let i = 0; i < 70; i++) {
      d = addDays(d, step);
      if (d < from || d > to) return;
      if (!isAvailable(d)) continue;
      if (d.startsWith(ym)) {
        buttonRefs.current[d]?.focus();
      } else {
        pendingFocus.current = d;
        setYm(d.slice(0, 7));
      }
      return;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, date: string) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    moveFocus(date, step);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(`${ym}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setYm(d.toISOString().slice(0, 7));
  };

  return (
    <div className="bg-surface border border-border rounded-[var(--radius-base,1rem)] p-3 sm:p-4" data-surface>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={ym <= firstYm}
          aria-label="Mois précédent"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-stone-deep hover:border-sage disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="text-sm sm:text-base font-serif font-semibold text-stone-deep capitalize" aria-live="polite">
          {formatMonthYear(ym)}
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={ym >= lastYm}
          aria-label="Mois suivant"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-stone-deep hover:border-sage disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] uppercase tracking-wider font-semibold text-muted py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Jours de ${formatMonthYear(ym)}`}>
        {cells.map((d, i) => {
          if (!d) return <div key={`blank-${i}`} aria-hidden="true" />;
          const available = isAvailable(d);
          const isSelected = d === selected;
          const dayNumber = parseInt(d.slice(8), 10);
          return (
            <button
              key={d}
              ref={(el) => {
                buttonRefs.current[d] = el;
              }}
              type="button"
              disabled={!available}
              tabIndex={d === tabbableDate ? 0 : -1}
              aria-pressed={isSelected}
              aria-label={`${formatDateLong(d)}${available ? '' : ', aucune disponibilité'}`}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => onKeyDown(e, d)}
              className={`relative h-11 sm:h-12 rounded-lg border text-sm font-semibold transition-all ${
                isSelected
                  ? 'bg-sage text-white border-sage shadow-sm'
                  : available
                  ? 'bg-surface text-stone-deep border-border hover:border-sage hover:bg-stone-50'
                  : 'bg-stone-50 text-stone-500 border-transparent cursor-not-allowed line-through decoration-stone-300'
              }`}
            >
              {dayNumber}
              {d === today && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-sage'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted font-light leading-relaxed">
        Les jours barrés sont fermés ou complets. Sélectionnez un jour, puis choisissez le matin ou l&apos;après-midi.
      </p>
    </div>
  );
}
