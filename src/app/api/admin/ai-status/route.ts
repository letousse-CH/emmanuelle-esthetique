/**
 * État de la configuration IA, affiché en bannière dans l'admin.
 * Un seul fournisseur : Claude (Anthropic).
 */
import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig, invalidateAiConfigCache } from '../../../../services/aiConfig';
import { resolveModelSpec } from '../../../../constants/aiModels';
import { getAnthropicKey } from '../../../../services/secrets';
import { getAiStatus, setAiStatus } from '../../../../services/aiStatusCache';
import { supabase } from '../../../../services/supabase';

interface ServiceStatus {
  ok: boolean;
  label: string;
  error: string | null;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  // 1. Authenticate with Supabase JWT
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isAuth = await validateSupabaseToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Un rafraîchissement forcé purge aussi le cache de configuration : c'est le
  // seul moyen, depuis le navigateur, de faire prendre effet immédiatement un
  // changement de modèle sans attendre l'expiration du TTL côté serveur.
  if (forceRefresh) invalidateAiConfigCache();

  const now = Date.now();
  const apiKey = await getAnthropicKey();
  const keyTail = apiKey ? apiKey.slice(-4) : null;

  // Le cache ne vaut que pour la même clé : une clé qu'on vient de coller dans
  // l'admin doit être prise en compte immédiatement.
  const cached = getAiStatus();
  if (cached && !forceRefresh && cached.keyTail === keyTail && now - cached.checkedAt < CACHE_TTL) {
    return NextResponse.json(cached);
  }
  const resendKey = process.env.RESEND_API_KEY;
  // Le stockage lit ses identifiants dans l'environnement, puis dans la table
  // `settings` (saisie depuis Paramètres > Clés des services) : le diagnostic
  // doit regarder aux deux endroits, sinon il dit « À régler » à tort.
  let r2Settings: Record<string, string> = {};
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name']);
    r2Settings = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
  } catch { /* diagnostic seulement : on garde les variables d'environnement */ }
  const r2Configured = Boolean(
    (process.env.R2_ACCOUNT_ID || r2Settings.r2_account_id) &&
    (process.env.R2_ACCESS_KEY_ID || r2Settings.r2_access_key_id) &&
    (process.env.R2_SECRET_ACCESS_KEY || r2Settings.r2_secret_access_key) &&
    (process.env.R2_BUCKET_NAME || r2Settings.r2_bucket_name)
  );

  let error: string | null = null;
  let spec: { id: string; label: string; supportsAdaptiveThinking?: boolean } = { id: '', label: '' };

  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    error = "Aucune clé Claude n'est enregistrée. Ajoutez-la dans Paramètres, rubrique « Clés des services ».";
  } else {
    try {
      const { model } = await getAiConfig(forceRefresh);
      spec = resolveModelSpec(model);
      const client = new Anthropic({ apiKey, timeout: 15000, maxRetries: 0 });
      // Aucun token consommé : on vérifie que la clé est acceptée et que le
      // modèle choisi dans « IA & budget » lui est accessible.
      await client.models.retrieve(spec.id);
    } catch (err: any) {
      const status = err?.status;
      error =
        status === 401 || status === 403
          ? "Anthropic refuse la clé enregistrée. Remplacez-la dans Paramètres, rubrique « Clés des services »."
          : status === 404
            ? `Le modèle choisi (${spec.label || spec.id}) n'est pas accessible avec cette clé. Choisissez-en un autre dans Paramètres, rubrique « IA & budget ».`
            : "Anthropic ne répond pas pour le moment. Réessayez dans quelques minutes.";
      console.error('[ai-status] Anthropic check failed:', error);
    }
  }

  const aiOk = error === null && Boolean(apiKey);
  const resendOk = Boolean(resendKey);
  const r2Ok = r2Configured;
  const dbOk = true; // JWT validé avec succès à l'étape 1

  const status = {
    keyTail,
    ok: aiOk,
    configured: Boolean(apiKey),
    working: aiOk,
    error,
    model: spec.id,
    modelLabel: spec.label,
    services: {
      ai: { ok: aiOk, label: 'Moteur IA (Claude)', error: aiOk ? null : (error || 'Clé API manquante') },
      resend: { ok: resendOk, label: 'Service E-mails (Resend)', error: resendOk ? null : 'RESEND_API_KEY non configurée' },
      r2: { ok: r2Ok, label: 'Stockage Médias (Cloudflare R2)', error: r2Ok ? null : 'Variables R2 non configurées' },
      database: { ok: dbOk, label: 'Base de Données (Supabase)', error: null },
    },
    checkedAt: now,
  };
  setAiStatus(status);

  return NextResponse.json(status);
}
