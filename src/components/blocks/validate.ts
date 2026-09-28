/**
 * Normalisation d'un contenu venu de l'extérieur (IA, import, ancienne
 * version) : types inconnus retirés, champs manquants complétés par les
 * valeurs par défaut du bloc, identifiants posés partout. Le résultat est
 * toujours rendable sans erreur.
 */
import type { ContentBlock, ContentSection, ContentStructure, SectionLayout, SectionBackground, VerticalPadding } from './types';
import { uid, getColumnCount } from './types';
import { BLOCK_META } from './blockMeta';

const LAYOUTS: SectionLayout[] = ['1-col', '2-col-equal', '2-col-40-60', '2-col-60-40', '3-col-equal', 'full-width'];
const BGS: SectionBackground[] = ['transparent', 'surface', 'warm', 'warm-strong', 'accent', 'dark'];
const PADS: VerticalPadding[] = ['none', 'small', 'medium', 'large'];

function withIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? { id: uid(), ...(withIds(v) as object), ...(typeof (v as { id?: unknown }).id === 'string' ? {} : { id: uid() }) } : v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = withIds(v);
    return out;
  }
  return value;
}

export function normalizeBlock(raw: unknown): ContentBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type as keyof typeof BLOCK_META;
  if (!type || !(type in BLOCK_META)) return null;
  if (type === 'legacy_section') {
    const s = r.section as { type?: unknown; data?: unknown } | undefined;
    if (!s || typeof s.type !== 'string') return null;
    return { id: typeof r.id === 'string' ? r.id : uid(), type: 'legacy_section', section: { type: s.type, data: (s.data as Record<string, unknown>) ?? {} } };
  }
  const base = BLOCK_META[type].create() as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(r)) {
    if (v === undefined || v === null) continue;
    // Une liste venue de l'IA remplace celle par défaut, avec des identifiants.
    merged[k] = k === 'section' || k === 'id' || k === 'type' ? v : withIds(v);
  }
  merged.id = typeof r.id === 'string' ? r.id : uid();
  merged.type = type;
  return merged as unknown as ContentBlock;
}

export function normalizeSection(raw: unknown): ContentSection | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const layout = LAYOUTS.includes(r.layout as SectionLayout) ? (r.layout as SectionLayout) : '1-col';
  const count = getColumnCount(layout);
  const rawCols = Array.isArray(r.columns) ? r.columns : Array.isArray(r.blocks) ? [{ blocks: r.blocks }] : [];
  const columns = Array.from({ length: count }, (_, i) => {
    const c = (rawCols[i] ?? {}) as Record<string, unknown>;
    const blocks = (Array.isArray(c.blocks) ? c.blocks : []).map(normalizeBlock).filter(Boolean) as ContentBlock[];
    return {
      id: typeof c.id === 'string' ? c.id : uid(),
      blocks,
      background: BGS.includes(c.background as SectionBackground) ? (c.background as SectionBackground) : undefined,
    };
  });
  // Blocs des colonnes en trop : versés dans la dernière colonne.
  for (const extra of rawCols.slice(count) as Record<string, unknown>[]) {
    const blocks = (Array.isArray(extra?.blocks) ? extra.blocks : []).map(normalizeBlock).filter(Boolean) as ContentBlock[];
    columns[columns.length - 1].blocks.push(...blocks);
  }
  const s: ContentSection = {
    ...(r as Partial<ContentSection>),
    id: typeof r.id === 'string' ? r.id : uid(),
    layout,
    paddingY: PADS.includes(r.paddingY as VerticalPadding) ? (r.paddingY as VerticalPadding) : 'medium',
    innerPad: r.innerPad === 'medium' || r.innerPad === 'large' ? r.innerPad : 'none',
    background: BGS.includes(r.background as SectionBackground) ? (r.background as SectionBackground) : 'transparent',
    columns,
  };
  return s;
}

export function normalizeContent(raw: unknown): ContentStructure {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { sections?: unknown }).sections) ? (raw as { sections: unknown[] }).sections : [];
  return arr.map(normalizeSection).filter(Boolean) as ContentStructure;
}
