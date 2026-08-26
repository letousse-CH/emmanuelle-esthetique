export const revalidate = 60;
import React from 'react';
import { getPageMeta, buildMetadata } from '../../services/pageMeta';
import { fetchHomePage } from '../../services/homePage';
import DynamicPageClient from '../../components/pagebuilder/DynamicPageClient';
import DynamicPageRenderer from '../../components/pagebuilder/DynamicPageRenderer';
import type { PageSection } from '../../components/pagebuilder/wireframes.config';
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

const FALLBACK_SECTIONS: PageSection[] = [
  {
    type: "hero_turnkey_voice",
    data: {
      theme: "light",
      eyebrow: "Solution Clé en Main Tout-en-Un & Commandes Vocales",
      title: "Votre Activité Déployée & Pilotée en Toute Simplicité",
      title_highlight: "Même à la Voix, Sans Rien Taper au Clavier.",
      description: "Découvrez la solution clé en main complète conçue pour vous faciliter la vie d'un point de vue pratique et efficace : site web dynamique, caisse conforme au droit suisse, fichier clients, réservations et assistant IA réactif à votre voix.",
      cta_primary_text: "Explorer les Outils Admin",
      cta_primary_href: "#maquettes",
      cta_secondary_text: "Demander une Démonstration",
      cta_secondary_href: "/contact",
    }
  },
  {
    type: "client_needs_matrix",
    data: { theme: "surface" }
  },
  {
    type: "voice_showcase_1",
    data: { theme: "light" }
  },
  {
    type: "admin_mockups_gallery",
    data: { theme: "surface" }
  },
  {
    type: "turnkey_bento_grid",
    data: { theme: "light" }
  },
  {
    type: "turnkey_offer_pricing",
    data: { theme: "surface" }
  },
  {
    type: "turnkey_faq_accordion",
    data: { theme: "light" }
  }
];

export async function generateMetadata() {
  const meta = await getPageMeta(SLUG, DEFAULTS);
  return buildMetadata(SLUG, meta, `${SITE_CONFIG.url}/`);
}

export default async function Page() {
  const { page: cmsPage, slug } = await fetchHomePage();

  return (
    <DynamicPageClient
      initialPage={cmsPage}
      slug={slug}
      forceShow
      fallback={<DynamicPageRenderer sections={FALLBACK_SECTIONS} />}
    />
  );
}

