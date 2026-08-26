import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';
import { getAnthropicKey } from '../../../services/secrets';
import { SECTION_META, type SectionTypeName } from '../../../components/pagebuilder/sectionMeta';
import { getSupabaseAdmin } from '../../../utils/supabaseAdmin';
import { supabase } from '../../../services/supabase';
import { isModuleEnabledServer } from '../../../config/modules';

/** Réglages d'apparence : ils relèvent du design system, pas du contenu. */
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

const NICHE_IMAGE_POOLS = {
  web_digital: [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
  ],
  beauty_wellness: [
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512290900673-7002004118df?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80',
  ],
  general_business: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=80',
  ],
};

function selectImagePoolForNiche(activityText: string, promptText: string) {
  const combined = `${activityText} ${promptText}`.toLowerCase();
  
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

const SYSTEM_PROMPT = `Tu es un Web Designer & Copywriter d'élite spécialisé dans les landing pages à haute conversion (Style Webflow / Framer).
Ton but est de construire la mise en page d'une landing page idéale et parfaitement rythmée dès sa création.

ARCHITECTURE "COPY-FIRST" À HAUTE CONVERSION STRICTEMENT RESPECTÉE :
1. Hero Section (hero_1, hero_4 ou hero_5) :
   - Titre d'accroche puissant (Résultat désiré + délai / payoff émotionnel).
   - Sous-titre explicatif avec méthode claire.
   - Boutons d'action visibles (CTA principal et secondaire).
2. Preuve Sociale OU Agitation du problème (testimonials_1, reviews_1, intro_1, logos_1).
3. Propositions de Valeur & Bénéfices (features_1, features_2, features_3 ou bento_grid_1) : 4 à 6 avantages réels fusionnant bénéfice client et preuve technique.
4. Méthode / Processus "Comment ça marche" (steps_1, timeline_1) : parcours étape par étape fluide et rassurance.
5. Le Closer & FAQ / Offre (pricing_1, pricing_2, faq_1, cta_1 ou cta_2) : levers de doutes, tarification claire et appel à l'action final.

RÈGLES D'OPTIMISATION DE STYLE ET DE RYTHME VISUEL :
1. Alterne systématiquement les thèmes (theme: "light" puis theme: "dark") d'une section à l'autre pour découper la page avec contraste.
2. Alterne la position des images sur les sections à 2 colonnes (image_side: "left" puis image_side: "right") pour créer un Z-pattern naturel.
3. Varie les densités (density: "compact" | "normal" | "airy") et les animations (animation: "rise" | "fade" | "stagger").
4. Règle de diversité des images : attribue des URLs d'images HD Unsplash uniques. INTERDICTION STRICTE d'utiliser la même photo deux fois sur la page !
5. Règle de copyright photo : ajoute systématiquement image_credit: "Photo : Unsplash" sous chaque photo.

CONSIGNE DE RESTRICTION STRICTE :
- Ne jamais inventer de nouveaux types de section ou de paramètres hors du dictionnaire ci-dessous.
- Réponds UNIQUEMENT avec un tableau d'objets JSON valide sans texte avant ni après.

Dictionnaire d'options de mon Web Builder :
${sectionMenu()}

Format de réponse (tableau JSON strictement) :
[
  { "type": "hero_1", "data": { "title": "...", "description": "...", "image_url": "...", "image_credit": "Photo : Unsplash" } },
  { "type": "features_2", "data": { "title": "...", "cards": [...] } },
  { "type": "cta_1", "data": { "title": "...", "cta_text": "..." } }
]`;

export async function POST(req: NextRequest) {
  // 1. Authenticate with Supabase JWT
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  const apiKey = await getAnthropicKey();
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée.' }, { status: 503 });
  }

  let prompt = '';
  try {
    const body = await req.json();
    prompt = String(body?.prompt || '').trim();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'Le champ "prompt" est obligatoire.' }, { status: 400 });
  }

  try {
    const settings = await getSettingsServer([
      'site_activity_context',
      'site_target_persona',
      'site_tone_of_voice',
      'site_brand_tone',
      'business_name',
    ]);

    const activityContext = settings.site_activity_context || "";
    const targetPersona   = settings.site_target_persona || "";
    const toneOfVoice     = settings.site_tone_of_voice || "";
    const brandTone       = settings.site_brand_tone || "";
    const businessName    = settings.business_name || "";

    const { nicheName, pool: activePool } = selectImagePoolForNiche(activityContext, prompt);

    const dynamicSystemPrompt = `${SYSTEM_PROMPT}

━━━ ACTIVITÉ & SECTEUR DU SITE ━━━
Entreprise : ${businessName || 'Entreprise'}
Secteur détecté : ${nicheName}
Activité : ${activityContext}
${targetPersona ? `Persona cible : ${targetPersona}\n` : ''}${toneOfVoice ? `Ton de voix : ${toneOfVoice}\n` : ''}${brandTone ? `Branding & Positionnement : ${brandTone}\n` : ''}

RÈGLE ABSOLUE D'ILLUSTRATION CONTEXTUELLE :
- Utilise EXCLUSIVEMENT des photos correspondant au secteur "${nicheName}".
- Interdiction absolue de mettre des visuels hors-sujet (ex: pas de photos de spa/massage pour une entreprise informatique ou agence web).
- Liste des photos HD ciblées pour "${nicheName}" :
${activePool.map((url, i) => `${i + 1}. "${url}"`).join('\n')}`;

    const response = await callClaude({
      feature: 'page',
      max_tokens: 4000,
      system: dynamicSystemPrompt,
      messages: [
        {
          role: 'user',
          content: `Crée une landing page haute conversion respectant l'architecture idéale pour : ${prompt}\n\nRéponds UNIQUEMENT avec le tableau JSON, commence directement par [`,
        },
      ],
      timeout: 60000
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    
    // Find JSON array start and end
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      console.error('[generate-page] Aucun tableau JSON dans la réponse du modèle :', raw);
      return NextResponse.json({ error: 'Aucun tableau JSON trouvé dans la réponse.' }, { status: 502 });
    }
    
    const jsonString = raw.slice(start, end + 1);
    
    let rawSections: any[];
    try {
      rawSections = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('[generate-page] Failed to parse generated JSON:', jsonString, parseErr);
      return NextResponse.json({ error: 'JSON généré invalide.' }, { status: 502 });
    }

    if (!Array.isArray(rawSections) || rawSections.length === 0) {
      return NextResponse.json({ error: 'Le format généré doit être un tableau non vide.' }, { status: 502 });
    }

    const validatedSections = rawSections
      .filter((section: any) => section && typeof section === 'object' && section.type in SECTION_META)
      .map((section: any) => ({
        type: section.type as SectionTypeName,
        data: section.data && typeof section.data === 'object' ? section.data : {},
      }));

    if (validatedSections.length === 0) {
      return NextResponse.json(
        { error: "Aucune section exploitable n'a été produite. Reformulez la demande." },
        { status: 502 },
      );
    }

    // Extract all image URLs from final sections and register them in Supabase media_assets
    const imagesToRegister: Array<{ url: string; title: string }> = [];
    const extractUrls = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string' && val.startsWith('http') && (key.includes('image') || key.includes('url') || key.includes('src'))) {
          imagesToRegister.push({ url: val, title: prompt || 'Photo Unsplash' });
        } else if (typeof val === 'object') {
          extractUrls(val);
        }
      }
    };
    extractUrls(validatedSections);

    await registerMediaAssets(imagesToRegister);

    return NextResponse.json({ sections: validatedSections, registeredImagesCount: imagesToRegister.length });

  } catch (err: any) {
    console.error('[generate-page] unexpected error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur lors de la génération: ${msg}` }, { status: 500 });
  }
}
