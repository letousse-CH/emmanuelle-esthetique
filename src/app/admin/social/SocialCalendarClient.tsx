"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, FileText, Rss, Lightbulb, PenLine, CheckCircle2,
  Archive, Trash2, X, CalendarDays, List, Plus, AlertCircle, RotateCcw, Clock, Eye,
  CalendarRange, Instagram, Linkedin, Facebook, Layers, Sparkles, Check, Image as ImageIcon, Loader2
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { SITE_CONFIG } from '../../../config/site';
import { fetchBrandTokens, BrandTokens } from '../../../utils/socialCards';
import type { SocialGenerationResult } from '../../../utils/socialGeneration';
import SocialResultDisplay, { deriveVisual, type SocialPlatformId } from '../../../components/admin/SocialResultDisplay';
import NewSocialPostDialog from './NewSocialPostDialog';
import EditorialPlanDialog from './EditorialPlanDialog';
import { renderCarouselSlide, renderHookCard, THUMBNAIL_SCALE, type SocialCardFormat } from '../../../utils/socialCards';
import { toDateKey, fromDateKey, todayKey } from '../../../utils/dateKey';

// ── Types & Meta ──────────────────────────────────────────────────────────────

type PlatformLens = 'all' | SocialPlatformId;

const PLATFORM_LENSES: { id: PlatformLens; label: string; icon: typeof Layers; color: string }[] = [
  { id: 'all',       label: 'Tous les réseaux', icon: Layers,    color: 'text-stone-700' },
  { id: 'instagram', label: 'Instagram',        icon: Instagram, color: 'text-pink-600' },
  { id: 'linkedin',  label: 'LinkedIn',         icon: Linkedin,  color: 'text-sky-600' },
  { id: 'facebook',  label: 'Facebook',         icon: Facebook,  color: 'text-indigo-600' },
];

const PLATFORM_FORMATS: Record<SocialPlatformId, SocialCardFormat> = {
  instagram: 'instagram-portrait',
  linkedin: 'linkedin-square',
  facebook: 'facebook-landscape',
};

const PLATFORM_ASPECT: Record<SocialCardFormat, string> = {
  'instagram-portrait': 'aspect-[4/5]',
  'linkedin-square': 'aspect-square',
  'facebook-landscape': 'aspect-[40/21]',
};

function visualFor(content: SocialGenerationResult, platform: SocialPlatformId): { text: string; highlight?: string } {
  if (platform === 'instagram') {
    const slide = content.instagram?.slides?.[0];
    return { text: slide?.text || content.instagram?.caption?.hook || '', highlight: slide?.highlight };
  }
  if (platform === 'linkedin') {
    return deriveVisual(content.linkedin?.visual, content.linkedin?.hook_variants?.[0] || content.linkedin?.post || '');
  }
  return deriveVisual(content.facebook?.visual, content.instagram?.caption?.hook || content.facebook?.post || '');
}

interface SocialPostRow {
  id: string;
  source_type: 'article' | 'rss' | 'suggestion' | 'manual';
  source_ref: string;
  title: string;
  cover_image: string | null;
  content: SocialGenerationResult;
  planned_date: string;
  status: 'ready' | 'posted' | 'archived';
  created_at: string;
}

type StatusFilter = 'all' | SocialPostRow['status'];

