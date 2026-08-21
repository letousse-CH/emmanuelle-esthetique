export const revalidate = 60;
import React from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '../../../services/supabase';
import { fetchPageBySlug } from '../../../services/dynamicPages';
import DynamicPageClient from '../../../components/pagebuilder/DynamicPageClient';
import PageChrome from '../../../components/PageChrome';

import { getPageMeta, buildMetadata } from '../../../services/pageMeta';
import { SITE_CONFIG } from '../../../config/site';

export async function generateStaticParams() {
  try {
    const { data: pages } = await supabase
      .from('dynamic_pages')
      .select('slug')
      .eq('published', true);
    return (pages || []).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchPageBySlug(slug, false);
  if (!page) return { title: `Page non trouvée | ${SITE_CONFIG.name}` };

  const defaults = {
    title: `${page.title} | ${SITE_CONFIG.name}`,
    description: SITE_CONFIG.seoDefaults.description,
    og_title: `${page.title} | ${SITE_CONFIG.name}`,
    og_description: SITE_CONFIG.seoDefaults.ogDescription,
    og_image: SITE_CONFIG.seoDefaults.ogImage,
    keywords: SITE_CONFIG.seoDefaults.keywords,
  };

  const meta = await getPageMeta(slug, defaults);
  return buildMetadata(slug, meta, `${SITE_CONFIG.url}/${page.slug}`);
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = await fetchPageBySlug(slug, false);
  // Route attrape-tout : un slug inexistant doit renvoyer un vrai 404
  // (sinon soft-404 indexable). Voir generateMetadata pour le cas null.
  if (!page) notFound();
  return (
    <>
      {page && (!page.show_header || !page.show_footer) && (
        <PageChrome showHeader={page.show_header ?? true} showFooter={page.show_footer ?? true} />
      )}
      <DynamicPageClient initialPage={page} slug={slug} />
    </>
  );
}
