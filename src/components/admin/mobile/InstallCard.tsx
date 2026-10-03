"use client";

import React from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { useAdminShell } from './shellContext';

/**
 * Invitation à installer l'app. N'existe que dans un onglet de navigateur :
 * dans l'app installée (ou tant que le mode n'est pas mesuré), elle ne rend rien.
 */
export default function InstallCard({ className = '' }: { className?: string }) {
  const { appMode, install } = useAdminShell();
  if (appMode !== 'browser') return null;
  if (!install.canPrompt && !install.isIOS) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4 ${className}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
        <Download size={22} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold text-stone-950">Installer l’application</p>
        {install.canPrompt ? (
          <>
            <p className="mt-0.5 text-[15px] leading-snug text-stone-700">
              Ajoutez la gestion sur l’écran d’accueil : elle s’ouvre en un tap, en plein écran.
            </p>
            <button
              type="button"
              onClick={() => void install.prompt()}
              className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg active:scale-[0.98]"
            >
              Installer
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-[15px] leading-snug text-stone-700">
            Touchez <Share size={15} className="mx-0.5 inline -translate-y-px" aria-label="Partager" /> puis{' '}
            <span className="font-semibold">Sur l’écran d’accueil</span>{' '}
            <SquarePlus size={15} className="mx-0.5 inline -translate-y-px" aria-hidden="true" />. Elle s’ouvrira ensuite en plein
            écran, comme une vraie application.
          </p>
        )}
      </div>
    </div>
  );
}
