/**
 * Configuration Cloudflare R2, côté serveur uniquement.
 *
 * Les identifiants (compte, clés, bucket) viennent de la table `app_secrets`
 * — saisis dans Admin > Paramètres > Clés API — avec repli sur les variables
 * d'environnement R2_*. Ils ne passent plus par `settings`, lisible par
 * n'importe quel visiteur.
 *
 * L'adresse publique des images n'est pas un secret : elle reste dans
 * `settings` (r2_public_url), avec repli sur NEXT_PUBLIC_R2_PUBLIC_URL.
 * Même ordre partout (admin d'abord) : l'adresse publique doit désigner le
 * même bucket que les clés.
 */
import { getSecretOrEnv } from '../services/secrets';
import { supabase } from '../services/supabase';

export interface R2Config {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
}

export async function getR2PublicUrl(): Promise<string> {
  let fromSettings = '';
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'r2_public_url').maybeSingle();
    fromSettings = String(data?.value ?? '').trim();
  } catch (e) {
    console.error('[r2Config] Lecture de r2_public_url impossible :', e);
  }
  return (
    fromSettings ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
    process.env.VITE_R2_PUBLIC_URL?.trim() ||
    ''
  );
}

export async function getR2Config(): Promise<R2Config> {
  const [accountId, accessKey, secretKey, bucket, publicUrl] = await Promise.all([
    getSecretOrEnv('r2_account_id'),
    getSecretOrEnv('r2_access_key_id'),
    getSecretOrEnv('r2_secret_access_key'),
    getSecretOrEnv('r2_bucket_name'),
    getR2PublicUrl(),
  ]);
  return {
    accountId: accountId || '',
    accessKey: accessKey || '',
    secretKey: secretKey || '',
    bucket: bucket || '',
    publicUrl,
  };
}
