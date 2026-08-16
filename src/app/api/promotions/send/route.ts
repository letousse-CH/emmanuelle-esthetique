import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SITE_CONFIG } from '../../../../config/site';
import { plainTextToSimpleHtml, sendEmail } from '../../../../services/email';
import { buildUnsubToken, isUnsubConfigured } from '../../../../utils/unsubToken';
import { buildAudience, renderMessage } from '../../../../types/promotions';
import type { Promotion, Subscriber } from '../../../../types/promotions';
import type { Client, ClientStats } from '../../../../types/caisse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Nombre de destinataires servis par appel.
 *
 * Une fonction Netlify s'arrête au bout de dix secondes, et Resend prend deux
 * à quatre dixièmes de seconde par message : au-delà d'une quinzaine d'envois,
 * la requête serait coupée en plein milieu. La route sert donc un paquet puis
 * rend la main avec `remaining`, et le navigateur rappelle jusqu'à zéro.
 *
 * Ce découpage est sans danger parce que chaque envoi est journalisé dans
 * `promotion_sends`, dont la contrainte d'unicité garantit que personne ne
 * reçoit deux fois — y compris si un appel est coupé après l'envoi mais avant
 * la réponse.
 */
const BATCH = 12;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Enveloppe de l'e-mail promotionnel. Le pied de page n'est pas décoratif :
 * la LCD (art. 3 al. 1 let. o) impose d'identifier correctement l'expéditeur et
 * d'offrir un refus gratuit et facile.
 */
function buildHtml(contentHtml: string, unsubUrl: string): string {
  const domaine = SITE_CONFIG.url.replace(/^https?:\/\//i, '');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body{margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#1c1917}
    .container{max-width:600px;margin:0 auto;padding:24px 20px}
    .footer{margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5}
    .footer a{color:#6b7280;text-decoration:underline}
  </style>
</head>
<body>
  <div class="container">
    <div>${contentHtml}</div>
    <div class="footer">
      ${escapeHtml(SITE_CONFIG.name)} — ${escapeHtml(domaine)}<br/>
      Vous recevez ce message parce que vous avez accepté de recevoir nos offres.<br/>
      <a href="${unsubUrl}">Ne plus recevoir nos offres</a>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Non autorisé. Token manquant.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnon;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Session invalide ou expirée.' }, { status: 401 });
  }

  // Sans secret, le lien de désinscription serait forgeable par n'importe qui :
  // on refuse d'envoyer plutôt que de promettre un refus qui ne protège rien.
  if (!isUnsubConfigured()) {
    return NextResponse.json(
      { error: "Envoi impossible : UNSUB_SECRET n'est pas configurée, le lien de désinscription serait invalide." },
      { status: 501 },
    );
  }

  const { promotionId, testEmail } = await req.json().catch(() => ({}));
  if (!promotionId) {
    return NextResponse.json({ error: 'Promotion manquante.' }, { status: 400 });
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  const { data: promoRow, error: promoError } = await db
    .from('promotions').select('*').eq('id', promotionId).maybeSingle();
  if (promoError) return NextResponse.json({ error: promoError.message }, { status: 500 });
  if (!promoRow) return NextResponse.json({ error: 'Promotion introuvable.' }, { status: 404 });

  const promo = promoRow as Promotion;
  const corps = (promo.message_email ?? '').trim();
  const objet = (promo.objet ?? '').trim();
  if (!objet || !corps) {
    return NextResponse.json({ error: 'Objet et message e-mail requis.' }, { status: 400 });
  }

  // ── Essai à blanc : une seule adresse, aucune trace au journal ─────────────
  if (testEmail) {
    if (!String(testEmail).includes('@')) {
      return NextResponse.json({ error: 'Adresse de test invalide.' }, { status: 400 });
    }
    const dest = String(testEmail).trim();
    const unsub = `${SITE_CONFIG.url}/api/unsubscribe?e=${buildUnsubToken(dest)}`;
    const html = buildHtml(
      plainTextToSimpleHtml(escapeHtml(renderMessage(corps, { nom: 'Prénom Nom' }))),
      unsub,
    );
    const res = await sendEmail({ to: dest, subject: `[TEST] ${objet}`, html });
    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Envoi de test impossible.' }, { status: 500 });
    }
    return NextResponse.json({ sent: 1, failed: 0, skipped: 0, remaining: 0, total: 1, errors: [] });
  }

  // ── Audience recalculée ici, jamais reçue du navigateur ───────────────────
  const [clientsRes, statsRes, subsRes, sentRes] = await Promise.all([
    db.from('clients').select('*').eq('archived', false).limit(10000),
    db.from('client_stats').select('*').limit(10000),
    db.from('subscribers').select('id, email, active, created_at').limit(10000),
    db.from('promotion_sends').select('destinataire').eq('promotion_id', promo.id).eq('canal', 'email').limit(10000),
  ]);

  const firstError = clientsRes.error || statsRes.error || subsRes.error || sentRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const stats = new Map<string, ClientStats>(
    ((statsRes.data ?? []) as ClientStats[]).map(s => [s.client_id, s]),
  );

  const audience = buildAudience({
    clients: (clientsRes.data ?? []) as Client[],
    stats,
    subscribers: (subsRes.data ?? []) as Subscriber[],
    segment: promo.segment,
    params: promo.segment_params ?? {},
  }).filter(e => e.joignableEmail && e.email);

  const dejaServis = new Set(
    ((sentRes.data ?? []) as { destinataire: string }[]).map(r => r.destinataire.toLowerCase()),
  );
  const restants = audience.filter(e => !dejaServis.has(e.email!.toLowerCase()));
  const lot = restants.slice(0, BATCH);

  if (promo.status === 'brouillon') {
    await db.from('promotions')
      .update({ status: 'en_cours', updated_at: new Date().toISOString() })
      .eq('id', promo.id);
  }

  let sent = 0;
  let failed = 0;
  const errors: { destinataire: string; error: string }[] = [];

  for (const entry of lot) {
    const dest = entry.email!;
    const unsub = `${SITE_CONFIG.url}/api/unsubscribe?e=${buildUnsubToken(dest)}`;
    // On échappe AVANT de mettre en paragraphes : le message est saisi en texte
    // brut, un « < » tapé par erreur ne doit pas devenir une balise.
    const html = buildHtml(
      plainTextToSimpleHtml(escapeHtml(renderMessage(corps, entry))),
      unsub,
    );

    const res = await sendEmail({ to: dest, subject: objet, html });
    if (res.success) sent += 1; else { failed += 1; errors.push({ destinataire: dest, error: res.error || 'Erreur inconnue' }); }

    await db.from('promotion_sends').upsert({
      promotion_id: promo.id,
      client_id: entry.clientId,
      subscriber_id: entry.subscriberId,
      canal: 'email',
      destinataire: dest,
      status: res.success ? 'envoye' : 'echec',
      error: res.success ? null : (res.error ?? null),
    }, { onConflict: 'promotion_id,canal,destinataire', ignoreDuplicates: false });
  }

  const remaining = Math.max(0, restants.length - lot.length);

  // La promotion n'est « envoyée » que si plus personne n'attend ET que le
  // canal WhatsApp n'est pas de la partie : là-bas c'est un geste manuel, la
  // clôture appartient à l'utilisatrice.
  if (remaining === 0 && promo.canal === 'email') {
    await db.from('promotions')
      .update({ status: 'envoyee', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', promo.id);
  }

  return NextResponse.json({
    sent,
    failed,
    skipped: dejaServis.size,
    remaining,
    total: audience.length,
    errors,
  });
}
