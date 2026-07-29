import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

// Pages à ne pas tracker
const EXCLUDED = ['/admin', '/login'];

export function usePageTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (EXCLUDED.some(p => pathname.startsWith(p))) return;
    const ua = navigator.userAgent.toLowerCase();
    if (/bot|crawl|spider|headless/.test(ua)) return;

    // Une seule insertion par page par session (évite le spam sur F5 et allers-retours)
    const key = `sde_pv_${pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    supabase.from('page_views').insert({
      page: pathname,
      referrer: document.referrer || null,
    }).then(() => {});
  }, [pathname]);
}
