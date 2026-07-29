"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation';
import {
  Search, PenLine, ChevronDown, ChevronUp, ChevronRight,
  Target, TrendingUp, Lightbulb, BarChart2, BookOpen,
  Sparkles, Bookmark, BookmarkCheck, Trash2, Loader,
  ScanLine, AlertTriangle, ArrowDownToLine, Layers, Save, Filter,
  Share2, X,
} from 'lucide-react';
import {
  seoIdeas, CATEGORIES, CATEGORY_COLORS, CATEGORY_EMOJIS,
  SeoCategory, SeoIdea, Difficulty, Volume,
} from '../../../data/seoIdeas';
import { supabase } from '../../../services/supabase';
import SocialContentGenerator from '../../../components/admin/SocialContentGenerator';
import { useModuleFlags } from '../../../hooks/useModuleFlags';

// ── Types ─────────────────────────────────────────────────────────────────────

type FunnelLevel = 'symptôme' | 'méthode' | 'thérapeute';

interface KeywordAnalysis {
  keyword: string;
  intent: 'informationnel' | 'transactionnel' | 'navigationnel';
  difficulty: 'faible' | 'moyen' | 'élevé';
  volume: 'faible' | 'moyen' | 'élevé';
  category: string;
  funnel_level?: FunnelLevel;
  opportunity: string;
  rel_bridge?: string;
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
}

interface ScanResult {
  strategy_summary: string;
  coverage_gaps: string[];
  recommendations: ScanRecommendation[];
}

// ── Badges ────────────────────────────────────────────────────────────────────

