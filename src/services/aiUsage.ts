/**
 * Journal de consommation IA (table `ai_usage`).
 *
 * Anthropic ne publie pas d'endpoint de solde : on comptabilise nous-mêmes les
 * tokens facturés à chaque appel pour pouvoir afficher la dépense du mois et
 * alerter quand le budget configuré s'épuise.
 */
import { createClient } from '@supabase/supabase-js';
import { estimateCostUsd, TokenUsage } from '../constants/aiModels';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// La clé service_role contourne RLS ; repli sur la clé anon en local (la table
// autorise l'insertion à anon pour ce cas précis).
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

function client() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export interface RecordUsageInput {
  model: string;
  /** Fonctionnalité appelante : 'article', 'page', 'social'… */
  feature?: string;
  usage: TokenUsage | null | undefined;
}

/**
 * Enregistre un appel. **Ne lève jamais** : une génération réussie ne doit pas
 * échouer parce que la comptabilité a échoué.
 */
export async function recordAiUsage({ model, feature, usage }: RecordUsageInput): Promise<void> {
  if (!usage) return;
  try {
    const db = client();
    if (!db) return;

    const { error } = await db.from('ai_usage').insert({
      model,
      feature: feature || 'inconnu',
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: Number(estimateCostUsd(model, usage).toFixed(6)),
    });
    if (error) console.error('[aiUsage] Enregistrement impossible :', error.message);
  } catch (err) {
    console.error('[aiUsage] Enregistrement impossible :', err);
  }
}

export interface UsageBreakdownRow {
  key: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface UsageSummary {
  periodStart: string;
  totalUsd: number;
  calls: number;
  byModel: UsageBreakdownRow[];
  byFeature: UsageBreakdownRow[];
  /** `true` si la table n'est pas encore créée ou inaccessible. */
  unavailable: boolean;
}

function emptySummary(periodStart: string, unavailable = false): UsageSummary {
  return { periodStart, totalUsd: 0, calls: 0, byModel: [], byFeature: [], unavailable };
}

/** Début du mois calendaire courant, en UTC. */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Dépense agrégée depuis `since` (par défaut : début du mois courant). */
export async function getUsageSummary(since?: Date): Promise<UsageSummary> {
  const periodStart = since ?? currentPeriodStart();
  const iso = periodStart.toISOString();

  try {
    const db = client();
    if (!db) return emptySummary(iso, true);

    const { data, error } = await db.rpc('ai_usage_summary', { since: iso });
    if (error) {
      console.error('[aiUsage] Agrégat indisponible :', error.message);
      return emptySummary(iso, true);
    }

    const rows = (data ?? []) as {
      model_id: string;
      feature_key: string;
      calls: number;
      tokens_in: number;
      tokens_out: number;
      cost: number;
    }[];

    const byModel = new Map<string, UsageBreakdownRow>();
    const byFeature = new Map<string, UsageBreakdownRow>();
    let totalUsd = 0;
    let calls = 0;

    for (const row of rows) {
      const cost = Number(row.cost) || 0;
      totalUsd += cost;
      calls += Number(row.calls) || 0;

      for (const [map, key] of [
        [byModel, row.model_id] as const,
        [byFeature, row.feature_key] as const,
      ]) {
        const entry = map.get(key) ?? { key, calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
        entry.calls += Number(row.calls) || 0;
        entry.tokensIn += Number(row.tokens_in) || 0;
        entry.tokensOut += Number(row.tokens_out) || 0;
        entry.costUsd += cost;
        map.set(key, entry);
      }
    }

    const sorted = (m: Map<string, UsageBreakdownRow>) =>
      [...m.values()].sort((a, b) => b.costUsd - a.costUsd);

    return {
      periodStart: iso,
      totalUsd,
      calls,
      byModel: sorted(byModel),
      byFeature: sorted(byFeature),
      unavailable: false,
    };
  } catch (err) {
    console.error('[aiUsage] Agrégat indisponible :', err);
    return emptySummary(iso, true);
  }
}
