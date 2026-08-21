'use client';

import React from 'react';

import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import { PageHeader } from '../../../components/admin/ui';
import AutomationsClient from './AutomationsClient';

export default function Page() {
  const moduleFlags = useModuleFlags();

  return (
    <div className="max-w-5xl space-y-6">
      {!moduleFlags.automations && <ModuleDisabledBanner moduleLabel="Automatisations" />}

      <PageHeader
        title="Automatisations"
        description="Faites exécuter au site les tâches répétitives — publier, préparer, prévenir — et gardez la trace de chaque passage."
      />

      <AutomationsClient />
    </div>
  );
}
