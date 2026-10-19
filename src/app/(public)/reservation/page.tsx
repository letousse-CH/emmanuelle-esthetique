import type { Metadata } from 'next';
import { Sparkles } from 'lucide-react';
import ReservationClient from './ReservationClient';
import { getBusinessInfoServer, SITE_CONFIG } from '../../../config/site';
import { getSettingsServer } from '../../../services/settingsServer';
import { buildMetadata, getPageMeta } from '../../../services/pageMeta';
import { buildBreadcrumbJsonLd } from '../../../utils/pageJsonLd';

export const revalidate = 60;

const RESERVATION_SLUG = 'reservation';

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusinessInfoServer();
  const businessName = business.name || SITE_CONFIG.name;

  // « Réserver un soin | Emmanuelle Esthétique, Palézieux » : court (< 60
  // caractères, l'ancien en faisait 75) et sans esperluette.
  const meta = await getPageMeta(RESERVATION_SLUG, {
    title: `Réserver un soin | ${[businessName, business.addressCity].filter(Boolean).join(', ')}`,
    description: `Réservez votre soin du visage Phytomer, rituel corps ou forfait épilation chez ${businessName}. Cabine privée intime, aucun paiement en ligne préalable.`,
    og_title: `Réservation en ligne | ${businessName}`,
    og_description: `Sélectionnez votre créneau pour un soin d'exception dans un cadre marin exclusif.`,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
  });

  return buildMetadata(RESERVATION_SLUG, meta, `${SITE_CONFIG.url}/reservation`);
}

import { Suspense } from 'react';

export default async function ReservationPage() {
  const business = await getBusinessInfoServer();
  const settings = await getSettingsServer(['business_phone', 'business_owner', 'business_name']);
  const ownerFirstName = (settings.business_owner || business.owner || '').trim().split(/\s+/)[0];

  const breadcrumbLd = buildBreadcrumbJsonLd({
    slug: RESERVATION_SLUG,
    pageTitle: 'Réservation de soins',
    siteUrl: SITE_CONFIG.url,
  });

  const reservationActionLd = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: settings.business_name || business.name || SITE_CONFIG.name,
    telephone: settings.business_phone || business.phone,
    url: `${SITE_CONFIG.url}/reservation`,
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.url}/reservation`,
        inLanguage: 'fr-CH',
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: {
        '@type': 'Reservation',
        name: 'Réservation de soin esthétique en cabine privée',
      },
    },
  };

  return (
    <>
      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reservationActionLd) }}
      />
      {/*
        En-tête rendu côté serveur : ReservationClient lit l'URL
        (useSearchParams) et ne s'affiche donc qu'avec JavaScript. Dans le
        composant, le H1 manquait au HTML que lisent les moteurs.
      */}
      <div className="bg-paper text-stone-deep pt-36 sm:pt-44 lg:pt-48 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-sage/10 text-sage border border-sage/20">
            <Sparkles className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
            Cabine Privée · Soins d&apos;Exception
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-stone-deep font-normal tracking-tight">
            Réserver votre soin
          </h1>
          <p className="text-muted max-w-xl mx-auto text-sm sm:text-base font-light leading-relaxed">
            {`Choisissez votre rituel, le jour et la demi-journée qui vous conviennent. ${
              ownerFirstName ? `${ownerFirstName} vous rappelle` : 'Vous êtes rappelée'
            } ensuite pour fixer l’horaire exact.`}
          </p>
        </div>
      </div>
      <Suspense fallback={
        <div className="min-h-[50vh] bg-paper text-stone-deep pb-20 px-4 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted">Chargement de votre espace de réservation...</p>
          </div>
        </div>
      }>
        <ReservationClient
          businessPhone={settings.business_phone || business.phone}
          businessOwner={settings.business_owner || business.owner}
        />
      </Suspense>
    </>
  );
}

