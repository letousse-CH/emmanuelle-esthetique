"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { COOKIE_CONSENT_EVENT, readCookieConsent, type CookieConsentValue } from './CookieConsent';

interface GoogleAnalyticsProps {
  measurementId?: string;
}

/**
 * Charge gtag.js uniquement si l'ID de mesure est configuré (variable
 * d'environnement `NEXT_PUBLIC_GA_MEASUREMENT_ID`) ET que la visiteuse a
 * accepté la mesure d'audience dans le bandeau de cookies. Tant que l'une des
 * deux conditions manque, aucun script Google ne se charge — donc aucun
 * cookie `_ga` n'est déposé.
 */
export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(readCookieConsent()?.analytics ?? false);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CookieConsentValue>).detail;
      setConsented(!!detail?.analytics);
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handler);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler);
  }, []);

  if (!measurementId || !consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
