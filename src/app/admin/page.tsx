"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Eye, FileText, Mail, TrendingUp, ExternalLink, ArrowUpRight, Sparkles, CreditCard, Rocket, CheckCircle2 } from 'lucide-react';
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
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadein">
      {/* Welcome Banner Luminous 2026 */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-6 sm:p-8 border border-stone-200/80 shadow-xs">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 size-72 rounded-full bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-[12px] font-bold mb-1">
              <Sparkles size={13} className="text-amber-600" />
              <span>Studio Admin 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              {greeting}, bienvenue sur votre espace.
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Voici l'aperçu synthétique de l'activité de votre site et de vos performances.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs font-semibold text-stone-700">
              <span className="size-2 rounded-full bg-emerald-500 shadow-2xs shadow-emerald-500/50" />
              <span>Site actif & sécurisé</span>
            </div>
            <a
              href={SITE_CONFIG.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-all shadow-xs active:scale-95"
            >
              <span>Voir le site</span>
              <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </div>

      {/* Guide d'Installation Didactique Pas-à-Pas 1-2-3 */}
      <AdminOnboardingWizard
        hasBusinessInfo={hasBusinessInfo}
        pageCount={pageCount}
        articleCount={articles}
        siteName={siteName}
      />

      {/* KPIs Bento 2026 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Eye} label="Aujourd'hui" value={fmt(today)} tone="emerald" loading={loading} />
        <Kpi icon={TrendingUp} label="7 derniers jours" value={fmt(week)} tone="indigo" loading={loading} />
        <Kpi icon={Eye} label="Ce mois" value={fmt(month)} tone="sky" loading={loading} />
        <Kpi icon={Mail} label="Abonnés actifs" value={fmt(subscribers)} tone="rose" loading={loading} />
        <Kpi icon={FileText} label="Articles publiés" value={fmt(articles)} tone="amber" loading={loading} />
      </div>

      {/* Charts & Popular Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-3 bg-white border border-stone-200/80 rounded-3xl shadow-xs p-6 sm:p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">Fréquentation — 7 derniers jours</h2>
              <p className="text-xs text-stone-500 mt-0.5">Évolution quotidienne des visites enregistrées</p>
            </div>
            {week > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200/80">
                <CheckCircle2 size={13} />
                {fmt(week)} visites au total
              </span>
            )}
          </div>

          {loading ? (
            <div className="h-52 flex items-end gap-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex-1 bg-stone-100 rounded-t-xl animate-pulse" style={{ height: `${30 + i * 8}%` }} />
              ))}
            </div>
          ) : week === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center text-stone-400 space-y-2">
              <Eye size={28} className="text-stone-300" />
              <p className="text-sm font-medium">Aucune visite enregistrée pour le moment</p>
            </div>
          ) : (
            <div className="flex items-end gap-3 h-52 pt-4">
              {days.map((d, i) => {
                const h = Math.max((d.count / maxDay) * 100, d.count > 0 ? 8 : 0);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    {d.count > 0 && (
                      <span className="text-[12px] font-bold text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.count}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-stone-800 to-stone-700 group-hover:from-emerald-600 group-hover:to-emerald-500 transition-all duration-200 shadow-2xs"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[11px] font-semibold text-stone-500 whitespace-nowrap">{d.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top pages */}
        <div className="lg:col-span-2 bg-white border border-stone-200/80 rounded-3xl shadow-xs p-6 sm:p-7">
          <div className="mb-6">
            <h2 className="text-base font-bold text-stone-900 tracking-tight">Pages les plus vues</h2>
            <p className="text-xs text-stone-500 mt-0.5">Classement de la fréquentation ce mois-ci</p>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-stone-100 rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-stone-100 rounded-full animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                </div>
              ))}
            </div>
          ) : topPages.length === 0 ? (
            <p className="text-sm text-stone-400 py-8 text-center">Aucune donnée disponible</p>
          ) : (
            <ul className="space-y-4">
              {topPages.map((p, i) => {
                const pct = Math.round((p.count / (topPages[0]?.count || 1)) * 100);
                return (
                  <li key={i} className="group">
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-semibold text-stone-800 truncate max-w-[70%] group-hover:text-stone-900">
                        {label(p.page)}
                      </span>
                      <span className="font-bold text-stone-600 tabular-nums">{fmt(p.count)}</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-stone-800 to-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions Bar 2026 */}
      <div>
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Raccourcis rapides</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Rédiger un article', href: '/admin/blog/new', icon: FileText, tone: 'from-amber-500 to-orange-500' },
            { label: 'Modifier les pages', href: '/admin/pages', icon: ExternalLink, tone: 'from-indigo-500 to-purple-500' },
            { label: 'Envoyer newsletter', href: '/admin/newsletter', icon: Mail, tone: 'from-rose-500 to-pink-500' },
            { label: 'Pilote automatique', href: '/admin/autopilot', icon: Rocket, tone: 'from-emerald-500 to-teal-500' },
          ].map((a) => (
            <a
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 bg-white hover:bg-stone-50/80 border border-stone-200/80 rounded-2xl p-4 text-sm font-semibold text-stone-800 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${a.tone} text-white shadow-2xs group-hover:scale-105 transition-transform shrink-0`}>
                <a.icon size={16} />
              </div>
              <span className="truncate">{a.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'emerald' | 'indigo' | 'sky' | 'rose' | 'amber';
  loading?: boolean;
}) {
  const tones = {
    emerald: { bg: 'bg-emerald-50 border-emerald-100 text-emerald-700', iconBg: 'bg-emerald-500 text-white' },
    indigo: { bg: 'bg-indigo-50 border-indigo-100 text-indigo-700', iconBg: 'bg-indigo-500 text-white' },
    sky: { bg: 'bg-sky-50 border-sky-100 text-sky-700', iconBg: 'bg-sky-500 text-white' },
    rose: { bg: 'bg-rose-50 border-rose-100 text-rose-700', iconBg: 'bg-rose-500 text-white' },
    amber: { bg: 'bg-amber-50 border-amber-100 text-amber-700', iconBg: 'bg-amber-500 text-white' },
  };

  const currentTone = tones[tone];

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-2xl ${currentTone.iconBg} shadow-2xs`}>
          <Icon size={18} />
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${currentTone.bg}`}>
          Live
        </span>
      </div>
      <div>
        <p className="text-[12.5px] font-medium text-stone-500 mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-20 bg-stone-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-extrabold text-stone-900 tracking-tight tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

