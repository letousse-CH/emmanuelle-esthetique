"use client";

import { COOKIE_CONSENT_OPEN_EVENT } from './CookieConsent';

/**
 * Rouvre le bandeau de cookies (mode « Personnaliser ») depuis la page
 * /politique-cookies, pour que la visiteuse puisse revenir sur son choix
 * sans vider son navigateur.
 */
export default function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_EVENT))}
      className="inline-flex items-center rounded-lg border border-stone-300 px-5 h-10 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
    >
      Gérer mes préférences de cookies
    </button>
  );
}
