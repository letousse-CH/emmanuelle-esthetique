import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, GripVertical, Layers, LayoutGrid, LayoutList, Plus, RefreshCw, Sparkles, Trash2, Type, Wand2, X } from 'lucide-react';

import FloatingPanel from './FloatingPanel';
import FieldEditor from './FieldEditor';
import LayoutControls, { AnimationControls } from './LayoutControls';
import { SECTION_LABELS, SectionPreview } from './sectionPreviews';
import { WIREFRAME_REGISTRY, AVAILABLE_SECTION_TYPES } from './wireframes.config';
import type { PageSection, SectionType } from './wireframes.config';
import VoiceInputButton from './VoiceInputButton';
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
  onAddSection?: (type: any, atIndex?: number) => void;
  onClose: () => void;
  /** Passe à la section précédente ou suivante sans refermer. */
  onNavigate: (nextIndex: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<'ia' | 'structure' | 'contenu' | 'variante' | 'fond' | 'style' | 'animation'>('contenu');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [insertTargetIdx, setInsertTargetIdx] = useState<number | null>(null);

  // State Assistant IA dans la modale
  const [modalAiPrompt, setModalAiPrompt] = useState('');
  const [modalAiLoading, setModalAiLoading] = useState(false);

  const TABS = [
    { id: 'contenu' as const, label: 'Contenu', icon: Type, hint: 'Modifier les textes, titres, listes et images' },
    { id: 'ia' as const, label: 'Assistant IA', icon: Sparkles, hint: 'Réécrire, raccourcir ou booster la conversion avec l’IA' },
    { id: 'variante' as const, label: 'Variante', icon: RefreshCw, hint: 'Changer la variante tout en gardant le contenu' },
    { id: 'fond' as const, label: 'Fond', icon: Layers, hint: 'Image, couleur, clair ou foncé' },
    { id: 'style' as const, label: 'Apparence', icon: Wand2, hint: 'Espacement, largeur, alignement' },
    { id: 'animation' as const, label: 'Animation', icon: Sparkles, hint: "L'effet d'apparition" },
    { id: 'structure' as const, label: 'Sections', icon: LayoutList, hint: 'Gérer et réordonner toutes les sections de la page' },
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

  const [modalAiSuccess, setModalAiSuccess] = useState(false);
  const [modalAiError, setModalAiError] = useState('');

  const handleModalAi = async (preset?: string) => {
    const instruction = preset || modalAiPrompt;
    if (!instruction) return;

    setModalAiLoading(true);
    setModalAiSuccess(false);
    setModalAiError('');

    try {
      const sessionRes = await (await import('../../services/supabase')).supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/modify-page-with-ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `Pour la section de type "${section.type}", applique cette modification au texte : "${instruction}". Conserve la même structure de données.`,
          sections: [section],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération IA.');

      if (data.sections && data.sections[0]?.data) {
        const newData = data.sections[0].data;
        Object.keys(newData).forEach((key) => {
          onUpdate(sectionIndex, key, newData[key]);
        });
        setModalAiSuccess(true);
        setTimeout(() => setModalAiSuccess(false), 3000);
      } else {
        throw new Error('Le format de la section renvoyée est invalide.');
      }
    } catch (e: any) {
      console.error('Erreur IA:', e);
      setModalAiError(e.message || 'Erreur lors de la génération IA.');
      setTimeout(() => setModalAiError(''), 5000);
    } finally {
      setModalAiLoading(false);
      setModalAiPrompt('');
    }
  };

  return (
    <FloatingPanel
      storageKey="studio.sectionEditor.box"
      ariaLabel={`Configuration : ${label}`}
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white text-zinc-900 border-b border-zinc-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white text-[10.5px] font-extrabold uppercase tracking-wider shadow-[0_2px_10px_rgba(168,85,247,0.25)]">
                Édition de section
              </span>
              <span className="text-[11px] font-mono font-extrabold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200">
                {section.type}
              </span>
              {onSwapType && (
                <button
                  type="button"
                  onClick={() => setTab('variante')}
                  className="flex items-center gap-1.5 text-[11px] font-extrabold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 px-3 py-1 rounded-full shadow-[0_2px_10px_rgba(249,115,22,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  title="Changer la variante de cette section"
                >
                  <RefreshCw size={11} className="text-white" />
                  Changer la variante
                </button>
              )}
            </div>
            <h2 className="mt-1.5 truncate text-base font-extrabold text-zinc-900 flex items-center gap-2">
              {label}
            </h2>
            {description && <p className="truncate text-xs text-zinc-500 font-medium mt-0.5">{description}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate(sectionIndex - 1)}
              disabled={sectionIndex === 0}
              className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-20 transition-all cursor-pointer"
              title="Section précédente"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(sectionIndex + 1)}
              disabled={sectionIndex === total - 1}
              className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-20 transition-all cursor-pointer"
              title="Section suivante"
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer ml-1"
              title="Fermer (Échap)"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between px-5 py-2.5 text-[11px] font-medium text-zinc-500 bg-zinc-50 border-t border-zinc-200">
          <span>Déplacez par l'en-tête, redimensionnez en bas à droite.</span>
          <span className="hidden sm:inline-flex items-center gap-1 font-mono">
            <kbd className="border border-zinc-200 bg-white px-1.5 py-0.5 rounded shadow-2xs">Échap</kbd> ferme
          </span>
        </div>
      }
    >
      <>
        <nav aria-label="Réglages de la section" className="flex border-b border-zinc-200 bg-zinc-50 p-2 gap-2 shrink-0 select-none">
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
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 px-3 text-xs font-extrabold rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white shadow-[0_4px_12px_rgba(168,85,247,0.3)] scale-[1.02]'
                    : 'text-zinc-700 hover:bg-white hover:text-purple-900 border border-transparent hover:border-purple-200'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-amber-300' : 'text-purple-500'} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'ia' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-stone-950 shadow-sm font-bold">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-stone-900">
                      Assistant IA de la Section #{sectionIndex + 1}
                    </h3>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                      Optimisez, réécrivez ou adaptez le contenu texte de cette section en un clic grâce à l'IA.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Améliorations rapides en 1 clic :
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={modalAiLoading}
                    onClick={() => handleModalAi('Rends les titres et descriptions plus vendeurs, percutants et captivants')}
                    className="p-3 text-left bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-xs font-bold text-stone-900">🚀 Plus Vendeur & Accrocheur</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Mots-clés percutants et accroche marketing</p>
                  </button>
                  <button
                    type="button"
                    disabled={modalAiLoading}
                    onClick={() => handleModalAi('Raccourcis les paragraphes et va droit à l\'essentiel')}
                    className="p-3 text-left bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-xs font-bold text-stone-900">✂️ Raccourcir & Simplifier</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Style concis, fluide et percutant</p>
                  </button>
                  <button
                    type="button"
                    disabled={modalAiLoading}
                    onClick={() => handleModalAi('Adopte un ton chaleureux, humain, rassurant et bienveillant')}
                    className="p-3 text-left bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-xs font-bold text-stone-900">🤝 Chaleureux & Humain</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Style naturel et rassurant</p>
                  </button>
                  <button
                    type="button"
                    disabled={modalAiLoading}
                    onClick={() => handleModalAi('Optimise les textes pour maximiser la conversion et le clic CTA')}
                    className="p-3 text-left bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-xs font-bold text-stone-900">🎯 Focus Conversion</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">Appel à l'action clair et incitatif</p>
                  </button>
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                  Ou instruction sur-mesure ou dictée vocale :
                </label>
                <div className="flex items-start gap-2">
                  <textarea
                    rows={3}
                    value={modalAiPrompt}
                    onChange={(e) => setModalAiPrompt(e.target.value)}
                    placeholder="Ex: Adapte le vocabulaire pour un institut de beauté haut de gamme à Paris…"
                    className="flex-1 p-3 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 leading-relaxed"
                  />
                  <VoiceInputButton
                    onTranscript={(text) => setModalAiPrompt((prev) => prev ? `${prev} ${text}` : text)}
                  />
                </div>

                {modalAiSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>Texte réécrit et appliqué avec succès !</span>
                  </div>
                )}

                {modalAiError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                    <X size={16} className="text-red-500 shrink-0" />
                    <span>{modalAiError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={modalAiLoading || !modalAiPrompt.trim()}
                  onClick={() => handleModalAi()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {modalAiLoading ? (
                    <span className="flex items-center gap-2">
                      <Sparkles size={14} className="animate-spin text-amber-300" />
                      Réécriture IA ultra-rapide en cours…
                    </span>
                  ) : (
                    <>
                      <Wand2 size={14} />
                      <span>Réécrire cette section avec l'IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

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

              {/* Liste des sections de la page avec boutons d'inter-section et Drag & Drop */}
              <div className="space-y-2">
                {(sections && sections.length > 0 ? sections : [section]).map((sec, idx) => {
                  const isCurrent = idx === sectionIndex;
                  const isDragging = draggedIdx === idx;
                  const isDragOver = dragOverIdx === idx;
                  const secLabel = SECTION_LABELS[sec.type] ?? sec.type;
                  const secDesc = WIREFRAME_REGISTRY[sec.type]?.description ?? '';
                  const isTargetingHere = insertTargetIdx === idx;

                  return (
                    <React.Fragment key={idx}>
                      {/* Bouton d'inter-section au milieu de la liste Structure */}
                      {idx > 0 && onAddSection && (
                        <div className="flex items-center justify-center my-1.5 opacity-60 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setInsertTargetIdx(insertTargetIdx === idx ? null : idx);
                              const el = document.getElementById('add-section-catalog');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-full border transition-all cursor-pointer ${
                              isTargetingHere
                                ? 'bg-amber-500 text-stone-950 border-amber-500 font-extrabold shadow-sm'
                                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900'
                            }`}
                          >
                            <Plus size={13} />
                            <span>{isTargetingHere ? `Insérer ici (avant #${idx + 1})` : 'Insérer une section ici'}</span>
                          </button>
                        </div>
                      )}

                      <div
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
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                          const rawJson = e.dataTransfer.getData('application/json');
                          if (rawJson) {
                            try {
                              const payload = JSON.parse(rawJson);
                              if (payload.type === 'new_section' && payload.sectionType && onAddSection) {
                                onAddSection(payload.sectionType, idx);
                                return;
                              }
                            } catch {}
                          }
                          const fromStr = e.dataTransfer.getData('text/plain');
                          const from = parseInt(fromStr, 10);
                          if (!isNaN(from) && onMoveToSection) {
                            onMoveToSection(from, idx);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        onClick={() => onNavigate(idx)}
                        className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                          isDragging
                            ? 'opacity-40 border-dashed border-zinc-400 bg-zinc-100'
                            : isDragOver
                            ? 'border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-400'
                            : isCurrent
                            ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                            : 'border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-xs text-zinc-900'
                        }`}
                      >
                        {/* Ligne Haute : Poignée + Titre complet + Badges */}
                        <div className="flex items-start gap-3">
                          <span
                            className={`p-1 rounded cursor-grab active:cursor-grabbing transition-colors shrink-0 mt-0.5 ${
                              isCurrent
                                ? 'text-zinc-400 hover:text-white hover:bg-white/20'
                                : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                            }`}
                            title="Glisser-déposer pour réordonner"
                          >
                            <GripVertical size={16} />
                          </span>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-sm font-extrabold leading-snug break-words ${isCurrent ? 'text-white' : 'text-zinc-900'}`}>
                                {secLabel}
                              </h4>
                              <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-extrabold ${isCurrent ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-800 border border-zinc-200'}`}>
                                {sec.type}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-white/20 px-2 py-0.5 rounded">
                                  En cours d'édition
                                </span>
                              )}
                            </div>

                            {secDesc && (
                              <p className={`text-xs leading-relaxed font-medium ${isCurrent ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                {secDesc}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ligne Basse DÉDIÉE : Boutons d'actions et position */}
                        <div
                          className={`mt-3 pt-2.5 border-t flex items-center justify-between ${
                            isCurrent ? 'border-white/15 text-zinc-300' : 'border-zinc-200 text-zinc-500'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider">
                            Position #{idx + 1}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {onMoveSection && (
                              <>
                                <button
                                  type="button"
                                  title="Monter la section"
                                  onClick={() => onMoveSection(idx, -1)}
                                  disabled={idx === 0}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold disabled:opacity-20 transition-all cursor-pointer ${
                                    isCurrent ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                                  }`}
                                >
                                  <ChevronUp size={13} />
                                  <span>Monter</span>
                                </button>
                                <button
                                  type="button"
                                  title="Descendre la section"
                                  onClick={() => onMoveSection(idx, 1)}
                                  disabled={idx === (sections?.length ?? total) - 1}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold disabled:opacity-20 transition-all cursor-pointer ${
                                    isCurrent ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                                  }`}
                                >
                                  <ChevronDown size={13} />
                                  <span>Descendre</span>
                                </button>
                              </>
                            )}
                            {onDuplicateSection && (
                              <button
                                type="button"
                                title="Dupliquer la section"
                                onClick={() => onDuplicateSection(idx)}
                                className={`p-1.5 rounded disabled:opacity-20 transition-all cursor-pointer ${
                                  isCurrent ? 'hover:bg-white/20 text-white' : 'hover:bg-zinc-100 text-zinc-700'
                                }`}
                              >
                                <Copy size={13} />
                              </button>
                            )}
                            {onRemoveSection && (
                              <button
                                type="button"
                                title="Supprimer la section"
                                onClick={() => onRemoveSection(idx)}
                                className={`p-1.5 rounded text-red-400 hover:text-red-300 transition-all cursor-pointer ${
                                  isCurrent ? 'hover:bg-red-500/20' : 'hover:bg-red-50 text-red-600'
                                }`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Ajouter une section */}
              {onAddSection && (
                <div id="add-section-catalog" className="border-t border-stone-200 pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      {insertTargetIdx !== null ? `Insérer une section avant #${insertTargetIdx + 1}` : 'Ajouter une nouvelle section en fin de page'}
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
                        onClick={() => {
                          onAddSection(typeKey as SectionType, insertTargetIdx ?? undefined);
                          setInsertTargetIdx(null);
                        }}
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
