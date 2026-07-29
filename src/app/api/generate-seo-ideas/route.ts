import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') return NextResponse.json({ error: 'not_configured' });

  let theme = '';
  let existingKeywords: string[] = [];
  try {
    const body = await req.json();
    theme = String(body.theme || '').trim();
    existingKeywords = Array.isArray(body.existingKeywords) ? body.existingKeywords : [];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  const activityContext = settings.site_activity_context || "Au-delà des Chaînes — Coaching d'accompagnement des victimes de manipulation psychologique...";
  const targetPersona   = settings.site_target_persona || "";
  const brandTone       = settings.site_brand_tone || "";
  const blogTopics      = settings.site_blog_topics || "";

  let response: any;
  try {
    response = await callClaude({
      feature: 'seo-ideas',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Tu es un expert SEO francophone spécialisé dans le domaine et l'activité du site.

━━━ CONTEXTE ET ACTIVITÉ DU SITE ━━━
${activityContext}

${targetPersona ? `━━━ PUBLIC CIBLE & PERSONA ━━━\n${targetPersona}\n` : ''}
${brandTone ? `━━━ MARQUE & POSITIONNEMENT ━━━\n${brandTone}\n` : ''}
${blogTopics ? `━━━ PILIERS & THÉMATIQUES DU BLOG ━━━\n${blogTopics}\n` : ''}

Génère 4 nouvelles idées d'articles SEO stratégiques pour le blog du site.

${theme ? `Thème spécifique demandé par l'utilisateur : "${theme}"` : `Choisis des thèmes variés en accord avec l'activité du site et les piliers thématiques ci-dessus.`}

Mots-clés déjà couverts à éviter : ${existingKeywords.slice(0, 20).join(', ') || 'aucun'}

Réponds UNIQUEMENT avec ce JSON valide, rien d'autre :
{
  "ideas": [
    {
      "id": "generated-[timestamp]-1",
      "category": "Nom de la catégorie (ex: Brouillard mental, Profils toxiques, etc.)",
      "keyword": "requête exacte google en français",
      "question": "reformulation en question",
      "difficulty": "faible",
      "volume": "moyen",
      "intent": "informationnel",
      "suggestedTitle": "Titre H1 accrocheur (55-65 chars), mot-clé dans les 4 premiers mots",
      "suggestedSlug": "url-en-minuscules-sans-accents",
      "suggestedIntro": "Accroche 2-3 phrases dans le style direct et incisif aligné avec le ton du site (Problème / Empathie / Solution)",
      "relatedQuestions": ["Question PAA 1", "Question PAA 2", "Question PAA 3"],
      "secondaryKeywords": ["8 à 10 termes LSI / cluster sémantique"],
      "contentTips": ["Conseil rédaction 1", "Conseil rédaction 2", "Conseil rédaction 3"],
      "cta": "Appel à l'action vers les services ou le programme phare de la marque",
      "opportunity": "Pourquoi cette requête est une opportunité SEO concrète"
    }
  ]
}

Difficulty : "faible", "moyen", "élevé"
Volume : "faible", "moyen", "élevé"
Intent : "informationnel", "transactionnel", "navigationnel"`,
      }],
    });
  } catch (err: any) {
    console.error('[generate-seo-ideas] Gemini call failed:', err);
    return NextResponse.json({ error: err?.message || 'Erreur IA' }, { status: 500 });
  }

  const raw = (response.content[0] as { type: string; text: string }).text.trim();

  try {
    const parsed = extractJson(raw);
    const ts = Date.now();
    parsed.ideas = (parsed.ideas || []).map((idea: any, i: number) => ({
      ...idea,
      id: `generated-${ts}-${i + 1}`,
    }));
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[generate-seo-ideas] JSON parsing failed:', err, 'raw:', raw);
    return NextResponse.json({ error: 'parse_error' }, { status: 500 });
  }
}
