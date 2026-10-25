import { MetadataRoute } from 'next';
import { supabase } from '../services/supabase';

import { SITE_CONFIG } from '../config/site';
import { getModuleFlagsServer } from '../config/modules';

export const revalidate = 3600; // Cache for 1 hour

/*
  `lastmod` = date de dernière modification réelle, jamais la date du rendu :
  une date qui change à chaque déploiement apprend à Google à l'ignorer. Une
  route sans date connue (la réservation, écrite dans le code) n'en a pas.
*/
function parseDate(d: unknown): Date | undefined {
  if (!d) return undefined;
  const date = new Date(d as string);
  return isNaN(date.getTime()) ? undefined : date;
}

function latest(dates: (Date | undefined)[]): Date | undefined {
  const valid = dates.filter((d): d is Date => !!d);
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : undefined;
}

interface Route {
  path: string;
  lastModified?: Date;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = SITE_CONFIG.url;
  const moduleFlags = await getModuleFlagsServer();

  const routes: Route[] = [
    { path: '/reservation', priority: 0.8, changeFrequency: 'monthly' },
  ];

  // La commande de bons en ligne vit sur /bon-cadeau, listée avec les pages dynamiques.

  try {
    const [{ data: articles }, { data: events }, { data: dynamicPages }] = await Promise.all([
      moduleFlags.blog ? supabase.from('articles').select('slug, updated_at').eq('published', true) : Promise.resolve({ data: null }),
      moduleFlags.events ? supabase.from('events').select('slug, updated_at').eq('status', 'published') : Promise.resolve({ data: null }),
      supabase.from('dynamic_pages').select('slug, updated_at').eq('published', true),
    ]);

    // Les pages du page builder, accueil comprise (slug « home » → « / »).
    // Les brouillons de la refonte (`brouillon/…`) ne sont jamais listés.
    for (const p of dynamicPages ?? []) {
      if (!p.slug || p.slug.startsWith('brouillon/')) continue;
      const isHome = p.slug === 'home';
      routes.push({
        path: isHome ? '' : `/${p.slug}`,
        lastModified: parseDate(p.updated_at),
        priority: isHome ? 1.0 : p.slug === 'mentions-legales' ? 0.3 : 0.7,
        changeFrequency: isHome ? 'weekly' : p.slug === 'mentions-legales' ? 'yearly' : 'monthly',
      });
    }

    // Le blog et les ateliers n'entrent dans le sitemap qu'avec au moins un
    // contenu publié : une liste vide n'a rien à faire indexer (et /blog porte
    // alors `noindex`, voir app/(public)/blog/page.tsx).
    if (articles?.length) {
      routes.push({
        path: '/blog',
        lastModified: latest(articles.map((a) => parseDate(a.updated_at))),
        priority: 0.6,
        changeFrequency: 'weekly',
      });
      for (const a of articles) {
        routes.push({ path: `/blog/${a.slug}`, lastModified: parseDate(a.updated_at), priority: 0.6, changeFrequency: 'monthly' });
      }
    }

    if (events?.length) {
      routes.push({
        path: '/ateliers',
        lastModified: latest(events.map((e) => parseDate(e.updated_at))),
        priority: 0.6,
        changeFrequency: 'weekly',
      });
      for (const e of events) {
        routes.push({ path: `/ateliers/${e.slug}`, lastModified: parseDate(e.updated_at), priority: 0.6, changeFrequency: 'weekly' });
      }
    }
  } catch (err) {
    console.error('Error generating dynamic sitemap routes:', err);
  }

  // Pages fixes du code, au cas où aucune page du page builder ne les porte.
  for (const path of ['', '/contact', '/mentions-legales']) {
    if (!routes.some((r) => r.path === path)) {
      routes.push({ path, priority: path === '' ? 1.0 : 0.5, changeFrequency: 'yearly' });
    }
  }

  routes.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));

  return routes.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    ...(r.lastModified ? { lastModified: r.lastModified } : {}),
    priority: r.priority,
    changeFrequency: r.changeFrequency,
  }));
}
