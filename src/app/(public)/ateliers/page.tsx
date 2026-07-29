export const revalidate = 60;
import React from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '../../../services/supabase';
import { SdeEvent } from '../../../types/events';
import { isModuleEnabledServer } from '../../../config/modules';
import EventsClient from './EventsClient';

export const metadata = {
  title: "Ateliers & Événements | Au-delà des Chaînes",
  description: "Ateliers collectifs et événements en groupe animés par Matthieu Le Tousse — coach relation toxique & emprise psychologique. Présentiel et visio.",
  keywords: "atelier relation toxique, groupe emprise psychologique, événement coaching Matthieu Le Tousse, sortir d'une relation toxique Suisse",
  alternates: {
    canonical: "https://audeladeschaines.com/ateliers",
  },
  openGraph: {
    title: "Ateliers & Événements | Au-delà des Chaînes — Matthieu Le Tousse",
    description: "Ateliers collectifs et événements animés par Matthieu Le Tousse — coach relation toxique & emprise psychologique. Présentiel et visio.",
    url: "https://audeladeschaines.com/ateliers",
    images: [
      {
        url: "https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1782229256675-Matthieu-Le-Tousse.webp",
        alt: "Ateliers Au-delà des Chaînes — Matthieu Le Tousse",
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
    "name": "Ateliers & Événements — Au-delà des Chaînes",
    "description": "Ateliers collectifs et événements animés par Matthieu Le Tousse — coach relation toxique & emprise psychologique. Présentiel et visio.",
    "url": "https://audeladeschaines.com/ateliers",
    "inLanguage": "fr-CH",
    "organizer": { "@type": "Person", "@id": "https://audeladeschaines.com/#matthieu", "name": "Matthieu Le Tousse" }
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
        "url": `https://audeladeschaines.com/ateliers/${ev.slug}`,
        ...(ev.image_url ? { "image": ev.image_url } : {}),
        ...(ev.date_start ? { "startDate": `${ev.date_start}${ev.time_start ? `T${ev.time_start}` : ''}` } : {}),
        ...(ev.date_end ? { "endDate": `${ev.date_end}${ev.time_end ? `T${ev.time_end}` : ''}` } : {}),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": ev.is_online
          ? "https://schema.org/OnlineEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
        "location": ev.is_online
          ? { "@type": "VirtualLocation", "url": `https://audeladeschaines.com/ateliers/${ev.slug}` }
          : { "@type": "Place", "name": ev.location, "address": { "@type": "PostalAddress", "streetAddress": ev.address || ev.location, "addressCountry": "CH" } },
        "organizer": { "@type": "Person", "@id": "https://audeladeschaines.com/#matthieu", "name": "Matthieu Le Tousse" },
        "offers": {
          "@type": "Offer",
          "price": ev.price_chf === 0 ? "0" : String(ev.price_chf),
          "priceCurrency": "CHF",
          "availability": "https://schema.org/InStock",
          "url": `https://audeladeschaines.com/ateliers/${ev.slug}`
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
