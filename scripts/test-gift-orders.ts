/**
 * Tests des règles des bons cadeaux commandés en ligne (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-gift-orders.ts
 */
import assert from 'node:assert/strict';
import {
  GIFT_MAX, GIFT_MESSAGE_MAX, GIFT_QTE_MAX,
  cleanText, giftOrderLibelle, giftOrderOpen, isTwintPayLink, joursDepuis, parseGiftOrderSettings, parseMontant,
  twintPayUrl,
  validateGiftOrder,
} from '../src/types/giftOrders';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const catalogue = new Map([
  ['visage', { nom: 'Soin Hydra Originel', prix: 140, complement: false }],
  ['massage', { nom: 'Grand massage relaxant', prix: 145, complement: false }],
  ['option', { nom: 'Option massage du cuir chevelu', prix: 25, complement: true }],
]);
const ctx = { montantMin: 100, catalogue };

const acheteuse = {
  beneficiaire: 'Léa Martin',
  acheteur_prenom: 'Anne',
  acheteur_nom: 'Dupont',
  acheteur_email: 'Anne.Dupont@Example.ch ',
};

console.log('Montant libre');

test('accepte le minimum et normalise l’e-mail', () => {
  const r = validateGiftOrder({ type: 'montant', montant: '100', ...acheteuse }, ctx);
  assert.ok(r.ok);
  assert.equal(r.draft.montant, 100);
  assert.equal(r.draft.libelle, 'Bon cadeau');
  assert.equal(r.draft.acheteur_email, 'anne.dupont@example.ch');
  assert.deepEqual(r.draft.lignes, []);
});

test('refuse sous le minimum et au-dessus du plafond', () => {
  const bas = validateGiftOrder({ type: 'montant', montant: 99.5, ...acheteuse }, ctx);
  assert.ok(!bas.ok && bas.errors.montant?.includes('100'));
  const haut = validateGiftOrder({ type: 'montant', montant: GIFT_MAX + 1, ...acheteuse }, ctx);
  assert.ok(!haut.ok && haut.errors.montant);
});

test("lit « 150,50 » et « 1'200 »", () => {
  assert.equal(parseMontant('150,50'), 150.5);
  assert.equal(parseMontant("1'200"), 1200);
  assert.equal(parseMontant('abc'), null);
});

console.log('Soins de la carte');

test('prix du catalogue, jamais du navigateur', () => {
  const r = validateGiftOrder({
    type: 'soins',
    soins: [{ id: 'visage', quantite: 1, prix: 1 }, { id: 'massage', quantite: 2 }],
    montant: 5,
    ...acheteuse,
  }, ctx);
  assert.ok(r.ok);
  assert.equal(r.draft.montant, 140 + 2 * 145);
  assert.equal(r.draft.libelle, 'Bon cadeau — Soin Hydra Originel + 2 × Grand massage relaxant');
});

test('regroupe un même soin et plafonne la quantité', () => {
  const r = validateGiftOrder({
    type: 'soins',
    soins: [{ id: 'visage', quantite: 4 }, { id: 'visage', quantite: 4 }],
    ...acheteuse,
  }, ctx);
  assert.ok(r.ok);
  assert.equal(r.draft.lignes.length, 1);
  assert.equal(r.draft.lignes[0].quantite, GIFT_QTE_MAX);
});

test('un complément seul ne s’offre pas', () => {
  const r = validateGiftOrder({ type: 'soins', soins: [{ id: 'option' }], ...acheteuse }, ctx);
  assert.ok(!r.ok && r.errors.soins);
  const avec = validateGiftOrder({ type: 'soins', soins: [{ id: 'option' }, { id: 'visage' }], ...acheteuse }, ctx);
  assert.ok(avec.ok);
  assert.equal(avec.draft.montant, 165);
});

test('le minimum du montant libre ne s’applique pas aux soins', () => {
  const petit = new Map([['sourcils', { nom: 'Sourcils', prix: 22, complement: false }]]);
  const r = validateGiftOrder({ type: 'soins', soins: [{ id: 'sourcils' }], ...acheteuse }, { montantMin: 100, catalogue: petit });
  assert.ok(r.ok);
  assert.equal(r.draft.montant, 22);
});

test('soin inconnu ou liste vide', () => {
  const inconnu = validateGiftOrder({ type: 'soins', soins: [{ id: 'retire' }], ...acheteuse }, ctx);
  assert.ok(!inconnu.ok && inconnu.errors.soins?.includes('plus à la carte'));
  const vide = validateGiftOrder({ type: 'soins', soins: [], ...acheteuse }, ctx);
  assert.ok(!vide.ok && vide.errors.soins);
});

console.log('Bénéficiaire, message, coordonnées');

test('le bon est nominatif', () => {
  const r = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, beneficiaire: '   ' }, ctx);
  assert.ok(!r.ok && r.errors.beneficiaire);
});

