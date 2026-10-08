/**
 * Archivage des justificatifs de dépenses dans Google Drive (serveur uniquement).
 *
 * Les pièces vont dans un dossier « Justificatifs — <institut> » du compte
 * Google connecté depuis l'admin, rangé par année puis par mois. Ce dossier se
 * partage en lecture seule avec la fiduciaire : rien n'est public, l'accès se
 * donne et se retire personne par personne.
 *
 * Portée OAuth `drive.file` : l'application ne voit que les fichiers qu'elle a
 * elle-même créés, jamais le reste du Drive. Le jeton de rafraîchissement vit
 * dans `app_secrets` (clé de service seulement), jamais dans le navigateur.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { getSecret, getSecretOrEnv, invalidateSecret } from './secrets';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const KEYS = {
  refresh: 'google_drive_refresh_token',
  folder: 'google_drive_folder_id',
  account: 'google_drive_account',
} as const;

export class DriveError extends Error {
  constructor(message: string, public status = 502, public code?: 'not_configured' | 'not_connected') {
    super(message);
  }
}

export interface DriveShare {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  account: string | null;
  folderUrl: string | null;
  sharedWith: DriveShare[];
  error?: string;
}

// ── Secrets ─────────────────────────────────────────────────────────────────

async function storeSecret(key: string, value: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new DriveError('Clé de service Supabase absente côté serveur.', 500);
  const { error } = value
    ? await admin.from('app_secrets').upsert({ key, value, updated_at: new Date().toISOString() })
    : await admin.from('app_secrets').delete().eq('key', key);
  invalidateSecret(key);
  if (error) throw new DriveError(`Enregistrement impossible : ${error.message}`, 500);
}

async function clientCredentials(): Promise<{ id: string; secret: string } | null> {
  const [id, secret] = await Promise.all([getSecretOrEnv('google_client_id'), getSecretOrEnv('google_client_secret')]);
  return id && secret ? { id, secret } : null;
}

export async function saveClientCredentials(clientId: string, clientSecret: string): Promise<void> {
  if (!/\.apps\.googleusercontent\.com$/.test(clientId.trim())) {
    throw new DriveError("L'ID client doit se terminer par .apps.googleusercontent.com.", 400);
  }
  if (clientSecret.trim().length < 10) throw new DriveError('Code secret client invalide.', 400);
  await storeSecret('google_client_id', clientId.trim());
  await storeSecret('google_client_secret', clientSecret.trim());
}

// ── Connexion OAuth ─────────────────────────────────────────────────────────

export function redirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/api/admin/google-drive/callback`;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/**
 * Adresse de consentement Google. Le `state` est signé avec le secret client
 * et expire en 15 minutes : la page de retour, qui ne reçoit pas la session
 * de l'admin, sait ainsi que la demande vient bien d'elle.
 */
export async function buildAuthUrl(origin: string): Promise<string> {
  const creds = await clientCredentials();
  if (!creds) throw new DriveError('Identifiants Google à saisir d’abord.', 501, 'not_configured');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 15 * 60_000, n: randomBytes(8).toString('hex') })).toString('base64url');
  const params = new URLSearchParams({
    client_id: creds.id,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: SCOPE,
    // Hors ligne + consentement forcé : Google renvoie un jeton de rafraîchissement.
    access_type: 'offline',
    prompt: 'consent',
    state: `${payload}.${sign(payload, creds.secret)}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function completeAuth(code: string, state: string, origin: string): Promise<void> {
  const creds = await clientCredentials();
  if (!creds) throw new DriveError('Identifiants Google absents.', 501, 'not_configured');

  const [payload, mac] = state.split('.');
  const expected = sign(payload ?? '', creds.secret);
  const valid = !!mac && mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  let exp = 0;
  try { exp = Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).exp); } catch { /* état illisible */ }
  if (!valid || exp < Date.now()) throw new DriveError('Lien de connexion expiré ou invalide : recommencez depuis la page Dépenses.', 400);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.id,
      client_secret: creds.secret,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new DriveError(`Google a refusé la connexion (${json.error ?? res.status}).`, 400);
  if (!json.refresh_token) throw new DriveError('Google n’a pas fourni d’accès durable : retirez l’accès de l’app dans votre compte Google puis reconnectez-la.', 400);

  await storeSecret(KEYS.refresh, json.refresh_token);
  cachedToken = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };

  const about = await drive<{ user?: { emailAddress?: string } }>('about?fields=user(emailAddress)');
  await storeSecret(KEYS.account, about.user?.emailAddress ?? 'compte Google');
  await rootFolderId();
}

export async function disconnect(): Promise<void> {
  const refresh = await getSecret(KEYS.refresh);
  if (refresh) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST' }).catch(() => undefined);
  }
  cachedToken = null;
  // Le dossier reste : ses pièces appartiennent au compte Google, et une
  // reconnexion de la même app le retrouve.
  await storeSecret(KEYS.refresh, null);
  await storeSecret(KEYS.account, null);
}

// ── Appels Drive ────────────────────────────────────────────────────────────

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const [creds, refresh] = await Promise.all([clientCredentials(), getSecret(KEYS.refresh)]);
  if (!creds) throw new DriveError('Google Drive n’est pas configuré.', 409, 'not_configured');
  if (!refresh) throw new DriveError('Google Drive n’est pas connecté.', 409, 'not_connected');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant') {
      throw new DriveError('L’accès à Google Drive a été retiré ou a expiré : reconnectez-le depuis la page Dépenses.', 409, 'not_connected');
    }
    throw new DriveError(`Google Drive ne répond pas (${json.error ?? res.status}).`);
  }
  cachedToken = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function drive<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new DriveError(`Google Drive : ${message}`, res.status === 404 ? 404 : 502);
  }
  return json as T;
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function findOrCreateFolder(name: string, parent?: string): Promise<string> {
  const q = [`mimeType = '${FOLDER_MIME}'`, `name = ${quote(name)}`, 'trashed = false', parent ? `${quote(parent)} in parents` : null]
    .filter(Boolean)
    .join(' and ');
  const found = await drive<{ files?: { id: string }[] }>(`files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  if (found.files?.[0]) return found.files[0].id;
  const created = await drive<{ id: string }>('files?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  });
  return created.id;
}

async function rootFolderName(): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data } = admin
    ? await admin.from('settings').select('value').eq('key', 'business_name').maybeSingle()
    : { data: null };
  const name = String(data?.value ?? '').trim();
  return `Justificatifs — ${name || 'Institut'}`;
}

