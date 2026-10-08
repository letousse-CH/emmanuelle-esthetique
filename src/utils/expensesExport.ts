/**
 * Export des dépenses pour la fiduciaire et la déclaration d'impôts : une ligne
 * par dépense (un ticket ventilé en donne une par compte), avec les mentions
 * légales du fournisseur et la TVA taux par taux. Séparateur `;` et BOM UTF-8,
 * comme le livre de caisse : le fichier s'ouvre d'un double-clic dans Excel.
 *
 * Les dépenses annulées n'y figurent pas : elles ne sont pas des charges.
 */
import {
  EXPENSE_PAYMENT_MODE_LABELS,
  EXPENSE_STATUS_LABELS,
  type Expense,
  type ExpenseTvaLine,
} from '../types/finance';
import { round2 } from '../types/receipts';

const HEADER = [
  'Date', 'N° de pièce', 'Type de pièce', 'Fournisseur', 'Adresse du fournisseur', 'N° IDE / TVA du fournisseur',
  'Compte', 'Libellé du compte', 'Déductible', 'Montant TTC (CHF)', 'TVA 8.1 % (CHF)', 'TVA 2.6 % (CHF)',
  'TVA 3.8 % (CHF)', 'TVA autres taux (CHF)', 'Total TVA (CHF)', 'Montant HT (CHF)', 'Mode de paiement',
  'Statut', 'Date de paiement', 'Justificatif', 'Remarque',
];

const TYPE_LABELS: Record<string, string> = { ticket: 'Ticket de caisse', facture: 'Facture', autre: 'Autre' };

function tvaLines(e: Expense): ExpenseTvaLine[] {
  if (Array.isArray(e.tva_details) && e.tva_details.length > 0) return e.tva_details;
  const tva = Number(e.montant_tva || 0);
  return tva > 0 || Number(e.taux_tva) > 0
    ? [{ taux: Number(e.taux_tva), montant_ht: Number(e.montant_ht), montant_tva: tva, montant_ttc: Number(e.montant_ttc) }]
    : [];
}

const frDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-CH') : '';

/** Une ligne à la largeur de l'en-tête : les lignes de synthèse sont positionnelles. */
function row(cells: Partial<Record<number, string>>): string[] {
  return HEADER.map((_, i) => cells[i] ?? '');
}

export function buildExpensesCsv(expenses: Expense[], year: number): string {
  const list = expenses
    .filter((e) => e.statut !== 'annulee' && e.date_facture.startsWith(String(year)))
    .sort((a, b) => a.date_facture.localeCompare(b.date_facture) || a.fournisseur.localeCompare(b.fournisseur));

  const byAccount = new Map<string, { label: string; ttc: number; tva: number; ht: number }>();
  const lines = list.map((e) => {
    const tva = tvaLines(e);
    const at = (rate: number) => round2(tva.filter((l) => l.taux === rate).reduce((s, l) => s + l.montant_tva, 0));
    const others = round2(tva.filter((l) => ![8.1, 2.6, 3.8].includes(l.taux)).reduce((s, l) => s + l.montant_tva, 0));
    const ttc = Number(e.montant_ttc || 0);
    const totalTva = Number(e.montant_tva || 0);
    const ht = Number(e.montant_ht || ttc - totalTva);
    const code = e.category?.code ?? '';
    const label = e.category?.nom ?? 'Sans compte';

    const acc = byAccount.get(code) ?? { label, ttc: 0, tva: 0, ht: 0 };
    acc.ttc += ttc; acc.tva += totalTva; acc.ht += ht;
    byAccount.set(code, acc);

    return [
      frDate(e.date_facture),
      e.numero_facture ?? '',
      TYPE_LABELS[e.type_piece ?? 'facture'] ?? '',
      e.fournisseur,
      e.fournisseur_adresse ?? '',
      e.fournisseur_ide ?? '',
      code,
      label,
      e.category ? (e.category.deductible_fiscal ? 'Oui' : 'Non') : '',
      ttc.toFixed(2),
      at(8.1).toFixed(2),
      at(2.6).toFixed(2),
      at(3.8).toFixed(2),
      others.toFixed(2),
      totalTva.toFixed(2),
      ht.toFixed(2),
      e.mode_paiement ? EXPENSE_PAYMENT_MODE_LABELS[e.mode_paiement] : '',
      EXPENSE_STATUS_LABELS[e.statut]?.label ?? e.statut,
      frDate(e.date_paiement),
      e.justificatif_path ? `Archivé (${e.justificatif_path})` : e.document_url ? e.document_url : 'Aucun',
      e.notes ?? '',
    ];
  });

  const synthese: string[][] = [[]];
  let total = { ttc: 0, tva: 0, ht: 0 };
  for (const [code, acc] of [...byAccount.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    synthese.push(row({ 0: `Total compte ${code || '—'}`, 7: acc.label, 9: acc.ttc.toFixed(2), 14: acc.tva.toFixed(2), 15: acc.ht.toFixed(2) }));
    total = { ttc: total.ttc + acc.ttc, tva: total.tva + acc.tva, ht: total.ht + acc.ht };
  }
  synthese.push(row({ 0: `Total des dépenses ${year}`, 9: total.ttc.toFixed(2), 14: total.tva.toFixed(2), 15: total.ht.toFixed(2) }));
  synthese.push(row({
    0: 'Note pour la fiducie',
    20: "Un ticket imputé à plusieurs comptes figure sur plusieurs lignes qui partagent le même justificatif ; la part privée d'un ticket n'est pas reprise. Les dépenses annulées sont exclues. La TVA est indiquée pour information : l'activité n'est pas assujettie tant que le chiffre d'affaires reste sous CHF 100'000.",
  }));

  return [HEADER, ...lines, ...synthese]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
}

export function downloadExpensesCsv(expenses: Expense[], year: number): void {
  const blob = new Blob(['﻿' + buildExpensesCsv(expenses, year)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `depenses-${year}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révoquer tout de suite peut interrompre le téléchargement sur Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
