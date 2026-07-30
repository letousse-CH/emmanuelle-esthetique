'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../services/supabase';

// Pages à ne pas tracker
const EXCLUDED = ['/admin', '/login'];

/**
 * Enregistre une vue de page dans la table `page_views`, lue par le tableau de
 * bord de l'admin (`/api/admin-stats`).
 *
 * Monté dans le layout public : App Router ne remonte pas les layouts entre
 * deux navigations, l'effet se redéclenche donc via `usePathname`.
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (EXCLUDED.some((p) => pathname.startsWith(p))) return;

    const ua = navigator.userAgent.toLowerCase();
    if (/bot|crawl|spider|headless/.test(ua)) return;

    // Une seule insertion par page par session (évite le spam sur F5 et
    // les allers-retours dans la navigation).
    const key = `ee_pv_${pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage indisponible (navigation privée stricte) : on trace
      // quand même, quitte à compter deux fois.
    }

    void supabase
      .from('page_views')
      .insert({ page: pathname, referrer: document.referrer || null })
      .then(({ error }) => {
        // Le tracking ne doit jamais casser l'UX : on se contente d'un log.
        if (error) console.warn('[page-views] insertion impossible:', error.message);
      });
  }, [pathname]);

  return null;
}
