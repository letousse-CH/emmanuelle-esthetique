/** Opérations pures sur la structure (aucune mutation de l'entrée). */
import type { ContentBlock, ContentColumn, ContentSection, ContentStructure } from '../types';
import { cloneWithNewIds } from '../types';
import type { EditorSelection } from '../BlockRenderer';

export function parsePath(path: string): (string | number)[] {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

export function getAt(obj: unknown, path: string): unknown {
  return parsePath(path).reduce<unknown>((acc, k) => (acc == null ? acc : (acc as Record<string | number, unknown>)[k]), obj);
}

export function setAt<T>(obj: T, path: string | (string | number)[], value: unknown): T {
  const segs = typeof path === 'string' ? parsePath(path) : path;
  if (!segs.length) return value as T;
  const [head, ...rest] = segs;
  const src = (obj ?? (typeof head === 'number' ? [] : {})) as Record<string | number, unknown>;
  const copy = (Array.isArray(src) ? [...src] : { ...src }) as Record<string | number, unknown>;
  copy[head] = setAt(src[head], rest, value);
  return copy as T;
}

export function findSection(content: ContentStructure, id: string) {
  const index = content.findIndex((s) => s.id === id);
  return { section: content[index], index };
}

export function findBlock(content: ContentStructure, sectionId: string, columnId: string, blockId: string) {
  const section = content.find((s) => s.id === sectionId);
  const column = section?.columns.find((c) => c.id === columnId);
  const index = column ? column.blocks.findIndex((b) => b.id === blockId) : -1;
  return { section, column, block: column?.blocks[index], index };
}

export function updateSection(content: ContentStructure, id: string, fn: (s: ContentSection) => ContentSection): ContentStructure {
  return content.map((s) => (s.id === id ? fn(s) : s));
}

export function updateColumn(content: ContentStructure, sectionId: string, columnId: string, fn: (c: ContentColumn) => ContentColumn): ContentStructure {
  return updateSection(content, sectionId, (s) => ({ ...s, columns: s.columns.map((c) => (c.id === columnId ? fn(c) : c)) }));
}

export function updateBlock(content: ContentStructure, sectionId: string, columnId: string, blockId: string, fn: (b: ContentBlock) => ContentBlock): ContentStructure {
  return updateColumn(content, sectionId, columnId, (c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));
}

export function setBlockField(content: ContentStructure, sectionId: string, columnId: string, blockId: string, path: string, value: unknown) {
  return updateBlock(content, sectionId, columnId, blockId, (b) => setAt(b, path, value));
}

export function moveSection(content: ContentStructure, id: string, dir: -1 | 1): ContentStructure {
  const i = content.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= content.length) return content;
  const next = [...content];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function removeSection(content: ContentStructure, id: string) {
  return content.filter((s) => s.id !== id);
}

export function duplicateSection(content: ContentStructure, id: string): { content: ContentStructure; newId?: string } {
  const i = content.findIndex((s) => s.id === id);
  if (i < 0) return { content };
  const copy = cloneWithNewIds(content[i]);
  const next = [...content];
  next.splice(i + 1, 0, copy);
  return { content: next, newId: copy.id };
}

export function insertSection(content: ContentStructure, section: ContentSection, afterId?: string | null): ContentStructure {
  if (!afterId) return [...content, section];
  const i = content.findIndex((s) => s.id === afterId);
  const next = [...content];
  next.splice(i < 0 ? next.length : i + 1, 0, section);
  return next;
}

export function insertBlock(content: ContentStructure, sectionId: string, columnId: string, block: ContentBlock, index?: number): ContentStructure {
  return updateColumn(content, sectionId, columnId, (c) => {
    const blocks = [...c.blocks];
    blocks.splice(index ?? blocks.length, 0, block);
    return { ...c, blocks };
  });
}

export function removeBlock(content: ContentStructure, sectionId: string, columnId: string, blockId: string) {
  return updateColumn(content, sectionId, columnId, (c) => ({ ...c, blocks: c.blocks.filter((b) => b.id !== blockId) }));
}

export function duplicateBlock(content: ContentStructure, sectionId: string, columnId: string, blockId: string): { content: ContentStructure; newId?: string } {
  const { block, index } = findBlock(content, sectionId, columnId, blockId);
  if (!block) return { content };
  const copy = cloneWithNewIds(block);
  return { content: insertBlock(content, sectionId, columnId, copy, index + 1), newId: copy.id };
}

export function moveBlockStep(content: ContentStructure, sectionId: string, columnId: string, blockId: string, dir: -1 | 1): ContentStructure {
  return updateColumn(content, sectionId, columnId, (c) => {
    const i = c.blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.blocks.length) return c;
    const blocks = [...c.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return { ...c, blocks };
  });
}

/** Déplace un bloc vers une colonne (éventuellement d'une autre section) à un index donné. */
export function moveBlockTo(
  content: ContentStructure,
  from: { sectionId: string; columnId: string; blockId: string },
  to: { sectionId: string; columnId: string; index: number },
): ContentStructure {
  const { block, index: fromIdx } = findBlock(content, from.sectionId, from.columnId, from.blockId);
  if (!block) return content;
  let target = to.index;
  if (from.columnId === to.columnId && fromIdx < target) target -= 1;
  const removed = removeBlock(content, from.sectionId, from.columnId, from.blockId);
  return insertBlock(removed, to.sectionId, to.columnId, block, target);
}

/** Déplace une carte d'un bloc Cartes vers un autre (éventuellement dans une autre section) à un index donné. */
export function moveCardItem(
  content: ContentStructure,
  from: { sectionId: string; columnId: string; blockId: string; itemId: string },
  to: { sectionId: string; columnId: string; blockId: string; index: number },
): ContentStructure {
  const { block: fromBlock } = findBlock(content, from.sectionId, from.columnId, from.blockId);
  if (!fromBlock || fromBlock.type !== 'cards') return content;
  const fromIdx = fromBlock.items.findIndex((it) => it.id === from.itemId);
  if (fromIdx < 0) return content;
  const item = fromBlock.items[fromIdx];

  let targetIndex = to.index;
  if (from.blockId === to.blockId && fromIdx < targetIndex) targetIndex -= 1;

  let next = updateBlock(content, from.sectionId, from.columnId, from.blockId, (b) =>
    b.type !== 'cards' ? b : { ...b, items: b.items.filter((it) => it.id !== from.itemId) });
  next = updateBlock(next, to.sectionId, to.columnId, to.blockId, (b) => {
    if (b.type !== 'cards') return b;
    const items = [...b.items];
    items.splice(Math.max(0, Math.min(targetIndex, items.length)), 0, item);
    return { ...b, items };
  });
  return next;
}

/** Échange deux colonnes d'une même section. */
export function swapColumns(content: ContentStructure, sectionId: string, a: number, b: number): ContentStructure {
  return updateSection(content, sectionId, (s) => {
    if (a === b || !s.columns[a] || !s.columns[b]) return s;
    const cols = [...s.columns];
    [cols[a], cols[b]] = [cols[b], cols[a]];
    return { ...s, columns: cols };
  });
}

/** La sélection pointe-t-elle encore sur un élément existant ? */
export function selectionExists(content: ContentStructure, sel: EditorSelection): boolean {
  if (!sel) return true;
  const s = content.find((x) => x.id === sel.sectionId);
  if (!s) return false;
  if (sel.kind === 'section') return true;
  const c = s.columns.find((x) => x.id === sel.columnId);
  if (!c) return false;
  if (sel.kind === 'column') return true;
  return c.blocks.some((b) => b.id === sel.blockId);
}
