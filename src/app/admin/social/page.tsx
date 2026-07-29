"use client";

import React, { useState } from 'react';
import { CalendarDays, Rss } from 'lucide-react';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import SocialCalendarClient from './SocialCalendarClient';
import SocialSourcesClient from './SocialSourcesClient';

export default function Page() {
  const moduleFlags = useModuleFlags();
  const [tab, setTab] = useState<'calendrier' | 'sources'>('calendrier');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {!moduleFlags.social && <ModuleDisabledBanner moduleLabel="Réseaux Sociaux" />}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Audience</p>
        <h1 className="text-2xl font-semibold text-stone-900">Réseaux Sociaux</h1>
        <p className="text-stone-400 text-sm mt-1">Contenu Instagram, LinkedIn et Facebook généré depuis vos articles, vos flux RSS et vos suggestions SEO.</p>
      </div>

      <div role="tablist" aria-label="Sections réseaux sociaux" className="flex gap-2 overflow-x-auto border-b border-stone-200">
        <button
          role="tab"
          aria-selected={tab === 'calendrier'}
          onClick={() => setTab('calendrier')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'calendrier' ? 'border-sage text-sage' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <CalendarDays size={14} /> Calendrier
        </button>
        <button
          role="tab"
          aria-selected={tab === 'sources'}
          onClick={() => setTab('sources')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
            tab === 'sources' ? 'border-sage text-sage' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Rss size={14} /> Sources
        </button>
      </div>

      {tab === 'calendrier'
        ? <SocialCalendarClient />
        : <SocialSourcesClient onGenerated={() => setTab('calendrier')} />}
    </div>
  );
}
