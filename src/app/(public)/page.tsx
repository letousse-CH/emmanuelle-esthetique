export const revalidate = 60;
import React from 'react';
import { getPageMeta, buildMetadata } from '../../services/pageMeta';
import { fetchPageBySlug } from '../../services/dynamicPages';
import DynamicPageClient from './pages/[slug]/DynamicPageClient';

import { SITE_CONFIG } from '../../config/site';

const SLUG = 'home';
const DEFAULTS = {
  title: SITE_CONFIG.seoDefaults.title,
  description: SITE_CONFIG.seoDefaults.description,
  og_title: SITE_CONFIG.seoDefaults.ogTitle,
  og_description: SITE_CONFIG.seoDefaults.ogDescription,
  og_image: SITE_CONFIG.seoDefaults.ogImage,
  keywords: SITE_CONFIG.seoDefaults.keywords,
};

export async function generateMetadata() {
  const meta = await getPageMeta(SLUG, DEFAULTS);
  return buildMetadata(SLUG, meta, `${SITE_CONFIG.url}/`);
}

export default async function Page() {
  // Fetch CMS page regardless of published status so the builder page always takes priority
  let cmsPage = await fetchPageBySlug(SLUG, true);
  if (!cmsPage) {
    cmsPage = await fetchPageBySlug('accueil', true);
  }

  return (
    <DynamicPageClient
      initialPage={cmsPage}
      slug={SLUG}
      forceShow
    />
  );
}

