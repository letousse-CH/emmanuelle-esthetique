/**
 * Tests des règles de la caisse, des dépenses et du bilan (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-caisse.ts
 */
import assert from 'node:assert/strict';
import {
  cartTotals,
  contenanceDepuisNom,
  coutAchat,
  isGiftCardUsable,
  isVenteProduct,
  ligneMarge,
  recetteEncaissee,
  remisePatch,
  valeurStock,
  ventilerRecettes,
  type GiftCard,
} from '../src/types/caisse';
import {
  AVS_BORNE_HAUTE, addMonthsISO, computeAvsIndependant, decaissementsPeriode, dettesFournisseursAu,
  planReclassement, situationPaiement, splitEcheances, type Expense, type ExpensePayment,
} from '../src/types/finance';
import { buildExpensesCsv } from '../src/utils/expensesExport';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
  }
}

const item = (total_ttc: number, nature: 'soin' | 'produit' | 'bon' = 'soin') => ({
  total_ttc,
  product_id: nature === 'produit' ? 'p' : null,
  gift_card_id: nature === 'bon' ? 'g' : null,
});

test('recette : total − part réglée par bon, 0 si annulée', () => {
  assert.equal(recetteEncaissee({ status: 'payee', total_ttc: 200, montant_bon: 0 }), 200);
  assert.equal(recetteEncaissee({ status: 'payee', total_ttc: 200, montant_bon: 150 }), 50);
  assert.equal(recetteEncaissee({ status: 'payee', total_ttc: 150, montant_bon: 150 }), 0);
  assert.equal(recetteEncaissee({ status: 'annulee', total_ttc: 200, montant_bon: 0 }), 0);
});

test('cycle d’un bon : vendu 200, utilisé 150 puis 50 + 50 TWINT → CA 250, jamais 450', () => {
  const v = ventilerRecettes([
    { status: 'payee', total_ttc: 200, montant_bon: 0, transaction_items: [item(200, 'bon')] },
    { status: 'payee', total_ttc: 150, montant_bon: 150, transaction_items: [item(150)] },
    { status: 'payee', total_ttc: 100, montant_bon: 50, transaction_items: [item(100)] },
  ]);
  assert.deepEqual(v, { total: 250, prestations: 50, produits: 0, bons: 200 });
});

test('ventilation des factures réelles d’octobre 2026 : CHF 713.50', () => {
  const v = ventilerRecettes([
    { status: 'payee', total_ttc: 100, montant_bon: 0, transaction_items: [item(100)] },
    { status: 'payee', total_ttc: 294.5, montant_bon: 0,
      transaction_items: [item(90, 'produit'), item(78, 'produit'), item(44, 'produit'), item(82.5)] },
    { status: 'payee', total_ttc: 319, montant_bon: 0,
      transaction_items: [item(165), item(78, 'produit'), item(76, 'produit'), item(0, 'produit')] },
  ]);
  assert.deepEqual(v, { total: 713.5, prestations: 347.5, produits: 366, bons: 0 });
});

test('ventilation : bon partiel réparti au prorata, total exact au centime', () => {
  const v = ventilerRecettes([
    { status: 'payee', total_ttc: 100, montant_bon: 33.33, transaction_items: [item(60), item(40, 'produit')] },
    { status: 'annulee', total_ttc: 500, montant_bon: 0, transaction_items: [item(500)] },
  ]);
  assert.equal(v.total, 66.67);
  assert.equal(v.produits, 26.67);
  assert.equal(Math.round((v.prestations + v.produits + v.bons) * 100) / 100, v.total);
});

test('totaux du panier : non assujettie → TVA nulle', () => {
  assert.deepEqual(cartTotals([{ prix_unitaire_ttc: 90, quantite: 1, taux_tva: 0 }]), { ttc: 90, ht: 90, tva: 0 });
  assert.deepEqual(cartTotals([{ prix_unitaire_ttc: 108.1, quantite: 1, taux_tva: 8.1 }]), { ttc: 108.1, ht: 100, tva: 8.1 });
});

test('remise : 50 % puis retour au prix de base', () => {
  const r = remisePatch({ prix_unitaire_ttc: 165 }, 50);
  assert.equal(r.prix_unitaire_ttc, 82.5);
  assert.equal(remisePatch({ prix_unitaire_ttc: 82.5, prix_base: 165 }, 0).prix_unitaire_ttc, 165);
});

