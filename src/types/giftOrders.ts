/**
 * Bons cadeaux commandés en ligne — règles pures, partagées par le formulaire
 * public, la route serveur et l'administration (testées :
 * `npx tsx scripts/test-gift-orders.ts`).
 *
 * Une commande n'est pas une vente : ni facture ni bon tant que l'exploitante
 * n'a pas constaté le paiement TWINT (voir la migration
 * `20261024_bons_commande_en_ligne.sql`).
 */

export type GiftOrderType = 'montant' | 'soins';
export type GiftOrderStatus = 'en_attente' | 'payee' | 'annulee';

/** Un soin offert, prix figé à la commande depuis le catalogue. */
export interface GiftOrderLine {
  service_id: string;
  nom: string;
  prix_chf: number;
  quantite: number;
}

export interface GiftOrder {
  id: string;
  annee: number;
  number_seq: number;
  reference: string;
  type: GiftOrderType;
  lignes: GiftOrderLine[];
  montant: number;
  libelle: string;
  beneficiaire: string;
  message: string | null;
  acheteur_prenom: string;
  acheteur_nom: string;
  acheteur_email: string;
  acheteur_telephone: string | null;
  status: GiftOrderStatus;
  client_id: string | null;
  transaction_id: string | null;
  gift_card_id: string | null;
  payee_le: string | null;
  annulee_le: string | null;
  motif_annulation: string | null;
  email_envoye_le: string | null;
  email_erreur: string | null;
  created_at: string;
  updated_at: string;
}

/** Un soin que l'on peut offrir (catalogue de la caisse, prix du jour). */
export interface GiftCatalogItem {
  id: string;
  nom: string;
  prix: number;
  /** Univers de la carte, pour ranger la liste comme la page Réservation. */
  famille: GiftFamily;
  /** Complément (option) : s'offre avec un soin, pas seul. */
  complement: boolean;
  dureeMinutes: number | null;
  description: string;
}

export type GiftFamily = 'visage' | 'corps' | 'mains-pieds' | 'regard' | 'epilation';

export const GIFT_FAMILY_ORDER: GiftFamily[] = ['visage', 'corps', 'mains-pieds', 'regard', 'epilation'];

export const GIFT_FAMILY_LABEL: Record<GiftFamily, string> = {
  visage: 'Soins du visage',
  corps: 'Corps & massages',
  'mains-pieds': 'Mains & pieds',
  regard: 'Beauté du regard',
  epilation: 'Épilation',
};

/** Montant minimal d'un bon à montant libre, quand le réglage manque. */
export const GIFT_MIN_DEFAULT = 100;
/** Plafond technique d'une commande : au-delà, une faute de frappe est plus probable qu'un cadeau. */
export const GIFT_MAX = 2000;
export const GIFT_MESSAGE_MAX = 300;
export const GIFT_QTE_MAX = 5;
/** Montants proposés d'un clic (ceux sous le minimum réglé sont écartés). */
export const GIFT_PRESETS = [100, 150, 200, 300];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Réglages de la vente en ligne (table `settings`, lisible par le site). */
export interface GiftOrderSettings {
  actif: boolean;
  montantMin: number;
  /** Image du code QR TWINT de l'institut. */
  twintQr: string;
  /** Lien de paiement TWINT (ouvre l'app sur téléphone). */
  twintLien: string;
}

export const GIFT_SETTING_KEYS = [
  'bon_en_ligne_actif',
  'bon_en_ligne_montant_min',
  'bon_en_ligne_twint_qr',
  'bon_en_ligne_twint_lien',
] as const;

export function parseGiftOrderSettings(s: Record<string, string | undefined | null>): GiftOrderSettings {
  const min = Number(String(s.bon_en_ligne_montant_min ?? '').replace(',', '.'));
  return {
    actif: String(s.bon_en_ligne_actif ?? '').trim() === 'true',
    montantMin: Number.isFinite(min) && min > 0 ? Math.min(min, GIFT_MAX) : GIFT_MIN_DEFAULT,
    twintQr: String(s.bon_en_ligne_twint_qr ?? '').trim(),
    twintLien: String(s.bon_en_ligne_twint_lien ?? '').trim(),
  };
}

