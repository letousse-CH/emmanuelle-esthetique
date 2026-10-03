"use client";

import React, { useId, useState } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import type { BookingOption } from '../../../types/booking';
import { formatCHF } from '../../../types/booking';
import { Button, Input, Select } from '../ui';
import { CATEGORY_LABEL } from './hooks';
import type { Catalog, CatalogOption, CatalogService } from './hooks';
import { formatDuration } from './lib';

/** Choix du soin principal parmi le catalogue réel. */
export function ServicePicker({
  catalog,
  value,
  currentLabel,
  onPick,
  id,
}: {
  catalog: Catalog;
  value: string | null;
  /** Libellé du soin déjà enregistré, s'il n'est plus (ou pas) dans la liste. */
  currentLabel?: string;
  onPick: (serviceId: string) => void;
  id?: string;
}) {
  const known = value ? catalog.services.some((s) => s.id === value) : false;
  const byCat = new Map<string, typeof catalog.services>();
  for (const s of catalog.services) {
    const arr = byCat.get(s.category) ?? [];
    arr.push(s);
    byCat.set(s.category, arr);
  }
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onPick(e.target.value)} className="!h-12 text-[16px]">
      {!known && <option value={value ?? ''}>{currentLabel ?? 'Choisir un soin…'}</option>}
      {Array.from(byCat.entries()).map(([cat, items]) => (
        <optgroup key={cat} label={CATEGORY_LABEL[cat] ?? cat}>
          {items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.type === 'forfait' ? 'Forfait · ' : ''}{s.name} — {formatCHF(s.priceChf)} · {formatDuration(s.durationMinutes)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

export function optionsTotals(options: BookingOption[]): { prix: number; duree: number } {
  return {
    prix: options.reduce((s, o) => s + (Number(o.prix_chf) || 0), 0),
    duree: options.reduce((s, o) => s + (Number(o.duree_minutes) || 0), 0),
  };
}

/**
 * Bloc « Upselling » : ajouter en un clic une option du catalogue, ou une ligne
 * libre (nom, prix, durée) décidée au téléphone. Le total est recalculé ici à
 * titre indicatif ; le serveur refait le calcul à l'enregistrement.
 */
export function UpsellBlock({
  options,
  onChange,
  catalogOptions,
  catalogServices = [],
}: {
  options: BookingOption[];
  onChange: (next: BookingOption[]) => void;
  catalogOptions: CatalogOption[];
  /** Liste complète des soins : permet d'ajouter un ou plusieurs soins à la demande. */
  catalogServices?: CatalogService[];
}) {
  const [soinsOpen, setSoinsOpen] = useState(false);
  const [soinsCat, setSoinsCat] = useState<string | null>(null);
  const cats = Array.from(new Set(catalogServices.map((s) => s.category)));
  const addService = (s: CatalogService) =>
    onChange([...options, { id: s.id, nom: s.name, prix_chf: s.priceChf, duree_minutes: s.durationMinutes, ajoute_par: 'admin' }]);
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [duree, setDuree] = useState('');
  const [open, setOpen] = useState(false);
  const nomId = useId();
  const prixId = useId();
  const dureeId = useId();

  const available = catalogOptions.filter((c) => !options.some((o) => o.id === c.id));

  const addCatalog = (c: CatalogOption) =>
    onChange([...options, { id: c.id, nom: c.nom, prix_chf: c.prix_chf, duree_minutes: c.duree_minutes, ajoute_par: 'admin' }]);

  const addCustom = () => {
    const p = parseFloat(prix.replace(',', '.'));
    const d = parseInt(duree, 10);
    if (!nom.trim() || !Number.isFinite(p) || p < 0) return;
    onChange([
      ...options,
      {
        id: `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        nom: nom.trim(),
        prix_chf: Math.round(p * 100) / 100,
        duree_minutes: Number.isFinite(d) && d > 0 ? d : 0,
        ajoute_par: 'admin',
      },
    ]);
    setNom('');
    setPrix('');
    setDuree('');
    setOpen(false);
  };

  const canAdd = nom.trim().length > 0 && Number.isFinite(parseFloat(prix.replace(',', '.')));

  return (
    <div className="space-y-3">
      {options.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white">
          {options.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-stone-950">{o.nom}</p>
                <p className="text-[13px] text-stone-700">
                  {formatCHF(o.prix_chf)}
                  {o.duree_minutes ? ` · +${o.duree_minutes} min` : ''}
                  {o.ajoute_par === 'admin' ? ' · ajouté par vous' : o.ajoute_par === 'cliente' ? ' · choisi par la cliente' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(options.filter((x) => x.id !== o.id))}
                aria-label={`Retirer ${o.nom}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-700 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {catalogServices.length > 0 && (
        <div className="space-y-2">
          <Button onClick={() => { setSoinsOpen((o) => !o); setSoinsCat(null); }} icon={Plus} className="h-11">
            Ajouter un soin
          </Button>
          {soinsOpen && !soinsCat && (
            <div className="grid grid-cols-2 gap-2">
              {cats.map((c) => (
                <button
                  key={c} type="button" onClick={() => setSoinsCat(c)}
                  className="min-h-14 cursor-pointer rounded-xl border border-stone-300 bg-white px-3 py-2 text-left text-[15px] font-semibold text-stone-900 active:bg-accent-soft"
                >
                  {CATEGORY_LABEL[c] ?? c}
                </button>
              ))}
            </div>
          )}
          {soinsOpen && soinsCat && (
            <div className="space-y-2 rounded-xl border border-stone-300 bg-stone-50 p-2">
              <button type="button" onClick={() => setSoinsCat(null)} className="min-h-11 cursor-pointer px-2 text-[14px] font-semibold text-accent">
                ‹ Catégories · {CATEGORY_LABEL[soinsCat] ?? soinsCat}
              </button>
              <ul className="space-y-1.5">
                {catalogServices.filter((s) => s.category === soinsCat).map((s) => {
                  const done = options.some((o) => o.id === s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button" disabled={done} onClick={() => addService(s)}
                        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-left disabled:opacity-50"
                      >
                        <Plus size={16} className="shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-[15px] text-stone-950">{s.type === 'forfait' ? 'Forfait · ' : ''}{s.name}</span>
                        <span className="shrink-0 text-[13px] tabular-nums text-stone-700">
                          {done ? 'ajouté' : `+${formatCHF(s.priceChf)} · ${formatDuration(s.durationMinutes)}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {available.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-stone-800">
            <Sparkles size={14} aria-hidden="true" /> Proposer en plus (un clic pour ajouter)
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCatalog(c)}
                title={c.duree_minutes ? `${c.duree_minutes} min` : undefined}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-stone-300 bg-white py-1.5 pl-3 pr-4 text-left text-[14px] font-medium text-stone-900 transition-colors hover:border-accent hover:bg-accent-soft active:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Plus size={16} className="shrink-0 text-accent" aria-hidden="true" />
                <span>{c.nom}</span>
                <span className="text-[13px] font-normal text-stone-700">
                  +{formatCHF(c.prix_chf)}{c.duree_minutes ? ` · ${c.duree_minutes} min` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!open ? (
        <Button onClick={() => setOpen(true)} icon={Plus} className="h-11">
          Ajouter une autre ligne (libre)
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-3">
          <div>
            <label htmlFor={nomId} className="mb-1 block text-[14px] font-semibold text-stone-900">
              Nom de la ligne
            </label>
            <Input id={nomId} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Massage du cuir chevelu" className="!h-12 text-[16px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={prixId} className="mb-1 block text-[14px] font-semibold text-stone-900">
                Prix (CHF)
              </label>
              <Input id={prixId} inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="25" className="!h-12 text-[16px]" />
            </div>
            <div>
              <label htmlFor={dureeId} className="mb-1 block text-[14px] font-semibold text-stone-900">
                Durée (min)
              </label>
              <Input id={dureeId} inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="15" className="!h-12 text-[16px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" className="h-11 flex-1" disabled={!canAdd} onClick={addCustom}>
              Ajouter
            </Button>
            <Button className="h-11" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Total et durée recalculés à l'écran. */
export function TotalsBar({ prix, duree }: { prix: number; duree: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-900 px-4 py-3 text-white" role="status" aria-label="Total du rendez-vous">
      <div>
        <p className="text-[12.5px] uppercase tracking-wide text-stone-300">Total</p>
        <p className="text-[22px] font-semibold leading-tight">{formatCHF(prix)}</p>
      </div>
      <div className="text-right">
        <p className="text-[12.5px] uppercase tracking-wide text-stone-300">Durée</p>
        <p className="text-[22px] font-semibold leading-tight">{formatDuration(duree)}</p>
      </div>
    </div>
  );
}
