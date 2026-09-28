"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, CalendarRange, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { addDaysToKey, fromDateKey, toDateKey, todayKey } from '../../../utils/dateKey';
import {
  PERIOD_LABELS, PERIOD_SIZES,
  type EditorialPeriod, type EditorialTopic,
} from '../../../types/editorial';

interface Props {
  onClose: () => void;
  /** Appelé une fois les posts créés, avec la première date planifiée. */
  onCreated: (firstDate: string) => void;
}

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Cadence lundi / mercredi / vendredi à partir de la date de départ : trois
 * publications par semaine, sans jamais tomber le week-end.
 */
function buildDates(startKey: string, count: number): string[] {
  const dates: string[] = [];
  const cursor = fromDateKey(startKey);
  // Garde-fou : au pire 120 jours balayés pour 12 dates.
  for (let guard = 0; guard < 120 && dates.length < count; guard++) {
    const day = cursor.getDay();
    if (day === 1 || day === 3 || day === 5) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function newSourceRef(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `plan-${uuid}`;
}

type Step = 'configure' | 'review' | 'generating' | 'done';

/**
 * Trois rédactions de front : assez pour diviser l'attente d'une série mensuelle,
 * assez peu pour ne pas déclencher les limites de débit de l'API.
 */
const CONCURRENCY = 3;

/**
 * Brouillon local des sujets restant à rédiger. Une série de douze posts prend
 * plusieurs minutes : sans ça, fermer l'onglet en cours de route perdrait le
 * plan et obligerait à repayer un appel IA pour le régénérer.
 */
const DRAFT_KEY = 'social-editorial-plan-draft';

function loadDraft(): EditorialTopic[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw)?.pending;
    return Array.isArray(pending) && pending.length ? pending : null;
  } catch {
    return null;
  }
}

function saveDraft(pending: EditorialTopic[]) {
  try {
    if (pending.length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ pending, savedAt: Date.now() }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la reprise est simplement perdue.
  }
}

/**
 * Génère une série de posts à partir d'une ligne éditoriale.
 *
 * Le plan (les sujets) vient d'un seul appel IA ; la rédaction se fait ensuite
 * sujet par sujet, une requête chacun — enchaîner douze rédactions dans un seul
 * appel dépasserait le budget d'exécution d'une fonction serverless.
 */
