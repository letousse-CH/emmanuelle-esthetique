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
    content += `- **Activité** : Institut de beauté et bien-être à domicile — soins du visage, Head Spa, massages relaxants, beauté du regard et ateliers d'auto-soin.\n`;
    content += `- **Professionnelle** : ${SITE_CONFIG.owner}, esthéticienne.\n`;
    content += `- **Localisation** : institut à domicile à Palézieux, canton de Vaud, Suisse.\n`;
    content += `- **Zone de couverture** : Palézieux et sa région (Lavaux-Oron, Broye-Vully, Riviera), canton de Vaud.\n`;
    content += `- **Contact** : uniquement sur rendez-vous, pris via le formulaire de contact du site.\n\n`;

    content += `## Pages Principales\n`;
    content += `- [Accueil](${SITE_CONFIG.url}/) : Présentation de l'institut, des soins, des ateliers et des bons cadeaux.\n`;
    content += `- [Soins](${SITE_CONFIG.url}/soins) : Soins du visage et du corps, Head Spa, massages relaxants et beauté du regard.\n`;
    content += `- [Ateliers](${SITE_CONFIG.url}/ateliers) : Ateliers d'auto-soin en petit comité — Gua Sha, auto-massage du visage, Glowing Face.\n`;
    content += `- [Bon cadeau](${SITE_CONFIG.url}/bon-cadeau) : Bons cadeaux à offrir et produits de soin naturels.\n`;
    content += `- [Blog](${SITE_CONFIG.url}/blog) : Conseils de soin, rituels de beauté et bien-être au quotidien.\n`;
    content += `- [À Propos & Contact](${SITE_CONFIG.url}/a-propos) : Présentation de ${SITE_CONFIG.owner} et prise de rendez-vous.\n`;
    content += `- [Mentions Légales](${SITE_CONFIG.url}/mentions-legales) : Informations juridiques et RGPD.\n\n`;

    if (pages && pages.length > 0) {
      // Filtrer les pages systèmes déjà listées
      const systemSlugs = ['home', 'a-propos', 'soins', 'bon-cadeau', 'mentions-legales', 'ateliers', 'blog'];
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
      content += `## Ateliers à Palézieux (Suisse)\n`;
      events.forEach(e => {
        const dateStr = e.date_start ? new Date(e.date_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à confirmer';
        const loc = e.location || 'Palézieux, Suisse';
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
