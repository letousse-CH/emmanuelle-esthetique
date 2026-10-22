"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, Repeat, CalendarPlus, Check } from 'lucide-react';
import { listSubscriptions, prolongerSubscription } from '../../../../services/caisse';
import {
  compositionResume, formatCHF, isSubscriptionUsable, seancesRestantes, seancesTotales,
  subscriptionEncours, subscriptionStatusLabel,
} from '../../../../types/caisse';
import type { Subscription } from '../../../../types/caisse';
import { AnimatedNumber, Button, Callout, LinkButton, PageHeader } from '../../../../components/admin/ui';
import { BottomSheet } from '../../../../components/admin/mobile/ui';

type Filter = 'en_cours' | 'tous';

const dateCH = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('fr-CH');

/**
 * Abonnements vendus : séances restantes, échéance, prolongation. Rien ne
 * s'y vend ni ne s'y déduit — la vente et les séances passent par la caisse,
 * qui émet les factures.
 */
export default function AbonnementsClient() {
  const [subs, setSubs]       = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('en_cours');
  const [prolonger, setProlonger] = useState<Subscription | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setSubs(await listSubscriptions());
    } catch (err) {
      setError(`La liste des abonnements n'a pas pu être chargée${err instanceof Error ? ` (${err.message})` : ''}. Vérifiez la connexion puis cliquez sur « Actualiser ».`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter(s => {
      // « En cours » garde aussi les échus qui ont encore des séances : ce sont
      // eux qu'on vient chercher pour les prolonger.
      const ouvert = s.status === 'active' && seancesRestantes(s) > 0;
      if (filter === 'en_cours' && !ouvert) return false;
      if (!q) return true;
      return s.code.toLowerCase().includes(q)
        || s.client_label.toLowerCase().includes(q)
        || s.libelle.toLowerCase().includes(q);
    });
  }, [subs, search, filter]);

  // Séances déjà payées que l'institut doit encore : un engagement, pas une
  // recette à venir — l'argent est entré à la vente.
  const encours = useMemo(() => subs.reduce((acc, s) => acc + subscriptionEncours(s), 0), [subs]);
  const seancesDues = useMemo(
    () => subs.filter(s => isSubscriptionUsable(s)).reduce((n, s) => n + seancesRestantes(s), 0),
    [subs],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnements"
        description={loading
          ? 'Séances payées d’avance, restantes et échéances.'
          : `${filtered.length} abonnement${filtered.length !== 1 ? 's' : ''}${filter === 'en_cours' ? ' en cours' : ' au total'}.`}
        actions={
          <>
            <Button icon={RefreshCw} onClick={load} loading={loading} aria-label="Actualiser" title="Actualiser">
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <LinkButton variant="primary" href="/admin/caisse" icon={Repeat}>Vendre en caisse</LinkButton>
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

      <section aria-label="Séances dues" className="flex flex-wrap items-end gap-x-12 gap-y-4 rounded-xl bg-stone-50 px-6 py-6 lg:px-8">
        <div>
          <p className="text-[15px] font-medium text-stone-700">Séances à honorer</p>
          {loading
            ? <div className="mt-2 h-11 w-44 rounded-xl bg-stone-100 animate-pulse" />
            : (
              <p className="mt-2 text-[44px] font-semibold leading-none tracking-tight text-stone-950 tabular-nums">
                <AnimatedNumber value={seancesDues} format={n => String(Math.round(n))} />
                <span className="ml-3 text-[17px] font-medium tracking-normal text-stone-600">soit {formatCHF(encours)}</span>
              </p>
            )}
        </div>
        <p className="max-w-md flex-1 text-[14px] leading-relaxed text-stone-600">
          Des soins déjà payés que l&apos;institut doit encore. L&apos;argent est entré dans les recettes à la vente
          de l&apos;abonnement ; chaque séance se déduit ensuite en caisse, sur une facture à CHF 0.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" />
          <label htmlFor="abos-search" className="sr-only">Rechercher un abonnement</label>
          <input
            id="abos-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Code, cliente, formule…"
            className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-11 pr-4 text-[15px] text-stone-900 placeholder:text-stone-500 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <div className="inline-flex shrink-0 rounded-xl bg-stone-100 p-1">
          {(['en_cours', 'tous'] as Filter[]).map(f => (
            <button
              key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`h-9 rounded-lg px-4 text-[14px] transition-colors cursor-pointer ${
                filter === f ? 'bg-stone-900 font-semibold text-white' : 'font-medium text-stone-600 hover:text-stone-950'
              }`}
            >
              {f === 'en_cours' ? 'En cours' : 'Tous'}
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
                ? `Aucun abonnement ne correspond à « ${search} »${filter === 'en_cours' ? ' parmi ceux en cours' : ''}.`
                : filter === 'en_cours' ? 'Aucun abonnement en cours.' : 'Aucun abonnement vendu.'}
            </p>
            {!search && (
              <p className="text-[13px] text-stone-600">
                Créez une formule dans le{' '}
                <Link href="/admin/caisse/prestations" className="text-accent font-medium hover:underline">catalogue</Link>
                {' '}(bouton « Abonnement »), puis vendez-la en caisse.
              </p>
            )}
          </div>
        ) : (
          <ul className="zebra">
            {filtered.map(sub => {
              const label = subscriptionStatusLabel(sub);
              const dim = label === 'Annulé' || label === 'Terminé';
              return (
                <li key={sub.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-row-hover ${dim ? 'opacity-55' : ''}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent" aria-hidden="true">
                    <Repeat size={18} />
                  </span>

                  <div className="flex-1 min-w-[12rem]">
                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-stone-950">
                      <Link href={`/admin/caisse/clients?client=${sub.client_id}`} className="hover:underline">{sub.client_label}</Link>
                      <span className="font-normal text-stone-500 tabular-nums">{sub.code}</span>
                      <StatusBadge label={label} />
                    </p>
                    <p className="truncate text-[12.5px] text-stone-600">
                      {sub.libelle} · {compositionResume(sub.subscription_credits)}
                    </p>
                    <p className="text-[13px] text-stone-600 mt-0.5">
                      Vendu le {dateCH(sub.emis_le)} ({formatCHF(sub.prix_paye)})
                      {' · '}échéance {dateCH(sub.expire_le)}
                      {sub.prolonge_le && ` (prolongé le ${dateCH(sub.prolonge_le)}, initialement ${dateCH(sub.expire_initiale)})`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {sub.subscription_credits.map(c => (
                      <span key={c.id} className="block text-[13px] text-stone-700 tabular-nums">
                        <span className="font-semibold text-stone-950">{c.restantes}</span> / {c.seances}
                        <span className="text-stone-500"> {c.libelle}</span>
                      </span>
                    ))}
                    {sub.subscription_credits.length > 1 && (
                      <span className="block text-[12px] text-stone-500 tabular-nums">
                        {seancesRestantes(sub)} séance{seancesRestantes(sub) > 1 ? 's' : ''} sur {seancesTotales(sub)}
                      </span>
                    )}
                  </div>

                  {sub.status !== 'annule' && seancesRestantes(sub) > 0 && (
                    <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => setProlonger(sub)}>
                      Prolonger
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {prolonger && (
        <ProlongerDialog
          sub={prolonger}
          onClose={() => setProlonger(null)}
          onDone={() => { setProlonger(null); load(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const cls = label === 'En cours'
    ? 'text-emerald-700 bg-emerald-50'
    : label === 'Annulé'
      ? 'text-red-700 bg-red-50'
      : label === 'Échu'
        ? 'text-amber-800 bg-amber-50'
        : 'text-stone-700 bg-stone-100';
  return <span className={`text-[12px] font-semibold px-2 py-0.5 whitespace-nowrap ${cls}`}>{label}</span>;
}

/** Repousse l'échéance ; l'échéance d'origine reste inscrite sur l'abonnement. */
function ProlongerDialog({ sub, onClose, onDone }: {
  sub: Subscription;
  onClose: () => void;
  onDone: () => void;
}) {
  // Proposition : trois mois après l'échéance actuelle, ou après aujourd'hui si elle est passée.
  const [date, setDate] = useState(() => {
    const base = new Date(`${sub.expire_le}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = base < today ? today : base;
    d.setMonth(d.getMonth() + 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await prolongerSubscription(sub.id, date);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La prolongation n’a pas été enregistrée. Réessayez.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={() => { if (!saving) onClose(); }}
      title={`Prolonger ${sub.code}`}
      zIndex={110}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button type="submit" form="prolonger-form" variant="primary" icon={saving ? undefined : Check} loading={saving}>
            Prolonger
          </Button>
        </div>
      }
    >
      <form id="prolonger-form" onSubmit={submit} className="space-y-4">
        <p className="text-[15px] text-stone-600 leading-relaxed">
          Abonnement de <strong className="text-stone-800">{sub.client_label}</strong>, échéance actuelle le{' '}
          <strong className="text-stone-800">{dateCH(sub.expire_le)}</strong>. L&apos;échéance d&apos;origine reste inscrite.
        </p>
        <div>
          <label htmlFor="prolonger-date" className="block text-[14px] font-medium text-stone-700 mb-1">Nouvelle échéance</label>
          <input
            id="prolonger-date" type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="h-11 px-3 border border-stone-200 rounded-lg text-[16px] text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none"
          />
        </div>
        {error && <p className="text-[14px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </form>
    </BottomSheet>
  );
}
