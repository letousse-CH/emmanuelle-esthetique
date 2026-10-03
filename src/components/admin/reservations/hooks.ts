"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { AdminCatalogItem, AgendaData, BookingSettings } from '../../../types/booking';
import { adminFetch, errorMessage, unwrap } from './lib';

// ── Catalogue (prestations + options d'upsell) ─────────────────────────────

export interface CatalogService {
  id: string;
  name: string;
  /** Nom de la catégorie (ex. « Soins du visage »). */
  category: string;
  type: 'prestation' | 'forfait';
  durationMinutes: number;
  priceChf: number;
}
export interface CatalogOption {
  id: string;
  nom: string;
  duree_minutes: number;
  prix_chf: number;
  description?: string;
}
export interface Catalog {
  services: CatalogService[];
  options: CatalogOption[];
}

/** Libellés des anciennes clés de catégorie (route publique), si le repli est utilisé. */
export const CATEGORY_LABEL: Record<string, string> = {
  visage: 'Soins du visage',
  corps: 'Corps et massages',
  epilation: 'Épilation',
  services: 'Mains, pieds, regard',
};

/**
 * Catalogue complet des services actifs (`GET /api/admin/services-catalog`) :
 * prestations et forfaits servent de soin principal, les options alimentent
 * l'upselling. En cas d'échec de la route admin, repli sur le catalogue public.
 */
export function useCatalog(): { catalog: Catalog; loading: boolean; error: string | null } {
  const [catalog, setCatalog] = useState<Catalog>({ services: [], options: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const json = await adminFetch<{ services?: AdminCatalogItem[] }>('/api/admin/services-catalog');
        const items = Array.isArray(json.services) ? json.services : [];
        const next: Catalog = { services: [], options: [] };
        for (const it of items) {
          if (it.type === 'option') {
            next.options.push({ id: it.id, nom: it.nom, prix_chf: Number(it.prix_chf) || 0, duree_minutes: Number(it.duree_minutes) || 0 });
          } else {
            next.services.push({
              id: it.id,
              name: it.nom,
              category: it.categorie || 'Autres soins',
              type: it.type === 'forfait' ? 'forfait' : 'prestation',
              priceChf: Number(it.prix_chf) || 0,
              durationMinutes: Number(it.duree_minutes) || 0,
            });
          }
        }
        if (active) setCatalog(next);
      } catch {
        try {
          const r = await fetch('/api/bookings/services');
          const json = r.ok ? await r.json() : null;
          if (!json) throw new Error('catalogue indisponible');
          if (active) {
            setCatalog({
              services: (json.services ?? []).map((x: { id: string; name: string; category: string; durationMinutes: number; priceChf: number }) => ({
                ...x,
                category: CATEGORY_LABEL[x.category] ?? x.category,
                type: 'prestation' as const,
              })),
              options: json.options ?? [],
            });
          }
        } catch {
          if (active) setError('La liste des soins n’a pas pu être chargée.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { catalog, loading, error };
}

// ── Réglages de réservation (horaires, pas de la grille, coupure) ──────────

export function useBookingSettings(): BookingSettings | null {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  useEffect(() => {
    let active = true;
    adminFetch('/api/admin/booking-settings')
      .then((json) => active && setSettings(unwrap<BookingSettings>(json, 'settings')))
      .catch(() => {
        /* Les valeurs par défaut (coupure 13:00, pas 15 min) suffisent à l'affichage. */
      });
    return () => {
      active = false;
    };
  }, []);
  return settings;
}

// ── Media query ────────────────────────────────────────────────────────────

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const LG = '(min-width: 1024px)';

/** `true` à partir de 1024 px (bureau). `null` tant que le navigateur n'a pas répondu (rendu serveur). */
export function useIsLg(): boolean | null {
  const [lg, setLg] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(LG);
    const update = () => setLg(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return lg;
}

/**
 * Comme `useIsLg`, mais lit la largeur dès le premier rendu côté navigateur :
 * pour les fenêtres (feuilles, tiroirs) qui s'ouvrent après coup et ne doivent
 * pas apparaître d'abord dans la mauvaise forme. Pendant l'hydratation, la
 * valeur serveur (bureau) est utilisée, puis React corrige sans avertissement.
 */
export function useIsLgSync(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(LG);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(LG).matches,
    () => true,
  );
}

// ── Agenda d'une plage de dates (bandeau + chronologie du téléphone) ───────

/**
 * Charge `GET /api/admin/bookings/agenda` pour une plage. Pendant le chargement
 * d'une autre plage, la précédente reste affichée : le glisser d'un jour à
 * l'autre ne clignote pas.
 */
export function useAgenda(from: string, to: string, refreshKey: number, enabled = true) {
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    adminFetch<AgendaData>(`/api/admin/bookings/agenda?from=${from}&to=${to}`)
      .then((json) => {
        if (!active) return;
        setData(json);
        setError(null);
      })
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to, refreshKey, tick, enabled]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, retry };
}
