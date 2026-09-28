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
import { hasCronSecret, isAdminRequest } from '../../../../utils/apiAuth';
import { runAutomation } from '../../../../services/automationRunner';
import type { Automation } from '../../../../types/automations';

export const runtime = 'nodejs';
// Les actions IA (rédaction d'article, posts) dépassent souvent les 10 s par
// défaut des fonctions Netlify : on demande le plafond utilisé par le cron.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const id = (body?.id ?? '').trim();
  const triggeredBy = (body?.triggeredBy ?? 'manual').trim();

  // Deux portes d'entrée : une session admin, ou le secret de la tâche planifiée.
  // x-cron-secret (ancien en-tête) reste accepté ; x-internal-secret et la
  // session admin passent par isAdminRequest.
  const isCron = hasCronSecret(req.headers.get('x-cron-secret'));
  if (!isCron && !(await isAdminRequest(req))) {
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
