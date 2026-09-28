/**
 * Scan stratégique des mots-clés.
 *
 * Deux appels parallèles de dix recommandations chacun, fusionnés — un seul
 * appel de vingt tronquait le JSON. Le résumé stratégique part en même temps :
 * il ne dépend pas des recommandations, et l'enchaîner après les deux lots
 * faisait dépasser les 60 s d'une fonction Netlify.
 *
 * ⚠️ Le contenu déjà publié est **envoyé au modèle** (titres + adresses), pour
 * que `covered_by` ne soit pas inventé.
 *
 * Extrait de la route `/api/keyword-scan` pour être exécutable aussi en tâche
 * de fond (`services/aiJobs`, type `keyword-scan`).
 */
import { supabase } from '../supabase';
import { callClaude, extractJson } from '../../utils/ai';
import { getSettingsPlain, type AiTaskMode } from './shared';

/**
 * Même valeur que SITE_CONFIG.url (config/site.ts), relue ici pour ne pas
 * importer ce module, qui dépend de Next.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'http://localhost:5173';

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
  const s = await getSettingsPlain([
    'site_activity_context',
    'site_target_persona',
    'site_brand_tone',
    'site_blog_topics',
  ]);

  return `Tu es un expert SEO, SIO (Search Intent & Information Optimization) et GEO (Generative Engine Optimization) francophone.

## La marque & Offres
Site : ${SITE_URL} — .
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

async function runBatch(
  context: string,
  batch: 'A' | 'B',
  alreadyUsed: string[] = [],
  mode: AiTaskMode = 'quick',
): Promise<any[]> {
  const response = await callClaude({
    feature: 'keyword-scan',
    max_tokens: 2500,
    mode,
    messages:   [{ role: 'user', content: buildBatchPrompt(context, batch, alreadyUsed) }],
    ...(mode === 'quick' ? { timeout: 40000 } : {}),
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

export async function runKeywordScan(mode: AiTaskMode = 'quick') {
  const context = await buildContext();

  // Lots A et B, et résumé stratégique, en parallèle.
  const [batchA, batchB, summaryRes] = await Promise.all([
    runBatch(context, 'A', [], mode),
    runBatch(context, 'B', [], mode),
    callClaude({
      feature: 'keyword-scan',
      max_tokens: 1000,
      mode,
      messages: [{
        role: 'user',
        content: `${context}

Retourne UNIQUEMENT ce JSON :
{
  "strategy_summary": "2 phrases sur la priorité SEO du site, au vu de ce qu'il couvre déjà",
  "coverage_gaps": ["lacune 1", "lacune 2", "lacune 3", "lacune 4"]
}`,
      }],
    }),
  ]);

  const recommendations = [...batchA, ...batchB];

  const summaryRaw   = (summaryRes.content[0] as { type: string; text: string }).text.trim();
  let summary: any;
  try {
    summary = extractJson(summaryRaw);
  } catch {
    summary = { strategy_summary: '', coverage_gaps: [] };
  }

  return { ...summary, recommendations };
}
