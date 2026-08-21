export const revalidate = 60;
import React from 'react';
import { getPageMeta, buildMetadata } from '../../services/pageMeta';
import { fetchHomePage } from '../../services/homePage';
import DynamicPageClient from '../../components/pagebuilder/DynamicPageClient';

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
  /*
    Le slug de la page d'accueil se choisit dans /admin/pages. La racine ne
    cherchait que « home » puis « accueil » : une page importée sous un autre
    nom rendait le site introuvable à son adresse principale.
  */
  const { page: cmsPage, slug } = await fetchHomePage();

  return (
    <DynamicPageClient
      initialPage={cmsPage}
      slug={slug}
      forceShow
    />
  );
}

