"use client";

import { useMemo, useState } from 'react';
import { Search, X, GripVertical } from 'lucide-react';
import { SECTION_PRESETS, PRESET_CATEGORIES, type SectionPreset } from '../presets';
import { LIBRARY_BLOCKS, CATEGORY_LABELS, type BlockMeta, type BlockCategory } from '../blockMeta';
import type { BlockType } from '../types';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import { NEW_BLOCK_MIME } from './Canvas';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  onClose: () => void;
  onAddPreset: (p: SectionPreset) => void;
  onAddBlock: (type: BlockType) => void;
  targetLabel: string;
}

/**
 * Bibliothèque rangée par intention (reprise du catalogue Studio) : sections
 * prêtes à poser, ou blocs à glisser dans une colonne.
 */
export default function Library({ onClose, onAddPreset, onAddBlock, targetLabel }: Props) {
  const [tab, setTab] = useState<'sections' | 'blocks'>('sections');
  const [q, setQ] = useState('');
  const flags = useModuleFlags();

  const presets = useMemo(() => SECTION_PRESETS.filter((p) => (p.id !== 'blog' || flags.blog) && (p.id !== 'newsletter' || flags.newsletter)), [flags.blog, flags.newsletter]);
  const query = norm(q.trim());
  const presetHits = query ? presets.filter((p) => norm(`${p.label} ${p.hint} ${p.keywords}`).includes(query)) : presets;
  const blockHits = query ? LIBRARY_BLOCKS.filter((b) => norm(`${b.label} ${b.description} ${b.keywords}`).includes(query)) : LIBRARY_BLOCKS;

  const presetGroups = (Object.keys(PRESET_CATEGORIES) as SectionPreset['category'][])
    .map((c) => ({ c, items: presetHits.filter((p) => p.category === c) }))
    .filter((g) => g.items.length);
  const blockGroups = (Object.keys(CATEGORY_LABELS) as BlockCategory[])
    .map((c) => ({ c, items: blockHits.filter((b) => b.category === c) }))
    .filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
        <p className="text-sm font-semibold text-stone-900">Ajouter</p>
        <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800"><X size={16} /></button>
      </div>
      <div className="space-y-2 border-b border-stone-100 px-4 py-3">
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
          {(['sections', 'blocks'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              {t === 'sections' ? 'Sections prêtes' : 'Blocs'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5">
          <Search size={14} className="text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="prix, avis, photo, faq…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <p className="text-[11px] text-stone-500">{tab === 'sections' ? 'Ajoutée après la section sélectionnée.' : `Ajouté ${targetLabel}. Vous pouvez aussi le glisser dans la page.`}</p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {tab === 'sections' && presetGroups.map((g) => (
          <div key={g.c}>
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{PRESET_CATEGORIES[g.c]}</h4>
            <div className="space-y-1.5">
              {g.items.map((p) => (
                <button key={p.id} type="button" onClick={() => onAddPreset(p)}
                  className="block w-full rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-sky-400 hover:bg-sky-50">
                  <span className="block text-[13px] font-semibold text-stone-800">{p.label}</span>
                  <span className="block text-[11px] text-stone-500">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {tab === 'blocks' && blockGroups.map((g) => (
          <div key={g.c}>
            <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{CATEGORY_LABELS[g.c].label}</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {g.items.map((b: BlockMeta) => (
                <button key={b.type} type="button" draggable
                  onDragStart={(e) => { e.dataTransfer.setData(NEW_BLOCK_MIME, b.type); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => onAddBlock(b.type)} title={b.description}
                  className="flex items-start gap-1 rounded-lg border border-stone-200 px-2 py-2 text-left hover:border-sky-400 hover:bg-sky-50">
                  <GripVertical size={12} className="mt-0.5 shrink-0 text-stone-300" />
                  <span className="text-[12px] font-semibold leading-tight text-stone-800">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {((tab === 'sections' && !presetGroups.length) || (tab === 'blocks' && !blockGroups.length)) && (
          <p className="text-sm text-stone-500">Rien ne correspond à « {q} ».</p>
        )}
      </div>
    </div>
  );
}
