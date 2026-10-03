"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarOff, Loader2, Trash2 } from 'lucide-react';
import type { Booking, BookingBlock } from '../../../types/booking';
import { timeToMinutes } from '../../../types/booking';
import { Button, EmptyState, Field, Input } from '../ui';
import { useFeedback } from './Feedback';
import { adminFetch, announceBookingsChanged, cap, errorMessage, formatDateLong, formatDayMonth, fullName, todayZurich } from './lib';

type Mode = 'jour' | 'periode' | 'heures';

const MODES: { id: Mode; label: string }[] = [
  { id: 'jour', label: 'Une journée' },
  { id: 'periode', label: 'Plusieurs jours' },
  { id: 'heures', label: 'Quelques heures' },
];

export function describeBlock(b: BookingBlock): string {
  if (b.heure_debut && b.heure_fin) {
    return `${formatDateLong(b.date_debut)}, de ${b.heure_debut} à ${b.heure_fin}`;
  }
  if (b.date_fin && b.date_fin !== b.date_debut) {
    return `Du ${formatDayMonth(b.date_debut)} au ${formatDayMonth(b.date_fin)}`;
  }
  return formatDateLong(b.date_debut);
}

/**
 * « Je ne travaille pas le… » : jours fermés, vacances, plages horaires.
 * Un blocage n'annule jamais de rendez-vous : on signale seulement ceux qui
 * tombent dessus, pour qu'Emmanuelle les traite elle-même.
 */
