'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Panneau flottant déplaçable et redimensionnable.
 *
 * Un panneau fixe posé sur l'aperçu masque précisément ce qu'on est en train
 * de régler : on change un espacement sans pouvoir constater l'effet. Ici le
 * panneau se déplace par sa barre de titre et se redimensionne par son coin,
 * et sa position est mémorisée — la retrouver à chaque ouverture serait une
 * corvée quotidienne.
 *
 * Le déplacement passe par les événements *pointer* et non *mouse* : c'est ce
 * qui le fait fonctionner aussi au doigt et au stylet, sans code séparé.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 260;
/** Marge conservée à l'écran : un panneau traîné hors cadre serait irrécupérable. */
const KEEP_VISIBLE = 80;

function clampToViewport(box: Box): Box {
  if (typeof window === 'undefined') return box;
  const margin = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const clampedWidth = Math.min(box.width, viewportWidth - margin * 2);
  const clampedHeight = Math.min(box.height, viewportHeight - margin * 2);
  const maxX = Math.max(margin, viewportWidth - clampedWidth - margin);
  const maxY = Math.max(margin, viewportHeight - clampedHeight - margin);
  return {
    width: clampedWidth,
    height: clampedHeight,
    x: Math.min(Math.max(box.x, margin), maxX),
    y: Math.min(Math.max(box.y, margin), maxY),
  };
}

export default function FloatingPanel({
  storageKey,
  header,
  children,
  footer,
  onClose,
  ariaLabel,
}: {
  /** Clé de mémorisation de la position et de la taille. */
  storageKey: string;
  /** Contenu de la barre de titre — sert aussi de poignée de déplacement. */
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  ariaLabel: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; origin: Box } | null>(null);

  // Position initiale : centrée sur l'écran et facilement déplaçable.
  useEffect(() => {
    const viewportWidth = window.innerWidth;
    const targetWidth = Math.min(540, viewportWidth - 32);
    const targetHeight = Math.min(window.innerHeight - 64, 720);

    const fallback: Box = {
      width: targetWidth,
      height: targetHeight,
      x: Math.max(16, Math.floor((viewportWidth - targetWidth) / 2)),
      y: Math.max(16, Math.floor((window.innerHeight - targetHeight) / 2)),
    };
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBox(clampToViewport({ ...fallback, ...parsed, width: Math.min(parsed.width || targetWidth, viewportWidth - 32) }));
      } else {
        setBox(fallback);
      }
    } catch {
      setBox(fallback);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Box) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* stockage indisponible (navigation privée) : on ignore, sans casser */
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (!box) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      setBox(
        drag.mode === 'move'
          ? clampToViewport({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy })
          : {
              ...drag.origin,
              width: Math.max(MIN_WIDTH, drag.origin.width + dx),
              height: Math.max(MIN_HEIGHT, drag.origin.height + dy),
            },
      );
    };

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setBox((current) => {
          if (current) persist(current);
          return current;
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [box, persist]);

  // Une fenêtre réduite ne doit pas laisser le panneau hors champ.
  useEffect(() => {
    const onResize = () => setBox((current) => (current ? clampToViewport(current) : current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!box) return null;

  const start = (mode: 'move' | 'resize') => (event: React.PointerEvent) => {
    // Ne pas déclencher un déplacement quand on vise un bouton de la barre.
    if (mode === 'move' && (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, origin: box };
  };

  return (
    /*
      Pas de voile derrière : l'aperçu doit rester visible ET cliquable pendant
      qu'on règle. C'est toute la différence avec une modale classique.
    */
    <div
      role="dialog"
      aria-label={ariaLabel}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
      className="fixed z-[60] flex flex-col border border-zinc-300 bg-white shadow-2xl rounded-2xl overflow-hidden ring-1 ring-zinc-900/5 transition-all duration-150"
    >
      <div
        onPointerDown={start('move')}
        className="shrink-0 cursor-grab touch-none border-b border-zinc-200 bg-white text-zinc-900 active:cursor-grabbing rounded-t-2xl overflow-hidden"
      >
        {header}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</div>

      {footer && <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/90 rounded-b-2xl overflow-hidden">{footer}</div>}

      {/* Poignée de redimensionnement */}
      <div
        onPointerDown={start('resize')}
        aria-label="Redimensionner"
        className="absolute right-0 bottom-0 size-5 cursor-nwse-resize touch-none"
      >
        <svg viewBox="0 0 20 20" className="size-full text-stone-500">
          <path d="M19 7 L7 19 M19 12 L12 19 M19 17 L17 19" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );
}
