export const revalidate = 60;
import React from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '../../../services/supabase';
import { SdeEvent } from '../../../types/events';
import { isModuleEnabledServer } from '../../../config/modules';
import EventsClient from './EventsClient';
import { SITE_CONFIG } from '../../../config/site';

const ATELIERS_DESCRIPTION =
  "";

export const metadata = {
  title: `Ateliers | ${SITE_CONFIG.name}`,
  description: ATELIERS_DESCRIPTION,
  keywords: "",
  alternates: {
    canonical: `${SITE_CONFIG.url}/ateliers`,
  },
  openGraph: {
    title: `Ateliers | ${SITE_CONFIG.name}`,
    description: ATELIERS_DESCRIPTION,
    url: `${SITE_CONFIG.url}/ateliers`,
    images: [
      {
        url: SITE_CONFIG.seoDefaults.ogImage,
        alt: `Ateliers ${SITE_CONFIG.name}`,
      }
    ]
  }
};

export default async function AteliersPage() {
  if (!(await isModuleEnabledServer('events'))) {
    notFound();
  }

  let events: SdeEvent[] = [];
  try {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .order('date_start', { ascending: true });
    events = (data || []) as SdeEvent[];
  } catch (err) {
    console.error('Error fetching events on server:', err);
  }

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Ateliers — ${SITE_CONFIG.name}`,
    "description": ATELIERS_DESCRIPTION,
    "url": `${SITE_CONFIG.url}/ateliers`,
    "inLanguage": "fr-CH",
    "organizer": { "@type": "Person", "@id": `${SITE_CONFIG.url}/#owner`, "name": SITE_CONFIG.owner }
  };

  const itemListSchema = events.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": events.map((ev, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Event",
        "name": ev.title,
        "description": ev.excerpt || ev.title,
        "url": `${SITE_CONFIG.url}/ateliers/${ev.slug}`,
        ...(ev.image_url ? { "image": ev.image_url } : {}),
        ...(ev.date_start ? { "startDate": `${ev.date_start}${ev.time_start ? `T${ev.time_start}` : ''}` } : {}),
        ...(ev.date_end ? { "endDate": `${ev.date_end}${ev.time_end ? `T${ev.time_end}` : ''}` } : {}),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": ev.is_online
          ? "https://schema.org/OnlineEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
        "location": ev.is_online
          ? { "@type": "VirtualLocation", "url": `${SITE_CONFIG.url}/ateliers/${ev.slug}` }
          : { "@type": "Place", "name": ev.location, "address": { "@type": "PostalAddress", "streetAddress": ev.address || ev.location, "addressCountry": "CH" } },
        "organizer": { "@type": "Person", "@id": `${SITE_CONFIG.url}/#owner`, "name": SITE_CONFIG.owner },
        "offers": {
          "@type": "Offer",
          "price": ev.price_chf === 0 ? "0" : String(ev.price_chf),
          "priceCurrency": "CHF",
          "availability": "https://schema.org/InStock",
          "url": `${SITE_CONFIG.url}/ateliers/${ev.slug}`
        }
      }
    }))
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <EventsClient initialEvents={events} />
    </>
  );
}
