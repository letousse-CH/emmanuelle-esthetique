import { supabase } from './supabase';

export interface PageMeta {
  title: string;
  description: string;
  og_title: string;
  og_description: string;
  og_image: string;
  keywords: string;
}

// Pages dont les réglages SEO ont été enregistrés sans le préfixe "pages_"
// (des clés `seo_contact_*` et `seo_mentions-legales_*` existent en base).
// Toute autre page dynamique passe par le préfixe "pages_".
// Source de vérité unique — l'éditeur admin (PageBuilderClient) importe cette
// même fonction pour écrire au même endroit que celui-ci lit.
const LEGACY_SLUGS = ['home', 'contact', 'mentions-legales'];

export function getSeoPrefix(slug: string): string {
  if (!slug) return '';
  if (slug === 'home') return 'seo_home';
  if (LEGACY_SLUGS.includes(slug)) return `seo_${slug}`;
  // Slug imbriqué (« soins/visage ») : la clé de réglage n'a pas de « / ».
  return `seo_pages_${slug.replace(/\//g, '_')}`;
}

export async function getPageMeta(slug: string, defaults: Partial<PageMeta>): Promise<PageMeta> {
  const fields: (keyof PageMeta)[] = ['title', 'description', 'og_title', 'og_description', 'og_image', 'keywords'];
  const prefix = getSeoPrefix(slug);
  const keys = fields.map(f => `${prefix}_${f}`);

  try {
    const { data } = await supabase.from('settings').select('key, value').in('key', keys);
    const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    return Object.fromEntries(
      fields.map(f => [f, map.get(`${prefix}_${f}`) || defaults[f] || ''])
    ) as unknown as PageMeta;
  } catch {
    return Object.fromEntries(fields.map(f => [f, defaults[f] || ''])) as unknown as PageMeta;
  }
}

export function buildMetadata(_slug: string, meta: PageMeta, canonical: string) {
  return {
    ...(meta.title       ? { title: meta.title }             : {}),
    ...(meta.description ? { description: meta.description } : {}),
    // Pas de <meta name="keywords"> : Google l'ignore, et la liste exposait la
    // stratégie de mots-clés du site. Le champ reste enregistré dans l'admin.
    alternates: { canonical },
    openGraph: {
      ...(meta.og_title       || meta.title       ? { title:       meta.og_title       || meta.title }       : {}),
      ...(meta.og_description || meta.description ? { description: meta.og_description || meta.description } : {}),
      url: canonical,
      type: "website" as const,
      ...(meta.og_image ? { images: [{ url: meta.og_image, alt: meta.og_title || meta.title }] } : {}),
    },
  };
}
