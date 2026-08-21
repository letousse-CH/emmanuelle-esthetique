"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Eye, FileText, Mail, TrendingUp, ExternalLink, ArrowUpRight } from 'lucide-react';
import { SITE_CONFIG } from '../../config/site';

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
  const [days, setDays]               = useState<DayCount[]>([]);
  const [topPages, setTopPages]       = useState<PageStat[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-stats', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">{greeting}</p>
          <h1 className="text-2xl font-semibold text-stone-900">Tableau de bord</h1>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-[12.5px] text-stone-500 mt-1">
            <div className="w-3.5 h-3.5 rounded-full border border-stone-200 border-t-sage animate-spin" />
            Mise à jour…
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={Eye}        label="Aujourd'hui"      value={fmt(today)}       accent="sage"  loading={loading} />
        <Kpi icon={TrendingUp} label="7 derniers jours" value={fmt(week)}        accent="sage"  loading={loading} />
        <Kpi icon={Eye}        label="Ce mois"          value={fmt(month)}       accent="sage"  loading={loading} />
        <Kpi icon={Mail}       label="Abonnés actifs"   value={fmt(subscribers)} accent="blue"  loading={loading} />
        <Kpi icon={FileText}   label="Articles publiés" value={fmt(articles)}    accent="amber" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-3 bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[13px] font-medium text-stone-800">Visites — 7 derniers jours</h2>
            {week > 0 && <span className="text-[12.5px] text-stone-500 font-medium">{fmt(week)} total</span>}
          </div>
          {loading ? (
            <div className="h-44 flex items-end gap-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex-1 bg-stone-100 rounded-t animate-pulse" style={{ height: `${30 + i * 8}%` }} />
              ))}
            </div>
          ) : week === 0 ? (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-stone-600">Aucune visite encore enregistrée</p>
            </div>
          ) : (
            <div className="flex items-end gap-2 h-44">
              {days.map((d, i) => {
                const h = Math.max((d.count / maxDay) * 100, d.count > 0 ? 5 : 0);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    {d.count > 0 && <span className="text-[12px] font-semibold text-stone-500 group-hover:text-stone-700">{d.count}</span>}
                    <div className="w-full rounded-t-md bg-sage/25 group-hover:bg-sage/50 transition-colors duration-150" style={{ height: `${h}%` }} />
                    <span className="text-[12px] text-stone-500 whitespace-nowrap">{d.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top pages */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6">
          <h2 className="text-[13px] font-medium text-stone-800 mb-6">Pages populaires — ce mois</h2>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-stone-100 rounded animate-pulse w-3/4" />
                  <div className="h-1.5 bg-stone-100 rounded-full animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                </div>
              ))}
            </div>
          ) : topPages.length === 0 ? (
            <p className="text-sm text-stone-600">Aucune donnée disponible</p>
          ) : (
            <ul className="space-y-4">
              {topPages.map((p, i) => {
                const pct = Math.round((p.count / (topPages[0]?.count || 1)) * 100);
                return (
                  <li key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-stone-700 font-medium truncate max-w-[65%]">{label(p.page)}</span>
                      <span className="text-xs font-semibold text-stone-500 shrink-0">{fmt(p.count)}</span>
                    </div>
                    <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sage/40 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Nouvel article', href: '/admin/blog/new', icon: FileText },
          { label: 'Gérer les pages', href: '/admin/pages', icon: ExternalLink },
          { label: 'Envoyer newsletter', href: '/admin/newsletter', icon: Mail },
          { label: 'Voir le site', href: SITE_CONFIG.url, icon: ArrowUpRight, external: true },
        ].map((a) => (
          <a
            key={a.label}
            href={a.href}
            target={a.external ? '_blank' : undefined}
            rel={a.external ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-2.5 bg-white hover:bg-stone-50 border border-stone-100 rounded-xl px-4 py-3.5 text-sm text-stone-500 hover:text-stone-800 shadow-sm transition-all cursor-pointer group"
          >
            <a.icon size={14} className="shrink-0 text-stone-500 group-hover:text-stone-900 transition-colors" />
            <span className="truncate">{a.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent, loading }: {
  icon: React.ElementType; label: string; value: string; accent: 'sage' | 'blue' | 'amber'; loading?: boolean;
}) {
  const cls = { sage: 'text-sage bg-sage/10', blue: 'text-blue-500 bg-blue-50', amber: 'text-amber-500 bg-amber-50' };
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 space-y-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cls[accent]}`}><Icon size={15} /></div>
      <div>
        <p className="text-[12.5px] text-stone-500 font-medium mb-1">{label}</p>
        {loading ? <div className="h-7 w-16 bg-stone-100 rounded animate-pulse" /> : <p className="text-2xl font-semibold text-stone-900 tabular-nums">{value}</p>}
      </div>
    </div>
  );
}
