"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Gift, Search, Download, RefreshCw, AlertCircle, Loader2, Ticket,
} from 'lucide-react';
import { listGiftCards } from '../../../../services/caisse';
import { downloadBonCadeau } from '../../../../utils/factureDownload';
import {
  formatCHF, giftCardStatusLabel, isGiftCardExpired,
} from '../../../../types/caisse';
import type { GiftCard } from '../../../../types/caisse';

type Filter = 'valables' | 'tous';

export default function BonsClient() {
  const [cards, setCards]     = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('valables');
  const [busy, setBusy]       = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setCards(await listGiftCards());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter(c => {
      const valable = c.status === 'active' && Number(c.montant_restant) > 0 && !isGiftCardExpired(c);
      if (filter === 'valables' && !valable) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.libelle.toLowerCase().includes(q) ||
        (c.beneficiaire ?? '').toLowerCase().includes(q) ||
        c.acheteur_label.toLowerCase().includes(q)
      );
    });
  }, [cards, search, filter]);

  // Engagement en cours : ce que l'institut doit encore en prestations. C'est
  // une dette envers les clientes, pas un chiffre d'affaires à venir.
  const encours = useMemo(() => cards
    .filter(c => c.status === 'active' && !isGiftCardExpired(c))
    .reduce((acc, c) => acc + Number(c.montant_restant), 0), [cards]);

  const handleDownload = async (card: GiftCard) => {
    setBusy(card.id); setError(null);
    try {
      await downloadBonCadeau(card.id, card.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <Gift size={20} className="text-sage" /> Bons cadeaux
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {filtered.length} bon{filtered.length !== 1 ? 's' : ''}
            {filter === 'valables' && ' en cours de validité'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300 rounded-lg text-sm transition-all cursor-pointer"
          >
            <RefreshCw size={13} /> Actualiser
          </button>
          <Link
            href="/admin/caisse"
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all cursor-pointer shadow-sm"
          >
            <Gift size={14} /> Vendre un bon
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5">
        <p className="text-[11px] text-stone-400 font-medium mb-1">Engagement en cours</p>
        {loading
          ? <div className="h-7 w-28 bg-stone-100 rounded animate-pulse" />
          : <p className="text-xl font-semibold text-stone-900 tabular-nums">{formatCHF(encours)}</p>}
        <p className="text-[11px] text-stone-400 mt-2 leading-relaxed">
          Prestations déjà payées que l&apos;institut doit encore. C&apos;est une dette
          envers les clientes, pas un chiffre d&apos;affaires à venir — cet argent a
          été encaissé à la vente des bons.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
          <label htmlFor="bons-search" className="sr-only">Rechercher un bon</label>
          <input
            id="bons-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Code, bénéficiaire, acheteuse…"
            className="w-full pl-11 pr-4 py-3 border border-stone-200 bg-white rounded-xl text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          {(['valables', 'tous'] as Filter[]).map(f => (
            <button
              key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`px-4 py-3 text-sm transition-colors cursor-pointer ${
                filter === f ? 'bg-sage/10 text-sage font-medium' : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              {f === 'valables' ? 'Valables' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-stone-400 text-sm italic">
              {search ? 'Aucun résultat.' : filter === 'valables' ? 'Aucun bon en cours de validité.' : 'Aucun bon émis.'}
            </p>
            {!search && (
              <Link href="/admin/caisse" className="text-sage text-sm font-medium hover:underline">
                Vendre un bon cadeau →
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-stone-50">
            {filtered.map(card => {
              const expired = isGiftCardExpired(card);
              const dim = card.status !== 'active' || expired;
              const entame = Number(card.montant_restant) !== Number(card.montant_initial);
              return (
                <li key={card.id} className={`flex items-center gap-3 px-5 py-4 hover:bg-stone-50/50 transition-colors ${dim ? 'opacity-55' : ''}`}>
                  <Ticket size={16} className="text-sage shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 tabular-nums flex items-center gap-2 flex-wrap">
                      {card.code}
                      <StatusBadge card={card} />
                    </p>
                    <p className="text-xs text-stone-400 truncate">
                      {card.libelle}
                      {card.beneficiaire && ` · pour ${card.beneficiaire}`}
                    </p>
                    <p className="text-[11px] text-stone-300 mt-0.5">
                      Vendu à {card.acheteur_label} le {new Date(card.emis_le).toLocaleDateString('fr-CH')}
                      {' · '}échéance {new Date(`${card.expire_le}T00:00:00`).toLocaleDateString('fr-CH')}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block text-sm font-medium text-stone-900 tabular-nums">
                      {formatCHF(card.montant_restant)}
                    </span>
                    {entame && (
                      <span className="block text-[10px] text-stone-400 tabular-nums">
                        sur {formatCHF(card.montant_initial)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownload(card)}
                    disabled={busy === card.id || card.status === 'annule'}
                    aria-label={`Imprimer le bon ${card.code}`} title="Imprimer le bon"
                    className="shrink-0 p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-all disabled:opacity-30 cursor-pointer"
                  >
                    {busy === card.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ card }: { card: GiftCard }) {
  const label = giftCardStatusLabel(card);
  const cls = label === 'Valable'
    ? 'text-green-600 bg-green-50'
    : label === 'Annulé'
      ? 'text-red-500 bg-red-50'
      : 'text-stone-400 bg-stone-100';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}
