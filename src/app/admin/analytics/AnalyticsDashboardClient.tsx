'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, MousePointerClick, Users, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';
import type { AnalyticsSummary } from '../../../services/analytics';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import { Button, Callout, Card, CardHeader, EmptyState, PageHeader, Spinner } from '../../../components/admin/ui';

/**
 * Page « Statistiques » : tout ce qui mesure le site, rassemblé ici plutôt que
 * sur le tableau de bord. Deux sources indépendantes, qui chargent et échouent
 * chacune de leur côté :
 *  - la fréquentation (`/api/admin-stats`, table `page_views`) ;
 *  - le comportement des visiteurs (`/api/admin/analytics-summary` : clics, demandes).
 */

interface VisitStats {
  today: number;
  week: number;
  month: number;
  subscribers: number;
  articles: number;
  days: { date: string; count: number }[];
  topPages: { page: string; count: number }[];
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'Accueil',
  '/soins': 'La carte des soins',
  '/soins/visage': 'Soins du visage',
  '/soins/corps': 'Rituels et massages du corps',
  '/soins/mains-et-pieds': 'Mains et pieds',
  '/soins/regard': 'Beauté du regard',
  '/soins/epilation': 'Épilation',
  '/phytomer': 'La cosmétique marine Phytomer',
  '/a-propos': 'À propos',
  '/contact': 'Contact',
  '/bon-cadeau': 'Bon cadeau',
  '/reservation': 'Réservation en ligne',
  '/blog': 'Blog',
  '/mentions-legales': 'Mentions légales',
};

function pageLabel(page: string) {
  if (PAGE_LABELS[page]) return PAGE_LABELS[page];
  if (page.startsWith('/blog/')) return `Article : ${page.replace('/blog/', '')}`;
  return page;
}

const fmt = (n: number) => n.toLocaleString('fr-CH');