/** Dossier racine, recréé s'il a été supprimé ou mis à la corbeille. */
async function rootFolderId(): Promise<string> {
  const stored = await getSecret(KEYS.folder);
  if (stored) {
    try {
      const f = await drive<{ id: string; trashed?: boolean }>(`files/${stored}?fields=id,trashed`);
      if (!f.trashed) return f.id;
    } catch (err) {
      if (!(err instanceof DriveError) || err.status !== 404) throw err;
    }
  }
  const id = await findOrCreateFolder(await rootFolderName());
  await storeSecret(KEYS.folder, id);
  return id;
}

export async function driveStatus(): Promise<DriveStatus> {
  const creds = await clientCredentials();
  const [refresh, account] = await Promise.all([getSecret(KEYS.refresh), getSecret(KEYS.account)]);
  const base: DriveStatus = { configured: !!creds, connected: !!creds && !!refresh, account, folderUrl: null, sharedWith: [] };
  if (!base.connected) return base;
  try {
    const folderId = await rootFolderId();
    const perms = await drive<{ permissions?: { id: string; emailAddress?: string; displayName?: string; role: string }[] }>(
      `files/${folderId}/permissions?fields=permissions(id,emailAddress,displayName,role)`,
    );
    return {
      ...base,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      sharedWith: (perms.permissions ?? [])
        .filter((p) => p.role !== 'owner' && p.emailAddress)
        .map((p) => ({ id: p.id, email: p.emailAddress!, name: p.displayName ?? null, role: p.role })),
    };
  } catch (err) {
    return { ...base, connected: !(err instanceof DriveError && err.code === 'not_connected'), error: err instanceof Error ? err.message : String(err) };
  }
}

/** Accès en lecture seule au dossier, avec un e-mail de Google à la personne invitée. */
export async function shareFolder(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new DriveError('Adresse e-mail invalide.', 400);
  const folderId = await rootFolderId();
  const message = 'Voici le dossier des justificatifs de dépenses, rangés par année et par mois. Il se complète au fil des saisies.';
  await drive(
    `files/${folderId}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(message)}&fields=id`,
    { method: 'POST', body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: clean }) },
  );
}

export async function unshareFolder(permissionId: string): Promise<void> {
  if (!/^[\w-]+$/.test(permissionId)) throw new DriveError('Accès inconnu.', 400);
  const folderId = await rootFolderId();
  await drive(`files/${folderId}/permissions/${permissionId}`, { method: 'DELETE' });
}

/** Nom lisible : « 2026-10-02 — IKEA Riddes — CHF 72.00.jpg ». */
export function justificatifName(params: { date: string; fournisseur: string; montant?: number | null; ext: string }): string {
  const fournisseur = params.fournisseur.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Pièce';
  const montant = params.montant && params.montant > 0 ? ` — CHF ${params.montant.toFixed(2)}` : '';
  return `${params.date} — ${fournisseur}${montant}.${params.ext}`;
}

/** Dépose la pièce dans « année / année-mois » et rend son lien Drive. */
export async function uploadToDrive(params: {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
  date: string;
  description?: string;
}): Promise<{ id: string; url: string; name: string }> {
  const [year, month] = (/^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : new Date().toISOString().slice(0, 10)).split('-');
  const root = await rootFolderId();
  const yearId = await findOrCreateFolder(year, root);
  const monthId = await findOrCreateFolder(`${year}-${month}`, yearId);

  const boundary = `piece-${randomBytes(8).toString('hex')}`;
  const meta = JSON.stringify({ name: params.name, parents: [monthId], description: params.description ?? '' });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`),
    Buffer.from(params.bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } };
  if (!res.ok || !json.id) throw new DriveError(`Dépôt sur Google Drive impossible : ${json.error?.message ?? res.status}`);
  return { id: json.id, name: json.name ?? params.name, url: json.webViewLink ?? `https://drive.google.com/file/d/${json.id}/view` };
}
