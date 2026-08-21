'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Pipette, RotateCcw } from 'lucide-react';

/**
 * Choix d'une couleur dans la palette de travail.
 *
 * Deux principes, tirés de l'usage :
 *
 * 1. **La palette ne se déploie qu'au clic.** Dix-huit champs de couleur qui
 *    affichent chacun six pastilles en permanence, cela fait plus de cent
 *    aplats à l'écran : on ne voit plus les réglages. Le champ se contente donc
 *    de montrer son état, et n'ouvre le choix que si on le lui demande.
 *
 * 2. **« Automatique » n'est pas « rien ».** Quand la valeur est vide, une
 *    couleur s'applique quand même — celle du thème, ou celle proposée par le
 *    style de boutons. On la montre, plutôt que de laisser une pastille vide
 *    qui laisse croire à un trou.
 */
export interface PaletteSwatch {
  key: string;
  label: string;
  value: string;
  hint?: string;
}

export default function PaletteColorInput({
  value,
  onChange,
  swatches,
  autoLabel = 'Automatique',
  autoHint,
  autoValue,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  swatches: PaletteSwatch[];
  /** Libellé du choix « ne rien imposer ». `null` retire l'option. */
  autoLabel?: string | null;
  autoHint?: string;
  /** Couleur réellement appliquée quand rien n'est choisi, si on la connaît. */
  autoValue?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = (value ?? '').trim();
  const known = swatches.find((s) => s.value.toLowerCase() === current.toLowerCase());
  const inPalette = !!known;
  const shown = current || autoValue || '';

  // Fermeture au clic extérieur et à Échap : un menu qui reste ouvert derrière
  // le suivant rend la grille de réglages illisible.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = current
    ? known?.label ?? current.toUpperCase()
    : autoLabel ?? 'Non définie';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel ? `${ariaLabel} — ${label}` : undefined}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-stone-300 bg-white px-2 text-left transition-colors hover:border-stone-400 cursor-pointer
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
      >
        <span
          className="size-5 shrink-0 rounded border border-stone-300"
          style={{
            backgroundColor: shown && shown !== 'transparent' ? shown : 'transparent',
            backgroundImage: shown && shown !== 'transparent'
              ? undefined
              : 'repeating-conic-gradient(#f5f5f4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px',
          }}
        />
        <span className={`min-w-0 flex-1 truncate text-[12.5px] ${current ? 'text-stone-800' : 'text-stone-600'}`}>
          {label}
        </span>
        <ChevronDown size={13} className={`shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel ? `Couleur : ${ariaLabel}` : 'Choix de la couleur'}
          className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg"
        >
          {autoLabel !== null && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                !current ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              <span
                className="size-5 shrink-0 rounded border border-stone-300"
                style={{
                  backgroundColor: autoValue && autoValue !== 'transparent' ? autoValue : 'transparent',
                  backgroundImage: autoValue && autoValue !== 'transparent'
                    ? undefined
                    : 'repeating-conic-gradient(#f5f5f4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px',
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-stone-800">{autoLabel}</span>
                {autoHint && <span className="block text-[11.5px] leading-snug text-stone-600">{autoHint}</span>}
              </span>
              {!current && <Check size={13} className="shrink-0 text-stone-900" />}
            </button>
          )}

          <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-stone-600">
            Palette du site
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {swatches.map((swatch) => {
              const active = current.toLowerCase() === swatch.value.toLowerCase();
              return (
                <button
                  key={swatch.key}
                  type="button"
                  onClick={() => { onChange(swatch.value); setOpen(false); }}
                  aria-pressed={active}
                  aria-label={swatch.label}
                  title={swatch.hint ? `${swatch.label} — ${swatch.hint}` : swatch.label}
                  className={`aspect-square rounded-lg border transition-transform cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 ${
                      active ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1' : 'border-stone-300 hover:scale-110'
                    }`}
                  style={{ backgroundColor: swatch.value }}
                />
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200 pt-2.5">
            <button
              type="button"
              onClick={() => setCustom((c) => !c)}
              aria-expanded={custom}
              className="inline-flex items-center gap-1 text-[12px] text-stone-700 transition-colors hover:text-stone-900 cursor-pointer"
            >
              <Pipette size={12} /> Hors palette
            </button>
            {current && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="inline-flex items-center gap-1 text-[12px] text-stone-600 transition-colors hover:text-stone-900 cursor-pointer"
              >
                <RotateCcw size={12} /> Effacer
              </button>
            )}
          </div>

          {(custom || (current && !inPalette)) && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="relative size-7 shrink-0 overflow-hidden rounded-lg border border-stone-300"
                style={{ backgroundColor: current || '#000000' }}
              >
                <input
                  type="color"
                  aria-label={ariaLabel ? `${ariaLabel} — sélecteur` : 'Sélecteur de couleur'}
                  value={current && current !== 'transparent' ? current : '#000000'}
                  onChange={(e) => onChange(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </span>
              <input
                type="text"
                value={current}
                placeholder="#FFFFFF"
                onChange={(e) => onChange(e.target.value)}
                aria-label={ariaLabel ? `${ariaLabel} — code couleur` : 'Code couleur'}
                className="h-7 min-w-0 flex-1 rounded-lg border border-stone-300 px-2 font-mono text-[12px] text-stone-800 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
