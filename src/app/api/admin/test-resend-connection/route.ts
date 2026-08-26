import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { supabase } from '../../../../services/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let apiKey = body.resendApiKey;
    let fromEmail = body.resendFromEmail;

    if (!apiKey || !fromEmail) {
      const { data } = await supabase.from('settings').select('key, value').in('key', [
        'resend_api_key',
        'resend_from_email',
      ]);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
      apiKey = apiKey || map.resend_api_key;
      fromEmail = fromEmail || map.resend_from_email;
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Clé API Resend manquante." }, { status: 400 });
    }

    // Interroger l'API Resend (endpoint /domains ou /api-keys)
    const res = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        error: `Clé Resend invalide ou refusée : ${errData.message || res.statusText}`,
      }, { status: 400 });
    }

    const domainsData = await res.json();
    return NextResponse.json({
      success: true,
      message: `Clé API Resend 100% valide ! (${domainsData.data?.length || 0} domaine(s) associé(s)).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
