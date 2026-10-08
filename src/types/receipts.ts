/**
 * Ticket de caisse photographié → dépense(s) ventilée(s) par compte.
 *
 * Règles pures, sans accès réseau : elles nettoient ce que l'IA a lu
 * (`normalizeReceiptExtraction`), contrôlent la saisie et préparent les lignes
 * de la table `expenses` (`buildTicketExpenseRows`).
 *
 * Un ticket qui mélange plusieurs comptes (coton pour la cabine + café offert
 * aux clientes) devient plusieurs dépenses qui partagent la même photo : les
 * rapports, qui raisonnent « une dépense = un compte », n'ont rien à changer.
 * Ce qui reste du total une fois les comptes servis est la part privée : elle
 * n'est pas comptabilisée.
 */

import type {
  Expense,
  ExpenseCategory,
  ExpenseDocumentType,
  ExpensePaymentMode,
  ExpenseTvaLine,
} from './finance';

/** Taux suisses en vigueur depuis 2024, puis ceux d'avant (tickets plus anciens). */
export const SWISS_VAT_RATES = [8.1, 2.6, 3.8, 7.7, 2.5, 3.7] as const;

/** Compte réservé aux achats personnels repérés sur un ticket : jamais enregistré. */
export const PRIVATE_ACCOUNT = 'prive';

export interface ReceiptLine {
  designation: string;
  quantite: number;
  montant_ttc: number;
  taux_tva: number | null;
  /** Code de compte proposé, ou `prive`. */
  compte: string;
}

/** Une part du ticket imputée à un compte. */
export interface ReceiptVentilation {
  compte: string;
  libelle: string;
  montant_ttc: number;
  taux_tva: number;
}

export type ReceiptConfidence = 'haute' | 'moyenne' | 'basse';

export interface ReceiptExtraction {
  type_piece: ExpenseDocumentType;
  fournisseur: string;
  fournisseur_adresse: string | null;
  /** IDE remis en forme `CHE-123.456.789 TVA` quand il est suisse. */
  fournisseur_ide: string | null;
  /** `null` : pas d'IDE suisse à contrôler. */
  ide_valide: boolean | null;
  numero_piece: string | null;
  date: string | null;
  heure: string | null;
  devise: string;
  montant_ttc: number;
  tva: ExpenseTvaLine[];
  montant_tva: number;
  mode_paiement: ExpensePaymentMode | null;
  lignes: ReceiptLine[];
  /** Parts professionnelles, regroupées par compte et par taux. */
  ventilation: ReceiptVentilation[];
  part_privee: number;
  compte_principal: string;
  raison: string;
  confiance: ReceiptConfidence;
  remarques: string[];
  /** Contrôles calculés ici, à afficher avant l'enregistrement. */
  alertes: string[];
}

// ── Lecture des valeurs ─────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '';
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s && !/^(null|n\/a|—|-|inconnu)$/i.test(s) ? s : null;
}

/** « 1'234.50 », « 12,50 », « CHF 9.90 », 12.5 → nombre arrondi au centime. */
export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : 0;
  let s = str(v).replace(/[^\d.,'’\-]/g, '').replace(/['’]/g, '');
  if (!s) return 0;
  // Virgule décimale (« 12,50 », « 1.234,50 ») ; une virgule suivie de trois
  // chiffres sans point est un séparateur de milliers.
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = !s.includes('.') && /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Taux lu (« 8.1 % », « 8,1 », 8.10) ramené au taux légal le plus proche. */
export function parseRate(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseAmount(v);
  if (n <= 0) return n === 0 && str(v) !== '' ? 0 : null;
  const known = SWISS_VAT_RATES.find((r) => Math.abs(r - n) < 0.06);
  return known ?? n;
}

