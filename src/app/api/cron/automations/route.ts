/**
 * Déclenchement des automatisations planifiées.
 *
 * À appeler périodiquement par un ordonnanceur externe (fonction planifiée
 * Netlify, cron système, service tiers) — ce projet n'en embarque pas, comme
 * /api/cron/publish et /api/cron/generate-social.
 *
 * La route n'a pas besoin d'être appelée à la minute près : chaque
 * automatisation est comparée à sa dernière occurrence prévue, pas à l'heure
 * exacte de l'appel.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { isModuleEnabledServer } from '../../../../config/modules';
import { runDueAutomations } from '../../../../services/automationRunner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/automations] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (token !== cronSecret && urlSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('automations'))) {
    return NextResponse.json({ skipped: true, reason: 'Module Automatisations désactivé' });
  }

  try {
    const summary = await runDueAutomations(new URL(req.url).origin);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[cron/automations]', err);
    return NextResponse.json({ error: err?.message || 'Erreur.' }, { status: 500 });
  }
}
