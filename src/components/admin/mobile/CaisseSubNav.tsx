"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { CAISSE_SUBNAV, isUnder } from './nav';
import { BottomSheet } from './ui';

/**
 * Sous-navigation de la caisse : un seul bouton « rubrique en cours », qui ouvre
 * une feuille de grosses tuiles (pas de rangée à faire glisser). Rendue par le
 * shell pour toute route /admin/caisse/** ; sous `lg` seulement.
 */
export default function CaisseSubNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const current = CAISSE_SUBNAV.find((l) => (l.exact ? pathname === l.path : isUnder(pathname, l.path))) ?? null;
  const Icon = current?.icon;
  return (
    <nav aria-label="Rubriques de la caisse" className="border-t border-stone-100 bg-white/95 px-4 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-stone-100 px-3.5 text-left text-[15px] font-semibold text-stone-900 cursor-pointer active:bg-stone-200"
      >
        {Icon && <Icon size={18} className="text-accent" aria-hidden="true" />}
        <span className="flex-1">{current?.name ?? 'Caisse'}</span>
        <span className="text-[13px] font-medium text-stone-600">Changer</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Rubriques de la caisse">
        <div className="grid grid-cols-2 gap-3 pb-2">
          {CAISSE_SUBNAV.map((l) => {
            const I = l.icon;
            const sel = l.path === current?.path;
            return (
              <Link
                key={l.path} href={l.path} onClick={() => setOpen(false)}
                aria-current={sel ? 'page' : undefined}
                className={`flex min-h-[88px] flex-col items-start justify-between rounded-2xl border p-3.5 active:scale-[0.97] ${
                  sel ? 'border-accent bg-accent/10' : 'border-stone-200 bg-white'
                }`}
              >
                <I size={24} className="text-accent" aria-hidden="true" />
                <span className="text-[16px] font-semibold text-stone-950">{l.name}</span>
              </Link>
            );
          })}
        </div>
      </BottomSheet>
    </nav>
  );
}
