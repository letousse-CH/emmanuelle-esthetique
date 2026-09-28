"use client";

import { useEffect } from 'react';
import { fetchAllSettings, settingsCache } from './useSettings';

const FALLBACK = '#12283A';

/** Luminance relative WCAG d'une couleur #rrggbb (0 = noir, 1 = blanc). */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function apply(color: string) {
  const root = document.documentElement;
  const lum = luminance(color);
  const value = lum === null ? FALLBACK : color.trim();
  root.style.setProperty('--admin-accent', value);
  // Texte sur fond d'accent : blanc tant que le contraste reste correct.
  root.style.setProperty('--admin-accent-fg', lum !== null && lum > 0.42 ? '#1C1917' : '#FFFFFF');
}

/**
 * Pose la couleur d'action du back-office : la couleur principale du site.
 * Une seule teinte pour tous les boutons, liens actifs et focus de l'admin.
 */
export function useAdminAccent() {
  useEffect(() => {
    const cached = settingsCache.get('style_color_primary');
    if (cached) apply(cached);
    fetchAllSettings()
      .then(() => apply(settingsCache.get('style_color_primary') || FALLBACK))
      .catch(() => {});
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--admin-accent');
      root.style.removeProperty('--admin-accent-fg');
    };
  }, []);
}
