'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Champ de taille avec incrément.
 *
 * Toutes les tailles du back-office se saisissaient au clavier, en `rem`, dans
 * un champ texte : pour passer un titre de 2,5 à 2,6 rem il fallait
 * sélectionner, retaper, et recommencer pour juger. Deux flèches suffisent, et
 * l'unité saisie est conservée telle quelle — quelqu'un qui travaille en pixels
 * ne doit pas se retrouver avec des `rem`.
 *
 * Les valeurs non numériques — un `clamp()` écrit à la main, un `calc()` — sont
 * laissées intactes : les flèches se désactivent plutôt que de les écraser.
 */
const UNIT_STEPS: Record<string, number> = {
  rem: 0.0625, // un pixel à la taille de base
  em: 0.0625,
  px: 1,
  '%': 1,
  vw: 0.5,
  vh: 0.5,
  '': 0.0625,
};

/** Sépare « 1.25rem » en nombre et unité. `null` si ce n'est pas une taille simple. */
export function parseSize(value: string): { amount: number; unit: string } | null {
  const match = value.trim().match(/^(-?\d*\.?\d+)\s*(rem|em|px|%|vw|vh)?$/);
  if (!match) return null;
  return { amount: parseFloat(match[1]), unit: match[2] ?? '' };
}

function format(amount: number, unit: string): string {
  // Trois décimales suffisent, et on ne garde pas les zéros inutiles.
  const rounded = Math.round(amount * 1000) / 1000;
  return `${rounded}${unit}`;
}

export default function SizeInput({
  value,
  onChange,
  placeholder,
  fallback = '1rem',
  id,
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Valeur de départ quand le champ est vide et qu'on clique sur une flèche. */
  fallback?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const current = (value ?? '').trim();
  const parsed = parseSize(current) ?? (current ? null : parseSize(fallback));
  const step = parsed ? UNIT_STEPS[parsed.unit] ?? 0.0625 : 0;

  const bump = (direction: 1 | -1) => {
    if (!parsed) return;
    const next = Math.max(0, parsed.amount + direction * step);
    onChange(format(next, parsed.unit));
  };

  const button = (direction: 1 | -1, Icon: React.ElementType, label: string) => (
    <button
      type="button"
      onClick={() => bump(direction)}
      disabled={!parsed}
      aria-label={ariaLabel ? `${ariaLabel} — ${label}` : label}
      title={parsed ? label : 'Valeur non numérique : à modifier à la main.'}
      className="grid h-[18px] w-6 place-items-center text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900
        disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
    >
      <Icon size={11} />
    </button>
  );

  return (
    <div
      className={`flex h-10 items-stretch overflow-hidden rounded-lg border border-stone-300 bg-white transition-colors
        focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900 ${className}`}
    >
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={current}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Flèches du clavier : le même geste que les boutons, sans la souris.
          if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
        }}
        className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:outline-none"
      />
      <span className="flex flex-col border-l border-stone-200">
        {button(1, Plus, 'augmenter')}
        <span className="h-px bg-stone-200" />
        {button(-1, Minus, 'diminuer')}
      </span>
    </div>
  );
}
