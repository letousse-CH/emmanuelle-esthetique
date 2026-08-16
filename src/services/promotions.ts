/**
 * Accès Supabase des promotions.
 *
 * L'envoi e-mail ne passe PAS par ici : il traverse `/api/promotions/send`,
 * côté serveur, parce qu'il faut la clé Resend et le secret `UNSUB_SECRET`
 * pour signer le lien de désinscription — deux choses qui n'ont rien à faire
 * dans le navigateur. Le navigateur ne pilote que WhatsApp, où c'est lui qui
 * ouvre l'application, et il se contente alors de journaliser l'envoi.
 */
import { supabase } from './supabase';
import type { Promotion, PromotionSend, SendCanal, Subscriber } from '../types/promotions';

// ── Promotions ──────────────────────────────────────────────────────────────

export async function listPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Promotion[];
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  const { data, error } = await supabase.from('promotions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Promotion) ?? null;
}

export type PromotionInput = Pick<
  Promotion,
  'nom' | 'canal' | 'segment' | 'segment_params' | 'objet' | 'message_email' | 'message_whatsapp'
>;

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const { data, error } = await supabase
    .from('promotions')
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Promotion;
}

export async function updatePromotion(
  id: string,
  input: Partial<PromotionInput> & { status?: Promotion['status']; sent_at?: string | null },
): Promise<Promotion> {
  const { data, error } = await supabase
    .from('promotions')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Promotion;
}

/** Supprimer une promotion emporte son journal d'envois (`ON DELETE CASCADE`) :
 *  ce n'est pas une pièce comptable, juste une trace de campagne. */
export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Journal d'envoi ─────────────────────────────────────────────────────────

export async function listPromotionSends(promotionId: string): Promise<PromotionSend[]> {
  const { data, error } = await supabase
    .from('promotion_sends')
    .select('*')
    .eq('promotion_id', promotionId)
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as PromotionSend[];
}

/**
 * Marque un destinataire comme servi. Utilisé par le flux WhatsApp, où c'est
 * l'utilisatrice qui appuie sur « envoyer » dans l'application : on ne peut
 * que consigner qu'elle a ouvert la conversation.
 *
 * `upsert` avec `ignoreDuplicates` plutôt qu'un INSERT sec : rouvrir deux fois
 * la même conversation ne doit pas produire une erreur à l'écran, la contrainte
 * d'unicité étant précisément là pour qu'on ne compte qu'un envoi.
 */
export async function recordPromotionSend(entry: {
  promotionId: string;
  clientId: string | null;
  subscriberId: string | null;
  canal: SendCanal;
  destinataire: string;
}): Promise<void> {
  const { error } = await supabase
    .from('promotion_sends')
    .upsert({
      promotion_id: entry.promotionId,
      client_id: entry.clientId,
      subscriber_id: entry.subscriberId,
      canal: entry.canal,
      destinataire: entry.destinataire,
      status: 'envoye',
    }, { onConflict: 'promotion_id,canal,destinataire', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Annule la marque d'envoi — pour reprendre une campagne WhatsApp interrompue
 *  sur un contact qu'on avait coché par erreur. */
export async function unrecordPromotionSend(
  promotionId: string, canal: SendCanal, destinataire: string,
): Promise<void> {
  const { error } = await supabase
    .from('promotion_sends')
    .delete()
    .eq('promotion_id', promotionId)
    .eq('canal', canal)
    .eq('destinataire', destinataire);
  if (error) throw new Error(error.message);
}

/**
 * Efface les échecs d'un canal, pour qu'un nouvel envoi les reprenne.
 *
 * Un envoi raté est journalisé au même titre qu'un envoi réussi : c'est ce qui
 * empêche la boucle d'envoi de s'acharner sur une adresse invalide jusqu'à
 * épuisement. La contrepartie, c'est qu'une panne passagère de Resend
 * exclurait définitivement ses victimes — d'où cette reprise, explicite et
 * déclenchée à la main plutôt qu'un réessai automatique qui tournerait en rond.
 */
export async function clearFailedSends(promotionId: string, canal: SendCanal): Promise<void> {
  const { error } = await supabase
    .from('promotion_sends')
    .delete()
    .eq('promotion_id', promotionId)
    .eq('canal', canal)
    .eq('status', 'echec');
  if (error) throw new Error(error.message);
}

// ── Abonnés newsletter ──────────────────────────────────────────────────────

export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('id, email, active, created_at')
    .limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Subscriber[];
}

/** Statut newsletter d'une adresse précise — affiché sur la fiche cliente. */
export async function findSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from('subscribers')
    .select('id, email, active, created_at')
    .ilike('email', clean)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Subscriber) ?? null;
}

