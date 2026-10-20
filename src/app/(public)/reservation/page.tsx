import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReservationClient from './ReservationClient';
import { Assurances } from './parts';
import './reservation.css';
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
      <div className="rsv-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/algue.svg" alt="" aria-hidden="true" className="rsv-hero__algue" />
        <div className="rsv-container rsv-hero__inner">
          <div>
            <div className="rsv-eyebrow">Réservation en ligne · Cabine privée</div>
            <h1>Réserver votre soin</h1>
            <div className="rsv-lead">
              {`Composez votre séance, puis choisissez le jour et l’heure qui vous conviennent. ${
                ownerFirstName || 'L’institut'
              } vous confirme ensuite personnellement votre rendez-vous.`}
            </div>
          </div>
          <Assurances ownerFirstName={ownerFirstName} />
        </div>
      </div>
      <Suspense fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-6 h-6 border border-sage border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-sm text-muted">Chargement de la carte des soins…</div>
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

