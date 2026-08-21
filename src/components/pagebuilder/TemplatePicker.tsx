'use client';

import React, { useState } from 'react';
import { Check, LayoutTemplate, X } from 'lucide-react';

import { SectionPreview, SECTION_LABELS } from './sectionPreviews';
import {
  PAGE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  buildTemplateSections,
  type PageTemplate,
  type TemplateCategory,
} from './pageTemplates';
import type { PageSection } from './wireframes.config';

/**
 * Choix d'une structure de page.
 *
 * Deux niveaux seulement : le type de page, puis la disposition. Chaque
 * disposition est représentée par la pile de ses sections en miniature — on
 * choisit sur ce qu'on voit, pas sur un nom.
 *
 * Le but est qu'une personne qui ne connaît rien au web obtienne une page qui
 * se tient sans avoir à composer quoi que ce soit. Elle n'aura plus qu'à
 * remplacer les textes.
 */
export default function TemplatePicker({
  onApply,
  onClose,
}: {
  onApply: (sections: PageSection[], template: PageTemplate) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<TemplateCategory>('accueil');
  const [selected, setSelected] = useState<PageTemplate | null>(null);

  const templates = PAGE_TEMPLATES.filter((t) => t.category === category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choisir une structure de page"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] cursor-default"
      />

      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <LayoutTemplate size={18} className="text-stone-500" />
              Partir d&apos;une structure
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">
              Choisissez le type de page, puis la disposition. Vous n&apos;aurez plus
              qu&apos;à remplacer les textes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-8 shrink-0 place-items-center border border-stone-200 text-stone-500 transition-colors hover:border-stone-400 cursor-pointer"
          >
            <X size={15} />
          </button>
        </header>

        {/* Type de page */}
        <div className="flex gap-1 overflow-x-auto border-b border-stone-200 px-6 py-3">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                setSelected(null);
              }}
              className={`shrink-0 px-3.5 py-2 text-left transition-colors cursor-pointer ${
                category === cat.id
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <span className="block text-sm font-medium">{cat.label}</span>
              <span
                className={`block text-[11px] ${
                  category === cat.id ? 'text-stone-500' : 'text-stone-500'
                }`}
              >
                {cat.hint}
              </span>
            </button>
          ))}
        </div>

        {/* Dispositions */}
        <div className="grid flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelected = selected?.id === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelected(template)}
                onDoubleClick={() => onApply(buildTemplateSections(template), template)}
                aria-pressed={isSelected}
                className={`flex flex-col border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-stone-900 ring-1 ring-stone-900'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                {/* Pile des sections en miniature — l'aperçu réel de la page */}
                <div className="flex flex-col gap-1 bg-stone-50 p-3">
                  {template.blueprint.map((block, index) => (
                    <div
                      key={index}
                      title={SECTION_LABELS[block.type] ?? block.type}
                      className={`overflow-hidden border ${
                        (block.data as { theme?: string } | undefined)?.theme === 'dark'
                          ? 'border-stone-700 bg-stone-800'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <SectionPreview type={block.type} />
                    </div>
                  ))}
                </div>

                <div className="flex flex-1 flex-col border-t border-stone-100 p-3.5">
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-stone-900">
                    {template.name}
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-stone-500">
                    {template.description}
                  </span>
                  <span className="mt-2 text-[11px] text-stone-500">
                    {template.blueprint.length} sections
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-stone-200 px-6 py-4">
          <p className="text-[12.5px] text-stone-500">
            Rien n&apos;est définitif : vous pourrez ajouter, retirer et réordonner
            les sections ensuite.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-500 transition-colors hover:text-stone-800 cursor-pointer"
            >
              Partir d&apos;une page vide
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && onApply(buildTemplateSections(selected), selected)}
              className="bg-stone-900 px-5 py-2 text-sm text-white transition-colors hover:bg-stone-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              Utiliser cette structure
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
