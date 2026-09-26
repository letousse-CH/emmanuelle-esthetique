"use client";

import { ArrowDown, ArrowUp, Copy, Trash2, Plus, Sparkles, Layers, MousePointerClick } from 'lucide-react';
import type { ContentStructure, ContentSection, SectionLayout, SectionBackground, ContentBlock } from '../types';
import { changeLayout } from '../types';
import type { EditorSelection } from '../BlockRenderer';
import { BLOCK_META, blockSummary } from '../blockMeta';
import FieldControl, { Label, ImageField } from './FieldControl';
import {
  updateSection, updateColumn, updateBlock, setAt, moveSection, removeSection, duplicateSection,
  moveBlockStep, removeBlock, duplicateBlock, findBlock,
} from './ops';

export type EditMode = 'content' | 'layout';

const LAYOUTS: { value: SectionLayout; label: string; bars: number[] }[] = [
  { value: '1-col', label: '1 colonne', bars: [1] },
  { value: '2-col-equal', label: '2 colonnes', bars: [1, 1] },
  { value: '2-col-40-60', label: '40 / 60', bars: [2, 3] },
  { value: '2-col-60-40', label: '60 / 40', bars: [3, 2] },
  { value: '3-col-equal', label: '3 colonnes', bars: [1, 1, 1] },
  { value: 'full-width', label: 'Pleine largeur', bars: [1] },
];

export const BACKGROUNDS: { value: SectionBackground; label: string; swatch: string }[] = [
  { value: 'transparent', label: 'Blanc', swatch: 'var(--pb-bg, #fff)' },
  { value: 'surface', label: 'Écume', swatch: 'var(--pb-surface)' },
  { value: 'warm', label: 'Crème', swatch: 'var(--pb-warm)' },
  { value: 'warm-strong', label: 'Sable', swatch: 'var(--pb-warm-strong)' },
  { value: 'accent', label: 'Lagon', swatch: 'var(--pb-accent)' },
  { value: 'dark', label: 'Nuit', swatch: 'var(--pb-primary)' },
];