/** AAAA-MM-JJ, JJ.MM.AAAA, JJ.MM.AA ou JJ/MM/AAAA → AAAA-MM-JJ, ou null si la date n'existe pas. */
export function parseIsoDate(v: unknown): string | null {
  const s = str(v);
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseTime(v: unknown): string | null {
  const match = str(v).match(/^(\d{1,2})[:.h](\d{2})/);
  if (!match) return null;
  const [h, min] = [Number(match[1]), Number(match[2])];
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${match[2]}` : null;
}

/**
 * Chiffre de contrôle du numéro IDE (eCH-0097) : poids 5,4,3,2,7,6,5,4 sur les
 * huit premiers chiffres, contrôle = 11 − (somme mod 11), 11 valant 0 ; un
 * résultat de 10 n'est jamais attribué.
 */
export function isValidSwissUid(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const check = (11 - (sum % 11)) % 11;
  return check !== 10 && check === Number(digits[8]);
}

/** « CHE 123 456 789 MWST » → « CHE-123.456.789 TVA » ; un n° étranger est gardé tel quel. */
export function normalizeSupplierUid(v: unknown): { ide: string | null; valide: boolean | null } {
  const raw = strOrNull(v);
  if (!raw) return { ide: null, valide: null };
  const match = raw.toUpperCase().match(/CHE[\s.\-]*((?:\d[\s.\-]*){9})/);
  if (!match) return { ide: raw, valide: null };
  const digits = match[1].replace(/\D/g, '');
  const vat = /\b(TVA|MWST|IVA|VAT)\b/i.test(raw);
  const ide = `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}${vat ? ' TVA' : ''}`;
  return { ide, valide: isValidSwissUid(digits) };
}

function parsePaymentMode(v: unknown): ExpensePaymentMode | null {
  const s = str(v).toLowerCase();
  if (!s) return null;
  if (s.includes('twint')) return 'twint';
  if (/esp[eè]ce|cash|bar\b|comptant/.test(s)) return 'especes';
  if (/virement|facture|qr|bvr|iban/.test(s)) return 'virement';
  if (/carte|card|visa|master|maestro|debit|débit|postfinance|v pay|amex|american|apple pay|google pay/.test(s)) return 'carte';
  return null;
}

function parseTvaLines(v: unknown): ExpenseTvaLine[] {
  if (!Array.isArray(v)) return [];
  const lines: ExpenseTvaLine[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const taux = parseRate(o.taux);
    if (taux === null) continue;
    let ht = parseAmount(o.montant_ht);
    let tva = parseAmount(o.montant_tva);
    let ttc = parseAmount(o.montant_ttc);
    if (!ttc && ht) ttc = round2(ht + tva);
    if (!tva && ttc && taux > 0) tva = round2(ttc - ttc / (1 + taux / 100));
    if (!ht && ttc) ht = round2(ttc - tva);
    if (ttc <= 0 && tva <= 0) continue;
    const same = lines.find((l) => l.taux === taux);
    if (same) {
      same.montant_ht = round2(same.montant_ht + ht);
      same.montant_tva = round2(same.montant_tva + tva);
      same.montant_ttc = round2(same.montant_ttc + ttc);
    } else {
      lines.push({ taux, montant_ht: ht, montant_tva: tva, montant_ttc: ttc });
    }
  }
  return lines.sort((a, b) => b.montant_ttc - a.montant_ttc);
}

/** Répartit un montant TTC en HT + TVA au taux donné. */
export function splitTtc(ttc: number, taux: number): ExpenseTvaLine {
  const montant_ht = taux > 0 ? round2(ttc / (1 + taux / 100)) : round2(ttc);
  return { taux, montant_ht, montant_tva: round2(ttc - montant_ht), montant_ttc: round2(ttc) };
}

// ── Nettoyage de la lecture IA ──────────────────────────────────────────────

/**
 * Rend exploitable la réponse brute de l'IA : nombres et dates normalisés,
 * comptes inconnus ramenés à « Autres charges », ventilation qui tombe juste
 * sur le total, et contrôles à montrer à l'exploitante.
 *
 * `codes` : comptes acceptés (ceux de `expense_categories`) ; `fallbackCode`
 * reçoit tout compte inconnu. `today` (AAAA-MM-JJ) sert au contrôle de date.
 */
export function normalizeReceiptExtraction(
  raw: unknown,
  codes: string[],
  today: string,
  fallbackCode = '6990',
): ReceiptExtraction {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const known = new Set(codes);
  const account = (v: unknown): string => {
    const s = str(v).toLowerCase();
    if (s === PRIVATE_ACCOUNT || s === 'privé') return PRIVATE_ACCOUNT;
    const code = s.match(/\d{4}/)?.[0] ?? '';
    return known.has(code) ? code : fallbackCode;
  };

  const tva = parseTvaLines(o.tva);
  const dominantRate = tva[0]?.taux ?? 0;

  const lignes: ReceiptLine[] = (Array.isArray(o.lignes) ? o.lignes : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({
      designation: str(l.designation) || 'Article',
      quantite: parseAmount(l.quantite) || 1,
      montant_ttc: parseAmount(l.montant_ttc),
      taux_tva: parseRate(l.taux_tva),
      compte: account(l.compte),
    }));

  // Parts du ticket par compte et par taux.
  const parts = new Map<string, ReceiptVentilation>();
  for (const item of Array.isArray(o.ventilation) ? o.ventilation : []) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Record<string, unknown>;
    const compte = account(v.compte);
    const taux = parseRate(v.taux_tva) ?? dominantRate;
    const montant = parseAmount(v.montant_ttc);
    if (montant === 0) continue;
    const key = `${compte}|${taux}`;
    const prev = parts.get(key);
    if (prev) prev.montant_ttc = round2(prev.montant_ttc + montant);
    else parts.set(key, { compte, libelle: str(v.libelle), montant_ttc: montant, taux_tva: taux });
  }

  let privee = 0;
  let ventilation: ReceiptVentilation[] = [];
  for (const part of parts.values()) {
    if (part.compte === PRIVATE_ACCOUNT) privee = round2(privee + part.montant_ttc);
    else if (part.montant_ttc > 0) ventilation.push(part);
  }
  privee = Math.max(0, privee);
  ventilation.sort((a, b) => b.montant_ttc - a.montant_ttc);

  const remarques = (Array.isArray(o.remarques) ? o.remarques : [o.remarques])
    .map(str)
    .filter(Boolean);
  const alertes: string[] = [];

  let montantTtc = parseAmount(o.montant_ttc);
  const sumVentilation = round2(ventilation.reduce((s, v) => s + v.montant_ttc, 0));
  if (montantTtc <= 0) montantTtc = round2(sumVentilation + privee) || round2(tva.reduce((s, l) => s + l.montant_ttc, 0));

  let principal = account(o.compte_principal);
  if (principal === PRIVATE_ACCOUNT) principal = ventilation[0]?.compte ?? fallbackCode;

  if (ventilation.length === 0) {
    const rest = round2(montantTtc - privee);
    if (rest > 0) ventilation = [{ compte: principal, libelle: '', montant_ttc: rest, taux_tva: dominantRate }];
  } else {
    // La ventilation doit tomber juste : l'écart va sur la part la plus grosse.
    const ecart = round2(montantTtc - privee - sumVentilation);
    if (ecart !== 0 && ventilation[0].montant_ttc + ecart > 0) {
      ventilation[0].montant_ttc = round2(ventilation[0].montant_ttc + ecart);
      if (Math.abs(ecart) > 0.05) {
        alertes.push(`La répartition proposée ne tombait pas juste (écart de CHF ${ecart.toFixed(2)}, reporté sur « ${ventilation[0].libelle || ventilation[0].compte} ») : vérifiez-la.`);
      }
    }
  }
  if (!ventilation.some((v) => v.compte === principal)) principal = ventilation[0]?.compte ?? principal;

  const uid = normalizeSupplierUid(o.fournisseur_ide);
  const date = parseIsoDate(o.date);
  const devise = (str(o.devise).toUpperCase().match(/[A-Z]{3}/)?.[0]) ?? 'CHF';
  const fournisseur = str(o.fournisseur);
  const confiance: ReceiptConfidence = o.confiance === 'haute' || o.confiance === 'basse' ? o.confiance : 'moyenne';
  const typePiece: ExpenseDocumentType = o.type_piece === 'facture' || o.type_piece === 'autre' ? o.type_piece : 'ticket';

  if (confiance === 'basse') alertes.push('Photo difficile à lire : vérifiez chaque champ avant d’enregistrer.');
  if (!fournisseur) alertes.push('Fournisseur illisible : à saisir.');
  if (montantTtc <= 0) alertes.push('Montant total illisible : à saisir.');
  if (!date) alertes.push('Date illisible : à saisir.');
  else if (date > today) alertes.push('La date lue est dans le futur : vérifiez-la.');
  if (devise !== 'CHF') {
    alertes.push(`Pièce en ${devise} : saisissez le montant réellement débité en CHF (relevé de carte).`);
  }
  if (uid.valide === false) alertes.push('Le n° IDE lu ne passe pas le contrôle : comparez-le à la photo.');
  if (tva.some((l) => l.taux > 0) && !uid.ide) {
    alertes.push('TVA indiquée mais aucun n° IDE lisible : sans lui, cette TVA ne pourra pas être récupérée plus tard.');
  }
  const sumTva = round2(tva.reduce((s, l) => s + l.montant_ttc, 0));
  if (tva.length > 0 && montantTtc > 0 && Math.abs(sumTva - montantTtc) > 0.05) {
    alertes.push(`Le récapitulatif TVA (CHF ${sumTva.toFixed(2)}) ne correspond pas au total payé : vérifiez les montants.`);
  }

  return {
    type_piece: typePiece,
    fournisseur,
    fournisseur_adresse: strOrNull(o.fournisseur_adresse),
    fournisseur_ide: uid.ide,
    ide_valide: uid.valide,
    numero_piece: strOrNull(o.numero_piece),
    date,
    heure: parseTime(o.heure),
    devise,
    montant_ttc: montantTtc,
    tva,
    montant_tva: round2(tva.reduce((s, l) => s + l.montant_tva, 0)),
    mode_paiement: parsePaymentMode(o.mode_paiement),
    lignes,
    ventilation,
    part_privee: privee,
    compte_principal: principal,
    raison: str(o.raison),
    confiance,
    remarques,
    alertes,
  };
}

// ── Enregistrement ──────────────────────────────────────────────────────────

/** Ce que l'exploitante a validé dans le formulaire. */
export interface TicketDraft {
  type_piece: ExpenseDocumentType;
  fournisseur: string;
  fournisseur_adresse: string;
  fournisseur_ide: string;
  numero_piece: string;
  date: string;
  mode_paiement: ExpensePaymentMode | '';
  montant_ttc: number;
  /** TVA imprimée sur la pièce ; recalculée par part si le ticket est ventilé. */
  tva: ExpenseTvaLine[];
  ventilation: ReceiptVentilation[];
  notes: string;
}

export function ticketPartPrivee(draft: Pick<TicketDraft, 'montant_ttc' | 'ventilation'>): number {
  return round2(draft.montant_ttc - draft.ventilation.reduce((s, v) => s + (Number(v.montant_ttc) || 0), 0));
}

/** Message d'erreur à afficher, ou `null` si le ticket peut être enregistré. */
export function validateTicketDraft(draft: TicketDraft, codes: string[]): string | null {
  if (!draft.fournisseur.trim()) return 'Indiquez le fournisseur.';
  if (!parseIsoDate(draft.date)) return 'Indiquez la date de la pièce.';
  if (!(draft.montant_ttc > 0)) return 'Indiquez le montant total payé.';
  if (draft.ventilation.length === 0) return 'Imputez au moins une part du ticket à un compte.';
  for (const v of draft.ventilation) {
    if (!codes.includes(v.compte)) return 'Choisissez un compte pour chaque part.';
    if (!(v.montant_ttc > 0)) return 'Chaque part doit avoir un montant positif.';
  }
  if (ticketPartPrivee(draft) < -0.005) {
    return 'Les parts dépassent le total payé : corrigez les montants.';
  }
  return null;
}

export type TicketExpenseRow = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'category' | 'items'>;

/** Pièce déposée : `gdrive:<id>` + lien Drive, ou chemin du coffre privé (sans lien). */
export interface TicketJustificatif {
  path: string;
  url: string | null;
}

/**
 * Une dépense par part du ticket, toutes rattachées à la même photo. Une pièce
 * imputée à un seul compte garde la TVA exacte de son récapitulatif ; une pièce
 * ventilée recalcule la TVA de chaque part à son taux.
 */
export function buildTicketExpenseRows(
  draft: TicketDraft,
  categories: Pick<ExpenseCategory, 'id' | 'code'>[],
  justificatif: TicketJustificatif | null,
  extraction: unknown,
): TicketExpenseRow[] {
  const n = draft.ventilation.length;
  const wholeTicket = n === 1 && Math.abs(ticketPartPrivee(draft)) < 0.005;
  const privee = ticketPartPrivee(draft);

  return draft.ventilation.map((part, i) => {
    const ttc = round2(part.montant_ttc);
    const tvaLines = wholeTicket && draft.tva.length > 0 ? draft.tva : [splitTtc(ttc, part.taux_tva)];
    const montantTva = round2(tvaLines.reduce((s, l) => s + l.montant_tva, 0));
    const notes = [
      n > 1 ? `Ticket ventilé (${i + 1}/${n})` : '',
      part.libelle.trim(),
      i === 0 && privee > 0.005 ? `Part privée non comptabilisée : CHF ${privee.toFixed(2)}` : '',
      draft.notes.trim(),
    ].filter(Boolean).join(' — ');

    return {
      fournisseur: draft.fournisseur.trim(),
      fournisseur_adresse: draft.fournisseur_adresse.trim() || null,
      fournisseur_ide: draft.fournisseur_ide.trim() || null,
      numero_facture: draft.numero_piece.trim() || null,
      type_piece: draft.type_piece,
      date_facture: draft.date,
      date_echeance: null,
      // Un ticket de caisse est réglé sur place.
      date_paiement: draft.date,
      statut: 'payee',
      mode_paiement: draft.mode_paiement || null,
      montant_ttc: ttc,
      montant_tva: montantTva,
      montant_ht: round2(ttc - montantTva),
      taux_tva: tvaLines.length === 1 ? tvaLines[0].taux : (tvaLines[0]?.taux ?? 0),
      tva_details: tvaLines,
      category_id: categories.find((c) => c.code === part.compte)?.id ?? null,
      notes: notes || null,
      document_url: justificatif?.url ?? null,
      justificatif_path: justificatif?.path ?? null,
      extraction_ia: extraction ?? null,
      is_stock_invoice: false,
    };
  });
}
