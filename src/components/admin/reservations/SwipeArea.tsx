"use client";

import React, { useLayoutEffect, useRef } from 'react';

/**
 * Zone qui change de jour (ou de semaine) quand on la fait glisser vers la
 * gauche ou la droite — comme une application d'agenda.
 *
 * · Le défilement vertical de la page reste celui du navigateur (`touch-action:
 *   pan-y`) ; seul un geste nettement horizontal est capté.
 * · Pendant le geste, le contenu suit le doigt ; au-delà de `THRESHOLD` px il
 *   bascule sur le jour voisin, sinon il revient en place.
 * · `animKey` est la date affichée : quand elle change (glisser, flèche,
 *   bandeau), le nouveau contenu entre par le bon côté (API Web Animations,
 *   désactivée si l'utilisatrice préfère le mouvement réduit).
 * · Un glisser ne déclenche jamais le clic d'un enfant (un rendez-vous ouvert
 *   par erreur en fin de geste).
 */
const THRESHOLD = 64;

export default function SwipeArea({
  onSwipe,
  animKey,
  children,
  className,
}: {
  /** `1` : vers le suivant (glisser vers la gauche) ; `-1` : vers le précédent. */
  onSwipe: (dir: 1 | -1) => void;
  animKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ id: -1, x: 0, y: 0, mode: 'idle' as 'idle' | 'h' | 'v', dx: 0, moved: false });
  const prevKey = useRef(animKey);

  useLayoutEffect(() => {
    const el = ref.current;
    const prev = prevKey.current;
    prevKey.current = animKey;
    if (!el || prev === animKey) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dir = animKey > prev ? 1 : -1;
    el.animate(
      [
        { transform: `translateX(${dir * 36}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(0.22, 0.7, 0.3, 1)' },
    );
  }, [animKey]);

  const reset = (animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 180ms ease-out' : 'none';
    el.style.transform = '';
    if (animate) {
      window.setTimeout(() => {
        if (ref.current) ref.current.style.transition = '';
      }, 200);
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const s = st.current;
        s.id = e.pointerId;
        s.x = e.clientX;
        s.y = e.clientY;
        s.mode = 'idle';
        s.dx = 0;
        s.moved = false;
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (e.pointerId !== s.id || s.mode === 'v') return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (s.mode === 'idle') {
          if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
          s.mode = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'h' : 'v';
          if (s.mode === 'h') {
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* le navigateur a déjà repris la main */
            }
          }
        }
        if (s.mode === 'h' && ref.current) {
          s.dx = dx;
          s.moved = true;
          ref.current.style.transition = 'none';
          ref.current.style.transform = `translateX(${dx * 0.55}px)`;
        }
      }}
      onPointerUp={(e) => {
        const s = st.current;
        if (e.pointerId !== s.id) return;
        s.id = -1;
        if (s.mode === 'h') {
          if (Math.abs(s.dx) > THRESHOLD) {
            reset(false);
            onSwipe(s.dx < 0 ? 1 : -1);
          } else {
            reset(true);
          }
        }
        s.mode = 'idle';
      }}
      onPointerCancel={() => {
        const s = st.current;
        s.id = -1;
        if (s.mode === 'h') reset(true);
        s.mode = 'idle';
      }}
      onClickCapture={(e) => {
        if (st.current.moved) {
          st.current.moved = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}
