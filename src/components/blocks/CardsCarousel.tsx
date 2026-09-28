"use client";

import { useEffect, useRef, useState } from 'react';

interface Props {
  children: React.ReactNode;
  /** Rendu dans l'éditeur : on désactive le glisser à la souris pour ne pas gêner le glisser-déposer des cartes. */
  editable?: boolean;
}

/**
 * Carrousel de cartes : boutons flèches, points de pagination, et glisser à la
 * souris sur ordinateur (le tactile défile nativement grâce à scroll-snap en CSS).
 */
export default function CardsCarousel({ children, editable }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [active, setActive] = useState(0);
  const count = Array.isArray(children) ? children.length : 1;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
      const kids = Array.from(el.children) as HTMLElement[];
      let nearest = 0;
      let min = Infinity;
      kids.forEach((k, i) => {
        const d = Math.abs(k.offsetLeft - el.scrollLeft);
        if (d < min) { min = d; nearest = i; }
      });
      setActive(nearest);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const idx = Math.max(0, Math.min(kids.length - 1, i));
    kids[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (editable || e.pointerType !== 'mouse') return;
    const el = trackRef.current;
    if (!el) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const el = trackRef.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 3) drag.moved = true;
    el.scrollLeft = drag.scrollLeft - dx;
  }
  function endDrag(e: React.PointerEvent) {
    const el = trackRef.current;
    if (dragRef.current && el) el.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }
  function onClickCapture(e: React.MouseEvent) {
    if (dragRef.current?.moved) { e.preventDefault(); e.stopPropagation(); }
  }

  return (
    <div className="pb-carousel">
      <div
        ref={trackRef}
        className={`pb-carousel-track ${editable ? '' : 'pb-carousel-draggable'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
      {count > 1 && (
        <div className="pb-carousel-controls">
          <div className="pb-carousel-dots" role="tablist" aria-label="Navigation du carrousel">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                type="button"
                className="pb-carousel-dot"
                aria-current={i === active}
                aria-label={`Aller à la carte ${i + 1}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <div className="pb-carousel-nav">
            <button type="button" className="pb-carousel-btn" onClick={() => goTo(active - 1)} disabled={atStart} aria-label="Cartes précédentes">‹</button>
            <button type="button" className="pb-carousel-btn" onClick={() => goTo(active + 1)} disabled={atEnd} aria-label="Cartes suivantes">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
