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
  const stored = admin
    ? (await admin.from('app_secrets').select('key').eq('key', KEY).maybeSingle()).data
    : null;

  return NextResponse.json({
    configured: !!key,
    // Indique d'où vient la clé active : une clé saisie dans l'admin masque
    // celle de l'environnement, ce qui doit être visible.
    source: stored ? 'admin' : fromEnv ? 'environment' : null,
    hint: key ? `…${key.slice(-4)}` : null,
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
  const value = String(body?.value ?? '').trim();

  // Chaîne vide = suppression, pour revenir à la clé d'environnement.
  if (!value) {
    await admin.from('app_secrets').delete().eq('key', KEY);
    invalidateSecret(KEY);
    return NextResponse.json({ ok: true, configured: false });
  }

  if (!value.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: 'Une clé Anthropic commence par « sk-ant- ». Vérifiez le copier-coller.' },
      { status: 400 },
    );
  }

  // On vérifie la clé avant de l'enregistrer : découvrir qu'elle est invalide
  // au premier article généré serait une perte de temps inutile.
  try {
    const anthropic = new Anthropic({ apiKey: value });
    await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'ping' }],
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Cette clé a été refusée par Anthropic. Vérifiez qu'elle est active."
            : "Impossible de vérifier la clé auprès d'Anthropic. Réessayez.",
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from('app_secrets')
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateSecret(KEY);
  return NextResponse.json({ ok: true, configured: true, hint: `…${value.slice(-4)}` });
}
