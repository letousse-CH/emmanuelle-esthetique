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
  date_naissance: string | null;
  /** Champ à part, jamais noyé dans les notes : c'est la seule information de
   *  la fiche qui peut faire mal si on l'oublie avant un soin. */
  allergies: string | null;
  /** Consentement publicitaire par canal. Encaisser quelqu'un n'en est pas un
   *  (LCD art. 3 al. 1 let. o) : aucune audience ne doit ignorer ces colonnes. */
  consent_email: boolean;
  consent_whatsapp: boolean;
  consent_at: string | null;
  consent_source: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Note de suivi — ce que la facture ne dit pas : produits utilisés en cabine,
 * réaction de la peau, réglages, ce qu'il faudra refaire la prochaine fois.
 * Corrigeable et supprimable, contrairement aux écritures de caisse : ce n'est
 * pas une pièce comptable, et une observation fausse doit pouvoir disparaître.
 */
export interface ClientNote {
  id: string;
  client_id: string;
  transaction_id: string | null;
  date_soin: string;
  contenu: string;
  created_at: string;
  updated_at: string;
}

/** Agrégats de la vue `client_stats`. `total_encaisse` applique la règle du
 *  module (`total_ttc - montant_bon`), jamais la somme brute des TTC. */
export interface ClientStats {
  client_id: string;
  nb_visites: number;
  derniere_visite: string | null;
  premiere_visite: string | null;
  total_encaisse: number;
}

