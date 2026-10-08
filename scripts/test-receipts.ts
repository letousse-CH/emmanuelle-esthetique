/**
 * Tests des règles « ticket de caisse → dépenses » (aucune base, aucun réseau).
 *
 *   npx tsx scripts/test-receipts.ts
 */
import assert from 'node:assert/strict';
import {
  buildTicketExpenseRows,
  isValidSwissUid,
  normalizeReceiptExtraction,
  normalizeSupplierUid,
  parseAmount,
  parseIsoDate,
  ticketPartPrivee,
  validateTicketDraft,
  type TicketDraft,
} from '../src/types/receipts';
import { buildExpensesCsv } from '../src/utils/expensesExport';
import type { Expense } from '../src/types/finance';

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

const CODES = ['4000', '4200', '4400', '6100', '6210', '6640', '6990'];
const TODAY = '2026-10-08';

test('montants : formats suisses, virgule, devise, milliers', () => {
  assert.equal(parseAmount("1'234.50"), 1234.5);
  assert.equal(parseAmount('12,50'), 12.5);
  assert.equal(parseAmount('CHF 9.90'), 9.9);
  assert.equal(parseAmount('1.234,50'), 1234.5);
  assert.equal(parseAmount(-2), -2);
  assert.equal(parseAmount('illisible'), 0);
});

test('dates : JJ.MM.AAAA, JJ.MM.AA, ISO, date impossible', () => {
  assert.equal(parseIsoDate('06.10.2026'), '2026-10-06');
  assert.equal(parseIsoDate('6.10.26'), '2026-10-06');
  assert.equal(parseIsoDate('2026-10-06'), '2026-10-06');
  assert.equal(parseIsoDate('31.02.2026'), null);
});

test('IDE : chiffre de contrôle et mise en forme', () => {
  assert.equal(isValidSwissUid('100155212'), true);
  assert.equal(isValidSwissUid('100155213'), false);
  assert.deepEqual(normalizeSupplierUid('CHE 100 155 212 MWST'), { ide: 'CHE-100.155.212 TVA', valide: true });
  assert.deepEqual(normalizeSupplierUid('CHE-100.155.213'), { ide: 'CHE-100.155.213', valide: false });
  assert.deepEqual(normalizeSupplierUid('FR12345678901'), { ide: 'FR12345678901', valide: null });
  assert.deepEqual(normalizeSupplierUid(null), { ide: null, valide: null });
});

const RAW = {
  type_piece: 'ticket',
  fournisseur: 'Droguerie du Jorat SA',
  fournisseur_adresse: 'Grand-Rue 12, 1610 Oron-la-Ville, Suisse',
  fournisseur_ide: 'CHE-100.155.212 TVA',
  numero_piece: '4521-0087',
  date: '2026-10-06',
  heure: '14:32',
  devise: 'CHF',
  montant_ttc: 38.25,
  tva: [
    { taux: 8.1, montant_ht: 23.36, montant_tva: 1.89, montant_ttc: 25.25 },
    { taux: 2.6, montant_ht: 12.67, montant_tva: 0.33, montant_ttc: 13.0 },
  ],
  mode_paiement: 'TWINT',
  lignes: [],
  ventilation: [
    { compte: '4400', libelle: 'Coton, lingettes, spatules', montant_ttc: 19.3, taux_tva: 8.1 },
    { compte: '6640', libelle: 'Café et biscuits clientes', montant_ttc: 13.0, taux_tva: 2.6 },
    { compte: 'prive', libelle: 'Shampoing', montant_ttc: 5.95, taux_tva: 8.1 },
  ],
  compte_principal: '4400',
  confiance: 'haute',
  remarques: [],
};

test('lecture : ventilation, part privée, paiement, aucune alerte', () => {
  const x = normalizeReceiptExtraction(RAW, CODES, TODAY);
  assert.equal(x.mode_paiement, 'twint');
  assert.equal(x.part_privee, 5.95);
  assert.deepEqual(x.ventilation.map((v) => [v.compte, v.montant_ttc]), [['4400', 19.3], ['6640', 13]]);
  assert.equal(x.montant_tva, 2.22);
  assert.equal(x.ide_valide, true);
  assert.deepEqual(x.alertes, []);
});

test('lecture : compte inconnu → 6990, écart reporté et signalé', () => {
  const x = normalizeReceiptExtraction(
    { ...RAW, ventilation: [{ compte: '9999', montant_ttc: 30, taux_tva: 8.1 }, { compte: 'prive', montant_ttc: 5.95 }] },
    CODES,
    TODAY,
  );
  assert.equal(x.ventilation[0].compte, '6990');
  assert.equal(x.ventilation[0].montant_ttc, 32.3);
  assert.ok(x.alertes.some((a) => a.includes('ne tombait pas juste')));
});

