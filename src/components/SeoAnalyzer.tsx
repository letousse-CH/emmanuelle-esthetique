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
  return s >= 80 ? 'text-emerald-700' : s >= 60 ? 'text-amber-700' : 'text-red-700';
}
function scoreBarColor(s: number) {
  return s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500';
}
const CATEGORY_LABEL: Record<string, string> = {
  meta: 'Titre et description',
  structure: 'Structure',
  contenu: 'Contenu',
  'mots-cles': 'Mots-clés',
};
const FIX_FIELD_LABEL: Record<SeoFix['field'], string> = {
  title: 'Titre',
  meta_title: 'Titre Google',
  meta_description: 'Description Google',
  content: 'Texte',
};
function typeIcon(type: string) {
  if (type === 'blocking') return <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" aria-hidden="true" />;
  if (type === 'warning')  return <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />;
  return <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
interface IssueRowProps {
  issue: SeoIssue;
  isApplied: boolean;
  onApply: () => void;
}
function IssueRow({ issue, isApplied, onApply }: IssueRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-white">
      {typeIcon(issue.type)}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-stone-900 leading-snug">{issue.message}</p>
        <p className="text-[13px] text-stone-600 mt-0.5">{CATEGORY_LABEL[issue.category] ?? issue.category}</p>
        {issue.detail && (
          <p className="text-[13px] text-stone-700 mt-1 leading-relaxed">{issue.detail}</p>
        )}
        {issue.fix && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-[13px] text-stone-800">
              <span className="font-medium text-stone-600">{FIX_FIELD_LABEL[issue.fix.field]} proposé : </span>
              <span className="break-words">{issue.fix.value}</span>
            </div>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplied}
              className={`shrink-0 flex items-center justify-center gap-1.5 text-[13px] h-8 px-3 rounded-lg font-semibold transition-colors ${
                isApplied
                  ? 'bg-emerald-50 text-emerald-800 cursor-default'
                  : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
              }`}
            >
              {isApplied ? <><CheckCircle2 size={14} /> Appliqué</> : <><Wand2 size={14} /> Appliquer</>}
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
        <p className={`text-[13px] font-semibold ${titleClass}`}>
          {title} ({issues.length})
        </p>
      </div>
      <div className="divide-y divide-stone-200">
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
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors"
      >
        <p className="text-[13px] font-semibold text-emerald-800">
          {issues.length} point{issues.length > 1 ? 's' : ''} déjà réussi{issues.length > 1 ? 's' : ''}
        </p>
        {open
          ? <ChevronUp size={16} className="text-stone-600" />
          : <ChevronDown size={16} className="text-stone-600" />
        }
      </button>
      {open && (
        <div className="divide-y divide-stone-200 border-t border-stone-200">
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
  const [fixNotice, setFixNotice] = useState('');

  const analyze = async () => {
    setStatus('loading');
    setError('');
    setFixNotice('');
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
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("Le serveur a renvoyé une réponse illisible.");
      }
      if (!res.ok || data.error) throw new Error(data.error || (raw ? `Le serveur a répondu par une erreur (${res.status}).` : 'Le serveur n\'a rien renvoyé.'));
      if (!Array.isArray(data.issues)) throw new Error("L'analyse est incomplète.");
      setResult(data as SeoAnalysisResult);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue.');
      setStatus('error');
    }
  };

  const applyFix = (issue: SeoIssue) => {
    if (!issue.fix) return;
    const { field, value, original } = issue.fix;
    setFixNotice('');

    if (field === 'content') {
      // Remplacement partiel : le reste de l'article est conservé.
      if (!original || !(formData.content || '').includes(original)) {
        setFixNotice("Ce passage a changé depuis l'analyse : la correction n'a pas été appliquée. Relancez l'analyse.");
        return;
      }
      setFormData(prev => ({
        ...prev,
        content: (prev.content || '').replace(original, value),
      }));
    } else if (field === 'title' || field === 'meta_title' || field === 'meta_description') {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      return;
    }

    setAppliedFixes(prev => new Set(prev).add(issue.id));
  };

  const blockingIssues = result?.issues.filter(i => i.type === 'blocking') ?? [];
  const warningIssues  = result?.issues.filter(i => i.type === 'warning')  ?? [];
  const successIssues  = result?.issues.filter(i => i.type === 'success')  ?? [];

  return (
    <div className="mt-8 rounded-xl border border-stone-200 bg-white overflow-hidden">

      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200">
        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
          <BarChart3 size={16} className="text-stone-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-stone-900">Vérifier le référencement</p>
          <p className="text-[13px] text-stone-600">
            Titre, description, intertitres, mots-clés et longueur, avec des corrections proposées.
          </p>
        </div>
        {result && (
          <div className={`text-2xl font-semibold tabular-nums ${scoreColor(result.score)}`}>
            {result.score}
            <span className="text-sm font-normal text-stone-600"> / 100</span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">

        {/* ── Barre de score ─────────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-1.5">
            <div className="w-full bg-stone-100 rounded-full h-2" role="img" aria-label={`Score de référencement : ${result.score} sur 100`}>
              <div
                className={`h-2 rounded-full transition-all duration-700 ${scoreBarColor(result.score)}`}
                style={{ width: `${result.score}%` }}
              />
            </div>
            <p className="text-[13px] text-stone-700">
              {blockingIssues.length > 0 && <span className="text-red-700 font-semibold">{blockingIssues.length} à corriger en priorité</span>}
              {blockingIssues.length > 0 && warningIssues.length > 0 && ' · '}
              {warningIssues.length > 0 && <span className="text-amber-800">{warningIssues.length} à améliorer</span>}
              {(blockingIssues.length > 0 || warningIssues.length > 0) && successIssues.length > 0 && ' · '}
              {successIssues.length > 0 && <span className="text-emerald-800">{successIssues.length} réussi{successIssues.length > 1 ? 's' : ''}</span>}
            </p>
          </div>
        )}

        {/* ── Mot-clé ────────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label htmlFor="seo-focus-keyword" className="block text-[13px] font-medium text-stone-800">
            Recherche principale visée
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              id="seo-focus-keyword"
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => {
                // Entrée lance l'analyse sans enregistrer tout l'article.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (status !== 'loading') analyze();
                }
              }}
              placeholder="ex : soin du visage Lausanne"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none bg-stone-50 focus:bg-white transition-colors rounded-lg"
            />
            <button
              type="button"
              onClick={analyze}
              disabled={status === 'loading'}
              className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-45 disabled:cursor-not-allowed text-stone-900 h-10 px-4 rounded-lg font-semibold text-[14px] transition-colors whitespace-nowrap"
            >
              {status === 'loading'
                ? <><div className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-800 animate-spin" /> Analyse…</>
                : <><Sparkles size={15} /> {result ? 'Relancer l\'analyse' : 'Analyser'}</>
              }
            </button>
          </div>
          <p className="text-[13px] text-stone-600">Ce que vos clientes taperaient dans Google pour trouver cet article.</p>
        </div>

        {/* ── Erreur ────────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <p role="alert" className="flex items-start gap-1.5 text-[13px] text-red-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>L&apos;analyse n&apos;a pas abouti. {error} Réessayez dans un instant.</span>
          </p>
        )}

        {fixNotice && (
          <p role="status" className="flex items-start gap-1.5 text-[13px] text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{fixNotice}</span>
          </p>
        )}

        {/* ── Résultats ─────────────────────────────────────────────────────── */}
        {status === 'done' && result && (
          <div className="space-y-3">

            {blockingIssues.length > 0 && (
              <IssueGroup
                title="À corriger en priorité"
                colorClass="border-red-200 bg-red-50"
                titleClass="text-red-800"
                issues={blockingIssues}
                appliedFixes={appliedFixes}
                onApply={applyFix}
              />
            )}

            {warningIssues.length > 0 && (
              <IssueGroup
                title="À améliorer"
                colorClass="border-amber-200 bg-amber-50"
                titleClass="text-amber-900"
                issues={warningIssues}
                appliedFixes={appliedFixes}
                onApply={applyFix}
              />
            )}

            {successIssues.length > 0 && (
              <CollapsibleSuccessGroup issues={successIssues} />
            )}

            {appliedFixes.size > 0 && (
              <button
                type="button"
                onClick={analyze}
                className="flex items-center gap-1.5 text-[13px] text-stone-800 hover:text-stone-950 font-semibold transition-colors"
              >
                <Sparkles size={14} /> Relancer l&apos;analyse ({appliedFixes.size} correction{appliedFixes.size > 1 ? 's' : ''} appliquée{appliedFixes.size > 1 ? 's' : ''})
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