const SOURCE_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  article:    { label: 'Article',    icon: FileText,  color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  rss:        { label: 'Flux RSS',   icon: Rss,       color: 'text-orange-700 bg-orange-50 border-orange-200' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  manual:     { label: 'Création',   icon: PenLine,   color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
};
const FALLBACK_SOURCE = { label: 'Post', icon: PenLine, color: 'text-stone-700 bg-stone-100 border-stone-200' };
const sourceMeta = (type: string) => SOURCE_META[type] ?? FALLBACK_SOURCE;

const STATUS_META: Record<SocialPostRow['status'], { label: string; dot: string; chip: string }> = {
  ready:    { label: 'À publier', dot: 'bg-amber-400',  chip: 'text-amber-800 bg-amber-50 border-amber-200' },
  posted:   { label: 'Publié',    dot: 'bg-emerald-500', chip: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  archived: { label: 'Archivé',   dot: 'bg-stone-300',  chip: 'text-stone-600 bg-stone-100 border-stone-200' },
};

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all',      label: 'Tous' },
  { id: 'ready',    label: 'À publier' },
  { id: 'posted',   label: 'Publiés' },
  { id: 'archived', label: 'Archivés' },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const SHORT_DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function SocialCalendarClient() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newPostDate, setNewPostDate] = useState<string | undefined>(undefined);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandTokens | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [lens, setLens] = useState<PlatformLens>('all');

  const today = todayKey();
  const monthStart = toDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  const monthEnd = toDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));

  useEffect(() => {
    fetchBrandTokens(SITE_CONFIG.name).then(setBrand);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(timer);
  }, [flash]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = view === 'calendar'
      ? supabase.from('social_posts').select('*')
          .gte('planned_date', monthStart).lte('planned_date', monthEnd)
          .order('planned_date', { ascending: true })
      : supabase.from('social_posts').select('*')
          .order('planned_date', { ascending: false }).limit(200);

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(`Chargement impossible : ${queryError.message}`);
      setPosts([]);
    } else {
      setPosts((data || []) as SocialPostRow[]);
    }
    setLoading(false);
  }, [view, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  const visiblePosts = useMemo(
    () => (statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter)),
    [posts, statusFilter]
  );

  const counts = useMemo(() => ({
    all: posts.length,
    ready: posts.filter((p) => p.status === 'ready').length,
    posted: posts.filter((p) => p.status === 'posted').length,
    archived: posts.filter((p) => p.status === 'archived').length,
  }), [posts]);

  const lateCount = useMemo(
    () => posts.filter((p) => p.status === 'ready' && p.planned_date < today).length,
    [posts, today]
  );

  const postsByDate = useMemo(() => {
    const map: Record<string, SocialPostRow[]> = {};
    for (const post of visiblePosts) (map[post.planned_date] ||= []).push(post);
    return map;
  }, [visiblePosts]);

  const cells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
    const result: (string | null)[] = Array(leadingBlanks).fill(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(toDateKey(new Date(year, month, d)));
    return result;
  }, [currentMonth]);

  const listGroups = useMemo(() => {
    const sorted = [...visiblePosts].sort((a, b) => a.planned_date.localeCompare(b.planned_date));
    const groups: { date: string; items: SocialPostRow[] }[] = [];
    for (const post of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === post.planned_date) last.items.push(post);
      else groups.push({ date: post.planned_date, items: [post] });
    }
    return groups;
  }, [visiblePosts]);

  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : [];

  const changeStatus = async (post: SocialPostRow, status: SocialPostRow['status']) => {
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status } : p)));
    const { error: updateError } = await supabase.from('social_posts').update({ status }).eq('id', post.id);
    if (updateError) {
      setPosts(snapshot);
      setError(`Statut non enregistré : ${updateError.message}`);
    }
  };

  const changeDate = async (post: SocialPostRow, newDate: string) => {
    if (!newDate || newDate === post.planned_date) return;
    const snapshot = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, planned_date: newDate } : p)));
    const { error: updateError } = await supabase.from('social_posts').update({ planned_date: newDate }).eq('id', post.id);
    if (updateError) {
      setPosts(snapshot);
      setError(`Date non enregistrée : ${updateError.message}`);
      return;
    }
    setFlash(`« ${post.title} » déplacé au ${DAY_LABEL.format(fromDateKey(newDate))}.`);
    if (view === 'calendar' && (newDate < monthStart || newDate > monthEnd)) load();
  };

  const deletePost = async (post: SocialPostRow) => {
    if (!window.confirm(`Supprimer le post « ${post.title} » du calendrier ?`)) return;
    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const { error: deleteError } = await supabase.from('social_posts').delete().eq('id', post.id);
    if (deleteError) {
      setPosts(snapshot);
      setError(`Suppression impossible : ${deleteError.message}`);
    }
  };

  const goToDate = (date: string) => {
    setView('calendar');
    setCurrentMonth(new Date(fromDateKey(date).getFullYear(), fromDateKey(date).getMonth(), 1));
    setSelectedDate(date);
  };

  const handleOpenNewPost = (date?: string) => {
    setNewPostDate(date);
    setShowNewDialog(true);
  };

  const previewPost = useMemo(() => posts.find((p) => p.id === previewId) ?? null, [posts, previewId]);

  const renderPost = (post: SocialPostRow) => (
    <SocialPostItem
      key={post.id}
      post={post}
      today={today}
      lens={lens}
      brand={brand}
      onPreview={() => setPreviewId(post.id)}
      onStatus={(status) => changeStatus(post, status)}
      onDate={(date) => changeDate(post, date)}
      onDelete={() => deletePost(post)}
    />
  );

  return (
    <div className="space-y-6">
      {previewPost && (
        <SocialPostPreviewDialog
          post={previewPost}
          brand={brand}
          initialPlatform={lens === 'all' ? undefined : lens}
          onClose={() => setPreviewId(null)}
        />
      )}

      {showPlanDialog && (
        <EditorialPlanDialog
          onClose={() => setShowPlanDialog(false)}
          onCreated={(date) => {
            setShowPlanDialog(false);
            setFlash(`Série créée — premier post planifié au ${DAY_LABEL.format(fromDateKey(date))}.`);
            goToDate(date);
            load();
          }}
        />
      )}

      {showNewDialog && (
        <NewSocialPostDialog
          initialDate={newPostDate}
          onClose={() => { setShowNewDialog(false); setNewPostDate(undefined); }}
          onCreated={(date) => {
            setShowNewDialog(false);
            setNewPostDate(undefined);
            setFlash(`Post créé et planifié au ${DAY_LABEL.format(fromDateKey(date))}.`);
            goToDate(date);
            load();
          }}
        />
      )}

      {/* ── Cartes Synthétiques & Statistiques Conviviales ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Posts ce mois</p>
            <p className="text-xl font-bold text-stone-900">{counts.all}</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">À publier</p>
            <p className="text-xl font-bold text-amber-900">{counts.ready}</p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Déjà publiés</p>
            <p className="text-xl font-bold text-emerald-900">{counts.posted}</p>
          </div>
        </div>

        <div className={`bg-white border rounded-xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] flex items-center gap-3 ${lateCount > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-stone-200'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${lateCount > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-stone-100 text-stone-500'}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">En retard</p>
            <p className={`text-xl font-bold ${lateCount > 0 ? 'text-amber-800' : 'text-stone-900'}`}>{lateCount}</p>
          </div>
        </div>
      </div>

      {/* ── Barre d'outils Principale ───────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-stone-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        {/* Bascule Mode Calendrier vs Liste */}
        <div role="group" aria-label="Mode d'affichage" className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg shrink-0">
          {([['calendar', 'Vue Calendrier', CalendarDays], ['list', 'Vue Liste', List]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                view === id ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Filtres de statut */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              aria-pressed={statusFilter === id}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                statusFilter === id
                  ? 'bg-stone-900 border-stone-900 text-white'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {label} <span className="opacity-70 font-mono text-[11px]">({counts[id]})</span>
            </button>
          ))}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPlanDialog(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <CalendarRange size={14} className="text-stone-500" /> Planifier une série
          </button>
          <button
            onClick={() => handleOpenNewPost()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} /> Nouveau post
          </button>
        </div>
      </div>

      {/* Lentille par réseau social */}
      <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
        <span className="text-xs font-semibold text-stone-600 mr-1">Filtre Réseau :</span>
        <div role="group" aria-label="Plateforme affichée" className="flex flex-wrap gap-1.5">
          {PLATFORM_LENSES.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              aria-pressed={lens === id}
              onClick={() => setLens(id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                lens === id
                  ? 'bg-white border-stone-300 text-stone-900 shadow-xs font-bold'
                  : 'bg-transparent border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon size={14} className={color} /> {label}
            </button>
          ))}
        </div>
      </div>

      {lateCount > 0 && statusFilter !== 'archived' && statusFilter !== 'posted' && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900 font-medium">
          <Clock size={16} className="shrink-0 text-amber-700" />
          <span>{lateCount} post{lateCount > 1 ? 's' : ''} à publier {lateCount > 1 ? 'ont' : 'a'} dépassé {lateCount > 1 ? 'leur' : 'sa'} date prévue. Cliquez pour ajuster la date.</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-px" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setError(null)} aria-label="Masquer l'erreur" className="text-red-400 hover:text-red-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {flash && (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-900 font-medium">
          <CheckCircle2 size={16} className="shrink-0 mt-px text-emerald-600" />
          <span className="flex-1">{flash}</span>
          <button onClick={() => setFlash(null)} aria-label="Masquer le message" className="text-emerald-500 hover:text-emerald-800 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* VUE CALENDRIER GRANDE LISIBILITÉ                                     */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {view === 'calendar' ? (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Grille du mois avec cartes visuelles pour chaque post */}
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
            {/* Header du mois */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/50">
              <h2 className="text-base font-bold text-stone-900 capitalize">{MONTH_LABEL.format(currentMonth)}</h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  aria-label="Mois précédent"
                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentMonth(() => { const d = new Date(); d.setDate(1); return d; })}
                  className="px-3 py-1.5 text-xs font-bold text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                >
                  Aujourd'hui
                </button>
                <button
                  onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  aria-label="Mois suivant"
                  className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-xs font-bold uppercase tracking-wider text-stone-500 py-2.5 border-r border-stone-100 last:border-r-0">
                  {w}
                </div>
              ))}
            </div>

            {/* Grille des cellules du mois */}
            <div className={`grid grid-cols-7 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`blank-${i}`} className="min-h-[120px] border-b border-r border-stone-100 bg-stone-50/30" />;
                const dayPosts = postsByDate[dateStr] || [];
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`group min-h-[120px] p-2 border-b border-r border-stone-200 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected ? 'bg-sage/10 ring-2 ring-inset ring-sage' : 'bg-white hover:bg-stone-50/80'
                    }`}
                  >
                    {/* Header de la cellule (Numéro + Bouton +) */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                        isToday
                          ? 'bg-stone-900 text-white shadow-xs'
                          : isSelected
                          ? 'bg-sage text-white'
                          : 'text-stone-700 bg-stone-100 group-hover:bg-stone-200'
                      }`}>
                        {Number(dateStr.slice(-2))}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenNewPost(dateStr);
                        }}
                        title={`Planifier un post le ${dateStr}`}
                        aria-label={`Planifier un post le ${dateStr}`}
                        className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-900 rounded-md hover:bg-stone-200/60 transition-all cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Posts de la journée représentés par de VRAIES CARTES VISUELLES */}
                    <div className="space-y-1.5 flex-1 overflow-hidden">
                      {dayPosts.slice(0, 3).map((p) => {
                        const isLate = p.status === 'ready' && dateStr < today;
                        const meta = sourceMeta(p.source_type);

                        return (
                          <div
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewId(p.id);
                            }}
                            className={`w-full text-left p-2 rounded-lg border text-xs font-medium transition-all shadow-2xs hover:scale-[1.02] cursor-pointer ${
                              p.status === 'posted'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                : isLate
                                ? 'bg-amber-50 border-amber-300 text-amber-950'
                                : 'bg-white border-stone-200 text-stone-900 hover:border-stone-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider text-stone-500">
                                <meta.icon size={11} className="shrink-0" />
                                <span className="truncate">{meta.label}</span>
                              </span>

                              {p.status === 'posted' && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                              {isLate && <Clock size={12} className="text-amber-600 shrink-0" />}
                            </div>

                            <p className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-stone-900">
                              {p.title}
                            </p>
                          </div>
                        );
                      })}

                      {dayPosts.length > 3 && (
                        <div className="text-center py-0.5 text-[11px] font-bold text-stone-500 bg-stone-100 rounded-md">
                          +{dayPosts.length - 3} autre{dayPosts.length - 3 > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Légende bas de grille */}
            <div className="flex flex-wrap gap-4 px-6 py-3 border-t border-stone-200 bg-stone-50 text-xs font-medium text-stone-600">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> À publier</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Publié</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-600" /> En retard</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-300" /> Archivé</span>
            </div>
          </div>

          {/* Détail de la journée sélectionnée */}
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 space-y-4 lg:sticky lg:top-6">
            {!selectedDate ? (
              <div className="text-center py-8 space-y-2">
                <CalendarDays className="mx-auto text-stone-400" size={28} />
                <p className="text-sm font-semibold text-stone-800">Sélectionnez un jour</p>
                <p className="text-xs text-stone-500">Cliquez sur une case du calendrier pour voir et gérer les publications du jour.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-200">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Journée sélectionnée</p>
                    <h3 className="text-base font-serif font-bold text-stone-900 capitalize">
                      {DAY_LABEL.format(fromDateKey(selectedDate))}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDate(null)}
                    aria-label="Fermer"
                    className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {loading ? (
                  <p className="text-xs text-stone-500">Chargement…</p>
                ) : selectedPosts.length === 0 ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-xs text-stone-500">Aucun post planifié pour ce jour.</p>
                    <button
                      onClick={() => handleOpenNewPost(selectedDate)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Planifier un post ici
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {selectedPosts.map(renderPost)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Vue Liste Visuelle ───────────────────────────────── */
        <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-stone-500 text-sm">
              <Loader2 size={18} className="animate-spin text-stone-700" /> Chargement des publications…
            </div>
          ) : listGroups.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <CalendarDays className="mx-auto text-stone-300" size={32} />
              <p className="text-sm font-semibold text-stone-800">Aucune publication trouvée</p>
            </div>
          ) : (
            <div className="space-y-6">
              {listGroups.map(({ date, items }) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2 sticky top-0 bg-white py-2 z-10 border-b border-stone-100">
                    <button
                      onClick={() => goToDate(date)}
                      className="text-sm font-bold text-stone-900 hover:text-stone-700 transition-colors capitalize cursor-pointer flex items-center gap-2"
                    >
                      <CalendarDays size={14} className="text-stone-500" />
                      {SHORT_DAY_LABEL.format(fromDateKey(date))}
                    </button>
                    {date === today && <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                    {date < today && items.some((p) => p.status === 'ready') && (
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">En retard</span>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">{items.map(renderPost)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Composant SocialPostItem (Carte de Post) ──────────────────────────────────

function SocialPostItem({ post, today, lens, brand, onPreview, onStatus, onDate, onDelete }: {
  post: SocialPostRow;
  today: string;
  lens: PlatformLens;
  brand: BrandTokens | null;
  onPreview: () => void;
  onStatus: (status: SocialPostRow['status']) => void;
  onDate: (date: string) => void;
  onDelete: () => void;
}) {
  const meta = sourceMeta(post.source_type);
  const status = STATUS_META[post.status] ?? STATUS_META.ready;
  const isLate = post.status === 'ready' && post.planned_date < today;

  return (
    <div className={`border rounded-xl overflow-hidden bg-white shadow-2xs transition-all hover:shadow-xs ${isLate ? 'border-amber-300 bg-amber-50/20' : 'border-stone-200'}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${meta.color}`}>
              <meta.icon size={11} /> {meta.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${status.chip}`}>
              {status.label}
            </span>
          </div>

          <button
            onClick={onDelete}
            aria-label={`Supprimer le post « ${post.title} »`}
            title="Supprimer"
            className="text-stone-400 hover:text-red-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-stone-100"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <button onClick={onPreview} className="text-left w-full cursor-pointer group space-y-1">
          <p className="text-sm font-semibold text-stone-900 leading-snug group-hover:text-stone-700 transition-colors">
            {post.title}
          </p>
          <p className="text-xs text-stone-500 flex items-center gap-1.5 group-hover:text-stone-800 transition-colors">
            <Eye size={12} /> Aperçu du contenu généré
          </p>
        </button>

        {lens !== 'all' && <PlatformPreview content={post.content} platform={lens} brand={brand} onOpen={onPreview} />}

        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <input
            type="date"
            value={post.planned_date}
            onChange={(e) => onDate(e.target.value)}
            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-stone-900 bg-stone-50 text-stone-700 font-medium cursor-pointer"
          />

          <div className="flex items-center gap-1.5">
            {post.status !== 'posted' && (
              <button
                onClick={() => onStatus('posted')}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <CheckCircle2 size={12} /> Publié
              </button>
            )}
            {post.status === 'ready' && (
              <button
                onClick={() => onStatus('archived')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 bg-white hover:bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Archive size={12} /> Archiver
              </button>
            )}
            {post.status !== 'ready' && (
              <button
                onClick={() => onStatus('ready')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 bg-white hover:bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw size={12} /> Reprogrammer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Miniature du visuel pour une plateforme ────────────────────────────────────

function PlatformPreview({ content, platform, brand, onOpen }: {
  content: SocialGenerationResult;
  platform: SocialPlatformId;
  brand: BrandTokens | null;
  onOpen: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const format = PLATFORM_FORMATS[platform];
  const visual = useMemo(() => visualFor(content, platform), [content, platform]);
  const slideCount = content.instagram?.slides?.length ?? 0;

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas || !brand || !visual.text) return;
    const draw = platform === 'instagram'
      ? renderCarouselSlide({
          canvas, text: visual.text, highlight: visual.highlight,
          number: 1, total: Math.max(slideCount, 1), dark: false, brand, scale: THUMBNAIL_SCALE,
        })
      : renderHookCard({
          canvas, text: visual.text, highlight: visual.highlight,
          dark: true, brand, format, scale: THUMBNAIL_SCALE,
        });
    draw.catch((err) => console.error('[social] Rendu du visuel impossible:', err));
  }, [visible, brand, visual.text, visual.highlight, platform, format, slideCount]);

  if (!visual.text) {
    return <p className="text-xs text-stone-400 italic">Aucun visuel pour cette plateforme.</p>;
  }

  return (
    <div ref={wrapperRef} className="space-y-2 pt-1">
      <p className="text-xs text-stone-600 leading-relaxed border-l-2 border-stone-300 pl-2.5 italic">
        « {visual.text} »
      </p>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Ouvrir l'aperçu du visuel"
        className="block w-full max-w-[180px] cursor-pointer hover:opacity-90 transition-opacity"
      >
        <canvas
          ref={canvasRef}
          className={`w-full ${PLATFORM_ASPECT[format]} block rounded-lg border border-stone-200 bg-stone-100 shadow-2xs`}
        />
      </button>
    </div>
  );
}

// ── Modale Aperçu complet ─────────────────────────────────────────────────────

function SocialPostPreviewDialog({ post, brand, initialPlatform, onClose }: {
  post: SocialPostRow;
  brand: BrandTokens | null;
  initialPlatform?: SocialPlatformId;
  onClose: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const meta = sourceMeta(post.source_type);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9998] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-preview-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden outline-none border border-stone-200"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-stone-200 bg-stone-50/50 shrink-0">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md mb-1 border ${meta.color}`}>
              <meta.icon size={12} /> {meta.label}
            </span>
            <h3 id="social-preview-title" className="text-base font-bold text-stone-900 leading-snug">{post.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5 capitalize">
              Planifié le {DAY_LABEL.format(fromDateKey(post.planned_date))}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {brand ? (
            <SocialResultDisplay
              result={post.content}
              brand={brand}
              coverImage={post.cover_image || undefined}
              initialPlatform={initialPlatform}
            />
          ) : (
            <p className="text-sm text-stone-600">Chargement de la charte graphique…</p>
          )}
        </div>
      </div>
    </div>
  );
}
