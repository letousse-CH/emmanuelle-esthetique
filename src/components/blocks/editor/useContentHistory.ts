import { useCallback, useRef, useState } from 'react';
import type { ContentStructure } from '../types';

const LIMIT = 80;
const COALESCE_MS = 900;

/**
 * État du contenu avec annuler/rétablir. Les modifications successives d'un
 * même champ (frappe au clavier) sont regroupées en un seul point
 * d'annulation, comme dans l'ancien éditeur Studio.
 */
export function useContentHistory(initial: ContentStructure) {
  const [content, setContent] = useState<ContentStructure>(initial);
  const past = useRef<ContentStructure[]>([]);
  const future = useRef<ContentStructure[]>([]);
  const last = useRef<{ key?: string; at: number }>({ at: 0 });
  const current = useRef(initial);
  const [, force] = useState(0);
  const [version, setVersion] = useState(0);

  const commit = useCallback((next: ContentStructure | ((prev: ContentStructure) => ContentStructure), coalesceKey?: string) => {
    const prev = current.current;
    const value = typeof next === 'function' ? next(prev) : next;
    if (value === prev) return;
    const now = Date.now();
    const merge = coalesceKey && last.current.key === coalesceKey && now - last.current.at < COALESCE_MS;
    if (!merge) {
      past.current = [...past.current.slice(-(LIMIT - 1)), prev];
      future.current = [];
    }
    last.current = { key: coalesceKey, at: now };
    current.current = value;
    setContent(value);
    setVersion((v) => v + 1);
  }, []);

  const reset = useCallback((value: ContentStructure) => {
    past.current = [];
    future.current = [];
    current.current = value;
    setContent(value);
    force((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    const p = past.current;
    if (!p.length) return;
    future.current = [...future.current, current.current];
    const value = p[p.length - 1];
    past.current = p.slice(0, -1);
    last.current = { at: 0 };
    current.current = value;
    setContent(value);
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const f = future.current;
    if (!f.length) return;
    past.current = [...past.current, current.current];
    const value = f[f.length - 1];
    future.current = f.slice(0, -1);
    last.current = { at: 0 };
    current.current = value;
    setContent(value);
    setVersion((v) => v + 1);
  }, []);

  return {
    content,
    commit,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    /** Incrémenté à chaque modification : sert au déclenchement de la sauvegarde auto. */
    version,
  };
}
