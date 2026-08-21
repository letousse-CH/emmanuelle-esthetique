/**
 * Signalement d'un événement applicatif survenu côté navigateur.
 *
 * La caisse, par exemple, crée sa transaction par un appel Postgres direct :
 * aucun code serveur ne passe par là, donc aucun endroit ne pouvait signaler
 * « une vente a été encaissée ». Cette route sert de relais — authentifiée,
 * puisque seuls des écrans d'administration l'appellent.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { emitAutomationEvent, type AutomationEvent } from '../../../../services/automationRunner';

export const runtime = 'nodejs';

/** Seuls les événements déclenchés depuis l'admin transitent par ici. */
const ALLOWED: AutomationEvent[] = ['sale.created', 'subscriber.created', 'article.published'];

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!(await validateSupabaseToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const event = String(body?.event ?? '') as AutomationEvent;
  if (!ALLOWED.includes(event)) {
    return NextResponse.json({ error: 'Événement inconnu.' }, { status: 400 });
  }

  await emitAutomationEvent(event, new URL(req.url).origin);
  return NextResponse.json({ ok: true });
}
