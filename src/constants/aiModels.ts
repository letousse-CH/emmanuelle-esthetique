/**
 * Catalogue des modèles Claude sélectionnables depuis `/admin/settings`
 * (onglet **IA & Budget**).
 *
 * Les tarifs sont ceux de l'API Anthropic, en **USD par million de tokens**.
 * Ils servent à deux choses : afficher le coût comparé dans l'admin, et
 * valoriser la consommation réelle enregistrée dans la table `ai_usage`
 * (l'API Anthropic n'expose aucun endpoint de solde — voir `services/aiUsage`).
 *
 * Les deux drapeaux de capacité évitent des erreurs 400 : `output_config.effort`
 * et `thinking: { type: 'adaptive' }` sont refusés par les modèles antérieurs à
 * la génération 4.6 (Haiku 4.5 notamment).
 */

export type AiEffort = 'low' | 'medium' | 'high';

export interface AiModelSpec {
  id: string;
  label: string;
  family: 'Opus' | 'Sonnet' | 'Haiku';
  description: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  supportsAdaptiveThinking: boolean;
  supportsEffort: boolean;
  /** Mise en avant dans l'admin : qualité maximale / meilleur rapport / le moins cher. */
  badge?: 'qualite' | 'equilibre' | 'economique';
}

export const AI_MODELS: AiModelSpec[] = [
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    family: 'Opus',
    description:
      "Le plus capable. À réserver aux générations longues et complexes (pages, plans éditoriaux).",
    inputPricePerMTok: 5,
    outputPricePerMTok: 25,
    supportsAdaptiveThinking: true,
    supportsEffort: true,
    badge: 'qualite',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    family: 'Sonnet',
    description:
      "Qualité proche d'Opus pour 40 % moins cher. Le meilleur choix par défaut pour la rédaction et le SEO. Tarif de lancement réduit ($2 / $10) jusqu'au 31/08/2026.",
    inputPricePerMTok: 3,
    outputPricePerMTok: 15,
    supportsAdaptiveThinking: true,
    supportsEffort: true,
    badge: 'equilibre',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    family: 'Haiku',
    description:
      "5× moins cher qu'Opus et très rapide. Suffisant pour les tâches courtes (méta-données, reformulations) ; texte plus générique sur les formats longs.",
    inputPricePerMTok: 1,
    outputPricePerMTok: 5,
    supportsAdaptiveThinking: false,
    supportsEffort: false,
    badge: 'economique',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    family: 'Opus',
    description: 'Génération précédente d\'Opus, même tarif. Utile comme repli si Opus 5 pose problème.',
    inputPricePerMTok: 5,
    outputPricePerMTok: 25,
    supportsAdaptiveThinking: true,
    supportsEffort: true,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    family: 'Sonnet',
    description: 'Génération précédente de Sonnet, même tarif. Repli si Sonnet 5 pose problème.',
    inputPricePerMTok: 3,
    outputPricePerMTok: 15,
    supportsAdaptiveThinking: true,
    supportsEffort: true,
  },
];

export const DEFAULT_AI_MODEL = 'claude-opus-5';
export const DEFAULT_AI_EFFORT: AiEffort = 'medium';

export const AI_EFFORT_LEVELS: { value: AiEffort; label: string; hint: string }[] = [
  { value: 'low',    label: 'Économique', hint: 'Réflexion minimale : le moins de tokens, réponses plus directes.' },
  { value: 'medium', label: 'Équilibré',  hint: 'Réglage par défaut : bon compromis coût / qualité.' },
  { value: 'high',   label: 'Qualité',    hint: 'Réflexion approfondie : meilleures sorties, coût nettement supérieur.' },
];

export function getModelSpec(id: string): AiModelSpec | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

/** Retourne le modèle demandé, ou le modèle par défaut si l'identifiant est inconnu. */
export function resolveModelSpec(id: string | undefined | null): AiModelSpec {
  return getModelSpec((id || '').trim()) ?? getModelSpec(DEFAULT_AI_MODEL)!;
}

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Coût estimé d'un appel, en USD.
 * Les écritures de cache sont facturées 1,25× le prix d'entrée, les lectures 0,1×.
 */
export function estimateCostUsd(modelId: string, usage: TokenUsage): number {
  const spec = resolveModelSpec(modelId);
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  const inputCost =
    (input + cacheWrite * 1.25 + cacheRead * 0.1) * (spec.inputPricePerMTok / 1_000_000);
  const outputCost = output * (spec.outputPricePerMTok / 1_000_000);

  return inputCost + outputCost;
}
