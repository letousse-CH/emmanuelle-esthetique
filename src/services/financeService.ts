/**
 * Service de gestion financière, dépenses, calcul de rentabilité cabine,
 * cotisations AVS et compte de résultat pour Emmanuelle Esthétique.
 */

import { supabase } from './supabase';
import {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  FinancialDashboardStats,
  ServiceSupply,
  ServiceSupplyCost,
  computeAvsIndependant,
} from '../types/finance';
import { Product, Service, Transaction, TransactionItem } from '../types/caisse';
import { createProduct, listProducts, stockMovement, updateProduct } from './caisse';
import { COSKYN_FACTURE_139079 } from './invoiceParser';

// ── Ventilation multi-lignes d'une facture mixte ────────────────────────────

export interface InvoiceVentilation {
  partVenteHT: number;
  partVenteTTC: number;
  partCabineHT: number;
  partCabineTTC: number;
  partConsommablesHT: number;
  partConsommablesTTC: number;
  partGratuite: number;
  hasVentilation: boolean;
}

export function getInvoiceVentilation(exp: Expense): InvoiceVentilation {
  if (!exp.items || exp.items.length === 0) {
    const code = exp.category?.code || '';
    const mtTTC = Number(exp.montant_ttc || 0);
    const mtHT = Number(exp.montant_ht || mtTTC);
    return {
      partVenteHT: code === '4000' ? mtHT : 0,
      partVenteTTC: code === '4000' ? mtTTC : 0,
      partCabineHT: code === '4200' ? mtHT : 0,
      partCabineTTC: code === '4200' ? mtTTC : 0,
      partConsommablesHT: code === '4400' ? mtHT : 0,
      partConsommablesTTC: code === '4400' ? mtTTC : 0,
      partGratuite: 0,
      hasVentilation: false,
    };
  }

  let vHT = 0;
  let cHT = 0;
  let aHT = 0;
  let grat = 0;

  for (const it of exp.items) {
    if (it.rabais_pct === 100) {
      grat += Number(it.prix_unitaire * it.quantite);
      continue;
    }
    const lineHT = Number(it.total_ttc || (it.quantite * it.prix_unitaire) || 0);
    const usage = it.usage_type || 'vente';
    if (usage === 'cabine') {
      cHT += lineHT;
    } else if (usage === 'consommable') {
      aHT += lineHT;
    } else {
      vHT += lineHT;
    }
  }

  const sumHT = vHT + cHT + aHT;
  const mtTTC = Number(exp.montant_ttc || 0);
  const factor = sumHT > 0 && mtTTC > 0 ? (mtTTC / sumHT) : (1 + Number(exp.taux_tva || 0) / 100);

  return {
    partVenteHT: Math.round(vHT * 100) / 100,
    partVenteTTC: Math.round(vHT * factor * 100) / 100,
    partCabineHT: Math.round(cHT * 100) / 100,
    partCabineTTC: Math.round(cHT * factor * 100) / 100,
    partConsommablesHT: Math.round(aHT * 100) / 100,
    partConsommablesTTC: Math.round(aHT * factor * 100) / 100,
    partGratuite: Math.round(grat * 100) / 100,
    hasVentilation: true,
  };
}

// ── Catégories de dépenses ──────────────────────────────────────────────────

