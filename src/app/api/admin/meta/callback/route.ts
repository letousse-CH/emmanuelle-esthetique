import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '../../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';
import { getSettingsServer } from '../../../../../services/settingsServer';

const STATE_COOKIE = 'meta_oauth_state';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('error_message');

    if (error) {
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent(errorDescription || error)}`,
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent('Code OAuth Meta manquant')}`,
      );
    }

    const state = url.searchParams.get('state') || '';
    const expectedState = request.cookies.get(STATE_COOKIE)?.value || '';
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent('Connexion Meta refusée : état de session invalide. Relancez depuis le Studio Social.')}`,
      );
    }

    const settings = await getSettingsServer([
      'social_meta_app_id' as any,
      'social_meta_app_secret' as any,
    ]);

    const appId = ((settings as any).social_meta_app_id || process.env.META_APP_ID || '').trim();
    const appSecret = ((settings as any).social_meta_app_secret || process.env.META_APP_SECRET || '').trim();

    if (!appId || !appSecret) {
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent('Identifiants App Meta manquants (App ID / App Secret).')}`,
      );
    }

    const redirectUri = `${url.origin}/api/admin/meta/callback`;

    // 1. Échange du code contre un User Access Token court
    const tokenParams = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      client_secret: appSecret,
      code,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const msg = tokenData.error?.message || 'Erreur lors de la récupération du jeton Meta';
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent(msg)}`,
      );
    }

    let longLivedToken: string = tokenData.access_token;

    // 2. Échange contre un Long-Lived Token (60 jours)
    try {
      const llParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenData.access_token,
      });
      const llRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${llParams.toString()}`);
      const llData = await llRes.json();
      if (llData.access_token) {
        longLivedToken = llData.access_token;
      }
    } catch (e) {
      console.warn('[meta/callback] Échange Long-Lived Token ignoré:', e);
    }

    // 3. Découverte automatique de la Page Facebook et du compte Instagram Business rattaché
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(longLivedToken)}`,
    );
    const accountsData = await accountsRes.json();
    const pages: any[] = Array.isArray(accountsData?.data) ? accountsData.data : [];

    // Privilégier une page qui possède un compte Instagram Business rattaché, sinon la première page
    const selectedPage = pages.find((p) => p.instagram_business_account?.id) || pages[0] || null;
    const igAccount = selectedPage?.instagram_business_account || null;

    const rowsToSave: { key: string; value: string }[] = [
      { key: 'social_meta_token', value: longLivedToken },
    ];

    if (selectedPage) {
      rowsToSave.push(
        { key: 'social_meta_page_token', value: selectedPage.access_token || longLivedToken },
        { key: 'social_facebook_page_id', value: selectedPage.id || '' },
        { key: 'social_facebook_page_name', value: selectedPage.name || '' },
      );
    }

    if (igAccount?.id) {
      rowsToSave.push(
        { key: 'social_instagram_account_id', value: igAccount.id },
        { key: 'social_instagram_username', value: igAccount.username || igAccount.name || '' },
      );
    }

    const db = getSupabaseAdmin() ?? supabase;
    const { error: saveError } = await db.from('settings').upsert(rowsToSave, { onConflict: 'key' });
    if (saveError) {
      return NextResponse.redirect(
        `${url.origin}/admin/social?tab=identite&meta_error=${encodeURIComponent("Le jeton Meta n'a pas pu être enregistré : " + saveError.message)}`,
      );
    }

    const done = NextResponse.redirect(`${url.origin}/admin/social?tab=identite&meta_connected=1`);
    done.cookies.delete({ name: STATE_COOKIE, path: '/api/admin/meta' });
    return done;
  } catch (err: any) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      `${origin}/admin/social?tab=identite&meta_error=${encodeURIComponent(err.message || 'Erreur OAuth Meta')}`,
    );
  }
}