test('marge d’une ligne : sur le coût figé, null hors marchandise', () => {
  assert.equal(ligneMarge({ product_id: 'p', prix_achat_unitaire: 50.2, total_ttc: 90, taux_tva: 0, quantite: 1 }), 39.8);
  assert.equal(ligneMarge({ product_id: null, prix_achat_unitaire: null, total_ttc: 165, taux_tva: 0, quantite: 1 }), null);
});

test('bon utilisable : actif, solde positif, non échu', () => {
  const base: GiftCard = {
    id: 'g', annee: 2026, number_seq: 1, code: 'BON-2026-0001', libelle: 'Bon cadeau',
    montant_initial: 200, montant_restant: 50, beneficiaire: null, acheteur_client_id: null,
    acheteur_label: 'Client de passage', sale_transaction_id: 't', emis_le: '2026-10-15T08:00:00Z',
    expire_le: '2031-10-15', status: 'active', created_at: '', updated_at: '',
  };
  assert.equal(isGiftCardUsable(base), true);
  assert.equal(isGiftCardUsable({ ...base, montant_restant: 0, status: 'epuise' }), false);
  assert.equal(isGiftCardUsable({ ...base, status: 'annule' }), false);
  assert.equal(isGiftCardUsable({ ...base, expire_le: '2020-01-01' }), false);
});

test('AVS 2026 : minimum 530, barème jusqu’à 60’500, puis 10 %', () => {
  assert.equal(AVS_BORNE_HAUTE, 60500);
  assert.equal(computeAvsIndependant(5000).cotisationAnnuelle, 530);
  assert.equal(computeAvsIndependant(59000).tauxPct < 10, true, 'encore dans le barème dégressif à 59’000');
  assert.equal(computeAvsIndependant(60500).tauxPct, 10);
  assert.equal(computeAvsIndependant(0).totalAnnuel, 0);
});

// ── Factures d'achat payées en plusieurs fois ──────────────────────────────

const facture = (o: Partial<Expense> = {}): Expense => ({
  id: 'coskyn', fournisseur: 'COSKYN SA', numero_facture: '139079', date_facture: '2026-12-10',
  date_echeance: null, date_paiement: null, montant_ht: 2163.5, taux_tva: 8.1, montant_tva: 175.25,
  montant_ttc: 2338.75, category_id: 'c4200', statut: 'a_payer', mode_paiement: 'echelonne', notes: null,
  document_url: null, is_stock_invoice: true, created_at: '', updated_at: '',
  category: { id: 'c4200', code: '4200', nom: 'Achats produits cabine', groupe: 'marchandises_matieres', ordre: 1, actif: true } as unknown as Expense['category'],
  ...o,
});
const versement = (o: Partial<ExpensePayment>): ExpensePayment => ({
  id: Math.random().toString(36), expense_id: 'coskyn', rang: 1, date_prevue: null, montant: 0, date_paiement: null,
  mode_paiement: 'virement', reference: null, justificatif_url: null, annule: false, annule_le: null,
  motif_annulation: null, created_at: '', updated_at: '', ...o,
});

test('échéancier : 3 fois au centime, l’arrondi sur la dernière', () => {
  assert.deepEqual(splitEcheances(2338.75, 3), [779.58, 779.58, 779.59]);
  assert.deepEqual(splitEcheances(100, 3), [33.33, 33.33, 33.34]);
  assert.equal(splitEcheances(2338.75, 3).reduce((a, b) => a + b, 0).toFixed(2), '2338.75');
});

