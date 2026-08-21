import * as cheerio from 'cheerio';

import { fetchPublicPage } from '../utils/safeFetch';

/**
 * Découverte des pages d'un site.
 *
 * Deux sources, dans cet ordre :
 *
 *  1. **Le plan de site** (`sitemap.xml`). C'est la source d'autorité : le
 *     propriétaire y déclare lui-même ce qu'il veut voir indexé, avec les
 *     dates de modification. On suit les index de plans de site imbriqués.
 *  2. **Les liens de la page d'accueil**, en repli. Moins fiable — on y trouve
 *     des liens de pagination et des ancres — mais beaucoup de petits sites
 *     n'ont pas de plan de site.
 *
 * Rien n'est téléchargé à ce stade en dehors du plan et de l'accueil : il
 * s'agit seulement de dresser la liste à soumettre à l'utilisateur.
 */

export type PageKind = 'page' | 'article';

export interface DiscoveredPage {
  url: string;
  path: string;
  /** Deviné depuis l'URL, corrigible par l'utilisateur. */
  kind: PageKind;
  title?: string;
  lastmod?: string;
  source: 'sitemap' | 'links';
}

const MAX_PAGES = 150;

/** Segments qui signent un contenu éditorial plutôt qu'une page de site. */
const ARTICLE_HINTS =
  /\/(blog|article|articles|actualite|actualites|actu|news|post|posts|journal|magazine|conseils|ressources)(\/|$)/i;

/** Ce qu'on ne veut jamais importer. */
const EXCLUDED =
  /\.(jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|docx?|xlsx?|css|js|xml|ico)$|\/(wp-admin|wp-json|feed|rss|cart|panier|checkout|compte|account|login|connexion|search|recherche)(\/|$|\?)/i;

function classify(pathname: string): PageKind {
  return ARTICLE_HINTS.test(pathname) ? 'article' : 'page';
}

function normalize(href: string, base: URL): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;      // pas de site tiers
  if (EXCLUDED.test(url.pathname)) return null;
  url.hash = '';
  // Les paramètres de suivi créent des doublons de la même page.
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(
    (p) => url.searchParams.delete(p),
  );
  return url.toString().replace(/\/$/, '') || url.origin;
}

/** Lit un plan de site, en suivant un éventuel index. */
async function fromSitemap(origin: string, depth = 0): Promise<DiscoveredPage[]> {
  if (depth > 1) return [];

  const candidates =
    depth === 0 ? [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`] : [origin];

  for (const candidate of candidates) {
    try {
      const { html } = await fetchPublicPage(candidate);
      const $ = cheerio.load(html, { xmlMode: true });

      // Index de plans : on descend d'un niveau, pas plus.
      const nested = $('sitemap > loc')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean)
        .slice(0, 5);

      if (nested.length) {
        const groups = await Promise.all(nested.map((url) => fromSitemap(url, depth + 1)));
        const merged = groups.flat();
        if (merged.length) return merged;
      }

      const base = new URL(origin);
      const pages = $('url')
        .toArray()
        .map((el): DiscoveredPage | null => {
          const loc = $(el).find('loc').first().text().trim();
          const url = normalize(loc, base);
          if (!url) return null;
          return {
            url,
            path: new URL(url).pathname || '/',
            kind: classify(new URL(url).pathname),
            lastmod: $(el).find('lastmod').first().text().trim() || undefined,
            source: 'sitemap' as const,
          };
        })
        .filter((p): p is DiscoveredPage => p !== null);

      if (pages.length) return pages;
    } catch {
      // Ce candidat n'existe pas : on passe au suivant, sans bruit.
    }
  }
  return [];
}

/** Repli : les liens internes de la page d'accueil. */
async function fromHomepageLinks(origin: string): Promise<DiscoveredPage[]> {
  const { html, url } = await fetchPublicPage(origin);
  const base = new URL(url);
  const $ = cheerio.load(html);

  const seen = new Map<string, DiscoveredPage>();

  $('a[href]').each((_, el) => {
    const normalized = normalize($(el).attr('href') ?? '', base);
    if (!normalized || seen.has(normalized)) return;
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    const pathname = new URL(normalized).pathname || '/';
    seen.set(normalized, {
      url: normalized,
      path: pathname,
      kind: classify(pathname),
      title: label.length > 1 && label.length < 80 ? label : undefined,
      source: 'links',
    });
  });

  return [...seen.values()];
}

export async function discoverPages(rawUrl: string): Promise<{
  origin: string;
  pages: DiscoveredPage[];
  source: 'sitemap' | 'links' | 'none';
}> {
  const { url } = await fetchPublicPage(rawUrl);
  const origin = new URL(url).origin;

  let pages = await fromSitemap(origin);
  let source: 'sitemap' | 'links' | 'none' = pages.length ? 'sitemap' : 'none';

  if (!pages.length) {
    pages = await fromHomepageLinks(origin);
    source = pages.length ? 'links' : 'none';
  }

  // L'accueil doit toujours figurer, et en tête : c'est la page qu'on importe
  // en premier dans l'immense majorité des cas.
  const home = origin.replace(/\/$/, '');
  if (!pages.some((p) => p.url === home)) {
    pages.unshift({
      url: home,
      path: '/',
      kind: 'page',
      title: 'Accueil',
      source: source === 'none' ? 'links' : source,
    });
  }

  const unique = [...new Map(pages.map((p) => [p.url, p])).values()];

  unique.sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    // Les pages avant les articles : c'est la structure du site qu'on veut
    // reprendre d'abord, le contenu éditorial vient ensuite.
    if (a.kind !== b.kind) return a.kind === 'page' ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return { origin, pages: unique.slice(0, MAX_PAGES), source };
}
