'use client';

import React, { useState } from 'react';
import { Bot, MessagesSquare } from 'lucide-react';

import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import { PageHeader, Tabs } from '../../../components/admin/ui';
import AgentsClient from './AgentsClient';
import ConversationsClient from './ConversationsClient';

export default function Page() {
  const moduleFlags = useModuleFlags();
  const [tab, setTab] = useState('agents');

  return (
    <div className="max-w-6xl space-y-6">
      {!moduleFlags.agents && <ModuleDisabledBanner moduleLabel="Agent IA" />}

      <PageHeader
        title="Agent IA"
        description="Un assistant qui répond aux visiteurs à partir du contenu réel de votre site, cadre leur demande et récupère de quoi les rappeler."
      />

      <Tabs
        label="Sections des agents"
        active={tab}
        onChange={setTab}
        items={[
          { id: 'agents', label: 'Agents', icon: Bot },
          { id: 'conversations', label: 'Conversations', icon: MessagesSquare },
        ]}
      />

      {tab === 'agents' ? <AgentsClient /> : <ConversationsClient />}
    </div>
  );
}
