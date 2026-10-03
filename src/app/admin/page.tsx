"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import Link from 'next/link';
import {
  Eye,
  FileText,
  Mail,
  Layers,
  ArrowUpRight,
  ArrowRight,
  CreditCard,
  Send,
  CalendarDays,
  Phone,
  MessageCircle,
  Check,
  X,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
} from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { SITE_CONFIG } from '../../config/site';
import AdminOnboardingWizard from '../../components/admin/AdminOnboardingWizard';

interface DayCount { date: string; count: number }
interface PageStat  { page: string; count: number }

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
  statut: 'en_attente' | 'confirme' | 'refuse' | 'annule' | 'termine';
  notes_cliente?: string | null;
}

const PAGE_LABELS: Record<string, string> = {
  '/':                    'Accueil',
  '/about':               'Mon Approche',
  '/blog':                'Blog',
  '/contact':             'Contact',
  '/reservation':         'Réservation en ligne',
  '/seance-individuelle': 'Séance individuelle',
  '/programme-complet':   'Programme complet',
  '/mentions-legales':    'Mentions légales',
};

function label(page: string) {
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  if (page.startsWith('/blog/')) return `Article : ${page.replace('/blog/', '')}`;
  return page;
}

function fmt(n: number) { return n.toLocaleString('fr-FR'); }

