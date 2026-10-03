import { formatCHF } from '../../../types/booking';

/**
 * Montant à la suisse : `CHF 90` pour un entier, `CHF 1'234.50` sinon (toujours
 * deux décimales, comme l'attend la fiduciaire). S'appuie sur `formatCHF`
 * (de-CH, jamais fr-CH — voir CLAUDE.md) pour les montants ronds.
 */
export function chf(n: number): string {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return formatCHF(v);
  return `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
}
