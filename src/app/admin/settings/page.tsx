"use client";

import React, { Suspense } from 'react';
import SettingsClient from './SettingsClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-500 italic">Chargement...</div>}>
      <SettingsClient />
    </Suspense>
  );
}
