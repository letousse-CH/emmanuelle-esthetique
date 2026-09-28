/**
 * Service d'analyse et d'extraction automatique des factures fournisseurs et dépenses.
 * Spécialisé pour les factures COSKYN (Phytomer) et les charges d'exploitation suisses.
 */

import { ExpenseItem, ProductUsageType } from '../types/finance';

export interface ParsedInvoiceResult {
  fournisseur: string;
  numero_facture: string;
  date_facture: string;
  date_echeance?: string;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  category_code: string; // ex: '4000', '4200', '6200', '6500'
  is_stock_invoice: boolean;
  notes?: string;
  items: ExpenseItem[];
}

/**
 * Données complètes de la facture COSKYN No 139079 du 25.09.2026.
 * Sert de jeu de données de référence et de démonstration instantanée.
 */
export const COSKYN_FACTURE_139079: ParsedInvoiceResult = {
  fournisseur: 'COSKYN SA',
  numero_facture: '139079',
  date_facture: '2026-09-25',
  date_echeance: '2026-09-29',
  montant_ht: 2163.50,
  taux_tva: 8.1,
  montant_tva: 175.25,
  montant_ttc: 2338.75,
  category_code: '4200', // Dépense mixte cabine / vente
  is_stock_invoice: true,
  notes: 'Facture Coskyn SA (Phytomer). Paiement échelonné 1/3 (700.00 CHF payable au 29.09.2026). Contient réassort vente, cabine, testeurs et consommables.',
  items: [
    // ── Vente (PHY.V) ──────────────────────────────────────────────────────────
    {
      designation: 'Rosée Visage - Gelée Nettoyante - 150 ml',
      reference: '100119',
      quantite: 2,
      prix_unitaire: 17.25,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 34.50,
      usage_type: 'vente',
    },
    {
      designation: 'Perfect Visage - Lait Démaquillant Douceur - 250 ml',
      reference: '100100',
      quantite: 2,
      prix_unitaire: 16.70,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 33.40,
      usage_type: 'vente',
    },
    {
      designation: 'Rosée Visage - Lotion Démaquillante - 250 ml',
      reference: '100101',
      quantite: 2,
      prix_unitaire: 16.70,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 33.40,
      usage_type: 'vente',
    },
    {
      designation: 'Scrub Marin - Crème de Gommage - 50 ml',
      reference: '100118',
      quantite: 2,
      prix_unitaire: 24.50,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 49.00,
      usage_type: 'vente',
    },
    {
      designation: 'Expert Jeunesse - Crème Repulpante Rides - 50 ml',
      reference: '100337',
      quantite: 2,
      prix_unitaire: 50.20,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 100.40,
      usage_type: 'vente',
    },
    {
      designation: 'Oligoforce Advanced - Sérum - 30 ml',
      reference: '100330',
      quantite: 2,
      prix_unitaire: 50.20,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 100.40,
      usage_type: 'vente',
    },
    {
      designation: 'Structuriste - Crème Lift Fermeté - 50 ml',
      reference: '100109',
      quantite: 2,
      prix_unitaire: 60.80,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 121.60,
      usage_type: 'vente',
    },
    {
      designation: 'Hydra Originel - Crème Fondante Hydratante - 50 ml',
      reference: '100048',
      quantite: 2,
      prix_unitaire: 38.45,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 76.90,
      usage_type: 'vente',
    },
    {
      designation: 'Hydralgue - Sérum Ultra-Hydratant - 30 ml',
      reference: '100259',
      quantite: 2,
      prix_unitaire: 38.45,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 76.90,
      usage_type: 'vente',
    },
    {
      designation: 'Hydralgue - Masque Désaltérant Réhydratant - 50 ml',
      reference: '100319',
      quantite: 2,
      prix_unitaire: 21.75,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 43.50,
      usage_type: 'vente',
    },
    {
      designation: 'Citadine - Crème Sorbet Visage et Yeux - 50 ml',
      reference: '100139',
      quantite: 2,
      prix_unitaire: 49.65,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 99.30,
      usage_type: 'vente',
    },
    {
      designation: 'Oligo 6 - Concentré Marin - 30 ml',
      reference: '100149',
      quantite: 2,
      prix_unitaire: 42.40,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 84.80,
      usage_type: 'vente',
    },
    {
      designation: 'Contour Jeunesse - Crème Yeux et Lèvres - 15 ml',
      reference: '100019',
      quantite: 2,
      prix_unitaire: 33.45,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 66.90,
      usage_type: 'vente',
    },
    {
      designation: 'Expertise Âge Contour - Crème Yeux - 15 ml',
      reference: '100016',
      quantite: 2,
      prix_unitaire: 43.50,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 87.00,
      usage_type: 'vente',
    },
    {
      designation: 'Gommage Corps Tonifiant - 150 ml',
      reference: '101138',
      quantite: 2,
      prix_unitaire: 25.10,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 50.20,
      usage_type: 'vente',
    },
    {
      designation: 'Trésor des Mers - Huile Sublimatrice - 100 ml',
      reference: '101163',
      quantite: 2,
      prix_unitaire: 21.75,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 43.50,
      usage_type: 'vente',
    },
    {
      designation: 'Oléocrème - Lait Corps Ultra-Hydratant - 250 ml',
      reference: '101157',
      quantite: 2,
      prix_unitaire: 23.40,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 46.80,
      usage_type: 'vente',
    },

    // ── Cabine (PHY.C) ─────────────────────────────────────────────────────────
    {
      designation: 'Brume Marine - Eau de Soin Parfumée - 200 ml',
      reference: '111143',
      quantite: 1,
      prix_unitaire: 29.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 29.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Huile de Modelage Ultra-Nourrissante - 2 l',
      reference: '111331',
      quantite: 1,
      prix_unitaire: 99.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 99.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Boue Marine Auto-Chauffante - 2 kg',
      reference: '111035',
      quantite: 1,
      prix_unitaire: 105.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 105.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Sérum Relaxant - 100 ml',
      reference: '111190',
      quantite: 1,
      prix_unitaire: 45.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 45.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Perfect Visage - Lait Démaquillant Douceur - 1 l',
      reference: '110100',
      quantite: 1,
      prix_unitaire: 40.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 40.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Rosée Visage - Lotion Démaquillante - 1 l',
      reference: '110101',
      quantite: 1,
      prix_unitaire: 40.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 40.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Doux Contour - Démaquillant Waterproof - 500 ml',
      reference: '110129',
      quantite: 1,
      prix_unitaire: 29.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 29.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Masque Chauffant Nettoyant - 250 ml',
      reference: '110192',
      quantite: 1,
      prix_unitaire: 45.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 45.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Scrub Marin - Crème de Gommage - 150 ml',
      reference: '110118',
      quantite: 1,
      prix_unitaire: 38.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 38.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Crème de Modelage Hydra-Fondante - 250 ml',
      reference: '110300',
      quantite: 1,
      prix_unitaire: 55.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 55.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Expert Jeunesse - Crème Repulpante Rides - 100 ml',
      reference: '110337',
      quantite: 1,
      prix_unitaire: 58.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 58.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Masque Lissant Tenseur - Plastifiant - 500 g',
      reference: '110345',
      quantite: 1,
      prix_unitaire: 95.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 95.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Hydra Originel - Crème Fondante Hydratante - 100 ml',
      reference: '110048',
      quantite: 1,
      prix_unitaire: 46.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 46.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Masque Crémeux Hydratant - 120 g',
      reference: '110046',
      quantite: 1,
      prix_unitaire: 49.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 49.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Gommage Corps Tonifiant - 450 ml',
      reference: '111138',
      quantite: 1,
      prix_unitaire: 58.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 58.00,
      usage_type: 'cabine',
    },
    {
      designation: 'Oléocrème - Lait Corps Ultra-Hydratant - 1 l',
      reference: '111157',
      quantite: 1,
      prix_unitaire: 69.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 69.00,
      usage_type: 'cabine',
    },

    // ── Testeurs (PHY.T - Offerts à 100%) ──────────────────────────────────────
    {
      designation: 'Testeur : Expert Jeunesse - 50 ml',
      reference: '120337',
      quantite: 1,
      prix_unitaire: 41.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Oligoforce Advanced - 30 ml',
      reference: '120330',
      quantite: 1,
      prix_unitaire: 41.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Structuriste - 50 ml',
      reference: '120109',
      quantite: 1,
      prix_unitaire: 49.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Hydra Originel - 50 ml',
      reference: '120048',
      quantite: 1,
      prix_unitaire: 31.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Hydralgue - 30 ml',
      reference: '120259',
      quantite: 1,
      prix_unitaire: 31.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Citadine - 50 ml',
      reference: '120139',
      quantite: 1,
      prix_unitaire: 40.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Oligo 6 - 30 ml',
      reference: '120149',
      quantite: 1,
      prix_unitaire: 34.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Contour Jeunesse - 15 ml',
      reference: '120019',
      quantite: 1,
      prix_unitaire: 27.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Expertise Âge Contour - 15 ml',
      reference: '120016',
      quantite: 1,
      prix_unitaire: 35.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },
    {
      designation: 'Testeur : Trésor des Mers - 100 ml',
      reference: '121163',
      quantite: 1,
      prix_unitaire: 18.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'testeur',
    },

    // ── Échantillons (PHY.E - Offerts à 100%) ──────────────────────────────────
    {
      designation: 'Échantillons : Expert Jeunesse - 10x 5 ml',
      reference: '130337',
      quantite: 1,
      prix_unitaire: 17.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },
    {
      designation: 'Échantillons : Structuriste - 10x 5 ml',
      reference: '130109',
      quantite: 1,
      prix_unitaire: 15.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },
    {
      designation: 'Échantillons : Hydra Originel - 10x 5 ml',
      reference: '130048',
      quantite: 1,
      prix_unitaire: 11.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },
    {
      designation: 'Échantillons : Citadine - 10x 5 ml',
      reference: '130139',
      quantite: 1,
      prix_unitaire: 16.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },
    {
      designation: 'Échantillons : Contour Jeunesse - 10x 3 ml',
      reference: '130019',
      quantite: 1,
      prix_unitaire: 16.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },
    {
      designation: 'Échantillons : Oléocrème - 10x 7 ml',
      reference: '131157',
      quantite: 1,
      prix_unitaire: 19.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'echantillon',
    },

    // ── Matériel & Consommables (PHY.A) ────────────────────────────────────────
    {
      designation: 'Sacs Shopping - 20 Pcs',
      reference: '160031',
      quantite: 1,
      prix_unitaire: 23.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'consommable',
    },
    {
      designation: 'Drap de Lit Bleu Cabine',
      reference: '151818',
      quantite: 1,
      prix_unitaire: 60.00,
      taux_tva: 8.1,
      rabais_pct: 100,
      total_ttc: 0.00,
      usage_type: 'consommable',
    },
    {
      designation: 'Papier Parathermique - Petit - 0.40 x 200 m',
      reference: '152002',
      quantite: 1,
      prix_unitaire: 115.00,
      taux_tva: 8.1,
      rabais_pct: 0,
      total_ttc: 115.00,
      usage_type: 'consommable',
    },
  ],
};

