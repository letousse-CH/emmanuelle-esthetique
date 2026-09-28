'use client';

import React, { useState, useEffect } from 'react';
import { Eye, MousePointerClick, Users, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';
import type { AnalyticsSummary } from '../../../services/analytics';
import { Button, Callout, Card, CardHeader, EmptyState, PageHeader, Spinner } from '../../../components/admin/ui';

export default function AnalyticsDashboardClient() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const { supabase } = await import('../../../services/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Votre session a expiré. Reconnectez-vous puis rouvrez cette page.');
        return;
      }
      const res = await fetch('/api/admin/analytics-summary', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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

  useEffect(() => {
    loadSummary();
  }, []);

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  const metrics = [
    {
      label: 'Pages consultées',
      value: summary ? fmt(summary.total_page_views) : '—',
      hint: 'Chaque ouverture d\u2019une page compte une fois, même par la même personne.',
      icon: Eye,
    },
    {
      label: 'Clics sur vos boutons',
      value: summary ? fmt(summary.total_cta_clicks) : '—',
      hint: 'Clics sur les boutons d\u2019action de vos pages (réservation, contact…).',
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
      value: summary ? `${summary.global_conversion_rate.toLocaleString('fr-FR')} %` : '—',
      hint: 'Demandes reçues rapportées aux pages consultées.',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Statistiques"
        description="Ce que font les visiteurs sur votre site : pages consultées, clics sur vos boutons et demandes de contact. Les chiffres portent sur les 1 000 derniers événements enregistrés."
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={loadSummary}>
            Actualiser
          </Button>
        }
      />

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
              <tbody className="divide-y divide-stone-200">
                {summary.top_pages.map((p) => (
                  <tr key={p.slug} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-stone-900">{p.title}</div>
                      <div className="text-[13px] text-stone-600">/{p.slug === 'home' ? '' : p.slug.replace(/^\//, '')}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums">{fmt(p.views)}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums">{fmt(p.cta_clicks)}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-stone-900">{fmt(p.submits)}</td>
                    <td className="py-3.5 px-6 text-right tabular-nums font-semibold text-stone-900">
                      {p.conversion_rate.toLocaleString('fr-FR')} %
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
    </div>
  );
}