test('échéances mensuelles : fin de mois respectée, passage d’année', () => {
  assert.equal(addMonthsISO('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsISO('2026-12-10', 1), '2027-01-10');
  assert.equal(addMonthsISO('2026-11-30', 3), '2027-02-28');
});

// Facture du 10.12.2026, payée en 3 fois : décembre, janvier, février.
const plan = [
  versement({ rang: 1, date_prevue: '2026-12-10', date_paiement: '2026-12-10', montant: 779.58 }),
  versement({ rang: 2, date_prevue: '2027-01-10', date_paiement: '2027-01-11', montant: 779.58 }),
  versement({ rang: 3, date_prevue: '2027-02-10', montant: 779.59 }),
];

test('situation : 2 versements sur 3, reste et prochaine échéance', () => {
  const s = situationPaiement(facture(), plan);
  assert.equal(s.etat, 'partielle');
  assert.equal(s.paye, 1559.16);
  assert.equal(s.reste, 779.59);
  assert.equal(s.prevu, 779.59);
  assert.equal(`${s.nbPayes}/${s.nbEcheances}`, '2/3');
  assert.equal(s.prochaine?.date_prevue, '2027-02-10');
});

test('situation au 31.12 : seul le versement de décembre compte', () => {
  const s = situationPaiement(facture(), plan, '2026-12-31');
  assert.equal(s.paye, 779.58);
  assert.equal(s.reste, 1559.17);
});

test('trésorerie : chaque versement dans l’exercice de SA date', () => {
  assert.equal(decaissementsPeriode([facture()], plan, '2026-01-01', '2026-12-31'), 779.58);
  assert.equal(decaissementsPeriode([facture()], plan, '2027-01-01', '2027-12-31'), 779.58);
});

test('versement annulé : ne compte ni en trésorerie ni comme payé', () => {
  const avecAnnule = [...plan, versement({ rang: 4, date_paiement: '2026-12-20', montant: 50, annule: true, motif_annulation: 'Doublon' })];
  assert.equal(decaissementsPeriode([facture()], avecAnnule, '2026-01-01', '2026-12-31'), 779.58);
  assert.equal(situationPaiement(facture(), avecAnnule, '2026-12-31').paye, 779.58);
});

test('dettes fournisseurs au 31.12 : le solde non versé, factures annulées exclues', () => {
  const d = dettesFournisseursAu([facture(), facture({ id: 'annulee', statut: 'annulee' })], plan, '2026-12-31');
  assert.equal(d.total, 1559.17);
  assert.equal(d.detail.length, 1);
  assert.equal(dettesFournisseursAu([facture()], plan, '2026-12-09').total, 0, 'facture pas encore reçue');
});

test('dépense « payée » sans ligne de versement (saisie locale) : payée à sa date', () => {
  const ticket = facture({ id: 't', statut: 'payee', date_paiement: '2026-10-02', montant_ttc: 72 });
  assert.equal(situationPaiement(ticket, []).etat, 'payee');
  assert.equal(decaissementsPeriode([ticket], [], '2026-01-01', '2026-12-31'), 72);
});

test('export fiduciaire : payé et reste dû au 31.12, versements datés, colonnes alignées', () => {
  const csv = buildExpensesCsv([facture()], 2026, plan);
  const lines = csv.split('\r\n');
  const width = lines[0].split('";"').length;
  assert.ok(lines.every((l) => l === '""' || l === '' || l.split('";"').length === width), 'largeur constante');
  assert.match(lines[1], /"779\.58";"1559\.17";"10\.12\.2026 : 779\.58 \(Virement\)"$/);
  assert.match(lines[1], /Payée en partie \(2\/3\)/);
  assert.ok(lines.some((l) => l.startsWith('"Dettes fournisseurs au 31.12.2026"') && l.includes('"1559.17"')));
});

// ── Stock au 31.12 ──────────────────────────────────────────────────────────

const produit = (id: string, o: Record<string, unknown> = {}) => ({
  id, nom: id, reference: '100100', usage_type: 'vente' as const, prix_achat_chf: 50, taux_tva_defaut: 8.1, ...o,
});
const mvt = (product_id: string, quantite: number, created_at: string, type: 'reception' | 'vente' = 'vente', prix: number | null = null) =>
  ({ product_id, quantite, created_at, type, prix_achat_unitaire: prix });

test('stock : quantité reconstituée à la date, coût de la dernière réception', () => {
  const produits = [produit('serum'), produit('lotion-cabine', { usage_type: 'cabine', nom: 'Lotion cabine 1 l' })];
  const journal = [
    mvt('serum', 4, '2026-09-27T10:00:00Z', 'reception', 50.2),
    mvt('serum', -1, '2026-10-08T16:00:00Z'),
    mvt('lotion-cabine', 2, '2026-09-27T10:00:00Z', 'reception', 40),
    mvt('serum', -1, '2027-01-05T10:00:00Z'),
  ];
  const fin2026 = valeurStock(produits, journal, '2026-12-31T23:00:00.000Z', false);
  assert.equal(fin2026.marchandises, 150.6, '3 × 50.20');
  assert.equal(fin2026.matieres, 80);
  const avecTva = valeurStock(produits, journal, '2026-12-31T23:00:00.000Z', true);
  assert.equal(avecTva.total, Math.round((150.6 + 80) * 1.081 * 100) / 100, 'TVA non récupérable incluse');
  assert.equal(valeurStock(produits, journal, '2026-01-01T00:00:00Z', false).total, 0, 'rien au 1er janvier');
});

test('stock négatif : compté pour zéro et signalé', () => {
  const v = valeurStock([produit('x')], [mvt('x', -2, '2026-10-01T10:00:00Z')], null, false);
  assert.equal(v.total, 0);
  assert.deepEqual(v.negatifs, ['x']);
});

// ── Classement vente / cabine et coût réel ─────────────────────────────────

test('vente ou cabine : l’usage de la fiche décide, pas le nom', () => {
  assert.equal(isVenteProduct({ usage_type: 'vente' }), true);
  assert.equal(isVenteProduct({ usage_type: 'cabine' }), false);
  assert.equal(isVenteProduct({ usage_type: 'testeur' }), false);
  assert.equal(isVenteProduct({ usage_type: undefined }), true, 'fiche sans usage : vente par défaut');
});

test('coût d’achat : TVA non récupérable ajoutée tant que l’activité n’est pas assujettie', () => {
  assert.equal(coutAchat({ prix_achat_chf: 50.2, taux_tva_defaut: 8.1 }, false).toFixed(2), '54.27');
  assert.equal(coutAchat({ prix_achat_chf: 50.2, taux_tva_defaut: 8.1 }, true), 50.2);
  assert.equal(coutAchat({ prix_achat_chf: 0, taux_tva_defaut: 8.1 }, false), 0, 'testeur offert');
});

test('marge réalisée : coût figé + TVA d’achat non récupérable', () => {
  const ligne = { product_id: 'p', prix_achat_unitaire: 50.2, total_ttc: 90, taux_tva: 0, quantite: 1 };
  assert.equal(ligneMarge(ligne, 8.1), 35.73);
  assert.equal(ligneMarge(ligne), 39.8, 'assujettie : coût HT');
});

test('contenance lue à la fin du nom', () => {
  assert.equal(contenanceDepuisNom('Perfect Visage - Lait Démaquillant Douceur - 1 l'), '1 l');
  assert.equal(contenanceDepuisNom('Papier Parathermique - Petit - 0.40 x 200 m'), '0.40 x 200 m');
  assert.equal(contenanceDepuisNom('Drap de Lit Bleu Cabine'), null);
});

test('reclassement : la facture corrige les fiches restées « vente », relie ses lignes', () => {
  const produits = [
    { id: 'lait', nom: 'Lait Démaquillant - 1 l', reference: '110100', usage_type: 'vente' as const, contenance: null },
    { id: 'serum', nom: 'Oligoforce - Sérum - 30 ml', reference: '100330', usage_type: 'vente' as const, contenance: '30 ml' },
    { id: 'testeur', nom: 'Testeur : Hydralgue - 30 ml', reference: '120259', usage_type: 'testeur' as const, contenance: '30 ml' },
  ];
  const lignes = [
    { id: 'l1', reference: '110100', usage_type: 'cabine' as const, product_id: null },
    { id: 'l2', reference: '100330', usage_type: 'vente' as const, product_id: null },
    { id: 'l3', reference: 'PHY-120.259', usage_type: 'testeur' as const, product_id: 'testeur' },
    { id: 'l4', reference: '999999', usage_type: 'cabine' as const, product_id: null },
  ];
  const plan = planReclassement(produits, lignes);
  assert.deepEqual(plan.produits, [{ id: 'lait', nom: 'Lait Démaquillant - 1 l', de: 'vente', vers: 'cabine', contenance: '1 l' }]);
  assert.deepEqual(plan.liens, [{ itemId: 'l1', productId: 'lait' }, { itemId: 'l2', productId: 'serum' }]);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
