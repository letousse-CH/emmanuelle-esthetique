"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles, CheckCircle2, CalendarDays, Eye, Archive, Send, Loader2,
  AlertCircle, CalendarRange, ArrowRight, Palette, Instagram, Facebook,
  MapPin, Smartphone, FileText, Rss, Lightbulb, PenLine, X, Check, RefreshCw
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { SITE_CONFIG } from '../../../config/site';
import {
  fetchBrandTokens, renderCarouselSlide, renderHookCard,
  THUMBNAIL_SCALE, type BrandTokens,
} from '../../../utils/socialCards';
import type { SocialGenerationResult } from '../../../utils/socialGeneration';
import SocialResultDisplay, { deriveVisual } from '../../../components/admin/SocialResultDisplay';
import EditorialPlanDialog from './EditorialPlanDialog';
import { toDateKey, fromDateKey, todayKey, addDaysToKey } from '../../../utils/dateKey';

export interface SocialAutopilotQueueProps {
  onNavigateToCalendar?: (date?: string) => void;
  onNavigateToAssistant?: (initialPrompt?: string) => void;
  onPostsChanged?: () => void;
}

interface SocialPostRow {
  id: string;
  source_type: 'article' | 'rss' | 'suggestion' | 'manual';
  source_ref: string;
  title: string;
  cover_image: string | null;
  content: SocialGenerationResult & {
    visual_theme?: VisualThemeId;
    story?: { text?: string; highlight?: string; cta?: string };
    google_business?: { title?: string; post?: string; cta?: string };
  };
  planned_date: string;
  status: 'ready' | 'posted' | 'archived';
  created_at: string;
}

export type VisualThemeId = 'creme' | 'marin' | 'sauge' | 'photo' | 'citation';

export const VISUAL_THEMES: {
  id: VisualThemeId;
  label: string;
  subtitle: string;
  accent: string;
  dark: string;
  bgPreview: string;
  textPreview: string;
  isDarkCard: boolean;
}[] = [
  {
    id: 'creme',
    label: 'Éditorial Crème',
    subtitle: 'Douceur beige & sauge',
    accent: '#8A9A7B',
    dark: '#3A3730',
    bgPreview: '#FAF7F2',
    textPreview: '#3A3730',
    isDarkCard: false,
  },
  {
    id: 'marin',
    label: 'Marin Phytomer',
    subtitle: 'Turquoise & fraîcheur bretonne',
    accent: '#60B9C2',
    dark: '#1E3A40',
    bgPreview: '#1E3A40',
    textPreview: '#FAF7F2',
    isDarkCard: true,
  },
  {
    id: 'sauge',
    label: 'Douceur Sauge',
    subtitle: 'Végétal apaisant & brun profond',
    accent: '#8A9A7B',
    dark: '#2F382B',
    bgPreview: '#2F382B',
    textPreview: '#FAF7F2',
    isDarkCard: true,
  },
  {
    id: 'photo',
    label: 'Photo de soin',
    subtitle: 'Cabine Palézieux-Gare & rituels',
    accent: '#60B9C2',
    dark: '#3A3730',
    bgPreview: '#3A3730',
    textPreview: '#FAF7F2',
    isDarkCard: true,
  },
  {
    id: 'citation',
    label: 'Carte Conseil',
    subtitle: 'Citation centrée minimaliste',
    accent: '#8A9A7B',
    dark: '#3A3730',
    bgPreview: '#FFFFFF',
    textPreview: '#3A3730',
    isDarkCard: false,
  },
];

const SOURCE_META: Record<string, { label: string; icon: typeof FileText }> = {
  article:    { label: 'Article du blog', icon: FileText },
  rss:        { label: 'Actualité beauté', icon: Rss },
  suggestion: { label: 'Soin & Conseil', icon: Lightbulb },
  manual:     { label: 'Création sur-mesure', icon: PenLine },
};