test('message : 300 caractères, retours à la ligne gardés, contrôles retirés', () => {
  const ok = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, message: 'Joyeux\nanniversaire\u0007 !' }, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.draft.message, 'Joyeux\nanniversaire !');
  const long = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, message: 'x'.repeat(GIFT_MESSAGE_MAX + 1) }, ctx);
  assert.ok(!long.ok && long.errors.message);
  const vide = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, message: '  ' }, ctx);
  assert.ok(vide.ok && vide.draft.message === null);
});

test('e-mail obligatoire et valide, téléphone facultatif', () => {
  const r = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, acheteur_email: 'anne@' }, ctx);
  assert.ok(!r.ok && r.errors.acheteur_email);
  const tel = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse, acheteur_telephone: '079' }, ctx);
  assert.ok(!tel.ok && tel.errors.acheteur_telephone);
  const sans = validateGiftOrder({ type: 'montant', montant: 150, ...acheteuse }, ctx);
  assert.ok(sans.ok && sans.draft.acheteur_telephone === null);
});

test('type manquant', () => {
  const r = validateGiftOrder({ ...acheteuse }, ctx);
  assert.ok(!r.ok && r.errors.type);
});

console.log('Réglages et libellés');

const PAYLINK = 'https://go.twint.ch/1/e/tw?tw=acq.Ab12-cd_34.';

test('ouverte seulement avec l’interrupteur ET le lien de paiement TWINT', () => {
  assert.equal(giftOrderOpen(parseGiftOrderSettings({ bon_en_ligne_actif: 'true' })), false);
  assert.equal(giftOrderOpen(parseGiftOrderSettings({ bon_en_ligne_actif: 'true', bon_en_ligne_twint_lien: 'pas un lien' })), false);
  assert.equal(giftOrderOpen(parseGiftOrderSettings({ bon_en_ligne_actif: 'true', bon_en_ligne_twint_lien: PAYLINK })), true);
  assert.equal(giftOrderOpen(parseGiftOrderSettings({ bon_en_ligne_actif: 'false', bon_en_ligne_twint_lien: PAYLINK })), false);
  // L'ancien code QR statique ne suffit plus : TWINT le réserve au paiement sur place.
  assert.equal(giftOrderOpen(parseGiftOrderSettings({ bon_en_ligne_actif: 'true', bon_en_ligne_twint_qr: 'https://x/qr.png' })), false);
});

test('lien TWINT officiel seulement', () => {
  assert.equal(isTwintPayLink(PAYLINK), true);
  assert.equal(isTwintPayLink('http://go.twint.ch/1/e/tw?tw=acq.x.'), false);
  assert.equal(isTwintPayLink('https://go.twint.ch.exemple.com/1/e/tw'), false);
  assert.equal(isTwintPayLink('https://x/qr.png'), false);
});

test('lien pré-rempli : montant et référence (notice TWINT)', () => {
  assert.equal(
    twintPayUrl(PAYLINK, 150, 'CMD-2026-0001'),
    `${PAYLINK}&amount=150.00&trxInfo=Bon+cadeau+CMD-2026-0001`,
  );
  assert.equal(twintPayUrl(PAYLINK, 89.5, 'CMD-2026-0002').includes('&amount=89.50&'), true);
  // Un lien déjà pré-rempli à la main est remplacé, pas doublé.
  const u = new URL(twintPayUrl(`${PAYLINK}&amount=10&trxInfo=x`, 200, 'CMD-2026-0003'));
  assert.deepEqual(u.searchParams.getAll('amount'), ['200.00']);
  assert.deepEqual(u.searchParams.getAll('trxInfo'), ['Bon cadeau CMD-2026-0003']);
  assert.equal(u.searchParams.get('tw'), 'acq.Ab12-cd_34.');
  assert.equal(twintPayUrl('https://x/qr.png', 150, 'CMD-2026-0001'), '');
});

test('minimum par défaut : CHF 100', () => {
  assert.equal(parseGiftOrderSettings({}).montantMin, 100);
  assert.equal(parseGiftOrderSettings({ bon_en_ligne_montant_min: '150' }).montantMin, 150);
  assert.equal(parseGiftOrderSettings({ bon_en_ligne_montant_min: 'abc' }).montantMin, 100);
});

test('libellé identique à la caisse', () => {
  assert.equal(giftOrderLibelle('montant', []), 'Bon cadeau');
  assert.equal(giftOrderLibelle('soins', [{ nom: 'A', quantite: 1 }, { nom: 'B', quantite: 1 }]), 'Bon cadeau — A + B');
});

test('texte nettoyé', () => {
  assert.equal(cleanText('  Léa \t  Martin ', 80), 'Léa Martin');
  assert.equal(cleanText('a'.repeat(100), 10), 'a'.repeat(10));
});

test('jours depuis la commande', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  assert.equal(joursDepuis('2026-10-21T11:00:00Z', now), 3);
  assert.equal(joursDepuis('2026-10-25T11:00:00Z', now), 0);
});

console.log(`\n${passed} tests réussis.`);
