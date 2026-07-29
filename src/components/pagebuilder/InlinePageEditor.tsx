import React, { useState } from 'react';
import {
  Pencil, X, Save, ChevronUp, ChevronDown, Trash2,
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

  const { sections, move, remove, add, updateField } = usePageEditor(initialSections);

  const save = async () => {
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      await updatePage(pageId, { sections });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setSaveStatus('error');
    }
  };

  return (
    <>
      {/* Prévisualisation — décalée quand le panneau est ouvert */}
      <div className={open ? 'mr-80 transition-all duration-300' : 'transition-all duration-300'}>
        <PageEditorContext.Provider value={{ updateField, savePage: save, isEditing: true }}>
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
      <div className={`fixed top-16 right-0 bg-white border-l border-stone-200 shadow-2xl z-40 flex flex-col transition-transform duration-300 w-80`} style={{ bottom: 0, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
          <span className="font-bold text-stone-900 text-sm">Édition</span>
          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={13} /> Sauvegardé</span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle size={13} /> {errorMsg}</span>
            )}
            <button
              onClick={save}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 bg-sage text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-wood transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Sauvegarder
            </button>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-900 p-1">
              <X size={16} />
            </button>
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
                onClick={() => setActive(active === i ? null : i)}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900">{SECTION_LABELS[section.type] ?? section.type}</p>
                  <p className="text-[10px] text-stone-400 truncate max-w-[150px]">
                    {WIREFRAME_REGISTRY[section.type]?.description}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                  <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}
                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20"><ChevronUp size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === sections.length - 1}
                    className="p-1 text-stone-400 hover:text-stone-900 disabled:opacity-20"><ChevronDown size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); remove(i); setActive(null); }}
                    className="p-1 text-stone-400 hover:text-red-500"><Trash2 size={12} /></button>
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
        <div className="p-3 border-t border-stone-100 shrink-0 max-h-64 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Ajouter</p>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_SECTION_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                title={WIREFRAME_REGISTRY[type]?.description}
                onClick={() => { add(type as SectionType); setActive(sections.length); }}
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
