"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../services/supabase';

// Pages à ne pas tracker
const EXCLUDED = ['/admin', '/login'];

export function usePageTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || EXCLUDED.some(p => pathname.startsWith(p))) return;
    const ua = navigator.userAgent.toLowerCase();
    if (/bot|crawl|spider|headless/.test(ua)) return;

    // Une seule insertion par page par session
    const key = `sde_pv_${pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    supabase.from('page_views').insert({
      page: pathname,
      referrer: document.referrer || null,
    }).then(() => {});
  }, [pathname]);
}
