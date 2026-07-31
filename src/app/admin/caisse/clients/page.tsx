"use client";

import React, { Suspense } from 'react';
import ClientsClient from './ClientsClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-500 italic">Chargement...</div>}>
      <ClientsClient />
    </Suspense>
  );
}
