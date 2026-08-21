export const revalidate = 60;
import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '../../../../services/supabase';
import { SdeEvent } from '../../../../types/events';
import { isModuleEnabledServer } from '../../../../config/modules';
import EventDetailClient from './EventDetailClient';
import { SITE_CONFIG } from '../../../../config/site';

async function getEvent(slug: string): Promise<SdeEvent | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return null;
    return data as SdeEvent;
  } catch (err) {
    console.error('Error fetching event details on server:', err);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const { data: events } = await supabase
      .from('events')
      .select('slug')
      .eq('status', 'published');
    return (events || []).map((e) => ({
      slug: e.slug,
    }));
  } catch (err) {
    console.error('Error generating event static params:', err);
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return {
      title: `Atelier non trouvé | ${SITE_CONFIG.name}`,
    };
  }

  const title = event.meta_title || `${event.title} | ${SITE_CONFIG.name}`;
  const description = event.meta_description || event.excerpt || `Atelier animé par ${SITE_CONFIG.owner}`;

  return {
    title,
    description,
    ...(event.meta_keywords ? { keywords: event.meta_keywords } : {}),
    alternates: {
      canonical: `${SITE_CONFIG.url}/ateliers/${event.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_CONFIG.url}/ateliers/${event.slug}`,
      type: "website" as const,
      images: [
        {
          url: event.image_url || SITE_CONFIG.seoDefaults.ogImage,
          alt: `${event.title} — ${SITE_CONFIG.name}`,
        }
      ]
    }
  };
}

export default async function AteliersDetailPage({ params }: PageProps) {
  if (!(await isModuleEnabledServer('events'))) {
    notFound();
  }

  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "description": event.excerpt || event.title,
    "url": `${SITE_CONFIG.url}/ateliers/${event.slug}`,
    ...(event.image_url ? { "image": event.image_url } : {}),
    "startDate": event.date_start
      ? `${event.date_start}${event.time_start ? `T${event.time_start}` : ''}`
      : undefined,
    ...(event.date_end ? { "endDate": `${event.date_end}${event.time_end ? `T${event.time_end}` : ''}` } : {}),
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": event.is_online
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    "location": event.is_online
      ? { "@type": "VirtualLocation", "url": event.visio_url || `${SITE_CONFIG.url}/ateliers/${event.slug}` }
      : {
          "@type": "Place",
          "name": event.location,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": event.address || event.location,
            "addressCountry": "CH"
          }
        },
    "organizer": {
      "@type": "Person",
      "@id": `${SITE_CONFIG.url}/#owner`,
      "name": SITE_CONFIG.owner
    },
    "offers": {
      "@type": "Offer",
      "price": event.price_chf === 0 ? "0" : String(event.price_chf),
      "priceCurrency": "CHF",
      "availability": "https://schema.org/InStock",
      "url": `${SITE_CONFIG.url}/ateliers/${event.slug}`
    },
    ...(event.max_participants ? { "maximumAttendeeCapacity": event.max_participants } : {})
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={
        <div className="min-h-screen pt-20 animate-pulse">
          <div className="h-72 bg-stone-100" />
          <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
            <div className="h-8 bg-stone-100 rounded-full w-2/3" />
            <div className="h-5 bg-stone-100 rounded-full w-1/3" />
          </div>
        </div>
      }>
        <EventDetailClient event={event} />
      </Suspense>
    </>
  );
}
