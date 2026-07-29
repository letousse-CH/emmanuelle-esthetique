"use client";

import Link from 'next/link';

export default function ModuleDisabledBanner({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
      <span>
        Le module <strong>{moduleLabel}</strong> est désactivé — il est invisible sur le site public. Tu peux continuer à le
        modifier ici, ou le réactiver depuis les Paramètres.
      </span>
      <Link href="/admin/settings" className="ml-auto shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
        Paramètres
      </Link>
    </div>
  );
}
