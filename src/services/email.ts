import { Resend } from 'resend';
import { SITE_CONFIG } from '../config/site';

let resendInstance: Resend | null = null;

function getResendInstance(): Resend {
  if (resendInstance) return resendInstance;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY non configurée dans les variables d\'environnement.');
  }

  resendInstance = new Resend(apiKey);
  return resendInstance;
}

/**
 * Convertit un texte brut (paragraphes séparés par une ligne vide) en un HTML
 * minimal, sans mise en forme ni tableau — pour des emails qui se lisent comme
 * un message personnel plutôt qu'une newsletter au design travaillé.
 */
export function plainTextToSimpleHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1917;">${paragraphs}</div>`;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Envoie un email à l'aide du service Resend configuré globalement.
 * Utilise par défaut l'expéditeur défini dans SITE_CONFIG.
 */
export async function sendEmail(options: SendEmailOptions) {
  const from = options.from || SITE_CONFIG.emailSender.full;
  
  try {
    const resend = getResendInstance();
    const result = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    
    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[sendEmail] Erreur d\'envoi email:', err.message || err);
    return { success: false, error: err.message || 'Erreur d\'envoi inconnue' };
  }
}
