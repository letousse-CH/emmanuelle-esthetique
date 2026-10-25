/**
 * Bons cadeaux commandés en ligne, payés par TWINT — côté serveur.
 *
 * 1. La cliente commande (`createGiftOrder`) : rien n'est vendu, une commande
 *    `en_attente` est déposée et la cliente reçoit le montant, la référence et
 *    le lien de paiement TWINT de l'institut, pré-rempli avec les deux
 *    (`twintPayUrl`). L'institut est prévenu (push + e-mail).
 * 2. L'exploitante voit l'argent dans son app TWINT et clique « Paiement reçu »
 *    (`confirmGiftOrder`) : Postgres émet la facture et le bon en une
 *    transaction (`bon_commande_confirmer`), puis le bon part par e-mail en PDF,
 *    avec la quittance.
 *
 * Toutes les écritures passent par la clé de service. Les prix viennent du
 * catalogue de la caisse, jamais du navigateur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { getSettingsServer } from './settingsServer';
import { sendEmail } from './email';
import { sendPushToAll } from './pushNotifications';
import { isModuleEnabledServer } from '../config/modules';
import { SITE_CONFIG, getBusinessInfoServer } from '../config/site';
import {
  carteDescriptionForName, classifyCatalogRow, matchOrCreateClient, parseDurationMinutes, stripAccents,
} from './booking';
import { chfMail, escapeHtml, mailRow, mailShell } from '../utils/bookingEmails';
import { renderBonCadeauPdf, renderFacturePdf } from './caissePdf';
import {
  GIFT_SETTING_KEYS, giftLineLabel, giftOrderOpen, parseGiftOrderSettings, twintPayUrl, validateGiftOrder,
  type GiftCatalogItem, type GiftFamily, type GiftOrder, type GiftOrderField, type GiftOrderPublicView,
  type GiftOrderSettings,
} from '../types/giftOrders';

export class GiftOrderError extends Error {
  status: number;
  fields?: Partial<Record<GiftOrderField, string>>;
  constructor(status: number, message: string, fields?: Partial<Record<GiftOrderField, string>>) {
    super(message);
    this.name = 'GiftOrderError';
    this.status = status;
    this.fields = fields;
  }
}

function adminDb(): SupabaseClient {
  const db = getSupabaseAdmin();
  if (!db) throw new GiftOrderError(503, 'La commande en ligne est momentanément indisponible. Merci de réessayer plus tard.');
  return db;
}

export async function getGiftOrderSettings(): Promise<GiftOrderSettings> {
  return parseGiftOrderSettings(await getSettingsServer([...GIFT_SETTING_KEYS]));
}

/** Ouverte = interrupteur + moyen de paiement + module Caisse (qui émet facture et bon). */
export async function isGiftOrderOpen(settings?: GiftOrderSettings): Promise<boolean> {
  const s = settings ?? (await getGiftOrderSettings());
  return giftOrderOpen(s) && (await isModuleEnabledServer('caisse'));
}

// ── Catalogue ───────────────────────────────────────────────────────────────

/** Univers de la carte : celui de la catégorie de caisse, « Services » partagé entre regard et mains & pieds. */
function familyFor(nom: string, categorie: string): GiftFamily {
  const n = stripAccents(nom.toLowerCase());
  const c = stripAccents(categorie.toLowerCase());
  if (c.includes('visage')) return 'visage';
  if (c.includes('corps')) return 'corps';
  if (c.includes('epilation')) return 'epilation';
  if (/cils|sourcil|regard|rehauss/.test(n)) return 'regard';
  if (n.includes('visage')) return 'visage';
  if (n.includes('massage') || n.includes('corps')) return 'corps';
  if (n.includes('epilation')) return 'epilation';
  return 'mains-pieds';
}

/**
 * Ce qui peut s'offrir : toute la carte active de la caisse, sauf les
 * abonnements (nominatifs, vendus en caisse) et ce qui n'a pas de prix.
 * Les compléments (options) s'offrent avec un soin.
 */
