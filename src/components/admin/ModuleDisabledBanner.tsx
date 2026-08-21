"use client";

import Link from 'next/link';
import { EyeOff } from 'lucide-react';

export default function ModuleDisabledBanner({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      <EyeOff size={15} className="shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        Le module <strong>{moduleLabel}</strong> est désactivé : rien n'en apparaît sur le site
        public. Vous pouvez continuer à le préparer ici.
      </span>
      <Link
        href="/admin/settings"
        className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12.5px] font-medium text-amber-900 transition-colors hover:bg-amber-100"
      >
        Réactiver
      </Link>
    </div>
  );
}
