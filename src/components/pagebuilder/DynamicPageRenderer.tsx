"use client";

import React, { useContext, useState } from 'react';
import SectionAiMiniModal from './SectionAiMiniModal';
import { WIREFRAME_REGISTRY } from './wireframes.config';
import { SectionAnimationProvider } from './sectionAnimation';
import type { PageSection, SectionType } from './wireframes.config';
import { PageEditorContext } from '../../contexts/PageEditorContext';
import { SECTION_LABELS } from './sectionPreviews';
import { GripVertical, ArrowUp, ArrowDown, Settings, Copy, Trash2, Plus, Sun, Moon, Sparkles, Wand2, Loader2, X } from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';

interface Props {
  sections: PageSection[];
  onUnknownType?: (type: string) => void;
}

function UnknownSection({ type }: { type: string }) {
  return (
    <div className="py-12 px-6 bg-red-50/80 border border-red-200 text-red-700 text-center rounded-2xl my-6 mx-auto max-w-xl shadow-xs">
      <p className="font-bold text-sm mb-1">Section inconnue</p>
      <p className="font-mono text-sm">"{type}" n'existe pas dans le registre de wireframes.</p>
    </div>
  );
}

export default function DynamicPageRenderer({ sections, onUnknownType }: Props) {
  const editorCtx = useContext(PageEditorContext);
  const isEditing = editorCtx?.isEditing ?? false;
  const moduleFlags = useModuleFlags();

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // AI Rewrite State
  const [aiModalIdx, setAiModalIdx] = useState<number | null>(null);

  if (!sections || sections.length === 0) {
    return (
      <div className="py-32 text-center text-stone-500">
        <p className="font-serif text-2xl font-light mb-4">Aucune section sur cette page.</p>
        {isEditing && (
          <button
            onClick={() => editorCtx?.addSection?.('hero_1', 0)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-colors shadow-md cursor-pointer"
          >
            <Plus size={14} />
            <span>Ajouter une première section</span>
          </button>
        )}
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverIdx(null);
  };

  const handleDropOnSection = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    setDraggedIdx(null);

    // 1. Détecter si c'est une nouvelle section glissée depuis le catalogue
    const rawJson = e.dataTransfer.getData('application/json');
    if (rawJson) {
      try {
        const payload = JSON.parse(rawJson);
        if (payload.type === 'new_section' && payload.sectionType) {
          editorCtx?.addSection?.(payload.sectionType, targetIndex);
          return;
        }
      } catch { /* pas de JSON */ }
    }

    // 2. Déplacement d'une section existante
    const fromStr = e.dataTransfer.getData('text/plain');
    const fromIndex = parseInt(fromStr, 10);
    if (!isNaN(fromIndex) && fromIndex !== targetIndex && editorCtx?.moveToSection) {
      editorCtx.moveToSection(fromIndex, targetIndex);
    }
  };

  return (
    <>
      {sections.map((section, i) => {
        const entry = WIREFRAME_REGISTRY[section.type as SectionType];

        if (!entry) {
          onUnknownType?.(section.type);
          return <UnknownSection key={i} type={section.type} />;
        }

        const Component = entry.component;
        const animation = (section.data as { animation?: string } | undefined)?.animation;
        const isCurrentDragged = draggedIdx === i;
        const isCurrentOver = dragOverIdx === i;
        const secLabel = SECTION_LABELS[section.type] ?? section.type;
        const isDarkTheme = (section.data as { theme?: string } | undefined)?.theme === 'dark';

        return (
          <React.Fragment key={`${i}-${animation ?? 'defaut'}`}>
            <div
              id={`section-${i}`}
              draggable={isEditing}
              onDragStart={(e) => isEditing && handleDragStart(e, i)}
              onDragOver={(e) => isEditing && handleDragOver(e, i)}
              onDragLeave={isEditing ? handleDragLeave : undefined}
              onDrop={(e) => isEditing && handleDropOnSection(e, i)}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              className={`relative group/sec transition-all ${
                isEditing
                  ? isCurrentOver
                    ? 'ring-4 ring-amber-500 ring-offset-2 bg-amber-50/20 z-20'
                    : isCurrentDragged
                    ? 'opacity-40 border-2 border-dashed border-amber-400'
                    : 'hover:outline hover:outline-2 hover:outline-emerald-500/80 hover:outline-offset-[-2px]'
                  : ''
              }`}
            >
              {/* Barre de contrôle & Poignée au survol de chaque section */}
              {isEditing && (
                <div
                  data-floating-panel="true"
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-40 opacity-90 group-hover/sec:opacity-100 transition-all duration-200 pointer-events-auto shadow-xl"
                >
                  <div className="flex items-center gap-2 bg-zinc-900/95 text-white px-4 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-zinc-700/80 backdrop-blur-md text-xs select-none">
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-full cursor-grab active:cursor-grabbing font-extrabold text-white transition-colors"
                      title="Maintenir et glisser pour déplacer cette section n'importe où"
                    >
                      <GripVertical size={14} className="text-zinc-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-white">{secLabel}</span>
                    </span>

                    <div className="h-4 w-px bg-zinc-700 my-auto" />

                    {/* Bouton Réécriture IA */}
                    {moduleFlags.ai_generation && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setAiModalIdx(i);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 font-extrabold rounded-full text-white transition-all cursor-pointer shadow-xs hover:scale-105"
                          title="Réécrire ou optimiser ce texte avec l'IA"
                        >
                          <Wand2 size={13} className="text-amber-200" />
                          <span>IA</span>
                        </button>
                        <div className="h-4 w-px bg-zinc-700 my-auto" />
                      </>
                    )}

                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => editorCtx?.moveSection?.(i, -1)}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-zinc-300 hover:text-white cursor-pointer"
                        title="Monter d'un cran"
                      >
                        <ArrowUp size={14} />
                      </button>
                    )}
                    {i < sections.length - 1 && (
                      <button
                        type="button"
                        onClick={() => editorCtx?.moveSection?.(i, 1)}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-zinc-300 hover:text-white cursor-pointer"
                        title="Descendre d'un cran"
                      >
                        <ArrowDown size={14} />
                      </button>
                    )}

                    <div className="h-4 w-px bg-zinc-700 my-auto" />

                    <button
                      type="button"
                      onClick={() => editorCtx?.openSectionEditor?.(i)}
                      className="flex items-center gap-1.5 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-full shadow-xs hover:scale-105 transition-all cursor-pointer"
                      title="Ouvrir les réglages complets"
                    >
                      <Settings size={13} />
                      <span>Réglages</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => editorCtx?.duplicateSection?.(i)}
                      className="p-1.5 hover:bg-white/20 rounded-full text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title="Dupliquer la section"
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => editorCtx?.removeSection?.(i)}
                      className="p-1.5 hover:bg-red-500/30 rounded-full text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      title="Supprimer la section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}

              <SectionAnimationProvider animation={animation}>
                <Component data={section.data} sectionIndex={i} />
              </SectionAnimationProvider>
            </div>
          </React.Fragment>
        );
      })}

      {/* Mini Modale Réécriture IA Spéciale Section */}
      {aiModalIdx !== null && sections[aiModalIdx] && (
        <SectionAiMiniModal
          section={sections[aiModalIdx]}
          sectionIndex={aiModalIdx}
          isOpen={aiModalIdx !== null}
          onClose={() => setAiModalIdx(null)}
          onApplyData={(newData) => {
            Object.keys(newData).forEach((key) => {
              editorCtx?.updateField?.(aiModalIdx, key, newData[key]);
            });
            editorCtx?.savePage?.();
          }}
        />
      )}
    </>
  );
}
