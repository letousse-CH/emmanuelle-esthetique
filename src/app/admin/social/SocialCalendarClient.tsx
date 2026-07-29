"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, FileText, Rss, Lightbulb, PenLine, CheckCircle2,
  Archive, Trash2, X, CalendarDays, List, Plus, AlertCircle, RotateCcw, Clock, Eye,
  CalendarRange, Instagram, Linkedin, Facebook, Layers,
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

/** Lentille de lecture : « Tous » ou une plateforme précise. */
type PlatformLens = 'all' | SocialPlatformId;

const PLATFORM_LENSES: { id: PlatformLens; label: string; icon: typeof Layers }[] = [
  { id: 'all',       label: 'Tous',      icon: Layers },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'linkedin',  label: 'LinkedIn',  icon: Linkedin },
  { id: 'facebook',  label: 'Facebook',  icon: Facebook },
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

/** Texte et surlignage du visuel d'un post pour la plateforme demandée. */
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
  article:    { label: 'Article',    icon: FileText,  color: 'text-sage bg-sage/10' },
  rss:        { label: 'Flux RSS',   icon: Rss,       color: 'text-orange-600 bg-orange-50' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'text-amber-600 bg-amber-50' },
  manual:     { label: 'Manuel',     icon: PenLine,   color: 'text-indigo-600 bg-indigo-50' },
};
const FALLBACK_SOURCE = { label: 'Source', icon: PenLine, color: 'text-stone-500 bg-stone-100' };
const sourceMeta = (type: string) => SOURCE_META[type] ?? FALLBACK_SOURCE;

