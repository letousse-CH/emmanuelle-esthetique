import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';
import { getSettingsServer } from '../../../../services/settingsServer';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { supabase } from '../../../../services/supabase';
import { SECTION_META, type SectionTypeName } from '../../../../components/pagebuilder/sectionMeta';
import { isModuleEnabledServer } from '../../../../config/modules';

export const runtime = 'nodejs';

const STYLE_FIELDS = [
  'bg_image',
  'bg_image_opacity',
  'bg_image_position',
  'bg_color',
  'density',
  'width',
  'align',
  'animation',
];

const AVAILABLE_TYPES = Object.keys(SECTION_META) as SectionTypeName[];

function sectionMenu(): string {
  return AVAILABLE_TYPES.map((type, i) => {
    const meta = SECTION_META[type];
    const fields = Object.entries(meta.dataSchema)
      .filter(([field]) => !STYLE_FIELDS.includes(field))
      .map(([field, shape]) => `${field}: ${shape}`)
      .join(', ');
    return `${i + 1}. ${type} — ${meta.description}\n   { ${fields} }`;
  }).join('\n');
}

// Niche-specific curated Unsplash HD image pools to strictly prevent mismatched photos!
const NICHE_IMAGE_POOLS = {
  web_digital: [
    { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80', title: 'Développement web et statistiques' },
    { url: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80', title: 'Design UI/UX et maquettes' },
    { url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80', title: 'Stratégie digitale et wireframes' },
    { url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80', title: 'Développeur sur ordinateur portable' },
    { url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80', title: 'Équipe créative en réunion projet' },
    { url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80', title: 'Conseil et stratégie d entreprise' },
    { url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80', title: 'Bureau de designer web minimaliste' },
    { url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80', title: 'Salle de réunion agence web' },
    { url: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=1200&q=80', title: 'Prototype d application mobile' },
    { url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80', title: 'Collaboration digitale et code' },
  ],
  beauty_wellness: [
    { url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80', title: 'Massage relaxant aux huiles essentielles' },
    { url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', title: 'Soin du visage éclat et hydratation' },
    { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', title: 'Ambiance zen spa et orchidées' },
    { url: 'https://images.unsplash.com/photo-1512290900673-7002004118df?auto=format&fit=crop&w=1200&q=80', title: 'Sérums et cosmétiques naturels' },
    { url: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80', title: 'Session massage pierres chaudes' },
    { url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80', title: 'Huiles de soin et serviettes cocooning' },
    { url: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=1200&q=80', title: 'Rituel visage Gua Sha et drainage' },
    { url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80', title: 'Produits de beauté biologiques' },
    { url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80', title: 'Espace soin cosy et bougies' },
    { url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', title: 'Feuillage vert et nature pure' },
  ],
  general_business: [
    { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', title: 'Bureaux professionnels modernes' },
    { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', title: 'Architecture d entreprise en ville' },
    { url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80', title: 'Réunion d affaires et présentation' },
    { url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80', title: 'Partenariat et Poignée de main' },
    { url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80', title: 'Formation et atelier de groupe' },
    { url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', title: 'Espace de travail ouvert et lumineux' },
  ],
};

function selectImagePoolForNiche(activityText: string, businessName: string) {
  const combined = `${activityText} ${businessName}`.toLowerCase();
  
  if (/web|site|agence|digital|code|dev|informatique|design|marketing|seo|studio|app|logiciel/.test(combined)) {
    return { nicheName: 'Agence Web & Numérique', pool: NICHE_IMAGE_POOLS.web_digital };
  }
  if (/soin|esthétic|massage|spa|visage|beauté|head spa|coiffure|institut|bien-être|relaxation/.test(combined)) {
    return { nicheName: 'Esthétique & Bien-être', pool: NICHE_IMAGE_POOLS.beauty_wellness };
  }
  return { nicheName: 'Entreprise & Services', pool: NICHE_IMAGE_POOLS.general_business };
}

/** Register images in Supabase media_assets so they show up in Media Library */
async function registerMediaAssets(images: Array<{ url: string; title: string }>) {
  const dbClient = getSupabaseAdmin() || supabase;
  for (const img of images) {
    if (!img.url || typeof img.url !== 'string' || !img.url.startsWith('http')) continue;
    try {
      const { data: existing } = await dbClient
        .from('media_assets')
        .select('id')
        .eq('url', img.url)
        .maybeSingle();

      if (!existing) {
        await dbClient.from('media_assets').insert({
          file_name: img.title || 'Photo Unsplash HD',
          url: img.url,
          alt_text: img.title || 'Photo Unsplash',
        });
      }
    } catch (e) {
      console.warn('[registerMediaAssets] Warning:', e);
    }
  }
}

export async function POST(req: NextRequest) {
  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Fetch editorial settings
    const settings = await getSettingsServer([
      'site_activity_context',
      'site_target_persona',
      'site_tone_of_voice',
      'site_brand_tone',
      'site_blog_topics',
      'business_name',
      'business_owner',
    ]);

    const activity = (settings.site_activity_context || '').trim();

    if (action === 'check_and_propose') {
      if (!activity || activity.length < 15) {
        return NextResponse.json({
          hasEditorial: false,
          message: 'La ligne éditoriale est incomplète ou absente.',
        });
      }

      const systemPrompt = `Tu es un Directeur Artistique & Lead Copywriter Web spécialisé en conversion.
Tu conçois la structure idéale (Sitemap) d'un site internet basé sur la ligne éditoriale fournie.
Chaque page doit être construite selon une architecture "Copy-First" à haute conversion.

Règles :
- Propose entre 4 et 7 pages indispensables et parfaitement adaptées à l'activité.
- Toujours inclure une page d'accueil (title: "Accueil", slug: "accueil").
- Proposer des pages spécifiques et pertinentes au métier (ex: pour une agence web -> "Création de sites", "Design UI/UX", "Référencement SEO", "À Propos", "Contact").
- Pour chaque page, fournis un titre clair, un slug propre, une description de son rôle et 4 à 6 types de sections recommandées.

Format de réponse OBLIGATOIRE (JSON strict uniquement) :
{
  "hasEditorial": true,
  "siteName": "...",
  "proposedPages": [
    {
      "title": "Accueil",
      "slug": "accueil",
      "description": "...",
      "recommendedSections": ["hero_1", "features_2", "testimonials_1", "cta_1"]
    }
  ]
}`;

      const userPrompt = `Voici la ligne éditoriale de l'entreprise :
Nom : ${settings.business_name || 'Entreprise'}
Propriétaire : ${settings.business_owner || 'Gérant'}
Activité & Contexte : ${settings.site_activity_context}
Public Cible & Persona : ${settings.site_target_persona}
Ton de Voix : ${settings.site_tone_of_voice}
Ton de Marque : ${settings.site_brand_tone}
Piliers du Blog : ${settings.site_blog_topics}

Propose l'arborescence complète du site en JSON strict.`;

      const aiResponse = await callClaude({
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        max_tokens: 2500,
        feature: 'auto-site-sitemap',
      });

      const result = extractJson(aiResponse.content[0].text);
      return NextResponse.json({
        hasEditorial: true,
        editorialData: settings,
        siteName: result.siteName || settings.business_name || 'Votre Site',
        proposedPages: result.proposedPages || [],
      });
    }

    if (action === 'generate_single_page') {
      const { pageSpec } = body;
      const pageTitle = pageSpec?.title || 'Nouvelle Page';
      const rawSlug = (pageSpec?.slug || 'page').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const pageDesc = pageSpec?.description || '';

      // Dynamically select the exact image pool matching the business niche!
      const { nicheName, pool: activeImagePool } = selectImagePoolForNiche(
        settings.site_activity_context || '',
        settings.business_name || ''
      );

      const systemPrompt = `Tu es un Web Designer Expert & Copywriter haut de gamme.
Ta mission : générer le contenu exact des sections pour la page "${pageTitle}" en répondant UNIQUEMENT avec un tableau JSON valide.
AUCUN texte avant ou après le JSON. Juste le tableau JSON brut.

RÈGLE ABSOLUE SUR LE CONTEXTE DES IMAGES :
- Le secteur d'activité du site est : "${nicheName}".
- Tu DOIS IMPÉRATIVEMENT utiliser EXCLUSIVEMENT des photos d'illustration en rapport direct avec "${nicheName}".
- INTERDICTION FORMELLE d'utiliser des photos hors-sujet (ex: pas de photos de spa/massage si le site parle d'agence web ou d'informatique, et inversement) !

RÈGLE D'AUTO-ILLUSTRATION DIVERSIFIÉE DES IMAGES (SANS DOUBLONS) :
- Choisis une URL d'image Unsplash HD UNIQUE et DIFFERENTE pour chaque champ d'image (image_url, bg_image, cards[].image_url, gallery[].image_url).
- INTERDICTION STRICTE d'utiliser la même URL d'image plus d'une fois dans la page !
- Ajoute systématiquement un champ image_credit: "Photo : Unsplash" sous chaque visuel.
- Sélectionne uniquement parmi la liste de visuels HD ci-dessous spécialement adaptée à "${nicheName}" :
${activeImagePool.map((item, idx) => `${idx + 1}. "${item.url}" (${item.title})`).join('\n')}

ARCHITECTURE "COPY-FIRST" À HAUTE CONVERSION À RESPECTER :
1. Hero Section (hero_1, hero_4 ou hero_5) :
   - Titre puissant : Résultat final + délai + payoff émotionnel.
   - Sous-titre : Contexte & méthode spécifique.
   - Preuve sociale & Réduction des doutes (FUDs).
   - CTA clair.
2. Preuve Sociale OU Point de Douleur (PAS - Problem Agitate Solution).
3. Propositions de Valeur (4 à 6 avantages fusionnant technique et bénéfice client).
4. "Comment ça marche" (étapes fluides).
5. Le Closer (section finale réitérant l'offre).

Ligne éditoriale du site :
- Entreprise : ${settings.business_name || 'Entreprise'}
- Activité : ${settings.site_activity_context}
- Persona : ${settings.site_target_persona}
- Ton de voix : ${settings.site_tone_of_voice}
- Ton de marque : ${settings.site_brand_tone}

Sections disponibles et leur schéma :
${sectionMenu()}

Format de réponse (tableau JSON strictement) :
[
  { "type": "hero_1", "data": { "title": "...", "description": "...", "cta_text": "...", "image_url": "...", "image_credit": "Photo : Unsplash" } },
  { "type": "features_2", "data": { "title": "...", "cards": [...] } },
  { "type": "cta_1", "data": { "title": "...", "cta_text": "..." } }
]`;

      const userPrompt = `Génère le contenu Copy-First complet et parfaitement illustré (secteur : ${nicheName}) pour la page "${pageTitle}" (${pageDesc}).`;

      const aiResponse = await callClaude({
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        max_tokens: 4000,
        feature: 'auto-site-page-content',
      });

      const sections = extractJson(aiResponse.content[0].text);

      // Extract image URLs and register them in Supabase media_assets
      const imagesToRegister: Array<{ url: string; title: string }> = [];
      const extractUrls = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'string' && val.startsWith('http') && (key.includes('image') || key.includes('url') || key.includes('src'))) {
            imagesToRegister.push({ url: val, title: obj.title || pageTitle || 'Photo Unsplash' });
          } else if (typeof val === 'object') {
            extractUrls(val);
          }
        }
      };
      extractUrls(sections);

      await registerMediaAssets(imagesToRegister);

      // Save page into Supabase dynamic_pages with published: true by default
      const dbClient = getSupabaseAdmin() || supabase;

      // Handle slug collision
      const { data: existingPages } = await dbClient
        .from('dynamic_pages')
        .select('slug');

      const takenSlugs = new Set((existingPages || []).map((p: any) => p.slug));
      let finalSlug = rawSlug;
      let counter = 2;
      while (takenSlugs.has(finalSlug)) {
        finalSlug = `${rawSlug}-${counter}`;
        counter += 1;
      }

      const { data: newPage, error: insertError } = await dbClient
        .from('dynamic_pages')
        .insert({
          title: pageTitle,
          slug: finalSlug,
          sections: Array.isArray(sections) ? sections : [],
          published: true,
        })
        .select('id, title, slug')
        .single();

      if (insertError || !newPage) {
        throw new Error(insertError?.message || 'Erreur lors de la sauvegarde de la page.');
      }

      return NextResponse.json({
        success: true,
        pageId: newPage.id,
        title: newPage.title,
        slug: newPage.slug,
        registeredImagesCount: imagesToRegister.length,
      });
    }

    if (action === 'update_navigation_menu') {
      const { generatedPages } = body;
      const dbClient = getSupabaseAdmin() || supabase;

      const navItems = (generatedPages || []).map((p: { title: string; slug: string }) => {
        const isHome = p.slug === 'accueil' || p.slug === 'home';
        return {
          name: p.title,
          path: isHome ? '/' : `/${p.slug}`,
        };
      });

      const menuJson = JSON.stringify(navItems);

      const { error: menuError } = await dbClient
        .from('settings')
        .upsert([{ key: 'navigation_menu', value: menuJson }], { onConflict: 'key' });

      if (menuError) {
        console.error('[generate-site-structure] Erreur sauvegarde menu :', menuError);
      }

      return NextResponse.json({
        success: true,
        menu: navItems,
      });
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (error: any) {
    console.error('[generate-site-structure] Erreur API :', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération par Claude.' },
      { status: 500 }
    );
  }
}
