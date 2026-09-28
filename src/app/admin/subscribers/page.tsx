"use client";

import React, { Suspense } from 'react';
import SubscribersClient from './SubscribersClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-700">Chargement...</div>}>
      <SubscribersClient />
    </Suspense>
  );
}
