"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, AlertCircle, CalendarPlus, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { SITE_CONFIG } from '../../config/site';
import { fetchBrandTokens, BrandTokens } from '../../utils/socialCards';
import { addDaysToKey, todayKey } from '../../utils/dateKey';
import type { SocialGenerationResult } from '../../utils/socialGeneration';
import SocialResultDisplay from './SocialResultDisplay';
import { useModuleFlags } from '../../hooks/useModuleFlags';

interface Props {
  title: string;
  content?: string;
  intro?: string;
  keyword?: string;
  coverImage?: string;
  /**
   * Origine du post, reprise telle quelle dans `social_posts`. La paire
   * (`sourceType`, `sourceRef`) est unique en base : régénérer depuis le même
   * article met le calendrier à jour au lieu de créer un doublon.
   */
  sourceType?: 'article' | 'suggestion';
  sourceRef?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SocialContentGenerator({
  title, content, intro, keyword, coverImage, sourceType, sourceRef,
}: Props) {
  const moduleFlags = useModuleFlags();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<SocialGenerationResult | null>(null);
  const [error, setError] = useState('');

  if (!moduleFlags.ai_generation) {
    return null;
  }
  const [brand, setBrand] = useState<BrandTokens | null>(null);

  // ── Planification ──
  const [plannedDate, setPlannedDate] = useState(() => addDaysToKey(todayKey(), 1));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');

  const generate = async () => {
    setStatus('loading');
    setError('');
    setSaveState('idle');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const [res, brandTokens] = await Promise.all([
        fetch('/api/generate-social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ title, content, intro, keyword }),
        }),
        fetchBrandTokens(SITE_CONFIG.name),
      ]);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(
          data?.error === 'not_configured'
            ? "Clé API IA non configurée."
            : data?.error || `Génération impossible (HTTP ${res.status}).`,
        );
      }
      setBrand(brandTokens);
      setResult(data);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue');
      setStatus('error');
    }
  };

  /*
    Sans cette étape, le contenu généré ici n'existait que dans l'état du
    composant : il disparaissait au changement d'onglet, et le calendrier
    /admin/social ne voyait jamais passer un post issu d'un article ou d'une
    suggestion. Seule la boîte « Nouveau post depuis une idée » enregistrait.
  */
  const planify = async () => {
    if (!result) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const ref = sourceRef?.trim()
        || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

      const { error: upsertError } = await supabase
        .from('social_posts')
        .upsert(
          {
            source_type: sourceType ?? (content ? 'article' : 'suggestion'),
            source_ref: ref,
            title: title.trim() || 'Sans titre',
            cover_image: coverImage ?? null,
            content: result,
            planned_date: plannedDate,
            status: 'ready',
          },
          { onConflict: 'source_type,source_ref' },
        );
      if (upsertError) throw new Error(upsertError.message);
      setSaveState('saved');
    } catch (e: any) {
      setSaveError(e?.message || 'Enregistrement impossible.');
      setSaveState('error');
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-indigo-100 bg-indigo-50/40">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
          📱
        </div>
        <div>
          <p className="text-sm font-bold text-stone-900">Contenu Réseaux Sociaux</p>
          <p className="text-[12.5px] text-stone-500">Instagram, LinkedIn & Facebook — {content ? "généré depuis l'article" : "généré depuis la suggestion"}</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {(status === 'idle' || status === 'error') && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={generate}
              className="flex items-center gap-3 bg-stone-900 hover:bg-stone-700 text-white px-4 h-10 rounded-lg font-medium text-sm transition-all shadow-sm cursor-pointer"
            >
              <Sparkles size={16} />
              Générer le contenu réseaux sociaux
            </button>
            {status === 'error' && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle size={12} /> {error}
              </p>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div className="flex items-center gap-3 text-sm text-stone-500 py-4">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            Génération en cours… (Instagram, LinkedIn, Facebook)
          </div>
        )}

        {status === 'done' && result && brand && (
          <>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="space-y-1.5">
                <label htmlFor="social-planned-date" className="block text-[11px] font-semibold text-stone-500">
                  Planifier le
                </label>
                <input
                  id="social-planned-date"
                  type="date"
                  value={plannedDate}
                  onChange={(e) => { if (e.target.value) { setPlannedDate(e.target.value); setSaveState('idle'); } }}
                  disabled={saveState === 'saving'}
                  className="px-3 py-2 border border-stone-200 rounded-lg text-sm outline-none focus:border-indigo-400 bg-white transition-colors disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={planify}
                disabled={saveState === 'saving' || saveState === 'saved'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saveState === 'saving' && <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>}
                {saveState === 'saved' && <><Check size={14} /> Dans le calendrier</>}
                {(saveState === 'idle' || saveState === 'error') && <><CalendarPlus size={14} /> Ajouter au calendrier</>}
              </button>
              {saveState === 'saved' && (
                <Link href="/admin/social" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2">
                  Ouvrir le calendrier
                </Link>
              )}
              {saveState === 'error' && (
                <p className="text-xs text-red-500 flex items-center gap-1.5 basis-full">
                  <AlertCircle size={12} /> {saveError}
                </p>
              )}
              <p className="basis-full text-[12.5px] text-stone-500">
                Tant que le post n&apos;est pas ajouté au calendrier, il n&apos;est enregistré nulle part.
              </p>
            </div>

            <SocialResultDisplay
              result={result}
              brand={brand}
              coverImage={coverImage}
              onRegenerate={generate}
            />
          </>
        )}
      </div>
    </div>
  );
}
