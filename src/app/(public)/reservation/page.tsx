import type { Metadata } from 'next';
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

  const meta = await getPageMeta(RESERVATION_SLUG, {
    title: `Réservation en ligne — Soins Phytomer & Cabine Privée | ${businessName}`,
    description: `Réservez votre soin du visage Phytomer, rituel corps ou forfait épilation chez ${businessName}. Cabine privée intime, aucun paiement en ligne préalable.`,
    og_title: `Réservation en ligne | ${businessName}`,
    og_description: `Sélectionnez votre créneau pour un soin d'exception dans un cadre marin exclusif.`,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
    keywords: 'réservation esthétique, soin visage phytomer, massage relaxant, institut beauté genève, cabine privée',
  });

  return buildMetadata(RESERVATION_SLUG, meta, `${SITE_CONFIG.url}/reservation`);
}

import { Suspense } from 'react';

export default async function ReservationPage() {
  const business = await getBusinessInfoServer();
  const settings = await getSettingsServer(['business_phone', 'business_owner', 'business_name']);

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
      <Suspense fallback={
        <div className="min-h-screen bg-paper text-stone-deep pt-36 sm:pt-44 lg:pt-48 pb-20 px-4 flex items-center justify-center">
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

