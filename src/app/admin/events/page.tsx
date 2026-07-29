"use client";

import React, { Suspense } from 'react';
import EventListClient from './EventListClient';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';

export default function Page() {
  const moduleFlags = useModuleFlags();
  return (
    <Suspense fallback={<div className="p-8 text-stone-500 italic">Chargement...</div>}>
      {!moduleFlags.events && <ModuleDisabledBanner moduleLabel="Événements" />}
      <EventListClient />
    </Suspense>
  );
}
