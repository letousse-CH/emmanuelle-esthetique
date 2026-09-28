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
  Check, Zap, Compass, Rocket, Play, Award, Star, Clock, ShieldCheck, RefreshCw, Settings
} from 'lucide-react';
import {
  seoIdeas, CATEGORIES, CATEGORY_COLORS, CATEGORY_HINTS, CATEGORY_ICONS,
  SeoCategory, SeoIdea, Difficulty, Volume, FunnelLevel
} from '../../../data/seoIdeas';
import {
  Badge, Button, LinkButton, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  Field, Input, PageHeader, Select, Tabs, Spinner
} from '../../../components/admin/ui';
import { supabase } from '../../../services/supabase';
import SocialContentGenerator from '../../../components/admin/SocialContentGenerator';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import { useAiJob } from '../../../hooks/useAiJob';
import AiJobProgress from '../../../components/admin/AiJobProgress';

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
  let label = 'Excellent potentiel';
  if (score < 85) {
    colorClass = 'bg-amber-50 text-amber-800 border-amber-200';
    label = 'Fort potentiel';
  }
  if (score < 78) {
    colorClass = 'bg-accent-soft text-accent border-accent/20';
    label = 'Bon potentiel';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${colorClass}`}>
      <Star size={13} className="fill-current shrink-0" />
      <span>Score SEO/GEO : {score}/100</span>
    </div>
  );
};

const DiffBadge = ({ v }: { v: string }) => {
  const map: Record<string, { tone: 'success' | 'neutral' | 'warning'; label: string }> = {
    faible: { tone: 'success', label: 'Peu de concurrence' },
    moyen: { tone: 'neutral', label: 'Concurrence moyenne' },
    élevé: { tone: 'warning', label: 'Forte concurrence' },
  };
  const c = map[v];
  return <Badge tone={c?.tone ?? 'neutral'}>{c?.label ?? `Concurrence : ${v}`}</Badge>;
};

const VolBadge = ({ v }: { v: string }) => {
  const labels: Record<string, string> = {
    faible: 'Peu recherché', moyen: 'Assez recherché', élevé: 'Très recherché',
  };
  return <Badge tone="neutral">{labels[v] ?? `Recherches : ${v}`}</Badge>;
};

const SimpleFunnelBadge = ({ level }: { level: FunnelLevel }) => {
  const config: Record<FunnelLevel, { label: string; tone: 'info' | 'warning' | 'success' }> = {
    découverte: { label: 'Se faire connaître', tone: 'info' },
    comparaison: { label: 'Rassurer celles qui hésitent', tone: 'info' },
    conversion: { label: 'Obtenir des réservations', tone: 'info' },
  };
  const c = config[level || 'découverte'] ?? config['découverte'];
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

/**
 * Appelle une route d'IA et rend une erreur lisible.
 * Les routes renvoient des codes techniques (« Unauthorized », « parse_error »…),
 * et une page de délai dépassé n'est même pas du JSON : on traduit tout ça ici.
 */
async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const auth = await getAuthHeader();
  if (!auth.Authorization) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...auth },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Le serveur ne répond pas. Vérifiez votre connexion internet puis réessayez.');
  }
  const data: any = await res.json().catch(() => null);
  if (res.ok && data && !data.error) return data as T;
  const code = String(data?.error ?? '');
  if (res.status === 401 || code === 'Unauthorized') throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');
  if (/ANTHROPIC_API_KEY/i.test(code)) throw new Error("La clé de l'assistant IA n'est pas configurée. Renseignez-la dans Réglages, onglet « Clés des services ».");
  if (/parse_error/i.test(code)) throw new Error("La réponse de l'assistant IA était incomplète. Relancez simplement l'opération.");
  if (res.status === 403) throw new Error(code || "La génération par IA est désactivée dans Réglages, onglet « Modules ».");
  // Page d'erreur non JSON (délai de l'hébergeur dépassé) ou 502/504 sans
  // explication : la fonction serveur a été coupée avant la fin.
  if (!data || ((res.status === 502 || res.status === 504) && !code)) {
    const err = new Error("L'assistant IA a mis trop de temps à répondre et l'hébergeur a interrompu la demande. Réessayez dans un instant.");
    (err as any).timeout = true;
    throw err;
  }
  throw new Error(code || `Erreur inattendue du serveur (${res.status}). Réessayez dans un instant.`);
}

/** Dernier plan généré, gardé dans ce navigateur pour ne pas relancer l'IA à chaque visite. */
const SCAN_CACHE_KEY = 'seoHub.lastScan.v1';
function readScanCache(): { at: string; result: ScanResult } | null {
  try {
    const raw = localStorage.getItem(SCAN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.result?.recommendations ? parsed : null;
  } catch { return null; }
}
function writeScanCache(result: ScanResult) {
  try { localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), result })); } catch { /* stockage indisponible */ }
}

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
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors shrink-0 cursor-pointer">
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
  // Le plan d'articles passe par une tâche de fond (plus de 60 s avec le
  // modèle des réglages) ; son suivi reprend après un rechargement de la page.
  const scanJob = useAiJob<ScanResult>('seo:keyword-scan');
  const scanning = scanJob.isBusy;
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError]   = useState('');
  const [scanAt, setScanAt]         = useState<string | null>(null);

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
    // Le plan précédent est repris depuis ce navigateur : le scan coûte trois
    // appels à l'IA et une trentaine de secondes, on ne le relance plus à
    // chaque ouverture de la page, seulement à la demande.
    const cached = readScanCache();
    if (cached) { setScanResult(cached.result); setScanAt(cached.at); }
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

  const [libError, setLibError] = useState('');
  const loadLibrary = async () => {
    setLoadingLib(true); setLibError('');
    const { data: clusters, error } = await supabase
      .from('seo_clusters')
      .select('*, seo_keywords(difficulty_label, volume_label, intent)')
      .order('created_at', { ascending: false });
    if (error) setLibError(`Vos sujets enregistrés n'ont pas pu être chargés (${error.message}).`);
    else setSavedClusters(clusters || []);
    setLoadingLib(false);
  };

  // ── State Pilotage Automatique ────────────────────────────────────────────
  // Mode réglé sur /admin/autopilot : publication directe ou brouillon à relire.
  // null tant qu'il n'est pas connu : les textes restent alors prudents.
  const [autopilotMode, setAutopilotMode] = useState<'autonomous' | 'review_required' | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuthHeader();
        if (!auth.Authorization) return;
        const res = await fetch('/api/admin/autopilot', { headers: auth });
        const data = await res.json().catch(() => null);
        if (res.ok && (data?.mode === 'autonomous' || data?.mode === 'review_required')) setAutopilotMode(data.mode);
      } catch { /* mode inconnu : textes prudents */ }
    })();
  }, []);
  const [autopilotGenerating, setAutopilotGenerating] = useState(false);
  const [autopilotResult, setAutopilotResult] = useState<{
    articleTitle?: string;
    articleSlug?: string;
    socialCount?: number;
    successMessage?: string;
    uncertain?: boolean;
  } | null>(null);

  /*
    Raccourci vers le pilote automatique (/admin/autopilot).
    L'ancienne version appelait /api/generate-page sans jeton (refus 401), ne
    créait aucun article, publiait quand même une annonce sur les réseaux, puis
    affichait « succès » dans tous les cas. On passe désormais par la même route
    que la page Pilote automatique, qui enregistre réellement l'article.
  */
  const handleRunAutopilot = async () => {
    if (autopilotGenerating) return;
    const next = savedClusters[0];
    if (!next) return;
    const subject = next.suggested_title || next.focus_keyword;
    const effect = autopilotMode === 'review_required'
      ? `L'article sera enregistré en brouillon, à relire depuis la page Blog avant publication. `
      : autopilotMode === 'autonomous'
        ? `L'article sera mis en ligne directement sur votre blog et une annonce sera publiée sur vos réseaux sociaux connectés. `
        : `Selon le réglage du pilote automatique, l'article sera soit mis en ligne directement (avec une annonce sur vos réseaux sociaux), soit enregistré en brouillon. `;
    const ok = confirm(
      `Rédiger maintenant un article sur « ${subject} » ?\n\n${effect}` +
      `Ce sujet sera retiré de vos sujets enregistrés. La rédaction prend une à deux minutes.`
    );
    if (!ok) return;
    setAutopilotGenerating(true);
    setAutopilotResult(null);
    try {
      const data = await postJson<{ ok: boolean; articleTitle?: string; published?: boolean; error?: string }>('/api/admin/autopilot', { action: 'trigger_now' });
      if (!data.ok) throw new Error(data.error || "La rédaction automatique n'a pas abouti.");
      setAutopilotResult({
        articleTitle: data.articleTitle,
        successMessage: data.published === false
          ? `Article rédigé et enregistré en brouillon : « ${data.articleTitle} ». Relisez-le puis publiez-le depuis la page Blog.`
          : `Article publié : « ${data.articleTitle} ». Vous pouvez le relire depuis la page Blog.`,
      });
      loadLibrary();
    } catch (e: any) {
      console.error('[Autopilot] Erreur:', e);
      // Coupure par l'hébergeur : la rédaction a pu aller au bout côté serveur.
      setAutopilotResult({
        uncertain: Boolean(e?.timeout),
        successMessage: e?.timeout
          ? "La réponse a pris trop de temps et la page n'a pas reçu le résultat. L'article a peut-être quand même été créé : vérifiez la page Blog avant de relancer, pour éviter un doublon."
          : `Aucun article n'a été créé : ${e.message}`,
      });
      loadLibrary();
    } finally {
      setAutopilotGenerating(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleScan = async () => {
    if (scanning) return;
    setScanError('');
    await scanJob.start('keyword-scan', {});
  };

  // Résultat (ou erreur) de la tâche de scan, y compris après un rechargement.
  const { status: scanJobStatus, result: scanJobResult, error: scanJobError, reset: resetScanJob } = scanJob;
  useEffect(() => {
    if (scanJobStatus === 'done') {
      const data = (scanJobResult ?? {}) as ScanResult;
      const result: ScanResult = { ...data, recommendations: Array.isArray(data.recommendations) ? data.recommendations : [] };
      if (result.recommendations.length === 0) {
        setScanError("L'assistant IA n'a proposé aucun sujet. Complétez la description de votre activité puis relancez.");
      } else {
        setScanResult(result);
        setOpenAccordionId(null);
        const at = new Date().toISOString();
        setScanAt(at);
        writeScanCache(result);
      }
      resetScanJob();
    } else if (scanJobStatus === 'error') {
      const code = scanJobError || '';
      setScanError(
        /parse_error/i.test(code)
          ? "La réponse de l'assistant IA était incomplète. Relancez simplement l'opération."
          : code || 'Le plan n\'a pas pu être généré.',
      );
      resetScanJob();
    }
  }, [scanJobStatus, scanJobResult, scanJobError, resetScanJob]);

  const handleAnalyze = async (queryToAnalyze?: string) => {
    const kw = (queryToAnalyze ?? seed).trim();
    if (!kw) return;
    if (queryToAnalyze) setSeed(queryToAnalyze);
    if (analyzing) return;
    setAnalyzing(true); setAError(''); setAnalysis(null); setSavedOk(false);
    try {
      const data = await postJson<KeywordAnalysis>('/api/keyword-research', { keyword: kw });
      setAnalysis(data);
    } catch (e: any) {
      setAError(e.message ?? 'L\'analyse n\'a pas pu aboutir.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCluster = async () => {
    if (!analysis || saving || savedOk) return;
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
      setAError(`Le sujet n'a pas pu être enregistré (${e?.message ?? 'erreur inconnue'}). Réessayez.`);
    } finally {
      setSaving(false);
    }
  };

  const goToEditor = (brief: SeoIdea) => {
    sessionStorage.setItem('seoBrief', JSON.stringify(brief));
    router.push(`/admin/blog/new?${new URLSearchParams({ title: brief.suggestedTitle, slug: brief.suggestedSlug })}`);
  };

  // Nombre d'articles = semaines de l'horizon × rythme choisi. Avant, le
  // nombre était fixe (4/12/24) quel que soit le rythme : « 3 mois » à
  // 3 articles par semaine ne couvrait en réalité que 4 semaines.
  const horizonWeeks = horizon === 'top4' ? 4 : horizon === 'plan3m' ? 13 : 26;
  const wantedCount = horizonWeeks * cadence;
  const displayedRecs = useMemo(() => {
    if (!scanResult?.recommendations) return [];
    return scanResult.recommendations.slice(0, wantedCount);
  }, [scanResult, wantedCount]);
  const planIsShort = !!scanResult && displayedRecs.length < wantedCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO et mots-clés"
        description="Les sujets d'articles à publier en priorité pour être trouvée sur Google et citée par les assistants IA (ChatGPT, Perplexity…), et un outil pour étudier une recherche précise."
        actions={viewMode === 'didactic' && scanResult ? (
          <Button variant="secondary" icon={RefreshCw} loading={scanning} onClick={handleScan}
            title="Remplace le plan actuel par une nouvelle liste de sujets">
            {scanning ? 'Génération en cours…' : 'Régénérer le plan'}
          </Button>
        ) : undefined}
      />

      <Tabs
        label="Outils de référencement"
        active={viewMode}
        onChange={(id) => setViewMode(id as 'didactic' | 'expert')}
        items={[
          { id: 'didactic', label: "Plan d'articles", icon: Calendar },
          { id: 'expert', label: 'Étudier une recherche', icon: Search },
        ]}
      />

      {brandContext && !brandContext.site_activity_context.trim() && (
        <Callout
          tone="warning"
          title="Décrivez d'abord votre activité"
          actions={<LinkButton href="/admin/settings?tab=editorial" size="sm" icon={Settings}>Compléter</LinkButton>}
        >
          Les suggestions s'appuient sur la description de votre activité, de vos clientes et de vos prestations. Tant qu'elle est vide, elles restent génériques.
        </Callout>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ONGLET 1 : PLAN D'ARTICLES                                              */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'didactic' && (
        <div className="space-y-6">
          {/* Réglages du plan : horizon et rythme */}
          <Card>
            <CardBody className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[14px] font-semibold text-stone-900">Sur quelle durée ?</p>
                <Tabs
                  label="Durée du plan"
                  active={horizon}
                  onChange={(id) => setHorizon(id as 'top4' | 'plan3m' | 'plan6m')}
                  items={[
                    { id: 'top4', label: '1 mois' },
                    { id: 'plan3m', label: '3 mois' },
                    { id: 'plan6m', label: '6 mois' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[14px] font-semibold text-stone-900">À quel rythme ?</p>
                <Tabs
                  label="Rythme de publication"
                  active={String(cadence)}
                  onChange={(id) => setCadence(Number(id) as 1 | 2 | 3)}
                  items={[
                    { id: '1', label: '1 par semaine' },
                    { id: '2', label: '2 par semaine' },
                    { id: '3', label: '3 par semaine' },
                  ]}
                />
              </div>
              <p className="md:col-span-2 text-[13px] text-stone-600">
                Soit {wantedCount} article{wantedCount > 1 ? 's' : ''} à écrire. Un article par semaine suffit pour progresser régulièrement sur Google.
              </p>
            </CardBody>
          </Card>

          {scanning && (
            <Card>
              <CardBody className="py-12 text-center space-y-2">
                <p className="text-[15px] font-semibold text-stone-900">Préparation de votre plan d'articles…</p>
                <p className="text-[13px] text-stone-600 max-w-md mx-auto">
                  L'assistant compare les recherches de vos futures clientes avec vos prestations et les articles déjà publiés. Comptez une à trois minutes.
                </p>
                <div className="max-w-md mx-auto pt-2 text-left">
                  <AiJobProgress label="Préparation en cours…" elapsedSeconds={scanJob.elapsedSeconds} />
                </div>
              </CardBody>
            </Card>
          )}

          {scanError && !scanning && (
            <Callout tone="danger" title="Le plan n'a pas pu être généré"
              actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleScan}>Réessayer</Button>}>
              {scanError}
            </Callout>
          )}

          {!scanResult && !scanning && !scanError && (
            <EmptyState
              icon={Calendar}
              title="Aucun plan d'articles pour l'instant"
              description="Générez votre plan : l'assistant vous propose une liste de sujets classés par priorité, semaine par semaine. Comptez environ une minute."
              action={<Button variant="primary" icon={RefreshCw} onClick={handleScan}>Générer mon plan</Button>}
            />
          )}

          {/* LISTE DES SUJETS, SEMAINE PAR SEMAINE */}
          {scanResult && !scanning && (
            <div className="space-y-4">
              <div className="px-1">
                <h2 className="text-[18px] font-semibold text-stone-950">
                  Vos {displayedRecs.length} sujet{displayedRecs.length > 1 ? 's' : ''} prioritaire{displayedRecs.length > 1 ? 's' : ''}
                </h2>
                <p className="mt-1 text-[14px] text-stone-600">
                  Ouvrez un sujet pour savoir pourquoi il compte. « Rédiger » ouvre l'éditeur d'article avec le titre et l'adresse déjà remplis.
                  {scanAt && <> Plan préparé le {new Date(scanAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.</>}
                </p>
              </div>

              {planIsShort && (
                <Callout tone="info">
                  Le plan actuel contient {displayedRecs.length} sujets, soit {Math.ceil(displayedRecs.length / cadence)} semaine{Math.ceil(displayedRecs.length / cadence) > 1 ? 's' : ''} à ce rythme. Régénérez-le quand vous les aurez traités pour obtenir la suite.
                </Callout>
              )}

              <div className="space-y-3">
                {displayedRecs.map((rec, index) => {
                  const weekNum = Math.floor(index / cadence) + 1;
                  const itemId = `item-${index}`;
                  const isOpen = openAccordionId === itemId;

                  return (
                    <Card key={`${rec.suggested_slug || rec.keyword}-${index}`} className="overflow-hidden">
                      <div className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 ${isOpen ? 'bg-stone-50 border-b border-stone-200' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setOpenAccordionId(isOpen ? null : itemId)}
                          aria-expanded={isOpen}
                          aria-controls={`seo-rec-${index}`}
                          className="flex flex-1 items-start gap-3.5 min-w-0 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <span className="px-2.5 py-1 bg-stone-100 rounded-lg text-[13px] font-semibold text-stone-700 shrink-0 whitespace-nowrap">
                            Semaine {weekNum}
                          </span>
                          <span className="min-w-0 flex-1 space-y-1.5">
                            <span className="block text-[15px] font-semibold text-stone-900 leading-snug">{rec.suggested_title}</span>
                            <span className="flex flex-wrap items-center gap-2">
                              <SimpleFunnelBadge level={rec.funnel_level} />
                              {rec.covered_by && <Badge tone="neutral">Déjà abordé sur le site</Badge>}
                            </span>
                          </span>
                          <span className="p-1 text-stone-600 shrink-0" aria-hidden="true">
                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </span>
                        </button>

                        {!isOpen && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={PenLine}
                            className="self-end md:self-center"
                            onClick={() => goToEditor(scanRecToSeoBrief(rec))}
                          >
                            Rédiger
                          </Button>
                        )}
                      </div>

                      {isOpen && (
                        <CardBody className="space-y-5">
                          <div id={`seo-rec-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[14px]">
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                              <p className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <Lightbulb size={15} className="text-stone-600" />
                                Pourquoi ce sujet peut vous amener des clientes
                              </p>
                              <p className="text-stone-700 leading-relaxed">{rec.opportunity}</p>
                            </div>

                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                              <p className="font-semibold text-stone-900 flex items-center gap-1.5">
                                <MessageSquareQuote size={15} className="text-stone-600" />
                                Ce que tapent vos futures clientes
                              </p>
                              <p className="text-stone-700 leading-relaxed">« {rec.ai_prompt_example || rec.keyword} »</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <DiffBadge v={rec.difficulty} />
                            <VolBadge v={rec.volume} />
                          </div>

                          {rec.rel_bridge && (
                            <Callout tone="info" title="La prestation à mettre en avant">
                              {rec.rel_bridge}
                            </Callout>
                          )}

                          <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] text-stone-600">
                              {rec.covered_by ? (
                                <span className="flex items-center gap-1">
                                  <Check size={14} className="text-emerald-700" /> Un contenu existant en parle déjà :{' '}
                                  <a href={/^https?:\/\//.test(rec.covered_by) ? rec.covered_by : `/${rec.covered_by.replace(/^\//, '')}`} target="_blank" rel="noreferrer" className="font-semibold text-stone-900 underline underline-offset-2 hover:text-accent">
                                    {/^https?:\/\//.test(rec.covered_by) ? rec.covered_by : `/${rec.covered_by.replace(/^\//, '')}`}
                                  </a>
                                </span>
                              ) : (
                                <span>Aucun article de votre site ne traite encore ce sujet.</span>
                              )}
                            </div>

                            <Button variant="primary" icon={PenLine} onClick={() => goToEditor(scanRecToSeoBrief(rec))}>
                              Rédiger cet article
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

          {/* Raccourci vers le pilote automatique */}
          <Card>
            <CardHeader
              title="Publication automatique"
              description={autopilotMode === 'review_required'
                ? "Le pilote automatique rédige un article à partir de votre dernier sujet enregistré et le garde en brouillon pour que vous le relisiez."
                : "Le pilote automatique rédige un article à partir de votre dernier sujet enregistré, le publie sur le blog et l'annonce sur vos réseaux sociaux."}
              actions={<LinkButton href="/admin/autopilot" variant="ghost" size="sm" icon={Settings}>Régler le pilote automatique</LinkButton>}
            />
            <CardBody className="space-y-3">
              {savedClusters.length === 0 ? (
                <p className="text-[14px] text-stone-700">
                  Aucun sujet enregistré pour l'instant. Enregistrez un sujet depuis l'onglet « Étudier une recherche » pour pouvoir le confier au pilote automatique.
                </p>
              ) : (
                <p className="text-[14px] text-stone-700">
                  Prochain sujet traité : <span className="font-semibold text-stone-900">{savedClusters[0].suggested_title || savedClusters[0].focus_keyword}</span>
                </p>
              )}
              {autopilotResult && (
                <Callout tone={autopilotResult.articleTitle ? 'success' : autopilotResult.uncertain ? 'warning' : 'danger'}>
                  {autopilotResult.successMessage}
                </Callout>
              )}
            </CardBody>
            <CardFooter hint={autopilotMode === 'review_required'
              ? "L'article reste en brouillon tant que vous ne l'avez pas publié depuis la page Blog."
              : "L'article est mis en ligne sans relecture préalable : relisez-le ensuite depuis la page Blog."}>
              <Button
                variant="secondary"
                icon={Rocket}
                loading={autopilotGenerating}
                disabled={savedClusters.length === 0}
                onClick={handleRunAutopilot}
              >
                {autopilotGenerating ? 'Rédaction en cours…' : autopilotMode === 'review_required' ? 'Rédiger maintenant' : 'Rédiger et publier maintenant'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ONGLET 2 : ÉTUDIER UNE RECHERCHE PRÉCISE                               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'expert' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Étudier une recherche précise"
              description="Saisissez ce qu'une cliente pourrait taper sur Google ou demander à ChatGPT. Vous obtiendrez les questions qui s'y rattachent et une proposition d'article."
            />
            <CardBody className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }} className="flex flex-col sm:flex-row gap-3">
                <label htmlFor="seo-seed" className="sr-only">Recherche à étudier</label>
                <Input
                  id="seo-seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Ex. : prix d'une séance, comment choisir une prestation…"
                />
                <Button
                  type="submit"
                  variant="primary"
                  icon={Bot}
                  loading={analyzing}
                  disabled={!seed.trim()}
                  className="shrink-0"
                >
                  {analyzing ? 'Analyse en cours…' : 'Analyser'}
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-stone-600">
                <span className="font-semibold text-stone-700">Exemples :</span>
                {['méthodes & conseils', 'comparatif de prestations', 'tarifs & réservation', 'problème fréquent'].map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAnalyze(s)}
                    disabled={analyzing}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {analyzing && (
            <Card>
              <CardBody className="py-10 text-center space-y-2">
                <Loader2 size={24} className="animate-spin text-stone-600 mx-auto" />
                <p className="text-[15px] font-semibold text-stone-900">Analyse de « {seed} »…</p>
                <p className="text-[13px] text-stone-600">Comptez une vingtaine de secondes.</p>
              </CardBody>
            </Card>
          )}

          {analysisError && (
            <Callout tone="danger" title="L'analyse n'a pas abouti">
              {analysisError}
            </Callout>
          )}

          {analysis && (
            <Card>
              <CardHeader
                title={analysis.suggestedTitle}
                description={`Adresse proposée : /blog/${analysis.suggestedSlug}`}
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
                      {savedOk ? 'Sujet enregistré' : 'Enregistrer le sujet'}
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

                {analysis.opportunity && (
                  <p className="text-[14px] leading-relaxed text-stone-700">{analysis.opportunity}</p>
                )}

                {analysis.rel_bridge && (
                  <Callout tone="info" title="La prestation à mettre en avant">
                    {analysis.rel_bridge}
                  </Callout>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
                    <p className="text-[14px] font-semibold text-stone-900 flex items-center gap-1.5">
                      <Bot size={15} className="text-stone-600" /> Questions posées aux assistants IA
                    </p>
                    {analysis.aiPrompts?.length ? (
                      <ul className="space-y-1.5">
                        {analysis.aiPrompts.map((p, i) => (
                          <li key={i} className="text-[14px] text-stone-700 bg-white p-2.5 rounded-lg border border-stone-200">
                            « {p} »
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-stone-600">Aucune question trouvée.</p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200 space-y-2">
                    <p className="text-[14px] font-semibold text-stone-900 flex items-center gap-1.5">
                      <MessageCircle size={15} className="text-stone-600" /> Questions posées sur les forums
                    </p>
                    {analysis.communityQuestions?.length ? (
                      <ul className="space-y-1.5">
                        {analysis.communityQuestions.map((q, i) => (
                          <li key={i} className="text-[14px] text-stone-700 bg-white p-2.5 rounded-lg border border-stone-200">
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-stone-600">Aucune question trouvée.</p>
                    )}
                  </div>
                </div>
              </CardBody>
              <CardFooter hint="L'éditeur d'article s'ouvre avec le titre, l'adresse et ces pistes déjà préparés.">
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

          {/* Sujets enregistrés */}
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-stone-950">
                Vos sujets enregistrés{!loadingLib && savedClusters.length > 0 ? ` (${savedClusters.length})` : ''}
              </h2>
              <p className="mt-1 text-[14px] text-stone-600">Le pilote automatique puise dans cette liste, en commençant par le plus récent.</p>
            </div>
            {libError ? (
              <Callout tone="danger" actions={<Button variant="secondary" size="sm" onClick={loadLibrary}>Réessayer</Button>}>
                {libError}
              </Callout>
            ) : loadingLib && savedClusters.length === 0 ? (
              <Spinner label="Chargement de vos sujets…" />
            ) : savedClusters.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="Aucun sujet enregistré"
                description="Après une analyse, cliquez sur « Enregistrer le sujet » pour le retrouver ici et le rédiger plus tard."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedClusters.map((cluster) => {
                  const brief = clusterToSeoBrief(cluster);
                  return (
                    <Card key={cluster.id} className="flex flex-col">
                      <CardHeader
                        title={brief.suggestedTitle || brief.keyword}
                        description={`Recherche visée : ${brief.keyword}`}
                      />
                      <CardBody className="space-y-3 flex-1">
                        <SimpleFunnelBadge level={brief.funnel_level || 'découverte'} />
                        {brief.rel_bridge && (
                          <p className="text-[14px] leading-relaxed text-stone-700">{brief.rel_bridge}</p>
                        )}
                      </CardBody>
                      <CardFooter>
                        <Button variant="secondary" size="sm" icon={PenLine} onClick={() => goToEditor(brief)}>
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

