import { NextResponse, type NextRequest } from 'next/server';
import { callClaude, extractJson } from '../../../../utils/ai';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
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
  // Authenticate with Supabase JWT if present
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const isAuth = await validateSupabaseToken(token);
    if (!isAuth) {
      return NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 });
    }
  }

  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const pageTitle = body.pageTitle || '';
    const prompt = (body.prompt || body.instruction || '').trim();
    const sections = body.sections || body.currentSections || [];

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Le champ "prompt" est obligatoire.' }, { status: 400 });
    }

    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'Le paramètre "sections" doit être un tableau.' }, { status: 400 });
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

    // ── Mode Ultra-Rapide pour 1 seule section (Modale de section) ──
    const isSingleSectionMode = sections.length === 1;

    let systemPrompt: string;
    let userPrompt: string;
    let maxTokens = 4000;

    if (isSingleSectionMode) {
      maxTokens = 1500;
      systemPrompt = `Tu es un expert Copywriter & Web Designer.
Ta mission est de réécrire et d'optimiser le contenu texte d'une seule section web pour l'activité "${settings.site_activity_context || 'Services'}" (${nicheName}).
Consigne stricte : conserve exactement la même structure de clés JSON dans "data".
Renvoie UNIQUEMENT un tableau JSON contenant cette unique section modifiée au format :
[
  { "type": "${sections[0].type}", "data": { ... } }
]`;

      userPrompt = `Données actuelles de la section :
${JSON.stringify(sections[0], null, 2)}

Demande de modification :
"${prompt}"

Renvoie le JSON mis à jour :`;
    } else {
      systemPrompt = `Tu es un Web Designer & Director Copywriter expert (Webflow / Framer).
Ta mission est de MODIFIER et d'AMÉLIORER la page web existante d'après la demande de l'utilisateur.

CONSIGNES DE MODIFICATION STRICTES :
1. RESPECTE LA DEMANDE DE L'UTILISATEUR : Applique fidèlement les changements demandés (ex: ajouter une section FAQ/témoignages, reformuler les titres, changer l'ambiance visuelle, insérer de nouvelles images).
2. RESPECT DU PLAN LANDING PAGE IDÉALE DE CONVERSION :
   - Structure Copy-First : Hero → Preuve Sociale/PAS → Avantages/Valeurs → Méthode pas-à-pas → Closer/FAQ/Tarifs.
   - Veille à garder une cohérence globale d'ensemble.
3. CONSERVATION DES SECTIONS NON IMPACTÉES : Si l'utilisateur demande d'ajouter ou modifier un élément spécifique, conserve les autres sections utiles sans les supprimer arbitrairement.
4. VARIATION DES THÈMES ET ALIGNEMENTS :
   - Alterne les thèmes d'arrière-plan (theme: "light" puis "dark").
   - Alterne les positions d'images à 2 colonnes (image_side: "left" puis "right").
5. RÈGLE DES IMAGES CONTEXTUELLES ("${nicheName}") :
   - Si tu ajoutes ou modifies des images, utilise exclusivement les visuels HD de la liste ci-dessous.
   - Chaque photo doit être unique sur la page (pas de doublons).

Catalogue d'images HD disponibles pour "${nicheName}" :
${activeImagePool.map((item, idx) => `${idx + 1}. "${item.url}" (${item.title})`).join('\n')}

Dictionnaire des sections disponibles dans le Web Builder :
${sectionMenu()}

RÉPONDS UNIQUEMENT PAR UN TABLEAU JSON DE SECTIONS VALIDE (sans texte ni explications avant ou après). Format :
[
  { "type": "hero_1", "data": { ... } },
  { "type": "features_2", "data": { ... } }
]`;

      userPrompt = `Page actuelle : "${pageTitle || 'Sans titre'}"
Activité de l'entreprise : ${settings.site_activity_context || 'Services'} (${nicheName})

Voici les sections actuelles de la page :
${JSON.stringify(sections, null, 2)}

INSTRUCTION DE MODIFICATION DE L'UTILISATEUR :
"${prompt}"

Effectue les modifications demandées et renvoie le tableau JSON mis à jour.`;
    }

    const aiResponse = await callClaude({
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
      max_tokens: maxTokens,
      feature: 'modify-page-with-ai',
      timeout: isSingleSectionMode ? 25000 : 60000,
    });

    const rawText = (aiResponse.content[0] as { text: string }).text;
    const extracted = extractJson(rawText);
    const updatedSections: any[] = Array.isArray(extracted)
      ? extracted
      : (extracted && typeof extracted === 'object' && Array.isArray(extracted.sections) ? extracted.sections : []);

    if (updatedSections.length === 0) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu produire de modification valide. Veuillez reformuler votre instruction." },
        { status: 502 }
      );
    }

    const validatedSections = updatedSections
      .filter((s: any) => s && typeof s === 'object' && s.type in SECTION_META)
      .map((s: any) => ({
        type: s.type as SectionTypeName,
        data: s.data && typeof s.data === 'object' ? s.data : {},
      }));

    if (validatedSections.length === 0) {
      return NextResponse.json(
        { error: 'Toutes les sections renvoyées par la modification sont invalides.' },
        { status: 502 }
      );
    }

    // Register any new image URLs into Supabase media_assets
    const imagesToRegister: Array<{ url: string; title: string }> = [];
    const extractUrls = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string' && val.startsWith('http') && (key.includes('image') || key.includes('url') || key.includes('src'))) {
          imagesToRegister.push({ url: val, title: pageTitle || 'Photo Unsplash' });
        } else if (typeof val === 'object') {
          extractUrls(val);
        }
      }
    };
    extractUrls(validatedSections);

    await registerMediaAssets(imagesToRegister);

    return NextResponse.json({
      success: true,
      sections: validatedSections,
      registeredImagesCount: imagesToRegister.length,
    });

  } catch (err: any) {
    console.error('[modify-page-with-ai] unexpected error:', err);
    return NextResponse.json({ error: `Erreur lors de la modification : ${err.message || String(err)}` }, { status: 500 });
  }
}