export const DEFAULT_SWISS_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-4000', code: '4000', nom: 'Achats marchandises boutique (revente)', description: 'Produits cosmétiques destinés à la revente (PHY.V)', groupe: 'marchandises_matieres', ordre: 10, deductible_fiscal: true },
  { id: 'cat-4200', code: '4200', nom: 'Achats produits cabine & matières premières', description: 'Produits professionnels grands formats pour soins (PHY.C)', groupe: 'marchandises_matieres', ordre: 20, deductible_fiscal: true },
  { id: 'cat-4400', code: '4400', nom: 'Consommables & fournitures de soin', description: 'Draps d\'examen, bandes, papier parathermique, sacs (PHY.A)', groupe: 'charges_exploitation', ordre: 30, deductible_fiscal: true },
  { id: 'cat-5000', code: '5000', nom: 'Cotisations sociales AVS / AI / APG', description: 'Cotisations pour indépendants (Caisse de compensation vaudoise)', groupe: 'personnel_avs', ordre: 40, deductible_fiscal: true },
  { id: 'cat-5100', code: '5100', nom: 'Prélèvements privés de l\'exploitante', description: 'Rémunération / retraits personnels de l\'indépendante (compte privé)', groupe: 'prelevements_prives', ordre: 50, deductible_fiscal: false },
  { id: 'cat-6000', code: '6000', nom: 'Loyer & quote-part local professionnel', description: 'Loyer ou quote-part professionnelle du domicile à Palézieux', groupe: 'charges_exploitation', ordre: 60, deductible_fiscal: true },
  { id: 'cat-6200', code: '6200', nom: 'Assurances professionnelles', description: 'RC professionnelle institut, perte de gain maladie', groupe: 'charges_exploitation', ordre: 70, deductible_fiscal: true },
  { id: 'cat-6500', code: '6500', nom: 'Marketing, publicité & réseaux sociaux', description: 'Instagram, Meta Ads, Google Ads, flyers, cartes', groupe: 'charges_exploitation', ordre: 80, deductible_fiscal: true },
  { id: 'cat-6570', code: '6570', nom: 'Informatique, logiciels & télécoms', description: 'Site internet, logiciel de caisse, mobile, fibre', groupe: 'charges_exploitation', ordre: 90, deductible_fiscal: true },
  { id: 'cat-6800', code: '6800', nom: 'Frais bancaires & commissions d\'encaissement', description: 'Commissions TWINT, cartes bancaires, tenue de compte', groupe: 'charges_exploitation', ordre: 100, deductible_fiscal: true },
  { id: 'cat-6900', code: '6900', nom: 'Électricité, eau & blanchissage', description: 'Quote-part énergie, nettoyage des serviettes de soin', groupe: 'charges_exploitation', ordre: 110, deductible_fiscal: true },
  { id: 'cat-6990', code: '6990', nom: 'Autres charges d\'exploitation', description: 'Frais postaux, papeterie, entretien divers', groupe: 'charges_exploitation', ordre: 120, deductible_fiscal: true },
];

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('ordre', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_SWISS_CATEGORIES;
    }
    return data as ExpenseCategory[];
  } catch {
    return DEFAULT_SWISS_CATEGORIES;
  }
}

// ── Factures & Dépenses ─────────────────────────────────────────────────────

const STORAGE_EXPENSES_KEY = 'emmanuelle_finances_expenses_v1';

function getInitialCoskynExpense(): Expense {
  return {
    id: 'exp-coskyn-139079',
    fournisseur: COSKYN_FACTURE_139079.fournisseur,
    numero_facture: COSKYN_FACTURE_139079.numero_facture,
    date_facture: COSKYN_FACTURE_139079.date_facture,
    date_echeance: COSKYN_FACTURE_139079.date_echeance || '2026-09-29',
    date_paiement: null,
    montant_ht: COSKYN_FACTURE_139079.montant_ht,
    taux_tva: COSKYN_FACTURE_139079.taux_tva,
    montant_tva: COSKYN_FACTURE_139079.montant_tva,
    montant_ttc: COSKYN_FACTURE_139079.montant_ttc,
    category_id: 'cat-4200',
    statut: 'a_payer',
    mode_paiement: 'virement',
    notes: COSKYN_FACTURE_139079.notes || null,
    document_url: null,
    is_stock_invoice: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: COSKYN_FACTURE_139079.items.map(it => ({ ...it, expense_id: 'exp-coskyn-139079' })),
  };
}

function getLocalExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_EXPENSES_KEY);
    if (!raw) {
      const initial = [getInitialCoskynExpense()];
      localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(initial));
      return initial;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLocalExpenses(list: Expense[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Erreur sauvegarde localStorage dépenses:', e);
  }
}