export async function loadGiftCatalog(db?: SupabaseClient): Promise<GiftCatalogItem[]> {
  const client = db ?? adminDb();
  const [catsRes, svcRes] = await Promise.all([
    client.from('service_categories').select('id, nom'),
    client.from('services').select('id, nom, description, prix_chf, type, category_id, ordre').eq('active', true).order('ordre', { ascending: true }),
  ]);
  if (svcRes.error) throw new GiftOrderError(503, 'La carte des soins est momentanément indisponible.');

  const catNom = new Map<string, string>((catsRes.data ?? []).map((c: { id: string; nom: string }) => [c.id, c.nom || '']));
  const items: GiftCatalogItem[] = [];
  for (const s of svcRes.data ?? []) {
    const prix = Number(s.prix_chf) || 0;
    if (s.type === 'abonnement' || prix <= 0 || !s.nom) continue;
    const categorie = s.category_id ? catNom.get(s.category_id) ?? '' : '';
    const own = (s.description || '').trim();
    const duree = parseDurationMinutes(own, 0);
    items.push({
      id: s.id,
      nom: s.nom,
      prix,
      famille: familyFor(s.nom, categorie),
      complement: classifyCatalogRow(s, categorie).kind === 'option',
      dureeMinutes: duree > 0 ? duree : null,
      // La description saisie en caisse ne contient souvent que la durée : on
      // montre alors celle de la carte (`carteSoins.ts`).
      description: own && !/^\d+\s*min\.?$/i.test(own) ? own : carteDescriptionForName(s.nom) || '',
    });
  }
  return items;
}

// ── Dépôt d'une commande ────────────────────────────────────────────────────

export async function createGiftOrder(raw: unknown): Promise<GiftOrderPublicView> {
  const db = adminDb();
  const settings = await getGiftOrderSettings();
  if (!(await isGiftOrderOpen(settings))) {
    throw new GiftOrderError(403, 'La commande de bons cadeaux en ligne est fermée pour le moment. Contactez directement l\'institut.');
  }

  const catalogue = await loadGiftCatalog(db);
  const v = validateGiftOrder(raw, {
    montantMin: settings.montantMin,
    catalogue: new Map(catalogue.map((c) => [c.id, c])),
  });
  if (!v.ok) {
    throw new GiftOrderError(400, Object.values(v.errors)[0] ?? 'Commande incomplète.', v.errors);
  }
  const d = v.draft;

  const { data, error } = await db.rpc('bon_commande_creer', {
    p_type: d.type,
    p_lignes: d.lignes,
    p_montant: d.montant,
    p_libelle: d.libelle,
    p_beneficiaire: d.beneficiaire,
    p_message: d.message,
    p_acheteur_prenom: d.acheteur_prenom,
    p_acheteur_nom: d.acheteur_nom,
    p_acheteur_email: d.acheteur_email,
    p_acheteur_telephone: d.acheteur_telephone,
  });
  if (error || !data) {
    console.error('[giftOrders] Dépôt de la commande impossible:', error?.message);
    throw new GiftOrderError(503, 'Votre commande n\'a pas pu être enregistrée. Merci de réessayer dans quelques instants.');
  }
  const order = normalizeOrder(data);

  // La fonction Netlify s'arrête avec la réponse : on attend les envois, sans
  // qu'un échec ne fasse échouer la commande déjà enregistrée.
  const sent = await Promise.allSettled([
    sendPaymentInstructions(order, settings),
    notifyInstitute(order),
  ]);
  for (const r of sent) if (r.status === 'rejected') console.warn('[giftOrders] Envoi non abouti:', r.reason);

  return {
    reference: order.reference,
    montant: order.montant,
    libelle: order.libelle,
    beneficiaire: order.beneficiaire,
    acheteur_email: order.acheteur_email,
    twintLien: twintPayUrl(settings.twintLien, order.montant, order.reference),
  };
}

