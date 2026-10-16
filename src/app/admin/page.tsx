"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import Link from 'next/link';
import {
  Files,
  PenLine,
  UsersRound,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  CalendarPlus,
  Phone,
  MessageCircle,
  Check,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import AdminOnboardingWizard from '../../components/admin/AdminOnboardingWizard';
import MobileHome from '../../components/admin/mobile/home/MobileHome';
import { loadMoney } from '../../components/admin/mobile/home/homeData';
import type { MoneyData } from '../../components/admin/mobile/home/homeTypes';
import { dayOfMonth, firstOfPreviousMonth } from '../../components/admin/mobile/home/zurich';
import { formatCHF } from '../../types/caisse';
import { AnimatedNumber } from '../../components/admin/ui';

interface DashboardBooking {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email?: string | null;
  service_nom: string;
  service_prix_chf: number;
  service_duree_minutes: number;
  options?: { id: string; nom: string; prix_chf: number }[];
  date_rdv: string;
  heure_rdv: string;
  /** false = simple demande (matin / après-midi) : `heure_rdv` n'est qu'indicative. */
  horaire_fixe?: boolean;
  periode?: 'matin' | 'apres_midi' | null;
  statut: 'en_attente' | 'confirme' | 'refuse' | 'annule' | 'termine';
  notes_cliente?: string | null;
}

function fmt(n: number) { return n.toLocaleString('fr-CH'); }

const salesLabel = (n: number) => (n > 0 ? `${n} encaissement${n > 1 ? 's' : ''}` : 'Aucun encaissement');

/** Nom du mois d'une date `YYYY-MM-DD` (« septembre »), sans effet du fuseau. */
function monthName(dateStr: string) {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('fr-CH', { month: 'long', timeZone: 'UTC' });
}

/**
 * Chiffres clés : la recette encaissée du mois (en tête), de la semaine et du
 * jour. Même calcul que l'accueil mobile (`loadMoney` → `recetteEncaissee`) :
 * un soin réglé par bon cadeau ne compte pas une seconde fois.
 */
function KeyFigures({ today }: { today: string }) {
  const [money, setMoney] = useState<MoneyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    loadMoney(today).then(setMoney, (e) => setError(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [today]);

  useEffect(() => {
    load();
    // Une vente encaissée dans un autre onglet : les chiffres suivent au retour.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const prevStart = firstOfPreviousMonth(today);
  const delta = money && money.prevMonthToDate > 0
    ? ((money.month - money.prevMonthToDate) / money.prevMonthToDate) * 100
    : null;
  const deltaShown = delta === null ? null : Math.round(delta);

  const skeleton = (cls: string) => <span className={`inline-block rounded-md animate-pulse align-middle ${cls}`} />;

  return (
    <section aria-labelledby="figures-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="figures-title" className="text-[17px] font-semibold tracking-tight text-stone-950">Chiffre d’affaires</h2>
        <Link href="/admin/caisse/journal" className="text-[13.5px] font-semibold text-accent hover:underline underline-offset-4 inline-flex items-center gap-1">
          Journal des ventes <ChevronRight size={14} />
        </Link>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-[14px] text-red-900">
          <AlertTriangle size={16} className="shrink-0 text-red-600" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-white text-[13px] font-medium text-red-800 hover:bg-red-50 cursor-pointer">
            <RefreshCw size={13} /> Réessayer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Le mois : la carte qui compte */}
          <Link
            href="/admin/caisse/journal"
            className="md:col-span-2 rounded-xl bg-growth p-7 transition-[filter] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
          >
            <p className="text-[15px] font-medium text-white first-letter:uppercase">{monthName(today)} · ce mois-ci</p>
            <p className="mt-2 text-[44px] font-semibold leading-none tracking-tight text-white tabular-nums">
              {money ? <AnimatedNumber value={money.month} format={formatCHF} /> : skeleton('h-11 w-56 bg-white/30')}
            </p>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-white">
              <span>{money ? salesLabel(money.monthCount) : '…'}</span>
              {deltaShown !== null && (
                <span className={`inline-flex items-center gap-1 font-semibold text-white`}>
                  {deltaShown >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  {deltaShown >= 0 ? '+' : '−'}{Math.abs(deltaShown)} %
                  <span className="font-normal text-white/90">
                    vs 1–{dayOfMonth(today)} {monthName(prevStart)}
                  </span>
                </span>
              )}
            </p>
          </Link>

          {[
            { label: 'Cette semaine', hint: ' depuis lundi', amount: money?.week, count: money?.weekCount },
            { label: 'Aujourd’hui', hint: '', amount: money?.today, count: money?.todayCount },
          ].map((f) => (
            <Link
              key={f.label}
              href="/admin/caisse/journal"
              className="rounded-xl bg-stone-50 p-6 transition-colors hover:border-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              <p className="text-[15px] font-medium text-stone-600">{f.label}</p>
              <p className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-stone-950 tabular-nums">
                {f.amount !== undefined ? <AnimatedNumber value={f.amount} format={formatCHF} /> : skeleton('h-8 w-32 bg-stone-100')}
              </p>
              <p className="mt-3 text-[14px] text-stone-600">{f.count !== undefined ? `${salesLabel(f.count)}${f.hint}` : '…'}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function DesktopDashboard() {
  const [loading, setLoading]         = useState(true);
  const [articles, setArticles]       = useState(0);
  const [pageCount, setPageCount]     = useState(0);
  const [hasBusinessInfo, setHasBusinessInfo] = useState(false);
  const [siteName, setSiteName]       = useState('');
  const [firstName, setFirstName]     = useState('');

  // ── Réservations du jour & demandes en attente ──
  const [todayBookings, setTodayBookings]     = useState<DashboardBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<DashboardBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const flags = useModuleFlags();

  // Jour civil en Europe/Zurich (toISOString() serait en UTC : faux entre 00h et 02h).
  const todayStr = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date()), []);

  useEffect(() => {
    load();
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setBookingsLoading(false);
        return;
      }

      const res = await fetch('/api/admin/bookings?limit=1000', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const all: DashboardBooking[] = json.bookings || [];

        // Soins du jour (exclut annulés et refusés)
        const forToday = all
          .filter((b) => b.date_rdv === todayStr && !['annule', 'refuse'].includes(b.statut))
          .sort((a, b) => a.heure_rdv.localeCompare(b.heure_rdv));

        // Demandes en attente de confirmation
        const pending = all
          .filter((b) => b.statut === 'en_attente')
          .sort((a, b) => `${a.date_rdv} ${a.heure_rdv}`.localeCompare(`${b.date_rdv} ${b.heure_rdv}`));

        setTodayBookings(forToday);
        setPendingBookings(pending);
      }
    } catch (err) {
      console.error('[Dashboard] Erreur chargement réservations:', err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleUpdateBookingStatus = async (id: string, newStatut: 'confirme' | 'annule' | 'termine') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Jamais d'e-mail depuis ce raccourci : la cliente est prévenue depuis le panneau de traitement.
        body: JSON.stringify({ statut: newStatut, notify_client: false }),
      });

      if (!res.ok) throw new Error('Erreur mise à jour');

      // Rechargement immédiat
      loadBookings();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [{ count: pagesTotal }, { count: articlesTotal }, { data: bizSettings }] = await Promise.all([
        supabase.from('dynamic_pages').select('id', { count: 'exact', head: true }),
        supabase.from('articles').select('id', { count: 'exact', head: true }).eq('published', true),
        supabase.from('settings').select('key, value').in('key', ['business_name', 'business_email', 'business_phone', 'business_owner']),
      ]);
      setPageCount(pagesTotal ?? 0);
      setArticles(articlesTotal ?? 0);
      if (bizSettings && bizSettings.length > 0) {
        const nameSetting = bizSettings.find(s => s.key === 'business_name')?.value;
        const emailSetting = bizSettings.find(s => s.key === 'business_email')?.value;
        if (nameSetting) setSiteName(nameSetting);
        if (nameSetting || emailSetting) setHasBusinessInfo(true);
        // « Bonjour Emmanuelle » : le prénom de la gérante, s'il est renseigné (onglet Entreprise).
        const owner = String(bizSettings.find(s => s.key === 'business_owner')?.value ?? '').trim();
        if (owner) setFirstName(owner.split(/\s+/)[0]);
      }
    } catch (err) {
      console.error('[Dashboard] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const greeting = now.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  const dateLabel = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });

  // Raccourcis : ce qui ne mérite pas une carte, mais qu'on veut sous la main.
  const shortcuts = [
    { label: 'Modifier une page', hint: loading ? '…' : `${fmt(pageCount)} page${pageCount > 1 ? 's' : ''}`, href: '/admin/pages', icon: Files },
    ...(flags.blog ? [{ label: 'Rédiger un article', hint: loading ? '…' : `${fmt(articles)} publié${articles > 1 ? 's' : ''}`, href: '/admin/blog/new', icon: PenLine }] : []),
    ...(flags.caisse ? [{ label: 'Fiche cliente', hint: 'Créer ou retrouver', href: '/admin/caisse/clients', icon: UsersRound }] : []),
    { label: 'Voir le site', hint: 'Nouvel onglet', href: '/', icon: ArrowUpRight, external: true },
  ];

  const cleanPhone = (t: string) => t.replace(/[^\d]/g, '');
  const iconBtn = 'grid size-9 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-white hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12">
      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[14px] font-medium text-stone-500 first-letter:uppercase">{dateLabel}</p>
          <h1 className="mt-1 text-[34px] font-semibold leading-tight tracking-tight text-stone-950">
            {greeting}{firstName ? ` ${firstName}` : ''}
          </h1>
          <p className="mt-1.5 text-[16px] text-stone-600">
            {bookingsLoading
              ? 'Voici l’essentiel de la journée.'
              : todayBookings.length === 0 && pendingBookings.length === 0
                ? 'Journée calme : aucun rendez-vous ni demande en attente.'
                : [
                    todayBookings.length > 0 && `${todayBookings.length} rendez-vous aujourd’hui`,
                    pendingBookings.length > 0 && `${pendingBookings.length} demande${pendingBookings.length > 1 ? 's' : ''} à confirmer`,
                  ].filter(Boolean).join(' · ') + '.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/reservations?nouveau=1"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-100 px-4 text-[14px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <CalendarPlus size={16} /> Rendez-vous
          </Link>
          {flags.caisse && (
            <Link
              href="/admin/caisse"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              <CreditCard size={16} /> Encaisser
            </Link>
          )}
        </div>
      </header>

      {/* Chiffres clés : le chiffre d'affaires, le mois d'abord */}
      {flags.caisse && <KeyFigures today={todayStr} />}

      {/* Aujourd'hui et demandes : deux listes simples, pas de cartes dans des cartes */}
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="today-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="today-title" className="text-[17px] font-semibold tracking-tight text-stone-950">
              Rendez-vous du jour
              {!bookingsLoading && <span className="ml-2 text-[14px] font-normal text-stone-500">{todayBookings.length}</span>}
            </h2>
            <Link href="/admin/reservations?vue=jour" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline">
              Agenda <ChevronRight size={14} />
            </Link>
          </div>
          <div className="data-frame overflow-hidden rounded-xl">
            {bookingsLoading ? (
              <div className="space-y-px">
                {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse bg-stone-50" />)}
              </div>
            ) : todayBookings.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14.5px] text-stone-500">Aucun rendez-vous aujourd’hui.</p>
            ) : (
              <ul className="zebra">
                {todayBookings.map((b) => {
                  const soft = b.horaire_fixe === false;
                  const timeLabel = soft ? (b.periode === 'apres_midi' ? 'Après-midi' : 'Matin') : b.heure_rdv;
                  const waMsg = encodeURIComponent(
                    soft
                      ? `Bonjour ${b.prenom}, c'est Emmanuelle au sujet de votre demande de rendez-vous aujourd'hui (${timeLabel.toLowerCase()}).`
                      : `Bonjour ${b.prenom}, c'est Emmanuelle au sujet de votre rendez-vous aujourd'hui à ${b.heure_rdv}.`,
                  );
                  const done = b.statut === 'termine';
                  return (
                    <li key={b.id} className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-row-hover ${done ? 'opacity-55' : ''}`}>
                      <span className={`w-[4.5rem] shrink-0 tabular-nums ${soft ? 'text-[13px] font-semibold text-warm-ink' : 'text-[16px] font-semibold text-stone-950'}`}>
                        {timeLabel}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-stone-950">{b.prenom} {b.nom}</span>
                        <span className="block truncate text-[13px] text-stone-500">{b.service_nom} · {b.service_duree_minutes} min</span>
                      </span>
                      <span className="hidden shrink-0 text-[14px] font-medium text-stone-700 tabular-nums sm:block">{formatCHF(b.service_prix_chf)}</span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <a href={`tel:${b.telephone.replace(/\s+/g, '')}`} className={iconBtn} title="Appeler" aria-label={`Appeler ${b.prenom}`}>
                          <Phone size={15} />
                        </a>
                        <a href={`https://wa.me/${cleanPhone(b.telephone)}?text=${waMsg}`} target="_blank" rel="noopener noreferrer" className={iconBtn} title="WhatsApp" aria-label={`Écrire à ${b.prenom} sur WhatsApp`}>
                          <MessageCircle size={15} />
                        </a>
                        {b.statut === 'confirme' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(b.id, 'termine')}
                            className="ml-1 h-8 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover cursor-pointer"
                          >
                            Terminer
                          </button>
                        )}
                        {done && <span className="ml-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-emerald-700"><Check size={14} /> Terminé</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="pending-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="pending-title" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-stone-950">
              À confirmer
              {pendingBookings.length > 0 && (
                <span className="bg-warm px-2 py-0.5 text-[12.5px] font-bold text-warm-ink tabular-nums rounded">{pendingBookings.length}</span>
              )}
            </h2>
            <Link href="/admin/reservations?vue=a-traiter" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline">
              Tout traiter <ChevronRight size={14} />
            </Link>
          </div>
          <div className="data-frame overflow-hidden rounded-xl">
            {bookingsLoading ? (
              <div className="space-y-px">
                {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse bg-stone-50" />)}
              </div>
            ) : pendingBookings.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-[14.5px] text-stone-500">
                <CheckCircle2 size={17} className="text-emerald-600" /> Aucune demande en attente.
              </p>
            ) : (
              <ul className="zebra">
                {pendingBookings.slice(0, 5).map((b) => {
                  const when = new Date(`${b.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
                  const periodLabel = b.horaire_fixe === false ? (b.periode === 'apres_midi' ? 'après-midi' : 'matin') : null;
                  const waMsg = encodeURIComponent(
                    periodLabel
                      ? `Bonjour ${b.prenom}, c'est Emmanuelle d'Emmanuelle Esthétique au sujet de votre demande de rdv pour le ${when}, ${periodLabel === 'matin' ? 'le matin' : 'l’après-midi'}.`
                      : `Bonjour ${b.prenom}, c'est Emmanuelle d'Emmanuelle Esthétique au sujet de votre demande de rdv pour le ${when} à ${b.heure_rdv}.`,
                  );
                  return (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-row-hover">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold text-stone-950">{b.prenom} {b.nom}</span>
                        <span className="block truncate text-[13px] text-stone-500">
                          <span className="font-medium capitalize text-warm-ink">{when} · {periodLabel ?? b.heure_rdv}</span> · {b.service_nom}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <a href={`tel:${b.telephone.replace(/\s+/g, '')}`} className={iconBtn} title="Appeler" aria-label={`Appeler ${b.prenom}`}>
                          <Phone size={15} />
                        </a>
                        <a href={`https://wa.me/${cleanPhone(b.telephone)}?text=${waMsg}`} target="_blank" rel="noopener noreferrer" className={iconBtn} title="WhatsApp" aria-label={`Écrire à ${b.prenom} sur WhatsApp`}>
                          <MessageCircle size={15} />
                        </a>
                        <Link
                          href={`/admin/reservations?id=${b.id}`}
                          title="Appeler la cliente, fixer l'horaire et confirmer"
                          className="ml-1 inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
                        >
                          Traiter
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {pendingBookings.length > 5 && (
              <Link href="/admin/reservations?vue=a-traiter" className="block border-t border-stone-100 px-4 py-2.5 text-center text-[13.5px] font-semibold text-accent hover:bg-stone-50">
                + {pendingBookings.length - 5} autre{pendingBookings.length - 5 > 1 ? 's' : ''} demande{pendingBookings.length - 5 > 1 ? 's' : ''}
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* Raccourcis */}
      <nav aria-label="Raccourcis" className="flex flex-wrap gap-x-8 gap-y-3">
        {shortcuts.map((a) => {
          const inner = (
            <>
              <span className="grid size-9 place-items-center rounded-lg bg-stone-100 text-stone-700 transition-colors group-hover:bg-warm-soft group-hover:text-warm-ink">
                <a.icon size={17} />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold text-stone-900">{a.label}</span>
                <span className="block text-[12.5px] text-stone-500">{a.hint}</span>
              </span>
            </>
          );
          const cls = 'group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
          return 'external' in a && a.external ? (
            <a key={a.href} href={a.href} target="_blank" rel="noopener" className={cls}>{inner}</a>
          ) : (
            <Link key={a.href} href={a.href} className={cls}>{inner}</Link>
          );
        })}
      </nav>

      <AdminOnboardingWizard
        hasBusinessInfo={hasBusinessInfo}
        pageCount={pageCount}
        articleCount={articles}
        siteName={siteName}
      />
    </div>
  );
}

/**
 * Sous `lg` (téléphone, tablette) : l'accueil de l'application. À partir de `lg` :
 * le tableau de bord d'origine, inchangé. Un seul des deux est monté, pour ne pas
 * lancer les requêtes de l'autre.
 */
export default function Dashboard() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mql.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (desktop === null) return <div className="min-h-[60vh]" aria-hidden="true" />;
  return desktop ? <DesktopDashboard /> : <MobileHome />;
}
