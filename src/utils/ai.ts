/**
 * Client IA du projet — Claude (Anthropic) uniquement.
 *
 * Toutes les générations (idées SEO, recherche de mots-clés, pages, contenu
 * réseaux sociaux) passent par ce point d'entrée unique pour ne maintenir qu'un
 * seul modèle, un seul budget de tokens et une seule gestion d'erreur.
 *
 * Deux modes, dictés par l'hébergement Netlify :
 *  - `quick` (défaut) : appel synchrone depuis une route API, qui doit tenir
 *    dans les 60 s d'une fonction Netlify. Réflexion coupée, effort minimal,
 *    Sonnet à la place d'Opus, délai de 45 s sans réessai.
 *  - `long` : génération exécutée dans une tâche de fond (`services/aiJobs`,
 *    fonction Netlify « background », 15 min). Modèle et réflexion des
 *    réglages, réponse en streaming, délai de 13 min.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig } from '../services/aiConfig';
import { recordAiUsage } from '../services/aiUsage';
import { resolveModelSpec, quickModelFor } from '../constants/aiModels';
import { getAnthropicKey } from '../services/secrets';

/**
 * Quand la réflexion adaptative est active, `max_tokens` plafonne réflexion
 * **et** réponse. Le budget demandé par l'appelant décrit la réponse attendue :
 * on y ajoute de la marge, sinon la réflexion consomme le budget et le JSON de
 * sortie est tronqué.
 */
const THINKING_HEADROOM = 8000;
const MAX_TOKENS_CEILING = 32000;

/** Un appel rapide doit laisser à la route le temps de répondre avant 60 s. */
const QUICK_TIMEOUT_MS = 45_000;
/** Une tâche de fond Netlify est coupée à 15 min : on garde une marge. */
const LONG_TIMEOUT_MS = 13 * 60_000;

export type ClaudeCallMode = 'quick' | 'long';

export interface ClaudeCallParams {
  messages: Anthropic.MessageParam[];
  max_tokens: number;
  system?: string;
  /** Surcharge facultative ; par défaut la clé vient de l'environnement. */
  apiKey?: string;
  /**
   * `quick` (défaut) pour un appel synchrone garanti sous 60 s ; `long` pour
   * une génération lancée dans une tâche de fond (voir `services/aiJobs`).
   */
  mode?: ClaudeCallMode;
  /**
   * Délai maximal de la requête, en millisecondes. En mode `quick`, il ne peut
   * pas dépasser 45 s ; en mode `long`, 13 min par défaut.
   */
  timeout?: number;
  /**
   * Coupe la réflexion même en mode `long` (rédaction d'article : la réflexion
   * partagerait `max_tokens` avec le texte et rallongerait la génération).
   */
  disableThinking?: boolean;
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

/**
 * La clé saisie dans l'admin l'emporte sur celle de l'environnement, sauf si
 * l'appelant en fournit une explicitement. La lecture étant asynchrone (elle
 * interroge la base), la fonction l'est devenue aussi.
 */
async function resolveApiKey(override?: string): Promise<string> {
  const key = (override || (await getAnthropicKey()) || '').trim();
  if (!key || key === 'MY_ANTHROPIC_API_KEY') throw new Error('not_configured');
  return key;
}

/** Traduit les erreurs du SDK en messages lisibles dans l'admin. */
function translateError(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error('Clé API Anthropic invalide ou révoquée.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error('Limite de requêtes Anthropic atteinte — réessayez dans un instant.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    const msg = String(err.message || '').toLowerCase();
    if (msg.includes('timeout') || msg.includes('abort') || msg.includes('timed out')) {
      return new Error("Délai de réponse de l'IA dépassé. Réessayez dans un instant.");
    }
    return new Error("Impossible de joindre l'API Anthropic (réseau indisponible).");
  }
  if (err instanceof Anthropic.APIError) {
    return new Error(`Erreur API Anthropic (${err.status}) : ${err.message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** Appelle Claude et retourne le texte de la réponse. Lève une erreur explicite sinon. */
export async function callClaude(params: ClaudeCallParams): Promise<ClaudeCallResult> {
  const mode: ClaudeCallMode = params.mode ?? 'quick';
  const client = new Anthropic({ apiKey: await resolveApiKey(params.apiKey) });

  // Modèle et niveau de réflexion pilotés depuis /admin/settings → IA & Budget.
  // Les modèles antérieurs à la génération 4.6 (Haiku 4.5) refusent
  // `thinking` et `output_config.effort` : on ne les envoie que si le modèle
  // choisi les accepte.
  const { model, effort } = await getAiConfig();
  const spec = mode === 'quick' ? quickModelFor(model) : resolveModelSpec(model);
  const thinkingOn = mode === 'long' && !params.disableThinking && spec.supportsAdaptiveThinking;

  const body: Anthropic.MessageCreateParamsNonStreaming = {
    model: spec.id,
    max_tokens: thinkingOn
      ? Math.min(params.max_tokens + THINKING_HEADROOM, MAX_TOKENS_CEILING)
      : Math.min(params.max_tokens, MAX_TOKENS_CEILING),
    // Réflexion explicitement coupée quand elle n'est pas voulue : sur les
    // modèles récents elle est active par défaut.
    ...(spec.supportsAdaptiveThinking
      ? { thinking: thinkingOn ? { type: 'adaptive' as const } : { type: 'disabled' as const } }
      : {}),
    ...(spec.supportsEffort
      ? { output_config: { effort: mode === 'quick' ? ('low' as const) : effort } }
      : {}),
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
  };

  const startedAt = Date.now();
  let response: Anthropic.Message;
  try {
    if (mode === 'long') {
      // Streaming côté serveur : l'API refuse les requêtes non streamées dont
      // la durée estimée dépasse dix minutes, et la connexion reste active.
      response = await client.messages
        .stream(body, { timeout: params.timeout ?? LONG_TIMEOUT_MS, maxRetries: 1 })
        .finalMessage();
    } else {
      // Aucun réessai : un second essai ferait dépasser les 60 s de la route.
      response = await client.messages.create(body, {
        timeout: Math.min(params.timeout ?? QUICK_TIMEOUT_MS, QUICK_TIMEOUT_MS),
        maxRetries: 0,
      });
    }
  } catch (err) {
    throw translateError(err);
  }
  const durationMs = Date.now() - startedAt;

  // Comptabilise l'appel avant tout contrôle de contenu : les tokens sont
  // facturés même quand la réponse est refusée ou tronquée. `await` volontaire
  // (fonction serverless : une écriture non attendue peut être coupée), mais
  // `recordAiUsage` ne lève jamais.
  await recordAiUsage({ model: spec.id, feature: params.feature, usage: response.usage, durationMs });

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

  // 1. Direct parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 2. Strip markdown code blocks
  const stripped = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {}

  // 3. Match JSON array [...]
  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {}
  }

  // 4. Match JSON object {...}
  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {}
  }

  // 5. Auto-repair missing brackets
  if (stripped.startsWith('[') && !stripped.endsWith(']')) {
    try { return JSON.parse(stripped + ']'); } catch {}
  }
  if (stripped.startsWith('{') && !stripped.endsWith('}')) {
    try { return JSON.parse(stripped + '}'); } catch {}
  }

  throw new Error("Format JSON invalide");
}
