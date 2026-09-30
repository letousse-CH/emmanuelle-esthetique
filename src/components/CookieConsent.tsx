"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface CookieConsentValue {
  necessary: true;
  analytics: boolean;
  date: string;
}

const STORAGE_KEY = 'ee_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'ee-cookie-consent';
// Déclenché depuis la page /politique-cookies pour rouvrir le bandeau.
export const COOKIE_CONSENT_OPEN_EVENT = 'ee-cookie-consent-open';

export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.analytics === 'boolean') return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCookieConsent(analytics: boolean) {
  const value: CookieConsentValue = { necessary: true, analytics, date: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le bandeau
    // réapparaîtra à la visite suivante, sans casser la page.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
  return value;
}

/**
 * Bandeau de consentement aux cookies.
 *
 * Tant qu'aucun choix n'a été enregistré, seuls les cookies strictement
 * nécessaires au fonctionnement du site sont actifs : Google Analytics ne se
 * charge qu'après un « Tout accepter » ou une case cochée dans « Personnaliser ».
 * Voir `GoogleAnalytics.tsx`, qui écoute `COOKIE_CONSENT_EVENT`.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const existing = readCookieConsent();
    if (!existing) {
      setVisible(true);
    } else {
      setAnalyticsChoice(existing.analytics);
    }

    const openHandler = () => {
      const current = readCookieConsent();
      setAnalyticsChoice(current?.analytics ?? false);
      setExpanded(true);
      setVisible(true);
    };
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, openHandler);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, openHandler);
  }, []);

  const save = (analytics: boolean) => {
    const previous = readCookieConsent();
    writeCookieConsent(analytics);
    setVisible(false);
    setExpanded(false);
    // Un retrait de consentement après chargement effectif de Google Analytics
    // ne peut pas décharger proprement le script déjà exécuté : on recharge la
    // page pour repartir sans lui.
    if (previous && previous.analytics && !analytics) {
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Préférences de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10 p-5 sm:p-6">
        {/* <div> et non <p> : la charte impose la taille des <p> du site. Le bandeau apparaît après
            l'hydratation ; plus grand que le texte d'en-tête, il deviendrait l'élément LCP de la page. */}
        <div className="text-[13px] sm:text-sm text-stone-700 leading-relaxed">
          Ce site utilise des cookies strictement nécessaires à son fonctionnement.
          Avec votre accord, il peut aussi utiliser Google Analytics pour mesurer
          la fréquentation du site. Vous pouvez accepter, refuser, ou personnaliser
          votre choix à tout moment — voir notre{' '}
          <Link href="/politique-cookies" className="underline hover:text-sage">
            politique de cookies
          </Link>
          .
        </div>

        {expanded && (
          <div className="mt-4 border-t border-stone-100 pt-4 space-y-3">
            <label className="flex items-start gap-3 text-sm text-stone-700">
              <input type="checkbox" checked disabled className="mt-1 accent-sage" />
              <span>
                <strong className="font-medium">Cookies nécessaires</strong> — toujours actifs,
                indispensables au fonctionnement du site (navigation, sécurité).
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={analyticsChoice}
                onChange={(e) => setAnalyticsChoice(e.target.checked)}
                className="mt-1 accent-sage"
              />
              <span>
                <strong className="font-medium">Mesure d'audience</strong> — Google Analytics,
                pour comprendre quelles pages sont consultées.
              </span>
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!expanded && (
            <>
              <button
                type="button"
                onClick={() => save(true)}
                className="rounded-lg bg-accent px-5 h-10 text-sm font-semibold text-accent-fg hover:bg-accent-hover transition-colors cursor-pointer"
              >
                Tout accepter
              </button>
              <button
                type="button"
                onClick={() => save(false)}
                className="rounded-lg border border-stone-300 px-5 h-10 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm text-stone-500 underline hover:text-stone-700 cursor-pointer"
              >
                Personnaliser
              </button>
            </>
          )}
          {expanded && (
            <button
              type="button"
              onClick={() => save(analyticsChoice)}
              className="rounded-lg bg-accent px-5 h-10 text-sm font-semibold text-accent-fg hover:bg-accent-hover transition-colors cursor-pointer"
            >
              Enregistrer mes choix
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
