import { NextResponse, type NextRequest } from 'next/server';
import { completeAuth } from '../../../../../services/googleDrive';

export const runtime = 'nodejs';

/**
 * Retour de Google après le consentement. Pas de session admin ici (redirection
 * de navigateur) : c'est le `state` signé, émis par /connect pour une admin
 * connectée, qui authentifie la demande.
 */
export async function GET(req: NextRequest) {
  const back = new URL('/admin/caisse/depenses', req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const denied = req.nextUrl.searchParams.get('error');

  if (denied || !code) {
    back.searchParams.set('drive', 'erreur');
    back.searchParams.set('message', denied === 'access_denied' ? 'Connexion annulée.' : 'Google n’a pas renvoyé d’autorisation.');
    return NextResponse.redirect(back);
  }
  try {
    await completeAuth(code, state, req.nextUrl.origin);
    back.searchParams.set('drive', 'ok');
  } catch (err) {
    console.error('[google-drive/callback]', err);
    back.searchParams.set('drive', 'erreur');
    back.searchParams.set('message', err instanceof Error ? err.message : 'Connexion à Google Drive impossible.');
  }
  return NextResponse.redirect(back);
}