/**
 * La commande en ligne est-elle ouverte ? Il faut l'interrupteur ET un moyen
 * de payer : sans code QR ni lien, l'acheteuse ne saurait pas où envoyer
 * l'argent.
 */
export function giftOrderOpen(s: GiftOrderSettings): boolean {
  return s.actif && (s.twintQr !== '' || isHttpUrl(s.twintLien));
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** « 2 × Soin Hydra » au-delà d'une unité. */
export function giftLineLabel(l: Pick<GiftOrderLine, 'nom' | 'quantite'>): string {
  return l.quantite > 1 ? `${l.quantite} × ${l.nom}` : l.nom;
}

/** Libellé du bon, identique à celui de la caisse : « Bon cadeau — A + B ». */
export function giftOrderLibelle(type: GiftOrderType, lignes: Pick<GiftOrderLine, 'nom' | 'quantite'>[]): string {
  if (type === 'montant' || lignes.length === 0) return 'Bon cadeau';
  return `Bon cadeau — ${lignes.map(giftLineLabel).join(' + ')}`;
}

export function giftLinesTotal(lignes: Pick<GiftOrderLine, 'prix_chf' | 'quantite'>[]): number {
  return round2(lignes.reduce((acc, l) => acc + Number(l.prix_chf) * l.quantite, 0));
}

/** Montant saisi (« 150 », « 150.50 », « 150,5 ») ou `null` s'il ne se lit pas. */
export function parseMontant(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(/'/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return round2(n);
}

/** Texte saisi, sans caractère de contrôle (les retours à la ligne du message restent). */
export function cleanText(v: unknown, max: number, multiline = false): string {
  const s = String(v ?? '')
    .replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, ' ')
    .replace(multiline ? /[ \t]+/g : /\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.slice(0, max);
}

// ── Validation d'une commande ───────────────────────────────────────────────

export type GiftOrderField =
  | 'type' | 'montant' | 'soins' | 'beneficiaire' | 'message'
  | 'acheteur_prenom' | 'acheteur_nom' | 'acheteur_email' | 'acheteur_telephone';

export interface GiftOrderDraft {
  type: GiftOrderType;
  montant: number;
  lignes: GiftOrderLine[];
  libelle: string;
  beneficiaire: string;
  message: string | null;
  acheteur_prenom: string;
  acheteur_nom: string;
  acheteur_email: string;
  acheteur_telephone: string | null;
}

export type GiftOrderValidation =
  | { ok: true; draft: GiftOrderDraft }
  | { ok: false; errors: Partial<Record<GiftOrderField, string>> };

/**
 * Valide le corps d'une commande. Les soins sont désignés par leur id ; nom et
 * prix viennent du catalogue passé ici (côté serveur : la base), jamais du
 * navigateur.
 */
export function validateGiftOrder(
  raw: unknown,
  ctx: { montantMin: number; catalogue: Map<string, Pick<GiftCatalogItem, 'nom' | 'prix' | 'complement'>> },
): GiftOrderValidation {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<GiftOrderField, string>> = {};

  const type = r.type === 'soins' ? 'soins' : r.type === 'montant' ? 'montant' : null;
  if (!type) errors.type = 'Choisissez un montant ou des soins.';

  let montant = 0;
  let lignes: GiftOrderLine[] = [];

  if (type === 'montant') {
    const m = parseMontant(r.montant);
    if (m === null || m <= 0) errors.montant = 'Indiquez le montant du bon.';
    else if (m < ctx.montantMin) errors.montant = `Le montant minimal est de CHF ${ctx.montantMin}.`;
    else if (m > GIFT_MAX) errors.montant = `Au-delà de CHF ${GIFT_MAX}, contactez directement l'institut.`;
    else montant = m;
  }

  if (type === 'soins') {
    const asked = Array.isArray(r.soins) ? r.soins : [];
    const byId = new Map<string, number>();
    for (const s of asked) {
      const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : '';
      const q = Math.floor(Number(o.quantite ?? 1));
      if (!id || !Number.isFinite(q) || q < 1) continue;
      byId.set(id, Math.min(GIFT_QTE_MAX, (byId.get(id) ?? 0) + q));
    }
    const unknown = [...byId.keys()].filter((id) => !ctx.catalogue.has(id));
    if (byId.size === 0) {
      errors.soins = 'Choisissez au moins un soin.';
    } else if (unknown.length > 0) {
      errors.soins = "Un soin choisi n'est plus à la carte : rechargez la page.";
    } else {
      lignes = [...byId.entries()].map(([id, quantite]) => {
        const c = ctx.catalogue.get(id)!;
        return { service_id: id, nom: c.nom, prix_chf: round2(c.prix), quantite };
      });
      if (lignes.every((l) => ctx.catalogue.get(l.service_id)!.complement)) {
        errors.soins = "Un complément s'offre avec un soin : ajoutez le soin qu'il accompagne.";
      }
      montant = giftLinesTotal(lignes);
      if (!errors.soins && montant <= 0) errors.soins = 'Ces soins sont sans prix à la carte : contactez l\'institut.';
      if (!errors.soins && montant > GIFT_MAX) errors.soins = `Au-delà de CHF ${GIFT_MAX}, contactez directement l'institut.`;
    }
  }

  const beneficiaire = cleanText(r.beneficiaire, 80);
  if (!beneficiaire) errors.beneficiaire = 'Le bon est nominatif : indiquez le nom de la personne qui le recevra.';

  const rawMessage = String(r.message ?? '');
  const message = cleanText(rawMessage, GIFT_MESSAGE_MAX + 1, true);
  if (message.length > GIFT_MESSAGE_MAX) errors.message = `Votre message dépasse ${GIFT_MESSAGE_MAX} caractères.`;

  const prenom = cleanText(r.acheteur_prenom, 60);
  const nom = cleanText(r.acheteur_nom, 60);
  if (!prenom) errors.acheteur_prenom = 'Indiquez votre prénom.';
  if (!nom) errors.acheteur_nom = 'Indiquez votre nom.';

  const email = cleanText(r.acheteur_email, 254).toLowerCase();
  if (!email) errors.acheteur_email = 'Indiquez votre e-mail : le bon vous y sera envoyé.';
  else if (!EMAIL_RE.test(email)) errors.acheteur_email = "Cette adresse e-mail ne semble pas valide.";

  const tel = cleanText(r.acheteur_telephone, 30);
  if (tel && tel.replace(/\D/g, '').length < 9) errors.acheteur_telephone = 'Ce numéro semble incomplet.';

  if (Object.keys(errors).length > 0 || !type) return { ok: false, errors };

  return {
    ok: true,
    draft: {
      type,
      montant,
      lignes,
      libelle: giftOrderLibelle(type, lignes),
      beneficiaire,
      message: message || null,
      acheteur_prenom: prenom,
      acheteur_nom: nom,
      acheteur_email: email,
      acheteur_telephone: tel || null,
    },
  };
}

// ── Administration ──────────────────────────────────────────────────────────

export function giftOrderStatusLabel(o: Pick<GiftOrder, 'status'>): string {
  if (o.status === 'payee') return 'Payée';
  if (o.status === 'annulee') return 'Annulée';
  return 'Paiement à vérifier';
}

/** Nombre de jours pleins depuis la commande (pour repérer celles qui traînent). */
export function joursDepuis(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** Ce que la cliente voit après avoir commandé (et ce que la route renvoie). */
export interface GiftOrderPublicView {
  reference: string;
  montant: number;
  libelle: string;
  beneficiaire: string;
  acheteur_email: string;
  twintQr: string;
  twintLien: string;
}
