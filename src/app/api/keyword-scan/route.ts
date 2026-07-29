/**
 * Keyword Scan stratégique.
 * Deux appels Haiku parallèles de 10 recommandations chacun → fusion (évite la troncature JSON).
 * Positionnement : Matthieu Le Tousse — Coach Relation Toxique & Pervers Narcissique.
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';

// ── Contexte commun — encodé une fois ────────────────────────────────────────

const CONTEXT = `Tu es un expert SEO pour les coachs et accompagnants francophones.

## Qui est Matthieu Le Tousse
Site : audeladeschaines.com — Suisse.
Titre : **Coach Relation Toxique & Pervers Narcissique**.
Approche : accompagnement chirurgical, lucide et orienté résultats des victimes de relations toxiques, de pervers narcissiques et de manipulation psychologique. 6 ans de pratique thérapeutique + expertise terrain (structures familiales complexes).
Programme phare : **l'Arsenal Tactique** (6 modules : Mindset, Sortir du brouillard, Protocole de défense, Sevrage neuro-émotionnel, Reconstruction, Immunisation).
Médias : podcast "Au-delà des Chaînes" + chaîne YouTube (analyses chirurgicales des profils toxiques).
Cible : hommes et femmes 25-45 ans, en couple toxique, en séparation, ou en reconstruction post-rupture traumatique.

## Pages existantes (ne pas dupliquer)
- / · /about · /seance-individuelle · /programme-complet · /contact · /blog

## Entonnoir
- **symptôme (TOFU)** : souffrance concrète, fort volume — brouillard mental, marcher sur des œufs, culpabilité, hypervigilance, épuisement, ne pas réussir à partir.
- **méthode (MOFU)** : mécanismes et outils — gaslighting, inversion de culpabilité, love bombing, lien de trauma, sevrage neuro-émotionnel, méthode de la roche grise.
- **thérapeute (BOFU)** : conversion directe — coach relation toxique, accompagnement pervers narcissique, se reconstruire, couper les ponts en sécurité, entretien stratégique.

## Format de chaque recommandation (JSON strict, champs courts)
{
  "keyword": "requête exacte Google",
  "funnel_level": "symptôme|méthode|thérapeute",
  "category": "Profils toxiques|Brouillard mental|Trauma & addiction|Protocole de défense|Sphère familiale|Reconstruction",
  "difficulty": "faible|moyen|élevé",
  "volume": "faible|moyen|élevé",
  "priority": 1,
  "opportunity": "1 phrase max",
  "suggested_title": "Titre H1 50-65 caractères, mot-clé dans les 4 premiers mots",
  "suggested_slug": "url-sans-accents",
  "rel_bridge": "1 phrase max : comment amener vers l'Arsenal Tactique / l'entretien stratégique"
}`;

function buildBatchPrompt(batch: 'A' | 'B', alreadyUsed: string[]): string {
  const exclude = alreadyUsed.length > 0
    ? `\nMots-clés DÉJÀ GÉNÉRÉS dans l'autre lot (ne pas dupliquer) :\n${alreadyUsed.map(k => `- ${k}`).join('\n')}`
    : '';

  const levels = batch === 'A'
    ? '5 symptôme, 3 méthode, 2 thérapeute'
    : '3 symptôme, 4 méthode, 3 thérapeute';

  return `${CONTEXT}${exclude}

## Ta mission (lot ${batch})
Génère EXACTEMENT 10 recommandations : ${levels}.
Retourne UNIQUEMENT ce JSON valide, rien d'autre :
{
  "recommendations": [ /* 10 objets */ ]
}`;
}

async function runBatch(batch: 'A' | 'B', alreadyUsed: string[] = []): Promise<any[]> {
  const response = await callClaude({
    feature: 'keyword-scan',
    max_tokens: 2500,
    messages:   [{ role: 'user', content: buildBatchPrompt(batch, alreadyUsed) }],
    timeout: 8000
  });

  const raw   = (response.content[0] as { type: string; text: string }).text.trim();
  try {
    const parsed = extractJson(raw);
    return Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  } catch (err) {
    console.error(`[keyword-scan] Batch ${batch} JSON parse failed:`, err, 'raw:', raw);
    throw new Error(`Batch ${batch}: parse_error`);
  }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!await validateSupabaseToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  try {
    // Lot A et B en parallèle
    const [batchA, batchB] = await Promise.all([
      runBatch('A'),
      runBatch('B'),
    ]);

    const recommendations = [...batchA, ...batchB];

    // Résumé stratégique — appel léger séparé
    const summaryRes = await callClaude({
      feature: 'keyword-scan',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${CONTEXT}

Retourne UNIQUEMENT ce JSON :
{
  "strategy_summary": "2 phrases sur la priorité SEO pour Matthieu",
  "coverage_gaps": ["lacune 1", "lacune 2", "lacune 3", "lacune 4"]
}`,
      }],
    });

    const summaryRaw   = (summaryRes.content[0] as { type: string; text: string }).text.trim();
    let summary: any;
    try {
      summary = extractJson(summaryRaw);
    } catch {
      summary = { strategy_summary: '', coverage_gaps: [] };
    }

    return NextResponse.json({ ...summary, recommendations });
  } catch (e: any) {
    console.error('[keyword-scan]', e);
    return NextResponse.json({ error: e?.message ?? 'Internal server error' }, { status: 500 });
  }
}
