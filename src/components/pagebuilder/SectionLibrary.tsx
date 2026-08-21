'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';

import { SectionPreview, SECTION_LABELS } from './sectionPreviews';
import { SECTION_CATALOG, categoryOf, searchSections } from './sectionCatalog';
import { WIREFRAME_REGISTRY } from './wireframes.config';
import type { SectionType } from './wireframes.config';

/**
 * Bibliothèque de sections, en panneau ancré.
 *
 * Ancré et non superposé : une modale centrée recouvre l'aperçu, donc on
 * ajoute des sections sans voir la page qu'on est en train de construire.
 * Ici la colonne se pose à gauche et l'aperçu reste entièrement lisible.
 *
 * Deux niveaux, comme les bibliothèques de composants qui fonctionnent bien :
 * la liste des catégories, puis les sections de la catégorie choisie. Une
 * liste plate de trente-trois vignettes ne se parcourt pas.
 *
 * Le panneau ne se referme jamais tout seul : on compose une page en
 * enchaînant plusieurs sections.
 */
export default function SectionLibrary({
  onInsert,
  onClose,
  insertLabel,
}: {
  onInsert: (type: any) => void;
  onClose: () => void;
  insertLabel: string;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [justAdded, setJustAdded] = useState<any>(null);

  const results = useMemo(() => searchSections(query, SECTION_LABELS), [query]);
  const searching = query.trim().length > 0;
  const category = SECTION_CATALOG.find((c) => c.id === openCategory);

  function insert(type: any) {
    onInsert(type);
    setJustAdded(type);
    // Sans retour visuel, rien n'indique que le clic a produit quelque chose,
    // puisque le panneau reste ouvert.
    window.setTimeout(() => setJustAdded((c: any) => (c === type ? null : c)), 900);
  }

  const Row = ({ type }: { type: any }) => {
    const added = justAdded === type;
    return (
      <button
        type="button"
        onClick={() => insert(type)}
        className={`flex w-full items-center gap-3 border p-2 text-left transition-colors cursor-pointer ${
          added ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-900'
        }`}
      >
        <span className="w-16 shrink-0 overflow-hidden border border-stone-100 bg-stone-50">
          <SectionPreview type={type} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-stone-800">
            {SECTION_LABELS[type]}
          </span>
          <span className="block truncate text-[12.5px] text-stone-500">
            {searching ? categoryOf(type)?.label : WIREFRAME_REGISTRY[type]?.description}
          </span>
        </span>
        <Plus size={15} className={`shrink-0 ${added ? 'text-stone-900' : 'text-stone-500'}`} />
      </button>
    );
  };

  return (
    <aside
      aria-label="Bibliothèque de sections"
      className="flex h-full w-[19rem] shrink-0 flex-col border-r border-stone-200 bg-white"
    >
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900">Ajouter</h2>
          <p className="truncate text-[12.5px] text-stone-500">{insertLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la bibliothèque"
          className="grid size-7 shrink-0 place-items-center border border-stone-200 text-stone-500 transition-colors hover:border-stone-400 cursor-pointer"
        >
          <X size={14} />
        </button>
      </header>

      <div className="border-b border-stone-100 p-3">
        <div className="relative">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher : prix, avis, équipe…"
            className="w-full border border-stone-200 py-1.5 pr-2 pl-8 text-[13px] focus:border-stone-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {searching ? (
          <div className="space-y-2">
            {results.map((type) => (
              <Row key={type} type={type} />
            ))}
            {results.length === 0 && (
              <p className="py-8 text-center text-[13px] text-stone-500">
                Rien pour « {query} ».
              </p>
            )}
          </div>
        ) : category ? (
          <>
            <button
              type="button"
              onClick={() => setOpenCategory(null)}
              className="mb-3 flex items-center gap-1.5 text-[12px] text-stone-500 transition-colors hover:text-stone-900 cursor-pointer"
            >
              <ChevronLeft size={13} /> Toutes les catégories
            </button>
            <p className="mb-2 text-[11px] leading-snug text-stone-500">{category.hint}</p>
            <div className="space-y-2">
              {category.types.map((type) => (
                <Row key={type} type={type} />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            {SECTION_CATALOG.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setOpenCategory(cat.id)}
                className="flex w-full items-center gap-3 border border-stone-200 p-2 text-left transition-colors hover:border-stone-900 cursor-pointer"
              >
                <span className="w-16 shrink-0 overflow-hidden border border-stone-100 bg-stone-50">
                  <SectionPreview type={cat.types[0]} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-stone-800">{cat.label}</span>
                  <span className="block truncate text-[12.5px] text-stone-500">{cat.hint}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-stone-500">
                  {cat.types.length}
                  <ChevronRight size={14} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