const PILLAR_BADGE: Record<string, { label: string; className: string }> = {
  'Reconnaître':      { label: 'Reconnaître', className: 'bg-[#8A9A7B]/15 text-[#3A3730] border-[#8A9A7B]/30' },
  'Comprendre':       { label: 'Comprendre', className: 'bg-[#60B9C2]/15 text-[#1E3A40] border-[#60B9C2]/30' },
  'Passer à l\'action': { label: 'Passer à l’action', className: 'bg-amber-50 text-amber-900 border-amber-200' },
  'Sortir':           { label: 'Passer à l’action', className: 'bg-amber-50 text-amber-900 border-amber-200' },
};

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function findNextFreeCadenceDate(occupiedDates: Set<string>, fromKey: string): string {
  const cursor = fromDateKey(fromKey);
  cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < 120; i++) {
    const day = cursor.getDay();
    const key = toDateKey(cursor);
    if ((day === 1 || day === 3 || day === 5) && !occupiedDates.has(key)) {
      return key;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return addDaysToKey(fromKey, 2);
}

function newSourceRef(prefix = 'starter'): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

export default function SocialAutopilotQueue({
  onNavigateToCalendar,
  onNavigateToAssistant,
  onPostsChanged,
}: SocialAutopilotQueueProps) {
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandTokens | null>(null);

  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [generatingNow, setGeneratingNow] = useState(false);
  const [starterBusy, setStarterBusy] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPostRow | null>(null);

  const today = todayKey();
  const fourWeeksEnd = addDaysToKey(today, 28);

  useEffect(() => {
    fetchBrandTokens(SITE_CONFIG.name || 'Emmanuelle Esthétique').then(setBrand);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('social_posts')
      .select('*')
      .order('planned_date', { ascending: true })
      .limit(200);

    if (queryError) {
      setError(`Impossible de charger les propositions : ${queryError.message}`);
    } else {
      setPosts((data || []) as SocialPostRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const readyPosts = useMemo(
    () => posts.filter((p) => p.status === 'ready').sort((a, b) => a.planned_date.localeCompare(b.planned_date)),
    [posts]
  );

  const postedCount = useMemo(
    () => posts.filter((p) => p.status === 'posted').length,
    [posts]
  );

  const next4WeeksCount = useMemo(
    () => posts.filter((p) => p.status !== 'archived' && p.planned_date >= today && p.planned_date <= fourWeeksEnd).length,
    [posts, today, fourWeeksEnd]
  );

  const coveragePercent = Math.min(100, Math.round((next4WeeksCount / 12) * 100));

  const occupiedDates = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) {
      if (p.status !== 'archived') set.add(p.planned_date);
    }
    return set;
  }, [posts]);

  const handleGenerateFromSources = async () => {
    setGeneratingNow(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/social-generate-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `Erreur serveur (${res.status})`);
      }
      if (data.generated > 0) {
        setFlash(`${data.generated} nouvelle${data.generated > 1 ? 's' : ''} proposition${data.generated > 1 ? 's' : ''} prête${data.generated > 1 ? 's' : ''} à valider.`);
      } else {
        setFlash('Toutes vos nouveautés actuelles ont déjà une proposition de publication.');
      }
      await loadPosts();
      onPostsChanged?.();
    } catch (e: any) {
      setError(e?.message || 'La génération depuis vos nouveautés a rencontré un problème.');
    } finally {
      setGeneratingNow(false);
    }
  };

  const handleQuickSeed = async (
    seedId: string,
    title: string,
    intro: string,
    theme: VisualThemeId = 'creme'
  ) => {
    setStarterBusy(seedId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, intro }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || 'La rédaction automatique a échoué. Réessayez dans un instant.');
      }
      const nextDate = findNextFreeCadenceDate(occupiedDates, today);
      const enrichedContent = { ...data, visual_theme: theme };
      const { error: insertError } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef('seed'),
        title,
        cover_image: null,
        content: enrichedContent,
        planned_date: nextDate,
        status: 'ready',
      });
      if (insertError) throw new Error(insertError.message);
      setFlash(`Proposition « ${title} » créée pour le ${DAY_LABEL.format(fromDateKey(nextDate))}.`);
      await loadPosts();
      onPostsChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la création de la proposition.');
    } finally {
      setStarterBusy(null);
    }
  };

  const handleApproveAndPublish = async (post: SocialPostRow) => {
    const confirmed = window.confirm(
      `Approuver et publier « ${post.title} » maintenant ?\n\nSi vos comptes Instagram / Facebook sont connectés, le post sera envoyé directement et marqué comme « Publié » dans votre calendrier.`
    );
    if (!confirmed) return;

    setPublishingId(post.id);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const caption = post.content.instagram?.caption
        ? `${post.content.instagram.caption.hook}\n\n${post.content.instagram.caption.body}\n\n${post.content.instagram.caption.cta}`
        : post.content.facebook?.post || post.title;

      // Tentative d'envoi direct sur Instagram si configuré
      await fetch('/api/admin/social-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          platform: 'instagram',
          title: post.title,
          caption,
          imageUrl: post.cover_image || undefined,
        }),
      }).catch(() => null);

      const { error: updateErr } = await supabase
        .from('social_posts')
        .update({ status: 'posted' })
        .eq('id', post.id);

      if (updateErr) throw new Error(updateErr.message);

      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'posted' } : p)));
      setFlash(`« ${post.title} » a été approuvé et marqué comme publié.`);
      onPostsChanged?.();
    } catch (e: any) {
      setError(`Publication impossible : ${e?.message || 'Erreur inconnue'}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleApproveNextPost = async () => {
    const nextPost = readyPosts[0];
    if (!nextPost) return;
    await handleApproveAndPublish(nextPost);
  };

  const handleShiftToNextFreeSlot = async (post: SocialPostRow) => {
    const baseKey = post.planned_date > today ? post.planned_date : today;
    const nextDate = findNextFreeCadenceDate(occupiedDates, baseKey);
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, planned_date: nextDate } : p)));
    const { error: updateErr } = await supabase
      .from('social_posts')
      .update({ planned_date: nextDate })
      .eq('id', post.id);
    if (updateErr) {
      setPosts(snapshot);
      setError(`Décalage impossible : ${updateErr.message}`);
      return;
    }
    setFlash(`« ${post.title} » décalé au prochain créneau libre : ${DAY_LABEL.format(fromDateKey(nextDate))}.`);
    onPostsChanged?.();
  };

  const handleChangeDate = async (post: SocialPostRow, newDate: string) => {
    if (!newDate || newDate === post.planned_date) return;
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, planned_date: newDate } : p)));
    const { error: updateErr } = await supabase
      .from('social_posts')
      .update({ planned_date: newDate })
      .eq('id', post.id);
    if (updateErr) {
      setPosts(snapshot);
      setError(`Changement de date impossible : ${updateErr.message}`);
      return;
    }
    setFlash(`Date mise à jour au ${DAY_LABEL.format(fromDateKey(newDate))}.`);
    onPostsChanged?.();
  };

  const handleArchive = async (post: SocialPostRow) => {
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'archived' } : p)));
    const { error: updateErr } = await supabase
      .from('social_posts')
      .update({ status: 'archived' })
      .eq('id', post.id);
    if (updateErr) {
      setPosts(snapshot);
      setError(`Impossible d'écarter cette proposition : ${updateErr.message}`);
      return;
    }
    setFlash(`« ${post.title} » a été écarté de la file.`);
    onPostsChanged?.();
  };

  const handleSaveCustomizedPost = async (updated: SocialPostRow) => {
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    const { error: updateErr } = await supabase
      .from('social_posts')
      .update({
        title: updated.title,
        content: updated.content,
        cover_image: updated.cover_image,
      })
      .eq('id', updated.id);
    if (updateErr) {
      setPosts(snapshot);
      setError(`Enregistrement impossible : ${updateErr.message}`);
      return;
    }
    setEditingPost(updated);
    setFlash('L’habillage et les textes ont bien été enregistrés.');
    onPostsChanged?.();
  };

  return (
    <div className="space-y-6">
      {/* ── Bandeau d'accueil & Parcours 1-2-3 ───────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
              <Sparkles size={14} /> Studio Social · Emmanuelle Esthétique Palézieux-Gare
            </span>
            <h2 className="text-xl font-semibold text-[#3A3730]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '26px' }}>
              Vos propositions prêtes à publier
            </h2>
            <p className="text-[14px] text-stone-700 leading-relaxed">
              <strong className="font-semibold text-[#3A3730]">1.</strong> Choisissez une proposition ou préparez une série ·{' '}
              <strong className="font-semibold text-[#3A3730]">2.</strong> Ajustez l&apos;habillage visuel ·{' '}
              <strong className="font-semibold text-[#3A3730]">3.</strong> Validez en 1 clic pour planifier ou publier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPlanDialog(true)}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-[#FAF7F2] text-[13px] font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <CalendarRange size={15} /> Préparer 4 semaines de publications
            </button>
            <button
              type="button"
              onClick={handleGenerateFromSources}
              disabled={generatingNow}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-white hover:bg-stone-100 text-[#3A3730] border border-stone-300 text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {generatingNow ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {generatingNow ? 'Préparation en cours…' : 'Générer depuis mes nouveautés'}
            </button>
            {readyPosts.length > 0 && (
              <button
                type="button"
                onClick={handleApproveNextPost}
                disabled={publishingId !== null}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#8A9A7B] hover:bg-[#788869] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 size={15} /> Tout approuver &amp; publier le prochain post
              </button>
            )}
          </div>
        </div>

        {/* Indicateurs clés & barre de couverture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-stone-200/80">
          <div className="bg-white/90 rounded-xl p-4 border border-stone-200/80 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-stone-600">Prêtes à valider</p>
              <p className="text-2xl font-bold text-[#3A3730] mt-0.5">{readyPosts.length}</p>
              <p className="text-[12px] text-stone-600 mt-0.5">en attente de votre accord</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Sparkles size={18} />
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-4 border border-stone-200/80 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-stone-600">Déjà publiées</p>
              <p className="text-2xl font-bold text-[#3A3730] mt-0.5">{postedCount}</p>
              <p className="text-[12px] text-stone-600 mt-0.5">publications validées</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="bg-white/90 rounded-xl p-4 border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-stone-600">Couverture des 4 prochaines semaines</span>
              <span className="font-semibold text-[#3A3730]">{next4WeeksCount} / 12 posts (Lun · Mer · Ven)</span>
            </div>
            <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${coveragePercent}%`,
                  backgroundColor: coveragePercent >= 75 ? '#8A9A7B' : '#60B9C2',
                }}
              />
            </div>
            <p className="text-[12px] text-stone-600">
              {coveragePercent >= 100
                ? 'Votre mois est entièrement planifié avec régularité.'
                : `Encore ${Math.max(0, 12 - next4WeeksCount)} publication${12 - next4WeeksCount > 1 ? 's' : ''} pour couvrir 4 semaines complètes.`}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          <span className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-950 font-semibold cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      {flash && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-700" /> {flash}
          </span>
          {onNavigateToCalendar && (
            <button
              type="button"
              onClick={() => onNavigateToCalendar()}
              className="inline-flex items-center gap-1 font-semibold text-emerald-900 underline hover:no-underline cursor-pointer"
            >
              Voir le calendrier <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Pile / Grille de cartes "Revue Rapide en 1 clic" ─────────────────── */}
      {loading ? (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-12 text-center space-y-2">
          <Loader2 size={24} className="animate-spin mx-auto text-[#8A9A7B]" />
          <p className="text-[14px] text-stone-700">Chargement de vos propositions de publications…</p>
        </div>
      ) : readyPosts.length === 0 ? (
        /* État vide chaleureux avec 3 boutons d'amorçage immédiat */
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 md:p-10 text-center max-w-3xl mx-auto space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-stone-200 flex items-center justify-center mx-auto text-[#8A9A7B]">
            <Sparkles size={22} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-[#3A3730]" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '24px' }}>
              Aucune proposition en attente pour le moment
            </h3>
            <p className="text-[14px] text-stone-700 max-w-xl mx-auto leading-relaxed">
              Lancez une première série ou créez une publication dédiée aux soins de l&apos;institut à Palézieux-Gare. Vous pourrez relire chaque texte et choisir l&apos;écrin visuel avant de publier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            <button
              type="button"
              disabled={starterBusy !== null}
              onClick={() =>
                handleQuickSeed(
                  'phytomer',
                  'Soin Hydra Originel Phytomer : réconforter la peau face aux premiers froids',
                  'Rituels visage Phytomer à la cabine de Palézieux-Gare : pourquoi la peau tire en automne/hiver et comment le bain d’hydratation aux algues tissées bio repulpe et apaise durablement l’épiderme.',
                  'marin'
                )
              }
              className="group p-4 rounded-xl bg-white hover:bg-[#FAF7F2] border border-stone-200 hover:border-[#60B9C2] transition-all flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
            >
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#60B9C2]">
                  Visage · Phytomer
                </span>
                <p className="text-[14px] font-semibold text-[#3A3730] group-hover:text-stone-950 leading-snug">
                  Générer 1 semaine autour des soins visage Phytomer
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3A3730]">
                {starterBusy === 'phytomer' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-[#60B9C2]" />}
                {starterBusy === 'phytomer' ? 'Rédaction en cours…' : 'Préparer maintenant'}
              </span>
            </button>

            <button
              type="button"
              disabled={starterBusy !== null}
              onClick={() =>
                handleQuickSeed(
                  'cadeaux',
                  'Offrir une parenthèse de calme à Palézieux-Gare : bons cadeaux & Grand Massage Relaxant',
                  'Mettre en avant les bons cadeaux d’Emmanuelle Esthétique à Palézieux-Gare et le Grand Massage Relaxant Marine (60 ou 90 min) : une idée attentionnée pour offrir un vrai lâcher-prise.',
                  'creme'
                )
              }
              className="group p-4 rounded-xl bg-white hover:bg-[#FAF7F2] border border-stone-200 hover:border-[#8A9A7B] transition-all flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
            >
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
                  Massages &amp; Bons cadeaux
                </span>
                <p className="text-[14px] font-semibold text-[#3A3730] group-hover:text-stone-950 leading-snug">
                  Créer un post sur les bons cadeaux &amp; massages à Palézieux-Gare
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3A3730]">
                {starterBusy === 'cadeaux' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-[#8A9A7B]" />}
                {starterBusy === 'cadeaux' ? 'Rédaction en cours…' : 'Créer ce post'}
              </span>
            </button>

            <button
              type="button"
              disabled={starterBusy !== null}
              onClick={() => setShowPlanDialog(true)}
              className="group p-4 rounded-xl bg-white hover:bg-[#FAF7F2] border border-stone-200 hover:border-[#3A3730] transition-all flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
            >
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                  Calendrier complet
                </span>
                <p className="text-[14px] font-semibold text-[#3A3730] group-hover:text-stone-950 leading-snug">
                  Planifier un mois complet en 1 clic
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3A3730]">
                <CalendarRange size={14} /> Choisir mes sujets
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {readyPosts.map((post) => (
            <AutopilotPostCard
              key={post.id}
              post={post}
              today={today}
              brand={brand}
              isPublishing={publishingId === post.id}
              onApprove={() => handleApproveAndPublish(post)}
              onCustomize={() => setEditingPost(post)}
              onShiftDate={() => handleShiftToNextFreeSlot(post)}
              onChangeDate={(d) => handleChangeDate(post, d)}
              onArchive={() => handleArchive(post)}
            />
          ))}
        </div>
      )}

      {/* Modale Plan Éditorial 4 semaines */}
      {showPlanDialog && (
        <EditorialPlanDialog
          onClose={() => setShowPlanDialog(false)}
          onCreated={() => {
            setShowPlanDialog(false);
            loadPosts();
            onPostsChanged?.();
            setFlash('Votre série de publications est prête à être validée ci-dessous.');
          }}
        />
      )}

      {/* Modale Personnalisation de l'écrin & des textes */}
      {editingPost && brand && (
        <CustomizePostModal
          post={editingPost}
          brand={brand}
          onClose={() => setEditingPost(null)}
          onSave={handleSaveCustomizedPost}
          onApprove={() => {
            const target = editingPost;
            setEditingPost(null);
            handleApproveAndPublish(target);
          }}
        />
      )}
    </div>
  );
}

// ── Carte individuelle de revue rapide ───────────────────────────────────────

function AutopilotPostCard({
  post,
  today,
  brand,
  isPublishing,
  onApprove,
  onCustomize,
  onShiftDate,
  onChangeDate,
  onArchive,
}: {
  post: SocialPostRow;
  today: string;
  brand: BrandTokens | null;
  isPublishing: boolean;
  onApprove: () => void;
  onCustomize: () => void;
  onShiftDate: () => void;
  onChangeDate: (newDate: string) => void;
  onArchive: () => void;
}) {
  const [activeChannel, setActiveChannel] = useState<'instagram' | 'story' | 'facebook' | 'google'>('instagram');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const source = SOURCE_META[post.source_type] ?? SOURCE_META.manual;
  const pillarKey = post.content.pillar || 'Comprendre';
  const pillar = PILLAR_BADGE[pillarKey] ?? PILLAR_BADGE['Comprendre'];
  const isLate = post.planned_date < today;

  const currentThemeId: VisualThemeId = post.content.visual_theme || 'creme';
  const themeSpec = VISUAL_THEMES.find((t) => t.id === currentThemeId) || VISUAL_THEMES[0];

  const themedBrand: BrandTokens | null = useMemo(() => {
    if (!brand) return null;
    return {
      ...brand,
      accent: themeSpec.accent,
      dark: themeSpec.dark,
      siteName: brand.siteName || 'Emmanuelle Esthétique',
    };
  }, [brand, themeSpec]);

  const firstSlide = post.content.instagram?.slides?.[0];
  const slideCount = post.content.instagram?.slides?.length || 1;
  const igHook = post.content.instagram?.caption?.hook || firstSlide?.text || post.title;

  const storyText =
    post.content.story?.text ||
    firstSlide?.text ||
    post.content.instagram?.caption?.hook ||
    post.title;

  const fbText =
    post.content.facebook?.post ||
    `${post.content.instagram?.caption?.hook || ''}\n\n${post.content.instagram?.caption?.body || ''}`.trim();

  const googleText =
    post.content.google_business?.post ||
    `${post.content.instagram?.caption?.hook || post.title}\n\n${post.content.instagram?.caption?.body || ''}\n\n📍 Institut Emmanuelle Esthétique — Palézieux-Gare (à 1 min à pied de la gare).`.trim();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !themedBrand) return;
    if (activeChannel === 'facebook') {
      const fbVisual = deriveVisual(post.content.facebook?.visual, igHook);
      renderHookCard({
        canvas,
        text: fbVisual.text,
        highlight: fbVisual.highlight,
        dark: themeSpec.isDarkCard,
        brand: themedBrand,
        format: 'facebook-landscape',
        scale: THUMBNAIL_SCALE,
      }).catch(() => {});
    } else {
      const text = activeChannel === 'story' ? storyText : (firstSlide?.text || igHook);
      const highlight = activeChannel === 'story' ? (post.content.story?.highlight || firstSlide?.highlight) : firstSlide?.highlight;
      renderCarouselSlide({
        canvas,
        text,
        highlight,
        number: 1,
        total: activeChannel === 'story' ? 1 : slideCount,
        dark: themeSpec.isDarkCard,
        brand: themedBrand,
        scale: THUMBNAIL_SCALE,
      }).catch(() => {});
    }
  }, [themedBrand, activeChannel, firstSlide, slideCount, igHook, storyText, post.content, themeSpec.isDarkCard]);

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xs hover:border-stone-300 transition-colors">
      {/* En-tête : Date + Pilier + Source */}
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-0.5 rounded-md border ${pillar.className}`}>
              {pillar.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-0.5 rounded-md border border-stone-200 bg-white text-stone-700">
              <source.icon size={12} /> {source.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-md border border-stone-200 bg-[#FAF7F2] text-stone-700">
              <Palette size={11} /> {themeSpec.label}
            </span>
          </div>

          <label className="inline-flex items-center gap-1.5 text-[12px] text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1">
            <CalendarDays size={13} className={isLate ? 'text-amber-600' : 'text-[#8A9A7B]'} />
            <span className="font-medium">{isLate ? 'En retard :' : 'Prévu le'}</span>
            <input
              type="date"
              value={post.planned_date}
              onChange={(e) => onChangeDate(e.target.value)}
              className="text-[12px] font-semibold text-[#3A3730] bg-transparent focus:outline-none cursor-pointer"
            />
          </label>
        </div>

        {/* Titre du post */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#3A3730] leading-snug">{post.title}</h3>
        </div>

        {/* Sélecteur des 4 formats d'aperçu */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { id: 'instagram' as const, label: `Carrousel (${slideCount})`, icon: Instagram },
            { id: 'story' as const, label: 'Story 9:16', icon: Smartphone },
            { id: 'facebook' as const, label: 'Facebook', icon: Facebook },
            { id: 'google' as const, label: 'Google (Palézieux)', icon: MapPin },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChannel(tab.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                activeChannel === tab.id
                  ? 'bg-[#3A3730] text-[#FAF7F2]'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Zone d'aperçu visuel + texte d'accroche */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-white rounded-xl p-3.5 border border-stone-200">
          <div className="sm:col-span-4 flex justify-center">
            <button
              type="button"
              onClick={onCustomize}
              title="Cliquer pour personnaliser l'écrin et voir toutes les slides"
              className="relative group block w-full max-w-[140px] cursor-pointer"
            >
              <canvas
                ref={canvasRef}
                className={`w-full ${
                  activeChannel === 'facebook' ? 'aspect-[40/21]' : 'aspect-[4/5]'
                } block rounded-lg border border-stone-200 bg-stone-100 shadow-2xs`}
              />
              <span className="mt-1.5 inline-flex items-center justify-center gap-1 w-full text-[11px] font-medium text-stone-600 group-hover:text-[#3A3730]">
                <Eye size={11} /> Voir en grand
              </span>
            </button>
          </div>

          <div className="sm:col-span-8 space-y-2 min-w-0">
            {activeChannel === 'instagram' && (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
                  Accroche Instagram ({slideCount} slides)
                </span>
                <p className="text-[13px] font-medium text-[#3A3730] leading-relaxed line-clamp-3">
                  « {igHook} »
                </p>
                <p className="text-[12px] text-stone-600 line-clamp-2">
                  {post.content.instagram?.caption?.body}
                </p>
              </>
            )}

            {activeChannel === 'story' && (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#60B9C2]">
                  Story verticale 9:16
                </span>
                <p className="text-[13px] font-medium text-[#3A3730] leading-relaxed line-clamp-3">
                  « {storyText} »
                </p>
                <p className="text-[12px] text-stone-600">
                  Invitation : {post.content.story?.cta || 'Prendre rendez-vous via le lien en bio'}
                </p>
              </>
            )}

            {activeChannel === 'facebook' && (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                  Publication Facebook
                </span>
                <p className="text-[13px] text-stone-800 leading-relaxed line-clamp-4 whitespace-pre-line">
                  {fbText}
                </p>
              </>
            )}

            {activeChannel === 'google' && (
              <>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
                  Actualité Google · Palézieux-Gare
                </span>
                <p className="text-[13px] text-stone-800 leading-relaxed line-clamp-4 whitespace-pre-line">
                  {googleText}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barre d'actions en 1 clic (One-tap approval) */}
      <div className="px-5 py-3.5 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={isPublishing}
            className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#8A9A7B] hover:bg-[#788869] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>{isPublishing ? 'Publication…' : 'Approuver & Publier maintenant'}</span>
          </button>

          <button
            type="button"
            onClick={onCustomize}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#FAF7F2] hover:bg-stone-200/70 text-[#3A3730] border border-stone-200 text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Palette size={14} /> Personnaliser l&apos;écrin &amp; les textes
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onShiftDate}
            title="Décaler automatiquement au prochain Lundi, Mercredi ou Vendredi libre"
            className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12px] font-medium text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <CalendarDays size={13} /> Décaler au prochain créneau libre
          </button>

          <button
            type="button"
            onClick={onArchive}
            title="Écarter cette proposition"
            className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12px] font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Archive size={13} /> Écarter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modale de personnalisation de l'écrin & des textes ───────────────────────

function CustomizePostModal({
  post,
  brand,
  onClose,
  onSave,
  onApprove,
}: {
  post: SocialPostRow;
  brand: BrandTokens;
  onClose: () => void;
  onSave: (updated: SocialPostRow) => Promise<void>;
  onApprove: () => void;
}) {
  const [selectedTheme, setSelectedTheme] = useState<VisualThemeId>(post.content.visual_theme || 'creme');
  const [hookText, setHookText] = useState(post.content.instagram?.caption?.hook || '');
  const [bodyText, setBodyText] = useState(post.content.instagram?.caption?.body || '');
  const [ctaText, setCtaText] = useState(post.content.instagram?.caption?.cta || '');
  const [saving, setSaving] = useState(false);

  const activeTheme = VISUAL_THEMES.find((t) => t.id === selectedTheme) || VISUAL_THEMES[0];

  const themedBrand: BrandTokens = useMemo(
    () => ({
      ...brand,
      accent: activeTheme.accent,
      dark: activeTheme.dark,
      siteName: brand.siteName || 'Emmanuelle Esthétique',
    }),
    [brand, activeTheme]
  );

  const previewResult: SocialGenerationResult = useMemo(
    () => ({
      ...post.content,
      instagram: {
        ...post.content.instagram,
        caption: {
          ...post.content.instagram.caption,
          hook: hookText,
          body: bodyText,
          cta: ctaText,
        },
      },
    }),
    [post.content, hookText, bodyText, ctaText]
  );

  const handleSave = async () => {
    setSaving(true);
    const updated: SocialPostRow = {
      ...post,
      content: {
        ...previewResult,
        visual_theme: selectedTheme,
      },
    };
    await onSave(updated);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9998] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personnaliser l'écrin et les textes"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-stone-200"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-stone-200 bg-[#FAF7F2] shrink-0">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A9A7B]">
              Personnalisation de l&apos;écrin &amp; des textes
            </span>
            <h3 className="text-lg font-semibold text-[#3A3730]">{post.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          {/* Choix de l'écrin visuel */}
          <div className="space-y-2.5">
            <label className="block text-[13px] font-semibold text-[#3A3730]">
              1. Choisissez l&apos;habillage visuel de cette publication
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {VISUAL_THEMES.map((theme) => {
                const active = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-[#3A3730] ring-2 ring-[#3A3730]/15 bg-[#FAF7F2]'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-stone-300 shrink-0"
                        style={{ backgroundColor: theme.bgPreview }}
                      />
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: theme.accent }}
                      />
                      {active && <Check size={13} className="ml-auto text-[#3A3730]" />}
                    </div>
                    <p className="text-[13px] font-semibold text-[#3A3730]">{theme.label}</p>
                    <p className="text-[11px] text-stone-600 leading-tight mt-0.5">{theme.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Retouche rapide des textes */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
            <p className="text-[13px] font-semibold text-[#3A3730]">
              2. Ajustez les textes si vous souhaitez ajouter une touche personnelle
            </p>
            <div>
              <label className="block text-[12px] font-medium text-stone-700 mb-1">Phrase d&apos;accroche</label>
              <input
                type="text"
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-stone-700 mb-1">Corps du texte</label>
              <textarea
                rows={4}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:outline-none leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-stone-700 mb-1">Invitation de fin (Rendez-vous / Bio)</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[13px] text-stone-900 focus:border-[#3A3730] focus:outline-none"
              />
            </div>
          </div>

          {/* Aperçu complet multi-plateforme et téléchargement */}
          <div className="pt-2">
            <SocialResultDisplay
              result={previewResult}
              brand={themedBrand}
              coverImage={post.cover_image || undefined}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-stone-200 bg-stone-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 rounded-xl border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 text-[13px] font-semibold cursor-pointer"
          >
            Fermer
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-[#3A3730] hover:bg-stone-800 text-white text-[13px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer mes retouches
            </button>
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-[#8A9A7B] hover:bg-[#788869] text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Send size={15} /> Approuver &amp; Publier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
