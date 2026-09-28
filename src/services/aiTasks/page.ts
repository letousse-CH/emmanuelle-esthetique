/**
 * Génération d'une page complète (landing page) à partir d'une description.
 * Extrait de la route `/api/generate-page` pour être exécutable aussi en tâche
 * de fond (`services/aiJobs`, type `page`).
 */
import { callClaude } from '../../utils/ai';
import { SECTION_META, type SectionTypeName } from '../../components/pagebuilder/sectionMeta';
import {
  AiTaskError,
  collectImageUrls,
  getSettingsPlain,
  registerMediaAssets,
  type AiTaskMode,
} from './shared';

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

export interface GeneratePageResult {
  sections: { type: SectionTypeName; data: Record<string, unknown> }[];
  registeredImagesCount: number;
}

export async function generatePage(
  input: { prompt?: unknown },
  mode: AiTaskMode = 'quick',
): Promise<GeneratePageResult> {
  const prompt = String(input?.prompt ?? '').trim();
  if (!prompt) throw new AiTaskError('Le champ "prompt" est obligatoire.', 400);

  const settings = await getSettingsPlain([
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
    mode,
    // En synchrone (mode quick), budget réduit pour tenir sous 60 s.
    max_tokens: mode === 'long' ? 4000 : 3000,
    system: dynamicSystemPrompt,
    messages: [
      {
        role: 'user',
        content: `Crée une landing page haute conversion respectant l'architecture idéale pour : ${prompt}\n\nRéponds UNIQUEMENT avec le tableau JSON, commence directement par [`,
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();

  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) {
    console.error('[generate-page] Aucun tableau JSON dans la réponse du modèle :', raw);
    throw new AiTaskError('Aucun tableau JSON trouvé dans la réponse.', 502);
  }

  const jsonString = raw.slice(start, end + 1);

  let rawSections: any[];
  try {
    rawSections = JSON.parse(jsonString);
  } catch (parseErr) {
    console.error('[generate-page] Failed to parse generated JSON:', jsonString, parseErr);
    throw new AiTaskError('JSON généré invalide.', 502);
  }

  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    throw new AiTaskError('Le format généré doit être un tableau non vide.', 502);
  }

  const validatedSections = rawSections
    .filter((section: any) => section && typeof section === 'object' && section.type in SECTION_META)
    .map((section: any) => ({
      type: section.type as SectionTypeName,
      data: section.data && typeof section.data === 'object' ? section.data : {},
    }));

  if (validatedSections.length === 0) {
    throw new AiTaskError("Aucune section exploitable n'a été produite. Reformulez la demande.", 502);
  }

  // Les images retenues rejoignent la médiathèque.
  const imagesToRegister = collectImageUrls(validatedSections, () => prompt || 'Photo Unsplash');
  await registerMediaAssets(imagesToRegister);

  return { sections: validatedSections, registeredImagesCount: imagesToRegister.length };
}
