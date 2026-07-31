/**
 * Types du module Caisse. Les montants sont des francs (numeric(10,2) côté
 * Postgres, `number` ici) — jamais des centimes entiers.
 */

export type ModePaiement = 'especes' | 'carte' | 'twint' | 'virement' | 'bon_cadeau';
export type TransactionStatus = 'payee' | 'annulee';

/** Modes proposés à l'écran. `bon_cadeau` n'y figure pas : il se déduit du bon
 *  attaché à la vente quand celui-ci couvre la totalité du montant. */
export const MODES_PAIEMENT: { value: ModePaiement; label: string }[] = [
  { value: 'especes',  label: 'Espèces'  },
  { value: 'carte',    label: 'Carte'    },
  { value: 'twint',    label: 'TWINT'    },
  { value: 'virement', label: 'Virement' },
];

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  especes: 'Espèces',
  carte: 'Carte',
  twint: 'TWINT',
  virement: 'Virement',
  bon_cadeau: 'Bon cadeau',
};

/**
 * Taux TVA suisses au 1ᵉʳ janvier 2024. `0` reste le défaut : l'activité n'est
 * pas assujettie tant que le chiffre d'affaires reste sous CHF 100'000/an
 * (LTVA art. 10). Le jour où elle l'est, il suffit de changer le taux par
 * défaut dans /admin/settings → Caisse : la structure gère déjà un taux par
 * ligne, donc les anciennes factures gardent le leur.
 */
export const TAUX_TVA_CH: { value: number; label: string }[] = [
  { value: 0,   label: '0 % — non assujettie' },
  { value: 8.1, label: '8.1 % — taux normal' },
  { value: 3.8, label: '3.8 % — hébergement' },
  { value: 2.6, label: '2.6 % — taux réduit' },
];

export interface Client {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  nom: string;
  description: string | null;
  prix_chf: number;
  taux_tva_defaut: number;
  active: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export type GiftCardStatus = 'active' | 'epuise' | 'annule';

export interface GiftCard {
  id: string;
  annee: number;
  number_seq: number;
  code: string;
  libelle: string;
  montant_initial: number;
  montant_restant: number;
  beneficiaire: string | null;
  acheteur_client_id: string | null;
  acheteur_label: string;
  sale_transaction_id: string | null;
  emis_le: string;
  expire_le: string;
  status: GiftCardStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Un bon est utilisable s'il n'est ni épuisé, ni annulé, ni échu. L'expiration
 * n'est pas un statut stocké — elle se calcule à la lecture, pour qu'un bon ne
 * puisse jamais paraître valable faute d'une tâche planifiée qui aurait dû
 * tourner.
 */
export function isGiftCardExpired(card: Pick<GiftCard, 'expire_le'>): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${card.expire_le}T00:00:00`) < today;
}

export function isGiftCardUsable(card: GiftCard): boolean {
  return card.status === 'active' && Number(card.montant_restant) > 0 && !isGiftCardExpired(card);
}

export function giftCardStatusLabel(card: GiftCard): string {
  if (card.status === 'annule') return 'Annulé';
  if (card.status === 'epuise') return 'Utilisé';
  if (isGiftCardExpired(card)) return 'Échu';
  return 'Valable';
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  service_id: string | null;
  gift_card_id: string | null;
  description: string;
  prix_unitaire_ttc: number;
  quantite: number;
  taux_tva: number;
  total_ttc: number;
  ordre: number;
}

export interface Transaction {
  id: string;
  annee: number;
  number_seq: number;
  numero: string;
  client_id: string | null;
  client_label: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  mode_paiement: ModePaiement;
  status: TransactionStatus;
  note: string | null;
  /** Bon présenté en paiement, et part de la facture qu'il a réglée. */
  gift_card_id: string | null;
  montant_bon: number;
  /** Facture que celle-ci corrige (l'ancienne reste annulée au journal). */
  corrige_transaction_id: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithItems extends Transaction {
  transaction_items: TransactionItem[];
}

/**
 * Recette réellement encaissée. **C'est la seule définition correcte du CA.**
 *
 * La part réglée par bon cadeau a déjà été encaissée le jour où le bon a été
 * vendu : la recompter ici doublerait le chiffre d'affaires. Ne jamais sommer
 * `total_ttc` directement pour calculer un CA.
 */
export function recetteEncaissee(t: Pick<Transaction, 'status' | 'total_ttc' | 'montant_bon'>): number {
  if (t.status === 'annulee') return 0;
  return round2(Number(t.total_ttc) - Number(t.montant_bon ?? 0));
}

/** Détail d'un bon cadeau à émettre, porté par une ligne du panier. */
export interface GiftCardDraft {
  beneficiaire: string;
  validiteMois: number;
}

/** Ligne du panier d'encaissement, avant validation. */
export interface CartLine {
  /** Clé locale, uniquement pour le rendu React. */
  key: string;
  service_id: string | null;
  description: string;
  prix_unitaire_ttc: number;
  quantite: number;
  taux_tva: number;
  /** Présent si la ligne vend un bon cadeau, qui sera émis à la validation. */
  gift_card?: GiftCardDraft;
}

export const CLIENT_DE_PASSAGE = 'Client de passage';

export function clientFullName(c: Pick<Client, 'nom' | 'prenom'>): string {
  return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim();
}

/**
 * Formatage des montants en `de-CH`, pas en `fr-CH` : c'est le seul des deux
 * qui produit la convention suisse pour l'argent — `CHF 1'234.50`, point
 * décimal et apostrophe de milliers. `fr-CH` écrirait `1'234,50 CHF`, avec une
 * virgule décimale qu'aucune fiduciaire suisse n'attend sur une quittance.
 * (Les dates, elles, restent en `fr-CH`.)
 */
const CHF = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCHF(amount: number | string | null | undefined): string {
  return CHF.format(Number(amount ?? 0));
}

/** Comme `formatCHF` mais sans le symbole — pour les colonnes de tableaux. */
export function formatAmount(amount: number | string | null | undefined): string {
  return Number(amount ?? 0).toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Totaux d'un panier. Reproduit exactement le calcul de
 * `caisse_create_transaction` (prix saisis TTC, HT déduit ligne par ligne,
 * TVA = reliquat) pour que l'aperçu à l'écran corresponde au ticket émis.
 */
export function cartTotals(lines: Pick<CartLine, 'prix_unitaire_ttc' | 'quantite' | 'taux_tva'>[]) {
  let ttc = 0;
  let ht = 0;
  for (const l of lines) {
    const lineTtc = round2(Number(l.prix_unitaire_ttc || 0) * Number(l.quantite || 0));
    ttc += lineTtc;
    ht += round2(lineTtc / (1 + Number(l.taux_tva || 0) / 100));
  }
  ttc = round2(ttc);
  ht = round2(ht);
  return { ttc, ht, tva: round2(ttc - ht) };
}
