/**
 * Types du module Caisse. Les montants sont des francs (numeric(10,2) côté
 * Postgres, `number` ici) — jamais des centimes entiers.
 */

export type ModePaiement = 'especes' | 'carte' | 'twint' | 'virement' | 'bon_cadeau' | 'abonnement';
export type TransactionStatus = 'payee' | 'annulee';

/** Modes proposés à l'écran. `bon_cadeau` et `abonnement` n'y figurent pas : ils
 *  se déduisent du bon ou des séances d'abonnement quand ils soldent la facture. */
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
  abonnement: 'Abonnement',
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

/*
 * Il n'y a volontairement AUCUN champ de santé sur la fiche cliente : ni
 * allergies, ni journal d'observation après soin. C'est une décision de
 * l'exploitante, appliquée par la migration
 * `20260804_retrait_donnees_sante.sql`. Ne pas en réintroduire sans elle.
 */

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
 *
 * Un abonnement est une formule de séances payées d'avance (ex. 10 massages +
 * 1 offert). Sa composition dit combien de séances de quel soin la cliente
 * reçoit ; elle est recopiée sur chaque abonnement vendu (`Subscription`).
 */
export type ServiceType = 'prestation' | 'forfait' | 'abonnement';

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
  /** Abonnement : validité en mois à compter de la vente (12 si vide). */
  validite_mois?: number | null;
  created_at: string;
  updated_at: string;
}

/** Durée de validité par défaut d'un abonnement, en mois. */
export const ABONNEMENT_VALIDITE_DEFAUT = 12;

/** Une prestation composant un forfait ou un abonnement, jointe à sa fiche pour l'affichage. */
export interface ForfaitItem {
  id: string;
  forfait_id: string;
  service_id: string;
  /** Abonnement : nombre TOTAL de séances de ce soin, offertes comprises. */
  quantite: number;
  /** Abonnement : combien de ces séances sont offertes. */
  offertes?: number;
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
  usage_type?: 'vente' | 'cabine' | 'consommable' | 'testeur' | 'echantillon';
  contenance?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Article destiné à la revente : il apparaît en caisse et dans « Produits vente ».
 * Tous les autres usages (cabine, consommable, testeur, échantillon) vivent
 * dans « Stock cabine ». L'usage de la fiche fait foi — pas le nom ni la
 * référence, qu'aucune règle ne sait lire sans se tromper.
 */
export function isVenteProduct(p: Pick<Product, 'usage_type'>): boolean {
  return (p.usage_type ?? 'vente') === 'vente';
}

/**
 * Coût d'acquisition d'un article (CO art. 960a) : le prix d'achat HT de la
 * facture, plus la TVA payée au fournisseur tant qu'elle n'est pas récupérable
 * (activité non assujettie). C'est ce coût qui vaut au bilan et dans les marges.
 */
export function coutAchat(
  p: Pick<Product, 'prix_achat_chf' | 'taux_tva_defaut'>,
  tvaRecuperable: boolean,
  prixHT: number = Number(p.prix_achat_chf || 0),
): number {
  // Pas d'arrondi ici : multiplié par une quantité, un coût unitaire arrondi
  // fausserait la valeur du stock. L'affichage (formatCHF) arrondit.
  return prixHT * (tvaRecuperable ? 1 : 1 + Number(p.taux_tva_defaut || 0) / 100);
}

/** Contenance lue à la fin du nom Phytomer : « Lait Démaquillant - 1 l » → « 1 l ». */
export function contenanceDepuisNom(nom: string): string | null {
  const m = (nom || '').match(/\s[-–]\s([^-–]*\d[^-–]*)$/);
  return m ? m[1].trim() : null;
}

export type StockMovementType = 'reception' | 'vente' | 'retour' | 'inventaire' | 'perte';

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  reception:  'Réception',
  vente:      'Vente',
  retour:     'Retour',
  inventaire: 'Inventaire',
  perte:      'Perte',
};

/** Mouvements saisissables à la main. La vente naît de la caisse, le retour
 *  cliente de la correction de sa facture (Journal), l'écart de l'inventaire ;
 *  une réception se rattache toujours à sa facture d'achat. */
