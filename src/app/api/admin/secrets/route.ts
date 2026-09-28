/**
 * Clés de service saisies depuis Admin > Paramètres > Clés API
 * (Resend, Cloudflare R2), rangées dans `app_secrets`.
 *
 * Ces clés vivaient dans `settings`, que tout visiteur peut lire avec la clé
 * anonyme : elles étaient donc publiques. Ici, une valeur secrète ne
 * redescend jamais vers le navigateur ; `GET` renvoie son état, sa provenance
 * et ses quatre derniers caractères. Seuls les réglages qui ne sont pas des
 * identifiants de connexion (compte, bucket) sont renvoyés en clair.
 *
 * La clé Anthropic garde sa route dédiée (/api/admin/ai-key).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import {
  MANAGED_SECRETS,
  getEnvFallback,
  invalidateSecret,
  isManagedSecretKey,
  type ManagedSecretKey,
} from '../../../../services/secrets';

export const runtime = 'nodejs';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return validateSupabaseToken(token);
}

interface SecretStatus {
  configured: boolean;
  source: 'admin' | 'environment' | null;
  hint: string | null;
  // Seulement pour les réglages non secrets (identifiant de compte, bucket).
  value?: string | null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = Object.keys(MANAGED_SECRETS) as ManagedSecretKey[];
  const admin = getSupabaseAdmin();

  let storage: 'ok' | 'missing_table' | 'no_service_key' = 'ok';
  const stored = new Map<string, string>();
  if (!admin) {
    storage = 'no_service_key';
  } else {
    const { data, error } = await admin.from('app_secrets').select('key, value').in('key', keys);
    if (error) storage = 'missing_table';
    for (const row of data ?? []) {
      const v = String(row.value ?? '').trim();
      if (v) stored.set(row.key as string, v);
    }
  }

  const secrets = {} as Record<ManagedSecretKey, SecretStatus>;
  for (const key of keys) {
    const fromAdmin = stored.get(key) ?? null;
    const fromEnv = getEnvFallback(key);
    const effective = fromAdmin ?? fromEnv;
    const status: SecretStatus = {
      configured: !!effective,
      source: fromAdmin ? 'admin' : fromEnv ? 'environment' : null,
      hint: effective ? `…${effective.slice(-4)}` : null,
    };
    if (!MANAGED_SECRETS[key].secret) status.value = effective;
    secrets[key] = status;
  }

  return NextResponse.json({ secrets, storage });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Enregistrement impossible : la clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) n'est pas configurée sur le serveur." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key ?? '');
  if (!isManagedSecretKey(key)) {
    return NextResponse.json({ error: 'Clé inconnue.' }, { status: 400 });
  }

  // Nettoie un copier-coller : espaces, retours à la ligne, guillemets.
  const value = String(body?.value ?? '').replace(/[\s"'`]/g, '');

  // Valeur vide = retrait : on revient à la variable d'environnement.
  if (!value) {
    const { error } = await admin.from('app_secrets').delete().eq('key', key);
    if (error) {
      return NextResponse.json({ error: `La clé n'a pas pu être retirée : ${error.message}` }, { status: 500 });
    }
    invalidateSecret(key);
    const fromEnv = getEnvFallback(key);
    return NextResponse.json({
      ok: true,
      configured: !!fromEnv,
      source: fromEnv ? 'environment' : null,
      hint: fromEnv ? `…${fromEnv.slice(-4)}` : null,
    });
  }

  const { error } = await admin
    .from('app_secrets')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    const missingTable = error.code === 'PGRST205' || /app_secrets/.test(error.message);
    return NextResponse.json(
      {
        error: missingTable
          ? "La clé n'a pas pu être enregistrée : la table des clés n'existe pas encore dans la base. Appliquez le fichier supabase/a-appliquer/2026-09-27_tables-manquantes.sql dans Supabase (SQL Editor), puis réessayez."
          : `La clé n'a pas pu être enregistrée : ${error.message}`,
      },
      { status: 500 },
    );
  }

  invalidateSecret(key);
  return NextResponse.json({
    ok: true,
    configured: true,
    source: 'admin',
    hint: `…${value.slice(-4)}`,
    ...(MANAGED_SECRETS[key].secret ? {} : { value }),
  });
}
