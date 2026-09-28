import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '../../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';

const STATE_COOKIE = 'li_oauth_state';
import { getSettingsServer } from '../../../../../services/settingsServer';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    if (error) {
      return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${url.origin}/admin/settings?error=Code authorization manquant`);
    }

    // Le state doit correspondre au cookie posé par /login (session admin
    // vérifiée) : sinon n'importe qui pourrait brancher son propre compte.
    const state = url.searchParams.get('state') || '';
    const expectedState = request.cookies.get(STATE_COOKIE)?.value || '';
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent('Connexion LinkedIn refusée : relancez-la depuis les paramètres du Studio.')}`);
    }

    const settings = await getSettingsServer([
      'social_linkedin_client_id' as any,
      'social_linkedin_client_secret' as any,
    ]);

    const clientId = (settings as any).social_linkedin_client_id || process.env.LINKEDIN_CLIENT_ID || '770flq5kanpk35';
    // Le secret n'est plus jamais codé en dur : réglages du Studio, sinon variable d'environnement.
    const clientSecret = (settings as any).social_linkedin_client_secret || process.env.LINKEDIN_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent('Identifiants LinkedIn manquants : renseignez LINKEDIN_CLIENT_ID et LINKEDIN_CLIENT_SECRET.')}`);
    }
    const redirectUri = `${url.origin}/api/admin/linkedin/callback`;

    // Échange du code contre le véritable Jeton d'Accès (Access Token)
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      // Sauvegarder automatiquement le jeton dans les paramètres Supabase
      // Écriture côté serveur : le client anonyme n'a pas le droit d'écrire
      // dans `settings`, l'enregistrement échouait donc sans le dire.
      const db = getSupabaseAdmin() ?? supabase;
      const { error: saveError } = await db.from('settings').upsert([
        { key: 'social_linkedin_token', value: tokenData.access_token },
      ], { onConflict: 'key' });
      if (saveError) {
        return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent("Le jeton LinkedIn n'a pas pu être enregistré : " + saveError.message)}`);
      }

      const done = NextResponse.redirect(`${url.origin}/admin/settings?success=linkedin_connected`);
      done.cookies.delete({ name: STATE_COOKIE, path: '/api/admin/linkedin' });
      return done;
    } else {
      const msg = tokenData.error_description || tokenData.error || 'Erreur lors de la génération du jeton LinkedIn';
      return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent(msg)}`);
    }
  } catch (err: any) {
    return NextResponse.redirect(`${request.url.split('/api/')[0]}/admin/settings?error=${encodeURIComponent(err.message)}`);
  }
}
