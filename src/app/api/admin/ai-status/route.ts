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

let cachedStatus: {
  ok: boolean;
  configured: boolean;
  working: boolean;
  error: string | null;
  /** Modèle testé — celui choisi dans /admin/settings → IA & Budget. */
  model: string;
  modelLabel: string;
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

  if (!apiKey || apiKey === 'MY_ANTHROPIC_API_KEY') {
    cachedStatus = {
      ok: false,
      configured: false,
      working: false,
      error: "ANTHROPIC_API_KEY non configurée dans le fichier d'environnement.",
      model: '',
      modelLabel: '',
      checkedAt: now,
    };
    return NextResponse.json(cachedStatus);
  }

  // Ping léger sur le modèle réellement utilisé par les générations : un test
  // sur un autre modèle pourrait passer au vert alors que celui-ci échoue.
  // Réflexion désactivée : on ne veut qu'un aller-retour, pas une réponse.
  const { model } = await getAiConfig(forceRefresh);
  const spec = resolveModelSpec(model);

  let error: string | null = null;
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: spec.id,
      max_tokens: 8,
      // Les modèles antérieurs à la 4.6 ne connaissent pas ce paramètre.
      ...(spec.supportsAdaptiveThinking ? { thinking: { type: 'disabled' as const } } : {}),
      messages: [{ role: 'user', content: 'Ping' }],
    });
  } catch (err: any) {
    error = err?.message || String(err);
    console.error('[ai-status] Anthropic check failed:', error);
  }

  cachedStatus = {
    ok: error === null,
    configured: true,
    working: error === null,
    error,
    model: spec.id,
    modelLabel: spec.label,
    checkedAt: now,
  };

  return NextResponse.json(cachedStatus);
}
