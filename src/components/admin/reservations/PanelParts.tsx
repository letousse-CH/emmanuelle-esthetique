"use client";

import React from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { BookingConflict, BookingEvent } from '../../../types/booking';
import { Button } from '../ui';
import { formatDateNumeric, formatInstant } from './lib';

const CONFLICT_LABEL: Record<BookingConflict['type'], string> = {
  rdv: 'Un autre rendez-vous',
  blocage: 'Une indisponibilité',
  hors_horaires: 'Hors des horaires d’ouverture',
};

/** Liste lisible des conflits renvoyés par un 409, avec « Enregistrer quand même ». */
export function ConflictsBox({
  conflicts,
  busy,
  onForce,
  onDismiss,
  forceLabel = 'Enregistrer quand même',
}: {
  conflicts: BookingConflict[];
  busy: boolean;
  onForce: () => void;
  onDismiss: () => void;
  forceLabel?: string;
}) {
  return (
    <div role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
      <p className="flex items-center gap-2 text-[16px] font-semibold">
        <AlertTriangle size={18} aria-hidden="true" /> Cet horaire pose problème
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">
        {conflicts.map((c, i) => (
          <li key={`${c.type}-${c.booking_id ?? c.block_id ?? i}`}>
            <span className="font-semibold">{CONFLICT_LABEL[c.type] ?? 'Conflit'}</span>
            {c.libelle ? ` : ${c.libelle}` : ''}
            {c.debut && c.fin ? ` (${c.debut} – ${c.fin})` : ''}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[14px]">C’est vous qui décidez : vous pouvez garder cet horaire malgré tout, ou en choisir un autre.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" loading={busy} onClick={onForce} className="h-12 sm:h-11">
          {forceLabel}
        </Button>
        <Button onClick={onDismiss} className="h-12 sm:h-11">
          Choisir un autre horaire
        </Button>
      </div>
    </div>
  );
}

const EVENT_LABEL: Record<BookingEvent['type'], string> = {
  creation: 'Demande reçue',
  statut: 'Changement de statut',
  deplacement: 'Rendez-vous déplacé',
  modification: 'Modification',
  contact: 'Appel / contact',
  email: 'E-mail envoyé',
  crm: 'Clientèle',
  note: 'Note',
};

const ACTOR_LABEL: Record<BookingEvent['actor'], string> = {
  cliente: 'la cliente',
  admin: 'vous',
  systeme: 'le système',
};

/** Rend une valeur d'événement lisible, y compris l'ancien format (objet {date, heure, periode}). */
function readable(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const date = typeof o.date === 'string' ? o.date : typeof o.date_rdv === 'string' ? o.date_rdv : '';
    const heure = typeof o.heure === 'string' ? o.heure : typeof o.heure_rdv === 'string' ? o.heure_rdv : '';
    const per = o.periode === 'matin' ? 'matin' : o.periode === 'apres_midi' ? 'après-midi' : '';
    const dateFr = /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDateNumeric(date) : date;
    const parts = [dateFr, heure || per].filter(Boolean);
    if (parts.length) return parts.join(' ');
    const flat = Object.values(o).filter((x) => typeof x === 'string' || typeof x === 'number');
    return flat.join(' ');
  }
  return '';
}

function describe(e: BookingEvent): string {
  const d = (e.detail ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.message === 'string') parts.push(d.message);
  const de = d.de ?? d.from;
  const vers = d.vers ?? d.to;
  if (de !== undefined && vers !== undefined) parts.push(`${readable(de)} → ${readable(vers)}`);
  if (parts.length === 0) {
    for (const [k, v] of Object.entries(d)) {
      const text = readable(v);
      if (!text) continue;
      parts.push(`${k.replace(/_/g, ' ')} : ${text}`);
      if (parts.length >= 3) break;
    }
  }
  return parts.join(' · ');
}

/** Journal des événements, replié par défaut. */
export function EventsLog({ events }: { events: BookingEvent[] }) {
  if (!events || events.length === 0) return null;
  const sorted = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <details className="group rounded-xl border border-stone-300 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[15px] font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
        Historique de cette réservation ({events.length})
        <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ol className="space-y-2 border-t border-stone-200 px-4 py-3">
        {sorted.map((e) => {
          const text = describe(e);
          return (
            <li key={e.id} className="text-[14px] text-stone-800">
              <p>
                <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>{' '}
                <span className="text-stone-600">
                  · {formatInstant(e.created_at)} · par {ACTOR_LABEL[e.actor] ?? e.actor}
                </span>
              </p>
              {text && <p className="text-stone-700">{text}</p>}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-[17px] font-semibold text-stone-950">{title}</h3>
        {hint && <p className="mt-0.5 text-[14px] text-stone-700">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
