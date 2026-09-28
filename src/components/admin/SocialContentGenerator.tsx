"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Sparkles, AlertCircle, CalendarPlus, Check, Loader2, Share2 } from 'lucide-react';
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
            ? "La rédaction automatique n'est pas activée sur ce site. Contactez la personne qui gère le site."
            : data?.error || `La rédaction a échoué (erreur ${res.status}). Réessayez dans un instant.`,
        );
      }
      setBrand(brandTokens);
      setResult(data);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Erreur inconnue.');
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
      if (upsertError) throw new Error(`L'ajout au calendrier a échoué. Réessayez. (Détail : ${upsertError.message})`);
      setSaveState('saved');
    } catch (e: any) {
      setSaveError(e?.message || 'Enregistrement impossible.');
      setSaveState('error');
    }
  };

  // Le retour anticipé vient après tous les hooks : placé avant, il changeait
  // leur nombre dès que les réglages des modules finissaient de charger, et
  // React plantait (« Rendered more hooks than during the previous render »).
  if (!moduleFlags.ai_generation) {
    return null;
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-200">
        <div className="bg-stone-100 w-8 h-8 rounded-lg flex items-center justify-center text-stone-700">
          <Share2 size={16} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-stone-900">Publications pour les réseaux sociaux</p>
          <p className="text-[13px] text-stone-600">Instagram, LinkedIn et Facebook, rédigées à partir {content ? "de l'article" : 'de cette idée de sujet'}.</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {(status === 'idle' || status === 'error') && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={generate}
              disabled={!title.trim()}
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 px-4 h-10 rounded-lg font-semibold text-sm transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              {status === 'error' ? 'Réessayer' : 'Rédiger les publications'}
            </button>
            {status === 'error' && (
              <p role="alert" className="text-[13px] text-red-700 flex items-start gap-1.5">
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
          </div>
        )}

        {status === 'loading' && (
          <div role="status" className="flex items-center gap-3 text-sm text-stone-700 py-4">
            <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-800 animate-spin" />
            Rédaction en cours (Instagram, LinkedIn, Facebook)… comptez une dizaine de secondes.
          </div>
        )}

        {status === 'done' && result && brand && (
          <>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="space-y-1.5">
                <label htmlFor="social-planned-date" className="block text-[13px] font-semibold text-stone-800">
                  À publier le
                </label>
                <input
                  id="social-planned-date"
                  type="date"
                  value={plannedDate}
                  onChange={(e) => { if (e.target.value) { setPlannedDate(e.target.value); setSaveState('idle'); } }}
                  disabled={saveState === 'saving'}
                  className="px-3 h-10 border border-stone-300 rounded-lg text-sm outline-none focus:border-accent bg-white transition-colors disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={planify}
                disabled={saveState === 'saving' || saveState === 'saved'}
                className="flex items-center gap-2 px-4 h-10 rounded-lg bg-stone-100 text-stone-900 text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer"
              >
                {saveState === 'saving' && <><Loader2 size={14} className="animate-spin" /> Enregistrement…</>}
                {saveState === 'saved' && <><Check size={14} /> Dans le calendrier</>}
                {(saveState === 'idle' || saveState === 'error') && <><CalendarPlus size={14} /> Ajouter au calendrier</>}
              </button>
              {saveState === 'saved' && (
                <Link href="/admin/social" className="text-[13px] font-semibold text-accent hover:underline underline-offset-2 self-center">
                  Ouvrir le calendrier
                </Link>
              )}
              {saveState === 'error' && (
                <p role="alert" className="text-[13px] text-red-700 flex items-start gap-1.5 basis-full">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {saveError}
                </p>
              )}
              <p className="basis-full text-[13px] text-stone-700">
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
