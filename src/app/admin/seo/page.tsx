"use client";

import React, { Suspense } from 'react';
import SeoHubClient from './SeoHubClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-500 italic">Chargement...</div>}>
      <SeoHubClient />
    </Suspense>
  );
}
