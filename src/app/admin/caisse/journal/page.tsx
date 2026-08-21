"use client";

import React, { Suspense } from 'react';
import JournalClient from './JournalClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Chargement...</div>}>
      <JournalClient />
    </Suspense>
  );
}
