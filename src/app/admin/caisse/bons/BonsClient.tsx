"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Gift, Search, Download, RefreshCw, Loader2, Ticket,
} from 'lucide-react';
import { listGiftCards } from '../../../../services/caisse';
import { downloadBonCadeau } from '../../../../utils/factureDownload';
import {
  formatCHF, giftCardStatusLabel, isGiftCardExpired,
} from '../../../../types/caisse';
import type { GiftCard } from '../../../../types/caisse';
import { Button, Callout, LinkButton, PageHeader } from '../../../../components/admin/ui';

const VENDRE_HREF = '/admin/caisse?vendre=bon';

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
      setError(`La liste des bons n'a pas pu être chargée${err instanceof Error ? ` (${err.message})` : ''}. Vérifiez la connexion puis cliquez sur « Actualiser ».`);
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
      setError(`Le bon n'a pas pu être téléchargé${err instanceof Error ? ` (${err.message})` : ''}. Réessayez.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bons cadeaux"
        description={loading
          ? 'Bons vendus, solde restant et échéance.'
          : `${filtered.length} bon${filtered.length !== 1 ? 's' : ''}${filter === 'valables' ? ' en cours de validité' : ' au total'}.`}
        actions={
          <>
            <Button icon={RefreshCw} onClick={load} loading={loading} aria-label="Actualiser" title="Actualiser">
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <LinkButton variant="primary" href={VENDRE_HREF} icon={Gift}>Vendre un bon</LinkButton>
          </>
        }
      />

      {error && (
        <Callout
          tone="danger"
          actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}
        >
          {error}
        </Callout>
      )}

      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <p className="text-[13px] text-stone-700 font-medium mb-1">Montant restant à honorer</p>
        {loading
          ? <div className="h-7 w-28 bg-stone-100 rounded animate-pulse" />
          : <p className="text-xl font-semibold text-stone-900 tabular-nums">{formatCHF(encours)}</p>}
        <p className="text-[12.5px] text-stone-600 mt-2 leading-relaxed">
          Prestations déjà payées que l&apos;institut doit encore. C&apos;est une dette
          envers les clientes, pas un chiffre d&apos;affaires à venir — cet argent a
          été encaissé à la vente des bons.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" />
          <label htmlFor="bons-search" className="sr-only">Rechercher un bon</label>
          <input
            id="bons-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Code, bénéficiaire, acheteuse…"
            className="w-full pl-11 pr-4 py-2.5 border border-stone-200 bg-white rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
          />
        </div>
        <div className="flex rounded-lg border border-stone-200 bg-white overflow-hidden">
          {(['valables', 'tous'] as Filter[]).map(f => (
            <button
              key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                filter === f ? 'bg-accent-soft text-accent font-semibold' : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              {f === 'valables' ? 'Valables' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-600 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-stone-700">
              {search
                ? `Aucun bon ne correspond à « ${search} »${filter === 'valables' ? ' parmi les bons valables' : ''}.`
                : filter === 'valables' ? 'Aucun bon en cours de validité.' : 'Aucun bon émis.'}
            </p>
            {search && filter === 'valables' ? (
              <button onClick={() => setFilter('tous')} className="text-accent text-sm font-medium hover:underline cursor-pointer">
                Chercher aussi dans les bons utilisés ou expirés
              </button>
            ) : !search && (
              <Link href={VENDRE_HREF} className="text-accent text-sm font-medium hover:underline">
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
                  <Ticket size={16} className="text-accent shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 tabular-nums flex items-center gap-2 flex-wrap">
                      {card.code}
                      <StatusBadge card={card} />
                    </p>
                    <p className="truncate text-[12.5px] text-stone-600">
                      {card.libelle}
                      {card.beneficiaire && ` · pour ${card.beneficiaire}`}
                    </p>
                    <p className="text-[13px] text-stone-600 mt-0.5">
                      Vendu à {card.acheteur_label} le {new Date(card.emis_le).toLocaleDateString('fr-CH')}
                      {' · '}échéance {new Date(`${card.expire_le}T00:00:00`).toLocaleDateString('fr-CH')}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block text-sm font-medium text-stone-900 tabular-nums">
                      {formatCHF(card.montant_restant)}
                    </span>
                    {entame && (
                      <span className="block text-[12px] text-stone-600 tabular-nums">
                        sur {formatCHF(card.montant_initial)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownload(card)}
                    disabled={busy === card.id || card.status === 'annule'}
                    aria-label={`Imprimer le bon ${card.code}`} title="Imprimer le bon"
                    className="shrink-0 p-1.5 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors disabled:opacity-30 cursor-pointer"
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
    ? 'text-emerald-700 bg-emerald-50'
    : label === 'Annulé'
      ? 'text-red-700 bg-red-50'
      : 'text-stone-700 bg-stone-100';
  return (
    <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}
