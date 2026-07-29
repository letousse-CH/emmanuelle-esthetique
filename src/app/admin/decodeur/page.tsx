"use client";

import { useState } from 'react';
import DecodeurAdminClient from './DecodeurAdminClient';
import SequenceAdminClient from './SequenceAdminClient';

export default function Page() {
  const [tab, setTab] = useState<'profiles' | 'sequence'>('profiles');

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Sections du décodeur" className="flex gap-2 overflow-x-auto border-b border-stone-200">
        <button
          role="tab"
          aria-selected={tab === 'profiles'}
          onClick={() => setTab('profiles')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'profiles' ? 'border-sage text-sage' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Profils de résultat
        </button>
        <button
          role="tab"
          aria-selected={tab === 'sequence'}
          onClick={() => setTab('sequence')}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'sequence' ? 'border-sage text-sage' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          Séquence email
        </button>
      </div>

      {tab === 'profiles' ? <DecodeurAdminClient /> : <SequenceAdminClient />}
    </div>
  );
}
