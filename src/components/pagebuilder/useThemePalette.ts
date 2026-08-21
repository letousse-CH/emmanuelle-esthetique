'use client';

import { useEffect, useState } from 'react';

import { supabase } from '../../services/supabase';
import { DESIGN_TOKEN_DEFAULTS } from '../../constants/designTokens';

/**
 * Palette réellement en vigueur sur le site.
 *
 * Le constructeur proposait six teintes écrites en dur — « Crème », « Sauge
 * profond », « Terracotta » — celles du site d'origine. On pouvait donc peindre
 * une section d'une couleur absente de la charte, et la page repartait dans
 * tous les sens dès qu'un client changeait sa palette.
 *
 * On lit ici les jetons de « Design & Style » : ce qui est proposé est ce qui
 * existe. Même source que `GlobalStyles`, même cache local, donc pas d'aller-
 * retour supplémentaire à l'ouverture de la modale.
 */
export interface ThemeSwatch {
  key: string;
  label: string;
  value: string;
  hint: string;
}

const CACHE_KEY = 'site_design_tokens';

const SWATCH_SPEC: { key: string; label: string; hint: string }[] = [
  { key: 'style_color_bg', label: 'Fond du site', hint: 'La couleur de page par défaut.' },
  { key: 'style_color_surface', label: 'Surface', hint: 'Le ton des cartes et des blocs.' },
  { key: 'style_color_primary', label: 'Primaire', hint: 'Votre couleur d’accent — à réserver aux sections fortes.' },
  { key: 'style_color_text', label: 'Sombre', hint: 'Le ton foncé de la charte.' },
  { key: 'style_color_text_muted', label: 'Texte secondaire', hint: 'Descriptions, légendes.' },
  { key: 'style_color_border', label: 'Bordure', hint: 'Un gris de séparation, très discret.' },
];

export function useThemePalette(): { swatches: ThemeSwatch[]; loading: boolean } {
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (cached) {
      try { setTokens(JSON.parse(cached)); } catch { /* cache illisible : on refait le fetch */ }
    }

    let cancelled = false;
    void (async () => {
      const keys = SWATCH_SPEC.map((s) => s.key);
      const { data } = await supabase.from('settings').select('key, value').in('key', keys);
      if (cancelled) return;
      const map: Record<string, string> = { ...DESIGN_TOKEN_DEFAULTS };
      for (const row of (data ?? []) as { key: string; value: string | null }[]) {
        map[row.key] = (row.value ?? '').trim();
      }
      setTokens(map);
    })();
    return () => { cancelled = true; };
  }, []);

  const swatches = SWATCH_SPEC
    .map((spec) => ({ ...spec, value: (tokens?.[spec.key] ?? '').trim() }))
    .filter((s) => !!s.value);

  return { swatches, loading: tokens === null };
}
