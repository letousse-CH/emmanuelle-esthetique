/**
 * Keyword Intelligence — analyse d'un mot-clé unique.
 * 1. Google Suggest (gratuit, sans clé) → suggestions réelles
 * 2. Gemini → cluster sémantique, intent, volume estimé, brief complet
 *
 * Positionnement : Matthieu Le Tousse — Coach Relation Toxique & Pervers Narcissique.
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';

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

function buildPrompt(keyword: string, suggestions: string[]): string {
  return `Tu es un expert SEO spécialisé dans l'acquisition de trafic pour les coachs et accompagnants francophones.

## Contexte
Site : audeladeschaines.com — Matthieu Le Tousse, **Coach Relation Toxique & Pervers Narcissique** basé en Suisse.
Spécialité : accompagnement chirurgical et orienté résultats des victimes de relations toxiques, de pervers narcissiques et de manipulation psychologique.
Programme phare : **l'Arsenal Tactique** (6 modules : Mindset, Sortir du brouillard, Protocole de défense, Sevrage neuro-émotionnel, Reconstruction, Immunisation).
Médias : podcast "Au-delà des Chaînes" et chaîne YouTube (analyses chirurgicales des profils toxiques).
Cible : hommes et femmes 25-45 ans, en couple toxique, en séparation, ou en reconstruction post-rupture.

## Stratégie d'entonnoir
- **symptôme (TOFU)** : la persona tape ses souffrances/symptômes sans encore nommer la manipulation — fort volume (brouillard mental, marcher sur des œufs, épuisement, culpabilité, hypervigilance).
- **méthode (MOFU)** : elle cherche à comprendre les mécanismes et les outils (gaslighting, lien de trauma, sevrage neuro-émotionnel, méthode de la roche grise).
- **thérapeute (BOFU)** : conversion directe — coach relation toxique, accompagnement pervers narcissique, se reconstruire, entretien stratégique.

## Mot-clé à analyser
"${keyword}"

${suggestions.length > 0 ? `## Suggestions Google Autocomplete\n${suggestions.slice(0, 15).map(s => `- ${s}`).join('\n')}` : ''}

## Instructions
Détermine le niveau d'entonnoir et adapte le brief.
Si c'est un mot-clé symptôme : l'article valide la réalité de la persona ET amène naturellement vers l'Arsenal Tactique comme solution.
Si c'est un mot-clé méthode : l'article éduque sur le mécanisme et positionne Matthieu en expert clinique.
Si c'est un mot-clé thérapeute/conversion : l'article convertit directement vers l'entretien stratégique.

Retourne UNIQUEMENT ce JSON valide, rien d'autre :
{
  "intent": "informationnel",
  "difficulty": "faible",
  "volume": "moyen",
  "category": "Brouillard mental",
  "funnel_level": "symptôme",
  "opportunity": "2-3 phrases précises sur l'opportunité SEO concrète et la place de ce mot-clé dans la stratégie de Matthieu",
  "rel_bridge": "Comment cet article amène naturellement le lecteur vers l'Arsenal Tactique ou l'entretien stratégique de Matthieu",
  "secondaryKeywords": ["exactement 10 à 12 termes LSI impactants, synonymes, entités sémantiques cliniques — qualité sur quantité"],
  "relatedQuestions": ["6 questions PAA réelles que les gens tapent sur Google ?"],
  "suggestedTitle": "Titre H1 optimisé 55-65 caractères, mot-clé dans les 4 premiers mots",
  "suggestedSlug": "url-sans-accents-ni-espaces-ni-caracteres-speciaux",
  "suggestedIntro": "Accroche 2-3 phrases dans le style direct, chirurgical et tutoyant de Matthieu (structure Problème / Empathie / Solution) — commencer par une scène ou une observation concrète, pas une définition",
  "contentTips": ["5 conseils de rédaction spécifiques à ce sujet et à la stratégie de l'Arsenal Tactique"],
  "cta": "Appel à l'action naturel vers l'entretien stratégique privé ou l'Arsenal Tactique de Matthieu, formulé sans forcer",
  "topSuggestions": ["8 meilleures requêtes connexes pertinentes pour la niche"]
}

Règles :
- category : "Profils toxiques" | "Brouillard mental" | "Trauma & addiction" | "Protocole de défense" | "Sphère familiale" | "Reconstruction"
- funnel_level : "symptôme" | "méthode" | "thérapeute"
- difficulty / volume : "faible" | "moyen" | "élevé"
- intent : "informationnel" | "transactionnel" | "navigationnel"
- Pour topSuggestions : ${suggestions.length > 0 ? 'sélectionne les 8 meilleures parmi les suggestions Google ci-dessus, complète si besoin' : 'génère les 8 variantes les plus pertinentes pour cette niche'}.
- rel_bridge est OBLIGATOIRE : tout article doit avoir une porte d'entrée vers l'Arsenal Tactique ou l'entretien stratégique de Matthieu.`;
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

  // 1. Google Suggest (best-effort)
  const suggestions = await fetchGoogleSuggestions(keyword);

  // 2. Claude — enrichissement sémantique
  try {
    const response = await callClaude({
      feature: 'keyword-research',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(keyword, suggestions) }],
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

