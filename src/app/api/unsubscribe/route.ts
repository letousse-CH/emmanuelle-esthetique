import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SITE_CONFIG } from '../../../config/site';

function renderHtmlPage(title: string, message: string, isError = false): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ${SITE_CONFIG.name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#fcfbf7;font-family:'Georgia',serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
    .card{background:#fff;border:1px solid #e7e5e4;max-width:480px;width:100%;padding:3rem 2.5rem;text-align:center}
    .icon{font-size:2.5rem;margin-bottom:1.5rem}
    h1{font-size:1.5rem;color:#1c1917;margin-bottom:1rem;font-weight:bold}
    p{color:#78716c;line-height:1.7;margin-bottom:1.5rem}
    a{display:inline-block;color:#98a994;font-size:.8rem;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid #98a994;padding-bottom:2px}
    a:hover{color:#1c1917;border-color:#1c1917}
    .error{color:#dc2626}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isError ? '✗' : '✓'}</div>
    <h1 class="${isError ? 'error' : ''}">${title}</h1>
    <p>${message}</p>
    <a href="${SITE_CONFIG.url}">Retour au site</a>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const encoded = searchParams.get('e') || '';

  if (!encoded) {
    return new NextResponse(
      renderHtmlPage('Lien invalide', 'Ce lien de désinscription est invalide ou incomplet.', true),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  let email: string;
  try {
    const decoded = decodeURIComponent(encoded);
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) throw new Error('format invalide');
    const emailB64 = decoded.slice(0, dotIdx);
    const receivedHmac = decoded.slice(dotIdx + 1);
    const candidate = Buffer.from(emailB64, 'base64url').toString('utf-8').trim();

    const secret = process.env.UNSUB_SECRET || '';
    const expectedHmac = crypto.createHmac('sha256', secret).update(candidate).digest('hex');

    if (
      receivedHmac.length !== expectedHmac.length ||
      !crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
    ) {
      throw new Error('signature invalide');
    }
    email = candidate;
    if (!email.includes('@')) throw new Error('email invalide');
  } catch (err) {
    return new NextResponse(
      renderHtmlPage('Lien invalide', 'Ce lien de désinscription est invalide ou expiré.', true),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const client = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await client
    .from('subscribers')
    .update({ active: false })
    .eq('email', email);

  if (error) {
    return new NextResponse(
      renderHtmlPage('Erreur', `Une erreur s'est produite. Réessayez ou contactez-nous à ${SITE_CONFIG.receiverEmail}`, true),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  const safeEmail = email
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return new NextResponse(
    renderHtmlPage(
      'Désinscription confirmée',
      `L'adresse <strong>${safeEmail}</strong> a bien été retirée de la newsletter.<br/>Vous ne recevrez plus aucun email de notre part.`
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
