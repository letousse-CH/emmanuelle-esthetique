"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import Link from 'next/link';
import { Eye, FileText, Mail, Layers, ArrowUpRight, ArrowRight, CreditCard, Send, CalendarDays } from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';
import { SITE_CONFIG } from '../../config/site';
import AdminOnboardingWizard from '../../components/admin/AdminOnboardingWizard';

interface DayCount { date: string; count: number }
interface PageStat  { page: string; count: number }

const PAGE_LABELS: Record<string, string> = {
  '/':                    'Accueil',
  '/about':               'Mon Approche',
  '/blog':                'Blog',
  '/contact':             'Contact',
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

  const flags = useModuleFlags();

  useEffect(() => { load(); }, []);

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
    ...(flags.caisse ? [{ label: 'Encaisser', text: 'Nouvelle vente ou prestation', href: '/admin/caisse', icon: CreditCard }] : []),
    { label: 'Modifier une page', text: `${fmt(pageCount)} page${pageCount > 1 ? 's' : ''} sur le site`, href: '/admin/pages', icon: Layers },
    ...(flags.blog ? [{ label: 'Rédiger un article', text: `${fmt(articles)} publié${articles > 1 ? 's' : ''}`, href: '/admin/blog/new', icon: FileText }] : []),
    ...(flags.events ? [{ label: 'Créer un événement', text: 'Atelier, date, inscriptions', href: '/admin/events/new', icon: CalendarDays }] : []),
    ...(flags.newsletter ? [{ label: 'Envoyer la newsletter', text: `${fmt(subscribers)} abonné${subscribers > 1 ? 's' : ''}`, href: '/admin/newsletter', icon: Send }] : []),
  ].slice(0, 4);

  const stats = [
    { label: "Visites aujourd'hui", value: today },
    { label: '7 derniers jours', value: week },
    { label: 'Ce mois-ci', value: month },
    { label: 'Abonnés actifs', value: subscribers },
    ...(flags.blog ? [{ label: 'Articles publiés', value: articles }] : []),
  ];

  return (
    <div className="space-y-12 animate-fadein">
      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[14px] font-medium text-stone-600 first-letter:uppercase">{dateLabel}</p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight text-stone-950 leading-tight">
            {greeting}
          </h1>
          <p className="mt-2 text-[16px] text-stone-700">Voici l’essentiel de {siteName || 'votre site'} aujourd’hui.</p>
        </div>
        <a
          href={SITE_CONFIG.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-stone-100 text-[14px] font-semibold text-stone-900 hover:bg-stone-200 transition-colors"
        >
          Voir le site <ArrowUpRight size={16} />
        </a>
      </header>

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
