"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Rocket, Sparkles, CheckCircle2, Loader2, Calendar,
  ShieldCheck, RefreshCw, BarChart2, Zap, Clock, Power, Play
} from 'lucide-react';
import { PageHeader, Card, CardBody, Badge } from '../../../components/admin/ui';
import { supabase } from '../../../services/supabase';

export default function AutopilotClient() {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<'weekly_1' | 'weekly_2' | 'monthly_1'>('weekly_1');
  const [mode, setMode] = useState<'autonomous' | 'review_required'>('autonomous');
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [nextRunAt, setNextRunAt] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recentArticles, setRecentArticles] = useState<any[]>([]);

  useEffect(() => {
    loadAutopilotStatus();
    loadRecentPublishedArticles();
  }, []);

  const loadAutopilotStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const res = await fetch('/api/admin/autopilot', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled ?? true);
        setFrequency(data.frequency || 'weekly_1');
        setMode(data.mode || 'autonomous');
        setLastRunAt(data.lastRunAt || null);
        setNextRunAt(data.nextRunAt || null);
      }
    } catch (e) {
      console.warn('[Autopilot] Load status error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentPublishedArticles = async () => {
    const { data } = await supabase
      .from('articles')
      .select('id, title, slug, created_at, cover_image')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentArticles(data || []);
  };

  const handleSaveSettings = async (newEnabled?: boolean, newFreq?: string, newMode?: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headersMap: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headersMap['Authorization'] = `Bearer ${session.access_token}`;
      }

      const payload = {
        enabled: newEnabled !== undefined ? newEnabled : enabled,
        frequency: newFreq || frequency,
        mode: newMode || mode,
      };

      const res = await fetch('/api/admin/autopilot', {
        method: 'POST',
        headers: headersMap,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setEnabled(data.config.enabled);
          setFrequency(data.config.frequency);
          setMode(data.config.mode);
          setNextRunAt(data.config.nextRunAt);
        }
        setFeedback('✅ Réglages du Pilote Automatique enregistrés !');
      }
    } catch (e: any) {
      setFeedback(`Erreur : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    setFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headersMap: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headersMap['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/autopilot', {
        method: 'POST',
        headers: headersMap,
        body: JSON.stringify({ action: 'trigger_now' }),
      });

      const data = await res.json();
      if (data.ok) {
        setFeedback(`🎉 Cycle exécuté avec succès ! Article créé : "${data.articleTitle}"`);
        loadRecentPublishedArticles();
        loadAutopilotStatus();
      } else {
        setFeedback(`Erreur : ${data.error || 'Erreur lors de l\'exécution'}`);
      }
    } catch (e: any) {
      setFeedback(`Erreur : ${e.message}`);
    } finally {
      setRunningNow(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      {/* ── PageHeader ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Pilote Automatique (Set & Forget)"
        description="Définissez vos règles une seule fois : l'IA gère la recherche d'idées, la rédaction d'articles SEO et la publication sur vos réseaux en autonomie totale."
        actions={
          <Link
            href="/admin/seo"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-800 hover:bg-stone-50 transition-colors shadow-xs"
          >
            <BarChart2 size={15} />
            <span>Hub Mots-clés SEO</span>
          </Link>
        }
      />

      {/* ── 🟢 INTERRUPTEUR PRINCIPAL DU PILOTE AUTOMATIQUE ──────────────── */}
      <Card className={`border-2 transition-all overflow-hidden shadow-xl ${
        enabled
          ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60'
          : 'border-stone-200 bg-stone-50'
      }`}>
        <CardBody className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shrink-0 transition-all ${
                enabled ? 'bg-emerald-600 text-white shadow-emerald-600/30' : 'bg-stone-300 text-stone-600'
              }`}>
                {enabled ? '🟢' : '⏸️'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {enabled ? 'Pilote Automatique Actif' : 'Pilote Automatique en Pause'}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-stone-900 mt-1">
                  {enabled ? 'Publication Récurrente Automatique' : 'Activez pour déléguer à l\'IA'}
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  {enabled
                    ? 'L\'IA recherche vos mots-clés, rédige vos articles longs et publie sur vos réseaux.'
                    : 'Le système est en attente. Activez pour relancer la publication automatique.'}
                </p>
              </div>
            </div>

            {/* Switch On/Off */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const val = !enabled;
                  setEnabled(val);
                  handleSaveSettings(val);
                }}
                className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled ? 'bg-emerald-600' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    enabled ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Statut de Prochaine Exécution */}
          {enabled && (
            <div className="p-4 bg-white/90 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-900">
                <Clock size={16} className="text-emerald-600" />
                <span>Prochaine publication programmée :</span>
                <span className="text-emerald-700 font-extrabold">
                  {nextRunAt ? new Date(nextRunAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Sous 7 jours'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunNow}
                disabled={runningNow}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition-all shrink-0"
              >
                {runningNow ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="text-amber-400 fill-current" />}
                <span>{runningNow ? 'Génération en cours…' : '⚡ Forcer un cycle maintenant'}</span>
              </button>
            </div>
          )}

          {feedback && (
            <div className={`p-3.5 rounded-xl text-xs font-bold border ${
              feedback.includes('Erreur') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {feedback}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── ⚙️ PARAMÉTRAGE UNIQUE DU PILOTE AUTOMATIQUE ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rythme */}
        <Card>
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-extrabold text-sm">
              <Calendar size={18} className="text-emerald-600" />
              <h3>1. Rythme de Publication</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Définissez la fréquence à laquelle l'IA doit publier de nouveaux lots d'articles et posts sociaux.
            </p>

            <div className="space-y-2 pt-1">
              {[
                { id: 'weekly_1', label: '📅 1 Article + 3 Posts / semaine', desc: 'Rythme recommandé (tous les 7 jours)' },
                { id: 'weekly_2', label: '🚀 2 Articles + 6 Posts / semaine', desc: 'Accélération SEO (tous les 3 à 4 jours)' },
                { id: 'monthly_1', label: '🌱 1 Article + 3 Posts / mois', desc: 'Maintien d\'activité (chaque mois)' },
              ].map((item) => (
                <label
                  key={item.id}
                  onClick={() => {
                    setFrequency(item.id as any);
                    handleSaveSettings(enabled, item.id, mode);
                  }}
                  className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    frequency === item.id
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    checked={frequency === item.id}
                    onChange={() => {}}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-stone-900 block">{item.label}</span>
                    <span className="text-[11.5px] text-stone-500 block">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Mode d'autonomie */}
        <Card>
          <CardBody className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-stone-900 font-extrabold text-sm">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h3>2. Niveau d'Autonomie</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Choisissez si l'IA doit tout publier de manière autonome ou vous envoyer une alerte pour validation.
            </p>

            <div className="space-y-2 pt-1">
              {[
                {
                  id: 'autonomous',
                  label: '🟢 100% Autonome (Set & Forget)',
                  desc: 'L\'IA rédige, illustre et publie en direct sur le blog et les réseaux sans votre intervention.',
                },
                {
                  id: 'review_required',
                  label: '🟡 Validation en 1-Clic',
                  desc: 'L\'IA prépare le lot et vous envoie une notification pour valider d\'un simple clic.',
                },
              ].map((item) => (
                <label
                  key={item.id}
                  onClick={() => {
                    setMode(item.id as any);
                    handleSaveSettings(enabled, frequency, item.id);
                  }}
                  className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${
                    mode === item.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                      : 'border-stone-200 bg-white hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === item.id}
                    onChange={() => {}}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-stone-900 block">{item.label}</span>
                    <span className="text-[11.5px] text-stone-500 block">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── 🧠 GESTION DE LA SOURCED D'IDÉES & RECHARGE AUTOMATIQUE ───────── */}
      <Card>
        <CardBody className="p-6 space-y-3 bg-stone-900 text-white rounded-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              💡
            </div>
            <div>
              <h3 className="text-sm font-bold">Puisage & Recharge Automatique de Mots-clés</h3>
              <p className="text-xs text-stone-400">
                L'IA puise en priorité dans les opportunités créées sur le <Link href="/admin/seo" className="text-emerald-400 underline font-bold">Hub Mots-clés SEO</Link>.
                Lorsque la liste de sujets est entièrement consommée, l'IA relance automatiquement un scan SIO pour découvrir de nouvelles opportunités d'articles !
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── 📜 JOURNAL DES ARTICLES PUBLIÉS PAR L'AUTOPILOTE ───────────────── */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Zap size={16} className="text-amber-500" /> Articles & Contenus Publiés par le Pilote
            </h3>
            <Link href="/admin/blog" className="text-xs font-bold text-emerald-700 hover:underline">
              Voir tout le blog ➔
            </Link>
          </div>

          <div className="space-y-3">
            {recentArticles.length === 0 ? (
              <p className="text-xs text-stone-500 py-4 text-center">Aucun article publié pour le moment. Cliquez sur "Forcer un cycle" pour générer votre premier lot !</p>
            ) : (
              recentArticles.map((art) => (
                <div key={art.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 border border-stone-200 rounded-2xl hover:border-stone-300 transition-colors">
                  <div className="flex items-center gap-3">
                    {art.cover_image && (
                      <img src={art.cover_image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{art.title}</h4>
                      <p className="text-[11.5px] text-stone-500">
                        Publié le {new Date(art.created_at).toLocaleDateString('fr-FR')} · <code className="font-mono text-[11px] text-stone-600">/blog/{art.slug}</code>
                      </p>
                    </div>
                  </div>
                  <Badge tone="success">✓ Publié en Autonomie</Badge>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
