"use client";

import React, { useState } from 'react';
import { Trash2, User } from 'lucide-react';
import type { Booking, BookingBlock } from '../../../types/booking';
import { minutesToTime, timeToMinutes } from '../../../types/booking';
import { Button, Field, Input } from '../ui';
import { useFeedback } from './Feedback';
import Overlay from './Overlay';
import { adminFetch, announceBookingsChanged, errorMessage, fullName, todayZurich } from './lib';

/**
 * Rendez-vous personnel : dentiste, banque, pause, formation… C'est une
 * indisponibilité sur une plage horaire (`booking_blocks`), nommée : elle
 * apparaît dans l'agenda à côté des clientes, et ce créneau n'est plus proposé
 * en ligne. Les rendez-vous clientes qui tombent dessus sont signalés, jamais
 * annulés.
 */

/** Une plage horaire dans la journée = un rendez-vous perso ; une journée entière = un jour fermé. */
export function isPersoBlock(b: BookingBlock): boolean {
  return Boolean(b.heure_debut && b.heure_fin);
}

const SUGGESTIONS = ['Pause', 'Rendez-vous médical', 'Administratif', 'Formation', 'Famille'];

export default function PersoPanel({
  block,
  initialDate,
  initialTime,
  onClose,
  onSaved,
}: {
  /** Rendez-vous existant à modifier ; absent = création. */
  block?: BookingBlock;
  initialDate?: string;
  initialTime?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fb = useFeedback();
  const editing = Boolean(block);
  const start = initialTime && /^\d{2}:\d{2}$/.test(initialTime) ? initialTime : '12:00';
  const [titre, setTitre] = useState(block?.motif ?? '');
  const [date, setDate] = useState(block?.date_debut ?? initialDate ?? todayZurich());
  const [debut, setDebut] = useState(block?.heure_debut ?? start);
  const [fin, setFin] = useState(block?.heure_fin ?? minutesToTime(Math.min(timeToMinutes(start) + 60, 23 * 60 + 45)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!titre.trim()) return setError('Donnez un nom à ce rendez-vous (par exemple « Dentiste »).');
    if (!date) return setError('Choisissez le jour.');
    if (timeToMinutes(fin) <= timeToMinutes(debut)) return setError('L’heure de fin doit être après l’heure de début.');

    setBusy(true);
    try {
      const res = await adminFetch<{ block: BookingBlock; impactes?: Booking[] }>(
        editing ? `/api/admin/booking-blocks/${block!.id}` : '/api/admin/booking-blocks',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({ date_debut: date, heure_debut: debut, heure_fin: fin, motif: titre.trim() }),
        },
      );
      const impactes = res.impactes ?? [];
      if (impactes.length > 0) {
        fb.info(
          `Attention : ${impactes.length > 1 ? `${impactes.length} rendez-vous clientes tombent` : 'un rendez-vous cliente tombe'} sur ce créneau (${impactes
            .slice(0, 3)
            .map((b) => `${fullName(b)} à ${b.heure_rdv}`)
            .join(', ')}). Ils ne sont pas annulés : à vous de les déplacer.`,
        );
      } else {
        fb.success(editing ? 'Rendez-vous perso modifié.' : 'Rendez-vous perso ajouté à l’agenda.');
      }
      announceBookingsChanged();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!block) return;
    const r = await fb.ask({
      title: 'Supprimer ce rendez-vous perso ?',
      message: `« ${block.motif || 'Rendez-vous perso'} » : ce créneau sera de nouveau proposé aux clientes.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    });
    if (!r.ok) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/booking-blocks/${block.id}`, { method: 'DELETE' });
      fb.success('Rendez-vous perso supprimé.');
      announceBookingsChanged();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      variant="modal"
      title={editing ? 'Rendez-vous perso' : 'Nouveau rendez-vous perso'}
      subtitle="Dans votre agenda, à côté des clientes. Ce créneau n’est plus proposé en ligne."
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="danger" icon={Trash2} onClick={remove} disabled={busy}>
              Supprimer
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button variant="primary" loading={busy} onClick={() => save()}>
              {editing ? 'Enregistrer' : 'Ajouter à l’agenda'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={save} className="space-y-5">
        <Field label="Quoi ?" htmlFor="perso-titre" required>
          <div className="relative">
            <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-strong" aria-hidden="true" />
            <Input
              id="perso-titre"
              data-autofocus
              value={titre}
              maxLength={200}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Dentiste, banque, pause…"
              className="!h-12 pl-10 text-[16px]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTitre(s)}
                className={`h-9 border px-3 text-[13.5px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  titre === s ? 'border-warm-strong bg-warm-soft text-warm-ink' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="Le" htmlFor="perso-date">
            <Input id="perso-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!h-12 text-[16px]" />
          </Field>
          <Field label="De" htmlFor="perso-debut">
            <Input
              id="perso-debut"
              type="time"
              step={900}
              value={debut}
              onChange={(e) => {
                const v = e.target.value;
                // On garde la durée : déplacer le début déplace la fin.
                const duree = timeToMinutes(fin) - timeToMinutes(debut);
                setDebut(v);
                if (v && duree > 0) setFin(minutesToTime(Math.min(timeToMinutes(v) + duree, 23 * 60 + 59)));
              }}
              className="!h-12 text-[16px]"
            />
          </Field>
          <Field label="À" htmlFor="perso-fin">
            <Input id="perso-fin" type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} className="!h-12 text-[16px]" />
          </Field>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[14px] font-medium text-red-800">
            {error}
          </p>
        )}
        {/* Entrée valide le formulaire depuis n'importe quel champ. */}
        <button type="submit" className="sr-only" tabIndex={-1}>Enregistrer</button>
      </form>
    </Overlay>
  );
}
