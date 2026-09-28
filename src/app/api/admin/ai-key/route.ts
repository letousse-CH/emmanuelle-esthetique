/**
 * Gestion de la clé d'API Anthropic saisie depuis l'admin.
 *
 * La valeur ne redescend jamais vers le navigateur : `GET` renvoie seulement
 * son état et ses quatre derniers caractères, de quoi vérifier qu'on a bien
 * collé la bonne clé sans jamais la réafficher en clair.
 */
import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getSupabaseAdmin } from '../../../../utils/supabaseAdmin';
import { getAnthropicKey, invalidateSecret } from '../../../../services/secrets';
import { invalidateAiStatus } from '../../../../services/aiStatusCache';

export const runtime = 'nodejs';

const KEY = 'anthropic_api_key';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return validateSupabaseToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = await getAnthropicKey();
  const fromEnv = !!process.env.ANTHROPIC_API_KEY?.trim();
  const admin = getSupabaseAdmin();

  // Vérifie aussi que la table de stockage existe : sans elle, aucune clé
  // saisie ici ne peut être enregistrée, et l'écran doit le dire d'emblée.
  let storage: 'ok' | 'missing_table' | 'no_service_key' = 'ok';
  let stored = false;
  if (!admin) {
    storage = 'no_service_key';
  } else {
    const { data, error } = await admin.from('app_secrets').select('key').eq('key', KEY).maybeSingle();
    if (error) storage = 'missing_table';
    stored = !!data;
  }

  return NextResponse.json({
    configured: !!key,
    // Indique d'où vient la clé active : une clé saisie dans l'admin masque
    // celle de l'environnement, ce qui doit être visible.
    source: stored ? 'admin' : fromEnv ? 'environment' : null,
    hint: key ? `…${key.slice(-4)}` : null,
    storage,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  // Nettoie un copier-coller : espaces, retours à la ligne, guillemets.
  const value = String(body?.value ?? '').replace(/[\s"'`]/g, '');

  // Chaîne vide = suppression, pour revenir à la clé d'environnement.
  if (!value) {
    const { error: deleteError } = await admin.from('app_secrets').delete().eq('key', KEY);
    if (deleteError) {
      // Une erreur ignorée ici faisait croire à un retrait qui n'avait pas eu lieu.
      return NextResponse.json(
        { error: `La clé n'a pas pu être retirée : ${deleteError.message}` },
        { status: 500 },
      );
    }
    invalidateSecret(KEY);
    invalidateAiStatus();
    return NextResponse.json({ ok: true, configured: false });
  }

  if (!value.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: 'Une clé Anthropic commence par « sk-ant- ». Vérifiez le copier-coller.' },
      { status: 400 },
    );
  }

  // Vérification sans coût : la liste des modèles ne consomme aucun token et
  // ne dépend d'aucun modèle précis (l'ancien test visait un identifiant de
  // modèle figé, qui faisait échouer des clés valides). Seul un refus explicite
  // (401/403) bloque l'enregistrement ; une panne passagère n'empêche pas de
  // ranger la clé.
  let warning: string | null = null;
  try {
    const anthropic = new Anthropic({ apiKey: value, timeout: 15000, maxRetries: 0 });
    await anthropic.models.list({ limit: 1 });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "Anthropic refuse cette clé. Vérifiez qu'elle est active sur platform.claude.com, puis recollez-la en entier." },
        { status: 400 },
      );
    }
    warning = "Clé enregistrée, mais Anthropic n'a pas pu la confirmer tout de suite. Le bandeau d'état se mettra à jour dans quelques minutes.";
  }

  const { error } = await admin
    .from('app_secrets')
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    // Table absente : la migration `20260819_app_secrets.sql` n'a pas été
    // appliquée. Le message brut de Supabase n'aidait personne.
    const missingTable = error.code === 'PGRST205' || /app_secrets/.test(error.message);
    return NextResponse.json(
      {
        error: missingTable
          ? "La clé est valide mais n'a pas pu être enregistrée : la table des clés n'existe pas encore dans la base. Appliquez le fichier supabase/a-appliquer/2026-09-27_tables-manquantes.sql dans Supabase (SQL Editor), puis réessayez."
          : `La clé n'a pas pu être enregistrée : ${error.message}`,
      },
      { status: 500 },
    );
  }

  invalidateSecret(KEY);
  invalidateAiStatus();
  return NextResponse.json({ ok: true, configured: true, hint: `…${value.slice(-4)}`, warning });
}
