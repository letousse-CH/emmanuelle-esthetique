export const revalidate = 60;
import React from 'react';
import { getPageMeta, buildMetadata } from '../../services/pageMeta';
import { fetchHomePage } from '../../services/homePage';
import BlockPage from '../../components/blocks/BlockPage';
import { SITE_CONFIG } from '../../config/site';

const SLUG = 'home';
const DEFAULTS = {
  title: SITE_CONFIG.seoDefaults.title || "Solution Clé en Main Tout-en-Un | Site, Caisse & Commandes Vocales",
  description: SITE_CONFIG.seoDefaults.description || "Plateforme clé en main complète pour indépendants, thérapeutes et prestataires : site web, caisse conforme droit suisse, CRM clients et commandes vocales.",
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
  const { page } = await fetchHomePage();
  if (!page) {
    return (
      <div className="py-32 text-center text-stone-500">
        <p className="font-serif text-2xl">La page d&apos;accueil n&apos;existe pas encore.</p>
        <p className="mt-3 text-sm">Créez une page avec le slug « home » depuis l&apos;admin.</p>
      </div>
    );
  }
  return <BlockPage page={page} />;
}
