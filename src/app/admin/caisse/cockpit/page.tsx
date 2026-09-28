"use client";

import React, { Suspense } from 'react';
import CockpitClient from './CockpitClient';

export default function CockpitPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-700">Chargement du Cockpit…</div>}>
      <CockpitClient />
    </Suspense>
  );
}
