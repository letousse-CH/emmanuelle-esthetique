/**
 * Tests des règles de la caisse, des dépenses et du bilan (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-caisse.ts
 */
import assert from 'node:assert/strict';
import {
  CLIENT_DE_PASSAGE,
  appliquerSeance,
  cartTotals,
  clienteAIndiquer,
  compositionResume,
  contenanceDepuisNom,
  coutAchat,
  isGiftCardUsable,
  isSubscriptionUsable,
  isVenteProduct,
  ligneMarge,
  listeDePrix,
  recetteEncaissee,
  remisePatch,
  seanceKey,
  seanceLabel,
  seancesAuTicket,
  subscriptionEncours,
  subscriptionStatusLabel,
  valeurStock,
  ventilerRecettes,
  type CartLine,
  type GiftCard,
  type Product,
  type Subscription,
} from '../src/types/caisse';
import {
  AVS_BORNE_HAUTE, addMonthsISO, computeAvsIndependant, decaissementsPeriode, dettesFournisseursAu,
  planReclassement, situationPaiement, splitEcheances, type Expense, type ExpensePayment,
} from '../src/types/finance';
import { buildExpensesCsv } from '../src/utils/expensesExport';
import {
  controlerFactureAchat, normalizeFactureAchat, totalLigneHT, trouverFiche, type FactureAchatLue,
} from '../src/types/factureAchat';

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

