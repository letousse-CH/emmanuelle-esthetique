import { NextResponse, type NextRequest } from 'next/server';
import { BAD_JSON, readJson, requireAdmin } from '../../bookings/_shared';
import { addDevice, getVapidKeys, listDevices, parseSubscription, removeDevice, sendPushToAll, type PushDevice } from '../../../../services/pushNotifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ce que l'admin voit d'un appareil : jamais ses clés. */
function publicDevices(list: PushDevice[]) {
  return list.map((d) => ({ endpoint: d.endpoint, label: d.label, created_at: d.created_at, last_ok_at: d.last_ok_at ?? null }));
}

function fail(err: unknown, context: string) {
  console.error(`[/api/admin/push ${context}]`, err);
  return NextResponse.json({ error: 'Notifications indisponibles pour le moment. Réessayez dans un instant.' }, { status: 500 });
}

/** GET → { publicKey, devices } */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const [{ publicKey }, devices] = await Promise.all([getVapidKeys(), listDevices()]);
    return NextResponse.json({ publicKey, devices: publicDevices(devices) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return fail(err, 'GET');
  }
}

/**
 * POST { action: 'subscribe', subscription, label }  → enregistre cet appareil
 * POST { action: 'test' }                             → notification d'essai à tous les appareils
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await readJson(req)) as { action?: unknown; subscription?: unknown; label?: unknown } | null;
  if (!body || typeof body !== 'object') return BAD_JSON();

  try {
    if (body.action === 'subscribe') {
      const sub = parseSubscription(body.subscription);
      if (!sub) return NextResponse.json({ error: 'Abonnement invalide.' }, { status: 400 });
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      return NextResponse.json({ devices: publicDevices(await addDevice(sub, label)) });
    }
    if (body.action === 'test') {
      const r = await sendPushToAll({
        title: 'Notifications activées',
        body: 'Vous serez prévenue ici à chaque nouvelle demande de rendez-vous.',
        url: '/admin/reservations',
        tag: 'essai',
      });
      return NextResponse.json({ ...r, devices: publicDevices(await listDevices()) });
    }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (err) {
    return fail(err, 'POST');
  }
}

/** DELETE { endpoint } → retire un appareil */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = (await readJson(req)) as { endpoint?: unknown } | null;
  if (!body || typeof body.endpoint !== 'string') return BAD_JSON();
  try {
    return NextResponse.json({ devices: publicDevices(await removeDevice(body.endpoint)) });
  } catch (err) {
    return fail(err, 'DELETE');
  }
}
