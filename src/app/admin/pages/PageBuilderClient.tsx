"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Save, Eye, EyeOff, Trash2, Plus, ChevronUp, ChevronDown, Loader2, CheckCircle2, AlertCircle, ExternalLink, GripVertical, ChevronRight, LayoutGrid, Wand2, Copy, Undo2, Redo2, LayoutTemplate, RefreshCw, Mic, Edit3 } from 'lucide-react';
import DynamicPageRenderer from '../../../components/pagebuilder/DynamicPageRenderer';
import GlobalStyles from '../../../components/GlobalStyles';
import PreviewFrame from '../../../components/pagebuilder/PreviewFrame';
import { WIREFRAME_REGISTRY } from '../../../components/pagebuilder/wireframes.config';
import type { SectionType, PageSection } from '../../../components/pagebuilder/wireframes.config';
import { SECTION_LABELS, SectionPreview } from '../../../components/pagebuilder/sectionPreviews';
import SectionEditorModal from '../../../components/pagebuilder/SectionEditorModal';
import TemplatePicker from '../../../components/pagebuilder/TemplatePicker';
import SectionLibrary from '../../../components/pagebuilder/SectionLibrary';
import AiPageModal from '../../../components/pagebuilder/AiPageModal';
import { usePageEditor } from '../../../components/pagebuilder/usePageEditor';
import { savePage, updatePage, fetchPageById, generateSlug } from '../../../services/dynamicPages';
import { supabase } from '../../../services/supabase';
import { getSeoPrefix } from '../../../services/pageMeta';
import MediaPickerModal from '../../../components/pagebuilder/MediaPickerModal';
import { PageEditorContext } from '../../../contexts/PageEditorContext';
import { SITE_CONFIG } from '../../../config/site';
import { useModuleFlags } from '../../../hooks/useModuleFlags';

type Status = 'idle' | 'generating' | 'saving' | 'success' | 'error';
type Viewport = 'mobile' | 'tablet' | 'desktop';

const VIEWPORTS: Record<Viewport, { label: string; short: string; width?: number }> = {
  mobile:  { label: 'Aperçu mobile (390 px)',  short: '📱', width: 390 },
  tablet:  { label: 'Aperçu tablette (820 px)', short: '📲', width: 820 },
  desktop: { label: 'Aperçu ordinateur',        short: '🖥', width: undefined },
};


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

