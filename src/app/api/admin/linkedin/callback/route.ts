import { NextResponse } from 'next/server';
import { supabase } from '../../../../../services/supabase';
import { getSettingsServer } from '../../../../../services/settingsServer';

export async function GET(request: Request) {
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

    const settings = await getSettingsServer([
      'social_linkedin_client_id' as any,
      'social_linkedin_client_secret' as any,
    ]);

    const clientId = (settings as any).social_linkedin_client_id || process.env.LINKEDIN_CLIENT_ID || '770flq5kanpk35';
    const clientSecret = (settings as any).social_linkedin_client_secret || process.env.LINKEDIN_CLIENT_SECRET || 'WPL_AP1.DWjJmw1gavYrqZ';
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
      await supabase.from('settings').upsert([
        { key: 'social_linkedin_token', value: tokenData.access_token },
      ], { onConflict: 'key' });

      return NextResponse.redirect(`${url.origin}/admin/settings?success=linkedin_connected`);
    } else {
      const msg = tokenData.error_description || tokenData.error || 'Erreur lors de la génération du jeton LinkedIn';
      return NextResponse.redirect(`${url.origin}/admin/settings?error=${encodeURIComponent(msg)}`);
    }
  } catch (err: any) {
    return NextResponse.redirect(`${request.url.split('/api/')[0]}/admin/settings?error=${encodeURIComponent(err.message)}`);
  }
}
