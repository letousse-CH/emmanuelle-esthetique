import { NextResponse, type NextRequest } from 'next/server';
import { completeOAuth } from '../../../../../services/metaConnection';

/**
 * Retour du dialogue Facebook. Protégé par le `state` posé au départ (cookie
 * httpOnly) : sans lui, n'importe quel lien pourrait relier un autre compte.
 * Renvoie toujours vers l'écran Réseaux sociaux, avec un message en clair.
 */
export const runtime = 'nodejs';

const STATE_COOKIE = 'meta_oauth_state';

function back(origin: string, params: Record<string, string>) {
  const res = NextResponse.redirect(`${origin}/admin/social?${new URLSearchParams(params).toString()}`);
  res.cookies.delete({ name: STATE_COOKIE, path: '/api/admin/meta' });
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;

  const denied = url.searchParams.get('error');
  if (denied) {
    const reason = url.searchParams.get('error_description') || url.searchParams.get('error_reason') || denied;
    return back(origin, {
      comptes: 'erreur',
      message: denied === 'access_denied' ? 'Connexion annulée dans Facebook.' : `Facebook a refusé la connexion : ${reason}`,
    });
  }

  const state = url.searchParams.get('state') || '';
  const expected = req.cookies.get(STATE_COOKIE)?.value || '';
  if (!state || state !== expected) {
    return back(origin, {
      comptes: 'erreur',
      message: 'La connexion a expiré ou a été ouverte depuis un autre onglet. Relancez-la depuis l’écran Réseaux sociaux.',
    });
  }

  const code = url.searchParams.get('code');
  if (!code) return back(origin, { comptes: 'erreur', message: 'Facebook n’a pas renvoyé de code d’autorisation.' });

  try {
    const outcome = await completeOAuth(code, `${origin}/api/admin/meta/callback`);
    return back(origin, outcome.kind === 'connected' ? { comptes: 'ok' } : { comptes: 'choisir' });
  } catch (err: any) {
    console.error('[meta/callback]', err?.message || err);
    return back(origin, { comptes: 'erreur', message: err?.message || 'Connexion impossible.' });
  }
}