/**
 * Analyseur textuel heuristique pour les factures diverses (assurance, loyer, marketing, etc.)
 */
export function parseRawInvoiceText(text: string): Partial<ParsedInvoiceResult> {
  const t = text.toLowerCase();

  let fournisseur = 'Fournisseur inconnu';
  let category_code = '6990';
  let is_stock_invoice = false;

  // Détection du fournisseur et de la catégorie
  if (t.includes('coskyn') || t.includes('phytomer')) {
    fournisseur = 'COSKYN SA';
    category_code = '4200';
    is_stock_invoice = true;
  } else if (t.includes('vaudoise') || t.includes('axa') || t.includes('zurich') || t.includes('assurance') || t.includes('rc pro')) {
    fournisseur = t.includes('vaudoise') ? 'Vaudoise Assurances' : t.includes('axa') ? 'AXA Assurances' : 'Assurance Professionnelle';
    category_code = '6200';
  } else if (t.includes('google') || t.includes('meta') || t.includes('facebook') || t.includes('instagram') || t.includes('publicité') || t.includes('marketing')) {
    fournisseur = t.includes('google') ? 'Google Ads' : t.includes('meta') || t.includes('facebook') || t.includes('instagram') ? 'Meta Platforms Ireland' : 'Marketing & Publicité';
    category_code = '6500';
  } else if (t.includes('swisscom') || t.includes('salt') || t.includes('sunrise') || t.includes('infomaniak') || t.includes('logiciel') || t.includes('adobe')) {
    fournisseur = t.includes('swisscom') ? 'Swisscom' : t.includes('infomaniak') ? 'Infomaniak' : 'Informatique & Télécoms';
    category_code = '6570';
  } else if (t.includes('loyer') || t.includes('bail') || t.includes('regie') || t.includes('gérance')) {
    fournisseur = 'Loyer Cocon Palézieux';
    category_code = '6000';
  } else if (t.includes('caisse de compensation') || t.includes('avs') || t.includes('cvas') || t.includes('ciam')) {
    fournisseur = 'Caisse de compensation AVS (Vaud)';
    category_code = '5000';
  }

  // Détection du numéro de facture
  const numMatch = text.match(/(?:facture|invoice|n°|no|rechnung)[\s:.]*([a-z0-9\-_/]+)/i);
  const numero_facture = numMatch ? numMatch[1] : '';

  // Détection du montant
  const amountMatch = text.match(/(?:total|montant|chf)[\s:.]*([0-9'’]+[.,][0-9]{2})/i);
  let montant_ttc = 0;
  if (amountMatch) {
    const raw = amountMatch[1].replace(/['’\s]/g, '').replace(',', '.');
    montant_ttc = parseFloat(raw) || 0;
  }

  return {
    fournisseur,
    numero_facture,
    category_code,
    is_stock_invoice,
    montant_ttc,
    montant_ht: montant_ttc,
    taux_tva: 0,
    montant_tva: 0,
    date_facture: new Date().toISOString().split('T')[0],
  };
}
