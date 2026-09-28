import { NextResponse, NextRequest } from 'next/server';
import { validateSupabaseToken } from '../../../../utils/apiAuth';
import { getResendApiKey } from '../../../../services/secrets';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isAuth = await validateSupabaseToken(token);

    if (!isAuth) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // Clé vide dans la requête : on teste la clé enregistrée (app_secrets,
    // puis RESEND_API_KEY). Une clé saisie peut être testée avant d'être
    // enregistrée.
    let apiKey = String(body.resendApiKey ?? '').replace(/[\s"'`]/g, '');
    if (!apiKey) apiKey = (await getResendApiKey()) || '';

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Aucune clé Resend n'est enregistrée ni saisie." }, { status: 400 });
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
      message: `Clé Resend valide (${domainsData.data?.length || 0} domaine(s) associé(s)).`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
