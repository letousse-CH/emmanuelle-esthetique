import Script from 'next/script';

/**
 * Charge gtag.js (GA4 direct, sans conteneur GTM) uniquement si un
 * Measurement ID est configuré (NEXT_PUBLIC_GA_MEASUREMENT_ID). Ne rend rien
 * tant que la variable n'existe pas — pas de script cassé à moitié configuré.
 *
 * Rappel légal : GA4 pose des cookies non essentiels. Il faut un bandeau de
 * consentement (RGPD/nLPD) avant de l'activer en production — pas encore
 * mis en place ici.
 */
export default function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
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
