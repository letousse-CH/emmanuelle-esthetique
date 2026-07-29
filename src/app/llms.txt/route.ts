import { NextResponse } from 'next/server';
import { supabase } from '../../services/supabase';
import { SITE_CONFIG } from '../../config/site';

export const dynamic = 'force-dynamic'; // Toujours à jour en temps réel pour les LLM (GEO SEO)

export async function GET() {
  try {
    // 1. Fetch data from Supabase in parallel
    const [{ data: pages }, { data: articles }, { data: events }] = await Promise.all([
      supabase.from('dynamic_pages').select('title, slug, updated_at').eq('published', true),
      supabase.from('articles').select('title, slug, meta_description, updated_at').eq('published', true).order('created_at', { ascending: false }),
      supabase.from('events').select('title, slug, excerpt, location, date_start').eq('status', 'published').order('date_start', { ascending: true })
    ]);

    // 2. Build the llms.txt content in Markdown
    let content = `# ${SITE_CONFIG.name}\n\n`;
    content += `> ${SITE_CONFIG.seoDefaults.description}\n\n`;

    content += `## Informations Clés & SEO Géo-Localisé (GEO SEO)\n`;
    content += `- **Activité** : Accompagnement de posture, sortie d'emprise psychologique & décodage des personnalités manipulatrices / perverses narcissiques.\n`;
    content += `- **Professionnel** : ${SITE_CONFIG.owner} (ancien Thérapeute & Coach de Posture).\n`;
    content += `- **Localisation principale** : Palézieux, Canton de Vaud, Suisse Romande.\n`;
    content += `- **Zone de couverture** : Présentiel en Suisse Romande (Lausanne, Fribourg, Genève, Vaud) et séances à distance (Visio) pour toute la Francophonie (France, Belgique, Canada).\n`;
    content += `- **Contact** : Réservations sécurisées et sessions stratégiques privées de 30 minutes offertes.\n\n`;

    content += `## Pages Principales\n`;
    content += `- [Accueil](${SITE_CONFIG.url}/) : Présentation de l'accompagnement "Arsenal Tactique", des modules et de l'approche clinique.\n`;
    content += `- [Ateliers & Événements](${SITE_CONFIG.url}/ateliers) : Rencontres régulières, ateliers de groupe et retraites spirituelles à Palézieux.\n`;
    content += `- [Blog](${SITE_CONFIG.url}/blog) : Décryptages comportementaux et analyses cliniques des profils toxiques.\n`;
    content += `- [À Propos & Contact](${SITE_CONFIG.url}/a-propos) : Présentation de Matthieu Le Tousse et prise de contact pour initier un parcours de libération.\n`;
    content += `- [Mentions Légales](${SITE_CONFIG.url}/mentions-legales) : Informations juridiques et RGPD.\n\n`;

    if (pages && pages.length > 0) {
      // Filtrer les pages systèmes déjà listées
      const systemSlugs = ['home', 'a-propos', 'mentions-legales', 'ateliers', 'blog'];
      const customPages = pages.filter(p => !systemSlugs.includes(p.slug));
      
      if (customPages.length > 0) {
        content += `## Pages Thématiques\n`;
        customPages.forEach(p => {
          content += `- [${p.title}](${SITE_CONFIG.url}/${p.slug})\n`;
        });
        content += `\n`;
      }
    }

    if (events && events.length > 0) {
      content += `## Ateliers & Événements à Palézieux (Suisse)\n`;
      events.forEach(e => {
        const dateStr = e.date_start ? new Date(e.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à confirmer';
        const loc = e.location || 'Palézieux, Suisse';
        content += `- [${e.title}](${SITE_CONFIG.url}/ateliers/${e.slug}) : ${e.excerpt || 'Aucun résumé disponible.'} (Date: ${dateStr} | Lieu: ${loc})\n`;
      });
      content += `\n`;
    }

    if (articles && articles.length > 0) {
      content += `## Articles Récents du Blog (Décryptage de l'Emprise)\n`;
      articles.forEach(a => {
        content += `- [${a.title}](${SITE_CONFIG.url}/blog/${a.slug}) : ${a.meta_description || 'Analyse clinique de la manipulation.'}\n`;
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
