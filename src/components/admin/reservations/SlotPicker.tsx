"use client";

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { BookingPeriode, TimeSlot } from '../../../types/booking';
import { PERIODE_LABEL, minutesToTime, timeToMinutes } from '../../../types/booking';
import { Input } from '../ui';
import { adminFetch, cap, errorMessage, formatDateLong, todayZurich } from './lib';

interface Availability {
  date: string;
  ouvert: boolean;
  slots: TimeSlot[];
}

/**
 * Choix de la date et de l'heure exacte d'un rendez-vous.
 *
 * Les créneaux viennent de `GET /api/admin/bookings/availability` : ce sont les
 * heures réellement libres pour cette durée (le rendez-vous en cours d'édition,
 * `excludeId`, n'est pas compté contre lui-même). Une heure libre peut aussi
 * être saisie à la main ; si elle n'est pas dans la liste, on prévient avant
 * qu'un conflit ne soit signalé à l'enregistrement.
 */
export default function SlotPicker({
  date,
  onDate,
  duration,
  excludeId,
  value,
  onChange,
  refreshKey = 0,
}: {
  date: string;
  onDate: (d: string) => void;
  duration: number;
  excludeId?: string;
  value: string | null;
  onChange: (heure: string | null) => void;
  /** Change pour forcer un nouveau calcul (après enregistrement). */
  refreshKey?: number;
}) {
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const timeId = useId();

  useEffect(() => {
    if (!date) return;
    let active = true;
    setLoading(true);
    setError(null);
    const handle = window.setTimeout(() => {
      const qs = new URLSearchParams({ date, duration: String(Math.max(15, duration || 60)) });
      if (excludeId) qs.set('excludeId', excludeId);
      adminFetch<Availability>(`/api/admin/bookings/availability?${qs}`)
        .then((json) => active && setData(json))
        .catch((e) => active && (setData(null), setError(errorMessage(e))))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [date, duration, excludeId, refreshKey]);

  const groups = useMemo(() => {
    const g: Record<BookingPeriode, TimeSlot[]> = { matin: [], apres_midi: [] };
    for (const s of data?.slots ?? []) g[s.periode]?.push(s);
    return g;
  }, [data]);

  const chosenSlot = value ? data?.slots.find((s) => s.heure === value) : undefined;
  const freeSlots = (data?.slots ?? []).filter((s) => s.disponible);
  const isPast = date < todayZurich();

  let warning: string | null = null;
  if (value && data && !loading) {
    if (!data.ouvert) warning = 'Le cabinet est fermé ce jour-là. Vous pouvez quand même enregistrer cette heure.';
    else if (chosenSlot && !chosenSlot.disponible)
      warning = chosenSlot.motif
        ? `Cette heure n’est pas libre (${chosenSlot.motif}).`
        : 'Cette heure n’est pas libre : un autre rendez-vous ou une indisponibilité la touche.';
    else if (!chosenSlot)
      warning = 'Cette heure ne fait pas partie des créneaux proposés. Un conflit pourra être signalé à l’enregistrement.';
  }

  const endLabel = value ? minutesToTime(timeToMinutes(value) + (duration || 0)) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={dateId} className="mb-1.5 block text-[14px] font-semibold text-stone-900">
            Jour du rendez-vous
          </label>
          <Input
            id={dateId}
            type="date"
            value={date}
            onChange={(e) => {
              onDate(e.target.value);
              onChange(null);
            }}
            className="!h-12 text-[16px]"
          />
          {date && <p className="mt-1 text-[13px] text-stone-700">{cap(formatDateLong(date))}</p>}
        </div>
        <div>
          <label htmlFor={timeId} className="mb-1.5 block text-[14px] font-semibold text-stone-900">
            Ou saisir une heure précise
          </label>
          <Input
            id={timeId}
            type="time"
            step={300}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="!h-12 text-[16px]"
          />
          {endLabel && value && <p className="mt-1 text-[13px] text-stone-700">Fin prévue à {endLabel}</p>}
        </div>
      </div>

      {isPast && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[14px] text-amber-950">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Ce jour est déjà passé.
        </p>
      )}

      <div aria-live="polite">
        {loading && (
          <p className="flex items-center gap-2 text-[14px] text-stone-700">
            <Loader2 size={15} className="animate-spin" /> Recherche des créneaux libres…
          </p>
        )}
        {error && !loading && <p className="text-[14px] font-medium text-red-700">{error}</p>}
        {data && !loading && !data.ouvert && (
          <p className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-[14px] text-stone-800">
            Le cabinet est fermé ce jour-là (horaires ou indisponibilité).
          </p>
        )}
        {data && !loading && data.ouvert && freeSlots.length === 0 && (
          <p className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-[14px] text-stone-800">
            Aucun créneau libre ce jour-là pour {duration || 60} minutes. Choisissez un autre jour.
          </p>
        )}
      </div>

      {data && data.ouvert && freeSlots.length > 0 && (
        <div className="space-y-3">
          {(['matin', 'apres_midi'] as BookingPeriode[]).map((p) =>
            groups[p].length === 0 ? null : (
              <fieldset key={p}>
                <legend className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-stone-700">
                  {PERIODE_LABEL[p]}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {groups[p].map((s) => {
                    const selected = value === s.heure;
                    return (
                      <button
                        key={s.heure}
                        type="button"
                        disabled={!s.disponible}
                        aria-pressed={selected}
                        title={s.disponible ? `${s.heure} – ${s.fin}` : (s.motif ?? 'Occupé')}
                        onClick={() => onChange(selected ? null : s.heure)}
                        className={`h-11 min-w-[4.25rem] rounded-lg border px-3 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 ${
                          selected
                            ? 'border-accent bg-accent text-accent-fg'
                            : s.disponible
                              ? 'border-stone-300 bg-white text-stone-950 hover:border-accent hover:bg-accent-soft'
                              : 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-500 line-through'
                        }`}
                      >
                        {s.heure}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ),
          )}
        </div>
      )}

      {warning && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[14px] text-amber-950">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {warning}
        </p>
      )}
    </div>
  );
}