const STATUS_META: Record<SocialPostRow['status'], { label: string; dot: string; chip: string }> = {
  ready:    { label: 'À publier', dot: 'bg-sage',      chip: 'text-sage bg-sage/10' },
  posted:   { label: 'Publié',    dot: 'bg-green-500', chip: 'text-green-700 bg-green-50' },
  archived: { label: 'Archivé',   dot: 'bg-stone-300', chip: 'text-stone-500 bg-stone-100' },
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
      // Vue liste : les 200 posts les plus récemment planifiés, remis en ordre
      // chronologique côté client (les retards remontent naturellement en tête).
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
    // Lundi = 0 ... Dimanche = 6
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
    // Sorti du mois affiché : il faut recharger pour ne pas le laisser en mémoire.
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
    <div className="space-y-4">
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
          onClose={() => setShowNewDialog(false)}
          onCreated={(date) => {
            setShowNewDialog(false);
            setFlash(`Post créé et planifié au ${DAY_LABEL.format(fromDateKey(date))}.`);
            goToDate(date);
            load();
          }}
        />
      )}

      {/* Barre d'outils */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Groupe de bascule, pas des onglets : ces boutons ne pilotent pas de
            panneau distinct, `aria-pressed` décrit donc mieux leur état. */}
        <div role="group" aria-label="Mode d'affichage" className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
          {([['calendar', 'Calendrier', CalendarDays], ['list', 'Liste', List]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                view === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              aria-pressed={statusFilter === id}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                statusFilter === id
                  ? 'bg-stone-900 border-stone-900 text-white'
                  : 'bg-white border-stone-200 text-stone-500 hover:border-stone-400'
              }`}
            >
              {label} <span className="opacity-60">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="lg:ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => setShowPlanDialog(true)}
            className="flex items-center justify-center gap-2 border border-sage/40 text-sage px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/5 transition-colors cursor-pointer shrink-0"
          >
            <CalendarRange size={15} /> Planifier une série
          </button>
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center justify-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/85 transition-colors cursor-pointer shrink-0"
          >
            <Plus size={15} /> Nouveau post
          </button>
        </div>
      </div>

      {/* Lentille par plateforme : change ce qu'on lit sur chaque carte. */}
      <div role="group" aria-label="Plateforme affichée" className="flex flex-wrap gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {PLATFORM_LENSES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={lens === id}
            onClick={() => setLens(id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              lens === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {lateCount > 0 && statusFilter !== 'archived' && statusFilter !== 'posted' && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Clock size={15} className="shrink-0" />
          {lateCount} post{lateCount > 1 ? 's' : ''} à publier {lateCount > 1 ? 'ont' : 'a'} dépassé {lateCount > 1 ? 'leur' : 'sa'} date prévue.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-px" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Masquer l'erreur" className="text-red-400 hover:text-red-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {flash && (
        <div className="flex items-start gap-2.5 bg-sage/10 border border-sage/20 rounded-xl px-4 py-3 text-sm text-stone-700">
          <CheckCircle2 size={15} className="shrink-0 mt-px text-sage" />
          <span className="flex-1">{flash}</span>
          <button onClick={() => setFlash(null)} aria-label="Masquer le message" className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {view === 'calendar' ? (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Grille du mois */}
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-bold text-stone-900 capitalize">{MONTH_LABEL.format(currentMonth)}</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  aria-label="Mois précédent"
                  className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentMonth(() => { const d = new Date(); d.setDate(1); return d; })}
                  className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                >
                  Ce mois
                </button>
                <button
                  onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  aria-label="Mois suivant"
                  className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-stone-100">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] font-bold uppercase tracking-widest text-stone-400 py-2">{w}</div>
              ))}
            </div>

            <div className={`grid grid-cols-7 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`blank-${i}`} className="aspect-square border-b border-r border-stone-50 bg-stone-50/30" />;
                const dayPosts = postsByDate[dateStr] || [];
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const isLate = dayPosts.some((p) => p.status === 'ready' && dateStr < today);
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    aria-current={isSelected ? 'date' : undefined}
                    aria-label={`${DAY_LABEL.format(fromDateKey(dateStr))}${dayPosts.length > 0 ? ` — ${dayPosts.length} post${dayPosts.length > 1 ? 's' : ''}` : ' — aucun post'}`}
                    className={`aspect-square border-b border-r border-stone-50 p-1.5 flex flex-col items-start gap-1 hover:bg-stone-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-sage/8 ring-1 ring-inset ring-sage/40' : ''
                    }`}
                  >
                    <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${
                      isToday ? 'bg-sage text-white' : 'text-stone-500'
                    }`}>
                      {Number(dateStr.slice(-2))}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1 min-w-0">
                        {dayPosts.slice(0, 4).map((p) => (
                          <span
                            key={p.id}
                            className={`w-1.5 h-1.5 rounded-full ${isLate && p.status === 'ready' ? 'bg-amber-500' : STATUS_META[p.status].dot}`}
                          />
                        ))}
                        {dayPosts.length > 4 && <span className="text-[9px] font-bold text-stone-400">+{dayPosts.length - 4}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3 border-t border-stone-100 text-[10px] text-stone-400">
              {(Object.keys(STATUS_META) as SocialPostRow['status'][]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} /> {STATUS_META[s].label}
                </span>
              ))}
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> En retard</span>
            </div>
          </div>

          {/* Détail du jour sélectionné */}
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5 space-y-4 lg:sticky lg:top-6">
            {!selectedDate ? (
              <p className="text-stone-400 text-sm italic">Sélectionnez un jour pour voir le contenu planifié.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-stone-900 capitalize">
                    {DAY_LABEL.format(fromDateKey(selectedDate))}
                  </h3>
                  <button onClick={() => setSelectedDate(null)} aria-label="Fermer le détail du jour" className="text-stone-400 hover:text-stone-700 cursor-pointer shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {loading ? (
                  <p className="text-stone-400 text-sm italic">Chargement…</p>
                ) : selectedPosts.length === 0 ? (
                  <p className="text-stone-400 text-sm italic">
                    {statusFilter === 'all' ? 'Rien de planifié ce jour-là.' : 'Aucun post pour ce filtre ce jour-là.'}
                  </p>
                ) : (
                  <div className="space-y-3">{selectedPosts.map(renderPost)}</div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Vue liste ─────────────────────────────────────── */
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-stone-400 text-sm">
              <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
            </div>
          ) : listGroups.length === 0 ? (
            <p className="py-12 text-center text-stone-400 text-sm italic">
              {statusFilter === 'all' ? 'Aucun post planifié pour le moment.' : 'Aucun post pour ce filtre.'}
            </p>
          ) : (
            <div className="space-y-6">
              {listGroups.map(({ date, items }) => (
                <div key={date} className="space-y-3">
                  <div className="flex items-center gap-2 sticky top-0 bg-white py-1 z-10">
                    <button
                      onClick={() => goToDate(date)}
                      className="text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-sage transition-colors capitalize cursor-pointer"
                    >
                      {SHORT_DAY_LABEL.format(fromDateKey(date))}
                    </button>
                    {date === today && <span className="text-[10px] font-bold text-sage bg-sage/10 px-2 py-0.5 rounded-full">Aujourd'hui</span>}
                    {date < today && items.some((p) => p.status === 'ready') && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">En retard</span>
                    )}
                    <span className="h-px flex-1 bg-stone-100" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">{items.map(renderPost)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
    <div className={`border rounded-xl overflow-hidden bg-white ${isLate ? 'border-amber-200' : 'border-stone-100'}`}>
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${meta.color}`}>
              <meta.icon size={10} /> {meta.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${status.chip}`}>
              {status.label}
            </span>
            {isLate && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-700 shrink-0">
                <Clock size={10} /> En retard
              </span>
            )}
          </div>
          <button
            onClick={onDelete}
            aria-label={`Supprimer le post « ${post.title} »`}
            title="Supprimer"
            className="text-stone-300 hover:text-red-500 transition-colors cursor-pointer shrink-0 p-0.5"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <button onClick={onPreview} className="text-left w-full cursor-pointer group">
          <p className="text-sm font-medium text-stone-800 leading-snug group-hover:text-sage transition-colors">{post.title}</p>
          <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1 group-hover:text-sage transition-colors">
            <Eye size={11} /> Voir le contenu généré
          </p>
        </button>

        {lens !== 'all' && <PlatformPreview content={post.content} platform={lens} brand={brand} onOpen={onPreview} />}

        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="sr-only" htmlFor={`date-${post.id}`}>Date de publication</label>
          <input
            id={`date-${post.id}`}
            type="date"
            value={post.planned_date}
            onChange={(e) => onDate(e.target.value)}
            className="text-xs border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:border-sage cursor-pointer"
          />

          {post.status !== 'posted' && (
            <button
              onClick={() => onStatus('posted')}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <CheckCircle2 size={10} /> Marquer publié
            </button>
          )}
          {post.status === 'ready' && (
            <button
              onClick={() => onStatus('archived')}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <Archive size={10} /> Archiver
            </button>
          )}
          {post.status !== 'ready' && (
            <button
              onClick={() => onStatus('ready')}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw size={10} /> Remettre à publier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook et miniature du visuel pour une plateforme donnée, sur la carte du post.
 *
 * Le canvas n'est dessiné qu'une fois la carte visible : en vue Liste, dessiner
 * d'emblée le visuel de chaque post figerait la page.
 */
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
    // Rendu best-effort : la carte reste lisible sans visuel, mais l'échec doit
    // rester visible en console plutôt que d'être avalé.
    draw.catch((err) => console.error('[social] Rendu du visuel impossible:', err));
  }, [visible, brand, visual.text, visual.highlight, platform, format, slideCount]);

  if (!visual.text) {
    return <p className="text-[11px] text-stone-400 italic">Aucun contenu pour cette plateforme.</p>;
  }

  return (
    <div ref={wrapperRef} className="space-y-2">
      <p className="text-xs text-stone-600 leading-snug border-l-2 border-stone-200 pl-2.5">
        « {visual.text} »
      </p>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Ouvrir l'aperçu du visuel"
        className="block w-full max-w-[190px] cursor-pointer"
      >
        <canvas
          ref={canvasRef}
          className={`w-full ${PLATFORM_ASPECT[format]} block rounded-lg border border-stone-100 bg-stone-100`}
        />
      </button>
    </div>
  );
}

/**
 * Aperçu du contenu généré en pleine largeur : les visuels de carrousel et les
 * légendes sont illisibles dans le panneau latéral de 380 px du calendrier.
 */
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
      className="fixed inset-0 z-[9998] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-preview-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-stone-100 shrink-0">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full mb-1.5 ${meta.color}`}>
              <meta.icon size={10} /> {meta.label}
            </span>
            <h3 id="social-preview-title" className="text-sm font-bold text-stone-900 leading-snug">{post.title}</h3>
            <p className="text-[11px] text-stone-400 mt-0.5 capitalize">
              Planifié le {DAY_LABEL.format(fromDateKey(post.planned_date))}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer l'aperçu"
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X size={16} />
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
            <p className="text-stone-400 text-sm italic">Chargement de la charte graphique…</p>
          )}
        </div>
      </div>
    </div>
  );
}
