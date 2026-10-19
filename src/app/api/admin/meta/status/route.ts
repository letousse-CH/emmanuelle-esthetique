import { NextResponse } from 'next/server';
import { supabase } from '../../../../../services/supabase';
import { getSupabaseAdmin } from '../../../../../utils/supabaseAdmin';
import { getSettingsServer } from '../../../../../services/settingsServer';
import { validateSupabaseToken } from '../../../../../utils/apiAuth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!(await validateSupabaseToken(token))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const keys = [
      'social_meta_app_id',
      'social_meta_token',
      'social_meta_page_token',
      'social_facebook_page_id',
      'social_facebook_page_name',
      'social_instagram_account_id',
      'social_instagram_username',
      'social_linkedin_token',
      'social_linkedin_page_id',
    ] as any[];

    const settings = (await getSettingsServer(keys)) as Record<string, string>;

    const metaToken = (settings.social_meta_token || process.env.META_ACCESS_TOKEN || '').trim();
    const facebookPageId = (settings.social_facebook_page_id || process.env.FACEBOOK_PAGE_ID || '').trim();
    const facebookPageName = (settings.social_facebook_page_name || '').trim();
    const instagramAccountId = (settings.social_instagram_account_id || process.env.INSTAGRAM_ACCOUNT_ID || '').trim();
    const instagramUsername = (settings.social_instagram_username || '').trim();
    const hasMetaAppId = Boolean((settings.social_meta_app_id || process.env.META_APP_ID || '').trim());
    const linkedinConnected = Boolean((settings.social_linkedin_token || process.env.LINKEDIN_ACCESS_TOKEN || '').trim());

    return NextResponse.json({
      connected: Boolean(metaToken && (facebookPageId || instagramAccountId)),
      hasToken: Boolean(metaToken),
      facebookPageId,
      facebookPageName,
      instagramAccountId,
      instagramUsername,
      hasMetaAppId,
      metaAppId: (settings.social_meta_app_id || '').trim(),
      linkedinConnected,
      linkedinPageId: (settings.social_linkedin_page_id || '').trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!(await validateSupabaseToken(token))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const db = getSupabaseAdmin() ?? supabase;

    // Action 1 : Auto-découverte via un Access Token Meta (échange optionnel en Long-Lived + détection FB Page & IG Business)
    if (body.action === 'verify_token') {
      let accessToken = (body.accessToken || '').trim();
      const appId = (body.appId || '').trim();
      const appSecret = (body.appSecret || '').trim();

      if (!accessToken) {
        return NextResponse.json({ error: "Veuillez fournir un jeton d'accès Meta." }, { status: 400 });
      }

      // Si App ID et App Secret sont fournis, tenter de convertir en Long-Lived Token (60j)
      if (appId && appSecret) {
        try {
          const llParams = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: accessToken,
          });
          const llRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${llParams.toString()}`);
          const llData = await llRes.json();
          if (llData.access_token) {
            accessToken = llData.access_token;
          }
        } catch (e) {
          console.warn('[meta/status] Échange Long-Lived Token ignoré:', e);
        }
      }

      // Interroger Graph API pour découvrir automatiquement les Pages Facebook et comptes Instagram Business
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(accessToken)}`,
      );
      const accountsData = await accountsRes.json();

      if (accountsData.error) {
        return NextResponse.json(
          { error: `Erreur Meta Graph API : ${accountsData.error.message}` },
          { status: 400 },
        );
      }

      const pages: any[] = Array.isArray(accountsData?.data) ? accountsData.data : [];
      const selectedPage = pages.find((p) => p.instagram_business_account?.id) || pages[0] || null;
      const igAccount = selectedPage?.instagram_business_account || null;

      const rows: { key: string; value: string }[] = [
        { key: 'social_meta_token', value: accessToken },
      ];
      if (appId) rows.push({ key: 'social_meta_app_id', value: appId });
      if (appSecret) rows.push({ key: 'social_meta_app_secret', value: appSecret });

      if (selectedPage) {
        rows.push(
          { key: 'social_meta_page_token', value: selectedPage.access_token || accessToken },
          { key: 'social_facebook_page_id', value: selectedPage.id || '' },
          { key: 'social_facebook_page_name', value: selectedPage.name || '' },
        );
      }

      if (igAccount?.id) {
        rows.push(
          { key: 'social_instagram_account_id', value: igAccount.id },
          { key: 'social_instagram_username', value: igAccount.username || igAccount.name || '' },
        );
      }

      const { error: saveError } = await db.from('settings').upsert(rows, { onConflict: 'key' });
      if (saveError) {
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        connected: Boolean(selectedPage || igAccount),
        facebookPageId: selectedPage?.id || '',
        facebookPageName: selectedPage?.name || '',
        instagramAccountId: igAccount?.id || '',
        instagramUsername: igAccount?.username || igAccount?.name || '',
        pagesFound: pages.length,
      });
    }

    // Action 2 : Sauvegarde manuelle des identifiants
    if (body.action === 'save_manual') {
      const rows: { key: string; value: string }[] = [];
      if (typeof body.metaAppId === 'string') rows.push({ key: 'social_meta_app_id', value: body.metaAppId.trim() });
      if (typeof body.metaAppSecret === 'string' && body.metaAppSecret.trim()) {
        rows.push({ key: 'social_meta_app_secret', value: body.metaAppSecret.trim() });
      }
      if (typeof body.metaToken === 'string' && body.metaToken.trim()) {
        rows.push({ key: 'social_meta_token', value: body.metaToken.trim() });
      }
      if (typeof body.facebookPageId === 'string') {
        rows.push({ key: 'social_facebook_page_id', value: body.facebookPageId.trim() });
      }
      if (typeof body.facebookPageName === 'string') {
        rows.push({ key: 'social_facebook_page_name', value: body.facebookPageName.trim() });
      }
      if (typeof body.instagramAccountId === 'string') {
        rows.push({ key: 'social_instagram_account_id', value: body.instagramAccountId.trim() });
      }
      if (typeof body.instagramUsername === 'string') {
        rows.push({ key: 'social_instagram_username', value: body.instagramUsername.trim() });
      }

      if (rows.length > 0) {
        const { error: saveError } = await db.from('settings').upsert(rows, { onConflict: 'key' });
        if (saveError) {
          return NextResponse.json({ error: saveError.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    // Action 3 : Déconnexion
    if (body.action === 'disconnect') {
      const rows = [
        { key: 'social_meta_token', value: '' },
        { key: 'social_meta_page_token', value: '' },
        { key: 'social_facebook_page_id', value: '' },
        { key: 'social_facebook_page_name', value: '' },
        { key: 'social_instagram_account_id', value: '' },
        { key: 'social_instagram_username', value: '' },
      ];
      await db.from('settings').upsert(rows, { onConflict: 'key' });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