export default function PageBuilderClient() {
  const params = useParams();
  const moduleFlags = useModuleFlags();
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Une page vide n'a rien à montrer : plutôt qu'un canevas blanc, on propose
  // directement une structure. C'est le moment où un débutant décroche.
  const templateOfferedRef = useRef(false);
  const [visibleSection, setVisibleSection] = useState<number | null>(null);
  const [viewport, setViewport]           = useState<Viewport>('desktop');
  const [dragIndex, setDragIndex]         = useState<number | null>(null);
  const [dropIndex, setDropIndex]         = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // Document de l'aperçu : c'est l'iframe qui le fournit dès qu'une largeur
  // d'écran est simulée. `null` = aperçu rendu directement dans la page.
  const previewDocRef = useRef<Document | null>(null);
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

  const { sections, setSections, replaceAll, move, moveTo, remove, duplicate, add, swapType, updateField, undo, redo, canUndo, canRedo, dirty, markClean } =
    usePageEditor([]);

  const selectSection = (i: number) => {
    setActiveSection(prev => prev === i ? null : i);
    const scope: ParentNode = previewDocRef.current ?? previewRef.current ?? document;
    const el = scope.querySelector(`#section-${i}`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    // Laisse le temps au chargement de la page existante : proposer une
    // structure à quelqu'un qui vient d'ouvrir une page remplie serait absurde.
    if (templateOfferedRef.current) return;
    const timer = setTimeout(() => {
      templateOfferedRef.current = true;
      if (sections.length === 0) setTemplatePickerOpen(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [sections.length]);

  /** Clic dans l'aperçu en mode édition → sélectionne la section visée. */
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-floating-panel="true"]') || target.closest('[data-img-buttons="true"]') || target.closest('button')) return;
    const section = target.closest('[id^="section-"]');
    if (!section) return;
    const idx = parseInt(section.id.replace('section-', ''), 10);
    if (isNaN(idx)) return;
    // Neutralise les liens, boutons et accordéons de la page rendue.
    e.preventDefault();
    e.stopPropagation();
    setActiveSection(idx);
    // Le clic dans l'aperçu ouvre la configuration : c'est le geste attendu
    // quand on désigne un élément à modifier.
    setEditorOpen(true);
    sidebarRef.current
      ?.querySelector(`[data-section-item="${idx}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Raccourcis clavier globaux (⌘/Ctrl + Z, ⌘/Ctrl + Shift + Z / Y, ⌘/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (activeEl.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(activeEl.tagName));

      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
        return;
      }

      if (isCmdOrCtrl && !isInput) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            if (canRedo) redo();
          } else {
            e.preventDefault();
            if (canUndo) undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          if (canRedo) redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  /**
   * En prévisualisation, un clic sur un lien de la page quittait l'éditeur (et
   * donc les modifications non enregistrées). On ouvre la cible dans un onglet.
   */
  const handlePreviewLinkClick = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
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
    // Dans un iframe, l'observation se fait sur le document de l'aperçu ; la
    // racine reste le conteneur qui défile côté back-office.
    const scope: ParentNode = previewDocRef.current ?? container;
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
      const el = scope.querySelector(`#section-${idx}`);
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

  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleAiGenerate = async (promptText: string) => {
    if (!promptText.trim()) return;
    setStatus('generating'); setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/generate-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prompt: promptText })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur API lors de la génération.');
      if (!Array.isArray(json.sections) || json.sections.length === 0) {
        throw new Error("La réponse de l'IA ne contient aucune section exploitable.");
      }
      const known = json.sections.filter((s: PageSection) => s && WIREFRAME_REGISTRY[s.type]);
      if (known.length === 0) throw new Error("Aucune des sections générées n'est reconnue par le catalogue.");
      replaceAll(known);
      setActiveSection(null);
      setStatus('success');
      setTimeout(() => setStatus(s => s === 'success' ? 'idle' : s), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setErrorMsg(msg);
      setStatus('error');
      throw e;
    }
  };

  const handleAiModify = async (promptText: string) => {
    if (!promptText.trim()) return;
    setStatus('generating'); setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/modify-page-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          pageTitle: title || 'Page',
          sections,
          prompt: promptText
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur API lors de la modification.');
      if (!Array.isArray(json.sections) || json.sections.length === 0) {
        throw new Error("La réponse de l'IA ne contient aucune section modifiée.");
      }
      const known = json.sections.filter((s: PageSection) => s && WIREFRAME_REGISTRY[s.type]);
      if (known.length === 0) throw new Error("Aucune des sections modifiées n'est reconnue par le catalogue.");
      replaceAll(known);
      setActiveSection(null);
      setStatus('success');
      setTimeout(() => setStatus(s => s === 'success' ? 'idle' : s), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setErrorMsg(msg);
      setStatus('error');
      throw e;
    }
  };

  const [isOptimizingStyle, setIsOptimizingStyle] = useState(false);

  const handleOptimizeStyle = async () => {
    if (sections.length === 0) {
      setErrorMsg('Ajoutez au moins une section avant d\'optimiser le style.');
      return;
    }

    setIsOptimizingStyle(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/optimize-page-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageTitle: title || 'Page',
          sections,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’optimisation du style.');

      if (Array.isArray(data.sections) && data.sections.length > 0) {
        replaceAll(data.sections);
        setStatus('success');
        setTimeout(() => setStatus(s => s === 'success' ? 'idle' : s), 2500);
      }
    } catch (err: any) {
      console.error('Erreur optimisation style :', err);
      setErrorMsg(err.message || 'Échec de l’optimisation du style.');
    } finally {
      setIsOptimizingStyle(false);
    }
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

  const editorContext = React.useMemo(
    () => ({
      updateField,
      savePage: save,
      openSectionEditor: (idx: number) => {
        setActiveSection(idx);
        setEditorOpen(true);
      },
      swapType,
      isEditing: !preview,
    }),
    [updateField, preview, save, swapType],
  );

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
  };

  const handleRemoveSection = (i: number) => {
    const label = SECTION_LABELS[sections[i].type] ?? sections[i].type;
    if (!window.confirm(`Supprimer la section « ${label} » ?`)) return;
    remove(i);
    setActiveSection(null);
  };

  // ── Réordonnancement et insertion par glisser-déposer ──
  const handleDrop = (to: number, e?: React.DragEvent) => {
    if (e) {
      const rawJson = e.dataTransfer.getData('application/json');
      if (rawJson) {
        try {
          const payload = JSON.parse(rawJson);
          if (payload.type === 'new_section' && payload.sectionType) {
            add(payload.sectionType, to);
            setActiveSection(to);
            setDragIndex(null);
            setDropIndex(null);
            return;
          }
        } catch {}
      }
    }
    if (dragIndex !== null && dragIndex !== to) {
      moveTo(dragIndex, to);
      setActiveSection(to);
    }
    setDragIndex(null);
    setDropIndex(null);
  };


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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-stone-50">

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-100 px-5 py-0 flex items-center justify-between shrink-0 h-14 shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/admin/pages" className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div className="h-5 w-px bg-stone-200" />
          <div className="min-w-0">
            <input
              placeholder="Titre de la page"
              className="font-semibold text-stone-900 text-sm bg-transparent focus:outline-none w-48 placeholder:text-stone-400 border-b border-transparent focus:border-stone-900/40 transition-colors"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
            />
            <div className="flex items-center gap-0.5 mt-0.5">
              <span className="text-stone-500 text-[11px]">/</span>
              <input
                placeholder="slug"
                title="Adresse de la page (sans accent ni espace)"
                className="text-stone-500 text-[11px] bg-transparent focus:outline-none border-b border-transparent focus:border-stone-300 transition-colors w-32 placeholder:text-stone-200"
                value={slug}
                onChange={e => setSlug(generateSlug(e.target.value))}
              />
              {slug === 'home' && <span className="text-stone-500 text-[12px] ml-1">(page d'accueil)</span>}
            </div>
          </div>

          <div className="h-5 w-px bg-stone-200 hidden sm:block shrink-0" />

          {/* Duo de Boutons d'Action IA - Grand Format, Colorés & Sexy */}
          {moduleFlags.ai_generation && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer border border-white/30 shrink-0"
              >
                <Wand2 size={16} className="text-amber-300 animate-pulse" />
                <span>Assistant IA</span>
                <span className="bg-white/25 text-white text-[10.5px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 hidden md:flex">
                  Vocale <Mic size={10} />
                </span>
              </button>

              <button
                type="button"
                onClick={handleOptimizeStyle}
                disabled={isOptimizingStyle || sections.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer border border-white/30 shrink-0 disabled:opacity-40"
              >
                {isOptimizingStyle ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} className="text-amber-200 animate-pulse" />
                )}
                <span>{isOptimizingStyle ? 'Optimisation…' : 'Optimiser le style'}</span>
              </button>
            </div>
          )}
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

          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Annuler la dernière modification (⌘/Ctrl + Z)"
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg disabled:opacity-25 transition-all cursor-pointer"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Rétablir la dernière modification (⌘/Ctrl + Shift + Z)"
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg disabled:opacity-25 transition-all cursor-pointer"
            >
              <Redo2 size={14} />
            </button>
          </div>

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
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showHeader ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-100 text-stone-500 border-stone-200 line-through'}`}
          >
            En-tête
          </button>
          <button
            onClick={() => setShowFooter(!showFooter)}
            title="Afficher / masquer le footer sur cette page"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showFooter ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-100 text-stone-500 border-stone-200 line-through'}`}
          >
            Pied de page
          </button>

          {published && slug && (
            <a href={getPagePath(slug)} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-500 hover:text-stone-900 hover:bg-sage/5 rounded-lg transition-all">
              <ExternalLink size={14} />
            </a>
          )}

          {moduleFlags.ai_generation && (
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-200 transition-all cursor-pointer"
              title="Générer ou modifier toute la page par IA"
            >
              <Sparkles size={14} className="text-amber-600" />
              <span>Assistant IA</span>
            </button>
          )}

          <button
            onClick={save}
            disabled={status === 'saving'}
            title="Enregistrer la page (Raccourci ⌘ / Ctrl + S)"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-md ${
              isDirty
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 scale-105 animate-pulse-subtle ring-2 ring-emerald-400/50'
                : 'bg-stone-900 hover:bg-stone-800 text-white'
            } disabled:opacity-50`}
          >
            {status === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{status === 'saving' ? 'Sauvegarde…' : 'Sauvegarder'}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* ── Bibliothèque de sections (ancrée, pas superposée) ────────── */}
        {libraryOpen && (
          <div className="hidden lg:block">
            <SectionLibrary
              insertLabel={
                activeSection !== null
                  ? `Après la section ${activeSection + 1}`
                  : 'À la fin de la page'
              }
              onClose={() => setLibraryOpen(false)}
              onInsert={(type) => {
                const at = activeSection !== null ? activeSection + 1 : sections.length;
                add(type, at);
                setActiveSection(at);
              }}
            />
          </div>
        )}

        {/* ── Panneau gauche ──────────────────────────────────────────── */}
        <aside className="w-full lg:w-72 max-h-[50vh] lg:max-h-none bg-white border-b lg:border-b-0 lg:border-r border-stone-100 flex flex-col overflow-hidden shrink-0">
          {/* Onglets de la Sidebar */}
          <div className="flex border-b border-stone-100 bg-stone-50/50 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'content' ? 'border-stone-900 text-stone-900 bg-white' : 'border-transparent text-stone-500 hover:text-stone-600'}`}
            >
              <LayoutGrid size={13} />
              Structure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('seo')}
              className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 flex items-center justify-center gap-2 ${activeTab === 'seo' ? 'border-stone-900 text-stone-900 bg-white' : 'border-transparent text-stone-500 hover:text-stone-600'}`}
            >
              <Sparkles size={13} />
              SEO
            </button>
          </div>

          {activeTab === 'content' ? (
            <>
              {/* Liste des sections */}
              <div ref={sidebarRef} className="flex-1 overflow-y-auto">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid size={13} className="text-stone-500" />
                    <p className="text-[12.5px] font-medium text-stone-700">
                      Sections {sections.length > 0 && <span className="text-stone-500">({sections.length})</span>}
                    </p>
                  </div>
                </div>

                {sections.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                      <LayoutGrid size={18} className="text-stone-500" />
                    </div>
                    <p className="text-sm text-stone-600 font-light leading-relaxed">
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
                          onDrop={e => { e.preventDefault(); handleDrop(i, e); }}
                          onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                        >
                          {/* Section header — seule poignée de glisser-déposer */}
                          <div
                            draggable
                            onDragStart={() => setDragIndex(i)}
                            onClick={() => { selectSection(i); setEditorOpen(true); }}
                            className={`p-3.5 cursor-pointer transition-all group/item ${
                              isActive
                                ? 'bg-gradient-to-r from-purple-50 via-fuchsia-50/60 to-amber-50/40 text-zinc-900 border-2 border-purple-500 shadow-[0_4px_15px_rgba(168,85,247,0.15)]'
                                : isVisible
                                ? 'bg-slate-50/90 border border-purple-200 hover:border-purple-400 hover:shadow-xs'
                                : 'bg-white border border-zinc-200 hover:border-purple-300 hover:shadow-2xs'
                            } rounded-xl`}
                          >
                            {/* Ligne Haute : Poignée + Titre complet + Résumé complet sans truncate */}
                            <div className="flex items-start gap-2.5">
                              <span title="Glisser pour réordonner" className="shrink-0 cursor-grab active:cursor-grabbing mt-0.5">
                                <GripVertical size={14} className={isActive ? 'text-purple-600' : 'text-zinc-400'} />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-extrabold leading-snug break-words ${isActive ? 'text-purple-900 font-extrabold' : 'text-zinc-900'}`}>
                                  {SECTION_LABELS[section.type] ?? section.type}
                                </p>
                                <p className={`text-xs font-medium leading-relaxed mt-1 break-words ${isActive ? 'text-purple-800/80' : 'text-zinc-600'}`}>
                                  {sectionSummary(section) || WIREFRAME_REGISTRY[section.type]?.description}
                                </p>
                              </div>
                            </div>

                            {/* Ligne Basse DÉDIÉE : Boutons d'actions et numéro à la ligne */}
                            <div
                              className="mt-2.5 pt-2 border-t border-stone-200/80 flex items-center justify-between select-none"
                              onClick={e => e.stopPropagation()}
                            >
                              <span className="text-[11px] font-mono font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">
                                #{i + 1} {section.type}
                              </span>

                              <div className="flex items-center gap-1">
                                <button type="button" title="Monter" onClick={e => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                                  className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                  <ChevronUp size={13} />
                                </button>
                                <button type="button" title="Descendre" onClick={e => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                                  className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                  <ChevronDown size={13} />
                                </button>
                                <button type="button" title="Changer de variante" onClick={e => { e.stopPropagation(); selectSection(i); setEditorOpen(true); }}
                                  className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-md transition-all cursor-pointer">
                                  <RefreshCw size={12} />
                                </button>
                                <button type="button" title="Dupliquer" onClick={e => { e.stopPropagation(); duplicate(i); setActiveSection(i + 1); }}
                                  className="p-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded-md transition-all cursor-pointer">
                                  <Copy size={12} />
                                </button>
                                <button type="button" title="Supprimer" onClick={e => { e.stopPropagation(); handleRemoveSection(i); }}
                                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-all cursor-pointer">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>

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
                  onClick={() => setTemplatePickerOpen(true)}
                  className="w-full flex items-center gap-2 border-b border-stone-100 px-4 py-3 text-xs font-semibold text-stone-500 transition-all hover:bg-stone-50 hover:text-stone-800 cursor-pointer"
                >
                  <LayoutTemplate size={13} className="text-sage" />
                  Partir d&apos;une structure
                </button>

                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <Plus size={13} className="text-sage" />
                    {activeSection !== null ? `Insérer après la section ${activeSection + 1}` : 'Ajouter une section'}
                  </span>
                  <ChevronRight size={13} className="text-stone-500" />
                </button>

              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Génération IA SEO */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-3 bg-stone-50/50">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-sage" />
                  <p className="text-[12px] font-bold text-stone-500">Optimisation SEO par IA</p>
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
                  <p className="text-[12px] text-red-500 font-medium leading-tight mt-1 text-center animate-fadein">
                    {errorMsg === 'not_configured' ? 'Clé API Anthropic non configurée.' : errorMsg === 'Unauthorized' ? 'Session expirée. Veuillez vous reconnecter.' : errorMsg}
                  </p>
                )}
                
                <p className="text-[12px] text-stone-500 font-light leading-relaxed">
                  L'IA analysera le contenu des sections de votre page pour générer des balises optimisées.
                </p>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <label className="text-[13px] font-medium text-stone-800">Meta Title</label>
                  <span className={seoTitle.length > 60 ? 'text-orange-600' : 'text-stone-600'}>{seoTitle.length}/60</span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={e => setSeoTitle(e.target.value)}
                  placeholder="Titre de la page"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <label className="text-[13px] font-medium text-stone-800">Meta Description</label>
                  <span className={seoDescription.length > 160 ? 'text-orange-600' : 'text-stone-600'}>{seoDescription.length}/160</span>
                </div>
                <textarea
                  rows={4}
                  value={seoDescription}
                  onChange={e => setSeoDescription(e.target.value)}
                  placeholder="Description de la page..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 resize-none leading-relaxed focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
                />
              </div>

              {/* OG Title */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <label className="text-[13px] font-medium text-stone-800">OG Title</label>
                  <span className="text-stone-500">{seoOgTitle.length}</span>
                </div>
                <input
                  type="text"
                  value={seoOgTitle}
                  onChange={e => setSeoOgTitle(e.target.value)}
                  placeholder="Titre Facebook/Twitter"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
                />
              </div>

              {/* OG Description */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <label className="text-[13px] font-medium text-stone-800">OG Description</label>
                  <span className="text-stone-500">{seoOgDescription.length}</span>
                </div>
                <textarea
                  rows={3}
                  value={seoOgDescription}
                  onChange={e => setSeoOgDescription(e.target.value)}
                  placeholder="Description réseaux..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 resize-none leading-relaxed focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
                />
              </div>

              {/* OG Image */}
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[13px] font-medium text-stone-800">OG Image</label>
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
                    className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 min-w-0 focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
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
                <label className="block text-[12px] text-[13px] font-medium text-stone-800">Mots-clés</label>
                <input
                  type="text"
                  value={seoKeywords}
                  onChange={e => setSeoKeywords(e.target.value)}
                  placeholder="vos prestations principales, séparées par des virgules..."
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs outline-none focus:border-stone-900 bg-white text-stone-800 focus:ring-1 focus:ring-stone-900/20 focus:border-stone-900 transition-all"
                />
              </div>
            </div>
          )}
        </aside>

        {/* ── Zone de prévisualisation ─────────────────────────────── */}
        <div ref={previewRef} className="flex-1 overflow-y-auto bg-white">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 select-none">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-stone-500" />
              </div>
              <p className="text-xl font-light text-stone-500 mb-2">Votre page apparaîtra ici</p>
              <p className="text-sm text-stone-600">Utilisez le panneau gauche pour composer</p>
            </div>
          ) : (
            <>
              {/* Mode banner */}
              <div className={`sticky top-0 z-50 px-5 py-2 flex items-center justify-between border-b transition-colors ${preview ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-xs font-medium ${preview ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {preview ? 'Mode prévisualisation — interactions actives' : 'Mode édition — cliquez sur une section pour la modifier'}
                </p>
                <div className="flex items-center gap-4">
                  {/*
                    Largeurs d'aperçu. Elles n'étaient proposées qu'en mode
                    édition, où elles ne faisaient que rétrécir une div : la
                    mise en page restait celle du bureau. Elles simulent
                    désormais une vraie fenêtre, dans les deux modes.
                  */}
                  {(
                    <div className="flex items-center gap-1">
                      {(['mobile', 'tablet', 'desktop'] as const).map(v => (
                        <button
                          key={v}
                          onClick={() => setViewport(v)}
                          title={VIEWPORTS[v].label}
                          aria-pressed={viewport === v}
                          className={`rounded px-2 py-0.5 text-[12px] font-medium transition-colors cursor-pointer ${
                            viewport === v
                              ? 'bg-stone-900 text-white'
                              : 'text-stone-600 hover:bg-stone-200'
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
              {/*
                `data-site-theme` + `GlobalStyles` : sans eux, l'aperçu ne
                recevait aucun des réglages « Design & Style » — palette,
                polices, boutons, rythme — et montrait donc autre chose que ce
                que verra le visiteur. La portée reste confinée à ce bloc : le
                reste du back-office garde son apparence propre.
              */}
              {VIEWPORTS[viewport].width ? (
                /*
                  Largeur simulée : le rendu part dans un iframe, seul endroit
                  où les points de rupture de Tailwind s'évaluent pour de bon.
                */
                <div className="bg-stone-100 p-4">
                  <PreviewFrame
                    width={VIEWPORTS[viewport].width!}
                    onClickCapture={preview ? handlePreviewLinkClick : handlePreviewClick}
                    onDocument={(doc) => { previewDocRef.current = doc; }}
                  >
                    <GlobalStyles />
                    <PageEditorContext.Provider value={editorContext}>
                      <DynamicPageRenderer sections={sections} />
                    </PageEditorContext.Provider>
                  </PreviewFrame>
                </div>
              ) : (
                <div
                  data-site-theme
                  className="mx-auto transition-all duration-300"
                  onClickCapture={preview ? handlePreviewLinkClick : handlePreviewClick}
                >
                  <GlobalStyles />
                  <PageEditorContext.Provider value={editorContext}>
                    <DynamicPageRenderer sections={sections} />
                  </PageEditorContext.Provider>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={url => { setSeoOgImage(url); setMediaPickerOpen(false); }}
      />


      {templatePickerOpen && (
        <TemplatePicker
          onClose={() => setTemplatePickerOpen(false)}
          onApply={(next) => {
            replaceAll(next);
            setTemplatePickerOpen(false);
            setActiveSection(null);
          }}
        />
      )}

      {editorOpen && activeSection !== null && sections[activeSection] && (
        <SectionEditorModal
          section={sections[activeSection]}
          sectionIndex={activeSection}
          total={sections.length}
          sections={sections}
          onUpdate={updateField}
          onSwapType={swapType}
          onMoveSection={move}
          onMoveToSection={moveTo}
          onDuplicateSection={duplicate}
          onRemoveSection={handleRemoveSection}
          onAddSection={add}
          onClose={() => setEditorOpen(false)}
          onNavigate={(next) => {
            if (next < 0 || next >= sections.length) return;
            selectSection(next);
          }}
        />
      )}

      <AiPageModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onGenerate={handleAiGenerate}
        onModify={handleAiModify}
        currentSectionsCount={sections.length}
      />
    </div>
  );
}
