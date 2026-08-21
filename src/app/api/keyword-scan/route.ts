/**
 * Scan stratégique des mots-clés.
 *
 * Deux appels parallèles de dix recommandations chacun, fusionnés — un seul
 * appel de vingt tronquait le JSON. Le modèle est celui choisi dans
 * /admin/settings → IA & Budget ; `callClaude` s'en charge.
 *
 * ⚠️ Le contenu déjà publié est **envoyé au modèle** (titres + adresses). Sans
 * lui, `covered_by` — le « déjà couvert → /slug » affiché dans l'admin — ne
 * pouvait être qu'inventé : la route n'avait jamais lu le moindre article,
 * alors que l'écran annonçait qu'elle les lisait tous.
 *
 * Le positionnement de la marque n'est pas codé en dur : il est lu depuis les
 * réglages « Éditorial & Marque » de l'admin (table `settings`).
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../utils/apiAuth';
import { supabase } from '../../../services/supabase';
import { callClaude, extractJson } from '../../../utils/ai';
import { getSettingsServer } from '../../../services/settingsServer';
import { SITE_CONFIG } from '../../../config/site';
import { getAnthropicKey } from '../../../services/secrets';

// ── Contexte commun — construit une fois par requête depuis les réglages ─────

/** Ce que le site couvre déjà : titres et adresses des contenus publiés. */
async function fetchPublishedContent(): Promise<{ title: string; slug: string }[]> {
  const [{ data: articles }, { data: pages }] = await Promise.all([
    supabase.from('articles').select('title, slug').eq('published', true).limit(200),
    supabase.from('dynamic_pages').select('title, slug').eq('published', true).limit(100),
  ]);
  return [
    ...((articles ?? []) as { title: string; slug: string }[]).map(a => ({ title: a.title, slug: `blog/${a.slug}` })),
    ...((pages ?? []) as { title: string; slug: string }[]).map(p => ({ title: p.title, slug: p.slug })),
  ];
}

async function buildContext(): Promise<string> {
  const published = await fetchPublishedContent();
  const s = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  return `Tu es un expert SEO, SIO (Search Intent & Information Optimization) et GEO (Generative Engine Optimization) francophone.

## La marque & Offres
Site : ${SITE_CONFIG.url} — ${SITE_CONFIG.name}.
${s.site_activity_context || ''}
${s.site_target_persona ? `\n### Persona cible\n${s.site_target_persona}` : ''}
${s.site_brand_tone ? `\n### Charte de marque & offres\n${s.site_brand_tone}` : ''}
${s.site_blog_topics ? `\n### Piliers de contenu\n${s.site_blog_topics}` : ''}

## Ce que le site couvre déjà (${published.length} contenu${published.length > 1 ? 's' : ''} publié${published.length > 1 ? 's' : ''})
${published.length > 0
  ? published.map(c => `- ${c.title} → /${c.slug}`).join('\n')
  : '(aucun contenu publié pour le moment)'}

## Stratégie d'entonnoir SEO & SIO / GEO
- **découverte (TOFU / SIO)** : requêtes & prompts posés aux IA ou sur Google lorsque la personne décrit un besoin ou un problème sans connaître encore la prestation.
- **comparaison (MOFU / GEO)** : comparaison de méthodes, techniques, avis ou prestations sur les moteurs et communautés (Reddit, Quora).
- **conversion (BOFU / Service)** : recherche directe d'un prestataire, tarif ou réservation.

## Règles absolues
- N'invente jamais le nom d'une offre, d'un produit ou d'un service : n'utilise que ceux nommés dans la charte de marque ci-dessus.
- Ne propose pas de requête déjà traitée par un contenu de la liste ci-dessus. Si une requête s'en approche fortement, renseigne son adresse dans le champ covered_by.
- Le champ covered_by ne peut contenir qu'une adresse figurant telle quelle dans cette liste. Sinon : null.

## Format de chaque recommandation (JSON strict, champs courts)
{
  "keyword": "requête exacte ou prompt IA clé",
  "funnel_level": "découverte|comparaison|conversion",
  "category": "une des catégories issues des piliers de contenu ci-dessus",
  "difficulty": "faible|moyen|élevé",
  "volume": "faible|moyen|élevé",
  "priority": 1,
  "covered_by": "adresse exacte d'un contenu de la liste « déjà couvert » qui répond à cette requête, sinon null",
  "opportunity": "1-2 phrases sur l'opportunité SIO/SEO et l'angle d'attaque",
  "suggested_title": "Titre H1 50-65 caractères, mot-clé ou angle principal dans les 4 premiers mots",
  "suggested_slug": "url-sans-accents",
  "ai_prompt_example": "Exemple de prompt posé par l'internaute sur ChatGPT/Perplexity",
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
    timeout: 35000
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
  /*
    Deux portes d'entrée, comme /api/automations/run : une session admin, ou le
    secret de la tâche planifiée. Sans la seconde, l'action « Scanner les
    mots-clés » d'une automatisation — qui n'a pas de session — se heurtait
    systématiquement à un 401.
  */
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const cronSecret = req.headers.get('x-cron-secret') || '';
  const isCron = Boolean(process.env.CRON_SECRET) && cronSecret === process.env.CRON_SECRET;
  if (!isCron && !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = await getAnthropicKey();
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
  "strategy_summary": "2 phrases sur la priorité SEO du site, au vu de ce qu'il couvre déjà",
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
