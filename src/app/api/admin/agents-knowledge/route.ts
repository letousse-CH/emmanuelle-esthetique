import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { supabase as publicSupabase } from '../../../../services/supabase';

export const runtime = 'nodejs';

function stripToText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') {
    return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }
  if (Array.isArray(content)) {
    return content.map(stripToText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof content === 'object') {
    const keysToSkip = new Set(['theme', 'id', 'type', 'image_url', 'image_alt', 'cta_primary_href', 'cta_secondary_href', 'image_opacity']);
    const parts: string[] = [];
    for (const [key, val] of Object.entries(content as Record<string, unknown>)) {
      if (keysToSkip.has(key)) continue;
      const text = stripToText(val);
      if (text) parts.push(text);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function extractPageContent(page: { title: string; slug: string; content?: unknown; sections?: unknown }): string {
  const parts: string[] = [];

  // Découpage fluide des blocs visuels (sections)
  if (Array.isArray(page.sections) && page.sections.length > 0) {
    for (const section of page.sections as Array<{ type?: string; data?: Record<string, unknown> }>) {
      const data = section.data || {};
      const sectionTextParts: string[] = [];

      if (data.eyebrow) sectionTextParts.push(`• Accroche : ${data.eyebrow}`);
      if (data.title) sectionTextParts.push(`• Titre : ${data.title}`);
      if (data.title_italic) sectionTextParts.push(`• Sous-titre : ${data.title_italic}`);
      if (data.description) sectionTextParts.push(`• Description : ${data.description}`);
      if (data.content) sectionTextParts.push(`• Contenu : ${stripToText(data.content)}`);

      // Éléments de listes (services, prestations, FAQ)
      if (Array.isArray(data.items)) {
        const itemTexts = data.items.map((it) => {
          if (typeof it === 'string') return it;
          if (it && typeof it === 'object') return stripToText(it);
          return '';
        }).filter(Boolean);
        if (itemTexts.length > 0) {
          sectionTextParts.push(`• Prestations & Services retenus :\n  - ${itemTexts.join('\n  - ')}`);
        }
      }

      // Autre texte pertinent
      for (const [k, v] of Object.entries(data)) {
        if (['theme', 'id', 'type', 'title', 'title_italic', 'description', 'eyebrow', 'content', 'items', 'image_url', 'image_alt', 'cta_primary_href', 'cta_secondary_href', 'image_opacity'].includes(k)) continue;
        const txt = stripToText(v);
        if (txt) sectionTextParts.push(`• ${k} : ${txt}`);
      }

      if (sectionTextParts.length > 0) {
        parts.push(sectionTextParts.join('\n'));
      }
    }
  }

  // Contenu textuel principal
  const rawContent = stripToText(page.content);
  if (rawContent) {
    parts.push(`• Texte principal de la page :\n${rawContent}`);
  }

  const cleanBody = parts.join('\n\n').trim();

  const emptyExplanation = [
    `Cette page existe sur votre site mais ne contient pas encore de texte rédigé dans le PageBuilder.`,
    ``,
    `L'agent a retenu uniquement ses références :`,
    `- Titre de la page : "${page.title}"`,
    `- Adresse URL : /${page.slug}`,
    ``,
    `💡 Astuce : Vous pouvez cliquer sur "✏️ Éditer / Compléter le texte" ci-dessous pour rédiger les informations exactes (tarifs, horaires, prestations) que vous souhaitez transmettre à vos visiteurs !`,
  ].join('\n');

  return `INFORMATIONS RETENUES POUR LA PAGE : ${page.title.toUpperCase()} (URL: /${page.slug})\n\n${cleanBody || emptyExplanation}`;
}

export async function GET(req: NextRequest) {
  const admin = getSupabaseAdmin() || publicSupabase;
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json({ error: 'agentId requis' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('agent_documents')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[agents-knowledge] GET error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin() || publicSupabase;
  let body: { action?: string; agentId?: string; docId?: string; title?: string; content?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { action, agentId, docId, title, content } = body;

  if (action === 'delete' && docId) {
    const { error } = await admin.from('agent_documents').delete().eq('id', docId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'add' && agentId && title && content) {
    const sourceRef = title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { error } = await admin.from('agent_documents').upsert(
      {
        agent_id: agentId,
        title,
        content,
        source_type: 'texte',
        source_ref: sourceRef,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id,source_type,source_ref' },
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'reindex' && agentId) {
    // 1. Purger les anciens documents automatiques (pages, articles, brief-editorial)
    await admin
      .from('agent_documents')
      .delete()
      .eq('agent_id', agentId)
      .or('source_type.in.(page,article),source_ref.eq.brief-editorial');

    // 2. Récupération des données Supabase (dynamic_pages, articles, settings)
    let [pagesRes, articlesRes, settingsRes] = await Promise.all([
      admin.from('dynamic_pages').select('slug, title, content, sections'),
      admin.from('articles').select('slug, title, content'),
      admin.from('settings').select('key, value').in('key', [
        'site_activity_context',
        'site_target_persona',
        'site_tone_of_voice',
        'site_brand_tone',
        'site_blog_topics',
        'site_address_mode',
        'business_name',
        'business_job_title',
        'business_email',
        'business_phone',
        'business_address_city',
      ]),
    ]);

    // 3. Auto-seeder les pages fondamentales si dynamic_pages est vide
    if (!pagesRes.data || pagesRes.data.length === 0) {
      const DEFAULT_SEEDS = [
        {
          title: 'Accueil',
          slug: 'home',
          published: true,
          sections: [
            { type: 'hero_1', data: { title: 'Bienvenue sur notre site', description: 'Présentation générale de notre entreprise et de nos services.' } },
            { type: 'features_1', data: { title: 'Nos prestations & services', items: ['Création sur-mesure', 'Accompagnement dédié', 'Conseil & Expertise'] } },
            { type: 'cta_1', data: { title: 'Contactez-nous pour toute information' } },
          ],
        },
        {
          title: 'À propos',
          slug: 'a-propos',
          published: true,
          sections: [
            { type: 'hero_2', data: { title: 'À propos de notre entreprise', description: 'Notre savoir-faire, nos engagements et notre histoire.' } },
          ],
        },
        {
          title: 'Contact',
          slug: 'contact',
          published: true,
          sections: [
            { type: 'hero_2', data: { title: 'Nous contacter', description: 'Coordonnées directes, accès et formulaire de contact.' } },
          ],
        },
      ];

      await admin.from('dynamic_pages').upsert(DEFAULT_SEEDS, { onConflict: 'slug' });
      pagesRes = await admin.from('dynamic_pages').select('slug, title, content, sections');
    }

    // 4. Rassembler toutes les pages du site (dynamic_pages + routes fondamentales)
    const pagesMap = new Map<string, { slug: string; title: string; content?: unknown; sections?: unknown }>();

    // Pages fondamentales garanties du site
    const keyRoutes = [
      { slug: 'home', title: 'Accueil' },
      { slug: 'contact', title: 'Contact' },
      { slug: 'mentions-legales', title: 'Mentions Légales' },
    ];
    for (const kr of keyRoutes) {
      pagesMap.set(kr.slug, { slug: kr.slug, title: kr.title, content: `Page ${kr.title} du site.` });
    }

    // Remplacer / compléter par le contenu réel de Supabase dynamic_pages
    for (const p of pagesRes.data ?? []) {
      if (p.slug) {
        pagesMap.set(p.slug, p);
      }
    }

    const allPages = Array.from(pagesMap.values());

    // 5. Formattage du Brief Éditorial
    const settingsMap: Record<string, string> = {};
    if (settingsRes.data) {
      for (const item of settingsRes.data) {
        if (item.value) settingsMap[item.key] = item.value.trim();
      }
    }

    const briefSections: string[] = [];
    if (settingsMap.business_name) {
      briefSections.push(`NOM DE L'ENTREPRISE : ${settingsMap.business_name}${settingsMap.business_job_title ? ` (${settingsMap.business_job_title})` : ''}`);
    }
    if (settingsMap.site_activity_context) {
      briefSections.push(`ACTIVITÉ & CONTEXTE MÉTIER :\n${settingsMap.site_activity_context}`);
    }
    if (settingsMap.site_target_persona) {
      briefSections.push(`CLIENTÈLE CIBLE & PERSONA :\n${settingsMap.site_target_persona}`);
    }
    if (settingsMap.site_address_mode) {
      const isTu = settingsMap.site_address_mode === 'tutoiement';
      briefSections.push(`STYLE & FORMULE D'ADRESSE : Imposer strictement le ${isTu ? 'TUTOIEMENT (utiliser "tu", "ton", "ta")' : 'VOUVOIEMENT (utiliser "vous", "votre", "vos")'} avec le visiteur.`);
    }
    if (settingsMap.site_tone_of_voice) {
      briefSections.push(`TON DE VOIX & STYLE :\n${settingsMap.site_tone_of_voice}`);
    }
    if (settingsMap.site_brand_tone) {
      briefSections.push(`CHARTE DE MARQUE, VALEURS & PROMESSES :\n${settingsMap.site_brand_tone}`);
    }
    if (settingsMap.site_blog_topics) {
      briefSections.push(`THÉMATIQUES & DOMAINES D'EXPERTISE :\n${settingsMap.site_blog_topics}`);
    }
    const contacts = [
      settingsMap.business_phone ? `Tél: ${settingsMap.business_phone}` : null,
      settingsMap.business_email ? `Email: ${settingsMap.business_email}` : null,
      settingsMap.business_address_city ? `Ville: ${settingsMap.business_address_city}` : null,
    ].filter(Boolean);
    if (contacts.length > 0) {
      briefSections.push(`CONTACT & COORDONNÉES :\n${contacts.join(' | ')}`);
    }

    const briefContent = briefSections.join('\n\n');

    // 6. Génération des lignes de savoir
    const rows = [
      ...(briefContent ? [{
        agent_id: agentId,
        title: 'Brief Éditorial & Identité de Marque',
        source_type: 'texte' as const,
        source_ref: 'brief-editorial',
        content: briefContent,
        updated_at: new Date().toISOString(),
      }] : []),
      ...allPages.map((p) => {
        const fullText = extractPageContent(p);
        return {
          agent_id: agentId,
          title: `Page : ${p.title}`,
          source_type: 'page' as const,
          source_ref: p.slug || 'page',
          content: fullText,
          updated_at: new Date().toISOString(),
        };
      }),
      ...(articlesRes.data ?? []).map((a: { slug: string; title: string; content: unknown }) => ({
        agent_id: agentId,
        title: `Article : ${a.title}`,
        source_type: 'article' as const,
        source_ref: a.slug || 'article',
        content: `ARTICLE DE BLOG : ${a.title} (URL: /blog/${a.slug})\n${stripToText(a.content)}`,
        updated_at: new Date().toISOString(),
      })),
    ].filter((row) => row.content.trim().length > 0);

    // Insertion directe sécurisée
    const { error: insertErr } = await admin
      .from('agent_documents')
      .insert(rows);

    if (insertErr) {
      console.error('[agents-knowledge] reindex insert error:', insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { data: updatedDocs } = await admin
      .from('agent_documents')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ success: true, count: rows.length, documents: updatedDocs ?? [] });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
