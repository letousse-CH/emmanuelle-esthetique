"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Undo2, Redo2, Plus, Sparkles, Settings2, Monitor, Smartphone, Loader2, Check, AlertCircle, Eye, EyeOff, ExternalLink, X,
} from 'lucide-react';
import type { ContentStructure, BlockType } from '../types';
import { createSection } from '../types';
import { createBlock } from '../blockMeta';
import { BlockRenderer, type EditorSelection } from '../BlockRenderer';
import { resolvePageContent } from '../pageContent';
import { PAGE_TEMPLATES, type SectionPreset } from '../presets';
import { useContentHistory } from './useContentHistory';
import Canvas from './Canvas';
import Inspector, { type EditMode } from './Inspector';
import Library from './Library';
import AiPanel from './AiPanel';
import { insertSection, insertBlock, findBlock, removeBlock, selectionExists, updateSection } from './ops';
import GlobalStyles from '../../GlobalStyles';
import PreviewFrame from '../../pagebuilder/PreviewFrame';
import { supabase } from '../../../services/supabase';
import { fetchPageById, updatePage, type DynamicPage } from '../../../services/dynamicPages';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const pagePath = (slug: string) => (slug === 'home' || slug === 'accueil' ? '/' : `/${slug}`);

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

interface Props {
  pageId: string;
  /** overlay : ouvert par-dessus la page publique ; page : route /admin. */
  mode: 'overlay' | 'page';
  onClose: () => void;
}

/**
 * Éditeur de page v2 : canvas MLT (aperçu réel cliquable, glisser-déposer),
 * inspecteur ancré, bibliothèque par intention, annuler/rétablir, sauvegarde
 * automatique et assistant IA. Rendu dans un portail hors de
 * `[data-site-theme]`, pour que la charte du site ne restyle pas l'interface
 * de l'éditeur ; seul le canvas est dans la portée de la charte.
 */
