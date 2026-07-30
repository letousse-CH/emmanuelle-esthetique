import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SITE_CONFIG } from '../../../config/site';
import { sendEmail } from '../../../services/email';
import { buildUnsubToken, isUnsubConfigured } from '../../../utils/unsubToken';

function buildNewsletterHtml(email: string, contentHtml: string): string {
  const unsubToken = buildUnsubToken(email);
  const unsubUrl = `${SITE_CONFIG.url}/api/unsubscribe?e=${unsubToken}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body{margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.7;color:#1c1917}
    .container{max-width:600px;margin:0 auto;padding:24px 20px}
    p{margin:0 0 18px 0}
    a{color:#2563eb;text-decoration:underline}
    .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5}
    .footer a{color:#6b7280;text-decoration:underline}
  </style>
</head>
<body>
  <div class="container">
    <div>${contentHtml}</div>
    <div class="footer">
      Vous recevez cet email car vous êtes inscrit à la newsletter de ${SITE_CONFIG.url.replace(/^https?:\/\//i, '')}.<br/>
      <a href="${unsubUrl}">Se désinscrire</a>
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnon;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 });
    }

    // Une newsletter sans lien de désinscription vérifiable n'est pas
    // envoyable (obligation légale, et le lien serait forgeable).
    if (!isUnsubConfigured()) {
      return NextResponse.json(
        { error: "Envoi impossible : la variable d'environnement UNSUB_SECRET n'est pas configurée, le lien de désinscription serait invalide." },
        { status: 501 }
      );
    }

    const { subject, html, testEmail } = await req.json();
    if (!subject?.trim() || !html?.trim()) {
      return NextResponse.json({ error: 'Objet et contenu requis.' }, { status: 400 });
    }

    // Mode test : envoi uniquement à l'adresse de test spécifiée
    if (testEmail) {
      if (!testEmail.includes('@')) {
        return NextResponse.json({ error: 'Adresse e-mail de test invalide.' }, { status: 400 });
      }

      const emailResult = await sendEmail({
        to: testEmail.trim(),
        subject: `[TEST] ${subject.trim()}`,
        html: buildNewsletterHtml(testEmail.trim(), html),
      });

      if (!emailResult.success) {
        return NextResponse.json({ error: emailResult.error || 'Erreur lors de l\'envoi du mail de test.' }, { status: 500 });
      }

      return NextResponse.json({ sent: 1, failed: 0, total: 1 });
    }

    // Envoi groupé à tous les abonnés actifs
    const dbClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscribers, error: fetchError } = await dbClient
      .from('subscribers')
      .select('email')
      .eq('active', true);

    if (fetchError) {
      console.error('[send-newsletter] Erreur récupération abonnés:', fetchError);
      return NextResponse.json({ error: 'Erreur lors de la récupération des abonnés.' }, { status: 500 });
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0 });
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscribers) {
      if (!sub.email) continue;
      const res = await sendEmail({
        to: sub.email,
        subject: subject.trim(),
        html: buildNewsletterHtml(sub.email, html),
      });

      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
        console.error(`[send-newsletter] Échec d'envoi pour ${sub.email}:`, res.error);
      }
    }

    // Enregistrer la newsletter dans l'historique
    await dbClient.from('newsletters').insert({
      subject: subject.trim(),
      sent_count: sentCount,
      failed_count: failedCount,
    });

    return NextResponse.json({ sent: sentCount, failed: failedCount, total: subscribers.length });
  } catch (err: any) {
    console.error('[send-newsletter] Erreur globale:', err);
    return NextResponse.json({ error: err.message || 'Erreur interne du serveur' }, { status: 500 });
  }
}
