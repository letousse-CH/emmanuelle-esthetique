"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Sparkles, Save, Eye, EyeOff, Trash2, Plus, ChevronUp, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, ExternalLink, GripVertical, ChevronRight,
  LayoutGrid, Wand2, Copy, Undo2
} from 'lucide-react';
import DynamicPageRenderer from '../../../components/pagebuilder/DynamicPageRenderer';
import { WIREFRAME_REGISTRY } from '../../../components/pagebuilder/wireframes.config';
import type { SectionType, PageSection } from '../../../components/pagebuilder/wireframes.config';
import { SECTION_LABELS, SectionPreview } from '../../../components/pagebuilder/sectionPreviews';
import FieldEditor from '../../../components/pagebuilder/FieldEditor';
import { usePageEditor } from '../../../components/pagebuilder/usePageEditor';
import { savePage, updatePage, fetchPageById, generateSlug } from '../../../services/dynamicPages';
import { supabase } from '../../../services/supabase';
import { getSeoPrefix } from '../../../services/pageMeta';
import MediaPickerModal from '../../../components/pagebuilder/MediaPickerModal';
import { SITE_CONFIG } from '../../../config/site';

type Status = 'idle' | 'generating' | 'saving' | 'success' | 'error';
type Viewport = 'mobile' | 'tablet' | 'desktop';

const VIEWPORTS: Record<Viewport, { label: string; short: string; width?: number }> = {
  mobile:  { label: 'Aperçu mobile (390 px)',  short: '📱', width: 390 },
  tablet:  { label: 'Aperçu tablette (820 px)', short: '📲', width: 820 },
  desktop: { label: 'Aperçu ordinateur',        short: '🖥', width: undefined },
};

const SECTION_CATEGORIES: { label: string; types: SectionType[] }[] = [
  { label: 'Hero', types: ['hero_1', 'hero_2', 'hero_3', 'hero_4', 'hero_5'] },
  { label: 'Contenu', types: ['intro_1', 'text_1', 'text_image_1', 'features_1', 'features_2', 'features_3', 'timeline_1'] },
  { label: 'Preuve sociale', types: ['testimonial_1', 'reviews_1', 'faq_1', 'stats_1', 'logos_1'] },
  { label: 'Médias', types: ['gallery_grid', 'gallery_carousel', 'gallery_masonry'] },
  { label: 'Action', types: ['cta_1', 'marquee_1', 'pricing_1'] },
];

// Les pages dynamiques sont servies par la route attrape-tout `(public)/[slug]`
// — il n'existe pas de route `/pages/<slug>`, que la barre de titre affichait
// pourtant comme préfixe d'URL.
const getPagePath = (slug: string) => slug === 'home' ? '/' : `/${slug}`;

