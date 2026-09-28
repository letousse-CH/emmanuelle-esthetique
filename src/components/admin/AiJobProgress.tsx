"use client";

/**
 * Indicateur d'une génération IA en tâche de fond : sablier, libellé, temps
 * écoulé, et un mot pour rassurer pendant l'attente (souvent plus d'une
 * minute). Voir hooks/useAiJob.ts.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatElapsed } from '../../hooks/useAiJob';

export default function AiJobProgress({
  label = 'Rédaction en cours…',
  elapsedSeconds,
  canLeave = true,
  compact = false,
}: {
  label?: string;
  elapsedSeconds: number;
  /**
   * Vrai si le résultat est retrouvé après avoir quitté la page (suivi avec
   * reprise). Sinon, on demande de garder la page ouverte.
   */
  canLeave?: boolean;
  /** Version d'une ligne, pour une barre d'outils. */
  compact?: boolean;
}) {
  const time = formatElapsed(elapsedSeconds);

  if (compact) {
    return (
      <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-[13px] text-stone-700">
        <Loader2 size={14} className="animate-spin text-stone-600" />
        <span>{label}</span>
        <span className="font-mono tabular-nums">{time}</span>
      </span>
    );
  }

  // Même rendu que le Spinner du kit admin (ui.tsx), avec le temps écoulé et
  // une seconde ligne ; le Spinner n'accepte qu'un libellé.
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm text-stone-700">
        <Loader2 size={16} className="animate-spin text-stone-600 shrink-0" />
        <span className="font-semibold text-stone-900">{label}</span>
        <span className="font-mono tabular-nums">{time}</span>
      </div>
      <p className="mt-1 pl-[26px] text-[13px] text-stone-700">
        {canLeave
          ? 'Vous pouvez quitter cette page, le résultat vous attendra.'
          : 'Cela peut prendre quelques minutes. Gardez cette page ouverte jusqu’à la fin.'}
      </p>
    </div>
  );
}