export async function listExpenses(): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, category:expense_categories(*), items:expense_items(*)')
      .order('date_facture', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as Expense[];
    }
  } catch {
    // Fallback to local storage
  }

  // Utilisation du cache local
  const local = getLocalExpenses();
  const categories = await listExpenseCategories();
  return local.map(exp => ({
    ...exp,
    category: categories.find(c => c.id === exp.category_id || c.code === exp.category_id) || null,
  }));
}

export async function createExpense(
  expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>,
  items: ExpenseItem[] = []
): Promise<Expense> {
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `exp-${Date.now()}`;
  const now = new Date().toISOString();

  const newExpense: Expense = {
    ...expenseData,
    id: newId,
    created_at: now,
    updated_at: now,
    items: items.map(it => ({ ...it, expense_id: newId })),
  };

  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        id: newId,
        fournisseur: newExpense.fournisseur,
        numero_facture: newExpense.numero_facture,
        date_facture: newExpense.date_facture,
        date_echeance: newExpense.date_echeance,
        date_paiement: newExpense.date_paiement,
        montant_ht: newExpense.montant_ht,
        taux_tva: newExpense.taux_tva,
        montant_tva: newExpense.montant_tva,
        montant_ttc: newExpense.montant_ttc,
        category_id: newExpense.category_id,
        statut: newExpense.statut,
        mode_paiement: newExpense.mode_paiement,
        notes: newExpense.notes,
        document_url: newExpense.document_url,
        is_stock_invoice: newExpense.is_stock_invoice,
      })
      .select()
      .single();

    if (!error && data) {
      if (items.length > 0) {
        await supabase.from('expense_items').insert(
          items.map(it => ({
            expense_id: newId,
            designation: it.designation,
            reference: it.reference,
            quantite: it.quantite,
            prix_unitaire: it.prix_unitaire,
            taux_tva: it.taux_tva,
            rabais_pct: it.rabais_pct,
            total_ttc: it.total_ttc,
            usage_type: it.usage_type,
            product_id: it.product_id,
          }))
        );
      }
    }
  } catch (err) {
    console.warn('Supabase expense creation error, saving locally:', err);
  }

  // Save locally as reliable fallback
  const list = getLocalExpenses();
  saveLocalExpenses([newExpense, ...list]);

  return newExpense;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
  try {
    await supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  } catch {
    // continue
  }

  const list = getLocalExpenses();
  const next = list.map(e => e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e);
  saveLocalExpenses(next);
}

export async function deleteExpense(id: string): Promise<void> {
  try {
    await supabase.from('expenses').delete().eq('id', id);
  } catch {
    // continue
  }

  const list = getLocalExpenses();
  saveLocalExpenses(list.filter(e => e.id !== id));
}

// ── Entrée en stock automatique depuis une facture fournisseur (Coskyn) ─────

export interface StockImportSummary {
  updatedCount: number;
  createdCount: number;
  totalQuantityAdded: number;
  totalCostCHF: number;
}

export interface InvoiceItemStockMatch {
  item: ExpenseItem;
  existingProduct: Product | null;
  isExisting: boolean;
  stockActuel: number;
  quantiteBon: number;
  nouveauStock: number;
  prixAchatUnitaire: number;
  prixVenteSuggere: number;
}

export function matchInvoiceItemsWithStock(
  items: ExpenseItem[],
  existingProducts: Product[]
): InvoiceItemStockMatch[] {
  return items.map(it => {
    const itRefClean = (it.reference || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const itNomClean = (it.designation || '').trim().toLowerCase();

    const matched = existingProducts.find(p => {
      if (itRefClean && p.reference) {
        const pRefClean = p.reference.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pRefClean && pRefClean === itRefClean) return true;
      }
      return p.nom.trim().toLowerCase() === itNomClean;
    }) || null;

    const stockActuel = matched ? Number(matched.stock || 0) : 0;
    const quantiteBon = Number(it.quantite || 0);
    const nouveauStock = stockActuel + quantiteBon;
    const isFree = it.rabais_pct === 100;
    const prixAchat = isFree ? 0 : it.prix_unitaire;
    const usage = it.usage_type || 'vente';
    const prixVenteSuggere = usage === 'vente' ? Math.round(it.prix_unitaire * 2.1 * 10) / 10 : 0;

    return {
      item: it,
      existingProduct: matched,
      isExisting: !!matched,
      stockActuel,
      quantiteBon,
      nouveauStock,
      prixAchatUnitaire: prixAchat,
      prixVenteSuggere,
    };
  });
}

