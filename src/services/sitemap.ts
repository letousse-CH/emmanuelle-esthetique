import { supabase } from './supabase';

const BASE_URL = 'https://semeurdeveil.com';

const STATIC_ROUTES = [
  '',
  '/about',
  '/contact',
  '/mentions-legales',
  '/seance-individuelle',
  '/programme-complet',
  '/blog',
];

export async function generateSitemapXML(): Promise<string> {
  // 1. Fetch all published blog posts
  const { data: articles, error } = await supabase
    .from('articles')
    .select('slug, updated_at')
    .eq('published', true);

  if (error) {
    console.error('Error fetching articles for sitemap:', error);
  }

  const blogRoutes = (articles || []).map(article => ({
    url: `/blog/${article.slug}`,
    lastmod: new Date(article.updated_at || new Date()).toISOString().split('T')[0]
  }));

  const allRoutes = [
    ...STATIC_ROUTES.map(route => ({
      url: route,
      lastmod: new Date().toISOString().split('T')[0]
    })),
    ...blogRoutes
  ];

  // 2. Build the XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(route => `  <url>
    <loc>${BASE_URL}${route.url}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.url === '' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${route.url === '' ? '1.0' : route.url.startsWith('/blog/') ? '0.8' : '0.6'}</priority>
  </url>`)
  .join('\n')}
</urlset>`;

  return xml;
}
