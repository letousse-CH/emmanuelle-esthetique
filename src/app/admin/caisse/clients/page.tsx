"use client";

import React, { Suspense } from 'react';
import ClientsClient from './ClientsClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Chargement...</div>}>
      <ClientsClient />
    </Suspense>
  );
}