export async function applyInvoiceToStock(
  expenseId: string,
  items: ExpenseItem[]
): Promise<StockImportSummary> {
  const existingProducts = await listProducts(true);
  let updatedCount = 0;
  let createdCount = 0;
  let totalQuantityAdded = 0;
  let totalCostCHF = 0;

  for (const it of items) {
    if (it.quantite <= 0) continue;

    const itRefClean = (it.reference || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const itNomClean = (it.designation || '').trim().toLowerCase();

    // Cherche le produit par référence normalisée ou nom
    let prod = existingProducts.find(p => {
      if (itRefClean && p.reference) {
        const pRefClean = p.reference.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pRefClean && pRefClean === itRefClean) return true;
      }
      return p.nom.trim().toLowerCase() === itNomClean;
    });

    const isFree = it.rabais_pct === 100;
    const prixAchat = isFree ? 0 : it.prix_unitaire;
    const usage = it.usage_type || 'vente';

    if (prod) {
      // Produit existant : incrémente le stock existant avec la quantité du bon de commande
      const currentStock = Number(prod.stock || 0);
      const incomingQty = Number(it.quantite || 0);
      const targetStock = currentStock + incomingQty;

      try {
        await stockMovement({
          productId: prod.id,
          type: 'reception',
          quantite: incomingQty,
          prixAchatUnitaire: prixAchat,
          motif: `Bon de commande / Facture [${it.reference || prod.nom}] - Réception réassort (+${incomingQty})`,
        });
      } catch (err) {
        console.warn('stockMovement fallback to direct update:', err);
      }

      // Garantit l'ajustement exact du stock et du prix d'achat
      try {
        await updateProduct(prod.id, {
          stock: targetStock,
          prix_achat_chf: isFree ? prod.prix_achat_chf : prixAchat,
          usage_type: prod.usage_type || usage,
        });
      } catch (e) {
        console.warn('Update fallback failed:', e);
      }

      // Met à jour la référence locale en mémoire pour le reste de la boucle
      prod.stock = targetStock;
      updatedCount++;
    } else {
      // Nouvelle référence : création automatique avec la quantité initiale du bon
      const prixVenteSuggere = usage === 'vente' ? Math.round(prixAchat * 2.1 * 10) / 10 : 0;

      try {
        const contenanceMatch = it.designation.match(/(\d+\s*(?:ml|l|kg|g|rlx|rouleaux))/i);
        const autoContenance = it.contenance || (contenanceMatch ? contenanceMatch[1] : null);

          const created = await createProduct({
            nom: it.designation,
            marque: 'Phytomer',
            reference: it.reference || null,
            description: `Produit ${usage === 'cabine' ? 'professionnel cabine' : 'vente boutique'}`,
            prix_achat_chf: isFree ? 0 : prixAchat,
            prix_vente_chf: prixVenteSuggere,
            taux_tva_defaut: it.taux_tva,
            seuil_alerte: usage === 'cabine' ? 1 : 2,
            active: true,
            ordre: 99,
            usage_type: usage,
            contenance: autoContenance,
            stock: it.quantite,
          });

        // Entrée en stock initiale dans le journal
        if (created?.id) {
          try {
            await stockMovement({
              productId: created.id,
              type: 'reception',
              quantite: it.quantite,
              prixAchatUnitaire: isFree ? 0 : prixAchat,
              motif: `Facture réception création ${it.reference || ''}`,
            });
          } catch {
            // silent
          }
          existingProducts.push(created);
        }
        createdCount++;
      } catch (err) {
        console.warn('Erreur création automatique produit:', err);
      }
    }

    totalQuantityAdded += it.quantite;
    totalCostCHF += isFree ? 0 : it.quantite * prixAchat;
  }

  // Marquer la dépense comme entrée en stock
  await updateExpense(expenseId, { is_stock_invoice: true });

  return {
    updatedCount,
    createdCount,
    totalQuantityAdded,
    totalCostCHF: Math.round(totalCostCHF * 100) / 100,
  };
}

