"use client";

import React, { Suspense } from 'react';
import PromotionsClient from './PromotionsClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-600">Chargement...</div>}>
      <PromotionsClient />
    </Suspense>
  );
}
