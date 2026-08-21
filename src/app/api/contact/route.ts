import { NextResponse, NextRequest } from 'next/server';
import { sendEmail } from '../../../services/email';
import { checkRateLimit } from '../../../utils/rateLimit';
import { SITE_CONFIG } from '../../../config/site';
import { emitAutomationEvent } from '../../../services/automationRunner';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  // Rate limiter serverless-ready
  const rateLimitStatus = await checkRateLimit(ip, { windowMs: 60_000, maxRequests: 5 });
  if (!rateLimitStatus.success) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une minute.' },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide.' },
      { status: 400 }
    );
  }

  const { name, email, subject, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Tous les champs sont obligatoires.' },
      { status: 400 }
    );
  }

  const safeName    = escapeHtml(String(name).replace(/[\r\n]/g, ' ').slice(0, 100));
  const safeEmail   = escapeHtml(String(email).replace(/[\r\n<>]/g, '').slice(0, 200));
  const safeSubject = subject ? escapeHtml(String(subject).replace(/[\r\n]/g, ' ').slice(0, 200)) : '';
  const safeMessage = escapeHtml(String(message).slice(0, 10000));

  const emailResult = await sendEmail({
    to: SITE_CONFIG.receiverEmail,
    replyTo: safeEmail,
    subject: `[Contact Site] ${safeSubject || 'Nouveau message'}`,
    text: `Nom: ${safeName}\nEmail: ${safeEmail}\n\nMessage:\n${safeMessage}`,
    html: `
      <p><strong>Nom :</strong> ${safeName}</p>
      <p><strong>Email :</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
      <p><strong>Sujet :</strong> ${safeSubject || '—'}</p>
      <hr/>
      <p>${safeMessage.replace(/\n/g, '<br/>')}</p>
    `,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      { error: "Service d'envoi temporairement indisponible. Veuillez réessayer plus tard." },
      { status: 503 }
    );
  }

  // Une demande reçue est l'événement `lead.created` du module
  // Automatisations. `emitAutomationEvent` ne lève jamais : un webhook cassé
  // ne doit pas faire échouer un formulaire de contact déjà envoyé.
  await emitAutomationEvent('lead.created', new URL(req.url).origin);

  return NextResponse.json({ success: true, message: 'Message envoyé avec succès.' });
}
