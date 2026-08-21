"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Search, PenLine, ChevronDown, ChevronUp, ChevronRight,
  Target, TrendingUp, Lightbulb, BarChart2, BookOpen,
  Sparkles, Bookmark, BookmarkCheck, Trash2, Loader2,
  ScanLine, AlertTriangle, ArrowDownToLine, Layers, Save, Filter,
  Share2, X, Calendar, HelpCircle, Link2, MapPin, MessageSquareQuote, Users,
  Bot, MessageCircle, FileText, CheckCircle2, ArrowRight, ExternalLink,
  Check, Zap, Compass, Rocket, Play, Award, Star, Clock, ShieldCheck
} from 'lucide-react';
import {
  seoIdeas, CATEGORIES, CATEGORY_COLORS, CATEGORY_HINTS, CATEGORY_ICONS,
  SeoCategory, SeoIdea, Difficulty, Volume, FunnelLevel
} from '../../../data/seoIdeas';
import {
  Badge, Button, LinkButton, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  Field, Input, PageHeader, Select
} from '../../../components/admin/ui';
import { supabase } from '../../../services/supabase';
import SocialContentGenerator from '../../../components/admin/SocialContentGenerator';
import { useModuleFlags } from '../../../hooks/useModuleFlags';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface KeywordAnalysis {
  keyword: string;
  intent: 'informationnel' | 'transactionnel' | 'navigationnel';
  difficulty: 'faible' | 'moyen' | 'élevé';
  volume: 'faible' | 'moyen' | 'élevé';
  category: string;
  funnel_level?: FunnelLevel;
  opportunity: string;
  rel_bridge?: string;
  aiPrompts?: string[];
  communityQuestions?: string[];
  geoCitationTips?: string[];
  secondaryKeywords: string[];
  relatedQuestions: string[];
  suggestedTitle: string;
  suggestedSlug: string;
  suggestedIntro: string;
  contentTips: string[];
  cta: string;
  topSuggestions: string[];
}

interface ScanRecommendation {
  keyword: string;
  funnel_level: FunnelLevel;
  category: string;
  difficulty: 'faible' | 'moyen' | 'élevé';
  volume: 'faible' | 'moyen' | 'élevé';
  priority: number;
  opportunity: string;
  covered_by: string | null;
  suggested_title: string;
  suggested_slug: string;
  rel_bridge: string;
  ai_prompt_example?: string;
}

interface ScanResult {
  strategy_summary: string;
  coverage_gaps: string[];
  recommendations: ScanRecommendation[];
}

interface BrandSettings {
  site_activity_context: string;
  site_target_persona: string;
  site_brand_tone: string;
  site_blog_topics: string;
}

// ── Calcul de Score SEO / GEO Didactique ────────────────────────────────────

function calculateSeoGeoScore(priority: number, difficulty: string, volume: string): number {
  let base = 95 - (priority - 1) * 6;
  if (difficulty === 'faible') base += 3;
  if (difficulty === 'élevé') base -= 4;
  if (volume === 'élevé') base += 2;
  if (volume === 'faible') base -= 2;
  return Math.min(99, Math.max(72, base));
}

// ── Badges Didactiques ────────────────────────────────────────────────────────

