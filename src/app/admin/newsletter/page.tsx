"use client";

import React, { Suspense } from 'react';
import NewsletterEditorClient from './NewsletterEditorClient';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-500 italic">Chargement...</div>}>
      <NewsletterEditorClient />
    </Suspense>
  );
}
