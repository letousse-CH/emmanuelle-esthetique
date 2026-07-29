/**
 * Keyword Scan stratégique.
 * Deux appels Haiku parallèles de 10 recommandations chacun → fusion (évite la troncature JSON).
 * Le positionnement de la marque n'est pas codé en dur : il est lu depuis les
 * réglages « Éditorial & Marque » de l'admin (table `settings`).
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';
import { SITE_CONFIG } from '../../../config/site';

// ── Contexte commun — construit une fois par requête depuis les réglages ─────

async function buildContext(): Promise<string> {
  const s = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  return `Tu es un expert SEO francophone spécialisé dans les activités de service de proximité.

## La marque
Site : ${SITE_CONFIG.url} — ${SITE_CONFIG.name}.
${s.site_activity_context || ''}
${s.site_target_persona ? `\n### Persona cible\n${s.site_target_persona}` : ''}
${s.site_brand_tone ? `\n### Charte de marque & offres\n${s.site_brand_tone}` : ''}
${s.site_blog_topics ? `\n### Piliers de contenu\n${s.site_blog_topics}` : ''}

## Entonnoir
- **découverte (TOFU)** : besoin ou problème exprimé sans connaître la prestation — fort volume, intention informationnelle.
- **comparaison (MOFU)** : comparaison de méthodes, de techniques ou de prestations.
- **conversion (BOFU)** : recherche d'un prestataire, d'un tarif ou d'une réservation — souvent avec une intention locale.

## Règle absolue
N'invente jamais le nom d'une offre, d'un produit ou d'un service : n'utilise que ceux nommés dans la charte de marque ci-dessus.

## Format de chaque recommandation (JSON strict, champs courts)
{
  "keyword": "requête exacte Google",
  "funnel_level": "découverte|comparaison|conversion",
  "category": "une des catégories issues des piliers de contenu ci-dessus",
  "difficulty": "faible|moyen|élevé",
  "volume": "faible|moyen|élevé",
  "priority": 1,
  "opportunity": "1 phrase max",
  "suggested_title": "Titre H1 50-65 caractères, mot-clé dans les 4 premiers mots",
  "suggested_slug": "url-sans-accents",
  "rel_bridge": "1 phrase max : comment amener vers une offre de la marque ou la prise de rendez-vous"
}`;
}

function buildBatchPrompt(context: string, batch: 'A' | 'B', alreadyUsed: string[]): string {
  const exclude = alreadyUsed.length > 0
    ? `\nMots-clés DÉJÀ GÉNÉRÉS dans l'autre lot (ne pas dupliquer) :\n${alreadyUsed.map(k => `- ${k}`).join('\n')}`
    : '';

  const levels = batch === 'A'
    ? '5 découverte, 3 comparaison, 2 conversion'
    : '3 découverte, 4 comparaison, 3 conversion';

  return `${context}${exclude}

## Ta mission (lot ${batch})
Génère EXACTEMENT 10 recommandations : ${levels}.
Retourne UNIQUEMENT ce JSON valide, rien d'autre :
{
  "recommendations": [ /* 10 objets */ ]
}`;
}

async function runBatch(context: string, batch: 'A' | 'B', alreadyUsed: string[] = []): Promise<any[]> {
  const response = await callClaude({
    feature: 'keyword-scan',
    max_tokens: 2500,
    messages:   [{ role: 'user', content: buildBatchPrompt(context, batch, alreadyUsed) }],
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
    const context = await buildContext();

    // Lot A et B en parallèle
    const [batchA, batchB] = await Promise.all([
      runBatch(context, 'A'),
      runBatch(context, 'B'),
    ]);

    const recommendations = [...batchA, ...batchB];

    // Résumé stratégique — appel léger séparé
    const summaryRes = await callClaude({
      feature: 'keyword-scan',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${context}

Retourne UNIQUEMENT ce JSON :
{
  "strategy_summary": "2 phrases sur la priorité SEO du site",
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