function normalizeOrder(row: any): GiftOrder {
  return {
    ...row,
    montant: Number(row.montant),
    lignes: Array.isArray(row.lignes)
      ? row.lignes.map((l: any) => ({ ...l, prix_chf: Number(l.prix_chf), quantite: Number(l.quantite) || 1 }))
      : [],
  } as GiftOrder;
}

async function fetchOrder(db: SupabaseClient, id: string): Promise<GiftOrder> {
  const { data, error } = await db.from('gift_card_orders').select('*').eq('id', id).maybeSingle();
  if (error) throw new GiftOrderError(503, error.message);
  if (!data) throw new GiftOrderError(404, 'Commande introuvable.');
  return normalizeOrder(data);
}

// ── Paiement reçu / annulation ──────────────────────────────────────────────

export interface ConfirmResult {
  order: GiftOrder;
  email: { ok: boolean; error?: string };
}

export async function confirmGiftOrder(id: string): Promise<ConfirmResult> {
  const db = adminDb();
  const before = await fetchOrder(db, id);
  if (before.status === 'annulee') {
    throw new GiftOrderError(409, `La commande ${before.reference} a été annulée : elle ne peut plus être encaissée.`);
  }
  if (before.status === 'payee') {
    // Second clic, ou deuxième appareil : la vente existe déjà, rien à refaire.
    return { order: before, email: { ok: Boolean(before.email_envoye_le), error: before.email_erreur ?? undefined } };
  }

  // L'acheteuse devient (ou retrouve) sa fiche : e-mail, puis téléphone,
  // jamais par le nom seul. Aucun accord publicitaire n'est déduit d'un achat.
  const crm = await matchOrCreateClient(db, {
    nom: before.acheteur_nom,
    prenom: before.acheteur_prenom,
    email: before.acheteur_email,
    telephone: before.acheteur_telephone,
  });

  const { data, error } = await db.rpc('bon_commande_confirmer', {
    p_order_id: id,
    p_client_id: crm.clientId,
  });
  if (error || !data) {
    throw new GiftOrderError(409, error?.message || 'La vente n\'a pas pu être enregistrée.');
  }
  const order = normalizeOrder(data);
  const email = await sendGiftCard(db, order);
  return { order: { ...order, ...email.patch }, email: { ok: email.ok, error: email.error } };
}

export async function resendGiftCard(id: string): Promise<ConfirmResult> {
  const db = adminDb();
  const order = await fetchOrder(db, id);
  if (order.status !== 'payee') {
    throw new GiftOrderError(409, 'Le bon n\'est envoyé qu\'une fois le paiement reçu.');
  }
  const email = await sendGiftCard(db, order);
  return { order: { ...order, ...email.patch }, email: { ok: email.ok, error: email.error } };
}

export async function cancelGiftOrder(id: string, motif: string): Promise<GiftOrder> {
  const db = adminDb();
  const { data, error } = await db
    .from('gift_card_orders')
    .update({
      status: 'annulee',
      annulee_le: new Date().toISOString(),
      motif_annulation: motif.trim().slice(0, 300) || null,
    })
    .eq('id', id)
    .eq('status', 'en_attente')
    .select('*')
    .maybeSingle();
  if (error) throw new GiftOrderError(409, error.message);
  if (!data) {
    const current = await fetchOrder(db, id);
    throw new GiftOrderError(409, current.status === 'payee'
      ? `La commande ${current.reference} est payée : pour revenir sur la vente, annulez sa facture dans le journal.`
      : `La commande ${current.reference} est déjà annulée.`);
  }
  return normalizeOrder(data);
}

// ── E-mails ─────────────────────────────────────────────────────────────────

async function ownerFirstName(): Promise<{ prenom: string; nom: string; email: string }> {
  const biz = await getBusinessInfoServer().catch(() => null);
  return {
    prenom: (biz?.owner || '').trim().split(/\s+/)[0] || '',
    nom: biz?.name || SITE_CONFIG.name,
    email: biz?.email || SITE_CONFIG.receiverEmail,
  };
}

