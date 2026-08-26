import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Save, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import DynamicPageRenderer from './DynamicPageRenderer';
import { WIREFRAME_REGISTRY, AVAILABLE_SECTION_TYPES } from './wireframes.config';
import type { PageSection, SectionType } from './wireframes.config';
import { SECTION_LABELS, SectionPreview } from './sectionPreviews';
import { usePageEditor } from './usePageEditor';
import FieldEditor from './FieldEditor';
import SectionEditorModal from './SectionEditorModal';
import AiPageModal from './AiPageModal';
import { updatePage } from '../../services/dynamicPages';
import { PageEditorContext } from '../../contexts/PageEditorContext';

import FloatingPanel from './FloatingPanel';

interface Props {
  pageId: string;
  initialSections: PageSection[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function InlinePageEditor({ pageId, initialSections }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [modalSectionIndex, setModalSectionIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [autoSaveTick, setAutoSaveTick] = useState(0);

  const { sections, move, remove, duplicate, add, swapType, updateField, undo, canUndo, dirty, markClean, moveTo, replaceAll } =
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

  useEffect(() => {
    document.body.dataset.pageEditor = 'inline';
    return () => { delete document.body.dataset.pageEditor; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persist(sectionsRef.current);
      } else if (e.key === 'z' && !e.shiftKey) {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist, undo]);

  const save = () => persist(sectionsRef.current);

  const editorContext = React.useMemo(
    () => ({
      updateField,
      savePage: requestSave,
      openSectionEditor: (idx: number) => setModalSectionIndex(idx),
      swapType,
      moveSection: move,
      moveToSection: moveTo,
      removeSection: remove,
      duplicateSection: duplicate,
      addSection: add,
      isEditing: true,
    }),
    [updateField, requestSave, swapType, move, moveTo, remove, duplicate, add],
  );

  const handleSectionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-floating-panel="true"]') || target.closest('[data-img-buttons="true"]')) return;
    const secEl = target.closest('[id^="section-"]');
    if (secEl) {
      const idStr = secEl.id.replace('section-', '');
      const idx = parseInt(idStr, 10);
      if (!isNaN(idx) && sections[idx]) {
        setActive(idx);
        setModalSectionIndex(idx);
      }
    }
  };

  return (
    <>
      <div onClick={handleSectionClick}>
        <PageEditorContext.Provider value={editorContext}>
          <DynamicPageRenderer sections={sections} />
        </PageEditorContext.Provider>
      </div>

      {/* Barre de Sauvegarde Front-End Lumineuse & Colorée IA */}
      <div className="fixed bottom-6 left-6 z-[9990] bg-gradient-to-r from-white via-purple-50/95 to-amber-50/95 text-zinc-900 px-4 py-2.5 rounded-full shadow-[0_4px_25px_rgba(168,85,247,0.25)] border border-purple-200 backdrop-blur-md flex items-center gap-3 select-none animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-extrabold text-zinc-900">Édition en direct</span>
        </div>

        <div className="h-4 w-px bg-zinc-700" />

        {/* Bouton Sauvegarder la page Front-End */}
        <button
          onClick={save}
          disabled={saveStatus === 'saving'}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-extrabold transition-all cursor-pointer shadow-sm ${
            dirty || saveStatus === 'error'
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-300'
              : 'bg-white text-zinc-900 hover:bg-zinc-100 font-bold'
          } disabled:opacity-50`}
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          <span>{saveStatus === 'saving' ? 'Sauvegarde…' : 'Sauvegarder la page'}</span>
        </button>

        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold animate-fade-in">
            <CheckCircle2 size={13} /> Enregistré !
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1 text-red-600 text-xs font-bold" title={errorMsg}>
            <AlertCircle size={13} /> Échec
          </span>
        )}
      </div>

      {/* Modale unique déplaçable sur tout l'écran */}
      {modalSectionIndex !== null && sections[modalSectionIndex] && (
        <SectionEditorModal
          section={sections[modalSectionIndex]}
          sectionIndex={modalSectionIndex}
          total={sections.length}
          sections={sections}
          onUpdate={updateField}
          onSwapType={swapType}
          onMoveSection={move}
          onMoveToSection={moveTo}
          onDuplicateSection={duplicate}
          onRemoveSection={remove}
          onAddSection={add}
          onClose={() => setModalSectionIndex(null)}
          onNavigate={(next) => {
            if (next >= 0 && next < sections.length) {
              setActive(next);
              setModalSectionIndex(next);
            }
          }}
        />
      )}
    </>
  );
}
