"use client";

import React, { useMemo, useState } from 'react';
import { ChevronRight, Phone, Search, X } from 'lucide-react';
import type { Booking, BookingStatus } from '../../../types/booking';
import { PERIODE_LABEL, STATUT_LABEL, bookingTotal, formatCHF } from '../../../types/booking';
import { EmptyState, Input, Select } from '../ui';
import { ServiceSummary, StatusPill } from './Bits';
import { cap, formatDateShort, nationalDigits, fullName, requestedPeriode, telHref } from './lib';

type Tab = 'en_attente' | 'aujourdhui' | 'confirmes' | 'tous' | 'historique';

const HISTORY: BookingStatus[] = ['termine', 'annule', 'refuse'];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function ListView({
  bookings,
  today,
  coupure,
  onOpen,
}: {
  bookings: Booking[];
  today: string;
  coupure: string;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('en_attente');
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState<'' | BookingStatus>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const counts = useMemo(
    () => ({
      en_attente: bookings.filter((b) => b.statut === 'en_attente').length,
      aujourdhui: bookings.filter((b) => b.date_rdv === today && ['en_attente', 'confirme', 'termine'].includes(b.statut)).length,
      confirmes: bookings.filter((b) => b.statut === 'confirme').length,
      tous: bookings.length,
      historique: bookings.filter((b) => HISTORY.includes(b.statut)).length,
    }),
    [bookings, today],
  );

  const rows = useMemo(() => {
    const q = norm(query.trim());
    const qDigits = /^[\d\s+.\-/()]+$/.test(query.trim()) ? nationalDigits(query) : '';
    const list = bookings.filter((b) => {
      if (tab === 'en_attente' && b.statut !== 'en_attente') return false;
      if (tab === 'aujourdhui' && !(b.date_rdv === today && ['en_attente', 'confirme', 'termine'].includes(b.statut))) return false;
      if (tab === 'confirmes' && b.statut !== 'confirme') return false;
      if (tab === 'historique' && !HISTORY.includes(b.statut)) return false;
      if (statut && b.statut !== statut) return false;
      if (from && b.date_rdv < from) return false;
      if (to && b.date_rdv > to) return false;
      if (q) {
        const hay = norm(
          `${b.prenom} ${b.nom} ${b.nom} ${b.prenom} ${b.email ?? ''} ${b.service_nom} ${(b.options ?? []).map((o) => o.nom).join(' ')} ${b.ville ?? ''}`,
        );
        const phoneOk = qDigits.length >= 2 && nationalDigits(b.telephone).includes(qDigits);
        if (!hay.includes(q) && !phoneOk) return false;
      }
      return true;
    });
    const dir = tab === 'historique' || tab === 'tous' ? -1 : 1;
    return list.sort((a, b) => dir * (`${a.date_rdv} ${a.heure_rdv}`.localeCompare(`${b.date_rdv} ${b.heure_rdv}`)));
  }, [bookings, tab, query, statut, from, to, today]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'en_attente', label: 'À confirmer', count: counts.en_attente },
    { id: 'aujourdhui', label: "Aujourd'hui", count: counts.aujourdhui },
    { id: 'confirmes', label: 'Confirmés', count: counts.confirmes },
    { id: 'tous', label: 'Tous', count: counts.tous },
    { id: 'historique', label: 'Historique', count: counts.historique },
  ];

  const filtersActive = Boolean(query || statut || from || to);

  return (
    <div className="space-y-4">
      <div className="max-w-full overflow-x-auto">
        <div role="tablist" aria-label="Filtrer la liste" className="inline-flex min-w-max gap-1 rounded-xl bg-stone-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex h-11 items-center gap-2 rounded-lg px-4 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                tab === t.id
                  ? 'bg-white font-semibold text-stone-950 shadow-xs ring-1 ring-stone-200'
                  : 'font-medium text-stone-700 hover:text-stone-950'
              }`}
            >
              {t.label}
              <span className="rounded-full bg-stone-200 px-2 text-[12px] font-bold text-stone-800">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_12rem_9.5rem_9.5rem]">
        <div className="relative col-span-2 lg:col-span-1">
          <label htmlFor="res-search" className="sr-only">
            Rechercher par nom, téléphone ou soin
          </label>
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-stone-500" aria-hidden="true" />
          <Input
            id="res-search"
            type="search"
            placeholder="Nom, téléphone, soin…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="!h-12 pl-10 text-[16px]"
          />
        </div>
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="res-statut" className="sr-only">
            Filtrer par statut
          </label>
          <Select id="res-statut" value={statut} onChange={(e) => setStatut(e.target.value as '' | BookingStatus)} className="!h-12 text-[16px]">
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUT_LABEL) as BookingStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUT_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="res-from" className="mb-1 block text-[13px] font-semibold text-stone-800 lg:sr-only">
            Du
          </label>
          <Input id="res-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!h-12 text-[16px]" />
        </div>
        <div>
          <label htmlFor="res-to" className="mb-1 block text-[13px] font-semibold text-stone-800 lg:sr-only">
            Au
          </label>
          <Input id="res-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="!h-12 text-[16px]" />
        </div>
      </div>
      {filtersActive && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setStatut('');
            setFrom('');
            setTo('');
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium text-stone-800 hover:bg-stone-100"
        >
          <X size={15} /> Effacer les filtres
        </button>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun rendez-vous ici"
          description={filtersActive ? 'Essayez d’élargir la recherche.' : 'Rien à afficher dans cet onglet pour le moment.'}
        />
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-300 bg-white">
          {rows.map((b) => {
            const total = b.total_chf ?? bookingTotal(b);
            return (
              <li key={b.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                >
                  <div className="w-24 shrink-0 text-[14px] leading-snug text-stone-800 sm:w-32">
                    <p className="font-semibold text-stone-950">{cap(formatDateShort(b.date_rdv))}</p>
                    <p>{b.horaire_fixe ? b.heure_rdv : `${PERIODE_LABEL[requestedPeriode(b, coupure)]} (à fixer)`}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-stone-950">{fullName(b)}</p>
                    <p className="truncate text-[14px] text-stone-700">
                      <ServiceSummary booking={b} />
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                      <StatusPill statut={b.statut} />
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <StatusPill statut={b.statut} />
                    <p className="mt-1 text-[14px] font-medium text-stone-800">{formatCHF(total)}</p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-stone-500" aria-hidden="true" />
                </button>
                <a
                  href={telHref(b.telephone)}
                  aria-label={`Appeler ${fullName(b)}`}
                  className="grid w-14 shrink-0 place-items-center border-l border-stone-200 text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                >
                  <Phone size={20} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
