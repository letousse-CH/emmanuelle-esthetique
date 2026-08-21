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
import SectionEditorModal from './SectionEditorModal';
import { updatePage } from '../../services/dynamicPages';
import { PageEditorContext } from '../../contexts/PageEditorContext';

import FloatingPanel from './FloatingPanel';

interface Props {
  pageId: string;
  initialSections: PageSection[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function InlinePageEditor({ pageId, initialSections }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [modalSectionIndex, setModalSectionIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
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

  const { sections, move, remove, duplicate, add, swapType, updateField, undo, canUndo, dirty, markClean } =
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && open) {
        e.preventDefault();
        void persist(sectionsRef.current);
      } else if (e.key === 'z' && !e.shiftKey && open) {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist, undo, open]);

  const save = () => persist(sectionsRef.current);

  const editorContext = React.useMemo(
    () => ({
      updateField,
      savePage: requestSave,
      openSectionEditor: (idx: number) => setModalSectionIndex(idx),
      swapType,
      isEditing: true,
    }),
    [updateField, requestSave, swapType],
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

      {/* Bouton flottant d'édition */}
      {modalSectionIndex === null && (
        <button
          onClick={() => setModalSectionIndex(active ?? 0)}
          className="fixed bottom-6 left-6 z-[9990] flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-bold hover:bg-stone-800 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
        >
          <Pencil size={15} /> Modifier la page
        </button>
      )}

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
