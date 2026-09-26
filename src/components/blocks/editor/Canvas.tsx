"use client";

import { useRef, useState } from 'react';
import type { ContentStructure, ContentBlock } from '../types';
import { BlockRenderer, type EditorSelection } from '../BlockRenderer';
import { moveBlockTo, swapColumns, insertBlock, setBlockField } from './ops';

export const NEW_BLOCK_MIME = 'application/x-pb-new-block';

type DragSource =
  | { kind: 'block'; sectionId: string; columnId: string; blockId: string }
  | { kind: 'column'; sectionId: string; columnIdx: number }
  | { kind: 'new' };

interface Props {
  content: ContentStructure;
  selection: EditorSelection;
  onSelect: (sel: EditorSelection) => void;
  onChange: (next: ContentStructure, coalesceKey?: string) => void;
  /** Fabrique du bloc déposé depuis la bibliothèque. */
  createDropped?: (payload: string) => ContentBlock | null;
}

/**
 * Aperçu réel de la page, cliquable (repris de l'éditeur MLT) :
 * - clic : sélectionne la section, la colonne ou le bloc ;
 * - double-clic sur un texte : édition directe dans la page ;
 * - glisser-déposer : déplacer un bloc (y compris vers une autre section),
 *   échanger deux colonnes, ou déposer un bloc venu de la bibliothèque.
 */
export default function Canvas({ content, selection, onSelect, onChange, createDropped }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragSource | null>(null);
  const [drop, setDrop] = useState<{ sectionId: string; columnId: string; index: number } | null>(null);
  const editingRef = useRef<HTMLElement | null>(null);

  function selectFrom(target: HTMLElement) {
    const el = target.closest<HTMLElement>('[data-editor-kind]');
    if (!el) return onSelect(null);
    const k = el.dataset.editorKind;
    const sectionId = el.dataset.editorSectionId || '';
    const columnId = el.dataset.editorColumnId || '';
    const blockId = el.dataset.editorBlockId || '';
    if (k === 'block') onSelect({ kind: 'block', sectionId, columnId, blockId });
    else if (k === 'column') onSelect({ kind: 'column', sectionId, columnId });
    else onSelect({ kind: 'section', sectionId });
  }

  function onClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return;
    // Liens et boutons de la page : on sélectionne, on ne navigue pas.
    if (target.closest('a, button, summary')) e.preventDefault();
    selectFrom(target);
  }

  function finishInlineEdit(save: boolean) {
    const el = editingRef.current;
    if (!el) return;
    editingRef.current = null;
    el.contentEditable = 'false';
    const blockEl = el.closest<HTMLElement>('[data-editor-kind="block"]');
    const path = el.dataset.pbField;
    if (save && blockEl && path) {
      const text = el.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      onChange(setBlockField(content, blockEl.dataset.editorSectionId || '', blockEl.dataset.editorColumnId || '', blockEl.dataset.editorBlockId || '', path, text), `inline:${blockEl.dataset.editorBlockId}:${path}`);
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pb-field]');
    if (!el) return;
    e.preventDefault();
    finishInlineEdit(true);
    editingRef.current = el;
    const original = el.innerText;
    try { el.contentEditable = 'plaintext-only'; } catch { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(range);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); el.removeEventListener('keydown', onKey); el.innerText = original; finishInlineEdit(false); }
      else if (ev.key === 'Enter' && !ev.shiftKey && el.tagName !== 'DIV' && el.tagName !== 'P') { ev.preventDefault(); el.blur(); }
    };
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', () => { el.removeEventListener('keydown', onKey); finishInlineEdit(true); }, { once: true });
  }

  function onDragStart(e: React.DragEvent) {
    const target = e.target as HTMLElement;
    if (target.isContentEditable) return;
    const blockEl = target.closest<HTMLElement>('[data-editor-kind="block"]');
    if (blockEl) {
      setDrag({ kind: 'block', sectionId: blockEl.dataset.editorSectionId || '', columnId: blockEl.dataset.editorColumnId || '', blockId: blockEl.dataset.editorBlockId || '' });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockEl.dataset.editorBlockId || '');
    }
  }

  /** Index d'insertion dans une colonne selon la position verticale du curseur. */
  function insertionIndex(colEl: HTMLElement, clientY: number): number {
    const blocks = Array.from(colEl.querySelectorAll<HTMLElement>(':scope > [data-editor-kind="block"]'));
    for (let i = 0; i < blocks.length; i++) {
      const r = blocks[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return blocks.length;
  }

  function onDragOver(e: React.DragEvent) {
    const isNew = e.dataTransfer.types.includes(NEW_BLOCK_MIME);
    if (!drag && !isNew) return;
    const colEl = (e.target as HTMLElement).closest<HTMLElement>('[data-editor-kind="column"]');
    if (!colEl) return setDrop(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = isNew ? 'copy' : 'move';
    const next = { sectionId: colEl.dataset.editorSectionId || '', columnId: colEl.dataset.editorColumnId || '', index: insertionIndex(colEl, e.clientY) };
    if (!drop || drop.columnId !== next.columnId || drop.index !== next.index) setDrop(next);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const target = drop;
    setDrop(null);
    setDrag(null);
    if (!target) return;
    const payload = e.dataTransfer.getData(NEW_BLOCK_MIME);
    if (payload && createDropped) {
      const block = createDropped(payload);
      if (block) {
        onChange(insertBlock(content, target.sectionId, target.columnId, block, target.index));
        onSelect({ kind: 'block', sectionId: target.sectionId, columnId: target.columnId, blockId: block.id });
      }
      return;
    }
    if (drag?.kind === 'block') {
      onChange(moveBlockTo(content, drag, target));
      onSelect({ kind: 'block', sectionId: target.sectionId, columnId: target.columnId, blockId: drag.blockId });
    } else if (drag?.kind === 'column') {
      const sec = content.find((s) => s.id === target.sectionId);
      const toIdx = sec?.columns.findIndex((c) => c.id === target.columnId) ?? -1;
      if (sec && sec.id === drag.sectionId && toIdx >= 0) onChange(swapColumns(content, sec.id, drag.columnIdx, toIdx));
    }
  }

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={(e) => { if (!rootRef.current?.contains(e.relatedTarget as Node)) setDrop(null); }}
      onDrop={onDrop}
      onDragEnd={() => { setDrag(null); setDrop(null); }}
    >
      <BlockRenderer content={content} editor={{ selection, dropTarget: drop }} />
    </div>
  );
}
