/**
 * Service Auto-Répondeur IA Lead (Réponse Instantanée 24/7)
 */
import { callClaude } from '../utils/ai';
import { getEditorialSettings } from './settingsServer';
import { sendEmail } from './email';
import { SITE_CONFIG } from '../config/site';

export interface LeadSubmission {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface AiLeadReplyResult {
  success: boolean;
  replySubject: string;
  replyText: string;
  error?: string;
}

/**
 * Génère une réponse IA personnalisée et l'envoie au prospect
 */
export async function generateAndSendAiLeadReply(lead: LeadSubmission): Promise<AiLeadReplyResult> {
  try {
    const settings = await getEditorialSettings();

    const activityContext = settings.site_activity_context || 'notre cabinet de conseil & services';
    const toneOfVoice = settings.site_tone_of_voice || 'chaleureux, professionnel et rassurant';
    const brandTone = settings.site_brand_tone || 'réactivité et excellence de service';

    const systemPrompt = `Tu es l'assistant répondeur IA officiel de l'entreprise.
Activité de l'entreprise : ${activityContext}
Ton de voix à adopter : ${toneOfVoice}
Promesses & Valeurs : ${brandTone}

TA MISSION :
Un prospect vient d'envoyer un message via le formulaire de contact.
Rédige une réponse d'e-mail instantanée, chaleureuse, personnalisée et très professionnelle.

RÈGLES D'ÉCRITURE :
1. Salue le prospect par son prénom (${lead.name}).
2. Remercie-le pour son intérêt et confirme la bonne réception de son message.
3. Apporte une réponse initiale bienveillante à sa demande ("${lead.message}").
4. Propose-lui un créneau ou invite-le à préciser sa demande s'il le souhaite.
5. Signe chaleureusement au nom de l'équipe.

Réponds sous la forme d'un objet JSON strict :
{
  "subject": "Re: [Sujet approprié]",
  "body": "Corps du message en texte clair avec saut de ligne..."
}`;

    const userPrompt = `Prospect : ${lead.name} (${lead.email})
Sujet : ${lead.subject || 'Demande de renseignement'}
Message du prospect :
"${lead.message}"`;

    const aiResult = await callClaude({
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
      max_tokens: 1000,
      feature: 'ai-lead-responder',
      timeout: 30000,
    });

    const rawText = aiResult.content[0].text;
    let jsonResult: { subject: string; body: string };

    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      jsonResult = JSON.parse(match ? match[0] : rawText);
    } catch {
      jsonResult = {
        subject: `Re: ${lead.subject || 'Votre demande'}`,
        body: `Bonjour ${lead.name},\n\nNous avons bien reçu votre message et nous vous en remercions.\nNotre équipe revient vers vous dans les plus brefs délais !\n\nBien cordialement,\nL'équipe ${SITE_CONFIG.name}`,
      };
    }

    const emailSent = await sendEmail({
      to: lead.email,
      replyTo: SITE_CONFIG.receiverEmail,
      subject: jsonResult.subject,
      text: jsonResult.body,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Bonjour ${lead.name},</h2>
          ${jsonResult.body.replace(/\n/g, '<br/>')}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #888;">Ceci est un message de confirmation automatique envoyé par notre assistant IA.</p>
        </div>
      `,
    });

    return {
      success: emailSent.success,
      replySubject: jsonResult.subject,
      replyText: jsonResult.body,
    };
  } catch (err: any) {
    console.error('[aiLeadResponder] Erreur répondeur IA:', err);
    return {
      success: false,
      replySubject: '',
      replyText: '',
      error: err.message,
    };
  }
}