// ── Dotation matière des soins (Rentabilité Cabine) ─────────────────────────

const STORAGE_SUPPLIES_KEY = 'emmanuelle_finances_supplies_v1';

export async function listServiceSupplies(serviceId?: string): Promise<ServiceSupply[]> {
  try {
    let q = supabase.from('service_supplies').select('*, product:products(*)');
    if (serviceId) q = q.eq('service_id', serviceId);
    const { data, error } = await q;
    if (!error && data) return data as ServiceSupply[];
  } catch {
    // continue
  }

  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_SUPPLIES_KEY);
    const list: ServiceSupply[] = raw ? JSON.parse(raw) : [];
    return serviceId ? list.filter(s => s.service_id === serviceId) : list;
  } catch {
    return [];
  }
}

export async function saveServiceSupplies(
  serviceId: string,
  supplies: { productId: string; quantiteEstimee: number; notes?: string }[]
): Promise<void> {
  const newItems: ServiceSupply[] = supplies.map(s => ({
    id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    service_id: serviceId,
    product_id: s.productId,
    quantite_estimee: s.quantiteEstimee,
    notes: s.notes || null,
    created_at: new Date().toISOString(),
  }));

  try {
    await supabase.from('service_supplies').delete().eq('service_id', serviceId);
    if (supplies.length > 0) {
      await supabase.from('service_supplies').insert(
        supplies.map(s => ({
          service_id: serviceId,
          product_id: s.productId,
          quantite_estimee: s.quantiteEstimee,
          notes: s.notes || null,
        }))
      );
    }
  } catch {
    // continue
  }

  if (typeof window !== 'undefined') {
    const all = await listServiceSupplies();
    const filtered = all.filter(s => s.service_id !== serviceId);
    localStorage.setItem(STORAGE_SUPPLIES_KEY, JSON.stringify([...filtered, ...newItems]));
  }
}

// ── Tableau de Bord Financier & Déclaration Vaud ─────────────────────────────

