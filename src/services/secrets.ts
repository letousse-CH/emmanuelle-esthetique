import { getSupabaseAdmin } from '../utils/supabaseAdmin';

/**
 * Lecture des clés d'API saisies depuis l'admin.
 *
 * Réservé au serveur : ces valeurs ne doivent jamais atteindre le navigateur.
 * La table `app_secrets` n'accorde d'ailleurs aucun droit de lecture — seule
 * la clé de service y accède.
 *
 * Ordre de résolution : la valeur saisie dans l'admin l'emporte sur la
 * variable d'environnement. C'est ce qui permet à un client de brancher sa
 * propre clé sans redéployer.
 */

const CACHE_TTL = 30_000;
const cache = new Map<string, { value: string | null; at: number }>();

export async function getSecret(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data } = await admin.from('app_secrets').select('value').eq('key', key).maybeSingle();
  const value = (data?.value as string | undefined)?.trim() || null;
  cache.set(key, { value, at: Date.now() });
  return value;
}

export function invalidateSecret(key: string): void {
  cache.delete(key);
}

/**
 * Clé Anthropic effective.
 *
 * Sans elle, toutes les fonctions de génération sont indisponibles — d'où un
 * point d'entrée unique, pour que le message d'erreur soit le même partout.
 */
export async function getAnthropicKey(): Promise<string | null> {
  return (await getSecret('anthropic_api_key')) ?? process.env.ANTHROPIC_API_KEY?.trim() ?? null;
}

/**
 * Clés gérées depuis Admin > Paramètres > Clés API, hors Anthropic.
 *
 * `env` : variables d'environnement acceptées en repli, dans l'ordre.
 * `secret` : false pour les valeurs qui ne sont pas des identifiants de
 * connexion (nom du bucket, identifiant de compte). Celles-là peuvent être
 * renvoyées à l'admin en clair ; les autres jamais.
 */
export const MANAGED_SECRETS = {
  resend_api_key:       { env: ['RESEND_API_KEY'],       secret: true },
  r2_account_id:        { env: ['R2_ACCOUNT_ID'],        secret: false },
  r2_access_key_id:     { env: ['R2_ACCESS_KEY_ID'],     secret: true },
  r2_secret_access_key: { env: ['R2_SECRET_ACCESS_KEY'], secret: true },
  r2_bucket_name:       { env: ['R2_BUCKET_NAME'],       secret: false },
} as const satisfies Record<string, { env: readonly string[]; secret: boolean }>;

export type ManagedSecretKey = keyof typeof MANAGED_SECRETS;

export function isManagedSecretKey(key: string): key is ManagedSecretKey {
  return Object.prototype.hasOwnProperty.call(MANAGED_SECRETS, key);
}

/** Première variable d'environnement non vide parmi celles acceptées. */
export function getEnvFallback(key: ManagedSecretKey): string | null {
  for (const name of MANAGED_SECRETS[key].env) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return null;
}

/** Valeur effective : saisie dans l'admin, sinon variable d'environnement. */
export async function getSecretOrEnv(key: ManagedSecretKey): Promise<string | null> {
  return (await getSecret(key)) ?? getEnvFallback(key);
}

/** Clé Resend effective (admin > RESEND_API_KEY). */
export async function getResendApiKey(): Promise<string | null> {
  return getSecretOrEnv('resend_api_key');
}
