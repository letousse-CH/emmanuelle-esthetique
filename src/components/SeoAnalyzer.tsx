import React, { useState } from 'react';
import {
  BarChart3, Sparkles, AlertCircle, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Wand2,
} from 'lucide-react';
import { Article } from '../types/blog';
import { supabase } from '../services/supabase';

// ── Types (miroir de netlify/functions/analyze-seo.ts) ─────────────────────────
interface SeoFix {
  field: 'title' | 'meta_title' | 'meta_description' | 'content';
  value: string;
  original?: string;
}

interface SeoIssue {
  id: string;
  type: 'blocking' | 'warning' | 'success';
  category: 'meta' | 'structure' | 'contenu' | 'mots-cles';
  message: string;
  detail: string;
  fix?: SeoFix;
}

interface SeoAnalysisResult {
  score: number;
  issues: SeoIssue[];
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface SeoAnalyzerProps {
  formData: Partial<Article>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Article>>>;
  initialKeyword?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-orange-500' : 'text-red-500';
}
function scoreBarColor(s: number) {
  return s >= 80 ? 'bg-green-400' : s >= 60 ? 'bg-orange-400' : 'bg-red-400';
}
function categoryIcon(cat: string): string {
  return ({ meta: '🏷️', structure: '🏗️', contenu: '📝', 'mots-cles': '🔑' } as Record<string, string>)[cat] ?? '📌';
}
function typeIcon(type: string) {
  if (type === 'blocking') return <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />;
  if (type === 'warning')  return <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" />;
  return <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
interface IssueRowProps {
  issue: SeoIssue;
  isApplied: boolean;
  onApply: () => void;
}
function IssueRow({ issue, isApplied, onApply }: IssueRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-white/60">
      {typeIcon(issue.type)}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-stone-800 leading-snug">
          <span className="mr-1">{categoryIcon(issue.category)}</span>
          {issue.message}
        </p>
        {issue.detail && (
          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{issue.detail}</p>
        )}
        {issue.fix && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-[11px] text-stone-600 font-mono truncate">
              → {issue.fix.value}
            </div>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplied}
              className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all ${
                isApplied
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-stone-900 text-white hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {isApplied ? <><CheckCircle2 size={11} /> Appliqué</> : <><Wand2 size={11} /> Appliquer</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface IssueGroupProps {
  title: string;
  colorClass: string;
  titleClass: string;
  issues: SeoIssue[];
  appliedFixes: Set<string>;
  onApply: (issue: SeoIssue) => void;
}
function IssueGroup({ title, colorClass, titleClass, issues, appliedFixes, onApply }: IssueGroupProps) {
  return (
    <div className={`rounded-xl border overflow-hidden ${colorClass}`}>
      <div className={`px-4 py-2.5 border-b ${colorClass}`}>
        <p className={`text-xs font-bold uppercase tracking-widest ${titleClass}`}>
          {title} ({issues.length})
        </p>
      </div>
      <div className="divide-y divide-stone-100/60">
        {issues.map(issue => (
          <IssueRow
            key={issue.id}
            issue={issue}
            isApplied={appliedFixes.has(issue.id)}
            onApply={() => onApply(issue)}
          />
        ))}
      </div>
    </div>
  );
}

interface CollapsibleSuccessGroupProps {
  issues: SeoIssue[];
}
function CollapsibleSuccessGroup({ issues }: CollapsibleSuccessGroupProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-green-50/50 transition-colors"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-green-700">
          {issues.length} point{issues.length > 1 ? 's' : ''} fort{issues.length > 1 ? 's' : ''}
        </p>
        {open
          ? <ChevronUp size={14} className="text-green-500" />
          : <ChevronDown size={14} className="text-green-500" />
        }
      </button>
      {open && (
        <div className="divide-y divide-green-100/60 border-t border-green-200">
          {issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} isApplied={false} onApply={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SeoAnalyzer({ formData, setFormData, initialKeyword }: SeoAnalyzerProps) {
  const [keyword, setKeyword]     = useState(initialKeyword || '');
  const [status, setStatus]       = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult]       = useState<SeoAnalysisResult | null>(null);
  const [error, setError]         = useState('');
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const analyze = async () => {
    setStatus('loading');
    setError('');
    setAppliedFixes(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/analyze-seo', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title:            formData.title            || '',
          meta_title:       formData.meta_title       || '',
          meta_description: formData.meta_description || '',
          content:          formData.content          || '',
          focus_keyword:    keyword.trim(),
        }),
      });

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok || data.error) throw new Error(data.error || `Erreur ${res.status}${raw ? '' : ' (réponse vide du serveur)'}`);
      setResult(data as SeoAnalysisResult);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
      setStatus('error');
    }
  };

  const applyFix = (issue: SeoIssue) => {
    if (!issue.fix) return;
    const { field, value, original } = issue.fix;

    if (field === 'content' && original) {
      // Partial HTML replace — preserves the rest of the article
      setFormData(prev => ({
        ...prev,
        content: (prev.content || '').replace(original, value),
      }));
    } else if (field === 'title' || field === 'meta_title' || field === 'meta_description') {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    setAppliedFixes(prev => new Set(prev).add(issue.id));
  };

  const blockingIssues = result?.issues.filter(i => i.type === 'blocking') ?? [];
  const warningIssues  = result?.issues.filter(i => i.type === 'warning')  ?? [];
  const successIssues  = result?.issues.filter(i => i.type === 'success')  ?? [];

  return (
    <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50/20 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-emerald-100 bg-white">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <BarChart3 size={16} className="text-emerald-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-stone-900">Analyse SEO intelligente</p>
          <p className="text-xs text-stone-400">
            Meta, structure Hn, mots-clés, longueur, maillage — avec corrections automatiques
          </p>
        </div>
        {result && (
          <div className={`text-3xl font-black tabular-nums ${scoreColor(result.score)}`}>
            {result.score}
            <span className="text-sm font-normal text-stone-300">/100</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">

        {/* ── Score bar ──────────────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-1.5">
            <div className="w-full bg-stone-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${scoreBarColor(result.score)}`}
                style={{ width: `${result.score}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>
                {blockingIssues.length > 0 && <span className="text-red-500 font-bold">{blockingIssues.length} bloquant{blockingIssues.length > 1 ? 's' : ''}</span>}
                {blockingIssues.length > 0 && warningIssues.length > 0 && ' · '}
                {warningIssues.length > 0 && <span className="text-orange-500">{warningIssues.length} avertissement{warningIssues.length > 1 ? 's' : ''}</span>}
                {(blockingIssues.length > 0 || warningIssues.length > 0) && successIssues.length > 0 && ' · '}
                {successIssues.length > 0 && <span className="text-green-600">{successIssues.length} ✓</span>}
              </span>
              <span>Score SEO global</span>
            </div>
          </div>
        )}

        {/* ── Keyword input ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && status !== 'loading' && analyze()}
              placeholder="Mot-clé focus (ex: reconnaître un pervers narcissique)"
              className="w-full pl-8 pr-4 py-2.5 text-sm border border-stone-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none bg-stone-50 focus:bg-white transition-all rounded-xl"
            />
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={status === 'loading'}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors shadow-sm whitespace-nowrap"
          >
            {status === 'loading'
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Analyse…</>
              : <><Sparkles size={15} /> {result ? 'Ré-analyser' : 'Analyser le SEO'}</>
            }
          </button>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {status === 'done' && result && (
          <div className="space-y-3">

            {blockingIssues.length > 0 && (
              <IssueGroup
                title="Bloquants"
                colorClass="border-red-200 bg-red-50/40"
                titleClass="text-red-700"
                issues={blockingIssues}
                appliedFixes={appliedFixes}
                onApply={applyFix}
              />
            )}

            {warningIssues.length > 0 && (
              <IssueGroup
                title="Avertissements"
                colorClass="border-orange-200 bg-orange-50/30"
                titleClass="text-orange-700"
                issues={warningIssues}
                appliedFixes={appliedFixes}
                onApply={applyFix}
              />
            )}

            {successIssues.length > 0 && (
              <CollapsibleSuccessGroup issues={successIssues} />
            )}

            {/* Re-analyze nudge */}
            {appliedFixes.size > 0 && (
              <button
                type="button"
                onClick={analyze}
                className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-bold transition-colors"
              >
                <Sparkles size={12} /> Ré-analyser après corrections ({appliedFixes.size} appliquée{appliedFixes.size > 1 ? 's' : ''})
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
