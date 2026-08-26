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

interface ServiceStatus {
  ok: boolean;
  label: string;
  error: string | null;
}

let cachedStatus: {
  ok: boolean;
  configured: boolean;
  working: boolean;
  error: string | null;
  /** Modèle testé — celui choisi dans /admin/settings → IA & Budget. */
  model: string;
  modelLabel: string;
  services?: {
    ai: ServiceStatus;
    resend: ServiceStatus;
    r2: ServiceStatus;
    database: ServiceStatus;
  };
  checkedAt: number;
} | null = null;

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

  // Return cached version if still valid
  const now = Date.now();
  if (cachedStatus && !forceRefresh && (now - cachedStatus.checkedAt < CACHE_TTL)) {
    return NextResponse.json(cachedStatus);
  }

  const apiKey = await getAnthropicKey();
  const resendKey = process.env.RESEND_API_KEY;
  const r2Configured = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

  let error: string | null = null;
  let spec: { id: string; label: string; supportsAdaptiveThinking?: boolean } = { id: '', label: '' };

  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    error = "ANTHROPIC_API_KEY non configurée dans le fichier d'environnement.";
  } else {
    try {
      const { model } = await getAiConfig(forceRefresh);
      spec = resolveModelSpec(model);
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: spec.id,
        max_tokens: 8,
        ...(spec.supportsAdaptiveThinking ? { thinking: { type: 'disabled' as const } } : {}),
        messages: [{ role: 'user', content: 'Ping' }],
      });
    } catch (err: any) {
      error = err?.message || String(err);
      console.error('[ai-status] Anthropic check failed:', error);
    }
  }

  const aiOk = error === null && Boolean(apiKey);
  const resendOk = Boolean(resendKey);
  const r2Ok = r2Configured;
  const dbOk = true; // JWT validé avec succès à l'étape 1

  cachedStatus = {
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

  return NextResponse.json(cachedStatus);
}
