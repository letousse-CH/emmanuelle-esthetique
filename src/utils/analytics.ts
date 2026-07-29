/**
 * Wrapper analytics minimal : pousse dans window.dataLayer (GTM) et appelle
 * window.gtag (GA4 direct) si présents, ne fait rien sinon. Aucune dépendance
 * à un SDK non installé — évite de bloquer le funnel si l'intégration
 * analytics n'est pas encore branchée.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
    window.gtag?.('event', event, params);
  } catch {
    // silencieux : le tracking ne doit jamais casser l'UX
  }
}
