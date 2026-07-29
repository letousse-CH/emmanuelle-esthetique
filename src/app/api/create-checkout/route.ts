import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { SITE_CONFIG } from '../../../config/site';
import { sendEmail } from '../../../services/email';
import { isModuleEnabledServer } from '../../../config/modules';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  // @ts-ignore
  apiVersion: '2026-04-22.dahlia',
});

function getInstallmentDates(eventDateStr: string | null): { date2: Date; date3: Date } {
  const now = new Date();
  if (!eventDateStr) {
    return {
      date2: new Date(now.getTime() + 30 * 86400000),
      date3: new Date(now.getTime() + 60 * 86400000),
    };
  }
  const eventDate = new Date(eventDateStr);
  const lastPayment = new Date(eventDate.getTime() - 10 * 86400000); // J-10 avant événement
  const daysToEvent = Math.floor((eventDate.getTime() - now.getTime()) / 86400000);

  if (daysToEvent <= 45) {
    const interval = Math.max(7, Math.floor(daysToEvent / 3));
    return {
      date2: new Date(now.getTime() + interval * 86400000),
      date3: lastPayment < new Date(now.getTime() + interval * 2 * 86400000)
        ? lastPayment
        : new Date(now.getTime() + interval * 2 * 86400000),
    };
  }
  const date3Candidate = new Date(now.getTime() + 60 * 86400000);
  return {
    date2: new Date(now.getTime() + 30 * 86400000),
    date3: date3Candidate < lastPayment ? date3Candidate : lastPayment,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isModuleEnabledServer('events'))) {
      return NextResponse.json({ error: 'Module Événements désactivé' }, { status: 403 });
    }

    const body = await req.json();
    const { eventId, firstName, lastName, email, phone, paymentType } = body;

    if (!eventId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
    );

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, title, slug, category, price_chf, max_participants, image_url, date_start, date_end, time_start, location, is_online, visio_url')
      .eq('id', eventId)
      .eq('status', 'published')
      .single();

    if (evErr || !ev) {
      return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
    }

    if (ev.max_participants) {
      const { count } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('payment_status', 'paid');
      if ((count ?? 0) >= ev.max_participants) {
        return NextResponse.json({ error: 'Événement complet.' }, { status: 409 });
      }
    }

    // ── Événement gratuit ──────────────────────────────────────────────────────
    if (ev.price_chf === 0) {
      await supabase.from('event_registrations').insert({
        event_id: eventId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        payment_type: 'full',
        payment_status: 'paid',
        amount_chf: 0,
      });

      // Abonnement newsletter
      await supabase.from('subscribers').upsert(
        { email, active: true, created_at: new Date().toISOString() },
        { onConflict: 'email', ignoreDuplicates: true }
      );

      // Email de confirmation simple avec le service centralisé
      try {
        const dateLabel = ev.date_start ? new Date(ev.date_start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
        await sendEmail({
          to: email,
          subject: `Inscription confirmée — ${ev.title}`,
          html: `<p>Bonjour ${firstName},</p><p>Votre inscription à <strong>${ev.title}</strong>${dateLabel ? ` (${dateLabel})` : ''} est confirmée. Cet événement est gratuit, aucun paiement n'est requis.</p><p>À bientôt,<br/>Matthieu</p>`,
        });
      } catch (mailErr) {
        console.error('[create-checkout] Erreur envoi email bienvenue gratuit:', mailErr);
      }

      return NextResponse.json({ free: true });
    }

    const isInstallment = paymentType === 'installment' && ev.price_chf > 250;
    const installmentAmount = isInstallment ? Math.ceil(ev.price_chf / 3) : ev.price_chf;
    const { date2, date3 } = getInstallmentDates(ev.date_start);

    const { data: registration, error: regErr } = await supabase
      .from('event_registrations')
      .insert({
        event_id: eventId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        payment_type: isInstallment ? 'installment' : 'full',
        payment_status: 'pending',
        amount_chf: ev.price_chf,
        ...(isInstallment && {
          installment_amount_chf: installmentAmount,
          installment_2_date: date2.toISOString().split('T')[0],
          installment_3_date: date3.toISOString().split('T')[0],
        }),
      })
      .select()
      .single();

    if (regErr || !registration) {
      return NextResponse.json({ error: "Erreur lors de la création de l'inscription." }, { status: 500 });
    }

    const siteUrl = SITE_CONFIG.url;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const description = isInstallment
      ? `1er versement — Total CHF ${ev.price_chf}.- en 3× | 2e: ${fmt(date2)} · 3e: ${fmt(date3)}`
      : `${ev.date_start ? new Date(ev.date_start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} · ${ev.location}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'chf',
            unit_amount: installmentAmount * 100,
            product_data: {
              name: isInstallment ? `${ev.title} — 1er versement (3×)` : ev.title,
              description,
              images: ev.image_url ? [ev.image_url] : [],
            },
          },
          quantity: 1,
        },
      ],
      ...(isInstallment && {
        custom_text: {
          submit: {
            message: `Vous réglez le 1er versement de CHF ${installmentAmount}.-. Les 2e (${fmt(date2)}) et 3e (${fmt(date3)}) versements vous seront envoyés par e-mail avec un lien de paiement sécurisé.`,
          },
        },
      }),
      metadata: {
        registration_id: registration.id,
        event_id: eventId,
        is_installment: isInstallment ? 'true' : 'false',
        installment_2_date: isInstallment ? date2.toISOString().split('T')[0] : '',
        installment_3_date: isInstallment ? date3.toISOString().split('T')[0] : '',
        event_title: ev.title,
        event_slug: ev.slug,
        first_name: firstName,
        last_name: lastName,
        total_chf: String(ev.price_chf),
        installment_amount_chf: String(installmentAmount),
      },
      locale: 'fr',
      success_url: `${siteUrl}/ateliers/${ev.slug}?success=true`,
      cancel_url: `${siteUrl}/ateliers/${ev.slug}?cancelled=true`,
    });

    await supabase
      .from('event_registrations')
      .update({ stripe_session_id: session.id })
      .eq('id', registration.id);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('create-checkout error:', err);
    return NextResponse.json({ error: err.message || 'Erreur interne.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
