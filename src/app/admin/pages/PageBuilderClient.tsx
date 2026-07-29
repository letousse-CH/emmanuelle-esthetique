"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Sparkles, Save, Eye, EyeOff, Trash2, Plus, ChevronUp, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, ExternalLink, GripVertical, ChevronRight,
  LayoutGrid, Wand2
} from 'lucide-react';
import DynamicPageRenderer from '../../../components/pagebuilder/DynamicPageRenderer';
import { WIREFRAME_REGISTRY, AVAILABLE_SECTION_TYPES } from '../../../components/pagebuilder/wireframes.config';
import type { SectionType } from '../../../components/pagebuilder/wireframes.config';
import { SECTION_LABELS, SectionPreview } from '../../../components/pagebuilder/sectionPreviews';
import FieldEditor from '../../../components/pagebuilder/FieldEditor';
import { usePageEditor } from '../../../components/pagebuilder/usePageEditor';
import { savePage, updatePage, fetchPageById, generateSlug } from '../../../services/dynamicPages';
import { supabase } from '../../../services/supabase';
import { getSeoPrefix } from '../../../services/pageMeta';
import MediaPickerModal from '../../../components/pagebuilder/MediaPickerModal';

type Status = 'idle' | 'generating' | 'saving' | 'success' | 'error';

const SECTION_CATEGORIES: { label: string; types: SectionType[] }[] = [
  { label: 'Hero', types: ['hero_1', 'hero_2'] },
  { label: 'Contenu', types: ['intro_1', 'text_1', 'text_image_1', 'features_1', 'features_2', 'features_3', 'timeline_1'] },
  { label: 'Preuve sociale', types: ['testimonial_1', 'reviews_1', 'faq_1', 'stats_1', 'logos_1'] },
  { label: 'Médias', types: ['gallery_grid', 'gallery_carousel', 'gallery_masonry'] },
  { label: 'Action', types: ['cta_1', 'marquee_1', 'pricing_1'] },
];

// Gardée en phase avec LEGACY_SLUGS dans services/pageMeta.ts (source de
// vérité pour le préfixe seo_* — voir getSeoPrefix, importé ci-dessus).
const isLegacySlug = (slug: string) => ['home','about','accompagnement','contact','mentions-legales','paroles-et-silences','programme-complet','reve-eveille-libre','seance-individuelle','si-les-arbres-pouvaient-parler'].includes(slug);
const getPagePath = (slug: string) => slug === 'home' ? '/' : `/${slug}`;

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
  const [addPanelOpen, setAddPanelOpen]   = useState(false);
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

  const { sections, setSections, move, remove, add, updateField } = usePageEditor([]);

  const selectSection = (i: number) => {
    setActiveSection(prev => prev === i ? null : i);
    setAddPanelOpen(false);
    const el = previewRef.current?.querySelector(`#section-${i}`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const container = previewRef.current;
    if (!container || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;
        const id = visible[0].target.id;
        const idx = parseInt(id.replace('section-', ''), 10);
        if (!isNaN(idx)) {
          setActiveSection(idx);
          const item = sidebarRef.current?.querySelector(`[data-section-item="${idx}"]`) as HTMLElement | null;
          item?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      },
      { root: container, threshold: 0.3 }
    );
    sections.forEach((_, idx) => {
      const el = container.querySelector(`#section-${idx}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections.length, previewRef.current]);

  useEffect(() => {
    if (!id) return;
    fetchPageById(id).then(page => {
      if (!page) return;
      setTitle(page.title); setSlug(page.slug); setPublished(page.published); setSections(page.sections);
      setShowHeader(page.show_header ?? true); setShowFooter(page.show_footer ?? true);
      
      const prefix = getSeoPrefix(page.slug);
      if (prefix) {
        supabase.from('settings').select('key, value').like('key', `${prefix}_%`).then(({ data }) => {
          if (data) {
            const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
            setSeoTitle(map[`${prefix}_title`] || '');
            setSeoDescription(map[`${prefix}_description`] || '');
            setSeoOgTitle(map[`${prefix}_og_title`] || '');
            setSeoOgDescription(map[`${prefix}_og_description`] || '');
            setSeoOgImage(map[`${prefix}_og_image`] || '');
            setSeoKeywords(map[`${prefix}_keywords`] || '');
          }
        });
      }
    });
  }, [id]);

  const handleTitleChange = (v: string) => { setTitle(v); if (!isEditing) setSlug(generateSlug(v)); };

  const generate = async () => {
    if (!prompt.trim()) return;
    setStatus('generating'); setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/generate-page', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ prompt }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur API');
      setSections(json.sections); setActiveSection(null); setStatus('idle');
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

      setStatus('success'); setTimeout(() => setStatus('idle'), 2500);
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
          title: title || 'Au-delà des Chaînes',
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

  const handleAddSection = (type: SectionType) => {
    add(type); setActiveSection(sections.length); setAddPanelOpen(false);
  };

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
              <span className="text-stone-300 text-[11px]">{slug === 'home' ? '/' : (isLegacySlug(slug) ? '/' : '/pages/')}</span>
              <input
                placeholder="slug"
                className="text-stone-400 text-[11px] bg-transparent focus:outline-none border-b border-transparent focus:border-stone-300 transition-colors w-32 placeholder:text-stone-200"
                value={slug}
                onChange={e => setSlug(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'success' && <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium"><CheckCircle2 size={13} /> Sauvegardé</span>}
          {status === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium max-w-48 truncate"><AlertCircle size={13} /> {errorMsg}</span>}

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
                      return (
                        <div key={i} data-section-item={i} className="rounded-xl overflow-hidden">
                          {/* Section header */}
                          <div
                            onClick={() => selectSection(i)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all group/item ${isActive ? 'bg-sage/8 border border-sage/20' : 'bg-stone-50 border border-stone-100 hover:border-stone-200 hover:bg-stone-100/60'} rounded-xl`}
                          >
                            <GripVertical size={13} className="text-stone-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate ${isActive ? 'text-sage' : 'text-stone-600'}`}>{SECTION_LABELS[section.type] ?? section.type}</p>
                              <p className="text-[10px] text-stone-400 truncate leading-tight mt-0.5">
                                {WIREFRAME_REGISTRY[section.type]?.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button type="button" onClick={e => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                                className="p-1 text-stone-300 hover:text-stone-700 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                <ChevronUp size={12} />
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                                className="p-1 text-stone-300 hover:text-stone-700 hover:bg-white rounded-md disabled:opacity-20 transition-all cursor-pointer">
                                <ChevronDown size={12} />
                              </button>
                              <button type="button" onClick={e => { e.stopPropagation(); remove(i); setActiveSection(null); }}
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
                    <Plus size={13} className="text-sage" /> Ajouter une section
                  </span>
                  <ChevronRight size={13} className={`text-stone-300 transition-transform duration-200 ${addPanelOpen ? 'rotate-90' : ''}`} />
                </button>

                {addPanelOpen && (
                  <div className="px-3 pb-3 space-y-4 border-t border-stone-100 pt-3 max-h-[28rem] overflow-y-auto">
                    {SECTION_CATEGORIES.map(cat => (
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
                  placeholder="pervers narcissique, emprise..."
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
                <button
                  onClick={() => setPreview(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${preview ? 'text-emerald-700 hover:text-emerald-900' : 'text-amber-600 hover:text-amber-800'}`}
                >
                  {preview ? <><EyeOff size={11} /> Édition</> : <><Eye size={11} /> Prévisualiser</>}
                </button>
              </div>
              <div className={preview ? '' : 'pointer-events-none'}>
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
