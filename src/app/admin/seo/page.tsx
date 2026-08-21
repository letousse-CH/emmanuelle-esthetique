"use client";

import React, { Suspense } from 'react';
import SeoHubClient from './SeoHubClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Chargement...</div>}>
      <SeoHubClient />
    </Suspense>
  );
}
