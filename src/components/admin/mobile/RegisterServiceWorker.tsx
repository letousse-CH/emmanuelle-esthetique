"use client";

import { useEffect } from 'react';

/** Enregistre le service worker de l'admin (nécessaire à l'installation sur Android). */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin' }).catch(() => {});
  }, []);
  return null;
}
