/**
 * Types du module Finances, Dépenses, Gestion Cabine, AVS et Compte de Résultat.
 *
 * Adapté aux normes comptables suisses pour raison individuelle / indépendant
 * dans le canton de Vaud (Palézieux).
 */

export type ProductUsageType = 'vente' | 'cabine' | 'consommable' | 'testeur' | 'echantillon';

export const PRODUCT_USAGE_LABELS: Record<ProductUsageType, { label: string; badge: string; color: string }> = {
  vente: {
    label: 'Boutique (Revente)',
    badge: 'Vente',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  cabine: {
    label: 'Cabine (Soins pro)',
    badge: 'Cabine',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  consommable: {
    label: 'Consommable / Matériel',
    badge: 'Matériel',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  testeur: {
    label: 'Testeur boutique',
    badge: 'Testeur',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  echantillon: {
    label: 'Échantillon cliente',
    badge: 'Échantillon',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export type ExpenseGroup =
  | 'marchandises_matieres'
  | 'personnel_avs'
  | 'charges_exploitation'
  | 'prelevements_prives'
  | 'autre';

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  marchandises_matieres: 'Achats marchandises & matières (Groupe 4)',
  personnel_avs: 'Cotisations sociales indépendant (Groupe 5)',
  charges_exploitation: 'Autres charges d’exploitation (Groupe 6)',
  prelevements_prives: 'Prélèvements privés exploitant (Compte privé)',
  autre: 'Frais exceptionnels & divers',
};

export interface ExpenseCategory {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  groupe: ExpenseGroup;
  ordre: number;
  deductible_fiscal: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Plan comptable par défaut, repli quand la table `expense_categories` est vide ou absente. */
export const DEFAULT_SWISS_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-4000', code: '4000', nom: 'Achats marchandises boutique (revente)', description: 'Produits cosmétiques destinés à la revente (PHY.V)', groupe: 'marchandises_matieres', ordre: 10, deductible_fiscal: true },
  { id: 'cat-4200', code: '4200', nom: 'Achats produits cabine & matières premières', description: 'Produits professionnels grands formats pour soins (PHY.C)', groupe: 'marchandises_matieres', ordre: 20, deductible_fiscal: true },
  { id: 'cat-4400', code: '4400', nom: 'Consommables & fournitures de soin', description: 'Draps d\'examen, bandes, papier parathermique, sacs (PHY.A)', groupe: 'charges_exploitation', ordre: 30, deductible_fiscal: true },
  { id: 'cat-5000', code: '5000', nom: 'Cotisations sociales AVS / AI / APG', description: 'Cotisations pour indépendants (Caisse de compensation vaudoise)', groupe: 'personnel_avs', ordre: 40, deductible_fiscal: true },
  { id: 'cat-5100', code: '5100', nom: 'Prélèvements privés de l\'exploitante', description: 'Rémunération / retraits personnels de l\'indépendante (compte privé)', groupe: 'prelevements_prives', ordre: 50, deductible_fiscal: false },
  { id: 'cat-6000', code: '6000', nom: 'Loyer & quote-part local professionnel', description: 'Loyer ou quote-part professionnelle du domicile à Palézieux', groupe: 'charges_exploitation', ordre: 60, deductible_fiscal: true },
  { id: 'cat-6100', code: '6100', nom: 'Petit matériel, linge & entretien', description: 'Ustensiles, petits appareils, serviettes et linge de cabine, réparations. Un appareil coûteux (au-delà d\'environ CHF 1\'000) s\'amortit : voir avec la fiduciaire.', groupe: 'charges_exploitation', ordre: 62, deductible_fiscal: true },
  { id: 'cat-6200', code: '6200', nom: 'Assurances professionnelles', description: 'RC professionnelle institut, perte de gain maladie', groupe: 'charges_exploitation', ordre: 70, deductible_fiscal: true },
  { id: 'cat-6210', code: '6210', nom: 'Frais de déplacement & véhicule', description: 'Carburant, parking, transports publics, péages pour les trajets professionnels (fournisseur, formation, banque, poste).', groupe: 'charges_exploitation', ordre: 72, deductible_fiscal: true },
  { id: 'cat-6500', code: '6500', nom: 'Marketing, publicité & réseaux sociaux', description: 'Instagram, Meta Ads, Google Ads, flyers, cartes', groupe: 'charges_exploitation', ordre: 80, deductible_fiscal: true },
  { id: 'cat-6570', code: '6570', nom: 'Informatique, logiciels & télécoms', description: 'Site internet, logiciel de caisse, mobile, fibre', groupe: 'charges_exploitation', ordre: 90, deductible_fiscal: true },
  { id: 'cat-6580', code: '6580', nom: 'Formation continue & documentation', description: 'Formations, salons professionnels, livres et abonnements métier.', groupe: 'charges_exploitation', ordre: 92, deductible_fiscal: true },
  { id: 'cat-6640', code: '6640', nom: 'Frais de représentation', description: 'Repas d\'affaires, café, thé et boissons offerts aux clientes, petits cadeaux clientèle. Noter le motif et les personnes concernées.', groupe: 'charges_exploitation', ordre: 96, deductible_fiscal: true },
  { id: 'cat-6800', code: '6800', nom: 'Frais bancaires & commissions d\'encaissement', description: 'Commissions TWINT, cartes bancaires, tenue de compte', groupe: 'charges_exploitation', ordre: 100, deductible_fiscal: true },
  { id: 'cat-6900', code: '6900', nom: 'Électricité, eau & blanchissage', description: 'Quote-part énergie, nettoyage des serviettes de soin', groupe: 'charges_exploitation', ordre: 110, deductible_fiscal: true },
  { id: 'cat-6990', code: '6990', nom: 'Autres charges d\'exploitation', description: 'Frais postaux, papeterie, entretien divers', groupe: 'charges_exploitation', ordre: 120, deductible_fiscal: true },
];

export type ExpenseStatus = 'a_payer' | 'payee' | 'annulee';

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, { label: string; color: string }> = {
  a_payer: { label: 'À payer', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  payee:   { label: 'Payée',   color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  annulee: { label: 'Annulée', color: 'bg-stone-100 text-stone-600 border-stone-200' },
};

export type ExpensePaymentMode =
  | 'virement'
  | 'carte'
  | 'twint'
  | 'especes'
  | 'prelevement_auto'
  | 'echelonne';

export const EXPENSE_PAYMENT_MODE_LABELS: Record<ExpensePaymentMode, string> = {
  virement: 'Virement bancaire (BVR / QR)',
  carte: 'Carte bancaire',
  twint: 'TWINT Pro',
  especes: 'Espèces',
  prelevement_auto: 'Prélèvement automatique (LSV+ / DD)',
  echelonne: 'Paiement échelonné (ex: 3x)',
};

export interface ExpenseItem {
  id?: string;
  expense_id?: string;
  designation: string;
  reference?: string | null;
  quantite: number;
  prix_unitaire: number;
  taux_tva: number;
  rabais_pct: number;
  total_ttc: number;
  usage_type: ProductUsageType;
  contenance?: string | null;
  product_id?: string | null;
  created_at?: string;
}

export interface Expense {
  id: string;
  fournisseur: string;
  numero_facture: string | null;
  date_facture: string;
  date_echeance: string | null;
  date_paiement: string | null;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  category_id: string | null;
  statut: ExpenseStatus;
  mode_paiement: ExpensePaymentMode | null;
  notes: string | null;
  document_url: string | null;
  is_stock_invoice: boolean;
  /** Absents des dépenses saisies avant la migration 20261008. */
  type_piece?: ExpenseDocumentType;
  fournisseur_adresse?: string | null;
  /** N° IDE / TVA du fournisseur (CHE-123.456.789 TVA). */
  fournisseur_ide?: string | null;
  tva_details?: ExpenseTvaLine[];
  /** Chemin de la pièce dans le coffre privé `justificatifs` (Supabase Storage). */
  justificatif_path?: string | null;
  /** Lecture brute de l'IA, gardée pour la traçabilité. */
  extraction_ia?: unknown;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory | null;
  items?: ExpenseItem[];
}

export type ExpenseDocumentType = 'facture' | 'ticket' | 'autre';

/** TVA d'une pièce, taux par taux : base de l'impôt préalable le jour de l'assujettissement. */
export interface ExpenseTvaLine {
  taux: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
}

export interface ServiceSupply {
  id: string;
  service_id: string;
  product_id: string;
  quantite_estimee: number;
  notes: string | null;
  created_at: string;
  product?: {
    id: string;
    nom: string;
    prix_achat_chf: number;
    contenance: string | null;
    usage_type: ProductUsageType;
  } | null;
}

export interface ServiceSupplyCost {
  service_id: string;
  service_nom: string;
  prix_vente_chf: number;
  cout_matiere_estime: number;
  marge_brute_chf: number;
  marge_brute_pct: number;
  supplies: ServiceSupply[];
}

/**
 * Calculateur AVS Vaudois pour Indépendants (Barème légal suisse 2024–2026).
 *
 * - Moins de CHF 10'100 de revenu net : cotisation minimale de CHF 530 / an.
 * - Entre CHF 10'100 et CHF 58'800 : échelle dégressive de 5.371 % à 10.0 %.
 * - Au-delà de CHF 58'800 : taux plein de 10.0 % (AVS 8.1% + AI 1.4% + APG 0.5%).
 * - Frais d'administration caisse de compensation vaudoise : env. 2.0 %.
 */
export function computeAvsIndependant(revenuAnnuelNet: number): {
  tauxPct: number;
  cotisationAnnuelle: number;
  fraisAdmin: number;
  totalAnnuel: number;
  provisionMensuelle: number;
} {
  const r = Math.max(0, revenuAnnuelNet);
  if (r <= 0) {
    return { tauxPct: 0, cotisationAnnuelle: 0, fraisAdmin: 0, totalAnnuel: 0, provisionMensuelle: 0 };
  }

  let cotis = 0;
  let taux = 0;

  if (r < 10100) {
    cotis = 530;
    taux = (cotis / r) * 100;
  } else if (r >= 58800) {
    taux = 10.0;
    cotis = r * 0.10;
  } else {
    // Barème dégressif linéaire d'interpolation entre 10'100 (5.371%) et 58'800 (10.0%)
    const alpha = (r - 10100) / (58800 - 10100);
    taux = 5.371 + alpha * (10.0 - 5.371);
    cotis = r * (taux / 100);
  }

  const frais = cotis * 0.02; // ~2% de frais administratifs caisse AVS
  const tot = cotis + frais;

  return {
    tauxPct: Math.round(taux * 10) / 10,
    cotisationAnnuelle: Math.round(cotis * 20) / 20,
    fraisAdmin: Math.round(frais * 20) / 20,
    totalAnnuel: Math.round(tot * 20) / 20,
    provisionMensuelle: Math.round((tot / 12) * 20) / 20,
  };
}

export interface FinancialDashboardStats {
  periode: { debut: string; fin: string };
  // Chiffre d'affaires
  chiffreAffairesTotal: number;
  caPrestations: number;
  caProduitsVente: number;
  nombreFacturesCaisse: number;
  // Achats & Matières
  achatsMarchandisesBoutique: number;
  achatsCabineMatieres: number;
  consommablesMatériel: number;
  variationStockEstimee: number;
  coutMatiereTotal: number;
  margeBruteTotale: number;
  margeBrutePct: number;
  // Autres Charges d'exploitation
  chargesExploitationTotal: number;
  detailsCharges: Record<string, number>;
  // Rémunération & AVS
  resultatExploitationAvantAvs: number;
  estimationAvs: ReturnType<typeof computeAvsIndependant>;
  cotisationsAvsPayees: number;
  prelevementsExploitant: number;
  beneficeNetFiscal: number;
  // Trésorerie
  totalEncaissementsReels: number;
  totalDecaissementsReels: number;
  soldeTresoreriePeriode: number;
}
