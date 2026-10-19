"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { Sparkles, MessageSquareHeart, CalendarDays, Flower2 } from 'lucide-react';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import SocialAutopilotQueue from './SocialAutopilotQueue';
import SocialAssistantChat from './SocialAssistantChat';
import SocialCalendarClient from './SocialCalendarClient';
import SocialBrandDnaClient from './SocialBrandDnaClient';
import { PageHeader, Tabs } from '../../../components/admin/ui';

type SocialTabId = 'propositions' | 'assistant' | 'calendrier' | 'identite';

function SocialStudioInner() {
  const moduleFlags = useModuleFlags();
  const [tab, setTab] = useState<SocialTabId>('propositions');
  const [calendarInitialDate, setCalendarInitialDate] = useState<string | undefined>(undefined);
  const [assistantInitialPrompt, setAssistantInitialPrompt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    if (
      requestedTab === 'propositions' ||
      requestedTab === 'assistant' ||
      requestedTab === 'calendrier' ||
      requestedTab === 'identite'
    ) {
      setTab(requestedTab);
    } else if (params.get('meta_connected') || params.get('meta_error')) {
      setTab('identite');
    }
  }, []);

  const handleOpenCalendar = (date?: string) => {
    if (date) setCalendarInitialDate(date);
    setTab('calendrier');
  };

  const handleOpenAssistant = (prompt?: string) => {
    if (prompt) setAssistantInitialPrompt(prompt);
    setTab('assistant');
  };

  return (
    <div className="space-y-6">
      {!moduleFlags.social && <ModuleDisabledBanner moduleLabel="Réseaux sociaux" />}

      <PageHeader
        title="Studio Social · Emmanuelle Esthétique"
        description="Vos publications Instagram, Stories, Facebook et Actualités Google (Palézieux-Gare), préparées dans l’univers de vos soins Phytomer et validées en un clic."
      />

      <Tabs
        label="Sections du Studio Social"
        items={[
          { id: 'propositions', label: 'Propositions prêtes à publier', icon: Sparkles },
          { id: 'assistant',    label: 'Assistant d’Inspiration Beauté', icon: MessageSquareHeart },
          { id: 'calendrier',   label: 'Calendrier & Planification', icon: CalendarDays },
          { id: 'identite',     label: 'Identité, Comptes & Soins', icon: Flower2 },
        ]}
        active={tab}
        onChange={(id) => setTab(id as SocialTabId)}
      />

      {tab === 'propositions' && (
        <SocialAutopilotQueue
          onNavigateToCalendar={handleOpenCalendar}
          onNavigateToAssistant={handleOpenAssistant}
        />
      )}

      {tab === 'assistant' && (
        <SocialAssistantChat
          initialPrompt={assistantInitialPrompt}
          onPostCreated={(plannedDate) => handleOpenCalendar(plannedDate)}
        />
      )}

      {tab === 'calendrier' && (
        <SocialCalendarClient initialDate={calendarInitialDate} />
      )}

      {tab === 'identite' && (
        <SocialBrandDnaClient
          onPostCreated={(plannedDate) => handleOpenCalendar(plannedDate)}
          onGeneratedFromSources={() => setTab('propositions')}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-700">Chargement du Studio Social…</div>}>
      <SocialStudioInner />
    </Suspense>
  );
}