async function authHeaders(): Promise<Record<string, string> | null> {
  const { supabase } = await import('../../../services/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
}

export default function AnalyticsDashboardClient() {
  const flags = useModuleFlags();

  const [visits, setVisits] = useState<VisitStats | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState<string | null>(null);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVisits = async () => {
    setVisitsLoading(true);
    setVisitsError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setVisitsError('Votre session a expiré. Reconnectez-vous puis rouvrez cette page.');
        return;
      }
      const res = await fetch('/api/admin-stats', { headers, cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error(json?.error || `le serveur a répondu ${res.status}`);
      setVisits({
        today: Number(json.today ?? 0),
        week: Number(json.week ?? 0),
        month: Number(json.month ?? 0),
        subscribers: Number(json.subscribers ?? 0),
        articles: Number(json.articles ?? 0),
        days: json.days ?? [],
        topPages: json.topPages ?? [],
      });
    } catch (e: any) {
      setVisitsError(`La fréquentation n'a pas pu être chargée (${e?.message || 'erreur inconnue'}).`);
    } finally {
      setVisitsLoading(false);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) {
        setError('Votre session a expiré. Reconnectez-vous puis rouvrez cette page.');
        return;
      }
      const res = await fetch('/api/admin/analytics-summary', { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `le serveur a répondu ${res.status}`);
      }
      setSummary(data.summary);
    } catch (e: any) {
      console.warn('Erreur chargement analytics:', e);
      setError(`Les statistiques n'ont pas pu être chargées (${e?.message || 'erreur inconnue'}). Réessayez dans un instant.`);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    loadVisits();
    loadSummary();
  };

  useEffect(() => {
    reload();
  }, []);

  const visitTiles = [
    { label: 'Visites aujourd’hui', value: visits?.today },
    { label: '7 derniers jours', value: visits?.week },
    { label: 'Ce mois-ci', value: visits?.month },
    { label: 'Abonnés actifs', value: visits?.subscribers, href: '/admin/subscribers' },
    ...(flags.blog ? [{ label: 'Articles publiés', value: visits?.articles, href: '/admin/blog' }] : []),
  ];

  const days = visits?.days ?? [];
  const maxDay = Math.max(...days.map((d) => d.count), 1);
  const topPages = visits?.topPages ?? [];

  const metrics = [
    {
      label: 'Pages consultées',
      value: summary ? fmt(summary.total_page_views) : '—',
      hint: 'Chaque ouverture d’une page compte une fois, même par la même personne.',
      icon: Eye,
    },
    {
      label: 'Clics sur vos boutons',
      value: summary ? fmt(summary.total_cta_clicks) : '—',
      hint: 'Clics sur les boutons d’action de vos pages (réservation, contact…).',
      icon: MousePointerClick,
    },
    {
      label: 'Demandes reçues',
      value: summary ? fmt(summary.total_form_submits) : '—',
      hint: 'Formulaires de contact envoyés depuis le site.',
      icon: Users,
    },
    {
      label: 'Taux de demande',
      value: summary ? `${summary.global_conversion_rate.toLocaleString('fr-CH')} %` : '—',
      hint: 'Demandes reçues rapportées aux pages consultées.',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Statistiques"
        description="La fréquentation de votre site et ce qu’y font les visiteurs : pages consultées, clics sur vos boutons, demandes de contact."
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading || visitsLoading} onClick={reload}>
            Actualiser
          </Button>
        }
      />

      {/* ── Fréquentation ── */}
      <section aria-labelledby="visits-title" className="space-y-5">
        <h2 id="visits-title" className="text-[18px] font-semibold text-stone-950">Fréquentation</h2>

        {visitsError && (
          <Callout tone="danger" title="Chargement impossible" actions={<Button size="sm" onClick={loadVisits}>Réessayer</Button>}>
            {visitsError}
          </Callout>
        )}

        <dl className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
          {visitTiles.map((s) => (
            <div key={s.label} className="flex-1 basis-40 bg-white px-6 py-5">
              <dt className="text-[14px] font-medium text-stone-600">
                {'href' in s && s.href ? (
                  <Link href={s.href} className="hover:text-stone-900 hover:underline underline-offset-4">{s.label}</Link>
                ) : s.label}
              </dt>
              <dd className="mt-1.5 text-[30px] font-semibold tracking-tight text-stone-950 tabular-nums">
                {visitsLoading && !visits ? (
                  <span className="inline-block h-8 w-16 rounded-md bg-stone-100 animate-pulse align-middle" />
                ) : s.value === undefined ? '—' : fmt(s.value)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4 mb-8">
              <h3 className="text-[16px] font-semibold text-stone-950">Visites sur 7 jours</h3>
              {visits && visits.week > 0 && <p className="text-[14px] text-stone-600 tabular-nums">{fmt(visits.week)} visites</p>}
            </div>

            {visitsLoading && !visits ? (
              <div className="h-56 flex items-end gap-4">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex-1 bg-stone-100 rounded-md animate-pulse" style={{ height: `${30 + i * 8}%` }} />
                ))}
              </div>
            ) : !visits || visits.week === 0 ? (
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
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
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
          </Card>

          <Card className="p-6 sm:p-8">
            <h3 className="text-[16px] font-semibold text-stone-950 mb-6">Pages les plus vues ce mois</h3>
            {visitsLoading && !visits ? (
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
                {topPages.map((p) => {
                  const pct = Math.round((p.count / (topPages[0]?.count || 1)) * 100);
                  return (
                    <li key={p.page}>
                      <div className="flex items-baseline justify-between gap-3 mb-2 text-[14px]">
                        <span className="text-stone-900 font-medium truncate">{pageLabel(p.page)}</span>
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
          </Card>
        </div>
      </section>

      {/* ── Comportement des visiteurs ── */}
      <section aria-labelledby="behaviour-title" className="space-y-5">
        <div>
          <h2 id="behaviour-title" className="text-[18px] font-semibold text-stone-950">Clics et demandes</h2>
          <p className="mt-1 text-[14px] text-stone-600">Sur les 1 000 derniers événements enregistrés.</p>
        </div>

        {error && <Callout tone="danger" title="Chargement impossible">{error}</Callout>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m) => (
            <Card key={m.label} className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-stone-700">{m.label}</span>
                <m.icon size={18} className="text-stone-500 shrink-0" aria-hidden="true" />
              </div>
              <div className="text-3xl font-semibold text-stone-950 tabular-nums">
                {loading && !summary ? <span className="text-stone-500">…</span> : m.value}
              </div>
              <p className="text-[13px] leading-snug text-stone-600">{m.hint}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="Détail par page" description="Classé de la page la plus consultée à la moins consultée." />
          {loading && !summary ? (
            <div className="px-6"><Spinner label="Chargement des statistiques…" /></div>
          ) : summary && summary.top_pages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] text-stone-700">
                <thead className="bg-stone-50 border-b border-stone-200 text-[13px] font-semibold text-stone-700">
                  <tr>
                    <th scope="col" className="py-3 px-6">Page</th>
                    <th scope="col" className="py-3 px-4 text-right">Consultations</th>
                    <th scope="col" className="py-3 px-4 text-right">Clics</th>
                    <th scope="col" className="py-3 px-4 text-right">Demandes</th>
                    <th scope="col" className="py-3 px-6 text-right">Taux de demande</th>
                  </tr>
                </thead>
                <tbody className="zebra">
                  {summary.top_pages.map((p) => (
                    <tr key={p.slug} className="transition-colors hover:bg-row-hover">
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-stone-900">{p.title}</div>
                        <div className="text-[13px] text-stone-600">/{p.slug === 'home' ? '' : p.slug.replace(/^\//, '')}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums">{fmt(p.views)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums">{fmt(p.cta_clicks)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-stone-900">{fmt(p.submits)}</td>
                      <td className="py-3.5 px-6 text-right tabular-nums font-semibold text-stone-900">
                        {p.conversion_rate.toLocaleString('fr-CH')} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !error ? (
            <div className="p-6">
              <EmptyState
                icon={BarChart3}
                title="Aucune visite enregistrée pour l'instant"
                description="Les chiffres apparaîtront ici dès que des personnes consulteront vos pages publiées."
              />
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