export default function Dashboard() {
  const [loading, setLoading]         = useState(true);
  const [today, setToday]             = useState(0);
  const [week, setWeek]               = useState(0);
  const [month, setMonth]             = useState(0);
  const [subscribers, setSubscribers] = useState(0);
  const [articles, setArticles]       = useState(0);
  const [pageCount, setPageCount]     = useState(0);
  const [hasBusinessInfo, setHasBusinessInfo] = useState(false);
  const [siteName, setSiteName]       = useState('');
  const [days, setDays]               = useState<DayCount[]>([]);
  const [topPages, setTopPages]       = useState<PageStat[]>([]);

  // ── Réservations du jour & demandes en attente ──
  const [todayBookings, setTodayBookings]     = useState<DashboardBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<DashboardBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const flags = useModuleFlags();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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

      const res = await fetch('/api/bookings', {
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

      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut: newStatut }),
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setToday(json.today ?? 0);
      setWeek(json.week ?? 0);
      setMonth(json.month ?? 0);
      setSubscribers(json.subscribers ?? 0);
      setArticles(json.articles ?? 0);
      setDays(json.days ?? []);
      setTopPages(json.topPages ?? []);

      // Récupération du nombre de pages dynamiques et des réglages
      const { count: pagesTotal } = await supabase.from('dynamic_pages').select('id', { count: 'exact', head: true });
      setPageCount(pagesTotal ?? 0);

      const { data: bizSettings } = await supabase.from('settings').select('key, value').in('key', ['business_name', 'business_email', 'business_phone']);
      if (bizSettings && bizSettings.length > 0) {
        const nameSetting = bizSettings.find(s => s.key === 'business_name')?.value;
        const emailSetting = bizSettings.find(s => s.key === 'business_email')?.value;
        if (nameSetting) setSiteName(nameSetting);
        if (nameSetting || emailSetting) setHasBusinessInfo(true);
      }
    } catch (err) {
      console.error('[Dashboard] Erreur chargement stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxDay = Math.max(...days.map(d => d.count), 1);
  const now = new Date();
  const greeting = now.getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  const dateLabel = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });

  // Les actions du quotidien, dans l'ordre où on s'en sert.
  const actions = [
    {
      label: 'Réservations',
      text: pendingBookings.length > 0 ? `${pendingBookings.length} demande${pendingBookings.length > 1 ? 's' : ''} en attente` : `${todayBookings.length} rdv aujourd’hui`,
      href: '/admin/reservations',
      icon: CalendarDays,
    },
    ...(flags.caisse ? [{ label: 'Encaisser', text: 'Nouvelle vente ou prestation', href: '/admin/caisse', icon: CreditCard }] : []),
    { label: 'Modifier une page', text: `${fmt(pageCount)} page${pageCount > 1 ? 's' : ''} sur le site`, href: '/admin/pages', icon: Layers },
    ...(flags.blog ? [{ label: 'Rédiger un article', text: `${fmt(articles)} publié${articles > 1 ? 's' : ''}`, href: '/admin/blog/new', icon: FileText }] : []),
  ];

  const stats = [
    { label: "Visites aujourd'hui", value: today },
    { label: '7 derniers jours', value: week },
    { label: 'Ce mois-ci', value: month },
    { label: 'Abonnés actifs', value: subscribers },
    ...(flags.blog ? [{ label: 'Articles publiés', value: articles }] : []),
  ];

  return (
    <div className="space-y-10 animate-fadein">
      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[14px] font-medium text-stone-600 first-letter:uppercase">{dateLabel}</p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight text-stone-950 leading-tight">
            {greeting}
          </h1>
          <p className="mt-2 text-[16px] text-stone-700">Voici l’essentiel d’Emmanuelle Esthétique aujourd’hui.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reservations"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-stone-900 text-[14px] font-semibold text-white hover:bg-stone-800 transition-colors shadow-xs"
          >
            <CalendarCheck size={16} /> Planning complet
          </Link>
          <a
            href={SITE_CONFIG.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-stone-100 text-[14px] font-semibold text-stone-900 hover:bg-stone-200 transition-colors"
          >
            Voir le site <ArrowUpRight size={16} />
          </a>
        </div>
      </header>

      {/* ── SECTION PRIORITAIRE : RENDEZ-VOUS DU JOUR & DEMANDES EN ATTENTE ── */}
      <section aria-labelledby="reservations-priority-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 id="reservations-priority-title" className="text-xl font-bold tracking-tight text-stone-950">
              Activité Cabine & Réservations
            </h2>
            {pendingBookings.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {pendingBookings.length} demande{pendingBookings.length > 1 ? 's' : ''} à confirmer
              </span>
            )}
          </div>
          <Link
            href="/admin/reservations"
            className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
          >
            Gérer toutes les réservations <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARTE 1 : RENDEZ-VOUS DU JOUR */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Rendez-vous du jour</h3>
                    <p className="text-xs text-stone-500 capitalize">{dateLabel}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full">
                  {todayBookings.length} rdv prévu{todayBookings.length > 1 ? 's' : ''}
                </span>
              </div>

              {bookingsLoading ? (
                <div className="py-8 text-center text-xs text-stone-400">Chargement de votre planning...</div>
              ) : todayBookings.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <p className="text-sm font-medium text-stone-700">Aucun rendez-vous prévu aujourd'hui</p>
                  <p className="text-xs text-stone-400 font-light">Votre cabine est libre pour des soins impromptus ou la préparation des produits.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayBookings.map((b) => {
                    const cleanPhone = b.telephone.replace(/[^\d]/g, '');
                    const waMsg = encodeURIComponent(`Bonjour ${b.prenom}, c'est Emmanuelle au sujet de votre rendez-vous aujourd'hui à ${b.heure_rdv}.`);
                    return (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-xl border border-stone-100 bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-[#183B36] text-white px-2 py-0.5 rounded">
                              {b.heure_rdv}
                            </span>
                            <span className="text-sm font-semibold text-stone-900">
                              {b.prenom} {b.nom}
                            </span>
                            <span className="text-xs text-stone-500">
                              (CHF {b.service_prix_chf})
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 font-light">
                            {b.service_nom} · {b.service_duree_minutes} min
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`tel:${b.telephone.replace(/\s+/g, '')}`}
                            className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs transition-colors"
                            title="Appeler"
                          >
                            <Phone size={14} />
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                          {b.statut === 'confirme' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateBookingStatus(b.id, 'termine')}
                              className="px-2.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors"
                            >
                              Terminer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CARTE 2 : DEMANDES DE RÉSERVATION À CONFIRMER */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Demandes à confirmer</h3>
                    <p className="text-xs text-stone-500">Clientes ayant réservé en ligne</p>
                  </div>
                </div>
                {pendingBookings.length > 0 && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                    {pendingBookings.length} en attente
                  </span>
                )}
              </div>

              {bookingsLoading ? (
                <div className="py-8 text-center text-xs text-stone-400">Vérification des demandes...</div>
              ) : pendingBookings.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-medium text-stone-700">Aucune demande en attente</p>
                  <p className="text-xs text-stone-400 font-light">Toutes les réservations en ligne ont été confirmées.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookings.slice(0, 3).map((b) => {
                    const cleanPhone = b.telephone.replace(/[^\d]/g, '');
                    const formattedDateShort = new Date(`${b.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });
                    const waMsg = encodeURIComponent(`Bonjour ${b.prenom}, c'est Emmanuelle d'Emmanuelle Esthétique au sujet de votre demande de rdv pour le ${b.date_rdv} à ${b.heure_rdv}.`);

                    return (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900 capitalize">
                              {formattedDateShort} à {b.heure_rdv}
                            </span>
                            <span className="text-sm font-semibold text-stone-900">
                              {b.prenom} {b.nom}
                            </span>
                          </div>
                          <p className="text-xs text-stone-600">
                            {b.service_nom} · CHF {b.service_prix_chf}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${b.telephone.replace(/\s+/g, '')}`}
                            className="p-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs"
                            title="Appeler"
                          >
                            <Phone size={14} />
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20"
                            title="WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(b.id, 'confirme')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                            title="Confirmer la réservation"
                          >
                            <Check size={14} /> Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Refuser/annuler la demande de ${b.prenom} ${b.nom} ?`)) {
                                handleUpdateBookingStatus(b.id, 'annule');
                              }
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            title="Replanifier ou annuler"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingBookings.length > 3 && (
                    <Link
                      href="/admin/reservations"
                      className="block text-center text-xs font-semibold text-accent hover:underline py-1"
                    >
                      + {pendingBookings.length - 3} autre(s) demande(s) à confirmer
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Actions principales */}
      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="sr-only">Actions principales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={`group flex items-center gap-4 rounded-xl p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 ${
                i === 0
                  ? 'bg-accent text-accent-fg hover:bg-accent-hover'
                  : 'bg-white border border-stone-200 hover:border-stone-400'
              }`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-lg ${
                  i === 0 ? 'bg-white/15' : 'bg-accent-soft text-accent'
                }`}
              >
                <a.icon size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[16px] font-semibold ${i === 0 ? '' : 'text-stone-950'}`}>{a.label}</span>
                <span className={`block truncate text-[14px] ${i === 0 ? 'opacity-85' : 'text-stone-600'}`}>
                  {loading && i !== 0 ? '…' : a.text}
                </span>
              </span>
              <ArrowRight
                size={18}
                className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${i === 0 ? 'opacity-80' : 'text-stone-500 group-hover:text-stone-900'}`}
              />
            </Link>
          ))}
        </div>
      </section>

      <AdminOnboardingWizard
        hasBusinessInfo={hasBusinessInfo}
        pageCount={pageCount}
        articleCount={articles}
        siteName={siteName}
      />

      {/* Chiffres clés */}
      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="text-[18px] font-semibold text-stone-950 mb-4">Activité</h2>
        <dl className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {stats.map((s) => (
            <div key={s.label} className="flex-1 basis-40 bg-white px-6 py-5">
              <dt className="text-[14px] font-medium text-stone-600">{s.label}</dt>
              <dd className="mt-1.5 text-[30px] font-semibold tracking-tight text-stone-950 tabular-nums">
                {loading ? <span className="inline-block h-8 w-16 rounded-md bg-stone-100 animate-pulse align-middle" /> : fmt(s.value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Fréquentation et pages vues */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <h2 className="text-[18px] font-semibold text-stone-950">Fréquentation sur 7 jours</h2>
            {week > 0 && <p className="text-[14px] text-stone-600 tabular-nums">{fmt(week)} visites</p>}
          </div>

          {loading ? (
            <div className="h-56 flex items-end gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex-1 bg-stone-100 rounded-md animate-pulse" style={{ height: `${30 + i * 8}%` }} />
              ))}
            </div>
          ) : week === 0 ? (
            <div className="h-56 grid place-items-center text-center">
              <div>
                <Eye size={24} strokeWidth={1.5} className="mx-auto text-stone-400" />
                <p className="mt-2 text-[14px] text-stone-600">Aucune visite enregistrée pour l’instant.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-3 sm:gap-5 h-56">
              {days.map((d, i) => {
                const h = Math.max((d.count / maxDay) * 100, d.count > 0 ? 4 : 0);
                const isLast = i === days.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <span className="text-[12px] font-medium text-stone-700 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                    <div
                      className={`w-full max-w-14 rounded-md transition-colors ${isLast ? 'bg-accent' : 'bg-accent/15 group-hover:bg-accent/30'}`}
                      style={{ height: `${h}%` }}
                      title={`${d.date} : ${d.count} visite${d.count > 1 ? 's' : ''}`}
                    />
                    <span className="text-[13px] font-medium text-stone-600 whitespace-nowrap">{d.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h2 className="text-[18px] font-semibold text-stone-950">Pages les plus vues</h2>
            <Link href="/admin/analytics" className="text-[14px] font-semibold text-accent hover:underline underline-offset-4">Détails</Link>
          </div>

          {loading ? (
            <div className="space-y-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-stone-100 rounded animate-pulse w-3/4" />
                  <div className="h-1.5 bg-stone-100 rounded-full animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                </div>
              ))}
            </div>
          ) : topPages.length === 0 ? (
            <p className="text-[14px] text-stone-600 py-8 text-center">Aucune donnée ce mois-ci.</p>
          ) : (
            <ul className="space-y-5">
              {topPages.map((p, i) => {
                const pct = Math.round((p.count / (topPages[0]?.count || 1)) * 100);
                return (
                  <li key={i}>
                    <div className="flex items-baseline justify-between gap-3 mb-2 text-[14px]">
                      <span className="text-stone-900 font-medium truncate">{label(p.page)}</span>
                      <span className="font-medium text-stone-900 tabular-nums">{fmt(p.count)}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent/70 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
