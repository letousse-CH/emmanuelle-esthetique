/**
 * Client IA du projet — Claude (Anthropic) uniquement.
 *
 * Toutes les générations (idées SEO, recherche de mots-clés, pages, contenu
 * réseaux sociaux) passent par ce point d'entrée unique pour ne maintenir qu'un
 * seul modèle, un seul budget de tokens et une seule gestion d'erreur.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig } from '../services/aiConfig';
import { recordAiUsage } from '../services/aiUsage';
import { resolveModelSpec } from '../constants/aiModels';

/**
 * Quand la réflexion adaptative est active, `max_tokens` plafonne réflexion
 * **et** réponse. Le budget demandé par l'appelant décrit la réponse attendue :
 * on y ajoute de la marge, sinon la réflexion consomme le budget et le JSON de
 * sortie est tronqué.
 */
const THINKING_HEADROOM = 8000;
const MAX_TOKENS_CEILING = 32000;

export interface ClaudeCallParams {
  messages: Anthropic.MessageParam[];
  max_tokens: number;
  system?: string;
  /** Surcharge facultative ; par défaut la clé vient de l'environnement. */
  apiKey?: string;
  /**
   * Délai maximal de la requête, en millisecondes. À borner sur les routes
   * appelées en fonction serverless : les tentatives du SDK doivent tenir dans
   * le budget d'exécution, sinon la réponse part avec un corps vide.
   */
  timeout?: number;
  /**
   * Étiquette de la fonctionnalité appelante ('page', 'social', 'seo-ideas'…),
   * utilisée pour le détail des coûts dans `/admin/settings` → IA & Budget.
   */
  feature?: string;
}

/** Réponse normalisée, conservée pour les appelants existants. */
export interface ClaudeCallResult {
  content: { type: 'text'; text: string }[];
}

function resolveApiKey(override?: string): string {
  const key = (process.env.ANTHROPIC_API_KEY || override || '').trim();
  if (!key || key === 'MY_ANTHROPIC_API_KEY') throw new Error('not_configured');
  return key;
}

/** Appelle Claude et retourne le texte de la réponse. Lève une erreur explicite sinon. */
export async function callClaude(params: ClaudeCallParams): Promise<ClaudeCallResult> {
  const client = new Anthropic({ apiKey: resolveApiKey(params.apiKey) });

  // Modèle et niveau de réflexion pilotés depuis /admin/settings → IA & Budget.
  // Les modèles antérieurs à la génération 4.6 (Haiku 4.5) refusent
  // `thinking: adaptive` et `output_config.effort` : on ne les envoie que si le
  // modèle choisi les accepte.
  const { model, effort } = await getAiConfig();
  const spec = resolveModelSpec(model);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: spec.id,
        max_tokens: Math.min(params.max_tokens + THINKING_HEADROOM, MAX_TOKENS_CEILING),
        ...(spec.supportsAdaptiveThinking ? { thinking: { type: 'adaptive' as const } } : {}),
        ...(spec.supportsEffort ? { output_config: { effort } } : {}),
        ...(params.system ? { system: params.system } : {}),
        messages: params.messages,
      },
      // Sur une route bornée en temps, une seule tentative : les retries du SDK
      // feraient dépasser le budget de la fonction serverless.
      params.timeout ? { timeout: params.timeout, maxRetries: 0 } : undefined,
    );
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Clé API Anthropic invalide ou révoquée.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Limite de requêtes Anthropic atteinte — réessayez dans un instant.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new Error("Impossible de joindre l'API Anthropic (réseau indisponible).");
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Erreur API Anthropic (${err.status}) : ${err.message}`);
    }
    throw err;
  }

  // Comptabilise l'appel avant tout contrôle de contenu : les tokens sont
  // facturés même quand la réponse est refusée ou tronquée. `await` volontaire
  // (fonction serverless : une écriture non attendue peut être coupée), mais
  // `recordAiUsage` ne lève jamais.
  await recordAiUsage({ model: spec.id, feature: params.feature, usage: response.usage });

  // Les classificateurs de sécurité peuvent décliner une requête : la réponse
  // est un HTTP 200 dont le contenu est vide ou partiel.
  if (response.stop_reason === 'refusal') {
    console.error('[ai] Requête déclinée par Claude:', response.stop_details);
    throw new Error("La requête a été refusée par le modèle. Reformulez le sujet demandé.");
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (response.stop_reason === 'max_tokens' && !text) {
    throw new Error('Réponse tronquée avant le moindre texte — augmentez max_tokens.');
  }
  if (!text) {
    throw new Error('Réponse vide du modèle, réessayez.');
  }

  return { content: [{ type: 'text', text }] };
}

export function extractJson(text: string): any {
  const cleaned = text.trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Try regex match for JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Try cleaning markdown code block syntax
  let stripped = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {}

  // Try fixing missing closing brace
  if (stripped.startsWith('{') && !stripped.endsWith('}')) {
    try {
      return JSON.parse(stripped + '}');
    } catch {}
  }

  throw new Error("Format JSON invalide");
}
