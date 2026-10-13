import { Resend } from 'resend';
import { SITE_CONFIG, getBusinessInfoServer } from '../config/site';
import { getSettingsServer } from './settingsServer';
import { getResendApiKey } from './secrets';

// Instance mémorisée avec la clé qui l'a créée : si la clé change dans
// l'admin, une nouvelle instance est construite au prochain envoi.
let resendInstance: { key: string; client: Resend } | null = null;

async function getResendInstance(): Promise<Resend> {
  // Clé saisie dans Admin > Paramètres > Clés API, sinon RESEND_API_KEY.
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    throw new Error("Clé Resend absente : renseignez-la dans Admin > Paramètres > Clés API (ou RESEND_API_KEY).");
  }

  if (resendInstance?.key === apiKey) return resendInstance.client;
  const client = new Resend(apiKey);
  resendInstance = { key: apiKey, client };
  return client;
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
 * Expéditeur par défaut : « Nom de l'institut <adresse> ».
 *
 * L'adresse : champ « Adresse d'expédition » (Admin > Clés API), sinon
 * RESEND_FROM_EMAIL, sinon `<prénom de la gérante>@<domaine du site>` — une
 * adresse de personne plutôt que contact@ ou info@, que les filtres anti-spam
 * regardent de travers. Le domaine doit être vérifié chez Resend ; aucune boîte
 * mail n'est requise, car les réponses vont à l'e-mail de l'onglet Entreprise.
 */
async function defaultSender(): Promise<{ from: string; replyTo?: string }> {
  const [biz, s] = await Promise.all([
    getBusinessInfoServer().catch(() => null),
    getSettingsServer(['resend_from_email']).catch(() => null),
  ]);
  let email = (s?.resend_from_email || SITE_CONFIG.emailSender.email).trim();
  if (!email) {
    const host = new URL(SITE_CONFIG.url).hostname.replace(/^www\./, '');
    const local = (biz?.owner || '').split(/\s+/)[0]
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9.-]/g, '');
    if (host.includes('.') && !host.endsWith('.netlify.app')) email = `${local || 'bonjour'}@${host}`;
  }
  if (!email) {
    throw new Error("Expéditeur absent : définissez RESEND_FROM_EMAIL (adresse d'un domaine vérifié chez Resend).");
  }
  const name = (SITE_CONFIG.emailSender.name || biz?.name || '').replace(/[<>"\r\n]/g, '').trim();
  const from = email.includes('<') || !name ? email : `${name} <${email}>`;
  return { from, replyTo: biz?.email || undefined };
}

/**
 * Envoie un email à l'aide du service Resend configuré globalement.
 * Expéditeur et adresse de réponse par défaut : voir `defaultSender`.
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const sender = options.from ? { from: options.from, replyTo: undefined } : await defaultSender();
    const resend = await getResendInstance();
    const result = await resend.emails.send({
      from: sender.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || sender.replyTo,
    });
    // Le SDK Resend ne lève pas d'exception : un refus (clé invalide, expéditeur
    // non vérifié…) arrive dans `result.error`, et doit être rapporté comme un échec.
    if (result.error) throw new Error(result.error.message || result.error.name);

    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[sendEmail] Erreur d\'envoi email:', err.message || err);
    return { success: false, error: err.message || 'Erreur d\'envoi inconnue' };
  }
}