function Segmented<T extends string>({ value, options, onChange }: { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${value === o.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BgPicker({ value, onChange, allowNone }: { value?: SectionBackground; onChange: (v: SectionBackground | undefined) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowNone && (
        <button type="button" onClick={() => onChange(undefined)} title="Comme la section"
          className={`h-8 rounded-md border px-2 text-[10px] font-semibold ${!value ? 'border-sky-500 ring-2 ring-sky-200' : 'border-stone-200 text-stone-500'}`}>Aucun</button>
      )}
      {BACKGROUNDS.map((b) => (
        <button key={b.value} type="button" title={b.label} aria-label={b.label} onClick={() => onChange(b.value)}
          className={`flex flex-col items-center gap-0.5 ${value === b.value || (!allowNone && !value && b.value === 'transparent') ? 'text-sky-700' : 'text-stone-500'}`}>
          <span className={`h-8 w-8 rounded-md border ${value === b.value || (!allowNone && !value && b.value === 'transparent') ? 'border-sky-500 ring-2 ring-sky-200' : 'border-stone-200'}`} style={{ background: b.swatch }} />
          <span className="text-[9px] font-semibold">{b.label}</span>
        </button>
      ))}
    </div>
  );
}

function ActionBar({ onUp, onDown, onDuplicate, onDelete, extra }: { onUp: () => void; onDown: () => void; onDuplicate: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  const b = 'grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900';
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" className={b} title="Monter" aria-label="Monter" onClick={onUp}><ArrowUp size={15} /></button>
      <button type="button" className={b} title="Descendre" aria-label="Descendre" onClick={onDown}><ArrowDown size={15} /></button>
      <button type="button" className={b} title="Dupliquer" aria-label="Dupliquer" onClick={onDuplicate}><Copy size={15} /></button>
      {extra}
      <button type="button" className={`${b} hover:!bg-red-50 hover:!text-red-600`} title="Supprimer" aria-label="Supprimer" onClick={onDelete}><Trash2 size={15} /></button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-b border-stone-100 px-4 py-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  content: ContentStructure;
  selection: EditorSelection;
  mode: EditMode;
  onSelect: (s: EditorSelection) => void;
  onChange: (next: ContentStructure, coalesceKey?: string) => void;
  onOpenLibrary: () => void;
  onAiSection: (sectionId: string) => void;
}

export default function Inspector({ content, selection, mode, onSelect, onChange, onOpenLibrary, onAiSection }: Props) {
  const showStyle = mode === 'layout';

  // ── Rien de sélectionné : plan de la page ──────────────────────────────────
  if (!selection) {
    return (
      <div>
        <div className="px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-800"><MousePointerClick size={16} /> Cliquez sur un élément de la page</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">Un clic sélectionne, un double-clic sur un texte permet de l&apos;écrire directement dans la page.</p>
        </div>
        <Group title="Plan de la page">
          <ol className="space-y-1">
            {content.map((s, i) => {
              const first = s.columns.flatMap((c) => c.blocks)[0];
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => onSelect({ kind: 'section', sectionId: s.id })}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-100">
                    <span className="w-5 shrink-0 text-stone-400">{i + 1}</span>
                    <span className="truncate">{first ? `${BLOCK_META[first.type].label} · ${blockSummary(first)}` : 'Section vide'}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={onOpenLibrary} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"><Plus size={14} /> Ajouter une section</button>
        </Group>
      </div>
    );
  }

  const section = content.find((s) => s.id === selection.sectionId);
  if (!section) return null;
  const sIdx = content.indexOf(section);
  const setSection = (patch: Partial<ContentSection>, key?: string) => onChange(updateSection(content, section.id, (s) => ({ ...s, ...patch })), key);

  const breadcrumb = (
    <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 px-4 py-2 text-[11px] text-stone-500">
      <button type="button" className="hover:text-sky-700 hover:underline" onClick={() => onSelect(null)}>Page</button>
      <span>/</span>
      <button type="button" className={`hover:text-sky-700 hover:underline ${selection.kind === 'section' ? 'font-semibold text-stone-800' : ''}`} onClick={() => onSelect({ kind: 'section', sectionId: section.id })}>Section {sIdx + 1}</button>
      {selection.kind !== 'section' && (() => {
        const col = section.columns.find((c) => c.id === selection.columnId);
        const cIdx = col ? section.columns.indexOf(col) : 0;
        return (
          <>
            {section.columns.length > 1 && (
              <>
                <span>/</span>
                <button type="button" className={`hover:text-sky-700 hover:underline ${selection.kind === 'column' ? 'font-semibold text-stone-800' : ''}`} onClick={() => onSelect({ kind: 'column', sectionId: section.id, columnId: selection.columnId })}>Colonne {cIdx + 1}</button>
              </>
            )}
            {selection.kind === 'block' && (() => {
              const { block } = findBlock(content, section.id, selection.columnId, selection.blockId);
              return block ? <><span>/</span><span className="font-semibold text-stone-800">{BLOCK_META[block.type].label}</span></> : null;
            })()}
          </>
        );
      })()}
    </div>
  );

  // ── Bloc ───────────────────────────────────────────────────────────────────
  if (selection.kind === 'block') {
    const { block } = findBlock(content, section.id, selection.columnId, selection.blockId);
    if (!block) return breadcrumb;
    const meta = BLOCK_META[block.type];
    const fields = meta.fields.filter((f) => showStyle || !f.style);
    const hiddenStyle = meta.fields.some((f) => f.style) && !showStyle;
    const setField = (key: string, value: unknown) =>
      onChange(updateBlock(content, section.id, selection.columnId, block.id, (b) => setAt(b, key, value) as ContentBlock), `field:${block.id}:${key}`);

    return (
      <div>
        {breadcrumb}
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900">{meta.label}</p>
            <p className="truncate text-[11px] text-stone-500">{meta.description}</p>
          </div>
          <ActionBar
            onUp={() => onChange(moveBlockStep(content, section.id, selection.columnId, block.id, -1))}
            onDown={() => onChange(moveBlockStep(content, section.id, selection.columnId, block.id, 1))}
            onDuplicate={() => { const r = duplicateBlock(content, section.id, selection.columnId, block.id); onChange(r.content); if (r.newId) onSelect({ ...selection, blockId: r.newId }); }}
            onDelete={() => { onChange(removeBlock(content, section.id, selection.columnId, block.id)); onSelect({ kind: 'column', sectionId: section.id, columnId: selection.columnId }); }}
          />
        </div>
        {block.type === 'legacy_section' ? (
          <div className="space-y-2 px-4 py-4 text-xs leading-relaxed text-stone-600">
            <p>Cette section vient de l&apos;ancien constructeur (<code>{block.section.type}</code>). Elle s&apos;affiche à l&apos;identique.</p>
            <p>Pour modifier son contenu, remplacez-la par une section équivalente de la bibliothèque, ou demandez à l&apos;assistant IA de la convertir.</p>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {fields.map((f) => (
              <FieldControl key={f.key} field={f} value={(block as unknown as Record<string, unknown>)[f.key]} showStyle={showStyle} onChange={(v) => setField(f.key, v)} />
            ))}
            {hiddenStyle && <p className="text-[11px] text-stone-400">Alignement, tailles et styles : passez en mode « Mise en page ».</p>}
          </div>
        )}
      </div>
    );
  }

  // ── Colonne ────────────────────────────────────────────────────────────────
  if (selection.kind === 'column') {
    const col = section.columns.find((c) => c.id === selection.columnId);
    if (!col) return breadcrumb;
    return (
      <div>
        {breadcrumb}
        <Group title="Contenu de la colonne">
          {col.blocks.length === 0 && <p className="text-xs text-stone-500">Colonne vide.</p>}
          <ul className="space-y-1">
            {col.blocks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onSelect({ kind: 'block', sectionId: section.id, columnId: col.id, blockId: b.id })}
                  className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-left text-xs hover:border-sky-300 hover:bg-sky-50">
                  <span className="font-semibold text-stone-800">{BLOCK_META[b.type].label}</span>
                  <span className="truncate text-stone-500">{blockSummary(b)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onOpenLibrary} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"><Plus size={14} /> Ajouter un bloc ici</button>
        </Group>
        {showStyle && (
          <Group title="Fond de la colonne">
            <BgPicker allowNone value={col.background} onChange={(v) => onChange(updateColumn(content, section.id, col.id, (c) => ({ ...c, background: v })))} />
          </Group>
        )}
      </div>
    );
  }

  // ── Section ────────────────────────────────────────────────────────────────
  return (
    <div>
      {breadcrumb}
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-stone-900"><Layers size={15} /> Section {sIdx + 1}</p>
        <ActionBar
          onUp={() => onChange(moveSection(content, section.id, -1))}
          onDown={() => onChange(moveSection(content, section.id, 1))}
          onDuplicate={() => { const r = duplicateSection(content, section.id); onChange(r.content); if (r.newId) onSelect({ kind: 'section', sectionId: r.newId }); }}
          onDelete={() => { onChange(removeSection(content, section.id)); onSelect(null); }}
          extra={<button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-violet-600 hover:bg-violet-50" title="Réécrire avec l'IA" aria-label="Réécrire avec l'IA" onClick={() => onAiSection(section.id)}><Sparkles size={15} /></button>}
        />
      </div>

      <Group title="Fond">
        <BgPicker value={section.background} onChange={(v) => setSection({ background: v ?? 'transparent' })} />
        <div>
          <Label help="Photo d'ambiance derrière le contenu, adoucie par un voile.">Photo de fond</Label>
          <ImageField value={section.bgImage?.url ?? ''} onChange={(url) => setSection({ bgImage: url ? { opacity: 55, ...section.bgImage, url } : undefined })} />
          {section.bgImage?.url && showStyle && (
            <label className="mt-2 block text-[11px] text-stone-600">
              Intensité de la photo : {section.bgImage.opacity ?? 55} %
              <input type="range" min={10} max={100} step={5} value={section.bgImage.opacity ?? 55} className="w-full accent-sky-600"
                onChange={(e) => setSection({ bgImage: { ...section.bgImage!, opacity: Number(e.target.value) } }, `bgop:${section.id}`)} />
            </label>
          )}
        </div>
      </Group>

      {showStyle ? (
        <>
          <Group title="Colonnes">
            <div className="grid grid-cols-3 gap-1.5">
              {LAYOUTS.map((l) => (
                <button key={l.value} type="button" onClick={() => onChange(updateSection(content, section.id, (s) => changeLayout(s, l.value)))}
                  className={`rounded-lg border p-1.5 ${section.layout === l.value ? 'border-sky-500 bg-sky-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <div className="flex h-5 gap-0.5">{l.bars.map((w, i) => <span key={i} className="rounded-sm bg-stone-300" style={{ flex: w }} />)}</div>
                  <span className="mt-1 block text-[9.5px] font-semibold text-stone-600">{l.label}</span>
                </button>
              ))}
            </div>
            {section.columns.length > 1 && (
              <>
                <label className="flex items-center justify-between text-[12px] font-semibold text-stone-700">Colonnes collées (photo bord à bord)
                  <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={!!section.flush} onChange={(e) => setSection({ flush: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between text-[12px] font-semibold text-stone-700">Inverser l&apos;ordre sur mobile
                  <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={!!section.reverseOnMobile} onChange={(e) => setSection({ reverseOnMobile: e.target.checked })} />
                </label>
                <div>
                  <Label>Alignement vertical</Label>
                  <Segmented value={section.alignItems ?? 'top'} onChange={(v) => setSection({ alignItems: v })} options={[{ value: 'top', label: 'Haut' }, { value: 'center', label: 'Centre' }, { value: 'bottom', label: 'Bas' }]} />
                </div>
              </>
            )}
          </Group>
          <Group title="Dimensions">
            <div>
              <Label>Espace haut et bas</Label>
              <Segmented value={section.paddingY} onChange={(v) => setSection({ paddingY: v })} options={[{ value: 'none', label: 'Aucun' }, { value: 'small', label: 'Petit' }, { value: 'medium', label: 'Moyen' }, { value: 'large', label: 'Grand' }]} />
            </div>
            <div>
              <Label>Largeur du contenu</Label>
              <Segmented value={section.width ?? 'wide'} onChange={(v) => setSection({ width: v })} options={[{ value: 'narrow', label: 'Lecture' }, { value: 'contained', label: 'Moyenne' }, { value: 'wide', label: 'Large' }, { value: 'full', label: 'Écran' }]} />
            </div>
            <div>
              <Label>Hauteur minimale</Label>
              <Segmented value={section.minHeight ?? 'auto'} onChange={(v) => setSection({ minHeight: v })} options={[{ value: 'auto', label: 'Contenu' }, { value: 'half', label: 'Grande' }, { value: 'screen', label: 'Plein écran' }]} />
            </div>
          </Group>
          <Group title="Texte et animation">
            <div>
              <Label help="Automatique : texte clair sur les fonds foncés.">Couleur du texte</Label>
              <Segmented value={section.textTone ?? 'auto'} onChange={(v) => setSection({ textTone: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'dark', label: 'Foncé' }, { value: 'light', label: 'Clair' }]} />
            </div>
            <div>
              <Label help="Apparition au défilement (ignorée si le visiteur réduit les animations).">Animation</Label>
              <Segmented value={section.animation ?? 'none'} onChange={(v) => setSection({ animation: v })} options={[{ value: 'none', label: 'Aucune' }, { value: 'fade', label: 'Fondu' }, { value: 'rise', label: 'Montée' }]} />
            </div>
          </Group>
        </>
      ) : (
        <Group title="Blocs de la section">
          {section.columns.map((col, ci) => (
            <div key={col.id} className="space-y-1">
              {section.columns.length > 1 && <p className="text-[10px] font-semibold text-stone-400">Colonne {ci + 1}</p>}
              {col.blocks.map((b) => (
                <button key={b.id} type="button" onClick={() => onSelect({ kind: 'block', sectionId: section.id, columnId: col.id, blockId: b.id })}
                  className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-left text-xs hover:border-sky-300 hover:bg-sky-50">
                  <span className="font-semibold text-stone-800">{BLOCK_META[b.type].label}</span>
                  <span className="truncate text-stone-500">{blockSummary(b)}</span>
                </button>
              ))}
            </div>
          ))}
          <p className="text-[11px] text-stone-400">Colonnes, espacements et animation : mode « Mise en page ».</p>
        </Group>
      )}
    </div>
  );
}
