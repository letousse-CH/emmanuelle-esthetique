"use client";

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { BottomSheet } from '../mobile/ui';
import { useIsLgSync } from './hooks';

/**
 * Tiroir latéral (ordinateur) ou modale centrée. Sous 1024 px (téléphone), la
 * fenêtre devient une feuille du bas du kit mobile (`BottomSheet`) : plein écran
 * pour un tiroir, à hauteur du contenu pour une modale — elle recouvre la barre
 * d'onglets, sans conflit. Mêmes props dans les deux cas.
 *
 * Accessibilité : `role="dialog"` + `aria-modal`, focus déplacé dans la fenêtre
 * puis rendu à l'élément d'origine, Tab qui ne sort pas de la fenêtre, Échap
 * qui ferme seulement la fenêtre du dessus (pile `stack`).
 */

const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Overlay(props: OverlayProps) {
  const lg = useIsLgSync();
  if (!lg) {
    return (
      <BottomSheet
        open
        onClose={props.onClose}
        title={props.title}
        description={props.subtitle}
        footer={props.footer}
        size={(props.variant ?? 'drawer') === 'drawer' ? 'full' : 'auto'}
        zIndex={props.zIndex ?? 100}
      >
        {props.children}
      </BottomSheet>
    );
  }
  return <DesktopOverlay {...props} />;
}

interface OverlayProps {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  variant?: 'drawer' | 'modal';
  footer?: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
  labelledById?: string;
}

function DesktopOverlay({
  title,
  subtitle,
  onClose,
  variant = 'drawer',
  footer,
  children,
  zIndex = 100,
  labelledById,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const autoId = React.useId();
  const titleId = labelledById ?? `ov-${autoId.replace(/:/g, '')}`;

  useEffect(() => {
    const token = Symbol('overlay');
    stack.push(token);
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus : le premier champ de saisie, à défaut la fenêtre elle-même.
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root || root.contains(document.activeElement)) return;
      (root.querySelector<HTMLElement>('[data-autofocus]') ?? root).focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const isDrawer = variant === 'drawer';

  const node = (
    <div className="fixed inset-0" style={{ zIndex }}>
      <div className="absolute inset-0 bg-stone-900/45" onClick={onClose} aria-hidden="true" />
      <div
        className={
          isDrawer
            ? 'absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:max-w-xl lg:max-w-2xl'
            : 'absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6 pointer-events-none'
        }
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={
            isDrawer
              ? 'flex h-full min-h-0 flex-1 flex-col focus:outline-none'
              : 'pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl focus:outline-none sm:max-w-lg sm:rounded-2xl'
          }
        >
          <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[19px] font-semibold leading-tight tracking-tight text-stone-950">
                {title}
              </h2>
              {subtitle && <div className="mt-1 text-[14px] text-stone-700">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <X size={20} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
          {footer && (
            <footer className="border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