function recapBlock(o: GiftOrder, extra: string[] = []): string {
  const soins = o.type === 'soins' && o.lignes.length
    ? mailRow('Soins offerts :', o.lignes.map((l) => escapeHtml(giftLineLabel(l))).join(', '))
    : '';
  return `<div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
    ${mailRow('Bon cadeau pour :', escapeHtml(o.beneficiaire))}
    ${soins}
    ${mailRow('Montant :', `<strong>${escapeHtml(chfMail(o.montant))}</strong>`)}
    ${o.message ? mailRow('Votre mot :', `« ${escapeHtml(o.message).replace(/\n/g, '<br/>')} »`) : ''}
    ${extra.join('\n')}
  </div>`;
}

/** À la commande : comment payer. */
async function sendPaymentInstructions(o: GiftOrder, s: GiftOrderSettings): Promise<void> {
  const owner = await ownerFirstName();
  const lien = twintPayUrl(s.twintLien, o.montant, o.reference);
  const html = mailShell(`
    <p>Bonjour ${escapeHtml(o.acheteur_prenom)},</p>
    <p>Merci pour votre commande de bon cadeau. Il reste une étape : le paiement par TWINT.</p>
    ${recapBlock(o, [mailRow('Référence :', escapeHtml(o.reference))])}
    <p><strong>Payez ${escapeHtml(chfMail(o.montant))} par TWINT</strong> avec ce bouton : le montant et la référence de votre commande sont déjà remplis.</p>
    ${lien ? `<p><a href="${escapeHtml(lien)}" style="display:inline-block;background:#262626;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:600;">Payer ${escapeHtml(chfMail(o.montant))} avec TWINT</a></p>` : ''}
    <p>Sur téléphone, l'app TWINT s'ouvre ; sur ordinateur, un code s'affiche, à scanner avec l'app. Gardez le montant exact. Dès que ${escapeHtml(owner.prenom || 'l\'institut')} a reçu votre paiement, le bon vous est envoyé en PDF à cette adresse, prêt à imprimer ou à transmettre.</p>
    <p>Vous avez changé d'avis ? Ne payez pas : la commande sera simplement annulée.</p>
    <p>À bientôt,<br/>${escapeHtml(owner.prenom || owner.nom)}</p>`);

  const res = await sendEmail({
    to: o.acheteur_email,
    subject: `Votre bon cadeau — plus qu'une étape : le paiement TWINT (${o.reference})`,
    html,
  });
  if (!res.success) console.warn('[giftOrders] Instructions de paiement non envoyées:', o.reference, res.error);
}

/** À l'institut : une commande à rapprocher de TWINT. */
async function notifyInstitute(o: GiftOrder): Promise<void> {
  const owner = await ownerFirstName();
  const url = `/admin/caisse/bons?commande=${encodeURIComponent(o.id)}`;
  const acheteuse = `${o.acheteur_prenom} ${o.acheteur_nom}`.trim();

  const push = sendPushToAll({
    title: `Bon cadeau commandé — ${chfMail(o.montant)}`,
    body: `${acheteuse} · pour ${o.beneficiaire}\nÀ vérifier dans TWINT (${o.reference})`,
    url,
    tag: `bon-${o.id}`,
  }).catch((e) => console.warn('[giftOrders] Notification push impossible:', e));

  const mail = owner.email
    ? sendEmail({
        to: owner.email,
        subject: `Bon cadeau commandé — ${acheteuse} — ${chfMail(o.montant)} à vérifier dans TWINT`,
        replyTo: o.acheteur_email,
        html: mailShell(`
          <h2 style="font-size:18px;margin:0 0 8px;">Nouvelle commande de bon cadeau</h2>
          <p>Le bon n'est <strong>pas encore émis</strong>. Vérifiez dans l'app TWINT que ${escapeHtml(chfMail(o.montant))} est bien arrivé, puis cliquez « Paiement reçu » : la facture et le bon sont créés, et le bon part à l'acheteuse.</p>
          ${recapBlock(o, [
            mailRow('Référence :', escapeHtml(o.reference)),
            mailRow('Acheteuse :', escapeHtml(acheteuse)),
            mailRow('E-mail :', `<a href="mailto:${escapeHtml(o.acheteur_email)}">${escapeHtml(o.acheteur_email)}</a>`),
            o.acheteur_telephone ? mailRow('Téléphone :', escapeHtml(o.acheteur_telephone)) : '',
          ])}
          <p><a href="${escapeHtml(SITE_CONFIG.url + url)}" style="display:inline-block;background:#292524;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;">Ouvrir la commande</a></p>`),
      }).then((r) => { if (!r.success) console.warn('[giftOrders] E-mail à l\'institut non envoyé:', r.error); })
    : Promise.resolve();

  await Promise.all([push, mail]);
}