export default function BlocksSection({
  onOpenBooking,
  onChanged,
}: {
  /** Si fourni, « Traiter » ouvre le rendez-vous sur place ; sinon un lien mène à la page Réservations. */
  onOpenBooking?: (id: string) => void;
  onChanged?: () => void;
}) {
  const fb = useFeedback();
  const [blocks, setBlocks] = useState<BookingBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('jour');
  const today = todayZurich();
  const [date, setDate] = useState(today);
  const [dateFin, setDateFin] = useState(today);
  const [hDebut, setHDebut] = useState('09:00');
  const [hFin, setHFin] = useState('12:00');
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [impact, setImpact] = useState<{ count: number; list: Booking[] } | null>(null);
  const motifId = useId();
  const impactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (impact) impactRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [impact]);

  const load = useCallback(async () => {
    try {
      const json = await adminFetch<{ blocks?: BookingBlock[] } | BookingBlock[]>('/api/admin/booking-blocks');
      const list = Array.isArray(json) ? json : (json.blocks ?? []);
      setBlocks(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = (blocks ?? [])
    .filter((b) => (b.date_fin || b.date_debut) >= today)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut) || (a.heure_debut ?? '').localeCompare(b.heure_debut ?? ''));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setImpact(null);

    if (!date) return setFormError('Choisissez le jour.');
    if (mode === 'periode' && (!dateFin || dateFin < date)) return setFormError('La date de fin doit être après la date de début.');
    if (mode === 'heures' && timeToMinutes(hFin) <= timeToMinutes(hDebut)) return setFormError('L’heure de fin doit être après l’heure de début.');

    const body: Record<string, string> = { date_debut: date };
    if (mode === 'periode') body.date_fin = dateFin;
    if (mode === 'heures') {
      body.heure_debut = hDebut;
      body.heure_fin = hFin;
    }
    if (motif.trim()) body.motif = motif.trim();

    setBusy(true);
    try {
      const res = await adminFetch<{ block: BookingBlock; impactes?: Booking[] }>('/api/admin/booking-blocks', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      fb.success('Indisponibilité ajoutée : ces horaires ne seront plus proposés.');
      const impactes = res.impactes ?? [];
      if (impactes.length > 0) setImpact({ count: impactes.length, list: impactes });
      setMotif('');
      await load();
      announceBookingsChanged();
      onChanged?.();
    } catch (err) {
      fb.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: BookingBlock) => {
    const r = await fb.ask({
      title: 'Supprimer cette indisponibilité ?',
      message: `${describeBlock(b)}${b.motif ? ` (${b.motif})` : ''} : ces horaires seront de nouveau proposés aux clientes.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    });
    if (!r.ok) return;
    try {
      await adminFetch(`/api/admin/booking-blocks/${b.id}`, { method: 'DELETE' });
      fb.success('Indisponibilité supprimée.');
      await load();
      onChanged?.();
    } catch (err) {
      fb.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="space-y-4 rounded-2xl border border-stone-300 bg-white p-4 sm:p-5">
        <h3 className="text-[17px] font-semibold text-stone-950">Je ne travaille pas le…</h3>

        <div role="group" aria-label="Type d’indisponibilité" className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setFormError(null);
              }}
              className={`min-h-12 rounded-lg border px-2 text-[14px] font-semibold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:text-[15px] ${
                mode === m.id ? 'border-accent bg-accent text-accent-fg' : 'border-stone-300 bg-white text-stone-900 hover:bg-accent-soft'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={mode === 'periode' ? 'Du' : 'Le'} htmlFor="blk-date">
            <Input
              id="blk-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => {
                setDate(e.target.value);
                if (dateFin < e.target.value) setDateFin(e.target.value);
              }}
              className="!h-12 text-[16px]"
            />
          </Field>
          {mode === 'periode' && (
            <Field label="Au (inclus)" htmlFor="blk-fin">
              <Input id="blk-fin" type="date" value={dateFin} min={date} onChange={(e) => setDateFin(e.target.value)} className="!h-12 text-[16px]" />
            </Field>
          )}
          {mode === 'heures' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="De" htmlFor="blk-h1">
                <Input id="blk-h1" type="time" step={900} value={hDebut} onChange={(e) => setHDebut(e.target.value)} className="!h-12 text-[16px]" />
              </Field>
              <Field label="À" htmlFor="blk-h2">
                <Input id="blk-h2" type="time" step={900} value={hFin} onChange={(e) => setHFin(e.target.value)} className="!h-12 text-[16px]" />
              </Field>
            </div>
          )}
        </div>

        <Field label="Motif (facultatif)" htmlFor={motifId} hint="Visible seulement par vous, dans l’agenda.">
          <Input id={motifId} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Vacances, formation, rendez-vous médical…" className="!h-12 text-[16px]" />
        </Field>

        {formError && (
          <p role="alert" className="text-[14.5px] font-medium text-red-700">
            {formError}
          </p>
        )}

        <Button type="submit" variant="primary" loading={busy} icon={CalendarOff} className="h-12 w-full sm:w-auto">
          Bloquer ces horaires
        </Button>
      </form>

      {impact && (
        <div ref={impactRef} role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            <AlertTriangle size={18} aria-hidden="true" />
            {impact.count === 1 ? '1 rendez-vous tombe' : `${impact.count} rendez-vous tombent`} sur cette période
          </p>
          <p className="mt-1 text-[14px]">Rien n’a été annulé. Contactez ces clientes pour déplacer leur rendez-vous.</p>
          <ul className="mt-3 divide-y divide-amber-200 rounded-lg border border-amber-200 bg-white">
            {impact.list.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 text-[14.5px] text-stone-900">
                  <p className="font-semibold">{fullName(b)}</p>
                  <p className="truncate text-stone-700">
                    {formatDateLong(b.date_rdv)}
                    {b.horaire_fixe ? ` à ${b.heure_rdv}` : ''} · {b.service_nom}
                  </p>
                </div>
                {onOpenBooking ? (
                  <Button className="h-11 shrink-0" onClick={() => onOpenBooking(b.id)}>
                    Traiter
                  </Button>
                ) : (
                  <Link
                    href={`/admin/reservations?id=${b.id}`}
                    className="inline-flex h-11 shrink-0 items-center rounded-lg bg-stone-100 px-4 text-[14px] font-semibold text-stone-900 hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    Traiter
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-[17px] font-semibold text-stone-950">Indisponibilités à venir</h3>
        {blocks === null && !loadError && (
          <p className="flex items-center gap-2 text-[14px] text-stone-700">
            <Loader2 size={15} className="animate-spin" /> Chargement…
          </p>
        )}
        {loadError && <p className="text-[14px] font-medium text-red-700">{loadError}</p>}
        {blocks !== null && upcoming.length === 0 && (
          <EmptyState icon={CalendarOff} title="Aucune indisponibilité prévue" description="Ajoutez un jour de congé, des vacances ou une plage horaire ci-dessus." />
        )}
        {upcoming.length > 0 && (
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-300 bg-white">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-semibold text-stone-950">{cap(describeBlock(b))}</p>
                  <p className="text-[14px] text-stone-700">{b.motif || 'Sans motif'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(b)}
                  aria-label={`Supprimer l’indisponibilité : ${describeBlock(b)}`}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-700 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
