'use client';

import React, { useState, useEffect } from 'react';
import { Eye, MousePointerClick, Users, TrendingUp, RefreshCw, Layers, ArrowUpRight } from 'lucide-react';
import type { AnalyticsSummary } from '../../../services/analytics';

export default function AnalyticsDashboardClient() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../../services/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin/analytics-summary', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (e) {
      console.warn('Erreur chargement analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs">
        <div>
          <span className="px-3 py-1 rounded-full bg-purple-100/80 text-purple-900 border border-purple-200 text-[10.5px] font-extrabold uppercase tracking-wider">Statistiques & Performance</span>
          <div className="flex items-center gap-2.5 mt-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
              <TrendingUp size={22} />
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              Tableau de Bord & Conversions
            </h1>
          </div>
          <p className="text-zinc-600 text-xs sm:text-sm font-medium mt-1">
            Suivi en temps réel de vos visiteurs, clics sur vos boutons d'action et nouveaux prospects générés.
          </p>
        </div>

        <button
          onClick={loadSummary}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold rounded-full shadow-[0_4px_14px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Rafraîchir</span>
        </button>
      </div>

      {/* 4 Cards de Métriques Clés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 : Vues Totales */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Vues de Pages</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Eye size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-stone-900">
            {summary ? summary.total_page_views.toLocaleString('fr-FR') : '—'}
          </div>
          <p className="text-[11px] text-stone-600 font-medium">Visiteurs uniques & consultations</p>
        </div>

        {/* Card 2 : Clics CTA */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Clics Boutons</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <MousePointerClick size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-stone-900">
            {summary ? summary.total_cta_clicks.toLocaleString('fr-FR') : '—'}
          </div>
          <p className="text-[11px] text-stone-600 font-medium">Interactions sur les appels à l'action</p>
        </div>

        {/* Card 3 : Prospects / Formulaires */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Prospects Générés</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-stone-900">
            {summary ? summary.total_form_submits.toLocaleString('fr-FR') : '—'}
          </div>
          <p className="text-[11px] text-stone-600 font-medium">Demandes de contact reçues</p>
        </div>

        {/* Card 4 : Taux de Conversion Globale */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Taux de Conversion</span>
            <div className="p-2 bg-white/20 text-white rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-3xl font-black">
            {summary ? `${summary.global_conversion_rate} %` : '—'}
          </div>
          <p className="text-[11px] text-emerald-100 font-medium">Part des visiteurs devenus prospects</p>
        </div>
      </div>

      {/* Détail par Landing Page */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
            <Layers size={18} className="text-emerald-600" />
            Performance des Landing Pages
          </h3>
          <span className="text-xs text-stone-600 font-medium">Classé par trafic</span>
        </div>

        {summary && summary.top_pages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 text-stone-700 font-bold uppercase tracking-wider border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Page / Slug</th>
                  <th className="py-3 px-4">Vues</th>
                  <th className="py-3 px-4">Clics CTA</th>
                  <th className="py-3 px-4">Prospects</th>
                  <th className="py-3 px-4 text-right">Taux de conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {summary.top_pages.map((p, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-stone-900 flex items-center gap-1.5">
                      <span>{p.title}</span>
                      <span className="text-[11px] text-stone-500 font-mono">({p.slug})</span>
                    </td>
                    <td className="py-3.5 px-4">{p.views}</td>
                    <td className="py-3.5 px-4">{p.cta_clicks}</td>
                    <td className="py-3.5 px-4 text-emerald-600 font-bold">{p.submits}</td>
                    <td className="py-3.5 px-4 text-right font-black text-stone-900">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                        {p.conversion_rate} % <ArrowUpRight size={11} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-stone-600 space-y-1">
            <p className="font-semibold text-stone-600">Aucune donnée de page enregistrée pour l'instant.</p>
            <p>Visitez vos pages publiées pour voir les statistiques s'afficher en direct.</p>
          </div>
        )}
      </div>
    </div>
  );
}
