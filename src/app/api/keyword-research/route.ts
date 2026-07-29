/**
 * Keyword Intelligence — analyse d'un mot-clé unique.
 * 1. Google Suggest (gratuit, sans clé) → suggestions réelles
 * 2. Gemini → cluster sémantique, intent, volume estimé, brief complet
 *
 * Le positionnement de la marque n'est pas codé en dur : il est lu depuis les
 * réglages « Éditorial & Marque » de l'admin (table `settings`).
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';

async function fetchGoogleSuggestions(keyword: string): Promise<string[]> {
  const queries = [keyword, `comment ${keyword}`, `pourquoi ${keyword}`];
  const all: string[] = [];

  for (const q of queries) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(q)}&hl=fr&client=firefox&gl=fr`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(3000),
      });
      const text = await res.text();
      const data = JSON.parse(text);
      if (Array.isArray(data[1])) all.push(...(data[1] as string[]));
    } catch { /* silently ignore — Claude compensera */ }
  }

  return [...new Set(all)]
    .filter(s => s.toLowerCase() !== keyword.toLowerCase())
    .slice(0, 20);
}

interface BrandContext {
  activity: string;
  persona: string;
  brand: string;
  topics: string;
}

async function getBrandContext(): Promise<BrandContext> {
  const s = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);
  return {
    activity: s.site_activity_context || '',
    persona: s.site_target_persona || '',
    brand: s.site_brand_tone || '',
    topics: s.site_blog_topics || '',
  };
}

function buildPrompt(keyword: string, suggestions: string[], ctx: BrandContext): string {
  return `Tu es un expert SEO francophone spécialisé dans l'acquisition de trafic pour les activités de service de proximité.

## Contexte de la marque
${ctx.activity}
${ctx.persona ? `\n### Persona cible\n${ctx.persona}` : ''}
${ctx.brand ? `\n### Charte de marque & offres\n${ctx.brand}` : ''}
${ctx.topics ? `\n### Piliers de contenu\n${ctx.topics}` : ''}

## Stratégie d'entonnoir
- **découverte (TOFU)** : la personne décrit un besoin ou un problème sans connaître la prestation — fort volume, intention informationnelle.
- **comparaison (MOFU)** : elle compare des méthodes, des techniques ou des prestations et cherche à comprendre.
- **conversion (BOFU)** : elle cherche un prestataire, un tarif, une réservation — souvent avec une intention locale.

## Mot-clé à analyser
"${keyword}"

${suggestions.length > 0 ? `## Suggestions Google Autocomplete\n${suggestions.slice(0, 15).map(s => `- ${s}`).join('\n')}` : ''}

## Instructions
Détermine le niveau d'entonnoir et adapte le brief en conséquence.
N'invente jamais le nom d'une offre, d'un produit ou d'un service : n'utilise que ceux nommés dans la charte de marque ci-dessus.

Retourne UNIQUEMENT ce JSON valide, rien d'autre :
{
  "intent": "informationnel",
  "difficulty": "faible",
  "volume": "moyen",
  "category": "catégorie tirée des piliers de contenu ci-dessus",
  "funnel_level": "découverte",
  "opportunity": "2-3 phrases précises sur l'opportunité SEO concrète et la place de ce mot-clé dans la stratégie du site",
  "rel_bridge": "Comment cet article amène naturellement le lecteur vers une offre nommée dans la charte de marque, ou vers la prise de rendez-vous",
  "secondaryKeywords": ["exactement 10 à 12 termes LSI impactants, synonymes et entités sémantiques — qualité sur quantité"],
  "relatedQuestions": ["6 questions PAA réelles que les gens tapent sur Google ?"],
  "suggestedTitle": "Titre H1 optimisé 55-65 caractères, mot-clé dans les 4 premiers mots",
  "suggestedSlug": "url-sans-accents-ni-espaces-ni-caracteres-speciaux",
  "suggestedIntro": "Accroche 2-3 phrases dans le ton de voix de la marque — commencer par une scène ou une observation concrète, pas une définition",
  "contentTips": ["5 conseils de rédaction spécifiques à ce sujet et à la stratégie du site"],
  "cta": "Appel à l'action naturel vers une offre de la marque ou la prise de rendez-vous, formulé sans forcer",
  "topSuggestions": ["8 meilleures requêtes connexes pertinentes pour la niche"]
}

Règles :
- category : une des catégories issues des piliers de contenu ci-dessus
- funnel_level : "découverte" | "comparaison" | "conversion"
- difficulty / volume : "faible" | "moyen" | "élevé"
- intent : "informationnel" | "transactionnel" | "navigationnel"
- Pour topSuggestions : ${suggestions.length > 0 ? 'sélectionne les 8 meilleures parmi les suggestions Google ci-dessus, complète si besoin' : 'génère les 8 variantes les plus pertinentes pour cette niche'}.
- rel_bridge est OBLIGATOIRE : tout article doit avoir une porte d'entrée vers une offre de la marque ou la prise de rendez-vous.`;
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let keyword: string;
  try {
    const body = await req.json();
    keyword = (body.keyword || '').trim();
    if (!keyword) throw new Error('keyword required');
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid body' }, { status: 400 });
  }

  // 1. Google Suggest (best-effort) + contexte de marque (réglages admin)
  const [suggestions, brandContext] = await Promise.all([
    fetchGoogleSuggestions(keyword),
    getBrandContext(),
  ]);

  // 2. Claude — enrichissement sémantique
  try {
    const response = await callClaude({
      feature: 'keyword-research',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(keyword, suggestions, brandContext) }],
      timeout: 8000
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const analysis = extractJson(raw);
    return NextResponse.json({ keyword, googleSuggestions: suggestions, ...analysis });
  } catch (err) {
    console.error('[keyword-research] JSON parsing failed:', err);
    return NextResponse.json({ error: 'parse_error' }, { status: 500 });
  }
}

