"use client";

import { useEffect, useState } from 'react';
import type { AdminCatalogItem, BookingSettings } from '../../../types/booking';
import { adminFetch, unwrap } from './lib';

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
