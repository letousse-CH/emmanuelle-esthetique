export const revalidate = 60;
import React from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { supabase } from '../../../services/supabase';
import { fetchPageBySlug } from '../../../services/dynamicPages';
import BlockPage from '../../../components/blocks/BlockPage';
import PageChrome from '../../../components/PageChrome';

import { getPageMeta, buildMetadata } from '../../../services/pageMeta';
import { SITE_CONFIG } from '../../../config/site';
import { LEGACY_REDIRECTS } from '../../../config/legacyRedirects';
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from '../../../utils/pageJsonLd';
import { CARTE } from '../../../constants/carteSoins';
import { getSettingsServer } from '../../../services/settingsServer';

/**
 * Pages dynamiques servies à la racine, sur un ou plusieurs niveaux :
 * `/contact`, `/soins/visage`. Le slug stocké en base est le chemin complet
 * (« soins/visage ») — c'est ce qui donne l'arborescence en silo.
 */
export async function generateStaticParams() {
  try {
    const { data: pages } = await supabase
      .from('dynamic_pages')
      .select('slug')
      .eq('published', true);
    return (pages || []).map((p) => ({ slug: p.slug.split('/') }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

const pathOf = (segments: string[]) => segments.join('/');

export async function generateMetadata({ params }: PageProps) {
  const path = pathOf((await params).slug);
  const page = await fetchPageBySlug(path, false);
  if (!page) return { title: `Page non trouvée | ${SITE_CONFIG.name}` };

  const defaults = {
    title: `${page.title} | ${SITE_CONFIG.name}`,
    description: SITE_CONFIG.seoDefaults.description,
    og_title: `${page.title} | ${SITE_CONFIG.name}`,
    og_description: SITE_CONFIG.seoDefaults.ogDescription,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
    keywords: SITE_CONFIG.seoDefaults.keywords,
  };

  // `page.slug` : le slug réel en base (préfixé `brouillon/` dans l'aperçu local).
  const meta = await getPageMeta(page.slug, defaults);
  return buildMetadata(path, meta, `${SITE_CONFIG.url}/${path}`);
}

export default async function Page({ params }: PageProps) {
  const path = pathOf((await params).slug);
  // `/home` est la même page que `/` : une seule URL canonique.
  if (path === 'home') permanentRedirect('/');
  const page = await fetchPageBySlug(path, false);
  if (!page) {
    // Ancienne URL d'une page retirée : 301 vers son équivalent dans le silo.
    const target = LEGACY_REDIRECTS[path];
    if (target) permanentRedirect(target);
    // Route attrape-tout : un slug inexistant doit renvoyer un vrai 404.
    notFound();
  }

  // Fil d'Ariane : les niveaux intermédiaires (« soins » pour « soins/visage »).
  const segments = path.split('/');
  const parents = (
    await Promise.all(
      segments.slice(0, -1).map(async (_, i) => {
        const parentPath = segments.slice(0, i + 1).join('/');
        const parent = await fetchPageBySlug(parentPath, false);
        return parent ? { name: parent.title, slug: parentPath } : null;
      }),
    )
  ).filter((p): p is { name: string; slug: string } => !!p);

  // Le JSON-LD FAQPage est émis par BlockPage à partir des blocs FAQ.
  const breadcrumbLd = buildBreadcrumbJsonLd({
    slug: path,
    pageTitle: page.title,
    siteUrl: SITE_CONFIG.url,
    parents,
  });

  // Page pilier d'une catégorie de la carte : données `Service` avec prix et zone desservie.
  const category = CARTE.find((c) => c.path === `/${path}`);
  const serviceLd = category
    ? buildServiceJsonLd({
        category,
        siteUrl: SITE_CONFIG.url,
        areaServed: ((await getSettingsServer(['business_area_served'])).business_area_served || 'Palézieux')
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      })
    : null;

  return (
    <>
      {serviceLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
        />
      )}
      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />
      )}
      {(!page.show_header || !page.show_footer) && (
        <PageChrome showHeader={page.show_header ?? true} showFooter={page.show_footer ?? true} />
      )}
      <BlockPage page={page} />
    </>
  );
}
