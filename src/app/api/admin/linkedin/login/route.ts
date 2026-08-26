import { NextResponse } from 'next/server';
import { getSettingsServer } from '../../../../../services/settingsServer';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = url.origin;

    const settings = await getSettingsServer(['social_linkedin_client_id' as any]);
    const clientId = (settings as any).social_linkedin_client_id || process.env.LINKEDIN_CLIENT_ID || '770flq5kanpk35';

    const redirectUri = `${origin}/api/admin/linkedin/callback`;
    const scope = encodeURIComponent('openid profile w_member_social w_organization_social');

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=studio_linkedin&scope=${scope}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
