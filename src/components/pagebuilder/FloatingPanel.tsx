'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Move, X } from 'lucide-react';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 360;
const MIN_HEIGHT = 380;
const KEEP_VISIBLE = 80;

function clampToViewport(box: Box): Box {
  if (typeof window === 'undefined') return box;
  const margin = 12;
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
  storageKey: string;
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  ariaLabel: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [isDocked, setIsDocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem(`${storageKey}.docked`);
      return saved !== null ? saved === 'true' : window.innerWidth >= 1280;
    } catch {
      return true;
    }
  });
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; origin: Box } | null>(null);

  useEffect(() => {
    const viewportWidth = window.innerWidth;
    const targetWidth = Math.min(520, viewportWidth - 32);
    const targetHeight = Math.min(window.innerHeight - 80, 760);

    const fallback: Box = {
      width: targetWidth,
      height: targetHeight,
      x: Math.max(16, viewportWidth - targetWidth - 24),
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
        /* storage unvailable */
      }
    },
    [storageKey],
  );

  const toggleDock = () => {
    setIsDocked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${storageKey}.docked`, String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!box || isDocked || isMaximized) return;

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
  }, [box, isDocked, isMaximized, persist]);

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
    if (isDocked || isMaximized) return;
    if (mode === 'move' && (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, origin: box };
  };

  // ── Mode Volet Latéral Ancré (Builder.io / Webflow Studio Drawer) ─────────
  if (isDocked) {
    return (
      <div
        role="dialog"
        aria-label={ariaLabel}
        className="fixed top-14 right-0 bottom-0 z-[60] w-full sm:w-[480px] lg:w-[520px] flex flex-col bg-white border-l border-zinc-200 shadow-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Barre Supérieure du Volet Inspecteur */}
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/90 text-zinc-900">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200/80 bg-zinc-100/60 text-[11px] font-bold text-zinc-600">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <PanelRightClose size={13} className="text-purple-600" />
              Inspecteur de Propriétés (Mode Ancré)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleDock}
                className="px-2 py-0.5 rounded-md bg-white border border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer text-[10.5px] font-bold flex items-center gap-1 shadow-2xs"
                title="Détacher en fenêtre flottante déplaçable"
              >
                <Move size={11} />
                Détacher
              </button>
            </div>
          </div>
          {header}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</div>

        {footer && <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/90">{footer}</div>}
      </div>
    );
  }

  // ── Mode Fenêtre Maximisée ────────────────────────────────────────────────
  if (isMaximized) {
    return (
      <div
        role="dialog"
        aria-label={ariaLabel}
        className="fixed inset-3 z-[60] flex flex-col bg-white border border-zinc-300 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/90 text-zinc-900">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-200/80 bg-zinc-100/60 text-[11px] font-bold text-zinc-600">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Maximize2 size={13} className="text-purple-600" />
              Inspecteur de Propriétés (Plein Écran)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMaximized(false)}
                className="px-2 py-0.5 rounded-md bg-white border border-zinc-300 hover:bg-zinc-100 transition-colors cursor-pointer text-[10.5px] font-bold flex items-center gap-1 shadow-2xs"
                title="Quitter le plein écran"
              >
                <Minimize2 size={11} />
                Réduire
              </button>
            </div>
          </div>
          {header}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-2">{children}</div>

        {footer && <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/90">{footer}</div>}
      </div>
    );
  }

  // ── Mode Fenêtre Flottante Déplaçable & Redimensionnable ──────────────────
  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
      className="fixed z-[60] flex flex-col border border-zinc-300 bg-white shadow-2xl rounded-2xl overflow-hidden ring-1 ring-zinc-900/10 transition-all duration-75 select-none"
    >
      <div
        onPointerDown={start('move')}
        className="shrink-0 cursor-grab touch-none border-b border-zinc-200 bg-white text-zinc-900 active:cursor-grabbing rounded-t-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-200/80 bg-zinc-100/80 text-[10.5px] font-bold text-zinc-600 select-none">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-zinc-700">
            <Move size={11} className="text-purple-600" />
            Fenêtre Flottante (Glissez par ici)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleDock}
              className="p-1 hover:bg-zinc-200 text-zinc-700 rounded transition-colors cursor-pointer"
              title="Ancrer à droite comme un volet"
            >
              <PanelRightOpen size={12} />
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(true)}
              className="p-1 hover:bg-zinc-200 text-zinc-700 rounded transition-colors cursor-pointer"
              title="Agrandir en plein écran"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
        {header}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">{children}</div>

      {footer && <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/90 rounded-b-2xl overflow-hidden">{footer}</div>}

      {/* Poignée de redimensionnement */}
      <div
        onPointerDown={start('resize')}
        aria-label="Redimensionner"
        className="absolute right-0 bottom-0 size-6 cursor-nwse-resize touch-none flex items-end justify-end p-1 text-zinc-400 hover:text-zinc-700"
      >
        <svg viewBox="0 0 20 20" className="size-4 text-zinc-500">
          <path d="M19 7 L7 19 M19 12 L12 19 M19 17 L17 19" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </div>
    </div>
  );
}
