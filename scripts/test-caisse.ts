/**
 * Tests des règles de la caisse et du bilan (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-caisse.ts
 */
import assert from 'node:assert/strict';
import {
  cartTotals,
  isGiftCardUsable,
  ligneMarge,
  recetteEncaissee,
  remisePatch,
  ventilerRecettes,
  type GiftCard,
} from '../src/types/caisse';
import { AVS_BORNE_HAUTE, computeAvsIndependant } from '../src/types/finance';

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

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
