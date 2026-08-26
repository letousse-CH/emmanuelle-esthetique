import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Save, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, LogOut, Check
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
  onExit?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function InlinePageEditor({ pageId, initialSections, onExit }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [modalSectionIndex, setModalSectionIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [autoSaveTick, setAutoSaveTick] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

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
      return true;
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setSaveStatus('error');
      return false;
    }
  }, [pageId, markClean]);

  const requestSave = useCallback(async () => {
    setAutoSaveTick((n) => n + 1);
  }, []);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const handleExitWithAutoSave = async () => {
    setIsExiting(true);
    if (dirty) {
      setSaveStatus('saving');
      const ok = await persist(sectionsRef.current);
      if (ok && onExit) {
        onExit();
      }
    } else if (onExit) {
      onExit();
    }
    setIsExiting(false);
  };

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

      {/* Barre de Contrôle Front-End Flottante Lumineuse avec Sortie Automatique */}
      <div className="fixed bottom-6 left-6 z-[9990] bg-zinc-900/95 text-white px-4 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-zinc-700/80 backdrop-blur-md flex items-center gap-3 select-none animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Édition active</span>
        </div>

        <div className="h-4 w-px bg-zinc-700 my-auto" />

        {/* Bouton Sauvegarder la page */}
        <button
          type="button"
          onClick={save}
          disabled={saveStatus === 'saving' || isExiting}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
            dirty || saveStatus === 'error'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] hover:scale-105'
              : 'bg-white/10 hover:bg-white/20 text-zinc-200'
          } disabled:opacity-50`}
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={13} className="animate-spin text-emerald-300" />
          ) : (
            <Save size={13} />
          )}
          <span>{saveStatus === 'saving' ? 'Enregistrement…' : 'Enregistrer'}</span>
        </button>

        {/* Bouton Sortir du mode édition avec enregistrement automatique */}
        {onExit && (
          <>
            <div className="h-4 w-px bg-zinc-700 my-auto" />
            <button
              type="button"
              onClick={handleExitWithAutoSave}
              disabled={saveStatus === 'saving' || isExiting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-full text-xs font-extrabold transition-all cursor-pointer shadow-[0_2px_10px_rgba(249,115,22,0.3)] hover:scale-105 disabled:opacity-50"
              title="Enregistre automatiquement toutes les modifications et quitte le mode édition"
            >
              {isExiting ? (
                <Loader2 size={13} className="animate-spin text-white" />
              ) : (
                <Eye size={13} />
              )}
              <span>{isExiting ? 'Sortie en cours…' : 'Sortir du mode édition'}</span>
            </button>
          </>
        )}

        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-emerald-400 text-xs font-extrabold animate-fade-in pl-1">
            <Check size={13} /> Enregistré !
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1 text-red-400 text-xs font-bold" title={errorMsg}>
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
