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
