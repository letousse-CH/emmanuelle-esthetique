"use client";

import React, { useState } from 'react';
import { CalendarDays, Rss } from 'lucide-react';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import SocialCalendarClient from './SocialCalendarClient';
import SocialSourcesClient from './SocialSourcesClient';
import { PageHeader, Tabs } from '../../../components/admin/ui';

export default function Page() {
  const moduleFlags = useModuleFlags();
  const [tab, setTab] = useState<'calendrier' | 'sources'>('calendrier');

  return (
    <div className="space-y-6">
      {!moduleFlags.social && <ModuleDisabledBanner moduleLabel="Réseaux sociaux" />}

      <PageHeader
        title="Réseaux sociaux"
        description="Préparez et planifiez vos publications Instagram, LinkedIn et Facebook à partir de vos articles et de vos sources."
      />

      <Tabs
        label="Sections réseaux sociaux"
        items={[
          { id: 'calendrier', label: 'Calendrier', icon: CalendarDays },
          { id: 'sources', label: 'Sources', icon: Rss },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'calendrier' | 'sources')}
      />

      {tab === 'calendrier'
        ? <SocialCalendarClient />
        : <SocialSourcesClient onGenerated={() => setTab('calendrier')} />}
    </div>
  );
}
