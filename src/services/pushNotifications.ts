import webpush from 'web-push';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { SITE_CONFIG } from '../config/site';

/**
 * Notifications push vers les appareils de l'exploitante (Web Push, gratuit).
 *
 * Une notification ne vise pas un numéro de téléphone mais un navigateur :
 * l'admin, ouvert dans Chrome ou installé sur l'écran d'accueil, s'abonne
 * depuis Réglages > Réservations, et le service worker `/admin/sw.js`
 * affiche ce que le serveur lui envoie.
 *
 * Tout vit dans `app_secrets` (clé de service seulement) : ni migration ni
 * variable d'environnement à poser. Les clés VAPID sont créées au premier
 * usage ; les abonnements y sont aussi, parce que leurs clés permettent
 * d'écrire sur l'appareil — ce sont bien des secrets.
 *
 * Réservé au serveur.
 */

const KEY_PUBLIC = 'vapid_public_key';
const KEY_PRIVATE = 'vapid_private_key';
const KEY_SUBS = 'push_subscriptions';

/** Au-delà, une notification de demande n'a plus d'intérêt : l'e-mail a pris le relais. */
const TTL_SECONDS = 24 * 3600;
const SEND_TIMEOUT_MS = 5000;

export interface PushDevice {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  label: string;
  created_at: string;
  last_ok_at?: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Chemin ouvert au toucher de la notification (dans `/admin`). */
  url: string;
  /** Une notification portant le même tag remplace la précédente. */
  tag?: string;
}

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Clé de service Supabase absente (SUPABASE_SERVICE_ROLE_KEY).');
  return admin;
}

async function readSecret(key: string): Promise<string | null> {
  const { data, error } = await db().from('app_secrets').select('value').eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value as string | undefined) ?? null;
}

async function writeSecret(key: string, value: string): Promise<void> {
  const { error } = await db()
    .from('app_secrets')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

/** Clés VAPID : variables d'environnement si définies, sinon générées une fois et conservées. */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv };

  const [pub, priv] = await Promise.all([readSecret(KEY_PUBLIC), readSecret(KEY_PRIVATE)]);
  if (pub && priv) return { publicKey: pub, privateKey: priv };

  // Ne jamais les régénérer ensuite : tous les abonnements existants deviendraient muets.
  const keys = webpush.generateVAPIDKeys();
  await writeSecret(KEY_PRIVATE, keys.privateKey);
  await writeSecret(KEY_PUBLIC, keys.publicKey);
  return keys;
}

export async function listDevices(): Promise<PushDevice[]> {
  const raw = await readSecret(KEY_SUBS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as PushDevice[]) : [];
  } catch {
    return [];
  }
}

async function saveDevices(list: PushDevice[]): Promise<void> {
  await writeSecret(KEY_SUBS, JSON.stringify(list));
}

/** Valide un abonnement venu du navigateur (forme `PushSubscription.toJSON()`). */
export function parseSubscription(v: unknown): Pick<PushDevice, 'endpoint' | 'keys'> | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000) return null;
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

export async function addDevice(sub: Pick<PushDevice, 'endpoint' | 'keys'>, label: string): Promise<PushDevice[]> {
  const list = (await listDevices()).filter((d) => d.endpoint !== sub.endpoint);
  list.push({ ...sub, label: label.slice(0, 80) || 'Appareil', created_at: new Date().toISOString(), last_ok_at: null });
  await saveDevices(list);
  return list;
}

export async function removeDevice(endpoint: string): Promise<PushDevice[]> {
  const list = (await listDevices()).filter((d) => d.endpoint !== endpoint);
  await saveDevices(list);
  return list;
}

/**
 * Envoie à tous les appareils abonnés. Ne lève jamais : une notification
 * manquée ne doit pas faire échouer une réservation (l'e-mail part de toute façon).
 * Les abonnements révoqués (404/410 : permission retirée, app désinstallée) sont retirés.
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number; devices: number }> {
  try {
    const devices = await listDevices();
    if (devices.length === 0) return { sent: 0, failed: 0, devices: 0 };

    const { publicKey, privateKey } = await getVapidKeys();
    const contact = process.env.CONTACT_EMAIL?.trim() || SITE_CONFIG.receiverEmail;
    const subject = contact ? `mailto:${contact}` : SITE_CONFIG.url;
    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      devices.map((d) =>
        webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, body, {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: TTL_SECONDS,
          urgency: 'high',
          timeout: SEND_TIMEOUT_MS,
          ...(payload.tag ? { topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
        }),
      ),
    );

    const now = new Date().toISOString();
    let sent = 0;
    let failed = 0;
    let changed = false;
    const kept: PushDevice[] = [];
    results.forEach((r, i) => {
      const d = devices[i];
      if (r.status === 'fulfilled') {
        sent++;
        kept.push({ ...d, last_ok_at: now });
        changed = true;
        return;
      }
      failed++;
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        changed = true; // abonnement mort : on l'oublie
      } else {
        console.warn('[push] Envoi refusé:', status ?? '', (r.reason as Error)?.message ?? r.reason);
        kept.push(d);
      }
    });
    if (changed) await saveDevices(kept).catch((err) => console.warn('[push] Liste non mise à jour:', err));
    return { sent, failed, devices: devices.length };
  } catch (err) {
    console.warn('[push] Notification non envoyée:', err);
    return { sent: 0, failed: 0, devices: 0 };
  }
}