/** Résumé d'une section dans la liste : son titre réel plutôt que sa description générique. */
function sectionSummary(section: PageSection): string {
  const d = section.data as unknown as Record<string, unknown>;
  const raw = [d.title, d.quote, d.content, d.eyebrow, d.price].find(v => typeof v === 'string' && v.trim());
  if (!raw) return '';
  return String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function extractTextFromSections(sections: any[]): string {
  let text = '';
  sections.forEach(sec => {
    const data = sec.data || {};
    Object.values(data).forEach(val => {
      if (typeof val === 'string') {
        text += val + ' ';
      } else if (Array.isArray(val)) {
        val.forEach(item => {
          if (typeof item === 'string') {
            text += item + ' ';
          } else if (item && typeof item === 'object') {
            Object.values(item).forEach(v => {
              if (typeof v === 'string') text += v + ' ';
            });
          }
        });
      }
    });
  });
  return text.slice(0, 4000);
}

export default function PageBuilder() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const router = useRouter();
  const isEditing = Boolean(id);

  const [prompt, setPrompt]           = useState('');
  const [title, setTitle]             = useState('');
  const [slug, setSlug]               = useState('');
  const [published, setPublished]     = useState(true);
  const [showHeader, setShowHeader]   = useState(true);
  const [showFooter, setShowFooter]   = useState(true);
  const [status, setStatus]           = useState<Status>('idle');
  const [errorMsg, setErrorMsg]       = useState('');
  const [preview, setPreview]         = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [visibleSection, setVisibleSection] = useState<number | null>(null);
  const [addPanelOpen, setAddPanelOpen]   = useState(false);
  const [addQuery, setAddQuery]           = useState('');
  const [viewport, setViewport]           = useState<Viewport>('desktop');
  const [dragIndex, setDragIndex]         = useState<number | null>(null);
  const [dropIndex, setDropIndex]         = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── États SEO ──
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgTitle, setSeoOgTitle] = useState('');
  const [seoOgDescription, setSeoOgDescription] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [genMetaStatus, setGenMetaStatus] = useState<'idle' | 'generating' | 'error'>('idle');
  // Empreinte des métadonnées telles qu'enregistrées, pour détecter les
  // modifications non sauvegardées (titre, slug, options, SEO).
  const [savedMeta, setSavedMeta] = useState('');

  const { sections, setSections, replaceAll, move, moveTo, remove, duplicate, add, updateField, undo, canUndo, dirty, markClean } =
    usePageEditor([]);

  const selectSection = (i: number) => {
    setActiveSection(prev => prev === i ? null : i);
    setAddPanelOpen(false);
    const el = previewRef.current?.querySelector(`#section-${i}`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Clic dans l'aperçu en mode édition → sélectionne la section visée. */
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const section = target.closest('[id^="section-"]');
    if (!section) return;
    const idx = parseInt(section.id.replace('section-', ''), 10);
    if (isNaN(idx)) return;
    // Neutralise les liens, boutons et accordéons de la page rendue.
    e.preventDefault();
    e.stopPropagation();
    setActiveSection(idx);
    setAddPanelOpen(false);
    sidebarRef.current
      ?.querySelector(`[data-section-item="${idx}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  /**
   * En prévisualisation, un clic sur un lien de la page quittait l'éditeur (et
   * donc les modifications non enregistrées). On ouvre la cible dans un onglet.
   */
  const handlePreviewLinkClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) return; // ancre interne : comportement normal
    e.preventDefault();
    window.open(link.href, '_blank', 'noopener');
  };

  /*
   * Suivi de la section visible dans l'aperçu. Cet observateur écrasait
   * auparavant `activeSection` : au moindre défilement il rouvrait un panneau de
   * champs que l'on venait de refermer, et refermait celui que l'on éditait.
   * Il ne pilote plus qu'un repère visuel dans la liste des sections.
   */
  useEffect(() => {
    const container = previewRef.current;
    if (!container || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const idx = parseInt(visible[0].target.id.replace('section-', ''), 10);
        if (!isNaN(idx)) setVisibleSection(idx);
      },
      { root: container, threshold: 0.3 }
    );
    sections.forEach((_, idx) => {
      const el = container.querySelector(`#section-${idx}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!id) return;
    fetchPageById(id).then(page => {
      if (!page) return;
      setTitle(page.title); setSlug(page.slug); setPublished(page.published); setSections(page.sections);
      setShowHeader(page.show_header ?? true); setShowFooter(page.show_footer ?? true);
      
      const prefix = getSeoPrefix(page.slug);
      const seo = {
        title: '', description: '', og_title: '', og_description: '', og_image: '', keywords: '',
      };
      const applySeo = () => {
        setSeoTitle(seo.title);
        setSeoDescription(seo.description);
        setSeoOgTitle(seo.og_title);
        setSeoOgDescription(seo.og_description);
        setSeoOgImage(seo.og_image);
        setSeoKeywords(seo.keywords);
        // Empreinte de référence : tout écart signalera « non enregistré ».
        setSavedMeta(JSON.stringify([
          page.title, page.slug, page.published, page.show_header ?? true, page.show_footer ?? true,
          seo.title, seo.description, seo.og_title, seo.og_description, seo.og_image, seo.keywords,
        ]));
      };

      if (!prefix) { applySeo(); return; }
      supabase.from('settings').select('key, value').like('key', `${prefix}_%`).then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
          seo.title = map[`${prefix}_title`] || '';
          seo.description = map[`${prefix}_description`] || '';
          seo.og_title = map[`${prefix}_og_title`] || '';
          seo.og_description = map[`${prefix}_og_description`] || '';
          seo.og_image = map[`${prefix}_og_image`] || '';
          seo.keywords = map[`${prefix}_keywords`] || '';
        }
        applySeo();
      });
    });
  }, [id, setSections]);

  const handleTitleChange = (v: string) => { setTitle(v); if (!isEditing) setSlug(generateSlug(v)); };

  const generate = async () => {
    if (!prompt.trim()) return;
    if (sections.length > 0 && !window.confirm('La génération remplace toutes les sections existantes. Continuer ?')) return;
    setStatus('generating'); setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-page', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ prompt }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur API');
      if (!Array.isArray(json.sections) || json.sections.length === 0) {
        throw new Error("La réponse de l'IA ne contient aucune section exploitable.");
      }
      // Une section de type inconnu casse l'aperçu : on filtre avant d'injecter.
      const known = json.sections.filter((s: PageSection) => s && WIREFRAME_REGISTRY[s.type]);
      if (known.length === 0) throw new Error("Aucune des sections générées n'est reconnue.");
      replaceAll(known);
      setActiveSection(null);
      setStatus('idle');
      if (known.length < json.sections.length) {
        setErrorMsg(`${json.sections.length - known.length} section(s) de type inconnu ignorée(s).`);
      }
    } catch (e: unknown) { setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue'); setStatus('error'); }
  };

  const save = async () => {
    if (!title.trim() || !slug.trim() || sections.length === 0) { setErrorMsg('Titre, slug et au moins une section sont obligatoires.'); setStatus('error'); return; }
    setStatus('saving'); setErrorMsg('');
    try {
      if (isEditing && id) await updatePage(id, { title, slug, sections, published, show_header: showHeader, show_footer: showFooter });
      else { const page = await savePage({ title, slug, sections, published, show_header: showHeader, show_footer: showFooter }); router.replace(`/admin/pages/edit/${page.id}`); }

      const prefix = getSeoPrefix(slug);
      if (prefix) {
        const upserts = [
          { key: `${prefix}_title`, value: seoTitle.trim() },
          { key: `${prefix}_description`, value: seoDescription.trim() },
          { key: `${prefix}_og_title`, value: seoOgTitle.trim() },
          { key: `${prefix}_og_description`, value: seoOgDescription.trim() },
          { key: `${prefix}_og_image`, value: seoOgImage.trim() },
          { key: `${prefix}_keywords`, value: seoKeywords.trim() }
        ];
        await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
      }

      markClean();
      setSavedMeta(metaSnapshot());
      setStatus('success'); setTimeout(() => setStatus(s => s === 'success' ? 'idle' : s), 2500);
    } catch (e: unknown) { setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue'); setStatus('error'); }
  };

  const generateSeoMeta = async () => {
    if (sections.length === 0) return;
    setGenMetaStatus('generating');
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const pageText = extractTextFromSections(sections);
      
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'page',
          title: title || SITE_CONFIG.name,
          content: pageText || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Erreur serveur ${res.status}`);
      
      const t = data.title || data.meta_title || data.metaTitle || '';
      const d = data.description || data.meta_description || data.metaDescription || '';
      const ot = data.og_title || data.ogTitle || t;
      const od = data.og_description || data.ogDescription || d;
      const kw = data.keywords || data.keyword || '';

      if (t) setSeoTitle(t);
      if (d) setSeoDescription(d);
      if (ot) setSeoOgTitle(ot);
      if (od) setSeoOgDescription(od);
      if (kw) setSeoKeywords(kw);
      
      setGenMetaStatus('idle');
    } catch (err: any) {
      console.error('[generateSeoMeta] error:', err);
      setErrorMsg(err.message || 'Erreur inconnue');
      setGenMetaStatus('error');
      setTimeout(() => setGenMetaStatus('idle'), 5000);
    }
  };

  /** Insère après la section sélectionnée, sinon à la fin. */
  const handleAddSection = (type: SectionType) => {
    const at = activeSection !== null ? activeSection + 1 : sections.length;
    add(type, at);
    setActiveSection(at);
    setAddPanelOpen(false);
    setAddQuery('');
  };

  const handleRemoveSection = (i: number) => {
    const label = SECTION_LABELS[sections[i].type] ?? sections[i].type;
    if (!window.confirm(`Supprimer la section « ${label} » ?`)) return;
    remove(i);
    setActiveSection(null);
  };

  // ── Réordonnancement par glisser-déposer ──
  const handleDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) {
      moveTo(dragIndex, to);
      setActiveSection(to);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const filteredCategories = React.useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return SECTION_CATEGORIES;
    return SECTION_CATEGORIES
      .map(cat => ({
        ...cat,
        types: cat.types.filter(type =>
          `${SECTION_LABELS[type] ?? ''} ${type} ${WIREFRAME_REGISTRY[type]?.description ?? ''}`
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter(cat => cat.types.length > 0);
  }, [addQuery]);

  // ── Modifications non enregistrées ──
  const metaSnapshot = () => JSON.stringify([
    title, slug, published, showHeader, showFooter,
    seoTitle, seoDescription, seoOgTitle, seoOgDescription, seoOgImage, seoKeywords,
  ]);
  const isDirty = dirty || (savedMeta !== '' && metaSnapshot() !== savedMeta);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // ⌘/Ctrl+S enregistre, ⌘/Ctrl+Z annule la dernière modification de structure.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === 's') {
        e.preventDefault();
        void saveRef.current();
      } else if (e.key === 'z' && !e.shiftKey) {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  return (
    <div className="flex flex-col h-screen bg-stone-50">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-100 px-5 py-0 flex items-center justify-between shrink-0 h-14 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/admin/pages" className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div className="h-5 w-px bg-stone-200" />
          <div className="min-w-0">
            <input
              placeholder="Titre de la page"
              className="font-semibold text-stone-900 text-sm bg-transparent focus:outline-none w-48 placeholder:text-stone-300 border-b border-transparent focus:border-sage/40 transition-colors"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
            />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-stone-300 text-[11px]">/</span>
              <input
                placeholder="slug"
                title="Adresse de la page (sans accent ni espace)"
                className="text-stone-400 text-[11px] bg-transparent focus:outline-none border-b border-transparent focus:border-stone-300 transition-colors w-32 placeholder:text-stone-200"
                value={slug}
                onChange={e => setSlug(generateSlug(e.target.value))}
              />
              {slug === 'home' && <span className="text-stone-300 text-[10px] ml-1">(page d'accueil)</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'success' && <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium"><CheckCircle2 size={13} /> Sauvegardé</span>}
          {status === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium max-w-48 truncate" title={errorMsg}><AlertCircle size={13} /> {errorMsg}</span>}
          {/* Avertissement non bloquant (ex. sections générées ignorées). */}
          {status === 'idle' && errorMsg && (
            <span className="flex items-center gap-1.5 text-amber-600 text-xs font-medium max-w-48 truncate" title={errorMsg}><AlertCircle size={13} /> {errorMsg}</span>
          )}
          {status !== 'success' && status !== 'error' && !errorMsg && isDirty && (
            <span className="text-amber-600 text-xs font-medium">Modifications non enregistrées</span>
          )}

          <button
            onClick={undo}
            disabled={!canUndo}
            title="Annuler la dernière modification (⌘/Ctrl + Z)"
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg disabled:opacity-25 transition-all cursor-pointer"
          >
            <Undo2 size={14} />
          </button>

          <button
            onClick={() => setPublished(!published)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-100 text-stone-500 border-stone-200 hover:border-stone-300'}`}
          >
            {published ? <Eye size={12} /> : <EyeOff size={12} />}
            {published ? 'Publié' : 'Brouillon'}
          </button>

          <div className="h-4 w-px bg-stone-200" />

          <button
            onClick={() => setShowHeader(!showHeader)}
            title="Afficher / masquer le header sur cette page"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showHeader ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-100 text-stone-400 border-stone-200 line-through'}`}
          >
            En-tête
          </button>
          <button
            onClick={() => setShowFooter(!showFooter)}
            title="Afficher / masquer le footer sur cette page"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showFooter ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-100 text-stone-400 border-stone-200 line-through'}`}
          >
            Pied de page
          </button>

          {published && slug && (
            <a href={getPagePath(slug)} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-400 hover:text-sage hover:bg-sage/5 rounded-lg transition-all">
              <ExternalLink size={14} />
            </a>
          )}

          <button
            onClick={save}
            disabled={status === 'saving'}
            className="flex items-center gap-1.5 bg-sage text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/80 transition-colors disabled:opacity-50 shadow-sm"
          >
            {status === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Sauvegarder
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* ── Panneau gauche ──────────────────────────────────────────── */}
        <aside className="w-full lg:w-72 max-h-[50vh] lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-stone-100 flex flex-col overflow-hidden shrink-0">
          {/* Onglets de la Sidebar */}
          <div className="flex border-b border-stone-100 bg-stone-50/50 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest text-center transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'content' ? 'border-sage text-sage bg-white' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            >
              <LayoutGrid size={13} />
              Structure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest text-center transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'seo' ? 'border-sage text-sage bg-white' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
            >
              <Sparkles size={13} />
              SEO
            </button>
          </div>

          {activeTab === 'content' ? (
            <>
              {/* Génération IA */}
              <div className="p-4 border-b border-stone-100 shrink-0 bg-white">
                <div className="flex items-center gap-2 mb-2.5">
                  <Wand2 size={13} className="text-sage" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Générer avec l'IA</p>
                </div>
                <textarea
                  rows={3}
                  placeholder="Décrivez la page souhaitée…"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sage/30 focus:border-sage/40 mb-2.5 placeholder:text-stone-300 leading-relaxed transition-all"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={generate}
                  disabled={status === 'generating' || !prompt.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-sage transition-colors disabled:opacity-40 shadow-sm cursor-pointer"
                >
                  {status === 'generating'
                    ? <><Loader2 size={13} className="animate-spin" /> Génération…</>
                    : <><Sparkles size={13} /> Générer la page</>}
                </button>
              </div>

              {/* Liste des sections */}
              <div ref={sidebarRef} className="flex-1 overflow-y-auto">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={13} className="text-stone-400" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      Sections {sections.length > 0 && <span className="text-stone-300">({sections.length})</span>}
                    </p>
                  </div>
                </div>

                {sections.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                      <LayoutGrid size={18} className="text-stone-300" />
                    </div>
                    <p className="text-sm text-stone-400 font-light leading-relaxed">
                      Générez une page ou<br />ajoutez des sections.
                    </p>
                  </div>
                ) : (
                  <div className="px-3 pb-3 space-y-1.5">
                    {sections.map((section, i) => {
                      const isActive = activeSection === i;
                      const isVisible = visibleSection === i;
                      return (
                        <div
                          key={i}
                          data-section-item={i}
                          className={`rounded-xl overflow-hidden transition-all ${
                            dropIndex === i && dragIndex !== i ? 'ring-2 ring-sage ring-offset-1' : ''
                          } ${dragIndex === i ? 'opacity-40' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDropIndex(i); }}
                          onDragLeave={() => setDropIndex(prev => (prev === i ? null : prev))}
                          onDrop={e => { e.preventDefault(); handleDrop(i); }}
                          onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                        >
                          {/* Section header — seule poignée de glisser-déposer,
                              pour ne pas gêner la saisie dans les champs. */}
                          <div
                            draggable
                            onDragStart={() => setDragIndex(i)}
                            onClick={() => selectSection(i)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all group/item ${isActive ? 'bg-sage/8 border border-sage/20' : isVisible ? 'bg-stone-100/80 border border-stone-200' : 'bg-stone-50 border border-stone-100 hover:border-stone-200 hover:bg-stone-100/60'} rounded-xl`}
                          >
                            <span title="Glisser pour réordonner" className="shrink-0 cursor-grab active:cursor-grabbing">
                              <GripVertical size={13} className="text-stone-300" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate ${isActive ? 'text-sage' : 'text-stone-600'}`}>
                                <span className="text-stone-300 font-mono mr-1">{i + 1}</span>
                                {SECTION_LABELS[section.type] ?? section.type}
                              </p>
                              <p className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">
                                {sectionSummary(section) || WIREFRAME_REGISTRY[section.type]?.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button type="button" title="Monter" onClick={e => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                                className="p-1 text-stone-300 hover:text-stone-700 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" title="Descendre" onClick={e => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                                className="p-1 text-stone-300 hover:text-stone-700 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                <ChevronDown size={12} />
                              </button>
                              <button type="button" title="Dupliquer" onClick={e => { e.stopPropagation(); duplicate(i); setActiveSection(i + 1); }}
                                className="p-1 text-stone-300 hover:text-sage hover:bg-white rounded-md transition-all cursor-pointer">
                                <Copy size={11} />
                              </button>
                              <button type="button" title="Supprimer" onClick={e => { e.stopPropagation(); handleRemoveSection(i); }}
                                className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Champs éditables */}
                          {isActive && (
                            <div className="border border-t-0 border-sage/20 rounded-b-xl bg-sage/3 px-3 py-3">
                              <FieldEditor section={section} sectionIndex={i} onUpdate={updateField} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ajouter une section */}
              <div className="border-t border-stone-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => { setAddPanelOpen(v => !v); setActiveSection(null); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <Plus size={13} className="text-sage" />
                    {activeSection !== null ? `Insérer après la section ${activeSection + 1}` : 'Ajouter une section'}
                  </span>
                  <ChevronRight size={13} className={`text-stone-300 transition-transform duration-200 ${addPanelOpen ? 'rotate-90' : ''}`} />
                </button>

                {addPanelOpen && (
                  <div className="px-3 pb-3 space-y-4 border-t border-stone-100 pt-3 max-h-[28rem] overflow-y-auto">
                    <input
                      autoFocus
                      value={addQuery}
                      onChange={e => setAddQuery(e.target.value)}
                      placeholder="Rechercher un type de section…"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sage/30 focus:border-sage/40 placeholder:text-stone-300"
                    />
                    {filteredCategories.length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-4">Aucun type de section ne correspond.</p>
                    )}
                    {filteredCategories.map(cat => (
                      <div key={cat.label}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 px-1 mb-1.5">{cat.label}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {cat.types.map(type => (
                            <button
                              type="button"
                              key={type}
                              title={WIREFRAME_REGISTRY[type]?.description}
                              onClick={() => handleAddSection(type)}
                              className="group/add flex flex-col rounded-xl border border-stone-200 bg-white overflow-hidden text-left hover:border-sage hover:shadow-sm transition-all cursor-pointer"
                            >
                              <span className="block aspect-[8/5] bg-stone-50 border-b border-stone-100 group-hover/add:bg-sage/5 transition-colors">
                                <SectionPreview type={type} />
                              </span>
                              <span className="px-2 py-1.5 text-[10px] font-semibold text-stone-600 group-hover/add:text-sage transition-colors leading-tight">
                                {SECTION_LABELS[type] ?? type}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Génération IA SEO */}
              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-3.5 space-y-3 bg-stone-50/50">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-sage" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Optimisation SEO par IA</p>
                </div>
                
                <button
                  type="button"
                  onClick={generateSeoMeta}
                  disabled={genMetaStatus === 'generating' || sections.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sage to-wood hover:opacity-95 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 shadow-sm cursor-pointer"
                >
                  {genMetaStatus === 'generating' ? (
                    <><Loader2 size={12} className="animate-spin" /> Génération…</>
                  ) : genMetaStatus === 'error' ? (
                    <><AlertCircle size={12} /> Réessayer</>
                  ) : (
                    <><Sparkles size={12} /> Générer avec l'IA</>
                  )}
                </button>

                {genMetaStatus === 'error' && errorMsg && (
                  <p className="text-[10px] text-red-500 font-medium leading-tight mt-1 text-center animate-fadein">
                    {errorMsg === 'not_configured' ? 'Clé API Gemini non configurée.' : errorMsg === 'Unauthorized' ? 'Session expirée. Veuillez vous reconnecter.' : errorMsg}
                  </p>
                )}
                
                <p className="text-[10px] text-stone-400 font-light leading-relaxed">
                  L'IA analysera le contenu des sections de votre page pour générer des balises optimisées.
                </p>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <label className="font-bold text-stone-500 uppercase tracking-widest">Meta Title</label>
                  <span className={seoTitle.length > 60 ? 'text-orange-500' : 'text-stone-400'}>{seoTitle.length}/60</span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  placeholder="Titre de la page"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <label className="font-bold text-stone-500 uppercase tracking-widest">Meta Description</label>
                  <span className={seoDescription.length > 160 ? 'text-orange-500' : 'text-stone-400'}>{seoDescription.length}/160</span>
                </div>
                <textarea
                  rows={4}
                  value={seoDescription}
                  onChange={e => setSeoDescription(e.target.value)}
                  placeholder="Description de la page..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 resize-none leading-relaxed focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                />
              </div>

              {/* OG Title */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <label className="font-bold text-stone-500 uppercase tracking-widest">OG Title</label>
                  <span className="text-stone-400">{seoOgTitle.length}</span>
                </div>
                <input
                  type="text"
                  value={seoOgTitle}
                  onChange={e => setSeoOgTitle(e.target.value)}
                  placeholder="Titre Facebook/Twitter"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                />
              </div>

              {/* OG Description */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <label className="font-bold text-stone-500 uppercase tracking-widest">OG Description</label>
                  <span className="text-stone-400">{seoOgDescription.length}</span>
                </div>
                <textarea
                  rows={3}
                  value={seoOgDescription}
                  onChange={e => setSeoOgDescription(e.target.value)}
                  placeholder="Description réseaux..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 resize-none leading-relaxed focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                />
              </div>

              {/* OG Image */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest">OG Image</label>
                {seoOgImage && (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src={seoOgImage} alt="OG" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={seoOgImage}
                    onChange={e => setSeoOgImage(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 min-w-0 focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="px-3 bg-stone-100 hover:bg-sage hover:text-white rounded-xl text-xs text-stone-600 transition-colors"
                  >
                    📁
                  </button>
                </div>
              </div>

              {/* Keywords */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest">Mots-clés</label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={e => setSeoKeywords(e.target.value)}
                  placeholder="soin du visage, head spa, gua sha..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-sage bg-white text-stone-800 focus:ring-1 focus:ring-sage/20 focus:border-sage transition-all"
                />
              </div>
            </div>
          )}
        </aside>

        {/* ── Zone de prévisualisation ─────────────────────────────── */}
        <div ref={previewRef} className="flex-1 overflow-y-auto bg-white">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-300 select-none">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-stone-300" />
              </div>
              <p className="text-xl font-light text-stone-400 mb-2">Votre page apparaîtra ici</p>
              <p className="text-sm text-stone-400">Utilisez le panneau gauche pour composer</p>
            </div>
          ) : (
            <>
              {/* Mode banner */}
              <div className={`sticky top-0 z-50 px-5 py-2 flex items-center justify-between border-b transition-colors ${preview ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-xs font-medium ${preview ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {preview ? 'Mode prévisualisation — interactions actives' : 'Mode édition — cliquez sur une section pour la modifier'}
                </p>
                <div className="flex items-center gap-4">
                  {/* Largeurs d'aperçu : vérifier le rendu mobile sans quitter l'éditeur. */}
                  {!preview && (
                    <div className="flex items-center gap-1">
                      {(['mobile', 'tablet', 'desktop'] as const).map(v => (
                        <button
                          key={v}
                          onClick={() => setViewport(v)}
                          title={VIEWPORTS[v].label}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            viewport === v ? 'bg-amber-200/70 text-amber-800' : 'text-amber-500 hover:bg-amber-100'
                          }`}
                        >
                          {VIEWPORTS[v].short}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setPreview(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${preview ? 'text-emerald-700 hover:text-emerald-900' : 'text-amber-600 hover:text-amber-800'}`}
                  >
                    {preview ? <><EyeOff size={11} /> Édition</> : <><Eye size={11} /> Prévisualiser</>}
                  </button>
                </div>
              </div>
              {/*
                En mode édition, la bannière invite à cliquer sur une section :
                l'aperçu était pourtant en `pointer-events-none`, donc rien
                n'était cliquable. On intercepte désormais le clic (les liens et
                boutons de la page restent neutralisés) pour sélectionner la
                section correspondante dans le panneau.
              */}
              <div
                className="mx-auto transition-all duration-300"
                style={{ maxWidth: preview ? undefined : VIEWPORTS[viewport].width }}
                onClickCapture={preview ? handlePreviewLinkClick : handlePreviewClick}
              >
                <DynamicPageRenderer sections={sections} />
              </div>
            </>
          )}
        </div>
      </div>
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={url => { setSeoOgImage(url); setMediaPickerOpen(false); }}
      />
    </div>
  );
}
