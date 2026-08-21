import { supabase } from '../services/supabase';

/**
 * Signale un événement applicatif depuis un écran d'administration.
 *
 * Volontairement silencieux : une automatisation qui échoue ne doit jamais
 * remonter comme un échec de l'action métier (encaissement, publication) qui
 * vient, elle, de réussir.
 */
export async function notifyAutomationEvent(
  event: 'sale.created' | 'subscriber.created' | 'article.published',
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/automations/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ event }),
    });
  } catch {
    /* sans effet sur l'action déjà accomplie */
  }
}