/**
 * Inscrit ou réactive une adresse dans la newsletter du site depuis la fiche
 * cliente. À n'appeler que sur un geste explicite : cocher une case pour
 * quelqu'un d'autre reste un consentement recueilli, pas un consentement
 * supposé.
 */
export async function subscribeEmail(email: string): Promise<Subscriber> {
  const clean = email.trim().toLowerCase();
  const existing = await findSubscriberByEmail(clean);
  if (existing) {
    const { data, error } = await supabase
      .from('subscribers')
      .update({ active: true })
      .eq('id', existing.id)
      .select('id, email, active, created_at')
      .single();
    if (error) throw new Error(error.message);
    return data as Subscriber;
  }
  const { data, error } = await supabase
    .from('subscribers')
    .insert({ email: clean, active: true })
    .select('id, email, active, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as Subscriber;
}

export async function unsubscribeEmail(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  const { error } = await supabase
    .from('subscribers')
    .update({ active: false })
    .ilike('email', clean);
  if (error) throw new Error(error.message);
}

// ── Envoi e-mail (route serveur) ────────────────────────────────────────────

export interface SendPromotionResult {
  sent: number;
  failed: number;
  skipped: number;
  /** Destinataires restant à servir : la route travaille par paquets pour ne
   *  pas se faire couper par le délai d'une fonction Netlify. */
  remaining: number;
  total: number;
  errors: { destinataire: string; error: string }[];
}

/**
 * Déclenche un paquet d'envois côté serveur. Les destinataires sont recalculés
 * là-bas à partir du segment enregistré : le navigateur envoie l'intention,
 * pas la liste — sinon une page restée ouverte une heure enverrait à une
 * audience périmée, et rien n'empêcherait d'écrire une liste à la main.
 *
 * L'appelant relance tant que `remaining > 0` (voir `sendPromotionEmailsAll`).
 */
export async function sendPromotionBatch(
  promotionId: string, testEmail?: string,
): Promise<SendPromotionResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Session expirée. Reconnecte-toi.');

  const res = await fetch('/api/promotions/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ promotionId, testEmail }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || "L'envoi a échoué.");
  return payload as SendPromotionResult;
}

/**
 * Envoie à toute l'audience, paquet après paquet, en signalant la progression.
 *
 * Reprendre est sans risque : chaque envoi est journalisé côté serveur, et la
 * contrainte d'unicité de `promotion_sends` fait que rien ne part deux fois —
 * même si l'onglet est fermé au milieu et l'envoi relancé plus tard.
 */
export async function sendPromotionEmailsAll(
  promotionId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SendPromotionResult> {
  const cumul: SendPromotionResult = {
    sent: 0, failed: 0, skipped: 0, remaining: 0, total: 0, errors: [],
  };

  // Garde-fou : une audience de 10 000 personnes sortirait de toute façon du
  // cadre d'un institut, mais une boucle sans borne est une boucle infinie en
  // puissance dès que la route se met à répondre `remaining` sans progresser.
  for (let tour = 0; tour < 400; tour += 1) {
    const res = await sendPromotionBatch(promotionId);
    cumul.sent += res.sent;
    cumul.failed += res.failed;
    cumul.skipped = res.skipped;
    cumul.total = res.total;
    cumul.remaining = res.remaining;
    cumul.errors.push(...res.errors);

    onProgress?.(cumul.sent + cumul.failed, res.total);

    if (res.remaining === 0) break;
    // Aucun envoi et pourtant des restants : insister ferait tourner en rond.
    if (res.sent === 0 && res.failed === 0) break;
  }

  return cumul;
}