export const STOCK_MOVEMENTS_MANUELS: { value: 'reception' | 'perte'; label: string; help: string }[] = [
  { value: 'reception', label: 'Réception', help: 'Livraison rattachée à sa facture d\'achat' },
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

export interface ValeurStock {
  /** Produits destinés à la revente (`isVenteProduct`). */
  marchandises: number;
  /** Produits cabine, consommables, testeurs : achetés pour les soins. */
  matieres: number;
  total: number;
  /** Articles au stock enregistré négatif, comptés pour zéro : à inventorier. */
  negatifs: string[];
}

/**
 * Valeur du stock à un instant, reconstituée depuis le journal des mouvements :
 * quantité = somme des mouvements antérieurs, valorisée au coût d'acquisition
 * (CO art. 960a) — le prix de la dernière réception avant cet instant, sinon
 * celui de la fiche. Tant que l'activité n'est pas assujettie, la TVA payée à
 * l'achat n'est pas récupérable : elle fait partie du coût (`tvaNonRecuperable`).
 *
 * `avant` est un instant ISO exclu ; `null` prend tout le journal (aujourd'hui).
 */
export function valeurStock(
  products: Pick<Product, 'id' | 'nom' | 'reference' | 'usage_type' | 'prix_achat_chf' | 'taux_tva_defaut'>[],
  movements: Pick<StockMovement, 'product_id' | 'quantite' | 'type' | 'prix_achat_unitaire' | 'created_at'>[],
  avant: string | null,
  tvaNonRecuperable: boolean,
): ValeurStock {
  const limite = avant ? Date.parse(avant) : Infinity;
  const qte = new Map<string, number>();
  const dernierPrix = new Map<string, { t: number; prix: number }>();
  for (const m of movements) {
    const t = Date.parse(m.created_at);
    if (!(t < limite)) continue;
    qte.set(m.product_id, (qte.get(m.product_id) ?? 0) + Number(m.quantite || 0));
    if (m.type === 'reception' && m.prix_achat_unitaire !== null && m.prix_achat_unitaire !== undefined) {
      const prev = dernierPrix.get(m.product_id);
      if (!prev || t >= prev.t) dernierPrix.set(m.product_id, { t, prix: Number(m.prix_achat_unitaire) });
    }
  }
  let marchandises = 0;
  let matieres = 0;
  const negatifs: string[] = [];
  for (const p of products) {
    const q = qte.get(p.id) ?? 0;
    if (q < 0) negatifs.push(p.nom);
    if (q <= 0) continue;
    const cout = coutAchat(p, !tvaNonRecuperable, dernierPrix.get(p.id)?.prix);
    if (isVenteProduct(p)) marchandises += q * cout; else matieres += q * cout;
  }
  marchandises = round2(marchandises);
  matieres = round2(matieres);
  return { marchandises, matieres, total: round2(marchandises + matieres), negatifs };
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
export function ligneMarge(
  item: Pick<TransactionItem, 'product_id' | 'prix_achat_unitaire' | 'total_ttc' | 'taux_tva' | 'quantite'>,
  /** TVA payée sur l'achat et non récupérable (activité non assujettie) : elle s'ajoute au coût figé, HT. */
  tauxAchatNonRecuperable = 0,
): number | null {
  if (!item.product_id || item.prix_achat_unitaire === null || item.prix_achat_unitaire === undefined) return null;
  const ht = Number(item.total_ttc || 0) / (1 + Number(item.taux_tva || 0) / 100);
  const coutUnitaire = Number(item.prix_achat_unitaire) * (1 + Number(tauxAchatNonRecuperable || 0) / 100);
  return round2(ht - coutUnitaire * Number(item.quantite || 0));
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

// ── Abonnements de séances ──────────────────────────────────────────────────
//
// Payé en une fois à la vente (c'est là qu'entre la recette), puis consommé
// séance par séance : chaque séance figure sur une facture à CHF 0.00. Voir
// `supabase/migrations/20261022_caisse_abonnements.sql`.

export type SubscriptionStatus = 'active' | 'epuise' | 'annule';

/** Un compteur de séances d'un soin, recopié de la formule à la vente. */
export interface SubscriptionCredit {
  id: string;
  subscription_id: string;
  service_id: string | null;
  libelle: string;
  seances: number;
  offertes: number;
  restantes: number;
  ordre: number;
}

export interface Subscription {
  id: string;
  annee: number;
  number_seq: number;
  code: string;
  service_id: string | null;
  libelle: string;
  client_id: string;
  client_label: string;
  prix_paye: number;
  sale_transaction_id: string;
  emis_le: string;
  expire_initiale: string;
  expire_le: string;
  prolonge_le: string | null;
  status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
  /** Jointure de `listSubscriptions`, triée par `ordre`. */
  subscription_credits: SubscriptionCredit[];
}

/** Échu : comme pour un bon, l'expiration se calcule à la lecture, jamais stockée. */
export function isSubscriptionExpired(s: Pick<Subscription, 'expire_le'>, today: Date = new Date()): boolean {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  return new Date(`${s.expire_le}T00:00:00`) < d;
}

export function seancesRestantes(s: Pick<Subscription, 'subscription_credits'>): number {
  return (s.subscription_credits ?? []).reduce((n, c) => n + Number(c.restantes || 0), 0);
}

export function seancesTotales(s: Pick<Subscription, 'subscription_credits'>): number {
  return (s.subscription_credits ?? []).reduce((n, c) => n + Number(c.seances || 0), 0);
}

export function isSubscriptionUsable(s: Subscription, today: Date = new Date()): boolean {
  return s.status === 'active' && !isSubscriptionExpired(s, today) && seancesRestantes(s) > 0;
}

export function subscriptionStatusLabel(s: Subscription, today: Date = new Date()): string {
  if (s.status === 'annule') return 'Annulé';
  if (s.status === 'epuise' || seancesRestantes(s) === 0) return 'Terminé';
  if (isSubscriptionExpired(s, today)) return 'Échu';
  return 'En cours';
}

/**
 * Valeur des séances encore dues : prix payé × séances restantes ÷ séances
 * totales (les offertes comprises, puisque le prix les couvre aussi). Ce n'est
 * pas une recette à venir — elle est déjà encaissée — mais un engagement envers
 * la cliente. Un abonnement annulé ou échu n'engage plus rien.
 */
export function subscriptionEncours(s: Subscription, today: Date = new Date()): number {
  if (s.status === 'annule' || isSubscriptionExpired(s, today)) return 0;
  const total = seancesTotales(s);
  if (total <= 0) return 0;
  return round2(Number(s.prix_paye || 0) * seancesRestantes(s) / total);
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** « Massage 60 min : 10 séances + 1 offerte · Soin visage : 1 séance offerte ». */
export function compositionResume(items: { libelle: string; seances: number; offertes?: number }[]): string {
  return items.map(it => {
    const offertes = Number(it.offertes || 0);
    const payees = Number(it.seances || 0) - offertes;
    if (payees <= 0) return `${it.libelle} : ${pluriel(offertes, 'séance')} offerte${offertes > 1 ? 's' : ''}`;
    return `${it.libelle} : ${pluriel(payees, 'séance')}${offertes > 0 ? ` + ${offertes} offerte${offertes > 1 ? 's' : ''}` : ''}`;
  }).join(' · ');
}

/** Séance prise sur un abonnement, portée par une ligne du panier. */
export interface SeanceDraft {
  /** Compteur d'un abonnement déjà vendu. */
  credit_id: string | null;
  /** Abonnement vendu sur ce même ticket (séance prise le jour de l'achat) : clé de sa ligne. */
  vendu_key?: string;
  /** Code de l'abonnement, pour l'affichage (inconnu tant qu'il n'est pas émis). */
  code: string | null;
}

/** Identifie un compteur, qu'il soit en base ou à émettre avec ce ticket. */
export function seanceKey(draft: Pick<SeanceDraft, 'credit_id' | 'vendu_key'>, serviceId: string | null): string {
  return draft.credit_id ?? `vendu:${draft.vendu_key ?? ''}:${serviceId ?? ''}`;
}

/** Séances déjà posées au ticket sur ce compteur. */
export function seancesAuTicket(lines: CartLine[], key: string): number {
  return lines.reduce(
    (n, l) => n + (l.seance && seanceKey(l.seance, l.service_id) === key ? Number(l.quantite || 0) : 0),
    0,
  );
}

/**
 * Libellé de la séance tel que Postgres l'écrira sur la facture (il le recalcule
 * depuis le compteur, sous verrou : l'écran n'en donne qu'un aperçu).
 */
export function seanceLabel(
  credit: Pick<SubscriptionCredit, 'libelle' | 'seances' | 'restantes'>,
  dejaAuTicket: number,
  code: string | null,
): string {
  const n = Number(credit.seances) - Number(credit.restantes) + dejaAuTicket + 1;
  return `${credit.libelle} — séance ${n}/${credit.seances} (${code ? `abonnement ${code}` : 'nouvel abonnement'})`;
}

/**
 * Déduit une séance au ticket. Si le soin y figure déjà au prix normal, cette
 * ligne devient la séance (une ligne de quantité 2 n'en cède qu'une) ; sinon une
 * ligne de séance s'ajoute. La séance vaut toujours CHF 0 et 0 % : le soin a été
 * payé à l'achat de l'abonnement.
 */
export function appliquerSeance(
  lines: CartLine[],
  seance: { service_id: string | null; description: string; draft: SeanceDraft },
  key: string,
): CartLine[] {
  const ligne: CartLine = {
    key,
    service_id: seance.service_id,
    description: seance.description,
    prix_unitaire_ttc: 0,
    quantite: 1,
    taux_tva: 0,
    seance: seance.draft,
  };
  const i = seance.service_id
    ? lines.findIndex(l => l.service_id === seance.service_id
        && !l.seance && !l.gift_card && !l.abonnement && !l.product_id && !l.offer_id)
    : -1;
  if (i < 0) return [...lines, ligne];
  const next = [...lines];
  if (next[i].quantite > 1) {
    next[i] = { ...next[i], quantite: next[i].quantite - 1 };
    next.splice(i + 1, 0, ligne);
  } else {
    next[i] = ligne;
  }
  return next;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  service_id: string | null;
  gift_card_id: string | null;
  /** Abonnement vendu par cette ligne. */
  subscription_id?: string | null;
  /** Compteur d'abonnement sur lequel cette ligne a pris une séance (ligne à CHF 0). */
  subscription_credit_id?: string | null;
  product_id: string | null;
  /** Offre du moment vendue par cette ligne : sert au décompte de ses places, jamais au prix. */
  offer_id?: string | null;
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
  /** Facture émise « Client de passage » dont la cliente a été inscrite après
   *  coup, à cette date (null : nom inscrit à l'encaissement). Absent avant la
   *  migration `20261018_caisse_cliente_indiquee`. */
  client_indiquee_le?: string | null;
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

/**
 * Recettes d'un ensemble de factures, ventilées par nature : prestations,
 * marchandise, bons cadeaux vendus. Chaque ligne reçoit la part encaissée de
 * sa facture (un soin réglé par bon pèse 0) ; les prestations sont calculées
 * par différence, pour que les trois postes se somment au centime au total.
 */
export function ventilerRecettes(
  txs: (Pick<Transaction, 'status' | 'total_ttc' | 'montant_bon'> & {
    transaction_items?: Pick<TransactionItem, 'total_ttc' | 'product_id' | 'gift_card_id'>[] | null;
  })[],
): { total: number; prestations: number; produits: number; bons: number } {
  let total = 0;
  let produits = 0;
  let bons = 0;
  for (const t of txs) {
    const recette = recetteEncaissee(t);
    if (recette === 0) continue;
    total += recette;
    const part = recette / Number(t.total_ttc);
    for (const it of t.transaction_items ?? []) {
      const montant = Number(it.total_ttc || 0) * part;
      if (it.gift_card_id) bons += montant;
      else if (it.product_id) produits += montant;
    }
  }
  total = round2(total);
  produits = round2(produits);
  bons = round2(bons);
  return { total, prestations: round2(total - produits - bons), produits, bons };
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
  /** Renseigné quand la ligne vend l'offre du moment : la facture la comptera
   *  dans les places de l'offre. Le prix, lui, reste celui de la ligne. */
  offer_id?: string | null;
  description: string;
  prix_unitaire_ttc: number;
  quantite: number;
  taux_tva: number;
  /** Remise en % accordée sur la ligne ; `prix_base` garde le prix avant remise. */
  remise_pct?: number;
  prix_base?: number;
  /** Présent si la ligne vend un bon cadeau, qui sera émis à la validation. */
  gift_card?: GiftCardDraft;
  /** La ligne vend une formule d'abonnement (Postgres le vérifie sur la fiche). */
  abonnement?: boolean;
  /** La ligne est une séance prise sur un abonnement : CHF 0, forcé par Postgres. */
  seance?: SeanceDraft;
}

/**
 * Remise en % sur le prix unitaire d'une ligne. Le prix remisé devient le prix
 * de la ligne (Postgres recalcule HT/TVA/TTC depuis ce prix) ; `prix_base` garde
 * l'original pour pouvoir changer ou retirer la remise. 0 % rétablit le prix.
 */
export function remisePatch(line: Pick<CartLine, 'prix_unitaire_ttc' | 'prix_base'>, pct: number): Partial<CartLine> {
  const base = line.prix_base ?? line.prix_unitaire_ttc;
  const p = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  if (p === 0) return { prix_base: undefined, remise_pct: undefined, prix_unitaire_ttc: base };
  return { prix_base: base, remise_pct: p, prix_unitaire_ttc: round2(base * (1 - p / 100)) };
}

/** Libellé figé sur la facture : « Soin (remise 10 %) ». */
export function remiseLabel(l: Pick<CartLine, 'description' | 'remise_pct'>): string {
  return l.remise_pct ? `${l.description} (remise ${Number(l.remise_pct)} %)` : l.description;
}

export const CLIENT_DE_PASSAGE = 'Client de passage';

export function clientFullName(c: Pick<Client, 'nom' | 'prenom'>): string {
  return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim();
}

/**
 * Peut-on (encore) inscrire la cliente sur cette facture ? Oui pour une facture
 * payée émise « Client de passage », ou dont la cliente a déjà été inscrite
 * après coup (pour rectifier un mauvais choix de fiche). Jamais pour une
 * facture émise au nom d'une cliente : celle-là se refait par « Corriger ».
 * Même règle en base (`caisse_transactions_guard`, migration 20261018).
 */
export function clienteAIndiquer(
  t: Pick<Transaction, 'status' | 'client_id' | 'client_label' | 'client_indiquee_le'>,
): boolean {
  if (t.status !== 'payee') return false;
  if (t.client_indiquee_le) return true;
  return t.client_id === null && t.client_label === CLIENT_DE_PASSAGE;
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
