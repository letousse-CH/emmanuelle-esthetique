import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SITE_CONFIG } from '../../../config/site';
import { sendEmail } from '../../../services/email';

const SESSION_URL = `${SITE_CONFIG.url}/a-propos`;

async function getPromoSettings(client: any): Promise<{ code: string; amount: string }> {
  const { data } = await client
    .from('settings')
    .select('key, value')
    .in('key', ['promo_code', 'promo_amount']);
  const map: Record<string, string> = {};
  if (data) data.forEach((r: any) => { map[r.key] = r.value; });
  return {
    code:   map.promo_code   || 'BIENVENUE',
    amount: map.promo_amount || '20 CHF',
  };
}

function expiryDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildUnsubToken(email: string): string {
  const secret = process.env.UNSUB_SECRET || '';
  const emailB64 = Buffer.from(email).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(email).digest('hex');
  return encodeURIComponent(`${emailB64}.${hmac}`);
}

function buildWelcomeHtml(email: string, promoCode: string, promoAmount: string): string {
  const unsubToken = buildUnsubToken(email);
  const unsubUrl   = `${SITE_CONFIG.url}/api/unsubscribe?e=${unsubToken}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue dans la communauté | ${SITE_CONFIG.name}</title>
  <style>
    body { margin:0; padding:0; background:#fcfbf7; font-family:Georgia,'Times New Roman',serif; }
    .wrapper { max-width:620px; margin:0 auto; background:#fff; }
    .header { background:#1c1917; padding:32px 40px; text-align:center; }
    .header span { color:#98a994; font-size:11px; letter-spacing:0.3em; text-transform:uppercase; }
    .body { padding:48px 40px; color:#57534e; font-size:17px; line-height:1.8; }
    .body h1 { font-family:Georgia,serif; color:#1c1917; font-size:1.75rem; font-weight:bold; margin-bottom:1.5rem; }
    .body p { margin-bottom:1.25rem; }
    .body strong { font-weight:700; color:#1c1917; }
    .body em { font-style:italic; }
    .promo {
      border:2px dashed #98a994;
      background:#f8faf8;
      padding:1.5rem 2rem;
      margin:2rem 0;
      text-align:center;
      border-radius:0.5rem;
    }
    .promo-label { font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:#98a994; margin-bottom:0.5rem; }
    .promo-code { font-family:monospace; font-size:2rem; font-weight:bold; color:#1c1917; letter-spacing:0.15em; }
    .promo-desc { font-size:14px; color:#78716c; margin-top:0.5rem; }
    .cta {
      display:inline-block; margin-top:8px; background:#98a994; color:#ffffff !important;
      padding:15px 36px; border-radius:999px; font-size:13px; letter-spacing:0.15em;
      text-transform:uppercase; font-weight:bold; text-decoration:none;
    }
    .divider { height:1px; background:#f0ede8; margin:0 40px; }
    .footer { padding:24px 40px; text-align:center; font-size:11px; color:#a8a29e; line-height:1.8; }
    .footer a { color:#a8a29e; text-decoration:underline; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span>${SITE_CONFIG.name} &nbsp;·&nbsp; ${SITE_CONFIG.owner}</span>
    </div>
    <div class="body">
      <h1>Bienvenue dans l'espace de libération ✦</h1>

      <p>Merci de rejoindre cet espace de clarté, de décodage et de reconstruction personnelle. C'est un honneur de vous accueillir.</p>

      <p>Vous recevrez régulièrement des analyses de profils complexes (personnalités toxiques, manipulatrices ou perverses), des conseils pour poser des limites saines et des stratégies concrètes pour briser l'emprise psychologique — des clés pour comprendre et reprendre le contrôle.</p>

      <p>Pour marquer ce départ, je vous offre une réduction sur votre premier entretien ou accompagnement :</p>

      <div class="promo">
        <p class="promo-label">Votre code de bienvenue</p>
        <p class="promo-code">${promoCode}</p>
        <p class="promo-desc">Réduction de <strong>${promoAmount}</strong> sur votre première session<br/>À mentionner lors de votre prise de contact.</p>
        <p style="font-size:12px;color:#a8a29e;margin-top:0.75rem;">Valable jusqu'au <strong>${expiryDate()}</strong></p>
      </div>

      <p>La session Découverte ou l'entretien stratégique est une invitation à poser les bases de votre reconstruction et à identifier les mécanismes de manipulation subis.</p>

      <div style="text-align:center; margin-top:2rem;">
        <a class="cta" href="${SESSION_URL}">Découvrir les accompagnements</a>
      </div>

      <p style="margin-top:2.5rem; font-style:italic; color:#78716c; font-size:15px;">
        "On ne guérit pas d'une relation toxique par le simple passage du temps. On en guérit en comprenant les codes du bourreau et en appliquant une contre-stratégie implacable."
      </p>
      <p style="font-size:15px; color:#78716c;">— Matthieu Le Tousse</p>
    </div>
    <div class="divider"></div>
    <div class="footer">
      <p>Vous recevez cet email car vous venez de vous inscrire sur<br/>
      <a href="${SITE_CONFIG.url}">${SITE_CONFIG.url.replace(/^https?:\/\//i, '')}</a></p>
      <p style="margin-top:6px;"><a href="${unsubUrl}">Se désinscrire</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Non autorisé. Token manquant.' }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const client = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier que l'email est bien inscrit
    const { data: subscriber, error: fetchError } = await client
      .from('subscribers')
      .select('id, active')
      .eq('email', email)
      .single();

    if (fetchError || !subscriber) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Récupérer les codes promo dans les settings
    const promo = await getPromoSettings(client);

    // Utilisation du service e-mail centralisé
    const emailResult = await sendEmail({
      to: email,
      subject: 'Bienvenue dans la communauté ✦ + votre cadeau',
      html: buildWelcomeHtml(email, promo.code, promo.amount),
    });

    if (!emailResult.success) {
      console.error('[welcome-email] Erreur envoi email bienvenue:', emailResult.error);
      return NextResponse.json({ error: 'smtp_error' }, { status: 500 });
    }

    // Marquer welcome_sent + welcome_sent_at dans la base de données
    await client
      .from('subscribers')
      .update({ welcome_sent: true, welcome_sent_at: new Date().toISOString() })
      .eq('email', email);

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error('[welcome-email] Erreur envoi email bienvenue:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