const DiffBadge = ({ v }: { v: string }) => {
  const map: Record<string, string> = { faible: 'bg-green-100 text-green-700', moyen: 'bg-yellow-100 text-yellow-700', élevé: 'bg-red-100 text-red-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[v] ?? 'bg-stone-100 text-stone-600'}`}>KD {v}</span>;
};
const VolBadge = ({ v }: { v: string }) => {
  const map: Record<string, string> = { faible: 'bg-stone-100 text-stone-500', moyen: 'bg-blue-100 text-blue-600', élevé: 'bg-indigo-100 text-indigo-700' };
  const icons: Record<string, string> = { faible: '↓', moyen: '→', élevé: '↑' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[v] ?? 'bg-stone-100 text-stone-600'}`}>Vol {icons[v] ?? '—'} {v}</span>;
};
const IntentBadge = ({ v }: { v: string }) => {
  const map: Record<string, string> = { informationnel: 'bg-sky-100 text-sky-700', transactionnel: 'bg-orange-100 text-orange-700', navigationnel: 'bg-purple-100 text-purple-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[v] ?? 'bg-stone-100 text-stone-600'}`}>{v}</span>;
};
const FunnelBadge = ({ v }: { v: FunnelLevel }) => {
  const config: Record<FunnelLevel, { cls: string; label: string }> = {
    'symptôme':   { cls: 'bg-red-50 text-red-700 border-red-200',    label: 'Symptôme TOFU' },
    'méthode':    { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Méthode MOFU' },
    'thérapeute': { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Conversion BOFU' },
  };
  const c = config[v] ?? config['méthode'];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${c.cls}`}>{c.label}</span>;
};
const PriorityDot = ({ v }: { v: number }) => {
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-stone-300', 'bg-stone-200'];
  return <span title={`Priorité ${v}`} className={`inline-block w-2.5 h-2.5 rounded-full ${colors[v] ?? 'bg-stone-200'}`} />;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function analysisToSeoBrief(a: KeywordAnalysis): SeoIdea {
  return {
    id: `kw-${Date.now()}`,
    category: a.category as SeoCategory,
    keyword: a.keyword,
    question: a.relatedQuestions[0] ?? a.suggestedTitle,
    difficulty: a.difficulty,
    volume: a.volume,
    intent: a.intent as any,
    suggestedTitle: a.suggestedTitle,
    suggestedSlug: a.suggestedSlug,
    suggestedIntro: a.suggestedIntro,
    relatedQuestions: a.relatedQuestions,
    secondaryKeywords: a.secondaryKeywords,
    contentTips: a.contentTips,
    cta: a.cta,
    opportunity: a.opportunity,
  };
}

function scanRecToSeoBrief(r: ScanRecommendation): SeoIdea {
  return {
    id: `scan-${Date.now()}-${r.suggested_slug}`,
    category: r.category as SeoCategory,
    keyword: r.keyword,
    question: r.suggested_title,
    difficulty: r.difficulty,
    volume: r.volume,
    intent: 'informationnel' as any,
    suggestedTitle: r.suggested_title,
    suggestedSlug: r.suggested_slug,
    suggestedIntro: r.rel_bridge,
    relatedQuestions: [],
    secondaryKeywords: [],
    contentTips: [],
    cta: r.rel_bridge,
    opportunity: r.opportunity,
  };
}

function clusterToSeoBrief(cluster: any): SeoIdea {
  return {
    id: `kw-${cluster.id}`,
    category: (cluster.category ?? '') as SeoCategory,
    keyword: cluster.focus_keyword,
    question: cluster.related_questions?.[0] ?? cluster.suggested_title ?? '',
    difficulty: cluster.seo_keywords?.difficulty_label ?? 'moyen',
    volume: cluster.seo_keywords?.volume_label ?? 'moyen',
    intent: (cluster.seo_keywords?.intent ?? 'informationnel') as any,
    suggestedTitle: cluster.suggested_title ?? '',
    suggestedSlug: cluster.suggested_slug ?? '',
    suggestedIntro: cluster.suggested_intro ?? '',
    relatedQuestions: cluster.related_questions ?? [],
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

// ── IdeaCard ──────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onUse, onSave, onDelete, saved, generated }: {
  idea: SeoIdea;
  onUse: (idea: SeoIdea) => void;
  onSave?: (idea: SeoIdea) => void;
  onDelete?: () => void;
  saved?: boolean;
  generated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const moduleFlags = useModuleFlags();
  return (
    <div className={`bg-white border rounded-2xl overflow-hidden hover:shadow-md transition-shadow ${generated ? 'border-sage/40 ring-1 ring-sage/20' : 'border-stone-200'}`}>
      <div className="p-5">
        {generated && (
          <div className="flex items-center gap-1.5 text-sage text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles size={12} /> Générée par IA
          </div>
        )}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${CATEGORY_COLORS[idea.category]}`}>
            {CATEGORY_EMOJIS[idea.category]} {idea.category}
          </span>
          <span className="text-xs text-stone-400 italic shrink-0">{idea.intent}</span>
        </div>
        <div className="mb-2">
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Requête Google</p>
          <p className="font-mono text-sm bg-stone-50 px-3 py-1.5 rounded-lg text-stone-800 border border-stone-100">🔍 {idea.keyword}</p>
        </div>
        <div className="mb-3">
          <p className="text-xs text-stone-400 uppercase tracking-widest mb-0.5">Titre suggéré</p>
          <p className="font-serif text-base font-bold text-stone-900 leading-snug">{idea.suggestedTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <DiffBadge v={idea.difficulty} />
          <VolBadge v={idea.volume} />
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Lightbulb size={12} /> Opportunité
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">{idea.opportunity}</p>
        </div>
      </div>

      <button onClick={() => setOpen(o => !o)} className="w-full px-5 py-3 border-t border-stone-100 text-xs text-stone-500 hover:bg-stone-50 flex items-center justify-between transition-colors">
        <span className="font-bold uppercase tracking-widest">{open ? 'Masquer' : 'Brief complet'}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-3 bg-stone-50 border-t border-stone-100 space-y-4">
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">💬 Accroche intro</p>
            <p className="text-sm text-stone-700 italic leading-relaxed bg-white p-3 rounded-xl border border-stone-100">"{idea.suggestedIntro}"</p>
          </div>
          {idea.relatedQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">❓ People Also Ask</p>
              <ul className="space-y-1.5">
                {idea.relatedQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700"><span className="text-sage mt-0.5">›</span> {q}</li>
                ))}
              </ul>
            </div>
          )}
          {idea.contentTips.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">✍️ Conseils rédaction</p>
              <ul className="space-y-1.5">
                {idea.contentTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-700"><span className="text-wood mt-0.5">•</span> {tip}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">🎯 CTA de fin d'article</p>
            <p className="text-sm text-stone-700 bg-sage/10 border border-sage/20 rounded-xl px-3 py-2">{idea.cta}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">🔗 URL suggérée</p>
            <p className="font-mono text-xs text-stone-500 bg-white px-3 py-2 rounded-lg border border-stone-200">/blog/{idea.suggestedSlug}</p>
          </div>
        </div>
      )}

      <div className="px-5 py-4 border-t border-stone-100 flex gap-2">
        <button onClick={() => onUse(idea)} className="flex-1 flex items-center justify-center gap-2 bg-stone-900 hover:bg-sage text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl transition-colors">
          <PenLine size={14} /> Créer l'article
        </button>
        {moduleFlags.social && (
          <button onClick={() => setShowSocial(true)} title="Générer du contenu réseaux sociaux" aria-label={`Générer du contenu réseaux sociaux pour « ${idea.suggestedTitle} »`} className="px-3 py-3 border border-stone-200 rounded-xl text-stone-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors cursor-pointer">
            <Share2 size={16} />
          </button>
        )}
        {onSave && !saved && (
          <button onClick={() => onSave(idea)} title="Sauvegarder" aria-label={`Sauvegarder « ${idea.suggestedTitle} »`} className="px-3 py-3 border border-stone-200 rounded-xl text-stone-400 hover:text-sage hover:border-sage transition-colors cursor-pointer">
            <Bookmark size={16} />
          </button>
        )}
        {saved && <span className="px-3 py-3 text-sage" title="Sauvegardée" aria-label="Sauvegardée"><BookmarkCheck size={16} /></span>}
        {onDelete && (
          <button onClick={onDelete} title="Supprimer" aria-label={`Supprimer « ${idea.suggestedTitle} »`} className="px-3 py-3 border border-stone-200 rounded-xl text-stone-300 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {showSocial && <SocialModal idea={idea} onClose={() => setShowSocial(false)} />}
    </div>
  );
}

