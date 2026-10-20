import { NextResponse, type NextRequest } from 'next/server';
import { validateSupabaseToken, getBearerToken } from '../../../../../utils/apiAuth';
import { getMetaApp, META_SCOPES } from '../../../../../services/metaConnection';
import { oauthDialogUrl } from '../../../../../services/metaGraph';
import { publicOrigin } from '../../../../../utils/publicOrigin';

/**
 * Démarre la connexion Facebook + Instagram.
 *
 * Appelée en POST par l'écran (jeton de session dans l'en-tête, jamais dans
 * l'URL), elle renvoie l'adresse du dialogue Facebook et pose un `state`
 * aléatoire dans un cookie httpOnly, vérifié au retour (`callback`).
 */
export const runtime = 'nodejs';

const STATE_COOKIE = 'meta_oauth_state';

export async function POST(req: NextRequest) {
  if (!(await validateSupabaseToken(getBearerToken(req)))) {
    return NextResponse.json({ error: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  }
  try {
    const app = await getMetaApp();
    if (!app.appId || !app.appSecret) {
      return NextResponse.json({ error: 'Renseignez d’abord l’App ID et l’App Secret (étape 1).' }, { status: 400 });
    }
    const origin = publicOrigin(req);
    const state = crypto.randomUUID();
    const url = oauthDialogUrl({
      appId: app.appId,
      redirectUri: `${origin}/api/admin/meta/callback`,
      state,
      scopes: META_SCOPES,
      configId: app.configId || null,
    });
    const res = NextResponse.json({ url });
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: origin.startsWith('https:'),
      sameSite: 'lax',
      maxAge: 900,
      path: '/api/admin/meta',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Connexion impossible.' }, { status: 500 });
  }
}
