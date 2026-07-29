/**
 * Résolution côté serveur du modèle Claude et du budget configurés dans
 * `/admin/settings` (onglet **IA & Budget**).
 *
 * Les valeurs sont lues dans la table `settings` puis mises en cache dans le
 * processus : sans cache, chaque génération paierait un aller-retour Supabase
 * supplémentaire. Le TTL est court pour qu'un changement de modèle prenne effet
 * presque immédiatement sans redéploiement.
 */
import { supabase } from './supabase';
import { SETTINGS_DEFAULTS } from '../constants/settings';
import {
  AI_EFFORT_LEVELS,
  AiEffort,
  DEFAULT_AI_EFFORT,
  DEFAULT_AI_MODEL,
  getModelSpec,
} from '../constants/aiModels';

export interface AiConfig {
  model: string;
  effort: AiEffort;
  /** Budget mensuel en USD ; 0 = aucun suivi de budget (pas d'alerte). */
  budgetUsd: number;
  /** Seuil d'alerte, en pourcentage du budget (1–100). */
  alertPercent: number;
}

const AI_SETTING_KEYS = [
  'ai_model',
  'ai_effort',
  'ai_budget_monthly_usd',
  'ai_budget_alert_percent',
];

const CACHE_TTL = 60 * 1000; // 1 minute
let cache: { value: AiConfig; at: number } | null = null;

function normalize(map: Record<string, string>): AiConfig {
  const model = (map.ai_model || '').trim();
  const effort = (map.ai_effort || '').trim() as AiEffort;
  const budget = Number.parseFloat(map.ai_budget_monthly_usd ?? '');
  const percent = Number.parseInt(map.ai_budget_alert_percent ?? '', 10);

  return {
    model: getModelSpec(model) ? model : DEFAULT_AI_MODEL,
    effort: AI_EFFORT_LEVELS.some((l) => l.value === effort) ? effort : DEFAULT_AI_EFFORT,
    budgetUsd: Number.isFinite(budget) && budget > 0 ? budget : 0,
    alertPercent: Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : 80,
  };
}

/** Valeurs par défaut, utilisées tant que rien n'est enregistré en base. */
export function defaultAiConfig(): AiConfig {
  return normalize(SETTINGS_DEFAULTS as Record<string, string>);
}

/**
 * Configuration IA courante. Ne lève jamais : en cas d'erreur Supabase, on
 * retombe sur les valeurs par défaut plutôt que de bloquer une génération.
 */
export async function getAiConfig(force = false): Promise<AiConfig> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL) return cache.value;

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', AI_SETTING_KEYS);

    if (error) throw new Error(error.message);

    const map = {
      ...(SETTINGS_DEFAULTS as Record<string, string>),
      ...Object.fromEntries(
        ((data as { key: string; value: string }[]) ?? [])
          .filter((r) => r.value)
          .map((r) => [r.key, r.value]),
      ),
    };
    cache = { value: normalize(map), at: now };
  } catch (err) {
    console.error('[aiConfig] Lecture des réglages IA impossible, repli sur les défauts :', err);
    cache = { value: defaultAiConfig(), at: now };
  }

  return cache.value;
}

/** À appeler après une sauvegarde des réglages pour ne pas attendre le TTL. */
export function invalidateAiConfigCache(): void {
  cache = null;
}
