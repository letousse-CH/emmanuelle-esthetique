"use client";

import React from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { JourOuvertureConfig, PlageHoraire } from '../../../types/booking';
import { timeToMinutes } from '../../../types/booking';
import { Button, Toggle } from '../ui';

export type WeeklyHours = Record<string, JourOuvertureConfig>;

/** Lundi → dimanche, avec la clé `jours_ouverture` ('0' = dimanche). */
const DAYS: { key: string; label: string }[] = [
  { key: '1', label: 'Lundi' },
  { key: '2', label: 'Mardi' },
  { key: '3', label: 'Mercredi' },
  { key: '4', label: 'Jeudi' },
  { key: '5', label: 'Vendredi' },
  { key: '6', label: 'Samedi' },
  { key: '0', label: 'Dimanche' },
];

export function normalizeHours(raw: WeeklyHours | undefined | null): WeeklyHours {
  const out: WeeklyHours = {};
  for (const d of DAYS) {
    const c = raw?.[d.key];
    out[d.key] = {
      ouvert: Boolean(c?.ouvert),
      plages: Array.isArray(c?.plages) ? c.plages.map((p) => ({ debut: p.debut, fin: p.fin })) : [],
    };
  }
  return out;
}

/** Erreurs de saisie par jour (fin après début, plages qui ne se chevauchent pas). */
export function validateHours(hours: WeeklyHours): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const d of DAYS) {
    const c = hours[d.key];
    if (!c?.ouvert) continue; // un jour fermé n'est pas validé (comme côté serveur)
    if (c.plages.length === 0) {
      errors[d.key] = 'Ajoutez au moins une plage horaire, ou fermez ce jour.';
      continue;
    }
    const sorted = [...c.plages].sort((a, b) => a.debut.localeCompare(b.debut));
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (!p.debut || !p.fin) {
        errors[d.key] = 'Renseignez l’heure de début et de fin.';
        break;
      }
      if (timeToMinutes(p.fin) <= timeToMinutes(p.debut)) {
        errors[d.key] = `La fin (${p.fin}) doit être après le début (${p.debut}).`;
        break;
      }
      if (i > 0 && timeToMinutes(p.debut) < timeToMinutes(sorted[i - 1].fin)) {
        errors[d.key] = 'Deux plages se chevauchent.';
        break;
      }
    }
  }
  return errors;
}

export default function WeeklyHoursEditor({
  value,
  onChange,
  errors,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  errors: Record<string, string>;
}) {
  const setDay = (key: string, patch: Partial<JourOuvertureConfig>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });

  const setPlage = (key: string, index: number, patch: Partial<PlageHoraire>) =>
    setDay(key, { plages: value[key].plages.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  const toggle = (key: string, ouvert: boolean) =>
    setDay(key, {
      ouvert,
      plages: ouvert && value[key].plages.length === 0 ? [{ debut: '09:00', fin: '12:00' }] : value[key].plages,
    });

  const copyMonday = () => {
    const monday = value['1'];
    const next = { ...value };
    for (const k of ['2', '3', '4', '5']) next[k] = { ouvert: monday.ouvert, plages: monday.plages.map((p) => ({ ...p })) };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-stone-700">Les clientes ne peuvent demander un rendez-vous que pendant ces heures.</p>
        <Button onClick={copyMonday} icon={Copy} className="h-11" type="button">
          Copier le lundi sur mardi–vendredi
        </Button>
      </div>

      <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white">
        {DAYS.map((d) => {
          const c = value[d.key];
          const err = errors[d.key];
          return (
            <li key={d.key} className="px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-x-4">
                <div className="flex shrink-0 items-center gap-3 sm:w-36 sm:pt-1.5">
                  <Toggle checked={c.ouvert} onChange={(v) => toggle(d.key, v)} label={`${d.label} : ${c.ouvert ? 'ouvert' : 'fermé'}`} />
                  <span className={`text-[15px] font-semibold ${c.ouvert ? 'text-stone-950' : 'text-stone-600'}`}>{d.label}</span>
                </div>

                {c.ouvert ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    {c.plages.map((p, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <label className="sr-only" htmlFor={`h-${d.key}-${i}-a`}>{`${d.label}, début de la plage ${i + 1}`}</label>
                        <input
                          id={`h-${d.key}-${i}-a`}
                          type="time"
                          step={900}
                          value={p.debut}
                          onChange={(e) => setPlage(d.key, i, { debut: e.target.value })}
                          className="h-11 w-[6.1rem] rounded-lg border border-stone-300 bg-white px-1.5 text-[16px] text-stone-900 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                        />
                        <span className="text-stone-700" aria-hidden="true">à</span>
                        <label className="sr-only" htmlFor={`h-${d.key}-${i}-b`}>{`${d.label}, fin de la plage ${i + 1}`}</label>
                        <input
                          id={`h-${d.key}-${i}-b`}
                          type="time"
                          step={900}
                          value={p.fin}
                          onChange={(e) => setPlage(d.key, i, { fin: e.target.value })}
                          className="h-11 w-[6.1rem] rounded-lg border border-stone-300 bg-white px-1.5 text-[16px] text-stone-900 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                        />
                        <button
                          type="button"
                          onClick={() => setDay(d.key, { plages: c.plages.filter((_, j) => j !== i) })}
                          aria-label={`Retirer la plage ${i + 1} du ${d.label.toLowerCase()}`}
                          className="grid size-10 place-items-center rounded-lg text-stone-700 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const last = c.plages[c.plages.length - 1];
                        setDay(d.key, { plages: [...c.plages, last ? { debut: last.fin, fin: '18:00' } : { debut: '09:00', fin: '12:00' }] });
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-accent underline underline-offset-2 hover:no-underline"
                    >
                      <Plus size={15} aria-hidden="true" /> Ajouter une plage (ex. après-midi)
                    </button>
                  </div>
                ) : (
                  <p className="text-[14px] text-stone-600 sm:pt-2">Fermé</p>
                )}
              </div>
              {err && (
                <p role="alert" className="mt-1.5 text-[13.5px] font-medium text-red-700">
                  {d.label} : {err}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