export default function EditorialPlanDialog({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [period, setPeriod] = useState<EditorialPeriod>('week');
  const [startDate, setStartDate] = useState(() => addDaysToKey(todayKey(), 1));
  const [topics, setTopics] = useState<EditorialTopic[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const cancelRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    panelRef.current?.focus();
    const draft = loadDraft();
    if (draft) { setTopics(draft); setStep('review'); setResumed(true); }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) closeRef.current(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy]);

  // Annulation au démontage réel uniquement. Regrouper ce nettoyage avec l'effet
  // clavier ci-dessus armerait l'annulation à chaque changement de `busy` — donc
  // dès le lancement de la rédaction, qui s'arrêterait avant le premier post.
  useEffect(() => () => { cancelRef.current = true; }, []);

  const proposePlan = async () => {
    setError('');
    setBusy(true);
    try {
      const dates = buildDates(startDate, PERIOD_SIZES[period]);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // Les titres déjà planifiés servent à éviter les doublons de sujet.
      const { data: existing } = await supabase
        .from('social_posts')
        .select('title')
        .order('planned_date', { ascending: false })
        .limit(60);

      const res = await fetch('/api/social-editorial-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          period,
          dates,
          existingTitles: (existing || []).map((row: { title: string }) => row.title),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(
          data?.error === 'not_configured'
            ? "La rédaction automatique n'est pas activée sur ce site. Contactez la personne qui gère le site."
            : data?.error || `Le plan n'a pas pu être proposé (erreur ${res.status}). Réessayez dans un instant.`
        );
      }
      const proposed: EditorialTopic[] = Array.isArray(data.topics) ? data.topics : [];
      setTopics(proposed);
      saveDraft(proposed);
      setResumed(false);
      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Erreur inconnue.');
    } finally {
      setBusy(false);
    }
  };

  const generateAll = async () => {
    setError('');
    setBusy(true);
    setStep('generating');
    cancelRef.current = false;
    setProgress({ done: 0, total: topics.length, failed: 0 });

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    let done = 0;
    let failed = 0;
    let cursor = 0;
    const failures: string[] = [];
    const created = new Set<number>();

    const writeOne = async (topic: EditorialTopic) => {
      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: topic.title, intro: topic.angle }),
      });
      const content = await res.json().catch(() => null);
      if (!res.ok || !content || content.error) {
        throw new Error(content?.error || `HTTP ${res.status}`);
      }
      const { error: insertError } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef(),
        title: topic.title,
        cover_image: null,
        content,
        planned_date: topic.date,
        status: 'ready',
      });
      if (insertError) throw new Error(insertError.message);
    };

    // Pool de rédacteurs : chacun pioche le sujet suivant jusqu'à épuisement.
    const worker = async () => {
      while (!cancelRef.current) {
        const index = cursor++;
        if (index >= topics.length) return;
        const topic = topics[index];
        try {
          await writeOne(topic);
          created.add(index);
          done++;
        } catch (err: any) {
          failed++;
          failures.push(`${topic.title} — ${err?.message || 'erreur inconnue'}`);
        }
        saveDraft(topics.filter((_, i) => !created.has(i)));
        setProgress({ done, total: topics.length, failed });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, topics.length) }, () => worker()),
    );

    setBusy(false);
    setStep('done');
    if (failures.length > 0) {
      setError(
        `Non rédigé${failures.length > 1 ? 's' : ''} : ${failures.join(' · ')}. ` +
        `Ces sujets sont gardés de côté : rouvrez « Planifier une série » pour les relancer.`
      );
    }
  };

  /** Le brouillon suit chaque édition : une interruption ne perd pas les retouches. */
  const applyTopics = (next: EditorialTopic[]) => { setTopics(next); saveDraft(next); };
  const removeTopic = (index: number) => applyTopics(topics.filter((_, i) => i !== index));
  const updateTopic = (index: number, patch: Partial<EditorialTopic>) =>
    applyTopics(topics.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  const dismiss = () => {
    if (progress.done > 0 && topics[0]) onCreated(topics[0].date);
    else onClose();
  };

  // Une fois la série rédigée, toute fermeture (croix, Échap, clic à côté) doit
  // rafraîchir le calendrier, sinon les nouveaux posts n'y apparaissent pas.
  const close = () => { if (step === 'done') dismiss(); else onClose(); };
  const closeRef = useRef(close);
  closeRef.current = close;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => { if (!busy) close(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editorial-plan-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
          <h3 id="editorial-plan-title" className="text-[16px] font-semibold text-stone-950 flex items-center gap-2">
            <CalendarRange size={16} className="text-stone-700" /> Planifier une série de posts
          </h3>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Fermer"
            className="p-1.5 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* ── Étape 1 : cadrage ───────────────────────────── */}
          {step === 'configure' && (
            <>
              <div className="space-y-2">
                <span id="period-label" className="block text-[14px] font-semibold text-stone-900">
                  Période à couvrir
                </span>
                <div role="radiogroup" aria-labelledby="period-label" className="grid grid-cols-2 gap-3">
                  {(['week', 'month'] as EditorialPeriod[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={period === p}
                      onClick={() => setPeriod(p)}
                      className={`p-4 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                        period === p ? 'border-accent bg-accent-soft' : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <p className="font-semibold text-stone-900 text-sm">{PERIOD_LABELS[p]}</p>
                      <p className="text-[13px] text-stone-700 mt-0.5">
                        {PERIOD_SIZES[p]} posts · lundi, mercredi, vendredi
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="plan-start" className="block text-[14px] font-semibold text-stone-900">
                  À partir du
                </label>
                <input
                  id="plan-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => e.target.value && setStartDate(e.target.value)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <p className="text-[13px] text-stone-600">
                  Les sujets seront répartis sur les prochains lundis, mercredis et vendredis.
                </p>
              </div>

              <p className="text-[13px] text-stone-700 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 leading-relaxed">
                L&apos;IA propose d&apos;abord une liste de sujets, en s&apos;appuyant sur votre ton et vos prestations
                (Paramètres &gt; Éditorial &amp; Marque). Vous relisez et corrigez cette liste avant que les posts
                soient rédigés.
              </p>
            </>
          )}

          {/* ── Étape 2 : relecture du plan ─────────────────── */}
          {step === 'review' && (
            <>
              {resumed && (
                <p className="flex items-start gap-1.5 text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  Reprise d&apos;une série interrompue : ces sujets n&apos;ont pas encore été rédigés.
                </p>
              )}
              <p className="text-[14px] text-stone-700">
                {topics.length} sujet{topics.length > 1 ? 's' : ''} à rédiger.
                Corrigez les titres et les angles, retirez ce qui ne vous parle pas.
              </p>
              <div className="space-y-2.5">
                {topics.map((topic, i) => (
                  <div key={`${topic.date}-${i}`} className="border border-stone-200 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-stone-800 first-letter:uppercase">
                          {DAY_LABEL.format(fromDateKey(topic.date))}
                        </span>
                        {topic.pillar && (
                          <span className="text-[12px] font-medium px-2 py-0.5 rounded-full border border-stone-200 bg-stone-100 text-stone-700">
                            {topic.pillar}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTopic(i)}
                        aria-label={`Retirer « ${topic.title} » du plan`}
                        title="Retirer"
                        className="text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer shrink-0 p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={`topic-title-${i}`}>Titre du sujet</label>
                    <input
                      id={`topic-title-${i}`}
                      type="text"
                      value={topic.title}
                      onChange={(e) => updateTopic(i, { title: e.target.value })}
                      className="w-full text-sm font-semibold text-stone-900 leading-snug bg-transparent border-b border-stone-200 hover:border-stone-300 focus:border-stone-900 outline-none transition-colors py-0.5"
                    />
                    <label className="sr-only" htmlFor={`topic-angle-${i}`}>Angle du sujet</label>
                    <textarea
                      id={`topic-angle-${i}`}
                      rows={3}
                      value={topic.angle}
                      onChange={(e) => updateTopic(i, { angle: e.target.value })}
                      placeholder="L'idée à faire passer, un exemple concret, ce que vos clientes doivent retenir."
                      className="w-full text-[13px] text-stone-700 leading-relaxed bg-stone-50 rounded-lg px-2.5 py-2 border border-transparent focus:border-stone-900 focus:bg-white outline-none transition-colors resize-none"
                    />
                  </div>
                ))}
              </div>
              {topics.length === 0 && (
                <p className="text-sm text-stone-700">Tous les sujets ont été retirés.</p>
              )}
            </>
          )}

          {/* ── Étape 3 : rédaction ─────────────────────────── */}
          {(step === 'generating' || step === 'done') && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {step === 'generating'
                  ? <Loader2 size={18} className="animate-spin text-accent shrink-0" />
                  : <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
                <p className="text-sm text-stone-700">
                  {step === 'generating'
                    ? `Rédaction en cours : ${progress.done + progress.failed} sur ${progress.total}`
                    : `${progress.done} post${progress.done > 1 ? 's' : ''} créé${progress.done > 1 ? 's' : ''}${progress.failed > 0 ? `, ${progress.failed} non rédigé${progress.failed > 1 ? 's' : ''}` : ''}.`}
                </p>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? ((progress.done + progress.failed) / progress.total) * 100 : 0}%` }}
                />
              </div>
              {step === 'generating' && (
                <p className="text-[13px] text-stone-700">
                  Chaque post demande une dizaine de secondes. Laissez cette fenêtre ouverte.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-stone-200 shrink-0">
          {step === 'configure' && (
            <>
              <button type="button" onClick={onClose} disabled={busy}
                className="px-4 h-10 rounded-lg bg-stone-100 text-stone-900 text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer">
                Annuler
              </button>
              <button type="button" onClick={proposePlan} disabled={busy}
                className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-45 cursor-pointer">
                {busy ? <><Loader2 size={15} className="animate-spin" /> Préparation…</> : <><Sparkles size={15} /> Proposer des sujets</>}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button type="button" onClick={() => setStep('configure')} disabled={busy}
                className="px-4 h-10 rounded-lg bg-stone-100 text-stone-900 text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer">
                Retour
              </button>
              <button type="button" onClick={generateAll} disabled={busy || topics.length === 0}
                className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-45 cursor-pointer">
                <Sparkles size={15} /> Rédiger {topics.length > 1 ? `les ${topics.length} posts` : 'le post'}
              </button>
            </>
          )}

          {step === 'generating' && (
            <button type="button" onClick={() => { cancelRef.current = true; }}
              className="px-4 h-10 rounded-lg bg-stone-100 text-stone-900 text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer">
              Arrêter après le post en cours
            </button>
          )}

          {step === 'done' && (
            <button type="button" onClick={dismiss}
              className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-45 cursor-pointer">
              Voir le calendrier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
