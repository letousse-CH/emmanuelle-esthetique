/**
 * Keyword Intelligence — analyse d'un mot-clé unique.
 * 1. Google Suggest (gratuit, sans clé) → suggestions réelles
 * 2. Le modèle Claude choisi dans /admin/settings → cluster sémantique,
 *    intention, volume estimé, brief complet
 *
 * Le positionnement de la marque n'est pas codé en dur : il est lu depuis les
 * réglages « Éditorial & Marque » de l'admin (table `settings`).
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';
import { getAnthropicKey } from '../../../services/secrets';

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
  return `Tu es un expert SEO & SIO (Search Intent & Information Optimization / GEO) francophone spécialisé dans l'acquisition de trafic pour les activités de service.

## Contexte de la marque & Positionnement
${ctx.activity}
${ctx.persona ? `\n### Persona cible\n${ctx.persona}` : ''}
${ctx.brand ? `\n### Charte de marque & offres\n${ctx.brand}` : ''}
${ctx.topics ? `\n### Piliers de contenu\n${ctx.topics}` : ''}

## Stratégie d'entonnoir SEO & SIO / GEO
- **découverte (TOFU / SIO)** : la personne décrit un besoin, une douleur ou un problème sur ChatGPT, Perplexity ou Google sans connaître la prestation.
- **comparaison (MOFU / GEO)** : elle compare des méthodes, des solutions ou des prestataires sur les moteurs IA et les communautés.
- **conversion (BOFU / Service)** : elle cherche un prestataire, un tarif ou une réservation locale.

## Mot-clé ou Sujet à analyser
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
  "opportunity": "2-3 phrases précises sur l'opportunité SEO/SIO concrète et la place de ce mot-clé dans la stratégie du site",
  "rel_bridge": "Comment cet article amène naturellement le lecteur vers une offre nommée dans la charte de marque, ou vers la prise de rendez-vous",
  "aiPrompts": [
    "3 à 4 exemples exacts de prompts/questions que les prospects posent aux IA (ChatGPT, Perplexity, Claude, SearchGPT) sur ce sujet"
  ],
  "communityQuestions": [
    "3 à 4 questions typiques posées par les utilisateurs sur Reddit, Quora ou forums spécialisés en lien avec ce problème"
  ],
  "geoCitationTips": [
    "3 règles clés de structuration du contenu pour être cité par les moteurs IA (ex: puces claires, définitions directes, données chiffrées)"
  ],
  "secondaryKeywords": ["10 à 12 termes LSI impactants, synonymes et entités sémantiques"],
  "relatedQuestions": ["6 questions PAA réelles tapées sur Google ?"],
  "suggestedTitle": "Titre H1 optimisé 55-65 caractères, mot-clé dans les 4 premiers mots",
  "suggestedSlug": "url-sans-accents-ni-espaces-ni-caracteres-speciaux",
  "suggestedIntro": "Accroche 2-3 phrases dans le ton de voix de la marque — commencer par une scène ou une observation concrète",
  "contentTips": ["5 conseils de rédaction spécifiques à ce sujet et à la stratégie du site"],
  "cta": "Appel à l'action naturel vers une offre de la marque ou la prise de rendez-vous, formulé sans forcer",
  "topSuggestions": ["8 meilleures requêtes connexes pertinentes pour la niche"]
}

Règles :
- category : une des catégories issues des piliers de contenu ci-dessus
- funnel_level : "découverte" | "comparaison" | "conversion"
- difficulty / volume : "faible" | "moyen" | "élevé"
- intent : "informationnel" | "transactionnel" | "navigationnel"
- aiPrompts : très spécifique, axé sur les demandes formulées aux agents IA.
- communityQuestions : axé sur l'empathie et les galères/besoins réels partagés sur Reddit ou forums.
- rel_bridge est OBLIGATOIRE : tout article doit avoir une porte d'entrée vers une offre de la marque ou la prise de rendez-vous.`;
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = await getAnthropicKey();
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
      timeout: 25000
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const analysis = extractJson(raw);
    return NextResponse.json({ keyword, googleSuggestions: suggestions, ...analysis });
  } catch (err) {
    console.error('[keyword-research] JSON parsing failed:', err);
    return NextResponse.json({ error: 'parse_error' }, { status: 500 });
  }
}

