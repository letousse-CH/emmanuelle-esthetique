"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive, ArchiveRestore, BadgePercent, CalendarClock, ChevronDown, ExternalLink, Pencil, Plus, RotateCcw, Trash2,
} from 'lucide-react';
import { Badge, Button, Callout, EmptyState, PageHeader } from '../../../components/admin/ui';
import { Fab } from '../../../components/admin/mobile/ui';
import { useConfirm } from '../../../components/admin/mobile-pages/useConfirm';
import { deleteOffer, listOfferStats, listOffers, setOfferArchived } from '../../../services/offers';
import type { Offer, OfferInput, OfferStats, OfferStatus } from '../../../types/offers';
import {
  EMPTY_STATS, OFFER_STATUS_LABEL, daysLeft, formatOfferDuration, formatOfferPeriod, isOfferUsed,
  offerPagePath, offerStatus, offerToPublic, offerYear, placesPrises, placesRestantes,
} from '../../../types/offers';
import { formatCHF } from '../../../types/caisse';
import { todayZurich } from '../../(public)/reservation/dates';
import OfferEditor, { blankOffer, relaunchFrom } from './OfferEditor';
import OfferShareButton from '../../../components/OfferShare';
import { useSettings } from '../../../hooks/useSettings';

const STATUS_TONE: Record<OfferStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  en_cours: 'success',
  complete: 'warning',
  a_venir: 'info',
  brouillon: 'neutral',
  terminee: 'neutral',
  archivee: 'neutral',
};

type EditorState = { offer: Offer | null; initial?: OfferInput } | null;

