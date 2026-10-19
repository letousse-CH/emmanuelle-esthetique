import { NextResponse } from 'next/server';
import { getSettingsServer } from '../../../../../services/settingsServer';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';

/**
 * Démarre la connexion OAuth Meta (Facebook Pages + Instagram Business).
 *
 * Réservé à l'administrateur : cette route est ouverte par une navigation du
 * navigateur, le jeton de session est donc accepté en paramètre `?token=`.
 * Un `state` aléatoire est posé dans un cookie httpOnly `meta_oauth_state`.
 */
const STATE_COOKIE = 'meta_oauth_state';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;

    const token =
      url.searchParams.get('token') ||
      (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

    if (!(await validateSupabaseToken(token))) {
      return NextResponse.redirect(
        `${origin}/admin/social?tab=identite&meta_error=${encodeURIComponent('Session expirée : reconnectez-vous puis relancez la connexion Meta.')}`,
      );
    }

    const settings = await getSettingsServer(['social_meta_app_id' as any]);
    const appId = ((settings as any).social_meta_app_id || process.env.META_APP_ID || '').trim();

    if (!appId) {
      return NextResponse.redirect(`${origin}/admin/social?tab=identite&meta_error=missing_app_id`);
    }

    const redirectUri = `${origin}/api/admin/meta/callback`;
    const scope = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(',');
    const state = crypto.randomUUID();

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}&response_type=code`;

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/admin/meta',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
