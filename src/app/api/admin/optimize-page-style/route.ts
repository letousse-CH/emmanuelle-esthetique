import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';
import { getSettingsServer } from '../../../../services/settingsServer';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { supabase } from '../../../../services/supabase';
import { SECTION_META, type SectionTypeName } from '../../../../components/pagebuilder/sectionMeta';

export const runtime = 'nodejs';

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

function sanitizeSectionData(data: any): any {
  if (!data || typeof data !== 'object') return {};

  const clean = { ...data };

  // 1. Density normalization (prevents broken paddings)
  if (clean.density) {
    const d = String(clean.density).toLowerCase();
    if (d === 'spacious' || d === 'airy') clean.density = 'airy';
    else if (d === 'comfortable' || d === 'normal') clean.density = 'normal';
    else if (d === 'compact') clean.density = 'compact';
    else if (d === 'none') clean.density = 'none';
    else clean.density = 'normal';
  }

  // 2. Theme normalization (strictly global swatches: light, dark, surface, primary)
  if (clean.theme) {
    const t = String(clean.theme).toLowerCase();
    if (['dark', 'surface', 'primary', 'light'].includes(t)) clean.theme = t;
    else clean.theme = 'light';
  }

  // 3. Image side / position normalization (strictly 'left' or 'right')
  if (clean.image_side || clean.image_position) {
    const side = String(clean.image_side || clean.image_position).toLowerCase();
    const cleanSide = side.includes('right') ? 'right' : 'left';
    clean.image_side = cleanSide;
    clean.image_position = cleanSide;
  }

  // 4. Width normalization
  if (clean.width) {
    const w = String(clean.width).toLowerCase();
    if (['narrow', 'contained', 'wide', 'full'].includes(w)) clean.width = w;
    else clean.width = 'wide';
  }

  // 5. Align normalization
  if (clean.align) {
    const a = String(clean.align).toLowerCase();
    clean.align = a.includes('center') ? 'center' : 'left';
  }

  // 6. Animation normalization
  if (clean.animation) {
    const anim = String(clean.animation).toLowerCase();
    if (['none', 'fade', 'rise', 'stagger'].includes(anim)) clean.animation = anim;
    else clean.animation = 'rise';
  }

  // 7. Title / Content size normalization
  if (clean.title_size || clean.title_font_size) {
    const sz = String(clean.title_size || clean.title_font_size);
    if (sz.startsWith('text-')) clean.title_size = sz;
  }
  if (clean.content_size || clean.content_font_size) {
    const sz = String(clean.content_size || clean.content_font_size);
    if (sz.startsWith('text-')) clean.content_size = sz;
  }

  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageTitle, sections } = body;

    if (!Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'Aucune section à optimiser.' }, { status: 400 });
    }

    const settings = await getSettingsServer([
      'site_activity_context',
      'site_target_persona',
      'site_tone_of_voice',
      'site_brand_tone',
      'business_name',
    ]);

    const { nicheName, pool: activeImagePool } = selectImagePoolForNiche(
      settings.site_activity_context || '',
      settings.business_name || ''
    );

    const systemPrompt = `Tu es un web designer expert de niveau Webflow / Framer. Je te fournis les sections d'une page web et le catalogue de mon web builder. Ton rôle est de sublimer l'apparence visuelle, la dynamique et le rythme de la page sans jamais détruire le texte du client.

DIRECTIVES DE DESIGN WEBFLOW PREMIUM :
1. RYTHME VISUEL DE L'IMAGE : Sur les sections à 2 colonnes (intro, features, texte+image), ALTERNE la position des images : image à gauche (image_side: "left"), puis section suivante avec image à droite (image_side: "right") pour créer un chemin de lecture naturel en Z.
2. CONTRASTE ET AMBIANCE : Alterne les thèmes d'arrière-plan (theme: "light" puis theme: "dark") pour découper visuellement la page et créer une mise en page sophistiquée.
3. ESPACEMENT ET DENSITÉ : Utilise les valeurs de densité autorisées ("compact", "normal", "airy") pour faire respirer la page.
4. SÉLECTION D'IMAGES CONTEXTUELLES : Attribue des URLs d'images HD Unsplash uniquement depuis la liste "${nicheName}". Règle d'or : chaque image doit être unique sur la page (pas deux fois la même photo).
5. ALIGNEMENT STRICT :
   - image_side / image_position : uniquement "left" ou "right".
   - density : uniquement "compact" | "normal" | "airy" | "none".
   - theme : uniquement "light" | "dark".
   - width : uniquement "narrow" | "contained" | "wide" | "full".
   - animation : uniquement "none" | "fade" | "rise" | "stagger".

Catalogue d'images HD disponibles pour "${nicheName}" :
${activeImagePool.map((item, idx) => `${idx + 1}. URL: "${item.url}" (${item.title})`).join('\n')}

Format de réponse (Tableau JSON des sections avec données de style sublimées) :
[
  { "type": "hero_1", "data": { ... } },
  { "type": "features_2", "data": { ... } }
]`;

    const userPrompt = `Voici la ligne éditoriale :
Entreprise : ${settings.business_name || 'Entreprise'}
Activité : ${settings.site_activity_context} (Secteur : ${nicheName})

Voici les sections actuelles de la page "${pageTitle || 'Page'}" à sublimer :
${JSON.stringify(sections, null, 2)}

Optimise l'apparence, l'alternance d'image_side (left/right) et les visuels (${nicheName}) et renvoie le tableau JSON final.`;

    const aiResponse = await callClaude({
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
      max_tokens: 4000,
      feature: 'optimize-page-style',
    });

    const extracted = extractJson(aiResponse.content[0].text);
    const optimizedSections: any[] = Array.isArray(extracted)
      ? extracted
      : (extracted && typeof extracted === 'object' && Array.isArray(extracted.sections) ? extracted.sections : []);

    // Merge strategy: Preserves 100% of original text content while applying sanitized style options!
    const finalSections = sections.map((origSection: any, i: number) => {
      const opt = optimizedSections[i] || {};
      const optData = sanitizeSectionData(opt.data || {});

      return {
        type: opt.type && (SECTION_META as any)[opt.type] ? opt.type : origSection.type,
        data: {
          ...(origSection.data || {}),
          ...optData,
        },
      };
    });

    // Extract all image URLs from final sections and register them in Supabase media_assets
    const imagesToRegister: Array<{ url: string; title: string }> = [];

    const extractUrls = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string' && val.startsWith('http') && (key.includes('image') || key.includes('url') || key.includes('src'))) {
          imagesToRegister.push({ url: val, title: obj.title || pageTitle || 'Photo Stock' });
        } else if (typeof val === 'object') {
          extractUrls(val);
        }
      }
    };

    extractUrls(finalSections);

    // Register into Supabase media_assets
    await registerMediaAssets(imagesToRegister);

    return NextResponse.json({
      success: true,
      sections: finalSections,
      registeredImagesCount: imagesToRegister.length,
    });
  } catch (error: any) {
    console.error('[optimize-page-style] Erreur API :', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l’optimisation par Claude.' },
      { status: 500 }
    );
  }
}
