"use client";

import React from 'react';
import Link from 'next/link';
import { formatCHF } from '../../../../types/caisse';
import type { Expense } from '../../../../types/finance';

export type FactureAchatOption = Pick<Expense, 'id' | 'fournisseur' | 'numero_facture' | 'date_facture' | 'montant_ttc'> & { code: string };

/**
 * Choix de la facture d'achat qui justifie une réception. Obligatoire : une
 * entrée en stock sans pièce rendrait le stock (et la variation de stock du
 * bilan) invérifiable. Postgres le refuse de toute façon.
 */
export default function FactureAchatSelect({ id, factures, value, onChange }: {
  id: string;
  factures: FactureAchatOption[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-medium text-stone-700 mb-1">Facture d&apos;achat de cette livraison *</label>
      <select
        id={id} value={value} onChange={e => onChange(e.target.value)} disabled={factures === null}
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none"
      >
        <option value="">{factures === null ? 'Chargement…' : '— Choisir la facture —'}</option>
        {(factures ?? []).map(f => (
          <option key={f.id} value={f.id}>
            {new Date(`${f.date_facture}T12:00:00`).toLocaleDateString('fr-CH')} · {f.fournisseur}
            {f.numero_facture ? ` n° ${f.numero_facture}` : ''} · {formatCHF(f.montant_ttc)} ({f.code})
          </option>
        ))}
      </select>
      <p className="text-[12px] text-stone-500 mt-1">
        Facture absente ? Enregistrez-la d&apos;abord dans{' '}
        <Link href="/admin/caisse/depenses" className="underline">Factures & Dépenses</Link>{' '}
        (compte 4000, 4200 ou 4400). Une facture fournisseur détaillée s&apos;importe directement en stock.
      </p>
    </div>
  );
}
