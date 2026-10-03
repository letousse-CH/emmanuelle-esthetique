'use client';

import React, { useState } from 'react';
import { Monitor } from 'lucide-react';

/**
 * Écrans très « bureau » : sous `lg`, une carte discrète prévient que l'outil
 * est plus confortable sur ordinateur. Avec `blocking`, le contenu reste caché
 * jusqu'à « Ouvrir quand même » (outil vraiment inutilisable à 375 px) ;
 * sinon il s'affiche dessous, et la carte reste un simple conseil.
 * Au-delà de `lg`, rien ne change : pas de carte, contenu intact.
 */
export default function DesktopNotice({
  children,
  blocking = false,
  what = 'Cet outil',
}: {
  children: React.ReactNode;
  blocking?: boolean;
  what?: string;
}) {
  const [forced, setForced] = useState(false);
  const hideContent = blocking && !forced;
  return (
    <>
      {!forced && (
        <div
          role="note"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 lg:hidden"
        >
          <Monitor size={20} className="mt-0.5 shrink-0 text-stone-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-stone-900">{what} est plus confortable sur ordinateur.</p>
            {blocking && (
              <button
                type="button"
                onClick={() => setForced(true)}
                className="mt-2 inline-flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-accent underline underline-offset-2"
              >
                Ouvrir quand même
              </button>
            )}
          </div>
        </div>
      )}
      <div className={hideContent ? 'hidden lg:block' : undefined}>{children}</div>
    </>
  );
}
