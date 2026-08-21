import { NextResponse } from 'next/server';
import { supabase } from '../../services/supabase';
import { SITE_CONFIG, getBusinessInfoServer } from '../../config/site';
import { getSettingsServer } from '../../services/settingsServer';

export const dynamic = 'force-dynamic'; // Toujours à jour en temps réel pour les LLM (GEO SEO)

export async function GET() {
  try {
    // 1. Fetch data from Supabase in parallel
    const [{ data: pages }, { data: articles }, { data: events }] = await Promise.all([
      supabase.from('dynamic_pages').select('title, slug, updated_at').eq('published', true),
      supabase.from('articles').select('title, slug, meta_description, updated_at').eq('published', true).order('created_at', { ascending: false }),
      supabase.from('events').select('title, slug, excerpt, location, date_start').eq('status', 'published').order('date_start', { ascending: true })
    ]);

    // 2. Construction du Markdown
    //
    // Rien n'est écrit en dur sur l'activité : tout vient des réglages et du
    // contenu réellement publié. Une description de métier figée ici suivrait
    // le template d'une installation à l'autre et décrirait le mauvais client.
    const business = await getBusinessInfoServer();
    const editorial = await getSettingsServer(['site_activity_context', 'site_description']);

    const siteName = business.name || SITE_CONFIG.name;
    const summary = editorial.site_activity_context || editorial.site_description || '';

    let content = `# ${siteName}\n\n`;
    if (summary) content += `> ${summary}\n\n`;

    content += `## Informations\n`;
    if (business.owner) content += `- **Responsable** : ${business.owner}\n`;
    if (business.addressCity) {
      const place = [business.addressCity, business.addressRegion, business.addressCountry]
        .filter(Boolean)
        .join(', ');
      content += `- **Localisation** : ${place}\n`;
    }
    if (business.email) content += `- **Contact** : ${business.email}\n`;
    content += `\n`;

    if (pages && pages.length > 0) {
      // On liste les pages réellement publiées : la liste figée d'un site
      // précédent masquerait les pages du site courant.
      const customPages = pages.filter(p => p.slug !== 'home');

      if (customPages.length > 0) {
        content += `## Pages\n`;
        customPages.forEach(p => {
          content += `- [${p.title}](${SITE_CONFIG.url}/${p.slug})\n`;
        });
        content += `\n`;
      }
    }

    if (events && events.length > 0) {
      content += `## Ateliers\n`;
      events.forEach(e => {
        const dateStr = e.date_start ? new Date(e.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à confirmer';
        const loc = e.location || '';
        content += `- [${e.title}](${SITE_CONFIG.url}/ateliers/${e.slug}) : ${e.excerpt || 'Aucun résumé disponible.'} (Date: ${dateStr} | Lieu: ${loc})\n`;
      });
      content += `\n`;
    }

    if (articles && articles.length > 0) {
      content += `## Articles Récents du Blog\n`;
      articles.forEach(a => {
        content += `- [${a.title}](${SITE_CONFIG.url}/blog/${a.slug}) : ${a.meta_description || 'Conseils de soin et de bien-être.'}\n`;
      });
      content += `\n`;
    }

    // Return the response with text/plain content type
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: any) {
    console.error('[llms.txt] Error generating file:', err);
    return new Response('Error generating llms.txt', { status: 500 });
  }
}
