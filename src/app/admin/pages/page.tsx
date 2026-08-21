"use client";

import React, { Suspense } from 'react';
import PageListClient from './PageListClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Chargement...</div>}>
      <PageListClient />
    </Suspense>
  );
}