/**
 * Le bon (PDF) et la quittance, à l'acheteuse. Le résultat est consigné sur la
 * commande : l'administration montre un envoi refusé et propose de le refaire.
 */
async function sendGiftCard(
  db: SupabaseClient,
  o: GiftOrder,
): Promise<{ ok: boolean; error?: string; patch: Partial<GiftOrder> }> {
  let result: { ok: boolean; error?: string };
  try {
    if (!o.gift_card_id || !o.transaction_id) throw new Error('Commande sans bon ni facture.');
    const [{ data: card }, { data: tx }, bon, facture, owner] = await Promise.all([
      db.from('gift_cards').select('code, expire_le').eq('id', o.gift_card_id).maybeSingle(),
      db.from('transactions').select('numero').eq('id', o.transaction_id).maybeSingle(),
      renderBonCadeauPdf(db, o.gift_card_id),
      renderFacturePdf(db, o.transaction_id),
      ownerFirstName(),
    ]);
    const echeance = card?.expire_le
      ? new Date(`${card.expire_le}T12:00:00`).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const html = mailShell(`
      <p>Bonjour ${escapeHtml(o.acheteur_prenom)},</p>
      <p>Votre paiement de ${escapeHtml(chfMail(o.montant))} est bien arrivé, merci. Voici le bon cadeau, en pièce jointe : il est prêt à imprimer ou à transmettre.</p>
      ${recapBlock(o, [
        card?.code ? mailRow('Code du bon :', `<strong>${escapeHtml(card.code)}</strong>`) : '',
        echeance ? mailRow('Valable jusqu\'au :', escapeHtml(echeance)) : '',
        tx?.numero ? mailRow('Quittance :', `${escapeHtml(tx.numero)} (jointe)`) : '',
      ])}
      <p>Pour en profiter, ${escapeHtml(o.beneficiaire)} prend rendez-vous sur <a href="${escapeHtml(SITE_CONFIG.url)}/reservation">${escapeHtml(SITE_CONFIG.url.replace(/^https?:\/\//, ''))}/reservation</a> ou par téléphone, et présente le bon le jour du soin.</p>
      <p>À bientôt,<br/>${escapeHtml(owner.prenom || owner.nom)}</p>`);

    const res = await sendEmail({
      to: o.acheteur_email,
      subject: `Votre bon cadeau ${card?.code ?? ''} pour ${o.beneficiaire}`.replace(/\s+/g, ' ').trim(),
      html,
      attachments: [bon, facture].map((p) => ({ filename: p.filename, content: p.buffer })),
    });
    result = res.success ? { ok: true } : { ok: false, error: res.error || 'Envoi refusé.' };
  } catch (err) {
    console.error('[giftOrders] Envoi du bon impossible:', o.reference, err);
    result = { ok: false, error: err instanceof Error ? err.message : 'Envoi impossible.' };
  }

  const patch: Partial<GiftOrder> = result.ok
    ? { email_envoye_le: new Date().toISOString(), email_erreur: null }
    : { email_erreur: (result.error || 'Envoi impossible.').slice(0, 500) };
  const { error } = await db.from('gift_card_orders').update(patch).eq('id', o.id);
  if (error) console.warn('[giftOrders] Trace d\'envoi non enregistrée:', error.message);
  return { ...result, patch };
}
