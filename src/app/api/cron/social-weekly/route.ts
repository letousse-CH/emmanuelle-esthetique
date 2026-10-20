/**
 * Pilote hebdomadaire des réseaux sociaux — chaque matin
 * (`netlify/functions/cron-social-weekly.mjs`). Le jour réglé (mercredi par
 * défaut), propose le plan de la semaine suivante et envoie une notification.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { hasCronSecret, getBearerToken } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { runWeeklyAutopilot } from '../../../../services/socialWeekly';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/social-weekly] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasCronSecret(getBearerToken(req)) && !hasCronSecret(req.nextUrl.searchParams.get('secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('social')) || !(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ skipped: true, reason: 'Module Réseaux sociaux ou IA désactivé' });
  }
  try {
    return NextResponse.json(await runWeeklyAutopilot());
  } catch (err: any) {
    console.error('[cron/social-weekly]', err);
    return NextResponse.json({ error: err?.message || 'Erreur.' }, { status: 500 });
  }
}
