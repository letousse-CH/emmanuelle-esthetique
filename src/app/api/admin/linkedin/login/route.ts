import { NextResponse } from 'next/server';
import { getSettingsServer } from '../../../../../services/settingsServer';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';

/**
 * Démarre la connexion OAuth LinkedIn.
 *
 * Réservé à l'administrateur : cette route est ouverte par une navigation du
 * navigateur (pas d'en-tête Authorization possible), le jeton de session est
 * donc accepté en paramètre `?token=`. Un `state` aléatoire est posé dans un
 * cookie httpOnly ; le callback refuse toute réponse qui ne le présente pas,
 * ce qui empêche un tiers de connecter son propre compte LinkedIn au site.
 */
const STATE_COOKIE = 'li_oauth_state';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;

    const token =
      url.searchParams.get('token') ||
      (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!(await validateSupabaseToken(token))) {
      return NextResponse.redirect(
        `${origin}/admin/settings?error=${encodeURIComponent('Session expirée : reconnectez-vous puis relancez la connexion LinkedIn depuis les paramètres.')}`,
      );
    }

    const settings = await getSettingsServer(['social_linkedin_client_id' as any]);
    // L'identifiant client LinkedIn est public (il apparaît dans l'URL d'autorisation).
    const clientId = (settings as any).social_linkedin_client_id || process.env.LINKEDIN_CLIENT_ID || '770flq5kanpk35';

    const redirectUri = `${origin}/api/admin/linkedin/callback`;
    const scope = encodeURIComponent('openid profile w_member_social w_organization_social');
    const state = crypto.randomUUID();

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/admin/linkedin',
    });
    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