export async function computeFinancialStats(
  annee = new Date().getFullYear()
): Promise<FinancialDashboardStats> {
  const debut = `${annee}-01-01`;
  const fin = `${annee}-12-31`;

  // 1. Chiffre d'affaires via transactions de caisse
  let caTotal = 0;
  let caPresta = 0;
  let caProd = 0;
  let nbTx = 0;
  let encaissementsReels = 0;

  try {
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, items:transaction_items(*)')
      .gte('created_at', `${debut}T00:00:00`)
      .lte('created_at', `${fin}T23:59:59`)
      .eq('statut', 'payee');

    if (txs && txs.length > 0) {
      nbTx = txs.length;
      for (const t of txs) {
        caTotal += Number(t.total_ttc || 0);
        encaissementsReels += Number(t.total_ttc || 0) - Number(t.montant_bon_utilise || 0);

        if (t.items && Array.isArray(t.items)) {
          for (const it of t.items) {
            if (it.product_id) {
              caProd += Number(it.total_ttc || 0);
            } else {
              caPresta += Number(it.total_ttc || 0);
            }
          }
        }
      }
    }
  } catch {
    // Si pas de transactions en base, garde 0
  }

  // 2. Dépenses & Achats
  const allExpenses = await listExpenses();
  const filteredExp = allExpenses.filter(e => e.date_facture >= debut && e.date_facture <= fin && e.statut !== 'annulee');

  let achatsMarchandises = 0;
  let achatsCabine = 0;
  let consommables = 0;
  let chargesExploitation = 0;
  let cotisationsAvsPayees = 0;
  let prelevementsExploitant = 0;
  let decaissementsReels = 0;
  const detailsCharges: Record<string, number> = {};

  for (const exp of filteredExp) {
    const montant = Number(exp.montant_ttc || exp.montant_ht || 0);
    const code = exp.category?.code || '';
    const groupe = exp.category?.groupe || '';

    if (exp.statut === 'payee') {
      decaissementsReels += montant;
    }

    if (exp.items && exp.items.length > 0) {
      const vent = getInvoiceVentilation(exp);
      achatsMarchandises += vent.partVenteTTC;
      achatsCabine += vent.partCabineTTC;
      consommables += vent.partConsommablesTTC;
    } else {
      if (code === '4000') {
        achatsMarchandises += montant;
      } else if (code === '4200') {
        achatsCabine += montant;
      } else if (code === '4400') {
        consommables += montant;
      } else if (code === '5000') {
        cotisationsAvsPayees += montant;
      } else if (code === '5100') {
        prelevementsExploitant += montant;
      } else if (groupe === 'charges_exploitation' || code.startsWith('6')) {
        chargesExploitation += montant;
        const nomCat = exp.category?.nom || 'Autres charges';
        detailsCharges[nomCat] = (detailsCharges[nomCat] || 0) + montant;
      }
    }
  }

  // 3. Calculs de marges et synthèse
  const coutMatiereTotal = achatsMarchandises + achatsCabine + consommables;
  const margeBruteTotale = caTotal - coutMatiereTotal;
  const margeBrutePct = caTotal > 0 ? (margeBruteTotale / caTotal) * 100 : 0;

  // Résultat d'exploitation avant AVS
  const resultatAvantAvs = margeBruteTotale - chargesExploitation;

  // Estimation AVS déductible
  const estimationAvs = computeAvsIndependant(resultatAvantAvs);

  // Bénéfice fiscal (après déduction des cotisations AVS réelles ou estimées)
  const avsDeductible = cotisationsAvsPayees > 0 ? cotisationsAvsPayees : estimationAvs.totalAnnuel;
  const beneficeNetFiscal = Math.max(0, resultatAvantAvs - avsDeductible);

  return {
    periode: { debut, fin },
    chiffreAffairesTotal: Math.round(caTotal * 100) / 100,
    caPrestations: Math.round(caPresta * 100) / 100,
    caProduitsVente: Math.round(caProd * 100) / 100,
    nombreFacturesCaisse: nbTx,
    achatsMarchandisesBoutique: Math.round(achatsMarchandises * 100) / 100,
    achatsCabineMatieres: Math.round(achatsCabine * 100) / 100,
    consommablesMatériel: Math.round(consommables * 100) / 100,
    variationStockEstimee: 0,
    coutMatiereTotal: Math.round(coutMatiereTotal * 100) / 100,
    margeBruteTotale: Math.round(margeBruteTotale * 100) / 100,
    margeBrutePct: Math.round(margeBrutePct * 10) / 10,
    chargesExploitationTotal: Math.round(chargesExploitation * 100) / 100,
    detailsCharges,
    resultatExploitationAvantAvs: Math.round(resultatAvantAvs * 100) / 100,
    estimationAvs,
    cotisationsAvsPayees: Math.round(cotisationsAvsPayees * 100) / 100,
    prelevementsExploitant: Math.round(prelevementsExploitant * 100) / 100,
    beneficeNetFiscal: Math.round(beneficeNetFiscal * 100) / 100,
    totalEncaissementsReels: Math.round(encaissementsReels * 100) / 100,
    totalDecaissementsReels: Math.round(decaissementsReels * 100) / 100,
    soldeTresoreriePeriode: Math.round((encaissementsReels - decaissementsReels) * 100) / 100,
  };
}
