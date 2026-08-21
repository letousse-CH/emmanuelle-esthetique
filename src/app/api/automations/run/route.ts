/**
 * Exécution d'une automatisation à la demande.
 *
 * Appelée depuis l'admin (bouton « Exécuter ») ou par la tâche planifiée.
 * L'aiguillage des actions et la journalisation vivent dans
 * `services/automationRunner`, partagés avec le cron et les événements
 * applicatifs — une seule implémentation, quel que soit le déclencheur.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { runAutomation } from '../../../../services/automationRunner';
import type { Automation } from '../../../../types/automations';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const id = (body?.id ?? '').trim();
  const triggeredBy = (body?.triggeredBy ?? 'manual').trim();

  // Deux portes d'entrée : une session admin, ou le secret de la tâche planifiée.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const cronSecret = req.headers.get('x-cron-secret') || '';
  const isCron = Boolean(process.env.CRON_SECRET) && cronSecret === process.env.CRON_SECRET;
  if (!isCron && !(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!id) return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });

  const { data: row } = await admin.from('automations').select('*').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Automatisation introuvable.' }, { status: 404 });

  const origin = new URL(req.url).origin;
  const outcome = await runAutomation(row as Automation, triggeredBy, origin);

  return outcome.ok
    ? NextResponse.json({ ok: true, detail: outcome.detail })
    : NextResponse.json({ error: outcome.error }, { status: 500 });
}
