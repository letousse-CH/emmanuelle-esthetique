import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SITE_CONFIG } from '../../../../config/site';
import { sendEmail, plainTextToSimpleHtml } from '../../../../services/email';
import { isModuleEnabledServer } from '../../../../config/modules';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface SequenceStep {
  step_order: number;
  delay_hours: number;
  subject: string;
  body: string;
  active: boolean;
}

interface Subscriber {
  email: string;
  quiz_profile: string;
  quiz_completed_at: string;
  quiz_score: number | null;
}

function buildUnsubToken(email: string): string {
  const secret = process.env.UNSUB_SECRET || '';
  const emailB64 = Buffer.from(email).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(email).digest('hex');
  return encodeURIComponent(`${emailB64}.${hmac}`);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[quiz-sequence] CRON_SECRET manquant : accès refusé par défaut.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const urlSecret = req.nextUrl.searchParams.get('secret');
  if (token !== cronSecret && urlSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await isModuleEnabledServer('decodeur'))) {
    return NextResponse.json({ skipped: true, reason: 'Module décodeur désactivé' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[quiz-sequence] Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)');
    return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: steps, error: stepsError } = await client
    .from('quiz_sequence_emails')
    .select('step_order, delay_hours, subject, body, active')
    .eq('active', true)
    .order('step_order', { ascending: true });

  if (stepsError) {
    console.error('[quiz-sequence] Erreur lecture séquence:', stepsError.message);
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  const sentSummary: Record<string, number> = {};

  for (const step of (steps ?? []) as SequenceStep[]) {
    const cutoff = new Date(Date.now() - step.delay_hours * 3600 * 1000).toISOString();

    const { data: candidates, error: candidatesError } = await client
      .from('subscribers')
      .select('email, quiz_profile, quiz_completed_at, quiz_score')
      .eq('active', true)
      .not('quiz_profile', 'is', null)
      .not('quiz_completed_at', 'is', null)
      .lte('quiz_completed_at', cutoff);

    if (candidatesError) {
      console.error(`[quiz-sequence] Erreur lecture candidats étape ${step.step_order}:`, candidatesError.message);
      continue;
    }

    const { data: alreadySent } = await client
      .from('quiz_sequence_log')
      .select('subscriber_email')
      .eq('step_order', step.step_order);

    const sentSet = new Set((alreadySent ?? []).map((r: { subscriber_email: string }) => r.subscriber_email));
    const pending = ((candidates ?? []) as Subscriber[]).filter(s => !sentSet.has(s.email));

    let sentCount = 0;
    for (const subscriber of pending) {
      const unsubToken = buildUnsubToken(subscriber.email);
      const unsubUrl = `${SITE_CONFIG.url}/api/unsubscribe?e=${unsubToken}`;
      const resultatUrl =
        subscriber.quiz_score !== null
          ? `${SITE_CONFIG.url}/decodeur?score=${subscriber.quiz_score}&profil=${encodeURIComponent(subscriber.quiz_profile)}`
          : `${SITE_CONFIG.url}/decodeur`;
      const bodyWithLinks = step.body
        .replaceAll('{{cta_url}}', `${SITE_CONFIG.url}/arsenal-tactique`)
        .replaceAll('{{resultat_url}}', resultatUrl);
      // Version texte brut (clients mail sans HTML) : garde l'URL complète, obligatoire pour le désabonnement.
      const fullText = `${bodyWithLinks}\n\n—\nPour ne plus recevoir ces emails : ${unsubUrl}`;
      // Version HTML (affichée par la quasi-totalité des clients mail) : lien court et cliquable,
      // au lieu d'afficher l'URL complète du désabonnement en clair.
      const htmlBody = `${plainTextToSimpleHtml(bodyWithLinks)}<p style="margin:16px 0 0;font-size:12px;color:#a8a29e;">— <a href="${unsubUrl}" style="color:#a8a29e;">Se désinscrire</a></p>`;

      const result = await sendEmail({
        to: subscriber.email,
        subject: step.subject,
        html: htmlBody,
        text: fullText,
      });

      if (result.success) {
        await client.from('quiz_sequence_log').insert([{ subscriber_email: subscriber.email, step_order: step.step_order }]);
        sentCount += 1;
      } else {
        console.error(`[quiz-sequence] Échec envoi à ${subscriber.email} (étape ${step.step_order}):`, result.error);
      }
    }

    sentSummary[`step_${step.step_order}`] = sentCount;
  }

  return NextResponse.json({ sent: sentSummary });
}
