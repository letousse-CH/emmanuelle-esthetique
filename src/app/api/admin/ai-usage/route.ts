/**
 * Consommation IA du mois en cours + état du budget.
 *
 * Anthropic n'expose pas le solde du compte via son API : la dépense est
 * reconstituée à partir du journal `ai_usage` alimenté à chaque génération
 * (voir `services/aiUsage`). Les montants sont donc une **estimation** basée
 * sur les tarifs publics, pas une facture.
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getAiConfig } from '../../../../services/aiConfig';
import { currentPeriodStart, getUsageSummary } from '../../../../services/aiUsage';
import { resolveModelSpec } from '../../../../constants/aiModels';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getAiConfig(true);
  const summary = await getUsageSummary(currentPeriodStart());
  const spec = resolveModelSpec(config.model);

  const percentUsed =
    config.budgetUsd > 0 ? (summary.totalUsd / config.budgetUsd) * 100 : 0;

  // 'exceeded' = budget dépassé, 'warning' = seuil d'alerte atteint.
  let level: 'ok' | 'warning' | 'exceeded' = 'ok';
  if (config.budgetUsd > 0) {
    if (percentUsed >= 100) level = 'exceeded';
    else if (percentUsed >= config.alertPercent) level = 'warning';
  }

  return NextResponse.json({
    config: {
      model: spec.id,
      modelLabel: spec.label,
      effort: config.effort,
      budgetUsd: config.budgetUsd,
      alertPercent: config.alertPercent,
    },
    usage: summary,
    percentUsed,
    remainingUsd: config.budgetUsd > 0 ? Math.max(config.budgetUsd - summary.totalUsd, 0) : null,
    level,
  });
}
