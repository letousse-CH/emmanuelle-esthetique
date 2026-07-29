import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';

const AVAILABLE_TYPES = [
  'hero_1', 'hero_2', 'intro_1',
  'features_1', 'features_2', 'features_3',
  'cta_1', 'testimonial_1', 'text_1',
  'gallery_grid', 'gallery_carousel', 'gallery_masonry',
  'faq_1', 'stats_1', 'timeline_1', 'logos_1'
] as const;

type SectionType = typeof AVAILABLE_TYPES[number];

const SYSTEM_PROMPT = `Tu es un UX Designer et copywriter expert en persuasion.
Ta mission : générer le contenu d'une landing page en répondant UNIQUEMENT avec un tableau JSON valide.
AUCUN texte avant ou après le JSON. Pas de markdown. Juste le tableau JSON brut.

Sections disponibles et leur schéma attendu :
1. hero_1 : { eyebrow?, title, title_italic?, description?, cta_primary_text?, cta_primary_href?, cta_secondary_text?, cta_secondary_href?, image_url?, image_opacity?, button_style?, theme? }
2. hero_2 : { eyebrow?, title, description?, cta_text?, cta_href?, button_style?, theme?, bg_image?, bg_image_opacity? }
3. intro_1 : { eyebrow?, quote, text, cta_text?, cta_href?, image_url?, image_position?, theme?, bg_image?, bg_image_opacity? }
4. features_1 : { eyebrow?, title, description?, quote?, items?: string[], cta_text?, cta_href?, theme?, bg_image?, bg_image_opacity? }
5. features_2 : { eyebrow?, title, description?, cards: [{ title, description, icon? }], theme?, bg_image?, bg_image_opacity? }
6. features_3 : { eyebrow?, title, description?, cards: [{ title, description, items?: string[], cta_text?, cta_href?, badge? }], button_style?, theme?, bg_image?, bg_image_opacity? }
7. cta_1 : { eyebrow?, title, description?, cta_text, cta_href?, button_style?, theme?, bg_image?, bg_image_opacity? }
8. testimonial_1 : { quote, author?, role?, theme?, bg_image?, bg_image_opacity? }
9. text_1 : { eyebrow?, title?, content, theme?, bg_image?, bg_image_opacity? }
10. gallery_grid : { eyebrow?, title?, description?, cards: [{ title?, description?, image, link? }], columns?: '2' | '3' | '4', theme?, bg_image?, bg_image_opacity? }
11. gallery_carousel : { eyebrow?, title?, description?, cards: [{ title?, description?, image, link? }], theme?, bg_image?, bg_image_opacity? }
12. gallery_masonry : { eyebrow?, title?, description?, cards: [{ title?, description?, image, link? }], theme?, bg_image?, bg_image_opacity? }
13. faq_1 : { eyebrow?, title, description?, cards: [{ question, answer }], theme?, bg_image?, bg_image_opacity? }
14. stats_1 : { eyebrow?, title?, cards: [{ value, label }] } (3 à 4 chiffres clés, ex: value "500+", label "Personnes accompagnées")
15. timeline_1 : { eyebrow?, title?, description?, cards: [{ title, description? }] } (3 à 4 étapes d'un processus)
16. logos_1 : { eyebrow?, cards: [{ image, alt? }] } (ne génère cette section QUE si le prompt mentionne explicitement des logos/partenaires/presse, sinon ne l'utilise pas)

Règles :
- Commence toujours par hero_1 ou hero_2
- Termine toujours par cta_1
- Utilise 4 à 7 sections au total
- Pour les href/links, utilise "#" (ou "/contact" pour les boutons d'appel à l'action principaux)
- Contenu en français sauf si le prompt est dans une autre langue. Les textes doivent respecter le contexte d'activité et le ton de voix fournis ci-dessus.
- N'invente jamais le nom d'une offre, d'un produit, d'un service, d'un tarif ou d'un horaire : n'utilise que ce qui figure dans le contexte fourni.
- Pour les images/galleries, utilise des URLs d'images d'ambiance de qualité depuis Unsplash, cohérentes avec l'activité décrite ci-dessus.

Format de réponse (tableau JSON strictement) :
[
  { "type": "hero_1", "data": { "title": "...", "description": "..." } },
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
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
      'site_tone_of_voice',
      'site_brand_tone',
    ]);

    const activityContext = settings.site_activity_context || "";
    const toneOfVoice     = settings.site_tone_of_voice || "";
    const brandTone       = settings.site_brand_tone || "";

    const dynamicSystemPrompt = `${SYSTEM_PROMPT}

━━━ ACTIVITÉ & TON DU SITE ━━━
Activité : ${activityContext}
${toneOfVoice ? `Ton de voix : ${toneOfVoice}\n` : ''}${brandTone ? `Branding & Positionnement : ${brandTone}\n` : ''}
Règle : Rédaction alignée avec l'activité du site et le ton ci-dessus.`;

    const response = await callClaude({
      feature: 'page',
      max_tokens: 4000,
      system: dynamicSystemPrompt,
      messages: [
        {
          role: 'user',
          content: `Crée une landing page pour : ${prompt}\n\nRéponds UNIQUEMENT avec le tableau JSON, commence directement par [`,
        },
      ],
      timeout: 25000
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    
    // Find JSON array start and end
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      console.error('[generate-page] No JSON array found in Gemini response:', raw);
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

    // Basic structure validation
    const validatedSections = rawSections.map((section: any) => {
      const type = AVAILABLE_TYPES.includes(section.type as SectionType) ? section.type : 'text_1';
      return {
        type,
        data: section.data && typeof section.data === 'object' ? section.data : {},
      };
    });

    return NextResponse.json({ sections: validatedSections });

  } catch (err: any) {
    console.error('[generate-page] unexpected error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur lors de la génération: ${msg}` }, { status: 500 });
  }
}
