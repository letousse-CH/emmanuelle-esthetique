import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { SITE_CONFIG, getBusinessInfoServer } from '../../../config/site';
import { sendEmail } from '../../../services/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  // @ts-ignore
  apiVersion: '2026-04-22.dahlia',
});

function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function sendInstallmentEmail(opts: {
  email: string;
  firstName: string;
  eventTitle: string;
  totalChf: number;
  installmentChf: number;
  date2: string;
  date3: string;
  link2: string;
  link3: string;
}) {
  const { email, firstName, eventTitle, totalChf, installmentChf, date2, date3, link2, link3 } = opts;
  const business = await getBusinessInfoServer();

  const remainder = totalChf - installmentChf * 2;

  await sendEmail({
    to: email,
    subject: `Votre inscription — ${eventTitle}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f2;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">

        <!-- En-tête -->
        <tr><td style="background:#1c1917;padding:32px 40px;text-align:center;">
          <p style="margin:0;color:#7a8c6e;font-size:11px;letter-spacing:4px;text-transform:uppercase;font-family:Arial,sans-serif;">${SITE_CONFIG.name}</p>
          <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;font-weight:normal;">Inscription confirmée</h1>
        </td></tr>

        <!-- Corps -->
        <tr><td style="padding:40px;">
          <p style="color:#57534e;font-size:16px;line-height:1.7;margin:0 0 20px;">Bonjour ${firstName},</p>
          <p style="color:#57534e;font-size:16px;line-height:1.7;margin:0 0 28px;">
            Votre 1er versement pour <strong style="color:#1c1917;">${eventTitle}</strong> a bien été reçu. Merci !
          </p>

          <!-- Tableau des versements -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e4;margin-bottom:32px;">
            <tr style="background:#f5f4f2;">
              <td style="padding:12px 16px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#a8a29e;">Versement</td>
              <td style="padding:12px 16px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#a8a29e;">Date</td>
              <td style="padding:12px 16px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#a8a29e;text-align:right;">Montant</td>
            </tr>
            <tr style="border-top:1px solid #e7e5e4;">
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;">1er versement ✓</td>
              <td style="padding:14px 16px;color:#57534e;font-size:14px;">Aujourd'hui</td>
              <td style="padding:14px 16px;color:#7a8c6e;font-size:14px;font-weight:bold;text-align:right;">CHF ${installmentChf}.-</td>
            </tr>
            <tr style="border-top:1px solid #e7e5e4;background:#fffbf5;">
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;">2e versement</td>
              <td style="padding:14px 16px;color:#57534e;font-size:14px;">${fmtShort(date2)}</td>
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">CHF ${installmentChf}.-</td>
            </tr>
            <tr style="border-top:1px solid #e7e5e4;background:#fffbf5;">
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;">3e versement</td>
              <td style="padding:14px 16px;color:#57534e;font-size:14px;">${fmtShort(date3)}</td>
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">CHF ${remainder}.-</td>
            </tr>
            <tr style="border-top:2px solid #1c1917;">
              <td colspan="2" style="padding:14px 16px;color:#1c1917;font-size:14px;font-weight:bold;">Total</td>
              <td style="padding:14px 16px;color:#1c1917;font-size:14px;font-weight:bold;text-align:right;">CHF ${totalChf}.-</td>
            </tr>
          </table>

          <p style="color:#57534e;font-size:15px;line-height:1.7;margin:0 0 24px;">
            Vous recevrez un rappel par e-mail avant chaque échéance. Vous pouvez également régler vos versements à l'avance via les liens ci-dessous :
          </p>

          <!-- Bouton 2e versement -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr><td align="center">
              <a href="${link2}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:14px 32px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Régler le 2e versement — CHF ${installmentChf}.-
              </a>
            </td></tr>
          </table>

          <!-- Bouton 3e versement -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center">
              <a href="${link3}" style="display:inline-block;background:#7a8c6e;color:#ffffff;text-decoration:none;padding:14px 32px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">
                Régler le 3e versement — CHF ${remainder}.-
              </a>
            </td></tr>
          </table>

          <p style="color:#a8a29e;font-size:13px;line-height:1.7;margin:0;border-top:1px solid #e7e5e4;padding-top:24px;">
            Ces liens de paiement sont personnels et sécurisés. En cas de question, répondez simplement à cet e-mail.
          </p>
        </td></tr>

        <!-- Pied -->
        <tr><td style="background:#f5f4f2;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#a8a29e;font-size:11px;font-family:Arial,sans-serif;letter-spacing:1px;">
            ${SITE_CONFIG.name} · ${business.owner} · ${business.addressCity}, Suisse
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return new Response('Missing stripe signature or webhook secret.', { status: 400 });
  }

  let stripeEvent: Stripe.Event;
  try {
    const rawBody = await req.text();
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('[stripe-webhook] Erreur critique : SUPABASE_SERVICE_ROLE_KEY manquante !');
    return new Response('SUPABASE_SERVICE_ROLE_KEY missing.', { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    serviceRoleKey
  );
  const siteUrl = SITE_CONFIG.url;

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    const { registration_id, is_installment, installment_2_date, installment_3_date,
            event_title, event_slug, first_name, total_chf, installment_amount_chf } = session.metadata || {};

    if (!registration_id) return NextResponse.json({ received: true });

    // Marquer le paiement comme reçu
    await supabase
      .from('event_registrations')
      .update({ payment_status: 'paid' })
      .eq('id', registration_id);

    // Abonner à la newsletter
    if (session.customer_email) {
      try {
        await supabase.from('subscribers').upsert(
          { email: session.customer_email, active: true, created_at: new Date().toISOString() },
          { onConflict: 'email', ignoreDuplicates: true }
        );
      } catch { /* ignore */ }
    }

    // Traitement paiement fractionné : générer les liens 2 et 3
    if (is_installment === 'true' && installment_2_date && installment_3_date) {
      const totalCHF = parseInt(total_chf || '0');
      const installCHF = parseInt(installment_amount_chf || '0');
      const remainder = totalCHF - installCHF * 2;

      try {
        // Créer les prix Stripe pour les 2 versements restants
        const [price2, price3] = await Promise.all([
          stripe.prices.create({
            unit_amount: installCHF * 100,
            currency: 'chf',
            product_data: { name: `${event_title} — 2e versement` },
          }),
          stripe.prices.create({
            unit_amount: remainder * 100,
            currency: 'chf',
            product_data: { name: `${event_title} — 3e versement` },
          }),
        ]);

        // Créer les Payment Links
        const [link2, link3] = await Promise.all([
          stripe.paymentLinks.create({
            line_items: [{ price: price2.id, quantity: 1 }],
            metadata: { registration_id, installment: '2' },
            after_completion: {
              type: 'redirect',
              redirect: { url: `${siteUrl}/ateliers/${event_slug}?installment=2` },
            },
          }),
          stripe.paymentLinks.create({
            line_items: [{ price: price3.id, quantity: 1 }],
            metadata: { registration_id, installment: '3' },
            after_completion: {
              type: 'redirect',
              redirect: { url: `${siteUrl}/ateliers/${event_slug}?installment=3` },
            },
          }),
        ]);

        // Sauvegarder les liens dans la base
        await supabase
          .from('event_registrations')
          .update({
            installment_2_url: link2.url,
            installment_3_url: link3.url,
          })
          .eq('id', registration_id);

        // Envoyer l'email de confirmation avec les liens
        if (session.customer_email) {
          await sendInstallmentEmail({
            email: session.customer_email,
            firstName: first_name || '',
            eventTitle: event_title || '',
            totalChf: totalCHF,
            installmentChf: installCHF,
            date2: installment_2_date,
            date3: installment_3_date,
            link2: link2.url,
            link3: link3.url,
          });
        }
      } catch (err) {
        console.error('Installment links error:', err);
      }
    }
  }

  // Gérer les échecs et expirations
  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    const { registration_id } = session.metadata || {};
    if (registration_id) {
      await supabase
        .from('event_registrations')
        .update({ payment_status: 'failed' })
        .eq('id', registration_id);
    }
  }

  // Marquer les versements 2 et 3 comme payés (via Payment Link)
  if (stripeEvent.type === 'payment_intent.succeeded') {
    const pi = stripeEvent.data.object as Stripe.PaymentIntent;
    const { registration_id, installment } = pi.metadata || {};
    if (registration_id && installment) {
      await supabase
        .from('event_registrations')
        .update({ [`installment_${installment}_status`]: 'paid' })
        .eq('id', registration_id);
    }
  }

  return NextResponse.json({ received: true });
}