export default function OffresClient() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [stats, setStats] = useState<Map<string, OfferStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmer, confirmNode] = useConfirm();
  const today = todayZurich();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [list, st] = await Promise.all([
        listOffers(),
        // Sans compteurs, la page reste utilisable : les chiffres s'affichent à zéro.
        listOfferStats().catch(() => new Map<string, OfferStats>()),
      ]);
      setOffers(list); setStats(st);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /column|colonne|schema|does not exist/i.test(msg)
          ? 'La base n’a pas encore les colonnes des offres du moment : appliquez supabase/migrations/20261005_offres_du_moment.sql dans le SQL Editor de Supabase, puis rechargez la page.'
          : `Les offres n’ont pas pu être chargées (${msg}). Vérifiez la connexion puis rechargez la page.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const statsOf = (o: Offer) => stats.get(o.id) ?? { offer_id: o.id, ...EMPTY_STATS };
  const statusOf = (o: Offer) => offerStatus(o, statsOf(o), today);

  const groups = useMemo(() => {
    const now: Offer[] = [];
    const upcoming: Offer[] = [];
    const drafts: Offer[] = [];
    const history: Offer[] = [];
    for (const o of offers) {
      const st = offerStatus(o, stats.get(o.id), today);
      if (st === 'en_cours' || st === 'complete') now.push(o);
      else if (st === 'a_venir') upcoming.push(o);
      else if (st === 'brouillon') drafts.push(o);
      else history.push(o);
    }
    now.sort((a, b) => a.date_fin.localeCompare(b.date_fin));
    upcoming.sort((a, b) => a.date_debut.localeCompare(b.date_debut));
    const archivedCount = history.filter((o) => o.archived_at).length;
    const shownHistory = history.filter((o) => showArchived || !o.archived_at);
    // Historique rangé par année (celle du début de l'offre), la plus récente d'abord.
    const byYear = new Map<string, Offer[]>();
    for (const o of shownHistory) {
      const y = offerYear(o);
      byYear.set(y, [...(byYear.get(y) ?? []), o]);
    }
    const years = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return { now, upcoming, drafts, years, archivedCount };
  }, [offers, stats, today, showArchived]);

  const upsert = (saved: Offer) => {
    setOffers((prev) => (prev.some((o) => o.id === saved.id) ? prev.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev]));
  };

  const archiver = async (o: Offer, archived: boolean) => {
    const st = statusOf(o);
    if (archived && (st === 'en_cours' || st === 'complete' || st === 'a_venir')) {
      const ok = await confirmer({
        title: `Archiver « ${o.titre} » ?`,
        message: 'Elle quittera tout de suite le site, la réservation en ligne et la caisse. Les rendez-vous déjà pris sont conservés.',
        confirmLabel: 'Archiver',
      });
      if (!ok) return;
    }
    setBusyId(o.id);
    try {
      upsert(await setOfferArchived(o.id, archived));
    } catch (err) {
      setError(`L’offre n’a pas pu être ${archived ? 'archivée' : 'désarchivée'}${err instanceof Error ? ` (${err.message})` : ''}.`);
    } finally {
      setBusyId(null);
    }
  };

  const supprimer = async (o: Offer) => {
    const ok = await confirmer({
      title: `Supprimer « ${o.titre} » ?`,
      message: 'Elle n’a jamais été réservée ni encaissée : elle disparaîtra définitivement.',
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!ok) return;
    setBusyId(o.id);
    try {
      await deleteOffer(o.id);
      setOffers((prev) => prev.filter((x) => x.id !== o.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const rowActions = (o: Offer) => {
    const used = isOfferUsed(statsOf(o));
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditor({ offer: o })}>Modifier</Button>
        {(statusOf(o) === 'terminee' || o.archived_at) && (
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setEditor({ offer: null, initial: relaunchFrom(o) })} title="Créer une nouvelle offre reprenant celle-ci, avec de nouvelles dates">
            Relancer
          </Button>
        )}
        {o.archived_at ? (
          <Button size="sm" variant="ghost" icon={ArchiveRestore} loading={busyId === o.id} onClick={() => archiver(o, false)}>Désarchiver</Button>
        ) : (
          <Button size="sm" variant="ghost" icon={Archive} loading={busyId === o.id} onClick={() => archiver(o, true)}>Archiver</Button>
        )}
        {!used && (
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => supprimer(o)} aria-label={`Supprimer ${o.titre}`} className="text-red-700 hover:bg-red-50">
            <span className="max-sm:sr-only">Supprimer</span>
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Offre du moment"
        description="Une offre datée, au tarif et aux conditions de votre choix. Pendant sa période, elle apparaît d’elle-même sur le site, dans la réservation en ligne et en caisse — et disparaît quand toutes ses places sont prises."
        actions={
          <div className="hidden lg:block">
            <Button variant="primary" icon={Plus} onClick={() => setEditor({ offer: null, initial: blankOffer() })}>
              Nouvelle offre
            </Button>
          </div>
        }
      />

      {error && (
        <Callout tone="danger" actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}>
          {error}
        </Callout>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-stone-600 text-sm">
          <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
        </div>
      ) : offers.length === 0 && !error ? (
        <EmptyState
          icon={BadgePercent}
          title="Aucune offre pour l’instant"
          description="Un soin de saison à prix doux, réservé aux vingt premières clientes, du 1er au 15 du mois : créez-la une fois, elle se met en ligne et se retire toute seule."
          action={<Button variant="primary" icon={Plus} onClick={() => setEditor({ offer: null, initial: blankOffer() })}>Créer une offre</Button>}
        />
      ) : (
        <>
          {/* ── En ce moment ─────────────────────────────────────────── */}
          <section className="space-y-3" aria-labelledby="of-now">
            <h2 id="of-now" className="text-[17px] font-semibold text-stone-950">En ce moment</h2>
            {groups.now.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-6 text-[14px] text-stone-700">
                Aucune offre en cours aujourd’hui : le bloc « Offre du moment » est masqué sur le site.
                {groups.upcoming.length > 0 && <> La prochaine commence le {formatOfferPeriod(groups.upcoming[0].date_debut, groups.upcoming[0].date_debut).replace(/^le /, '')}.</>}
              </p>
            ) : (
              <div className="grid gap-4">
                {groups.now.map((o) => (
                  <CurrentCard key={o.id} offer={o} stats={statsOf(o)} status={statusOf(o)} today={today} actions={rowActions(o)} />
                ))}
              </div>
            )}
          </section>

          {groups.upcoming.length > 0 && (
            <section className="space-y-3" aria-labelledby="of-next">
              <h2 id="of-next" className="text-[17px] font-semibold text-stone-950">À venir</h2>
              <OfferList offers={groups.upcoming} statsOf={statsOf} statusOf={statusOf} actions={rowActions} />
            </section>
          )}

          {groups.drafts.length > 0 && (
            <section className="space-y-3" aria-labelledby="of-drafts">
              <h2 id="of-drafts" className="text-[17px] font-semibold text-stone-950">Brouillons</h2>
              <OfferList offers={groups.drafts} statsOf={statsOf} statusOf={statusOf} actions={rowActions} />
            </section>
          )}

          {/* ── Historique par année ─────────────────────────────────── */}
          <section className="space-y-3" aria-labelledby="of-history">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="of-history" className="text-[17px] font-semibold text-stone-950">Historique</h2>
              {groups.archivedCount > 0 && (
                <label className="flex min-h-11 items-center gap-2 text-[14px] text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-accent" />
                  Afficher les offres archivées ({groups.archivedCount})
                </label>
              )}
            </div>
            {groups.years.length === 0 ? (
              <p className="text-[14px] text-stone-600">
                Les offres terminées{groups.archivedCount > 0 && !showArchived ? ' (hors archives)' : ''} se rangent ici, par année.
              </p>
            ) : (
              groups.years.map(([year, list], i) => (
                <details key={year} open={i === 0} className="group rounded-xl border border-stone-200 bg-white">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-[16px] font-semibold text-stone-950">
                      {year} <span className="font-normal text-stone-600">· {list.length} offre{list.length > 1 ? 's' : ''}</span>
                    </span>
                    <ChevronDown size={18} className="text-stone-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-stone-100">
                    <OfferList offers={list} statsOf={statsOf} statusOf={statusOf} actions={rowActions} flush />
                  </div>
                </details>
              ))
            )}
          </section>
        </>
      )}

      <Fab icon={Plus} label="Nouvelle offre" onClick={() => setEditor({ offer: null, initial: blankOffer() })} />

      {editor && (
        <OfferEditor
          offer={editor.offer}
          initial={editor.initial}
          stats={editor.offer ? statsOf(editor.offer) : undefined}
          onClose={() => setEditor(null)}
          onSaved={(o) => { upsert(o); setEditor(null); }}
        />
      )}
      {confirmNode}
    </div>
  );
}

// ── Offre en cours ──────────────────────────────────────────────────────────

function CurrentCard({ offer: o, stats, status, today, actions }: {
  offer: Offer; stats: OfferStats; status: OfferStatus; today: string; actions: React.ReactNode;
}) {
  const { business_name } = useSettings(['business_name']);
  const prises = placesPrises(stats);
  const restantes = placesRestantes(o, stats);
  const jours = daysLeft(o.date_fin, today);
  const pct = o.places_max ? Math.min(100, Math.round((prises / o.places_max) * 100)) : 0;
  return (
    <article className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
        <div className="relative aspect-square bg-stone-100 md:m-5 md:self-start md:overflow-hidden md:rounded-lg">
          {o.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-stone-500">Pas d’image</div>
          )}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[18px] font-semibold leading-snug text-stone-950">{o.titre}</h3>
              <p className="mt-0.5 text-[13.5px] text-stone-600">
                {formatOfferPeriod(o.date_debut, o.date_fin)} · {formatOfferDuration(o.duree_minutes)} · {formatCHF(o.prix_chf)}
                {o.prix_normal_chf != null && <span className="ml-1 line-through text-stone-500">{formatCHF(o.prix_normal_chf)}</span>}
              </p>
            </div>
            <Badge tone={STATUS_TONE[status]}>{OFFER_STATUS_LABEL[status]}</Badge>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Réservations à venir" value={stats.reservations_en_cours} />
            <Stat label="Soins encaissés" value={stats.facturations} />
            <Stat
              label={restantes == null ? 'Places' : 'Places restantes'}
              value={restantes == null ? '∞' : restantes}
              tone={restantes === 0 ? 'warning' : undefined}
            />
          </dl>

          {o.places_max != null && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={o.places_max} aria-valuenow={prises} aria-label="Places prises">
                <div className={`h-full rounded-full ${restantes === 0 ? 'bg-amber-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[12.5px] text-stone-600">
                {prises} place{prises > 1 ? 's' : ''} prise{prises > 1 ? 's' : ''} sur {o.places_max}
                {restantes === 0 ? ' — complète : retirée du site, toujours encaissable en caisse.' : '.'}
              </p>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[13px] text-stone-700">
            <CalendarClock size={14} className="text-stone-500" aria-hidden="true" />
            {jours <= 0 ? 'Dernier jour aujourd’hui.' : `Encore ${jours + 1} jours, jusqu’au ${formatOfferPeriod(o.date_fin, o.date_fin).replace(/^le /, '')}.`}
            {!o.reservable_en_ligne && <span className="text-stone-500"> Non réservable en ligne.</span>}
          </p>

          {/* Partager : la page de l'offre porte l'aperçu (visuel, titre, prix) affiché par WhatsApp et Facebook. */}
          {status === 'en_cours' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/5 p-2.5">
              <OfferShareButton
                offer={offerToPublic(o, placesRestantes(o, stats))}
                brand={business_name}
                label="Partager l’offre"
                variant="admin"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-fg hover:bg-accent-hover cursor-pointer lg:min-h-10"
              />
              <span className="text-[13px] text-stone-700">WhatsApp, Facebook, Instagram, e-mail… avec le visuel et un message prêt à envoyer.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
            {actions}
            {status === 'en_cours' && (
              <Link href={offerPagePath(o.id)} target="_blank" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
                Voir la page de l’offre <ExternalLink size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'warning' }) {
  return (
    <div className={`flex flex-col rounded-lg px-2 py-2.5 ${tone === 'warning' ? 'bg-amber-50' : 'bg-stone-50'}`}>
      <dt className="order-2 text-[12px] leading-tight text-stone-600">{label}</dt>
      <dd className="order-1 text-[22px] font-semibold tabular-nums text-stone-950">{value}</dd>
    </div>
  );
}

// ── Liste compacte ──────────────────────────────────────────────────────────

function OfferList({ offers, statsOf, statusOf, actions, flush = false }: {
  offers: Offer[];
  statsOf: (o: Offer) => OfferStats;
  statusOf: (o: Offer) => OfferStatus;
  actions: (o: Offer) => React.ReactNode;
  flush?: boolean;
}) {
  return (
    <ul className={`divide-y divide-stone-100 ${flush ? '' : 'rounded-xl border border-stone-200 bg-white'}`}>
      {offers.map((o) => {
        const s = statsOf(o);
        const st = statusOf(o);
        return (
          <li key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-md bg-stone-100">
                {o.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-stone-950">{o.titre}</span>
                  <Badge tone={STATUS_TONE[st]}>{OFFER_STATUS_LABEL[st]}</Badge>
                </p>
                <p className="text-[13px] text-stone-600">
                  {formatOfferPeriod(o.date_debut, o.date_fin)} · {formatCHF(o.prix_chf)}
                  {o.places_max != null && ` · ${o.places_max} places`}
                </p>
                <p className="text-[12.5px] text-stone-500 tabular-nums">
                  {s.reservations_total} réservation{s.reservations_total > 1 ? 's' : ''} · {s.facturations} encaissé{s.facturations > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {actions(o)}
          </li>
        );
      })}
    </ul>
  );
}