export default function PageBuilder({ pageId, mode, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState<DynamicPage | null>(null);
  const [loadError, setLoadError] = useState('');
  const history = useContentHistory([]);
  const { content, commit, reset, undo, redo, canUndo, canRedo, version } = history;
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [editMode, setEditMode] = useState<EditMode>('content');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ai, setAi] = useState<{ scope: 'page' | 'section'; sectionId?: string } | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [meta, setMeta] = useState({ title: '', slug: '', published: true, show_header: true, show_footer: true });
  const [metaVersion, setMetaVersion] = useState(0);
  const loadedVersion = useRef(0);
  const loadedMeta = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // ── Chargement ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    fetchPageById(pageId).then((p) => {
      if (!active) return;
      if (!p) { setLoadError('Page introuvable.'); return; }
      setPage(p);
      setMeta({ title: p.title, slug: p.slug, published: p.published, show_header: p.show_header ?? true, show_footer: p.show_footer ?? true });
      reset(resolvePageContent(p));
    });
    return () => { active = false; };
  }, [pageId, reset]);

  useEffect(() => { if (page) { loadedVersion.current = version; loadedMeta.current = metaVersion; } }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!page && (version !== loadedVersion.current || metaVersion !== loadedMeta.current);
  // Toute nouvelle modification relance la sauvegarde automatique (y compris après une erreur).
  useEffect(() => { if (dirty) setSave((s) => (s === 'saving' ? s : 'dirty')); }, [version, metaVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sauvegarde ──────────────────────────────────────────────────────────────
  const latest = useRef({ content, meta, version, metaVersion });
  latest.current = { content, meta, version, metaVersion };

  const persist = useCallback(async () => {
    if (!page) return;
    const snap = latest.current;
    setSave('saving');
    setSaveError('');
    try {
      await updatePage(page.id, {
        content: snap.content,
        content_version: 2,
        title: snap.meta.title.trim() || page.title,
        slug: snap.meta.slug.trim() || page.slug,
        published: snap.meta.published,
        show_header: snap.meta.show_header,
        show_footer: snap.meta.show_footer,
      });
      loadedVersion.current = snap.version;
      loadedMeta.current = snap.metaVersion;
      setSave(latest.current.version === snap.version && latest.current.metaVersion === snap.metaVersion ? 'saved' : 'dirty');
      fetch('/api/revalidate', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ path: pagePath(snap.meta.slug || page.slug) }) }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || String(e);
      setSave('error');
      setSaveError(/content(_version)?/.test(msg) && /column|colonne|schema/i.test(msg)
        ? 'La base n\'a pas encore les colonnes du nouvel éditeur. Exécutez supabase/migrations/20260926_page_blocks_content.sql dans Supabase.'
        : msg);
    }
  }, [page]);

  // Sauvegarde automatique, 1,5 s après la dernière modification.
  useEffect(() => {
    if (!dirty || save === 'saving' || save === 'error') return;
    const t = setTimeout(persist, 1500);
    return () => clearTimeout(t);
  }, [dirty, version, metaVersion, persist, save]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // La sélection disparaît si l'élément n'existe plus (annuler, suppression).
  useEffect(() => { if (!selectionExists(content, selection)) setSelection(null); }, [content, selection]);

  // Faire défiler le canvas jusqu'à l'élément sélectionné depuis l'inspecteur.
  useEffect(() => {
    if (!selection || !canvasRef.current) return;
    const sel = selection.kind === 'block'
      ? `[data-editor-block-id="${selection.blockId}"]`
      : selection.kind === 'column' ? `[data-editor-column-id="${selection.columnId}"]` : `[data-editor-section-id="${selection.sectionId}"][data-editor-kind="section"]`;
    const el = canvasRef.current.querySelector<HTMLElement>(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const box = canvasRef.current.getBoundingClientRect();
    if (r.top < box.top || r.top > box.bottom - 80) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selection]);

  // ── Raccourcis clavier ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); persist(); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') setSelection(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection?.kind === 'block') {
        e.preventDefault();
        commit(removeBlock(content, selection.sectionId, selection.columnId, selection.blockId));
        setSelection({ kind: 'column', sectionId: selection.sectionId, columnId: selection.columnId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, persist, selection, content, commit]);

  // ── Ajouts ──────────────────────────────────────────────────────────────────
  const addPreset = (p: SectionPreset) => {
    const s = p.build();
    commit(insertSection(content, s, selection?.sectionId ?? null));
    setSelection({ kind: 'section', sectionId: s.id });
  };

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    if (selection && selection.kind !== 'section') {
      const index = selection.kind === 'block' ? findBlock(content, selection.sectionId, selection.columnId, selection.blockId).index + 1 : undefined;
      commit(insertBlock(content, selection.sectionId, selection.columnId, block, index));
      setSelection({ kind: 'block', sectionId: selection.sectionId, columnId: selection.columnId, blockId: block.id });
      return;
    }
    if (selection?.kind === 'section') {
      const sec = content.find((s) => s.id === selection.sectionId);
      const col = sec?.columns[0];
      if (sec && col) {
        commit(insertBlock(content, sec.id, col.id, block));
        setSelection({ kind: 'block', sectionId: sec.id, columnId: col.id, blockId: block.id });
        return;
      }
    }
    const s = createSection('1-col', [block]);
    commit(insertSection(content, s, null));
    setSelection({ kind: 'block', sectionId: s.id, columnId: s.columns[0].id, blockId: block.id });
  };

  const targetLabel = !selection ? 'dans une nouvelle section en bas de page'
    : selection.kind === 'block' ? 'sous le bloc sélectionné'
    : selection.kind === 'column' ? 'en bas de la colonne sélectionnée'
    : 'dans la section sélectionnée';

  // ── IA ──────────────────────────────────────────────────────────────────────
  const runAi = async (instruction: string) => {
    const scope = ai?.scope ?? 'page';
    const section = ai?.sectionId ? content.find((s) => s.id === ai.sectionId) : undefined;
    const res = await fetch('/api/admin/blocks-ai', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(scope === 'section' ? { mode: 'section', instruction, section } : { mode: 'page', instruction, content, pageTitle: meta.title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    if (scope === 'section' && section && data.section) {
      commit(updateSection(content, section.id, () => ({ ...data.section, id: section.id })));
      setSelection({ kind: 'section', sectionId: section.id });
    } else if (Array.isArray(data.content)) {
      commit(data.content);
      setSelection(null);
    }
  };

  const setMetaField = <K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) => { setMeta((m) => ({ ...m, [k]: v })); setMetaVersion((n) => n + 1); };

  const statusBadge = useMemo(() => {
    switch (save) {
      case 'saving': return <span className="inline-flex items-center gap-1.5 text-xs text-stone-500"><Loader2 size={13} className="animate-spin" /> Enregistrement…</span>;
      case 'saved': return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><Check size={13} /> Enregistré</span>;
      case 'dirty': return <span className="text-xs text-amber-600">Modifications en cours…</span>;
      case 'error': return <span className="inline-flex items-center gap-1.5 text-xs text-red-600" title={saveError}><AlertCircle size={13} /> Non enregistré</span>;
      default: return <span className="text-xs text-stone-400">À jour</span>;
    }
  }, [save, saveError]);

  if (!mounted) return null;

  const tb = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-transparent';

  const ui = (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-stone-100 font-sans text-stone-800" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      {/* Barre du haut */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3">
        <button type="button" className={tb} onClick={async () => { if (dirty) await persist(); onClose(); }} title={mode === 'overlay' ? 'Fermer l\'éditeur' : 'Retour à la liste'}>
          {mode === 'overlay' ? <X size={17} /> : <ArrowLeft size={17} />}
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{meta.title || 'Page'}</p>
          <p className="truncate text-[11px] text-stone-500">{pagePath(meta.slug)}</p>
        </div>

        <div className="mx-auto flex items-center gap-2">
          <div className="flex rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Mode d'édition">
            {(['content', 'layout'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={editMode === m} onClick={() => setEditMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${editMode === m ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                {m === 'content' ? 'Contenu' : 'Mise en page'}
              </button>
            ))}
          </div>
          <div className="hidden rounded-lg bg-stone-100 p-1 sm:flex">
            <button type="button" title="Ordinateur" aria-label="Aperçu ordinateur" onClick={() => setViewport('desktop')} className={`rounded-md px-2 py-1 ${viewport === 'desktop' ? 'bg-white shadow-sm' : 'text-stone-500'}`}><Monitor size={15} /></button>
            <button type="button" title="Mobile (aperçu)" aria-label="Aperçu mobile" onClick={() => setViewport('mobile')} className={`rounded-md px-2 py-1 ${viewport === 'mobile' ? 'bg-white shadow-sm' : 'text-stone-500'}`}><Smartphone size={15} /></button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" className={tb} onClick={undo} disabled={!canUndo} title="Annuler (Cmd/Ctrl + Z)" aria-label="Annuler"><Undo2 size={16} /></button>
          <button type="button" className={tb} onClick={redo} disabled={!canRedo} title="Rétablir (Cmd/Ctrl + Maj + Z)" aria-label="Rétablir"><Redo2 size={16} /></button>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <button type="button" className={`${tb} ${libraryOpen ? 'bg-sky-50 text-sky-700' : ''}`} onClick={() => setLibraryOpen((o) => !o)}><Plus size={16} /> <span className="hidden md:inline">Ajouter</span></button>
          <button type="button" className={`${tb} text-violet-700 hover:bg-violet-50`} onClick={() => setAi({ scope: 'page' })}><Sparkles size={16} /> <span className="hidden md:inline">IA</span></button>
          <button type="button" className={`${tb} ${settingsOpen ? 'bg-stone-100' : ''}`} onClick={() => setSettingsOpen((o) => !o)} title="Réglages de la page" aria-label="Réglages de la page"><Settings2 size={16} /></button>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <div className="hidden w-36 justify-end lg:flex">{statusBadge}</div>
          <button type="button" onClick={() => setMetaField('published', !meta.published)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold ${meta.published ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            title={meta.published ? 'Visible sur le site — cliquer pour masquer' : 'Brouillon — cliquer pour publier'}>
            {meta.published ? <Eye size={15} /> : <EyeOff size={15} />} {meta.published ? 'Publiée' : 'Brouillon'}
          </button>
          <button type="button" onClick={persist} disabled={save === 'saving'} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 text-[13px] font-semibold text-white hover:bg-stone-700 disabled:opacity-60">
            Enregistrer
          </button>
        </div>
      </header>

      {save === 'error' && saveError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle size={14} /> {saveError}
          <button type="button" className="ml-auto font-semibold underline" onClick={persist}>Réessayer</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {libraryOpen && (
          <aside className="w-72 shrink-0 border-r border-stone-200 bg-white">
            <Library onClose={() => setLibraryOpen(false)} onAddPreset={addPreset} onAddBlock={addBlock} targetLabel={targetLabel} />
          </aside>
        )}

        <main ref={canvasRef} className="min-w-0 flex-1 overflow-y-auto p-3 md:p-5" onClick={(e) => { if (e.target === e.currentTarget) setSelection(null); }}>
          {loadError ? (
            <p className="p-10 text-center text-sm text-red-600">{loadError}</p>
          ) : !page ? (
            <div className="grid h-full place-items-center text-stone-400"><Loader2 className="animate-spin" /></div>
          ) : viewport === 'mobile' ? (
            <div className="mx-auto w-[390px] overflow-hidden rounded-[28px] border-[6px] border-stone-800 bg-white shadow-xl" style={{ height: 'calc(100% - 8px)' }}>
              <PreviewFrame width={378}>
                <div data-site-theme><GlobalStyles /><BlockRenderer content={content} /></div>
              </PreviewFrame>
            </div>
          ) : (
            <div data-site-theme className="mx-auto min-h-full max-w-[1440px] overflow-hidden bg-white shadow-sm ring-1 ring-stone-200">
              <GlobalStyles />
              {content.length === 0 ? (
                <div className="mx-auto max-w-2xl px-6 py-16 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <p className="text-lg font-semibold text-stone-900">Page vide</p>
                  <p className="mt-1 text-sm text-stone-500">Partez d&apos;un gabarit, ou ajoutez des sections une à une.</p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {PAGE_TEMPLATES.filter((t) => t.id !== 'vide').map((t) => (
                      <button key={t.id} type="button" onClick={() => commit(t.build())} className="rounded-xl border border-stone-200 p-4 text-left hover:border-sky-400 hover:bg-sky-50">
                        <span className="block text-sm font-semibold text-stone-800">{t.label}</span>
                        <span className="block text-xs text-stone-500">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setLibraryOpen(true)} className="mt-4 text-sm font-semibold text-sky-700 hover:underline">Ou ouvrir la bibliothèque</button>
                </div>
              ) : (
                <Canvas
                  content={content}
                  selection={selection}
                  onSelect={setSelection}
                  onChange={(next, key) => commit(next, key)}
                  createDropped={(t) => (t ? createBlock(t as BlockType) : null)}
                />
              )}
            </div>
          )}
        </main>

        <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-stone-200 bg-white md:block">
          {settingsOpen ? (
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">Réglages de la page</p>
                <button type="button" aria-label="Fermer" onClick={() => setSettingsOpen(false)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X size={16} /></button>
              </div>
              <div className="space-y-4 px-4 py-4 text-sm">
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-stone-700">Titre (onglet et référencement)</span>
                  <input className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" value={meta.title} onChange={(e) => setMetaField('title', e.target.value)} /></label>
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-stone-700">Adresse de la page</span>
                  <div className="flex items-center rounded-lg border border-stone-200 pl-3 text-sm text-stone-400">/<input className="min-w-0 flex-1 px-1 py-2 text-stone-800 outline-none" value={meta.slug} onChange={(e) => setMetaField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, '-'))} /></div>
                  <span className="mt-1 block text-[11px] text-amber-700">Changer l&apos;adresse d&apos;une page déjà indexée casse les liens existants.</span></label>
                <label className="flex items-center justify-between text-[12px] font-semibold text-stone-700">Afficher l&apos;en-tête du site<input type="checkbox" className="h-4 w-4 accent-sky-600" checked={meta.show_header} onChange={(e) => setMetaField('show_header', e.target.checked)} /></label>
                <label className="flex items-center justify-between text-[12px] font-semibold text-stone-700">Afficher le pied de page<input type="checkbox" className="h-4 w-4 accent-sky-600" checked={meta.show_footer} onChange={(e) => setMetaField('show_footer', e.target.checked)} /></label>
                <a href={pagePath(meta.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"><ExternalLink size={13} /> Voir la page publiée</a>
                <p className="border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">Titre et description pour Google : menu SEO de l&apos;admin. Raccourcis : Cmd/Ctrl + S enregistre, Cmd/Ctrl + Z annule, Suppr retire le bloc sélectionné, Échap désélectionne.</p>
              </div>
            </div>
          ) : (
            <Inspector
              content={content}
              selection={selection}
              mode={editMode}
              onSelect={setSelection}
              onChange={(next, key) => commit(next, key)}
              onOpenLibrary={() => setLibraryOpen(true)}
              onAiSection={(id) => setAi({ scope: 'section', sectionId: id })}
            />
          )}
        </aside>
      </div>

      {ai && <AiPanel scope={ai.scope} onClose={() => setAi(null)} onRun={runAi} />}
    </div>
  );

  return createPortal(ui, document.body);
}
