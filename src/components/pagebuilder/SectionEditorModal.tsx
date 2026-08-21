import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, GripVertical, Layers, LayoutGrid, LayoutList, Plus, RefreshCw, Sparkles, Trash2, Type, Wand2, X } from 'lucide-react';

import FloatingPanel from './FloatingPanel';
import FieldEditor from './FieldEditor';
import LayoutControls, { AnimationControls } from './LayoutControls';
import { SECTION_LABELS, SectionPreview } from './sectionPreviews';
import { WIREFRAME_REGISTRY, AVAILABLE_SECTION_TYPES } from './wireframes.config';
import type { PageSection, SectionType } from './wireframes.config';
import { SECTION_CATALOG } from './sectionCatalog';

/**
 * Configuration d'une section et de la structure de la page, en modale unique.
 */
export default function SectionEditorModal({
  section,
  sectionIndex,
  total,
  sections,
  onUpdate,
  onSwapType,
  onMoveSection,
  onMoveToSection,
  onDuplicateSection,
  onRemoveSection,
  onAddSection,
  onClose,
  onNavigate,
}: {
  section: PageSection;
  sectionIndex: number;
  total: number;
  sections?: PageSection[];
  onUpdate: (sectionIndex: number, field: string, value: unknown) => void;
  onSwapType?: (sectionIndex: number, newType: any) => void;
  onMoveSection?: (index: number, dir: -1 | 1) => void;
  onMoveToSection?: (from: number, to: number) => void;
  onDuplicateSection?: (index: number) => void;
  onRemoveSection?: (index: number) => void;
  onAddSection?: (type: any) => void;
  onClose: () => void;
  /** Passe à la section précédente ou suivante sans refermer. */
  onNavigate: (nextIndex: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'structure' | 'contenu' | 'variante' | 'fond' | 'style' | 'animation'>('contenu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const TABS = [
    { id: 'structure' as const, label: 'Sections', icon: LayoutList, hint: 'Gérer et réordonner les sections de la page' },
    { id: 'contenu' as const, label: 'Contenu', icon: Type, hint: 'Les textes et les images' },
    { id: 'variante' as const, label: 'Variante', icon: RefreshCw, hint: 'Changer la variante tout en gardant le contenu' },
    { id: 'fond' as const, label: 'Fond', icon: Layers, hint: 'Image, couleur, clair ou foncé' },
    { id: 'style' as const, label: 'Apparence', icon: Wand2, hint: 'Espacement, largeur, alignement' },
    { id: 'animation' as const, label: 'Animation', icon: Sparkles, hint: "L'effet d'apparition" },
  ];

  const visibleTypes = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AVAILABLE_SECTION_TYPES;
    return AVAILABLE_SECTION_TYPES.filter((type) =>
      `${SECTION_LABELS[type] ?? ''} ${type} ${WIREFRAME_REGISTRY[type]?.description ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.key === 'ArrowUp' && sectionIndex > 0) onNavigate(sectionIndex - 1);
      if (event.key === 'ArrowDown' && sectionIndex < total - 1) onNavigate(sectionIndex + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, sectionIndex, total]);

  useEffect(() => {
    panelRef.current?.focus();
    setTab('contenu');
  }, [sectionIndex]);

  const label = SECTION_LABELS[section.type] ?? section.type;
  const description = WIREFRAME_REGISTRY[section.type]?.description;

  const currentCategory = SECTION_CATALOG.find((cat) => cat.types.includes(section.type as SectionType));

  return (
    <FloatingPanel
      storageKey="studio.sectionEditor.box"
      ariaLabel={`Configuration : ${label}`}
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-stone-900 text-white text-[10px] font-bold uppercase tracking-wider">
                Section {sectionIndex + 1} / {total}
              </span>
              <span className="text-[11px] font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md truncate">
                {section.type}
              </span>
              {onSwapType && (
                <button
                  type="button"
                  onClick={() => setTab('variante')}
                  className="flex items-center gap-1 text-[11px] font-medium text-stone-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  title="Changer la variante de cette section"
                >
                  <RefreshCw size={11} className="text-amber-600" />
                  Changer de variante
                </button>
              )}
            </div>
            <h2 className="mt-1 truncate text-base font-bold text-stone-900">{label}</h2>
            {description && <p className="truncate text-[12px] text-stone-600 font-light mt-0.5">{description}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate(sectionIndex - 1)}
              disabled={sectionIndex === 0}
              title="Section précédente (↑)"
              aria-label="Section précédente"
              className="grid size-8 place-items-center rounded-xl bg-stone-100/80 text-stone-600 transition-all hover:bg-stone-200 hover:text-stone-900 disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(sectionIndex + 1)}
              disabled={sectionIndex >= total - 1}
              title="Section suivante (↓)"
              aria-label="Section suivante"
              className="grid size-8 place-items-center rounded-xl bg-stone-100/80 text-stone-600 transition-all hover:bg-stone-200 hover:text-stone-900 disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fermer (Échap)"
              aria-label="Fermer"
              className="ml-1 grid size-8 place-items-center rounded-xl bg-stone-100/80 text-stone-600 transition-all hover:bg-stone-900 hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between px-5 py-2.5 text-[11px] text-stone-600 bg-stone-50/60 border-t border-stone-100">
          <span>Déplacez par l'en-tête, redimensionnez en bas à droite.</span>
          <span className="hidden sm:inline-flex items-center gap-1 font-mono">
            <kbd className="border border-stone-200 bg-white px-1.5 py-0.5 rounded shadow-2xs">Échap</kbd> ferme
          </span>
        </div>
      }
    >
      <>
        <nav aria-label="Réglages de la section" className="flex border-b border-stone-100 bg-white p-1.5 gap-1">
          {TABS.map(({ id, label, icon: Icon, hint }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                title={hint}
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 px-2 text-[12px] font-semibold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-amber-300' : 'text-stone-600'} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {tab === 'structure' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-900 text-white">
                    <LayoutList size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      Structure & Ordre des Sections ({(sections ?? []).length || total})
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-600 leading-relaxed">
                      Réordonnez, dupliquez, supprimez ou basculez vers n'importe quelle section de la page.
                    </p>
                  </div>
                </div>
              </div>

              {/* Liste des sections de la page avec Drag & Drop */}
              <div className="space-y-2">
                {(sections && sections.length > 0 ? sections : [section]).map((sec, idx) => {
                  const isCurrent = idx === sectionIndex;
                  const isDragging = draggedIdx === idx;
                  const isDragOver = dragOverIdx === idx;
                  const secLabel = SECTION_LABELS[sec.type] ?? sec.type;
                  const secDesc = WIREFRAME_REGISTRY[sec.type]?.description ?? '';
                  return (
                    <div
                      key={idx}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(idx));
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedIdx(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromStr = e.dataTransfer.getData('text/plain');
                        const from = parseInt(fromStr, 10);
                        if (!isNaN(from) && onMoveToSection) {
                          onMoveToSection(from, idx);
                        }
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      onClick={() => onNavigate(idx)}
                      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isDragging
                          ? 'opacity-40 border-dashed border-stone-400 bg-stone-100'
                          : isDragOver
                          ? 'border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-400'
                          : isCurrent
                          ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                          : 'border-stone-200 bg-white hover:border-amber-400 hover:shadow-sm text-stone-800'
                      }`}
                    >
                      {/* Poignée Drag & Drop */}
                      <span
                        className={`mr-2.5 p-1 rounded-md cursor-grab active:cursor-grabbing transition-colors shrink-0 ${
                          isCurrent
                            ? 'text-stone-500 hover:text-white hover:bg-stone-800'
                            : 'text-stone-400 hover:text-stone-900 hover:bg-stone-100'
                        }`}
                        title="Glisser-déposer pour réordonner"
                      >
                        <GripVertical size={16} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${isCurrent ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-600'}`}>
                            #{idx + 1}
                          </span>
                          <span className={`text-sm font-bold truncate ${isCurrent ? 'text-white' : 'text-stone-900'}`}>
                            {secLabel}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-stone-800 px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        {secDesc && (
                          <p className={`mt-1 text-xs truncate ${isCurrent ? 'text-stone-300' : 'text-stone-500'}`}>
                            {secDesc}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                        {onMoveSection && (
                          <>
                            <button
                              type="button"
                              title="Monter"
                              onClick={() => onMoveSection(idx, -1)}
                              disabled={idx === 0}
                              className={`p-1.5 rounded-lg disabled:opacity-20 transition-all cursor-pointer ${isCurrent ? 'hover:bg-stone-800 text-white' : 'hover:bg-stone-100 text-stone-600'}`}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              title="Descendre"
                              onClick={() => onMoveSection(idx, 1)}
                              disabled={idx === (sections?.length ?? total) - 1}
                              className={`p-1.5 rounded-lg disabled:opacity-20 transition-all cursor-pointer ${isCurrent ? 'hover:bg-stone-800 text-white' : 'hover:bg-stone-100 text-stone-600'}`}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </>
                        )}
                        {onDuplicateSection && (
                          <button
                            type="button"
                            title="Dupliquer"
                            onClick={() => onDuplicateSection(idx)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${isCurrent ? 'hover:bg-stone-800 text-white' : 'hover:bg-stone-100 text-stone-600'}`}
                          >
                            <Copy size={13} />
                          </button>
                        )}
                        {onRemoveSection && (
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => onRemoveSection(idx)}
                            className={`p-1.5 rounded-lg text-red-500 transition-all cursor-pointer ${isCurrent ? 'hover:bg-stone-800' : 'hover:bg-red-50'}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ajouter une section */}
              {onAddSection && (
                <div className="border-t border-stone-200 pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      Ajouter une nouvelle section
                    </h4>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher une section…"
                      className="border border-stone-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900 w-48"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                    {visibleTypes.map((typeKey) => (
                      <button
                        type="button"
                        key={typeKey}
                        title={WIREFRAME_REGISTRY[typeKey]?.description}
                        onClick={() => onAddSection(typeKey as SectionType)}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 bg-white text-left hover:border-stone-900 hover:shadow-xs transition-all cursor-pointer"
                      >
                        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700">
                          <Plus size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-stone-900 truncate">
                            {SECTION_LABELS[typeKey] ?? typeKey}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono truncate">
                            {typeKey}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'contenu' && (
            <FieldEditor
              section={section}
              sectionIndex={sectionIndex}
              onUpdate={onUpdate}
              contentOnly
              scope="content"
            />
          )}

          {tab === 'variante' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
                    <RefreshCw size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      Variantes pour la catégorie {currentCategory ? `« ${currentCategory.label} »` : 'actuelle'}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-600 leading-relaxed">
                      Seules les variantes correspondant à cette section sont proposées ci-dessous. Vos titres, textes, images et boutons sont <strong>conservés automatiquement</strong> lors de la conversion.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grille des variantes de la catégorie actuelle avec schématisation wireframe */}
              {currentCategory ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      {currentCategory.label} — <span className="font-normal normal-case text-stone-500">{currentCategory.hint}</span>
                    </span>
                    <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                      {currentCategory.types.length} variantes
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentCategory.types.map((typeKey) => {
                      const active = section.type === typeKey;
                      const variantLabel = SECTION_LABELS[typeKey] ?? typeKey;
                      const variantDesc = WIREFRAME_REGISTRY[typeKey]?.description ?? '';
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => {
                            if (onSwapType) {
                              onSwapType(sectionIndex, typeKey);
                            }
                          }}
                          className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                              : 'border-stone-200 bg-white hover:border-amber-400 hover:shadow-sm text-stone-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium ${active ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-600'}`}>
                                {typeKey}
                              </span>
                              {active && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                                  <Check size={13} /> Modèle actif
                                </span>
                              )}
                            </div>

                            {/* Schéma fil de fer / Wireframe de la variante */}
                            <div className={`my-2.5 rounded-lg overflow-hidden border aspect-[16/9] flex items-center justify-center p-1.5 transition-all ${
                              active
                                ? 'bg-stone-800 border-stone-700'
                                : 'bg-stone-50 border-stone-100 group-hover:border-amber-200 group-hover:bg-amber-50/30'
                            }`}>
                              <div className="w-full h-full transform scale-95 origin-center">
                                <SectionPreview type={typeKey} />
                              </div>
                            </div>

                            <h4 className={`text-sm font-bold ${active ? 'text-white' : 'text-stone-900'}`}>
                              {variantLabel}
                            </h4>
                            {variantDesc && (
                              <p className={`mt-1 text-xs leading-relaxed ${active ? 'text-stone-300' : 'text-stone-500'}`}>
                                {variantDesc}
                              </p>
                            )}
                          </div>

                          {!active && (
                            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform">
                              <span>Basculez vers ce modèle ➔</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">Aucune autre variante disponible pour ce type de section.</p>
              )}
            </div>
          )}

          {tab === 'fond' && (
            <FieldEditor
              section={section}
              sectionIndex={sectionIndex}
              onUpdate={onUpdate}
              scope="background"
            />
          )}

          {tab === 'style' && (
            <LayoutControls
              data={section.data as unknown as Record<string, unknown>}
              onChange={(field, value) => onUpdate(sectionIndex, field, value)}
              hasCards={'cards_text_size' in (WIREFRAME_REGISTRY[section.type]?.dataSchema ?? {})}
            />
          )}

          {tab === 'animation' && (
            <AnimationControls
              data={section.data as unknown as Record<string, unknown>}
              onChange={(field, value) => onUpdate(sectionIndex, field, value)}
            />
          )}
        </div>
      </>
    </FloatingPanel>
  );
}
