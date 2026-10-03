"use client";

import React from 'react';
import { CAISSE_SUBNAV, isUnder } from './nav';
import { Chip, ChipBar } from './ui';

/**
 * Sous-navigation de la caisse : une rangée de pastilles défilante, collée sous
 * l'en-tête mobile. Rendue par le shell pour toute route /admin/caisse/** — les
 * pages n'ont rien à faire. Sous `lg` seulement : sur ordinateur la barre
 * latérale reste la navigation.
 */
export default function CaisseSubNav({ pathname }: { pathname: string }) {
  const current = CAISSE_SUBNAV.find((l) => (l.exact ? pathname === l.path : isUnder(pathname, l.path)))?.path ?? null;
  return (
    <nav aria-label="Rubriques de la caisse" className="border-t border-stone-100 bg-white/95 lg:hidden">
      <ChipBar label="Rubriques de la caisse" activeKey={current} bleed={false} className="px-4 py-2">
        {CAISSE_SUBNAV.map((l) => (
          <Chip key={l.path} href={l.path} selected={l.path === current} icon={l.icon}>
            {l.name}
          </Chip>
        ))}
      </ChipBar>
    </nav>
  );
}
