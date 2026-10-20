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

const WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

/**
 * Calendrier mensuel des jours réservables.
 *
 * Un jour qui n'est pas dans la réponse du serveur, fermé, bloqué ou complet
 * est estompé et non cliquable (un jour libre porte un point lagon) : la
 * cliente ne peut pas choisir une date que l'institut ne peut pas honorer.
 * Navigation clavier : flèches ← → ↑ ↓.
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
    <div className="rsv-cal">
      <div className="rsv-cal__head">
        <div className="rsv-cal__month" aria-live="polite">
          {formatMonthYear(ym)}
        </div>
        <div className="rsv-cal__nav">
          <button type="button" onClick={() => shiftMonth(-1)} disabled={ym <= firstYm} aria-label="Mois précédent">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => shiftMonth(1)} disabled={ym >= lastYm} aria-label="Mois suivant">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rsv-cal__grid" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="rsv-cal__wd">
            {w}
          </div>
        ))}
      </div>

      <div className="rsv-cal__grid" role="group" aria-label={`Jours de ${formatMonthYear(ym)}`}>
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
              aria-label={`${formatDateLong(d)}${d === today ? ' (aujourd’hui)' : ''}${available ? '' : ', aucune disponibilité'}`}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => onKeyDown(e, d)}
              className={`rsv-day${d === today ? ' is-today' : ''}`}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>

      <div className="rsv-cal__legend">Jours où un horaire est libre pour toute la durée de votre séance</div>
    </div>
  );
}
