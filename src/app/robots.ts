import { MetadataRoute } from 'next';
import { SITE_CONFIG } from '../config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Crawlers classiques + bots IA de recherche conversationnelle.
      // Objectif GEO : maximiser les chances d'être crawlé puis cité par
      // Perplexity, ChatGPT Search, Gemini, Claude. Tout est autorisé sauf
      // l'admin, le login et les routes API (inutiles à indexer).
      {
        userAgent: [
          '*',
          'Googlebot',
          'Bingbot',
          'Google-Extended',          // Gemini / Vertex
          'GPTBot',                   // OpenAI (entraînement)
          'OAI-SearchBot',            // OpenAI (ChatGPT Search)
          'ChatGPT-User',             // OpenAI (navigation à la demande)
          'ClaudeBot',                // Anthropic (entraînement)
          'Claude-Web',               // Anthropic (navigation)
          'PerplexityBot',            // Perplexity (index)
          'Perplexity-User',          // Perplexity (navigation à la demande)
          'Applebot-Extended',        // Apple Intelligence
        ],
        allow: '/',
        disallow: ['/admin/', '/login', '/api/'],
      },
    ],
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
