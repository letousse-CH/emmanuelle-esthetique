/**
 * Service de gestion financière, dépenses, calcul de rentabilité cabine,
 * cotisations AVS et compte de résultat pour Emmanuelle Esthétique.
 */

import { supabase } from './supabase';
import {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpensePayment,
  ExpenseVersementMode,
  FinancialDashboardStats,
  PlanReclassement,
  ServiceSupply,
  ServiceSupplyCost,
  addMonthsISO,
  computeAvsIndependant,
  decaissementsPeriode,
  dettesFournisseursAu,
  situationPaiement,
  splitEcheances,
  DEFAULT_SWISS_CATEGORIES,
} from '../types/finance';
import { Product, Service, StockMovement, Transaction, TransactionItem, valeurStock, ventilerRecettes } from '../types/caisse';
import { listProducts, updateProduct } from './caisse';
import type { FactureAchatLue } from '../types/factureAchat';
import { zurichDate, zurichMidnightISO } from '../components/admin/mobile/home/zurich';

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
    if (usage === 'vente') {
      vHT += lineHT;
    } else if (usage === 'consommable') {
      aHT += lineHT;
    } else {
      // Cabine, testeurs, échantillons : rien de tout cela n'est revendu.
      cHT += lineHT;
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

// Plan comptable par défaut : défini dans types/finance (partagé avec le serveur).
export { DEFAULT_SWISS_CATEGORIES };

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

/** Saisies faites dans le navigateur avant que les dépenses n'aillent en base
 *  (2026-10-08). Lues seulement : aucune n'est plus jamais écrite ni inventée. */
function getLocalExpenses(): Expense[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_EXPENSES_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, category:expense_categories(*), items:expense_items(*)')
    .order('date_facture', { ascending: false });
  // Une base injoignable ne doit jamais afficher les anciennes saisies locales
  // comme si c'étaient les dépenses : on le dit.
  if (error) throw new Error(`Les dépenses n'ont pas pu être lues (${error.message}).`);
  if (data && data.length > 0) return data as Expense[];

  // Base vide : saisies locales d'avant 2026-10-08, pour qu'elles restent visibles.
  const local = getLocalExpenses();
  const categories = await listExpenseCategories();
  return local.map(exp => ({
    ...exp,
    category: categories.find(c => c.id === exp.category_id || c.code === exp.category_id) || null,
  }));
}

/**
 * Enregistre une dépense en base, ou échoue en le disant : une dépense gardée
 * dans le seul navigateur n'existerait ni pour le bilan, ni pour la fiduciaire.
 * Saisie « déjà payée », elle reçoit son versement (déclencheur en base).
 */
export async function createExpense(
  expenseData: Omit<Expense, 'id' | 'created_at' | 'updated_at'>,
  items: ExpenseItem[] = []
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      fournisseur: expenseData.fournisseur,
      numero_facture: expenseData.numero_facture,
      date_facture: expenseData.date_facture,
      date_echeance: expenseData.date_echeance,
      date_paiement: expenseData.date_paiement,
      montant_ht: expenseData.montant_ht,
      taux_tva: expenseData.taux_tva,
      montant_tva: expenseData.montant_tva,
      montant_ttc: expenseData.montant_ttc,
      category_id: expenseData.category_id,
      statut: expenseData.statut,
      mode_paiement: expenseData.mode_paiement,
      notes: expenseData.notes,
      document_url: expenseData.document_url,
      is_stock_invoice: expenseData.is_stock_invoice,
    })
    .select()
    .single();
  if (error) throw new Error(`La dépense n'a pas été enregistrée (${error.message}).`);

  const created = data as Expense;
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('expense_items').insert(
      items.map(it => ({
        expense_id: created.id,
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
    if (itemsError) {
      throw new Error(`La facture est enregistrée, mais pas le détail de ses articles (${itemsError.message}).`);
    }
  }
  return { ...created, items: items.map(it => ({ ...it, expense_id: created.id })) };
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
  // Les jointures de lecture ne sont pas des colonnes.
  const { category: _c, items: _i, ...colonnes } = updates;
  const { error } = await supabase
    .from('expenses')
    .update({ ...colonnes, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Refusé par la base dès qu'un versement a été enregistré : il faut alors annuler la facture. */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Versements & échéanciers des factures d'achat ──────────────────────────

/** Lit toutes les lignes d'une requête, par pages de 1000 (plafond de PostgREST). */
async function lireTout<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const taille = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += taille) {
    const { data, error } = await page(from, from + taille - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < taille) return out;
  }
}

export async function listExpensePayments(): Promise<ExpensePayment[]> {
  return lireTout<ExpensePayment>((from, to) => supabase
    .from('expense_payments')
    .select('*')
    .order('expense_id', { ascending: true })
    .order('rang', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to));
}

/**
 * Échelonne ce qui reste à payer en `n` échéances mensuelles à partir de
 * `premiere`. Le solde d'une facture déjà en partie payée ou planifiée est
 * seul réparti : Postgres refuse tout ce qui dépasserait le total.
 */
export async function planifierEcheances(
  expense: Pick<Expense, 'id' | 'statut' | 'montant_ttc' | 'date_paiement' | 'date_facture'>,
  payments: ExpensePayment[],
  n: number,
  premiere: string,
): Promise<void> {
  const sit = situationPaiement(expense, payments);
  const aRepartir = Math.round((sit.reste - sit.prevu) * 100) / 100;
  if (aRepartir <= 0) throw new Error('Il ne reste rien à échelonner sur cette facture.');
  const montants = splitEcheances(aRepartir, n);
  const rangMax = payments.filter(p => p.expense_id === expense.id).reduce((m, p) => Math.max(m, p.rang), 0);
  const { error } = await supabase.from('expense_payments').insert(
    montants.map((montant, i) => ({
      expense_id: expense.id,
      rang: rangMax + i + 1,
      date_prevue: addMonthsISO(premiere, i),
      montant,
    })),
  );
  if (error) throw new Error(error.message);
}

export interface VersementInput {
  date: string;
  mode: ExpenseVersementMode | null;
  reference?: string | null;
  justificatif_url?: string | null;
}

/** Versement hors échéancier (ou sans échéancier). */
export async function enregistrerVersement(
  expenseId: string,
  payments: ExpensePayment[],
  montant: number,
  v: VersementInput,
): Promise<void> {
  const rangMax = payments.filter(p => p.expense_id === expenseId).reduce((m, p) => Math.max(m, p.rang), 0);
  const { error } = await supabase.from('expense_payments').insert({
    expense_id: expenseId,
    rang: rangMax + 1,
    montant: Math.round(montant * 100) / 100,
    date_paiement: v.date,
    mode_paiement: v.mode,
    reference: v.reference?.trim() || null,
    justificatif_url: v.justificatif_url?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Une échéance prévue devient un versement, pour son montant éventuellement ajusté. */
export async function payerEcheance(id: string, montant: number, v: VersementInput): Promise<void> {
  const { error } = await supabase
    .from('expense_payments')
    .update({
      montant: Math.round(montant * 100) / 100,
      date_paiement: v.date,
      mode_paiement: v.mode,
      reference: v.reference?.trim() || null,
      justificatif_url: v.justificatif_url?.trim() || null,
    })
    .eq('id', id)
    .is('date_paiement', null);
  if (error) throw new Error(error.message);
}

/** Une échéance à venir n'est qu'un plan : elle se supprime. Un versement, non. */
export async function supprimerEcheance(id: string): Promise<void> {
  const { error } = await supabase.from('expense_payments').delete().eq('id', id).is('date_paiement', null);
  if (error) throw new Error(error.message);
}

/** Un versement erroné s'annule avec un motif ; la ligne reste visible. */
export async function annulerVersement(id: string, motif: string): Promise<void> {
  const { error } = await supabase
    .from('expense_payments')
    .update({ annule: true, motif_annulation: motif.trim() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Facture d'achat qui fait entrer du stock ───────────────────────────────

export interface ImportFactureResultat {
  expense_id: string;
  crees: number;
  mis_a_jour: number;
  unites: number;
}

/**
 * Importe une facture fournisseur relue : dépense, lignes, fiches produits et
 * réceptions en UNE transaction Postgres (`stock_importer_facture`). Tout ou
 * rien : une facture ne peut plus entrer à moitié en stock, ni deux fois.
 */
export async function importerFactureStock(
  facture: FactureAchatLue,
  opts: {
    categoryId: string;
    statut: 'a_payer' | 'payee';
    datePaiement?: string | null;
    modePaiement: Expense['mode_paiement'];
    notes?: string | null;
    justificatif?: { path: string; url: string | null } | null;
    ecartJustifie: boolean;
  },
): Promise<ImportFactureResultat> {
  const { data, error } = await supabase.rpc('stock_importer_facture', {
    p_facture: {
      fournisseur: facture.fournisseur,
      fournisseur_adresse: facture.fournisseur_adresse,
      fournisseur_ide: facture.fournisseur_ide,
      numero_facture: facture.numero_facture,
      date_facture: facture.date_facture,
      date_echeance: facture.date_echeance,
      montant_ht: facture.montant_ht,
      montant_tva: facture.montant_tva,
      montant_ttc: facture.montant_ttc,
      taux_tva: facture.taux_tva,
      category_id: opts.categoryId,
      statut: opts.statut,
      date_paiement: opts.datePaiement ?? null,
      mode_paiement: opts.modePaiement,
      notes: opts.notes ?? null,
      justificatif_path: opts.justificatif?.path ?? null,
      document_url: opts.justificatif?.url ?? null,
    },
    p_lignes: facture.lignes.map(l => ({
      designation: l.designation.trim(),
      reference: l.reference,
      quantite: l.quantite,
      prix_unitaire: l.prix_unitaire,
      rabais_pct: l.rabais_pct,
      taux_tva: l.taux_tva,
      usage_type: l.usage_type,
      contenance: l.contenance,
      marque: l.marque,
      product_id: l.product_id,
      prix_vente: l.product_id ? null : l.prix_vente,
    })),
    p_ecart_justifie: opts.ecartJustifie,
  });
  if (error) throw new Error(error.message);
  return data as ImportFactureResultat;
}

/** Factures d'achat (comptes 4xxx, non annulées) auxquelles rattacher une réception. */
export async function listFacturesAchat(): Promise<
  (Pick<Expense, 'id' | 'fournisseur' | 'numero_facture' | 'date_facture' | 'montant_ttc'> & { code: string })[]
> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, fournisseur, numero_facture, date_facture, montant_ttc, statut, category:expense_categories(code)')
    .neq('statut', 'annulee')
    .order('date_facture', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (Pick<Expense, 'id' | 'fournisseur' | 'numero_facture' | 'date_facture' | 'montant_ttc'> & { category: { code: string } | null })[])
    .filter(e => (e.category?.code ?? '').startsWith('4'))
    .map(({ category, ...e }) => ({ ...e, code: category?.code ?? '' }));
}

// ── Dotation matière des soins (Rentabilité Cabine) ─────────────────────────
//
// `quantite_estimee` d'une dotation = nombre de soins réalisés avec UN flacon
// (ou pot, carton) du produit : « ce litre de lait fait 40 soins ». Le coût
// matière d'un soin vaut donc coût d'achat du flacon ÷ ce rendement. Aucune
// valeur par défaut n'est inventée : un soin sans fiche n'a pas de coût affiché.

export async function listServiceSupplies(serviceId?: string): Promise<ServiceSupply[]> {
  let q = supabase.from('service_supplies').select('*, product:products(*)');
  if (serviceId) q = q.eq('service_id', serviceId);
  const { data, error } = await q;
  if (error) throw new Error(`Les fiches techniques n'ont pas pu être lues (${error.message}).`);
  return (data ?? []) as ServiceSupply[];
}

export async function saveServiceSupplies(
  serviceId: string,
  supplies: { productId: string; soinsParUnite: number; notes?: string }[]
): Promise<void> {
  const { error: delError } = await supabase.from('service_supplies').delete().eq('service_id', serviceId);
  if (delError) throw new Error(delError.message);
  if (supplies.length === 0) return;
  const { error } = await supabase.from('service_supplies').insert(
    supplies.map(s => ({
      service_id: serviceId,
      product_id: s.productId,
      quantite_estimee: Math.round(s.soinsParUnite * 100) / 100,
      notes: s.notes || null,
    }))
  );
  if (error) throw new Error(`La fiche technique a été vidée mais pas réenregistrée (${error.message}) : ressaisissez-la.`);
}

// ── Classement vente / cabine repris des factures d'achat ──────────────────

export async function listLignesFactures(): Promise<(Pick<ExpenseItem, 'reference' | 'usage_type' | 'product_id'> & { id: string })[]> {
  const { data, error } = await supabase
    .from('expense_items')
    .select('id, reference, usage_type, product_id')
    .not('reference', 'is', null);
  if (error) throw new Error(error.message);
  return (data ?? []) as (Pick<ExpenseItem, 'reference' | 'usage_type' | 'product_id'> & { id: string })[];
}

/** Applique le classement de la facture aux fiches (usage, contenance) et relie les lignes. */
export async function appliquerReclassement(plan: PlanReclassement): Promise<number> {
  for (const p of plan.produits) {
    await updateProduct(p.id, {
      usage_type: p.vers,
      ...(p.contenance ? { contenance: p.contenance } : {}),
    });
  }
  for (const l of plan.liens) {
    const { error } = await supabase.from('expense_items').update({ product_id: l.productId }).eq('id', l.itemId);
    if (error) throw new Error(error.message);
  }
  return plan.produits.length;
}

// ── Tableau de Bord Financier & Déclaration Vaud ─────────────────────────────

export async function computeFinancialStats(
  annee = new Date().getFullYear()
): Promise<FinancialDashboardStats> {
  const debut = `${annee}-01-01`;
  const fin = `${annee}-12-31`;
  const debutISO = zurichMidnightISO(debut);
  const finISO = zurichMidnightISO(`${annee + 1}-01-01`);
  const aujourdhui = zurichDate();
  // Exercice en cours : la « situation au 31.12 » est celle d'aujourd'hui.
  const enCours = aujourdhui <= fin;
  const arrete = enCours ? aujourdhui : fin;

  // 1. Chiffre d'affaires : recettes de caisse de l'exercice, bornées en heure
  //    de Zurich (une vente du 31 décembre à 23 h 30 appartient à cet exercice).
  //    Même règle que le journal : recette = total_ttc − montant_bon, la part
  //    réglée par bon ayant été encaissée le jour de la vente du bon
  //    (ventilation par nature : `ventilerRecettes`).
  type TxLigne = Pick<Transaction, 'status' | 'total_ttc' | 'montant_bon'> & {
    transaction_items: Pick<TransactionItem, 'total_ttc' | 'product_id' | 'gift_card_id'>[];
  };
  const [txs, allExpenses, payments, products, movements, tvaSetting] = await Promise.all([
    lireTout<TxLigne>((from, to) => supabase
      .from('transactions')
      .select('status, total_ttc, montant_bon, transaction_items(total_ttc, product_id, gift_card_id)')
      .eq('status', 'payee')
      .gte('created_at', debutISO)
      .lt('created_at', finISO)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)),
    listExpenses(),
    listExpensePayments(),
    listProducts(true),
    lireTout<Pick<StockMovement, 'product_id' | 'quantite' | 'type' | 'prix_achat_unitaire' | 'created_at'>>((from, to) => supabase
      .from('stock_movements')
      .select('product_id, quantite, type, prix_achat_unitaire, created_at')
      .lt('created_at', finISO)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)),
    supabase.from('settings').select('value').eq('key', 'caisse_tva_assujetti').maybeSingle(),
  ]).catch(err => {
    throw new Error(`Les données du bilan n'ont pas pu être lues (${err instanceof Error ? err.message : err}).`);
  });

  const ventilation = ventilerRecettes(txs);
  const caTotal = ventilation.total;
  const caPresta = ventilation.prestations;
  const caProd = ventilation.produits;
  const caBons = ventilation.bons;
  const nbTx = txs.length;
  const encaissementsReels = caTotal;

  // 2. Dépenses & Achats : la charge appartient à l'exercice de la facture,
  //    quelle que soit la façon dont elle est payée.
  const filteredExp = allExpenses.filter(e => e.date_facture >= debut && e.date_facture <= fin && e.statut !== 'annulee');

  let achatsMarchandises = 0;
  let achatsCabine = 0;
  let consommables = 0;
  let chargesExploitation = 0;
  let cotisationsAvsPayees = 0;
  let prelevementsExploitant = 0;
  const detailsCharges: Record<string, number> = {};

  for (const exp of filteredExp) {
    const montant = Number(exp.montant_ttc || exp.montant_ht || 0);
    const code = exp.category?.code || '';
    const groupe = exp.category?.groupe || '';

    // Ventilation par article réservée aux achats de matières (comptes 4xxx) :
    // une charge détaillée article par article reste une charge.
    if (exp.items && exp.items.length > 0 && (!code || code.startsWith('4'))) {
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

  // 3. Trésorerie : les versements, à leur date — une facture de décembre
  //    payée en trois fois sort de la caisse en décembre, janvier et février.
  const decaissementsReels = decaissementsPeriode(allExpenses, payments, debut, fin);

  // 4. Situation au 31.12 : ce qui reste dû aux fournisseurs…
  const dettes = dettesFournisseursAu(allExpenses, payments, arrete);

  // …et le stock, au coût d'acquisition (TVA comprise tant qu'elle n'est pas
  // récupérable). La marchandise encore en rayon n'est pas une charge de
  // l'exercice : la variation de stock corrige les achats (CO art. 960a, 960c).
  const tvaNonRecuperable = (tvaSetting.data?.value ?? '').trim().toLowerCase() !== 'true';
  const stockDebut = valeurStock(products, movements, debutISO, tvaNonRecuperable);
  const stockFin = valeurStock(products, movements, enCours ? null : finISO, tvaNonRecuperable);
  const variationStock = Math.round((stockFin.total - stockDebut.total) * 100) / 100;

  // 5. Calculs de marges et synthèse
  const achatsTotal = achatsMarchandises + achatsCabine + consommables;
  const coutMatiereTotal = achatsTotal - variationStock;
  const margeBruteTotale = caTotal - coutMatiereTotal;
  const margeBrutePct = caTotal > 0 ? (margeBruteTotale / caTotal) * 100 : 0;

  // Résultat d'exploitation avant AVS
  const resultatAvantAvs = margeBruteTotale - chargesExploitation;

  // Estimation AVS déductible
  const estimationAvs = computeAvsIndependant(resultatAvantAvs);

  // Bénéfice fiscal (après déduction des cotisations AVS réelles ou estimées)
  const avsDeductible = cotisationsAvsPayees > 0 ? cotisationsAvsPayees : estimationAvs.totalAnnuel;
  const beneficeNetFiscal = Math.max(0, resultatAvantAvs - avsDeductible);

  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    periode: { debut, fin },
    chiffreAffairesTotal: r(caTotal),
    caPrestations: caPresta,
    caProduitsVente: caProd,
    caBonsCadeaux: caBons,
    nombreFacturesCaisse: nbTx,
    achatsMarchandisesBoutique: r(achatsMarchandises),
    achatsCabineMatieres: r(achatsCabine),
    consommablesMatériel: r(consommables),
    stockDebut: { marchandises: stockDebut.marchandises, matieres: stockDebut.matieres, total: stockDebut.total },
    stockFin: { marchandises: stockFin.marchandises, matieres: stockFin.matieres, total: stockFin.total },
    stockFinAujourdhui: enCours,
    stockNegatifs: stockFin.negatifs,
    variationStockEstimee: variationStock,
    achatsTotal: r(achatsTotal),
    coutMatiereTotal: r(coutMatiereTotal),
    margeBruteTotale: r(margeBruteTotale),
    margeBrutePct: Math.round(margeBrutePct * 10) / 10,
    chargesExploitationTotal: r(chargesExploitation),
    detailsCharges,
    resultatExploitationAvantAvs: r(resultatAvantAvs),
    estimationAvs,
    cotisationsAvsPayees: r(cotisationsAvsPayees),
    prelevementsExploitant: r(prelevementsExploitant),
    beneficeNetFiscal: r(beneficeNetFiscal),
    totalEncaissementsReels: r(encaissementsReels),
    totalDecaissementsReels: decaissementsReels,
    soldeTresoreriePeriode: r(encaissementsReels - decaissementsReels),
    dettesFournisseurs: dettes.total,
    dettesDetail: dettes.detail.map(d => ({
      fournisseur: d.expense.fournisseur,
      numero: d.expense.numero_facture,
      date_facture: d.expense.date_facture,
      reste: d.reste,
    })),
  };
}
