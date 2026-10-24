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
import { AnimatedNumber, Button, Callout, LinkButton, PageHeader } from '../../../../components/admin/ui';
import CommandesEnLigne from './CommandesEnLigne';

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

      <CommandesEnLigne onSold={load} />

      <section aria-label="Encours des bons" className="flex flex-wrap items-end gap-x-12 gap-y-4 rounded-xl bg-stone-50 px-6 py-6 lg:px-8">
        <div>
          <p className="text-[15px] font-medium text-stone-700">Reste à honorer</p>
          {loading
            ? <div className="mt-2 h-11 w-44 rounded-xl bg-stone-100 animate-pulse" />
            : <p className="mt-2 text-[44px] font-semibold leading-none tracking-tight text-stone-950 tabular-nums"><AnimatedNumber value={encours} format={formatCHF} /></p>}
        </div>
        <p className="max-w-md flex-1 text-[14px] leading-relaxed text-stone-600">
          Des soins déjà payés que l&apos;institut doit encore : une dette envers les clientes, pas un chiffre d&apos;affaires à venir — l&apos;argent est entré à la vente des bons.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" />
          <label htmlFor="bons-search" className="sr-only">Rechercher un bon</label>
          <input
            id="bons-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Code, bénéficiaire, acheteuse…"
            className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-4 text-[15px] text-stone-900 placeholder:text-stone-500 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div className="inline-flex shrink-0 rounded-xl bg-stone-100 p-1">
          {(['valables', 'tous'] as Filter[]).map(f => (
            <button
              key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`h-9 rounded-lg px-4 text-[14px] transition-colors cursor-pointer ${
                filter === f ? 'bg-stone-900 font-semibold text-white' : 'font-medium text-stone-600 hover:text-stone-950'
              }`}
            >
              {f === 'valables' ? 'Valables' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <div className="data-frame overflow-hidden rounded-xl">
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
          <ul className="zebra">
            {filtered.map(card => {
              const expired = isGiftCardExpired(card);
              const dim = card.status !== 'active' || expired;
              const entame = Number(card.montant_restant) !== Number(card.montant_initial);
              return (
                <li key={card.id} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-row-hover ${dim ? 'opacity-55' : ''}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warm-soft text-warm-ink" aria-hidden="true">
                    <Ticket size={18} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-stone-950 tabular-nums">
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
                    <span className="block text-[15px] font-semibold text-stone-950 tabular-nums">
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
    <span className={`text-[12px] font-semibold px-2 py-0.5 whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}
