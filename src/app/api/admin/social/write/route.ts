import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../../config/modules';
import { resolveSource, writeSocialPost, type WritingSource } from '../../../../../services/socialWriting';
import { getSecretOrEnv } from '../../../../../services/secrets';

/**
 * Rédige une publication à partir d'une idée, d'un soin de la carte, d'un
 * article ou d'une offre du moment.
 *
 * POST { source: { kind, text | id }, instruction?, kind?: 'post' | 'story' | 'reel' }
 *   → { eyebrow, headline, caption, hashtags, scenes?, mood?, source: { kind, ref, title, linkPath, photoUrl } }
 */
export const runtime = 'nodejs';
// Appel IA synchrone : voir src/utils/ai.ts (mode « quick »).
export const maxDuration = 60;

function parseSource(raw: any): WritingSource | null {
  const kind = raw?.kind;
  if (kind === 'idee') return { kind, text: String(raw.text || '') };
  if (kind === 'soin' || kind === 'article' || kind === 'offre') {
    const id = String(raw.id || '');
    return id ? { kind, id } : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  if (!(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json({ error: 'La rédaction par l’IA est désactivée (Réglages › Modules).' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const source = parseSource(body?.source);
  if (!source) return NextResponse.json({ error: 'Choisissez de quoi parler.' }, { status: 400 });

  try {
    const resolved = await resolveSource(source);
    const kind = body?.kind === 'story' || body?.kind === 'reel' ? body.kind : 'post';
    const videoAvailable = kind === 'reel' && Boolean(await getSecretOrEnv('pexels_api_key'));
    const plannedFor = typeof body?.plannedFor === 'string' && !Number.isNaN(Date.parse(body.plannedFor)) ? body.plannedFor : null;
    const writing = await writeSocialPost(resolved, typeof body.instruction === 'string' ? body.instruction : undefined, kind, videoAvailable, plannedFor);
    return NextResponse.json({
      ...writing,
      source: {
        kind: resolved.kind,
        ref: resolved.ref,
        title: resolved.title,
        linkPath: resolved.linkPath,
        photoUrl: resolved.photoUrl,
      },
    });
  } catch (err: any) {
    const message = err?.message === 'not_configured'
      ? 'Aucune clé IA n’est configurée (Réglages › IA & Budget). Vous pouvez écrire le texte vous-même.'
      : err?.message || 'La rédaction a échoué.';
    return NextResponse.json({ error: message }, { status: err?.message === 'not_configured' ? 503 : 500 });
  }
}