const ScoreBadge = ({ score }: { score: number }) => {
  let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let label = 'Excellent potentel';
  if (score < 85) {
    colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    label = 'Fort potentiel';
  }
  if (score < 78) {
    colorClass = 'bg-sky-50 text-sky-800 border-sky-200';
    label = 'Bon potentiel';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${colorClass}`}>
      <Star size={13} className="fill-current shrink-0" />
      <span>Score SEO/GEO : {score}/100</span>
    </div>
  );
};

const DiffBadge = ({ v }: { v: string }) => {
  const toneMap: Record<string, 'success' | 'warning' | 'danger'> = {
    faible: 'success', moyen: 'warning', élevé: 'danger',
  };
  return <Badge tone={toneMap[v] ?? 'neutral'}>Diff. {v}</Badge>;
};

const VolBadge = ({ v }: { v: string }) => {
  const toneMap: Record<string, 'neutral' | 'info' | 'success'> = {
    faible: 'neutral', moyen: 'info', élevé: 'success',
  };
  return <Badge tone={toneMap[v] ?? 'neutral'}>Vol. {v}</Badge>;
};

const SimpleFunnelBadge = ({ level }: { level: FunnelLevel }) => {
  const config: Record<FunnelLevel, { label: string; tone: 'info' | 'warning' | 'success' }> = {
    découverte: { label: 'Attirer des curieux (SIO)', tone: 'info' },
    comparaison: { label: 'Convaincre les hésitants (GEO)', tone: 'warning' },
    conversion: { label: 'Obtenir un RDV / Client', tone: 'success' },
  };
  const c = config[level || 'découverte'];
  return <Badge tone={c.tone}>{c.label}</Badge>;
};

// ── Helpers Brief ─────────────────────────────────────────────────────────────

function analysisToSeoBrief(a: KeywordAnalysis): SeoIdea {
  return {
    id: `kw-${Date.now()}`,
    category: (a.category || 'Conseils') as SeoCategory,
    keyword: a.keyword,
    question: a.relatedQuestions?.[0] ?? a.suggestedTitle,
    difficulty: a.difficulty || 'moyen',
    volume: a.volume || 'moyen',
    intent: (a.intent || 'informationnel') as any,
    funnel_level: a.funnel_level || 'découverte',
    suggestedTitle: a.suggestedTitle,
    suggestedSlug: a.suggestedSlug,
    suggestedIntro: a.suggestedIntro,
    relatedQuestions: a.relatedQuestions || [],
    aiPrompts: a.aiPrompts || [],
    communityQuestions: a.communityQuestions || [],
    geoCitationTips: a.geoCitationTips || [],
    rel_bridge: a.rel_bridge || '',
    secondaryKeywords: a.secondaryKeywords || [],
    contentTips: a.contentTips || [],
    cta: a.cta || '',
    opportunity: a.opportunity || '',
  };
}

function scanRecToSeoBrief(r: ScanRecommendation): SeoIdea {
  return {
    id: `scan-${Date.now()}-${r.suggested_slug}`,
    category: (r.category || 'Conseils') as SeoCategory,
    keyword: r.keyword,
    question: r.suggested_title,
    difficulty: r.difficulty || 'moyen',
    volume: r.volume || 'moyen',
    intent: 'informationnel' as any,
    funnel_level: r.funnel_level || 'découverte',
    suggestedTitle: r.suggested_title,
    suggestedSlug: r.suggested_slug,
    suggestedIntro: r.rel_bridge,
    relatedQuestions: [],
    aiPrompts: r.ai_prompt_example ? [r.ai_prompt_example] : [],
    communityQuestions: [],
    geoCitationTips: [],
    rel_bridge: r.rel_bridge,
    secondaryKeywords: [],
    contentTips: [],
    cta: r.rel_bridge,
    opportunity: r.opportunity,
  };
}

function clusterToSeoBrief(cluster: any): SeoIdea {
  return {
    id: `kw-${cluster.id}`,
    category: (cluster.category ?? 'Conseils') as SeoCategory,
    keyword: cluster.focus_keyword,
    question: cluster.related_questions?.[0] ?? cluster.suggested_title ?? '',
    difficulty: cluster.seo_keywords?.difficulty_label ?? 'moyen',
    volume: cluster.seo_keywords?.volume_label ?? 'moyen',
    intent: (cluster.seo_keywords?.intent ?? 'informationnel') as any,
    funnel_level: cluster.funnel_level ?? 'découverte',
    suggestedTitle: cluster.suggested_title ?? '',
    suggestedSlug: cluster.suggested_slug ?? '',
    suggestedIntro: cluster.suggested_intro ?? '',
    relatedQuestions: cluster.related_questions ?? [],
    aiPrompts: cluster.ai_prompts ?? [],
    communityQuestions: cluster.community_questions ?? [],
    geoCitationTips: cluster.geo_citation_tips ?? [],
    rel_bridge: cluster.rel_bridge ?? cluster.cta ?? '',
    secondaryKeywords: cluster.secondary_keywords ?? [],
    contentTips: cluster.content_tips ?? [],
    cta: cluster.cta ?? '',
    opportunity: cluster.opportunity ?? '',
  };
}

const getAuthHeader = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};

// ── Modale Réseaux Sociaux ────────────────────────────────────────────────────

function SocialModal({ idea, onClose }: { idea: SeoIdea; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-stone-900/80 backdrop-blur-xs flex items-center justify-center p-4 lg:p-10" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-modal-title"
        tabIndex={-1}
        className="bg-stone-50 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl outline-none border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <p id="social-modal-title" className="text-sm font-semibold text-stone-900 truncate pr-4">{idea.suggestedTitle}</p>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors shrink-0 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <SocialContentGenerator
            title={idea.suggestedTitle}
            intro={idea.suggestedIntro}
            keyword={idea.keyword}
            sourceType="suggestion"
            sourceRef={idea.suggestedSlug || idea.keyword}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main SeoHub Component ──────────────────────────────────────────────────────

export default function SeoHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Mode principal : 'didactic' (Client débutant) vs 'expert' (Recherche poussée)
  const [viewMode, setViewMode] = useState<'didactic' | 'expert'>('didactic');

  // Horizon de stratégie didactique : 'top4' (1 mois), 'plan3m' (3 mois), 'plan6m' (6 mois)
  const [horizon, setHorizon] = useState<'top4' | 'plan3m' | 'plan6m'>('plan3m');

  // Cadence d'articles : 1, 2 ou 3 par semaine
  const [cadence, setCadence] = useState<1 | 2 | 3>(1);

  // Accordéon ouvert
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(null);

  // ── Context Marque ────────────────────────────────────────────────────────
  const [brandContext, setBrandContext] = useState<BrandSettings | null>(null);

  // ── State Scan SIO ────────────────────────────────────────────────────────
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError]   = useState('');

  // ── State Recherche SIO ───────────────────────────────────────────────────
  const [seed, setSeed]             = useState('');
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysisError, setAError]  = useState('');
  const [analysis, setAnalysis]     = useState<KeywordAnalysis | null>(null);
  const [saving, setSaving]         = useState(false);
  const [savedOk, setSavedOk]       = useState(false);

  // ── State Bibliothèque ────────────────────────────────────────────────────
  const [savedClusters, setSavedClusters] = useState<any[]>([]);
  const [loadingLib, setLoadingLib]       = useState(false);

  useEffect(() => {
    loadBrandSettings();
    loadLibrary();
    // Lance un scan automatique initial pour alimenter la vue didactique si vide
    handleScan();
  }, []);

  const loadBrandSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['site_activity_context', 'site_target_persona', 'site_brand_tone', 'site_blog_topics']);

    if (data) {
      const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
      setBrandContext({
        site_activity_context: map.site_activity_context || '',
        site_target_persona: map.site_target_persona || '',
        site_brand_tone: map.site_brand_tone || '',
        site_blog_topics: map.site_blog_topics || '',
      });
    }
  };

  const loadLibrary = async () => {
    setLoadingLib(true);
    const { data: clusters } = await supabase
      .from('seo_clusters')
      .select('*, seo_keywords(difficulty_label, volume_label, intent)')
      .order('created_at', { ascending: false });
    setSavedClusters(clusters || []);
    setLoadingLib(false);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true); setScanError('');
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/keyword-scan', { method: 'POST', headers: auth });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScanResult(data as ScanResult);
    } catch (e: any) {
      setScanError(e.message ?? 'Erreur lors du scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyze = async (queryToAnalyze?: string) => {
    const kw = (queryToAnalyze ?? seed).trim();
    if (!kw) return;
    if (queryToAnalyze) setSeed(queryToAnalyze);
    setAnalyzing(true); setAError(''); setAnalysis(null); setSavedOk(false);
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data as KeywordAnalysis);
    } catch (e: any) {
      setAError(e.message ?? 'Erreur lors de l\'analyse SIO.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCluster = async () => {
    if (!analysis) return;
    setSaving(true); setAError('');
    try {
      const { data: kwData, error: kwErr } = await supabase.from('seo_keywords').insert({
        keyword: analysis.keyword,
        volume_label: analysis.volume,
        difficulty_label: analysis.difficulty,
        intent: analysis.intent,
        category: analysis.category,
        source: 'keyword_research',
      }).select('id').single();
      if (kwErr) throw kwErr;

      const { error: clErr } = await supabase.from('seo_clusters').insert({
        keyword_id: kwData.id,
        focus_keyword: analysis.keyword,
        category: analysis.category,
        funnel_level: analysis.funnel_level || 'découverte',
        secondary_keywords: analysis.secondaryKeywords,
        related_questions: analysis.relatedQuestions,
        ai_prompts: analysis.aiPrompts || [],
        community_questions: analysis.communityQuestions || [],
        geo_citation_tips: analysis.geoCitationTips || [],
        rel_bridge: analysis.rel_bridge || '',
        suggested_title: analysis.suggestedTitle,
        suggested_slug: analysis.suggestedSlug,
        suggested_intro: analysis.suggestedIntro,
        content_tips: analysis.contentTips,
        cta: analysis.cta,
        opportunity: analysis.opportunity,
      });
      if (clErr) throw clErr;
      setSavedOk(true);
      loadLibrary();
    } catch (e: any) {
      setAError(e.message ?? 'Erreur de sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const goToEditor = (brief: SeoIdea) => {
    sessionStorage.setItem('seoBrief', JSON.stringify(brief));
    router.push(`/admin/blog/new?${new URLSearchParams({ title: brief.suggestedTitle, slug: brief.suggestedSlug })}`);
  };

  // Recommandations filtrées selon l'horizon choisi
  const displayedRecs = useMemo(() => {
    if (!scanResult?.recommendations) return [];
    let count = 12; // 3 mois par défaut
    if (horizon === 'top4') count = 4;
    if (horizon === 'plan6m') count = 24;
    return scanResult.recommendations.slice(0, count);
  }, [scanResult, horizon]);

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── PageHeader Officiel Admin ───────────────────────────────────────── */}
      <PageHeader
        title="Plan Stratégique d'Articles (SEO & GEO)"
        description="Une sélection didactique des articles prioritaires à publier pour attirer de nouveaux clients sans aucune connaissance technique requise."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(m => m === 'didactic' ? 'expert' : 'didactic')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer transition-colors shadow-xs"
            >
              {viewMode === 'didactic' ? <Bot size={15} /> : <Compass size={15} />}
              {viewMode === 'didactic' ? 'Passer au Mode Expert' : 'Mode Plan Simple (Débutant)'}
            </button>

            <Button
              variant="primary"
              icon={RefreshCwIcon}
              loading={scanning}
              onClick={handleScan}
            >
              Régénérer le plan
            </Button>
          </div>
        }
      />

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODE 1 : PLAN STRATÉGIQUE DIDACTIQUE (CLIENT DÉBUTANT)                   */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'didactic' && (
        <div className="space-y-6">
          {/* Bannière de Choix de Cadence & Horizon */}
          <Card>
            <CardBody className="p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Choisissez votre horizon stratégique</p>
                  <h2 className="text-lg font-semibold text-stone-900">Combien d'articles souhaitez-vous planifier ?</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setHorizon('top4')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      horizon === 'top4'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    📅 Top 4 du mois (4 articles)
                  </button>
                  <button
                    onClick={() => setHorizon('plan3m')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      horizon === 'plan3m'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    🚀 Plan 3 Mois (12 articles)
                  </button>
                  <button
                    onClick={() => setHorizon('plan6m')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      horizon === 'plan6m'
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    🏆 Plan 6 Mois (24 articles)
                  </button>
                </div>
              </div>

              {/* Réglage du Rythme conseillé */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                    {cadence}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-900">Rythme de publication conseillé</p>
                    <p className="text-[12px] text-stone-500">
                      {cadence === 1 ? '1 article par semaine (~4 articles/mois)' : cadence === 2 ? '2 articles par semaine (~8 articles/mois)' : '3 articles par semaine (~12 articles/mois)'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-stone-500 font-medium mr-1">Rythme :</span>
                  {([1, 2, 3] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setCadence(r)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                        cadence === r
                          ? 'bg-stone-900 text-white'
                          : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {r}/semaine
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Loader Scan */}
          {scanning && (
            <Card>
              <CardBody className="py-12 text-center space-y-3">
                <Loader2 size={32} className="animate-spin text-stone-700 mx-auto" />
                <p className="text-sm font-semibold text-stone-900">Calcul du plan d'articles personnalisé…</p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Croisement des recherches des prospects avec les offres et la charte de votre marque.
                </p>
              </CardBody>
            </Card>
          )}

          {scanError && (
            <Callout tone="danger" title="Erreur de génération">
              {scanError}
            </Callout>
          )}

          {/* LISTE DIDACTIQUE SOUS FORME D'ACCORDÉONS */}
          {scanResult && !scanning && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 px-1">
                <div>
                  <h3 className="text-base font-semibold text-stone-900">
                    Vos {displayedRecs.length} articles prioritaires recommandés
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cliquez sur une ligne pour voir les détails et lancer la rédaction en 1-clic.
                  </p>
                </div>
                <Badge tone="success">{displayedRecs.length} sujets prêts</Badge>
              </div>

              <div className="space-y-3">
                {displayedRecs.map((rec, index) => {
                  const weekNum = Math.floor(index / cadence) + 1;
                  const score = calculateSeoGeoScore(rec.priority, rec.difficulty, rec.volume);
                  const isOpen = openAccordionId === `item-${index}`;

                  return (
                    <Card key={index} className="overflow-hidden transition-all">
                      {/* LIGNE FERMÉE (ENTÊTE ACCORDÉON) */}
                      <div
                        onClick={() => setOpenAccordionId(isOpen ? null : `item-${index}`)}
                        className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-stone-50/80 transition-colors ${
                          isOpen ? 'bg-stone-50/60 border-b border-stone-200' : ''
                        }`}
                      >
                        <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                          <div className="px-2.5 py-1 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 shrink-0">
                            Semaine {weekNum}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <ScoreBadge score={score} />
                              <SimpleFunnelBadge level={rec.funnel_level} />
                            </div>
                            <h4 className="text-sm font-semibold text-stone-900 leading-snug">{rec.suggested_title}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Rocket}
                            onClick={(e) => {
                              e.stopPropagation();
                              goToEditor(scanRecToSeoBrief(rec));
                            }}
                          >
                            Rédiger
                          </Button>

                          <div className="p-1 text-stone-400">
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* CONTENU DÉPLIÉ (DÉTAILS ACCORDÉON) */}
                      {isOpen && (
                        <CardBody className="p-5 lg:p-6 bg-white space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Pourquoi cet article ? */}
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                              <p className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <Lightbulb size={14} className="text-amber-600" />
                                Pourquoi cet article va vous apporter des clients
                              </p>
                              <p className="text-stone-600 leading-relaxed font-medium">{rec.opportunity}</p>
                            </div>

                            {/* La question posée */}
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                              <p className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <MessageSquareQuote size={14} className="text-sky-600" />
                                La question posée par les prospects sur Google & IA
                              </p>
                              <p className="text-stone-700 bg-white p-2.5 rounded border border-stone-200 font-mono">
                                🔍 {rec.ai_prompt_example || rec.keyword}
                              </p>
                            </div>
                          </div>

                          {/* Pont vers vos services */}
                          {rec.rel_bridge && (
                            <Callout tone="success" title="Le service mis en avant dans cet article">
                              {rec.rel_bridge}
                            </Callout>
                          )}

                          {/* Action de bas de carte */}
                          <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-stone-500">
                              {rec.covered_by ? (
                                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                  <Check size={14} /> Déjà traité sur votre site (/{rec.covered_by})
                                </span>
                              ) : (
                                <span>Article inédit prêt à publier sur votre blog.</span>
                              )}
                            </div>

                            <Button
                              variant="primary"
                              icon={Rocket}
                              onClick={() => goToEditor(scanRecToSeoBrief(rec))}
                            >
                              🚀 Rédiger cet article maintenant
                            </Button>
                          </div>
                        </CardBody>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* MODE 2 : EXPERT SIO & EXPLORATEUR POUSSÉ                                */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'expert' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Explorateur d'Intentions SIO (Mode Avancé)"
              description="Recherchez un mot-clé précis pour extraire les prompts IA (ChatGPT/Perplexity) et les questions Reddit associées."
            />
            <CardBody className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Ex: comment choisir son praticien, mal de dos chronique, tarif séance..."
                />
                <Button
                  type="submit"
                  variant="primary"
                  icon={Bot}
                  loading={analyzing}
                  disabled={!seed.trim()}
                  className="shrink-0"
                >
                  {analyzing ? 'Analyse…' : 'Analyser'}
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                <span className="font-semibold text-stone-700">Exemples :</span>
                {['méthodes & conseils', 'comparatif de prestations', 'tarifs & réservation', 'problème fréquent'].map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAnalyze(s)}
                    className="px-2.5 py-1 rounded bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {analysisError && (
            <Callout tone="danger" title="Erreur d'analyse">
              {analysisError}
            </Callout>
          )}

          {analysis && (
            <Card>
              <CardHeader
                title={analysis.suggestedTitle}
                description={`URL suggérée : /blog/${analysis.suggestedSlug}`}
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={savedOk ? BookmarkCheck : Bookmark}
                      loading={saving}
                      disabled={savedOk}
                      onClick={handleSaveCluster}
                    >
                      {savedOk ? 'Sauvegardé' : 'Sauvegarder'}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={PenLine}
                      onClick={() => goToEditor(analysisToSeoBrief(analysis))}
                    >
                      Rédiger l'article
                    </Button>
                  </div>
                }
              />
              <CardBody className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <SimpleFunnelBadge level={analysis.funnel_level || 'découverte'} />
                  <Badge tone="neutral">{analysis.category}</Badge>
                  <DiffBadge v={analysis.difficulty} />
                  <VolBadge v={analysis.volume} />
                </div>

                {analysis.rel_bridge && (
                  <Callout tone="warning" title="Pont Commercial Marque">
                    {analysis.rel_bridge}
                  </Callout>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
                    <p className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <Bot size={14} className="text-stone-600" /> Prompts IA posés aux Chatbots
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.aiPrompts?.map((p, i) => (
                        <li key={i} className="text-xs text-stone-700 bg-white p-2.5 rounded border border-stone-200 font-mono">
                          "{p}"
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
                    <p className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <MessageCircle size={14} className="text-stone-600" /> Questions Reddit & Communautés
                    </p>
                    <ul className="space-y-1.5">
                      {analysis.communityQuestions?.map((q, i) => (
                        <li key={i} className="text-xs text-stone-700 bg-white p-2.5 rounded border border-stone-200">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardBody>
              <CardFooter hint="Transférez vers l'éditeur pour lancer la rédaction complète.">
                <Button
                  variant="primary"
                  icon={PenLine}
                  onClick={() => goToEditor(analysisToSeoBrief(analysis))}
                >
                  Rédiger cet article
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Bibliothèque enregistrée */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-stone-900">Vos briefs sauvegardés ({savedClusters.length})</h3>
            {savedClusters.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="Aucun brief enregistré"
                description="Sauvegardez vos recherches pour les retrouver ici à tout moment."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedClusters.map((cluster) => {
                  const brief = clusterToSeoBrief(cluster);
                  return (
                    <Card key={cluster.id}>
                      <CardHeader
                        title={brief.suggestedTitle}
                        description={`Mot-clé : ${brief.keyword}`}
                      />
                      <CardBody className="space-y-2">
                        <SimpleFunnelBadge level={brief.funnel_level || 'découverte'} />
                        {brief.rel_bridge && (
                          <p className="text-xs text-stone-600 bg-stone-50 p-2 rounded border border-stone-200">
                            🎯 {brief.rel_bridge}
                          </p>
                        )}
                      </CardBody>
                      <CardFooter hint="Prêt à rédiger">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={PenLine}
                          onClick={() => goToEditor(brief)}
                        >
                          Rédiger
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RefreshCwIcon(props: any) {
  return <RefreshCw {...props} />;
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