/** Âge en années révolues, ou `null` si la date de naissance est inconnue. */
export function clientAge(c: Pick<Client, 'date_naissance'>): number | null {
  if (!c.date_naissance) return null;
  const d = new Date(`${c.date_naissance}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Mois d'anniversaire (1–12), ou `null`. Sert au segment « anniversaires ». */
export function clientBirthMonth(c: Pick<Client, 'date_naissance'>): number | null {
  if (!c.date_naissance) return null;
  const month = Number(c.date_naissance.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

/** Nombre de mois écoulés depuis la dernière visite. `null` si jamais venue. */
export function moisDepuis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12
    + (now.getMonth() - d.getMonth())
    - (now.getDate() < d.getDate() ? 1 : 0);
}

export interface ServiceCategory {
  id: string;
  nom: string;
  ordre: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Un forfait est une prestation à part entière, avec son propre prix groupé.
 * Sa composition (`ForfaitItem[]`) ne sert qu'à le monter dans l'admin et à
 * afficher l'économie réalisée : elle n'entre jamais dans un calcul de facture.
 */
export type ServiceType = 'prestation' | 'forfait';

export interface Service {
  id: string;
  nom: string;
  description: string | null;
  prix_chf: number;
  taux_tva_defaut: number;
  active: boolean;
  ordre: number;
  category_id: string | null;
  type: ServiceType;
  created_at: string;
  updated_at: string;
}

/** Une prestation composant un forfait, jointe à sa fiche pour l'affichage. */
export interface ForfaitItem {
  id: string;
  forfait_id: string;
  service_id: string;
  quantite: number;
  ordre: number;
  created_at: string;
  /** Renseigné par la jointure de `listForfaitItems`. */
  service?: Pick<Service, 'id' | 'nom' | 'prix_chf'> | null;
}

/** Valeur du forfait s'il était vendu prestation par prestation. */
export function forfaitValeurCumulee(items: ForfaitItem[]): number {
  return round2(items.reduce(
    (acc, it) => acc + Number(it.service?.prix_chf ?? 0) * Number(it.quantite || 0),
    0,
  ));
}

/** Économie offerte à la cliente. Négative si le forfait coûte plus cher que
 *  ses parties — l'admin le signale plutôt que de le masquer. */
export function forfaitEconomie(prixForfait: number, items: ForfaitItem[]): number {
  return round2(forfaitValeurCumulee(items) - Number(prixForfait || 0));
}

// ── Produits revendus & stock ───────────────────────────────────────────────

export interface Product {
  id: string;
  nom: string;
  marque: string | null;
  reference: string | null;
  description: string | null;
  prix_achat_chf: number;
  prix_vente_chf: number;
  taux_tva_defaut: number;
  /** Somme du journal des mouvements. Jamais écrit depuis le navigateur : la
   *  colonne n'est même pas accordée en UPDATE au rôle `authenticated`. */
  stock: number;
  seuil_alerte: number;
  active: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export type StockMovementType = 'reception' | 'vente' | 'retour' | 'inventaire' | 'perte';

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  reception:  'Réception',
  vente:      'Vente',
  retour:     'Retour',
  inventaire: 'Inventaire',
  perte:      'Perte',
};

/** Mouvements saisissables à la main — la vente naît de la caisse, l'écart
 *  d'inventaire de l'écran d'inventaire. */
export const STOCK_MOVEMENTS_MANUELS: { value: 'reception' | 'retour' | 'perte'; label: string; help: string }[] = [
  { value: 'reception', label: 'Réception', help: 'Livraison du fournisseur' },
  { value: 'retour',    label: 'Retour',    help: 'La cliente rapporte un article' },
  { value: 'perte',     label: 'Perte',     help: 'Casse, péremption, usage en cabine' },
];

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  /** Signée : positive à l'entrée, négative à la sortie. */
  quantite: number;
  prix_achat_unitaire: number | null;
  transaction_id: string | null;
  motif: string | null;
  created_at: string;
}

export type StockLevel = 'rupture' | 'bas' | 'ok';

export function stockLevel(p: Pick<Product, 'stock' | 'seuil_alerte'>): StockLevel {
  const stock = Number(p.stock);
  if (stock <= 0) return 'rupture';
  if (stock <= Number(p.seuil_alerte)) return 'bas';
  return 'ok';
}

/**
 * Marge sur un article, en francs.
 *
 * Le prix de vente est saisi TTC (usage en institut) alors que le prix d'achat
 * est un coût : on compare donc la vente **hors taxe** au coût d'achat. Tant
 * que l'activité n'est pas assujettie le taux vaut 0 et les deux se confondent,
 * mais le jour de l'assujettissement le calcul reste juste — à condition de
 * saisir alors des prix d'achat HT, l'impôt préalable devenant récupérable.
 */
export function margeCHF(prixVenteTTC: number, tauxTva: number, prixAchat: number): number {
  const ht = Number(prixVenteTTC || 0) / (1 + Number(tauxTva || 0) / 100);
  return round2(ht - Number(prixAchat || 0));
}

/** Taux de marge en % du prix de vente HT. `null` si la vente est gratuite. */
export function margePct(prixVenteTTC: number, tauxTva: number, prixAchat: number): number | null {
  const ht = Number(prixVenteTTC || 0) / (1 + Number(tauxTva || 0) / 100);
  if (ht <= 0) return null;
  return Math.round((margeCHF(prixVenteTTC, tauxTva, prixAchat) / ht) * 1000) / 10;
}

/**
 * Marge dégagée par une ligne de facture. `null` dès que la ligne ne vend pas
 * de marchandise, ou qu'aucun coût n'a été figé à la vente (produit ajouté au
 * catalogue sans prix d'achat) — c'est différent d'une marge nulle, et le
 * journal doit pouvoir le dire.
 */
export function ligneMarge(item: Pick<TransactionItem, 'product_id' | 'prix_achat_unitaire' | 'total_ttc' | 'taux_tva' | 'quantite'>): number | null {
  if (!item.product_id || item.prix_achat_unitaire === null || item.prix_achat_unitaire === undefined) return null;
  const ht = Number(item.total_ttc || 0) / (1 + Number(item.taux_tva || 0) / 100);
  return round2(ht - Number(item.prix_achat_unitaire) * Number(item.quantite || 0));
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
  product_id: string | null;
  /** Coût d'achat figé à la vente — jamais le prix d'achat courant de la fiche. */
  prix_achat_unitaire: number | null;
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
  /** Renseigné quand la ligne vend de la marchandise : la validation sortira
   *  la quantité du stock et figera le coût d'achat sur la facture. */
  product_id?: string | null;
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
