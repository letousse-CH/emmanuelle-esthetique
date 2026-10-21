"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicCalendar } from '../../../types/booking';
import { addDays, formatDateLong, formatMonthYear, weekdayMondayFirst } from './dates';

interface DayStripProps {
  /** Premier et dernier jour proposés (Europe/Zurich, `YYYY-MM-DD`). */
  from: string;
  to: string;
  jours: PublicCalendar['jours'];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Jours en bande horizontale, pour le téléphone : on fait défiler les jours du
 * pouce et les horaires restent sous les yeux (le calendrier mensuel les
 * repoussait sous la ligne de flottaison). Mêmes règles que `DayCalendar` : un
 * jour sans horaire libre est estompé et non cliquable. Flèches ← → au clavier.
 */
export default function DayStrip({ from, to, jours, selected, today, onSelect }: DayStripProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [visibleYm, setVisibleYm] = useState((selected || from).slice(0, 7));

  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to && out.length < 120; d = addDays(d, 1)) out.push(d);
    return out;
  }, [from, to]);

  const isAvailable = (d: string) => {
    const j = jours[d];
    return !!j && (j.matin || j.apres_midi);
  };

  // Le jour choisi (premier jour libre, paramètre d'URL…) est amené au centre de la bande.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = selected ? buttonRefs.current[selected] : null;
    if (!scroller || !el) return;
    const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [selected]);

  // Le mois affiché suit le premier jour visible.
  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const edge = scroller.scrollLeft + 8;
    const first = days.find((d) => {
      const el = buttonRefs.current[d];
      return el ? el.offsetLeft + el.offsetWidth > edge : false;
    });
    if (first) setVisibleYm(first.slice(0, 7));
  };

  const onKeyDown = (e: React.KeyboardEvent, date: string) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let d = addDays(date, step); d >= from && d <= to; d = addDays(d, step)) {
      if (isAvailable(d)) {
        buttonRefs.current[d]?.focus();
        return;
      }
    }
  };

  const tabbable = selected && isAvailable(selected) ? selected : days.find(isAvailable);

  return (
    <div className="rsv-strip">
      <div className="rsv-strip__month" aria-live="polite">
        {formatMonthYear(visibleYm)}
      </div>
      <div
        ref={scrollerRef}
        className="rsv-strip__days"
        role="group"
        aria-label="Jours du rendez-vous"
        onScroll={onScroll}
      >
        {days.map((d) => {
          const available = isAvailable(d);
          const isFirstOfMonth = d.endsWith('-01') && d !== days[0];
          return (
            <button
              key={d}
              ref={(el) => {
                buttonRefs.current[d] = el;
              }}
              type="button"
              className={`rsv-sday${d === today ? ' is-today' : ''}${isFirstOfMonth ? ' is-month-start' : ''}`}
              disabled={!available}
              tabIndex={d === tabbable ? 0 : -1}
              aria-pressed={d === selected}
              aria-label={`${formatDateLong(d)}${d === today ? ' (aujourd’hui)' : ''}${available ? '' : ', aucune disponibilité'}`}
              onClick={() => onSelect(d)}
              onKeyDown={(e) => onKeyDown(e, d)}
            >
              <span className="rsv-sday__wd" aria-hidden="true">
                {d === today ? 'Auj.' : WEEKDAYS[weekdayMondayFirst(d)]}
              </span>
              <span className="rsv-sday__num" aria-hidden="true">
                {parseInt(d.slice(8), 10)}
              </span>
              <span className="rsv-sday__dot" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