test('lecture : sans ventilation, tout va au compte principal', () => {
  const x = normalizeReceiptExtraction({ ...RAW, ventilation: [], compte_principal: '6210', tva: [] }, CODES, TODAY);
  assert.deepEqual(x.ventilation.map((v) => [v.compte, v.montant_ttc]), [['6210', 38.25]]);
});

test('lecture : date future, devise étrangère, IDE faux, TVA sans IDE', () => {
  const x = normalizeReceiptExtraction({ ...RAW, date: '2026-12-01', devise: 'EUR', fournisseur_ide: 'CHE-100.155.213' }, CODES, TODAY);
  assert.ok(x.alertes.some((a) => a.includes('futur')));
  assert.ok(x.alertes.some((a) => a.includes('EUR')));
  assert.ok(x.alertes.some((a) => a.includes('contrôle')));
  const y = normalizeReceiptExtraction({ ...RAW, fournisseur_ide: null }, CODES, TODAY);
  assert.ok(y.alertes.some((a) => a.includes('aucun n° IDE')));
});

const DRAFT: TicketDraft = {
  type_piece: 'ticket',
  fournisseur: 'Droguerie du Jorat SA',
  fournisseur_adresse: 'Grand-Rue 12, 1610 Oron-la-Ville',
  fournisseur_ide: 'CHE-100.155.212 TVA',
  numero_piece: '4521-0087',
  date: '2026-10-06',
  mode_paiement: 'twint',
  montant_ttc: 38.25,
  tva: RAW.tva,
  ventilation: [
    { compte: '4400', libelle: 'Coton', montant_ttc: 19.3, taux_tva: 8.1 },
    { compte: '6640', libelle: 'Café clientes', montant_ttc: 13, taux_tva: 2.6 },
  ],
  notes: '',
};
const CATS = CODES.map((code) => ({ id: `uuid-${code}`, code }));

test('enregistrement : une dépense par compte, même justificatif, TVA par part', () => {
  const rows = buildTicketExpenseRows(DRAFT, CATS, '2026/10/x.jpg', null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.category_id), ['uuid-4400', 'uuid-6640']);
  assert.ok(rows.every((r) => r.justificatif_path === '2026/10/x.jpg' && r.statut === 'payee'));
  assert.equal(rows[0].montant_tva, 1.45);
  assert.equal(rows[0].montant_ht, 17.85);
  assert.equal(rows[1].montant_tva, 0.33);
  assert.match(rows[0].notes ?? '', /Part privée non comptabilisée : CHF 5\.95/);
  assert.equal(ticketPartPrivee(DRAFT), 5.95);
});

test('enregistrement : un seul compte, toute la pièce → TVA exacte du ticket', () => {
  const rows = buildTicketExpenseRows(
    { ...DRAFT, ventilation: [{ compte: '4400', libelle: '', montant_ttc: 38.25, taux_tva: 8.1 }] },
    CATS,
    null,
    null,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].montant_tva, 2.22);
  assert.equal(rows[0].tva_details?.length, 2);
});

test('validation : parts au-delà du total, compte manquant', () => {
  assert.equal(validateTicketDraft(DRAFT, CODES), null);
  assert.match(
    validateTicketDraft({ ...DRAFT, ventilation: [{ compte: '4400', libelle: '', montant_ttc: 40, taux_tva: 8.1 }] }, CODES) ?? '',
    /dépassent/,
  );
  assert.match(
    validateTicketDraft({ ...DRAFT, ventilation: [{ compte: '5100', libelle: '', montant_ttc: 10, taux_tva: 0 }] }, CODES) ?? '',
    /compte/,
  );
});

test('export : colonnes alignées, TVA par taux, synthèse par compte', () => {
  const rows = buildTicketExpenseRows(DRAFT, CATS, '2026/10/x.jpg', null);
  const expenses = rows.map((r, i) => ({
    ...r,
    id: String(i),
    created_at: '',
    updated_at: '',
    category: { id: r.category_id!, code: i === 0 ? '4400' : '6640', nom: i === 0 ? 'Consommables' : 'Représentation', description: null, groupe: 'charges_exploitation', ordre: 0, deductible_fiscal: true },
  })) as Expense[];
  const csv = buildExpensesCsv(expenses, 2026);
  const lines = csv.split('\r\n');
  const width = lines[0].split('";"').length;
  assert.ok(lines.every((l) => l === '' || l.split('";"').length === width), 'toutes les lignes ont la largeur de l’en-tête');
  assert.match(lines[1], /"06\.10\.2026";"4521-0087";"Ticket de caisse";"Droguerie du Jorat SA"/);
  assert.match(lines[1], /"1\.45";"0\.00";"0\.00";"0\.00";"1\.45";"17\.85"/);
  assert.ok(lines.some((l) => l.startsWith('"Total des dépenses 2026"') && l.includes('"32.30"')));
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
