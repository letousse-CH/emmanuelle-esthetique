'use client';

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { BottomSheet } from '../mobile/ui';
import type { TabItem } from '../ui';

/**
 * Navigation par liste de sections pour téléphone (`lg:hidden`) : un bouton
 * montre la rubrique courante, un tap ouvre la liste complète avec la phrase
 * qui dit ce qu'on y règle. Remplace la rangée d'onglets qui défile.
 */
export default function SectionPicker({
  items,
  active,
  onChange,
  label,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.id === active) ?? items[0];
  const Icon = current?.icon;
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${label} : ${current?.label ?? ''}. Changer de rubrique`}
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-[0_1px_2px_rgba(28,25,23,0.04)] active:bg-stone-50"
      >
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium uppercase tracking-wide text-stone-600">Rubrique</span>
          <span className="block truncate text-[16px] font-semibold text-stone-950">{current?.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-accent">
          Changer <ChevronDown size={16} aria-hidden="true" />
        </span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label} size="full">
        <div role="list" aria-label={label} className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {items.map((item) => {
            const I = item.icon;
            const on = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                aria-current={on ? 'true' : undefined}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className="flex min-h-[60px] w-full cursor-pointer items-start gap-3 px-4 py-3 text-left active:bg-stone-100"
              >
                {I && (
                  <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${on ? 'bg-accent text-accent-fg' : 'bg-stone-100 text-stone-700'}`}>
                    <I size={18} aria-hidden="true" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium leading-snug text-stone-950">{item.label}</span>
                  {item.description && <span className="mt-0.5 block text-[14px] leading-snug text-stone-600">{item.description}</span>}
                </span>
                {on && <Check size={18} className="mt-2 shrink-0 text-accent" aria-label="Rubrique affichée" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
