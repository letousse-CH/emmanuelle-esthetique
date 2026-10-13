/**
 * Rappel de la veille aux clientes — point d'entrée planifié
 * (`netlify/functions/cron-booking-reminders.mjs`, une fois par jour).
 *
 * La logique vit dans `sendDayBeforeReminders` (services/booking.ts).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { hasCronSecret } from '../../../../utils/apiAuth';
import { sendDayBeforeReminders } from '../../../../services/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron/booking-reminders] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (!hasCronSecret(token) && !hasCronSecret(urlSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await sendDayBeforeReminders());
  } catch (err) {
    console.error('[cron/booking-reminders]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 });
  }
}