function SocialModal({ idea, onClose }: { idea: SeoIdea; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-10" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-modal-title"
        tabIndex={-1}
        className="bg-stone-50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 px-5 py-3 border-b border-stone-200 bg-white flex items-center justify-between">
          <p id="social-modal-title" className="text-sm font-bold text-stone-900 truncate pr-4">{idea.suggestedTitle}</p>
          <button onClick={onClose} aria-label="Fermer" className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-colors shrink-0 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <SocialContentGenerator
            title={idea.suggestedTitle}
            intro={idea.suggestedIntro}
            keyword={idea.keyword}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type Tab = 'idees' | 'analyser' | 'scan' | 'bibliotheque';

export default function SeoHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) ?? 'idees';
  const setTab = (t: Tab) => router.push(`${pathname}?tab=${t}`);

  // ── État — Idées ──────────────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState<SeoCategory | 'Toutes'>('Toutes');
  const [diffFilter, setDiffFilter] = useState<Difficulty | 'toutes'>('toutes');
  const [volFilter, setVolFilter]   = useState<Volume | 'toutes'>('toutes');
  const [intentFilter, setIntent]   = useState<'toutes' | 'informationnel' | 'transactionnel'>('toutes');
  const [theme, setTheme]           = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState<SeoIdea[]>([]);
  const [genError, setGenError]     = useState('');
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set());
  const [usedSlugs, setUsedSlugs]   = useState<Set<string>>(new Set());
  const [hideUsed, setHideUsed]     = useState(true);

  // ── État — Analyse mot-clé ────────────────────────────────────────────────
  const [seed, setSeed]             = useState('');
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysisError, setAError]  = useState('');
  const [analysis, setAnalysis]     = useState<KeywordAnalysis | null>(null);
  const [saving, setSaving]         = useState(false);
  const [savedOk, setSavedOk]       = useState(false);

  // ── État — Scan ───────────────────────────────────────────────────────────
  const [scanning, setScanning]     = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError]   = useState('');
  const [scanFilter, setScanFilter] = useState<FunnelLevel | 'all'>('all');
  const [expandedRec, setExpanded]  = useState<string | null>(null);

  // ── État — Bibliothèque ───────────────────────────────────────────────────
  const [savedIdeas, setSavedIdeas]       = useState<any[]>([]);
  const [savedClusters, setSavedClusters] = useState<any[]>([]);
  const [loadingLib, setLoadingLib]       = useState(false);

  useEffect(() => {
    loadUsedSlugs();
    loadLibrary();
  }, []);

  const loadUsedSlugs = async () => {
    const { data } = await supabase.from('articles').select('slug');
    if (data) setUsedSlugs(new Set(data.map((a: any) => a.slug)));
  };

  const loadLibrary = async () => {
    setLoadingLib(true);
    const [{ data: ideas }, { data: clusters }] = await Promise.all([
      supabase.from('saved_ideas').select('*').eq('type', 'article').order('created_at', { ascending: false }),
      supabase.from('seo_clusters').select('*, seo_keywords(difficulty_label, volume_label, intent)').order('created_at', { ascending: false }),
    ]);
    setSavedIdeas(ideas || []);
    setSavedIds(new Set((ideas || []).map((r: any) => r.data?.id)));
    setSavedClusters(clusters || []);
    setLoadingLib(false);
  };

  // ── Actions — Idées ───────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true); setGenError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-seo-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ theme, existingKeywords: seoIdeas.map(i => i.keyword) }),
      });
      const data = await res.json();
      if (data.error) { setGenError('Erreur de génération. Réessayez.'); return; }
      setGenerated(data.ideas || []);
    } catch { setGenError('Erreur réseau. Réessayez.'); }
    finally { setGenerating(false); }
  };

  const handleSaveIdea = async (idea: SeoIdea) => {
    const { error } = await supabase.from('saved_ideas').insert({ type: 'article', title: idea.suggestedTitle, data: idea });
    if (!error) { setSavedIds(prev => new Set([...prev, idea.id])); loadLibrary(); }
  };

  const handleDeleteIdea = async (row: any) => {
    await supabase.from('saved_ideas').delete().eq('id', row.id);
    setSavedIds(prev => { const s = new Set(prev); s.delete(row.data?.id); return s; });
    setSavedIdeas(prev => prev.filter(r => r.id !== row.id));
  };

  const goToEditor = (brief: SeoIdea) => {
    sessionStorage.setItem('seoBrief', JSON.stringify(brief));
    router.push(`/admin/blog/new?${new URLSearchParams({ title: brief.suggestedTitle, slug: brief.suggestedSlug })}`);
  };

  // ── Actions — Analyse ─────────────────────────────────────────────────────

  const handleAnalyze = async (keyword?: string) => {
    const kw = (keyword ?? seed).trim();
    if (!kw) return;
    if (keyword) setSeed(keyword);
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
    } catch (e: any) { setAError(e.message ?? 'Erreur lors de l\'analyse.'); }
    finally { setAnalyzing(false); }
  };

  const handleSaveCluster = async () => {
    if (!analysis) return;
    setSaving(true); setAError('');
    try {
      const { data: kwData, error: kwErr } = await supabase.from('seo_keywords').insert({
        keyword: analysis.keyword, volume_label: analysis.volume,
        difficulty_label: analysis.difficulty, intent: analysis.intent,
        category: analysis.category, source: 'keyword_research',
      }).select('id').single();
      if (kwErr) throw kwErr;
      const { error: clErr } = await supabase.from('seo_clusters').insert({
        keyword_id: kwData.id, focus_keyword: analysis.keyword,
        category: analysis.category, secondary_keywords: analysis.secondaryKeywords,
        related_questions: analysis.relatedQuestions, suggested_title: analysis.suggestedTitle,
        suggested_slug: analysis.suggestedSlug, suggested_intro: analysis.suggestedIntro,
        content_tips: analysis.contentTips, cta: analysis.cta, opportunity: analysis.opportunity,
      });
      if (clErr) throw clErr;
      setSavedOk(true); loadLibrary();
    } catch (e: any) { setAError(e.message ?? 'Erreur de sauvegarde.'); }
    finally { setSaving(false); }
  };

  const handleDeleteCluster = async (clusterId: string, keywordId: string) => {
    await supabase.from('seo_clusters').delete().eq('id', clusterId);
    await supabase.from('seo_keywords').delete().eq('id', keywordId);
    setSavedClusters(prev => prev.filter(c => c.id !== clusterId));
  };

  // ── Actions — Scan ────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true); setScanError(''); setScanResult(null);
    try {
      const auth = await getAuthHeader();
      const res = await fetch('/api/keyword-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScanResult(data as ScanResult);
    } catch (e: any) { setScanError(e.message ?? 'Erreur lors du scan.'); }
    finally { setScanning(false); }
  };

  // ── Filtres — Idées ───────────────────────────────────────────────────────

  const allIdeas = useMemo(() => [...generated, ...seoIdeas], [generated]);
  const filtered = useMemo(() => allIdeas.filter(idea => {
    if (hideUsed && usedSlugs.has(idea.suggestedSlug)) return false;
    if (catFilter !== 'Toutes' && idea.category !== catFilter) return false;
    if (diffFilter !== 'toutes' && idea.difficulty !== diffFilter) return false;
    if (volFilter !== 'toutes' && idea.volume !== volFilter) return false;
    if (intentFilter !== 'toutes' && idea.intent !== intentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return idea.keyword.toLowerCase().includes(q) || idea.suggestedTitle.toLowerCase().includes(q);
    }
    return true;
  }), [allIdeas, catFilter, diffFilter, volFilter, intentFilter, search, hideUsed, usedSlugs]);

  const usedCount = useMemo(() => allIdeas.filter(i => usedSlugs.has(i.suggestedSlug)).length, [allIdeas, usedSlugs]);

  const filteredRecs = scanResult?.recommendations.filter(r => scanFilter === 'all' || r.funnel_level === scanFilter) ?? [];
  const recsByLevel = (level: FunnelLevel) => scanResult?.recommendations.filter(r => r.funnel_level === level) ?? [];

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: 'idees',       label: `Idées${generated.length > 0 ? ` · ${generated.length} IA` : ''}` },
    { id: 'analyser',    label: 'Analyser un mot-clé' },
    { id: 'scan',        label: `Scan${scanResult ? ` · ${scanResult.recommendations.length}` : ''}` },
    { id: 'bibliotheque', label: `Bibliothèque${savedIdeas.length + savedClusters.length > 0 ? ` · ${savedIdeas.length + savedClusters.length}` : ''}` },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header + onglets */}
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-1">SEO</h1>
          <p className="text-stone-500 font-light">Stratégie de contenu · Analyse de mots-clés · Scan du site</p>
        </div>
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit flex-wrap">
          {TAB_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${tab === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ONGLET : IDÉES ─────────────────────────────────────────────────── */}
      {tab === 'idees' && (
        <>
          {/* Génération IA */}
          <div className="bg-gradient-to-r from-sage/10 to-stone-50 border border-sage/20 rounded-2xl p-5">
            <p className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2"><Sparkles size={16} className="text-sage" /> Générer des idées avec l'IA</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Thème optionnel (ex: gaslighting, sevrage neuro-émotionnel, reconstruction…)"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !generating && handleGenerate()}
                className="flex-1 min-w-0 px-4 py-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:border-sage bg-white"
              />
              <button onClick={handleGenerate} disabled={generating} className="flex items-center justify-center gap-2 bg-sage text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 sm:shrink-0 w-full sm:w-auto cursor-pointer">
                {generating ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {generating ? 'Génération…' : '4 idées'}
              </button>
            </div>
            {genError && <p className="text-red-500 text-xs mt-2">{genError}</p>}
            {generated.length > 0 && !generating && (
              <p className="text-sage text-xs mt-2 font-bold">✓ {generated.length} nouvelles idées — elles apparaissent en haut de la liste.</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Idées totales',     value: seoIdeas.length, icon: BookOpen,   color: 'text-stone-700' },
              { label: 'Difficulté faible', value: seoIdeas.filter(i => i.difficulty === 'faible').length, icon: Target,     color: 'text-green-600' },
              { label: 'Volume élevé',      value: seoIdeas.filter(i => i.volume === 'élevé').length,       icon: TrendingUp, color: 'text-indigo-600' },
              { label: 'Transactionnels',   value: seoIdeas.filter(i => i.intent === 'transactionnel').length, icon: BarChart2,  color: 'text-wood' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center ${color}`}><Icon size={16} /></div>
                <div><p className="text-2xl font-bold text-stone-900">{value}</p><p className="text-xs text-stone-400 uppercase tracking-widest">{label}</p></div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <label htmlFor="seo-ideas-search" className="sr-only">Rechercher une requête ou un titre</label>
              <input id="seo-ideas-search" type="text" placeholder="Rechercher une requête ou un titre…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm outline-none focus:border-sage transition-colors" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['Toutes', ...CATEGORIES] as const).map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${catFilter === cat ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400'}`}>
                  {cat === 'Toutes' ? '🗂 Toutes' : `${CATEGORY_EMOJIS[cat]} ${cat}`}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-stone-100">
              <Filter size={13} className="text-stone-400" />
              <select value={diffFilter} onChange={e => setDiffFilter(e.target.value as any)} className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-sage">
                <option value="toutes">Toute difficulté</option>
                <option value="faible">Faible ✅</option>
                <option value="moyen">Moyenne</option>
                <option value="élevé">Élevée</option>
              </select>
              <select value={volFilter} onChange={e => setVolFilter(e.target.value as any)} className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-sage">
                <option value="toutes">Tout volume</option>
                <option value="faible">Faible</option>
                <option value="moyen">Moyen</option>
                <option value="élevé">Élevé ↑</option>
              </select>
              <select value={intentFilter} onChange={e => setIntent(e.target.value as any)} className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:border-sage">
                <option value="toutes">Toute intention</option>
                <option value="informationnel">Informationnel</option>
                <option value="transactionnel">Transactionnel 💰</option>
              </select>
              {(diffFilter !== 'toutes' || volFilter !== 'toutes' || intentFilter !== 'toutes' || search || catFilter !== 'Toutes') && (
                <button onClick={() => { setDiffFilter('toutes'); setVolFilter('toutes'); setIntent('toutes'); setSearch(''); setCatFilter('Toutes'); }}
                  className="text-xs text-red-500 hover:text-red-700 underline">Réinitialiser</button>
              )}
            </div>
          </div>

          {/* Résultats */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-400">
                <span className="font-bold text-stone-700">{filtered.length}</span> idée{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
                {hideUsed && usedCount > 0 && <span className="ml-2">· {usedCount} déjà rédigée{usedCount !== 1 ? 's' : ''} masquée{usedCount !== 1 ? 's' : ''}</span>}
              </p>
              {usedCount > 0 && (
                <button onClick={() => setHideUsed(h => !h)} className="text-xs font-bold px-3 py-1.5 rounded-full border bg-stone-100 text-stone-500 border-stone-200 hover:border-stone-400 transition-colors">
                  {hideUsed ? `Afficher les ${usedCount} déjà rédigées` : `Masquer les ${usedCount} déjà rédigées`}
                </button>
              )}
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-stone-400 italic">Aucune idée ne correspond à ces filtres.</div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map(idea => (
                  <IdeaCard key={idea.id} idea={idea} onUse={goToEditor} onSave={handleSaveIdea}
                    saved={savedIds.has(idea.id)} generated={idea.id.startsWith('generated-')} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ONGLET : ANALYSER ──────────────────────────────────────────────── */}
      {tab === 'analyser' && (
        <>
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Mot-clé graine</p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="text" value={seed} onChange={e => setSeed(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !analyzing && handleAnalyze()}
                  placeholder="ex : comment reconnaître un pervers narcissique, sortir de l'emprise…"
                  className="w-full pl-10 pr-4 py-3.5 border border-stone-200 rounded-xl text-sm outline-none focus:border-sage bg-stone-50 focus:bg-white transition-colors" />
              </div>
              <button onClick={() => handleAnalyze()} disabled={analyzing || !seed.trim()}
                className="flex items-center gap-2 bg-stone-900 hover:bg-sage text-white px-6 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors disabled:opacity-50">
                {analyzing ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {analyzing ? 'Analyse…' : 'Analyser'}
              </button>
            </div>
            {analysisError && <p className="text-red-500 text-xs mt-3">⚠️ {analysisError}</p>}
          </div>

          {analyzing && (
            <div className="flex items-center justify-center py-20 gap-4 text-stone-400">
              <Loader size={20} className="animate-spin text-sage" />
              <span className="text-sm">Google Suggest + Gemini IA en cours…</span>
            </div>
          )}

          {analysis && !analyzing && (
            <div className="grid xl:grid-cols-[240px_1fr] gap-6 items-start">
              {/* Requêtes associées */}
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-100">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Requêtes associées</p>
                  <p className="text-xs text-stone-400 mt-0.5">Cliquer pour analyser</p>
                </div>
                <div className="divide-y divide-stone-50">
                  {(analysis.topSuggestions ?? []).map((s, i) => (
                    <button key={i} onClick={() => handleAnalyze(s)}
                      className="w-full px-5 py-3 text-left flex items-center justify-between group hover:bg-stone-50 transition-colors">
                      <span className="text-sm text-stone-700 font-mono truncate pr-2">{s}</span>
                      <ChevronRight size={14} className="text-stone-300 group-hover:text-sage shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Cluster */}
              <div className="space-y-4">
                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <div className="flex flex-wrap items-center gap-2.5 mb-4">
                    <p className="font-mono text-sm bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg text-stone-800">🔍 {analysis.keyword}</p>
                    {analysis.funnel_level && <FunnelBadge v={analysis.funnel_level} />}
                    <IntentBadge v={analysis.intent} />
                    <DiffBadge v={analysis.difficulty} />
                    <VolBadge v={analysis.volume} />
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sage/10 text-sage border border-sage/20">{analysis.category}</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Lightbulb size={12} /> Opportunité SEO</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{analysis.opportunity}</p>
                  </div>
                  {analysis.rel_bridge && (
                    <div className="bg-sage/5 border border-sage/20 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-sage uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowDownToLine size={12} /> Pont vers le REL</p>
                      <p className="text-sm text-stone-700 leading-relaxed">{analysis.rel_bridge}</p>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={13} /> Cluster sémantique</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.secondaryKeywords.map((kw, i) => (
                      <span key={i} className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-700 font-mono">{kw}</span>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-6">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp size={13} /> People Also Ask</p>
                  <ul className="space-y-2.5">
                    {analysis.relatedQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700"><span className="text-sage mt-0.5 shrink-0">›</span>{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2"><BarChart2 size={13} /> Brief article</p>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest mb-1.5">Titre H1 suggéré</p>
                    <p className="font-serif text-lg font-bold text-stone-900 leading-snug">{analysis.suggestedTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest mb-1.5">URL</p>
                    <p className="font-mono text-xs text-stone-500 bg-stone-50 border border-stone-100 px-3 py-2 rounded-lg">/blog/{analysis.suggestedSlug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest mb-1.5">Accroche intro</p>
                    <p className="text-sm text-stone-600 italic leading-relaxed bg-sage/5 border border-sage/20 px-4 py-3 rounded-xl">"{analysis.suggestedIntro}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">Conseils de rédaction</p>
                    <ul className="space-y-1.5">
                      {analysis.contentTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600"><span className="text-wood shrink-0 mt-0.5">•</span> {tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleSaveCluster} disabled={saving || savedOk}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-widest border-2 transition-all disabled:opacity-60 ${savedOk ? 'border-green-400 bg-green-50 text-green-700' : 'border-stone-300 hover:border-stone-500 text-stone-600 bg-white'}`}>
                    {saving ? <Loader size={14} className="animate-spin" /> : savedOk ? <BookmarkCheck size={14} /> : <Save size={14} />}
                    {savedOk ? 'Cluster sauvegardé' : saving ? 'Sauvegarde…' : 'Sauvegarder le cluster'}
                  </button>
                  <button onClick={() => goToEditor(analysisToSeoBrief(analysis))}
                    className="flex-1 flex items-center justify-center gap-2 bg-stone-900 hover:bg-sage text-white px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors">
                    <PenLine size={14} /> Créer l'article
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ONGLET : SCAN ──────────────────────────────────────────────────── */}
      {tab === 'scan' && (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-stone-900 mb-2 flex items-center gap-2"><Layers size={18} className="text-sage" /> Scan stratégique</h2>
                <p className="text-sm text-stone-500 max-w-xl">Gemini lit tous vos articles publiés, identifie les lacunes et génère 25 mots-clés prioritaires organisés en entonnoir REL (Symptôme → Méthode → Thérapeute).</p>
              </div>
              <button onClick={handleScan} disabled={scanning}
                className="flex items-center gap-2 bg-stone-900 hover:bg-sage text-white px-6 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors disabled:opacity-50 whitespace-nowrap shrink-0">
                {scanning ? <Loader size={15} className="animate-spin" /> : <ScanLine size={15} />}
                {scanning ? 'Analyse…' : 'Scanner le site'}
              </button>
            </div>
            {scanError && <p className="text-red-500 text-xs mt-3">⚠️ {scanError}</p>}
          </div>

          {scanning && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-stone-400">
              <Loader size={28} className="animate-spin text-sage" />
              <div className="text-center">
                <p className="text-sm font-medium text-stone-600">Gemini analyse votre site…</p>
                <p className="text-xs mt-1">Lecture des articles · Détection des gaps · Génération stratégique</p>
                <p className="text-xs mt-1 text-stone-400">(15-25 secondes)</p>
              </div>
            </div>
          )}

          {scanResult && !scanning && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-sage/5 border border-sage/20 rounded-2xl p-5">
                  <p className="text-xs font-bold text-sage uppercase tracking-widest mb-2 flex items-center gap-1.5"><Lightbulb size={12} /> Stratégie recommandée</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{scanResult.strategy_summary}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Lacunes détectées</p>
                  <ul className="space-y-1.5">
                    {scanResult.coverage_gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800"><span className="mt-0.5 shrink-0">›</span>{gap}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {(['all', 'symptôme', 'méthode', 'thérapeute'] as const).map(f => (
                  <button key={f} onClick={() => setScanFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-colors ${scanFilter === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}>
                    {f === 'all' ? `Tous (${scanResult.recommendations.length})` : `${f} (${recsByLevel(f).length})`}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredRecs.map((rec, i) => {
                  const isExpanded = expandedRec === rec.suggested_slug;
                  const isCovered = !!rec.covered_by;
                  return (
                    <div key={rec.suggested_slug + i} className={`bg-white border rounded-2xl overflow-hidden transition-shadow hover:shadow-sm ${isCovered ? 'border-stone-100 opacity-60' : 'border-stone-200'}`}>
                      <div className="p-5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : rec.suggested_slug)}>
                        <div className="flex items-start gap-3">
                          <PriorityDot v={rec.priority} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <FunnelBadge v={rec.funnel_level} />
                              <DiffBadge v={rec.difficulty} />
                              <VolBadge v={rec.volume} />
                              {isCovered && <span className="px-2 py-0.5 bg-stone-100 text-stone-400 text-xs rounded-full">déjà couvert → /{rec.covered_by}</span>}
                            </div>
                            <p className="font-mono text-sm text-stone-800 mb-1">🔍 {rec.keyword}</p>
                            <p className="font-serif font-bold text-stone-900 text-base leading-snug">{rec.suggested_title}</p>
                          </div>
                          <ChevronRight size={16} className={`text-stone-300 shrink-0 transition-transform mt-1 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
                          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Opportunité</p>
                            <p className="text-sm text-amber-800">{rec.opportunity}</p>
                          </div>
                          <div className="bg-sage/5 border border-sage/20 rounded-xl px-4 py-3">
                            <p className="text-xs font-bold text-sage uppercase tracking-widest mb-1 flex items-center gap-1"><ArrowDownToLine size={11} /> Pont vers le REL</p>
                            <p className="text-sm text-stone-700">{rec.rel_bridge}</p>
                          </div>
                          {!isCovered && (
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => { setTab('analyser'); handleAnalyze(rec.keyword); }}
                                className="flex items-center gap-2 px-4 py-2.5 border-2 border-stone-300 hover:border-stone-500 text-stone-600 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                                <Sparkles size={12} /> Analyser en détail
                              </button>
                              <button onClick={() => goToEditor(scanRecToSeoBrief(rec))}
                                className="flex-1 flex items-center justify-center gap-2 bg-stone-900 hover:bg-sage text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                                <PenLine size={12} /> Créer l'article
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET : BIBLIOTHÈQUE ──────────────────────────────────────────── */}
      {tab === 'bibliotheque' && (
        <div className="space-y-10">
          {loadingLib ? (
            <div className="text-center py-16 text-stone-400 italic">Chargement…</div>
          ) : (
            <>
              {/* Briefs sauvegardés */}
              <div>
                <h2 className="font-serif text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <Bookmark size={16} className="text-sage" /> Briefs sauvegardés
                  {savedIdeas.length > 0 && <span className="text-sm font-normal text-stone-400">({savedIdeas.length})</span>}
                </h2>
                {savedIdeas.length === 0 ? (
                  <p className="text-stone-400 italic text-sm">Aucun brief sauvegardé. Cliquez sur 🔖 dans les idées.</p>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {savedIdeas.map(row => (
                      <IdeaCard key={row.id} idea={row.data} onUse={goToEditor} onDelete={() => handleDeleteIdea(row)} saved />
                    ))}
                  </div>
                )}
              </div>

              {/* Clusters sémantiques */}
              <div>
                <h2 className="font-serif text-lg font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <Target size={16} className="text-sage" /> Clusters sémantiques
                  {savedClusters.length > 0 && <span className="text-sm font-normal text-stone-400">({savedClusters.length})</span>}
                </h2>
                {savedClusters.length === 0 ? (
                  <p className="text-stone-400 italic text-sm">Aucun cluster sauvegardé. Analysez un mot-clé et sauvegardez-le.</p>
                ) : (
                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {savedClusters.map(cluster => (
                      <div key={cluster.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{cluster.category ?? '—'}</span>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {cluster.seo_keywords?.difficulty_label && <DiffBadge v={cluster.seo_keywords.difficulty_label} />}
                              {cluster.seo_keywords?.volume_label && <VolBadge v={cluster.seo_keywords.volume_label} />}
                            </div>
                          </div>
                          <p className="font-mono text-sm bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100 text-stone-800 mb-3">🔍 {cluster.focus_keyword}</p>
                          <p className="font-serif font-bold text-stone-900 text-base leading-snug mb-3">{cluster.suggested_title}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(cluster.secondary_keywords ?? []).slice(0, 6).map((kw: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-600 font-mono">{kw}</span>
                            ))}
                            {(cluster.secondary_keywords?.length ?? 0) > 6 && (
                              <span className="px-2 py-0.5 text-xs text-stone-400">+{cluster.secondary_keywords.length - 6}</span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400">
                            {new Date(cluster.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {' · '}{(cluster.secondary_keywords ?? []).length} termes
                          </p>
                        </div>
                        <div className="px-5 py-4 border-t border-stone-100 flex gap-2">
                          <button onClick={() => goToEditor(clusterToSeoBrief(cluster))}
                            className="flex-1 flex items-center justify-center gap-2 bg-stone-900 hover:bg-sage text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl transition-colors">
                            <PenLine size={14} /> Créer l'article
                          </button>
                          <button onClick={() => handleDeleteCluster(cluster.id, cluster.keyword_id)}
                            className="px-3 py-3 border border-stone-200 rounded-xl text-stone-300 hover:text-red-500 hover:border-red-200 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