test('cliente indiquée après coup : seulement sur une facture payée « Client de passage »', () => {
  const passage = { status: 'payee' as const, client_id: null, client_label: CLIENT_DE_PASSAGE, client_indiquee_le: null };
  assert.equal(clienteAIndiquer(passage), true);
  assert.equal(clienteAIndiquer({ ...passage, client_indiquee_le: undefined }), true, 'avant la migration');
  assert.equal(clienteAIndiquer({ ...passage, status: 'annulee' }), false);
  assert.equal(clienteAIndiquer({ ...passage, client_id: 'c1', client_label: 'Mary Pousaz' }), false, 'émise au nom d’une cliente');
  assert.equal(clienteAIndiquer({ ...passage, client_id: null, client_label: 'Mary Pousaz' }), false, 'fiche supprimée : le nom figé reste');
  assert.equal(clienteAIndiquer({ ...passage, client_id: 'c1', client_label: 'Noémie K.', client_indiquee_le: '2026-10-18T10:00:00Z' }), true, 'rectifier un mauvais choix');
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

// ── Abonnements ─────────────────────────────────────────────────────────────

const abonnement = (o: Partial<Subscription> = {}): Subscription => ({
  id: 's', annee: 2026, number_seq: 1, code: 'ABO-2026-0001', service_id: 'f', libelle: 'Abonnement 10 massages',
  client_id: 'c1', client_label: 'Mary Pousaz', prix_paye: 1320, sale_transaction_id: 't',
  emis_le: '2026-10-22T08:00:00Z', expire_initiale: '2027-10-22', expire_le: '2027-10-22', prolonge_le: null,
  status: 'active', created_at: '', updated_at: '',
  subscription_credits: [
    { id: 'k1', subscription_id: 's', service_id: 'massage', libelle: 'Massage 60 min', seances: 11, offertes: 1, restantes: 7, ordre: 0 },
    { id: 'k2', subscription_id: 's', service_id: 'visage', libelle: 'Soin visage', seances: 1, offertes: 1, restantes: 1, ordre: 1 },
  ],
  ...o,
});
const le22oct = new Date('2026-10-22T12:00:00');

test('abonnement : CA à la vente seulement, les séances à CHF 0 n’ajoutent rien', () => {
  const v = ventilerRecettes([
    { status: 'payee', total_ttc: 1320, montant_bon: 0, transaction_items: [item(1320)] },
    { status: 'payee', total_ttc: 0, montant_bon: 0, transaction_items: [item(0)] },
    { status: 'payee', total_ttc: 45, montant_bon: 0, transaction_items: [item(0), item(45, 'produit')] },
  ]);
  assert.deepEqual(v, { total: 1365, prestations: 1320, produits: 45, bons: 0 });
});

test('abonnement : composition lisible, séances offertes comprises', () => {
  assert.equal(
    compositionResume([
      { libelle: 'Massage 60 min', seances: 11, offertes: 1 },
      { libelle: 'Soin visage', seances: 1, offertes: 1 },
    ]),
    'Massage 60 min : 10 séances + 1 offerte · Soin visage : 1 séance offerte',
  );
  assert.equal(compositionResume([{ libelle: 'Drainage', seances: 6 }]), 'Drainage : 6 séances');
});

test('abonnement : utilisable, échu, terminé, annulé', () => {
  assert.equal(isSubscriptionUsable(abonnement(), le22oct), true);
  assert.equal(subscriptionStatusLabel(abonnement(), le22oct), 'En cours');
  const echu = abonnement({ expire_le: '2026-10-21' });
  assert.equal(isSubscriptionUsable(echu, le22oct), false);
  assert.equal(subscriptionStatusLabel(echu, le22oct), 'Échu');
  assert.equal(isSubscriptionUsable(abonnement({ expire_le: '2026-10-22' }), le22oct), true, 'valable le jour même');
  const vide = abonnement({ status: 'epuise', subscription_credits: abonnement().subscription_credits.map(c => ({ ...c, restantes: 0 })) });
  assert.equal(subscriptionStatusLabel(vide, le22oct), 'Terminé');
  assert.equal(isSubscriptionUsable(abonnement({ status: 'annule' }), le22oct), false);
});

test('abonnement : séances dues = prix × restantes ÷ total (offertes comprises)', () => {
  // 1320 × 8 / 12 = 880
  assert.equal(subscriptionEncours(abonnement(), le22oct), 880);
  assert.equal(subscriptionEncours(abonnement({ expire_le: '2026-01-01' }), le22oct), 0);
  assert.equal(subscriptionEncours(abonnement({ status: 'annule' }), le22oct), 0);
});

test('séance : remplace le soin déjà au ticket, une seule unité, libellé numéroté', () => {
  const credit = abonnement().subscription_credits[0];
  const draft = { credit_id: credit.id, code: 'ABO-2026-0001' };
  const massage: CartLine = { key: 'a', service_id: 'massage', description: 'Massage 60 min', prix_unitaire_ttc: 145, quantite: 2, taux_tva: 0 };
  const huile: CartLine = { key: 'b', service_id: null, product_id: 'p', description: 'Huile', prix_unitaire_ttc: 45, quantite: 1, taux_tva: 0 };
  const key = seanceKey(draft, credit.service_id);

  const desc = seanceLabel(credit, seancesAuTicket([massage, huile], key), draft.code);
  assert.equal(desc, 'Massage 60 min — séance 5/11 (abonnement ABO-2026-0001)');

  const once = appliquerSeance([massage, huile], { service_id: 'massage', description: desc, draft }, 's1');
  assert.deepEqual(once.map(l => [l.key, l.quantite, l.prix_unitaire_ttc]), [['a', 1, 145], ['s1', 1, 0], ['b', 1, 45]]);
  assert.equal(seancesAuTicket(once, key), 1);
  assert.equal(seanceLabel(credit, seancesAuTicket(once, key), draft.code), 'Massage 60 min — séance 6/11 (abonnement ABO-2026-0001)');

  const twice = appliquerSeance(once, { service_id: 'massage', description: 'x', draft }, 's2');
  assert.deepEqual(twice.map(l => l.key), ['s2', 's1', 'b'], 'la ligne au prix normal a disparu');
  assert.equal(cartTotals(twice).ttc, 45);

  const ajout = appliquerSeance([huile], { service_id: 'visage', description: 'Soin visage', draft: { credit_id: 'k2', code: null } }, 's3');
  assert.deepEqual(ajout.map(l => l.key), ['b', 's3']);
});

test('séance du jour de l’achat : compteur désigné par la ligne de vente', () => {
  const draft = { credit_id: null, vendu_key: 'v1', code: null };
  assert.equal(seanceKey(draft, 'massage'), 'vendu:v1:massage');
  assert.equal(
    seanceLabel({ libelle: 'Massage 60 min', seances: 11, restantes: 11 }, 0, null),
    'Massage 60 min — séance 1/11 (nouvel abonnement)',
  );
  const vente: CartLine = { key: 'v1', service_id: 'f', description: 'Abonnement 10 massages', prix_unitaire_ttc: 1320, quantite: 1, taux_tva: 0, abonnement: true };
  const lignes = appliquerSeance([vente], { service_id: 'massage', description: 'Massage', draft }, 's1');
  assert.deepEqual(lignes.map(l => l.key), ['v1', 's1'], 'la vente de la formule n’est jamais convertie');
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

test('liste de prix : produits vente actifs, par marque puis par nom', () => {
  const fiche = (id: string, nom: string, extra: Partial<Product> = {}) => ({
    id, nom, marque: null, reference: null, contenance: null, prix_vente_chf: 42,
    active: true, usage_type: 'vente' as const, ...extra,
  });
  const groupes = listeDePrix([
    fiche('serum', 'Oligoforce - Sérum - 30 ml', { marque: 'Phytomer', contenance: '30 ml', reference: '100330' }),
    fiche('bougie', 'Bougie parfumée'),
    fiche('lait', 'Lait Démaquillant - 1 l', { marque: 'PHYTOMER ' }),
    fiche('baume', 'Baume à lèvres', { marque: 'Alga Maris' }),
    fiche('lime', 'Lime à ongles - 10 cm', { contenance: '12 cm' }),
    fiche('cabine', 'Masque cabine - 500 ml', { marque: 'Phytomer', usage_type: 'cabine' }),
    fiche('testeur', 'Testeur : Hydralgue - 30 ml', { marque: 'Phytomer', usage_type: 'testeur' }),
    fiche('masque', 'Masque désactivé', { marque: 'Phytomer', active: false }),
  ]);
  assert.deepEqual(groupes.map(g => g.marque), ['Alga Maris', 'Phytomer', null], 'sans marque en dernier');
  assert.deepEqual(groupes[1].lignes.map(l => l.id), ['lait', 'serum'], 'cabine, testeur et désactivé exclus ; casse de la marque ignorée');
  assert.deepEqual(groupes[1].lignes[1], { id: 'serum', nom: 'Oligoforce - Sérum', contenance: '30 ml', reference: '100330', prix: 42 });
  assert.equal(groupes[1].lignes[0].contenance, '1 l', 'contenance lue dans le nom si la fiche n’en a pas');
  assert.equal(groupes[1].lignes[0].nom, 'Lait Démaquillant');
  const lime = groupes[2].lignes.find(l => l.id === 'lime');
  assert.equal(lime?.nom, 'Lime à ongles - 10 cm', 'contenance différente : le nom reste entier');
  assert.equal(lime?.contenance, '12 cm');
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

// ── Facture d'achat → stock : lecture et contrôles ─────────────────────────

const lue = normalizeFactureAchat({
  fournisseur: 'COSKYN SA', numero_facture: '140500', date_facture: '10.10.2026',
  montant_ht: "206.50", montant_tva: 16.73, montant_ttc: 223.23, taux_tva: 8.1,
  echeances: [{ date: '2026-10-29', montant: 700 }, { date: 'n/a', montant: 1 }],
  lignes: [
    { reference: 'PHY-100.101', designation: 'Lotion 250 ml', quantite: 3, prix_unitaire_ht: 17, rabais_pct: 10, taux_tva: 8.1, usage: 'vente' },
    { reference: '100999', designation: 'Sérum neuf 30 ml', quantite: 2, prix_unitaire_ht: '50.00', taux_tva: 8.1, usage: 'vente', prix_public_ttc: 90 },
    { reference: '111331', designation: 'Huile cabine 2 l', quantite: 1, prix_unitaire_ht: 60.6, taux_tva: 8.1, usage: 'cabine' },
    { reference: '120999', designation: 'Testeur sérum', quantite: 1, prix_unitaire_ht: 50, rabais_pct: 100, usage: 'testeur' },
  ],
  confiance: 'haute', remarques: [],
});
const fiches = [
  { id: 'lotion', nom: 'Lotion 250 ml', reference: '100101', active: true },
  { id: 'vieux', nom: 'Lotion 250 ml', reference: null, active: false },
];
const relue = (f: FactureAchatLue): FactureAchatLue => ({
  ...f, lignes: f.lignes.map(l => ({ ...l, product_id: trouverFiche(l, fiches)?.id ?? null })),
});
const ctrl = (f: FactureAchatLue, o: Partial<Parameters<typeof controlerFactureAchat>[1]> = {}) =>
  controlerFactureAchat(f, { today: '2026-10-15', ecartJustifie: false, categorieCode: '4200', existantes: [], ...o });

test('lecture : dates suisses, montants texte, usage inconnu → vente, échéance illisible écartée', () => {
  assert.equal(lue.date_facture, '2026-10-10');
  assert.equal(lue.montant_ht, 206.5);
  assert.equal(lue.lignes[1].prix_unitaire, 50);
  assert.equal(lue.lignes[1].prix_vente, 90, 'prix public imprimé repris');
  assert.equal(normalizeFactureAchat({ lignes: [{ designation: 'x', usage: 'inconnu' }] }).lignes[0].usage_type, 'vente',
    'usage illisible → vente, qui exige un prix : prudent');
  assert.deepEqual(lue.echeances, [{ date: '2026-10-29', montant: 700 }]);
});

test('lignes : total HT au centime, rabais déduit ; fiche par référence normalisée', () => {
  assert.equal(totalLigneHT(lue.lignes[0]), 45.9);
  assert.equal(trouverFiche(lue.lignes[0], fiches)?.id, 'lotion');
  assert.equal(trouverFiche({ reference: null, designation: 'lotion 250 ml ' }, fiches)?.id, 'lotion', 'fiche active d’abord');
  assert.equal(trouverFiche(lue.lignes[2], fiches), null);
});

test('contrôles : facture juste → aucun bloquant (testeur offert signalé)', () => {
  const c = ctrl(relue(lue));
  assert.deepEqual(c.bloquants, []);
  assert.equal(c.sommeLignes, 206.5);
  assert.ok(c.avertissements.some(a => /offert/.test(a)));
});

test('contrôles : doublon, total des lignes faux, compte de charges, date future', () => {
  const f = relue(lue);
  assert.ok(ctrl(f, { existantes: [{ fournisseur: ' coskyn sa', numero_facture: '140500', statut: 'a_payer', date_facture: '2026-10-10' }] })
    .bloquants.some(b => /déjà enregistrée/.test(b)));
  assert.equal(ctrl(f, { existantes: [{ fournisseur: 'COSKYN SA', numero_facture: '140500', statut: 'annulee', date_facture: '2026-10-10' }] })
    .bloquants.length, 0, 'une facture annulée peut être réimportée');
  const sansLigne = { ...f, lignes: f.lignes.slice(0, 2) };
  assert.ok(ctrl(sansLigne).bloquants.some(b => /totalisent/.test(b)));
  assert.ok(!ctrl(sansLigne, { ecartJustifie: true }).bloquants.some(b => /totalisent/.test(b)));
  assert.ok(ctrl(f, { categorieCode: '6100' }).bloquants.some(b => /compte d'achat/.test(b)));
  assert.ok(ctrl({ ...f, date_facture: '2026-11-01' }).bloquants.some(b => /futur/.test(b)));
});

test('contrôles : nouveau produit de revente sans prix bloqué, HT + TVA ≠ TTC bloqué', () => {
  const f = relue(lue);
  const sansPrix = { ...f, lignes: f.lignes.map((l, i) => (i === 1 ? { ...l, prix_vente: null } : l)) };
  assert.ok(ctrl(sansPrix).bloquants.some(b => /prix de vente/.test(b)));
  assert.ok(ctrl({ ...f, montant_ttc: 300 }).bloquants.some(b => /TTC/.test(b)));
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
