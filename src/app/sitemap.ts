import { MetadataRoute } from 'next';
import { supabase } from '../services/supabase';

import { SITE_CONFIG } from '../config/site';
import { getModuleFlagsServer } from '../config/modules';

export const revalidate = 3600; // Cache for 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = SITE_CONFIG.url;
  const moduleFlags = await getModuleFlagsServer();

  const staticRoutes = [
    { url: '',                    priority: 1.0, changeFrequency: 'weekly' },
    ...(moduleFlags.blog ? [{ url: '/blog',      priority: 0.9, changeFrequency: 'weekly' }] : []),
    ...(moduleFlags.events ? [{ url: '/ateliers', priority: 0.8, changeFrequency: 'weekly' }] : []),
    { url: '/contact',            priority: 0.6, changeFrequency: 'yearly' },
    // /a-propos est inclus automatiquement via les pages dynamiques ci-dessous.
    // /about (legacy) n'est plus émis : redirige en 301.
    { url: '/mentions-legales',   priority: 0.3, changeFrequency: 'yearly' },
  ];

  let blogRoutes: any[] = [];
  let eventRoutes: any[] = [];
  let dynamicPageRoutes: any[] = [];

  try {
    const [{ data: articles }, { data: events }, { data: dynamicPages }] = await Promise.all([
      moduleFlags.blog ? supabase.from('articles').select('slug, updated_at').eq('published', true) : Promise.resolve({ data: null }),
      moduleFlags.events ? supabase.from('events').select('slug, updated_at').eq('status', 'published') : Promise.resolve({ data: null }),
      supabase.from('dynamic_pages').select('slug, updated_at').eq('published', true),
    ]);

    if (articles) {
      blogRoutes = articles.map(a => ({
        url: `/blog/${a.slug}`,
        lastModified: new Date(a.updated_at),
        priority: 0.8,
        changeFrequency: 'weekly',
      }));
    }

    if (events) {
      eventRoutes = events.map(e => ({
        url: `/ateliers/${e.slug}`,
        lastModified: new Date(e.updated_at),
        priority: 0.8,
        changeFrequency: 'weekly',
      }));
    }

    if (dynamicPages) {
      // Les pages dynamiques sont servies à la racine (/{slug}) via la route
      // attrape-tout [slug]. On exclut uniquement les slugs déjà couverts par
      // les routes statiques ci-dessus pour éviter un double listing.
      const staticCoveredSlugs = ['home', 'mentions-legales'];
      dynamicPageRoutes = dynamicPages
        .filter(p => !staticCoveredSlugs.includes(p.slug))
        .map(p => ({
          url: `/${p.slug}`,
          lastModified: new Date(p.updated_at),
          priority: 0.7,
          changeFrequency: 'monthly',
        }));
    }
  } catch (err) {
    console.error('Error generating dynamic sitemap routes:', err);
  }

  const allRoutes = [
    ...staticRoutes.map(r => ({
      url: `${BASE_URL}${r.url}`,
      lastModified: new Date(),
      priority: r.priority,
      changeFrequency: r.changeFrequency as any,
    })),
    ...blogRoutes.map(r => ({
      url: `${BASE_URL}${r.url}`,
      lastModified: r.lastModified,
      priority: r.priority,
      changeFrequency: r.changeFrequency,
    })),
    ...eventRoutes.map(r => ({
      url: `${BASE_URL}${r.url}`,
      lastModified: r.lastModified,
      priority: r.priority,
      changeFrequency: r.changeFrequency,
    })),
    ...dynamicPageRoutes.map(r => ({
      url: `${BASE_URL}${r.url}`,
      lastModified: r.lastModified,
      priority: r.priority,
      changeFrequency: r.changeFrequency,
    })),
  ];

  return allRoutes;
}
