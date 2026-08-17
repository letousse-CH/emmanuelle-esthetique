import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pencil, X, Save, ChevronUp, ChevronDown, Trash2, Copy, Undo2,
  Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import DynamicPageRenderer from './DynamicPageRenderer';
import { WIREFRAME_REGISTRY, AVAILABLE_SECTION_TYPES } from './wireframes.config';
import type { PageSection, SectionType } from './wireframes.config';
import { SECTION_LABELS, SectionPreview } from './sectionPreviews';
import { usePageEditor } from './usePageEditor';
import FieldEditor from './FieldEditor';
import { updatePage } from '../../services/dynamicPages';
import { PageEditorContext } from '../../contexts/PageEditorContext';

interface Props {
  pageId: string;
  initialSections: PageSection[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function InlinePageEditor({ pageId, initialSections }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // Compteur de demandes d'enregistrement automatique : incrémenté par les
  // composants éditables en ligne, consommé par l'effet ci-dessous.
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  const [query, setQuery] = useState('');

  const visibleTypes = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AVAILABLE_SECTION_TYPES;
    return AVAILABLE_SECTION_TYPES.filter((type) =>
      `${SECTION_LABELS[type] ?? ''} ${type} ${WIREFRAME_REGISTRY[type]?.description ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const { sections, move, remove, duplicate, add, updateField, undo, canUndo, dirty, markClean } =
    usePageEditor(initialSections);

  const persist = useCallback(async (payload: PageSection[]) => {
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      await updatePage(pageId, { sections: payload });
      markClean();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setSaveStatus('error');
    }
  }, [pageId, markClean]);

  /**
   * `EditableText` / `EditableImage` appellent `updateField` puis `savePage`
   * dans le même tick : lire `sections` à ce moment-là renvoyait l'état
   * *d'avant* la modification, qui était donc écrasé en base (la pastille
   * « Enregistré » s'affichait pourtant). On ne fait ici que demander un
   * enregistrement ; l'effet ci-dessous l'exécute une fois l'état appliqué.
   */
  const requestSave = useCallback(async () => {
    setAutoSaveTick((n) => n + 1);
  }, []);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    if (autoSaveTick === 0) return;
    const timer = setTimeout(() => { void persist(sectionsRef.current); }, 700);
    return () => clearTimeout(timer);
  }, [autoSaveTick, sections, persist]);

  // Marqueur lu par UniversalPageEditor : sur une page du page builder, c'est
  // cet éditeur-ci qui gère l'édition en ligne, pas le balayage du DOM.
  useEffect(() => {
    document.body.dataset.pageEditor = 'inline';
    return () => { delete document.body.dataset.pageEditor; };
  }, []);

  // Garde-fou : ne pas quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Raccourcis : ⌘/Ctrl+S enregistre, ⌘/Ctrl+Z annule.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        void persist(sectionsRef.current);
      } else if (e.key === 'z' && !e.shiftKey && open) {
        const el = e.target as HTMLElement | null;
        // Laisse l'annulation native aux champs de saisie.
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist, undo, open]);

  const save = () => persist(sectionsRef.current);

  // Stable : sinon chaque frappe recrée le contexte et refait rendre toutes les
  // sections éditables de la page.
  const editorContext = React.useMemo(
    () => ({ updateField, savePage: requestSave, isEditing: true }),
    [updateField, requestSave],
  );

  return (
    <>
      {/* Prévisualisation — décalée quand le panneau est ouvert */}
      <div className={open ? 'mr-80 transition-all duration-300' : 'transition-all duration-300'}>
        <PageEditorContext.Provider value={editorContext}>
          <DynamicPageRenderer sections={sections} />
        </PageEditorContext.Provider>
      </div>

      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-bold hover:bg-sage transition-colors duration-300"
        >
          <Pencil size={15} /> Modifier la page
        </button>
      )}

      {/* Panneau latéral droit */}
      <div className={`fixed top-16 right-0 bg-white border-l border-stone-200 shadow-2xl z-[60] flex flex-col transition-transform duration-300 w-80`} style={{ bottom: 0, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900 text-sm">Édition</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Annuler (⌘/Ctrl + Z)"
                className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg disabled:opacity-25 transition-colors cursor-pointer"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={save}
                disabled={saveStatus === 'saving'}
                title="Enregistrer (⌘/Ctrl + S)"
                className="flex items-center gap-1.5 bg-sage text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-wood transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Enregistrer
              </button>
              <button onClick={() => setOpen(false)} title="Fermer le panneau" className="text-stone-400 hover:text-stone-900 p-1 cursor-pointer">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="min-h-4 text-xs">
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-stone-400"><Loader2 size={11} className="animate-spin" /> Enregistrement…</span>
            ) : saveStatus === 'error' ? (
              <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> {errorMsg}</span>
            ) : dirty ? (
              <span className="text-amber-600">Modifications non enregistrées</span>
            ) : saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> Enregistré</span>
            ) : (
              <span className="text-stone-300">À jour</span>
            )}
          </div>
        </div>

        {/* Liste des sections */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">
            Sections ({sections.length})
          </p>

          {sections.map((section, i) => (
            <div
              key={i}
              className={`rounded-xl border transition-all ${active === i ? 'border-sage bg-sage/5' : 'border-stone-200 bg-white hover:border-stone-300'}`}
            >
              <div
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                onClick={() => {
                  const next = active === i ? null : i;
                  setActive(next);
                  // Amène la section correspondante sous les yeux de l'éditrice.
                  if (next !== null) {
                    document.getElementById(`section-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900">{SECTION_LABELS[section.type] ?? section.type}</p>
                  <p className="text-[10px] text-stone-400 truncate max-w-[150px]">
                    {WIREFRAME_REGISTRY[section.type]?.description}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                  <button title="Monter" onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20 cursor-pointer"><ChevronUp size={13} /></button>
                  <button title="Descendre" onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20 cursor-pointer"><ChevronDown size={13} /></button>
                  <button title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicate(i); setActive(i + 1); }}
                    className="p-1 text-stone-400 hover:text-sage cursor-pointer"><Copy size={12} /></button>
                  <button
                    title="Supprimer"
                    onClick={(e) => {
                      e.stopPropagation();
                      const label = SECTION_LABELS[section.type] ?? section.type;
                      if (!window.confirm(`Supprimer la section « ${label} » ?`)) return;
                      remove(i);
                      setActive(null);
                    }}
                    className="p-1 text-stone-400 hover:text-red-500 cursor-pointer"><Trash2 size={12} /></button>
                </div>
              </div>

              {active === i && (
                <div className="px-3 pb-3 border-t border-stone-100 pt-3">
                  <FieldEditor section={section} sectionIndex={i} onUpdate={updateField} compact />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Ajouter une section */}
        <div className="p-3 border-t border-stone-100 shrink-0 max-h-72 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 shrink-0">Ajouter</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sage"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {visibleTypes.map((type) => (
              <button
                type="button"
                key={type}
                title={WIREFRAME_REGISTRY[type]?.description}
                onClick={() => { add(type as SectionType); setActive(sections.length); setQuery(''); }}
                className="group/add flex flex-col rounded-lg border border-stone-200 bg-white overflow-hidden text-left hover:border-sage hover:shadow-sm transition-all"
              >
                <span className="block aspect-[8/5] bg-stone-50 border-b border-stone-100 group-hover/add:bg-sage/5 transition-colors">
                  <SectionPreview type={type as SectionType} />
                </span>
                <span className="px-1.5 py-1 text-[9px] font-semibold text-stone-600 group-hover/add:text-sage transition-colors leading-tight">
                  {SECTION_LABELS[type] ?? type}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
