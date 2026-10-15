/**
 * Facture d'achat qui fait entrer du stock : lecture par l'IA, relecture par
 * l'exploitante, contrôles avant import.
 *
 * L'IA recopie ; ces règles vérifient. Les contrôles « bloquants » sont les
 * mêmes que ceux de `stock_importer_facture` (Postgres) : l'écran les montre
 * avant l'envoi, la base les applique quoi qu'il arrive.
 */
import { refNormalisee, type Expense, type ProductUsageType } from './finance';
import type { Product } from './caisse';

export const USAGES: ProductUsageType[] = ['vente', 'cabine', 'consommable', 'testeur', 'echantillon'];

export interface LigneFactureAchat {
  reference: string | null;
  designation: string;
  quantite: number;
  /** Prix unitaire HT, avant rabais. */
  prix_unitaire: number;
  rabais_pct: number;
  taux_tva: number;
  usage_type: ProductUsageType;
  contenance: string | null;
  marque: string | null;
  /** Fiche retenue à la relecture ; `null` = nouveau produit. */
  product_id: string | null;
  /** Prix de vente TTC d'un NOUVEAU produit de revente (jamais deviné). */
  prix_vente: number | null;
}

export interface FactureAchatLue {
  fournisseur: string;
  fournisseur_adresse: string | null;
  fournisseur_ide: string | null;
  numero_facture: string;
  date_facture: string;
  date_echeance: string | null;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  taux_tva: number;
  /** Échéancier imprimé sur la facture (paiement en plusieurs fois). */
  echeances: { date: string; montant: number }[];
  lignes: LigneFactureAchat[];
  remarques: string[];
  confiance: 'haute' | 'moyenne' | 'basse';
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function nombre(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/CHF|Fr\.?|\s|'|’/gi, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function dateISO(v: unknown): string | null {
  const s = texte(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ch = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : ch ? [ch[3], ch[2].padStart(2, '0'), ch[1].padStart(2, '0')] : [];
  if (!y) return null;
  const t = new Date(`${y}-${m}-${d}T12:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== `${y}-${m}-${d}` ? null : `${y}-${m}-${d}`;
}

/** Nettoie la réponse de l'IA : rien n'est inventé, l'illisible devient vide. */
export function normalizeFactureAchat(raw: unknown): FactureAchatLue {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lignes = (Array.isArray(o.lignes) ? o.lignes : []).map((x): LigneFactureAchat => {
    const l = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const usage = String(l.usage ?? l.usage_type ?? '').toLowerCase() as ProductUsageType;
    return {
      reference: texte(l.reference),
      designation: texte(l.designation) ?? '',
      quantite: nombre(l.quantite) ?? 0,
      prix_unitaire: nombre(l.prix_unitaire_ht ?? l.prix_unitaire) ?? 0,
      rabais_pct: Math.min(100, Math.max(0, nombre(l.rabais_pct) ?? 0)),
      taux_tva: nombre(l.taux_tva) ?? 0,
      usage_type: USAGES.includes(usage) ? usage : 'vente',
      contenance: texte(l.contenance),
      marque: texte(l.marque),
      product_id: null,
      prix_vente: nombre(l.prix_public_ttc ?? l.prix_vente) ?? null,
    };
  });
  const echeances = (Array.isArray(o.echeances) ? o.echeances : [])
    .map(e => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      return { date: dateISO(x.date) ?? '', montant: nombre(x.montant) ?? 0 };
    })
    .filter(e => e.date && e.montant > 0);
  const confiance = o.confiance === 'haute' || o.confiance === 'basse' ? o.confiance : 'moyenne';
  return {
    fournisseur: texte(o.fournisseur) ?? '',
    fournisseur_adresse: texte(o.fournisseur_adresse),
    fournisseur_ide: texte(o.fournisseur_ide),
    numero_facture: texte(o.numero_facture) ?? '',
    date_facture: dateISO(o.date_facture) ?? '',
    date_echeance: dateISO(o.date_echeance),
    montant_ht: nombre(o.montant_ht) ?? 0,
    montant_tva: nombre(o.montant_tva) ?? 0,
    montant_ttc: nombre(o.montant_ttc) ?? 0,
    taux_tva: nombre(o.taux_tva) ?? 0,
    echeances,
    lignes,
    remarques: (Array.isArray(o.remarques) ? o.remarques : []).map(texte).filter((r): r is string => !!r),
    confiance,
  };
}

/** Total HT d'une ligne, rabais déduit — au centime, comme Postgres. */
export function totalLigneHT(l: Pick<LigneFactureAchat, 'quantite' | 'prix_unitaire' | 'rabais_pct'>): number {
  return r2(Number(l.quantite) * Number(l.prix_unitaire) * (1 - Number(l.rabais_pct || 0) / 100));
}

/** Coût d'achat unitaire HT, rabais déduit. */
export function coutUnitaireHT(l: Pick<LigneFactureAchat, 'prix_unitaire' | 'rabais_pct'>): number {
  return r2(Number(l.prix_unitaire) * (1 - Number(l.rabais_pct || 0) / 100));
}

/** Fiche existante pour une ligne : même référence (normalisée), sinon même nom. Comme Postgres. */
export function trouverFiche<P extends Pick<Product, 'id' | 'nom' | 'reference' | 'active'>>(
  l: Pick<LigneFactureAchat, 'reference' | 'designation'>,
  products: P[],
): P | null {
  const ref = refNormalisee(l.reference);
  const actifsDabord = [...products].sort((a, b) => Number(b.active) - Number(a.active));
  if (ref) {
    const parRef = actifsDabord.find(p => refNormalisee(p.reference) === ref);
    if (parRef) return parRef;
  }
  const nom = l.designation.trim().toLowerCase();
  return actifsDabord.find(p => p.nom.trim().toLowerCase() === nom) ?? null;
}

export interface ControleFacture {
  bloquants: string[];
  avertissements: string[];
  sommeLignes: number;
  /** Écart entre le total des lignes et le HT de la facture (positif : lignes au-dessus). */
  ecart: number;
}

/**
 * Tout ce qui empêche l'import (bloquants, mêmes règles que Postgres) et ce qui
 * mérite un second regard (avertissements).
 */
export function controlerFactureAchat(
  f: FactureAchatLue,
  opts: {
    today: string;
    ecartJustifie: boolean;
    categorieCode: string | null;
    existantes: Pick<Expense, 'fournisseur' | 'numero_facture' | 'statut' | 'date_facture'>[];
  },
): ControleFacture {
  const bloquants: string[] = [];
  const avertissements: string[] = [];

  if (!f.fournisseur.trim()) bloquants.push('Fournisseur manquant.');
  if (!f.numero_facture.trim()) bloquants.push('N° de facture manquant : c\'est lui qui empêche un second import.');
  if (!f.date_facture) bloquants.push('Date de facture manquante.');
  else if (f.date_facture > opts.today) bloquants.push('Date de facture dans le futur : sans doute une erreur de lecture.');
  if (!(f.montant_ttc > 0)) bloquants.push('Montant TTC manquant.');
  if (Math.abs(f.montant_ht + f.montant_tva - f.montant_ttc) > 0.05) {
    bloquants.push(`HT (${f.montant_ht.toFixed(2)}) + TVA (${f.montant_tva.toFixed(2)}) ne donnent pas le TTC (${f.montant_ttc.toFixed(2)}).`);
  }
  if (!opts.categorieCode || !opts.categorieCode.startsWith('4')) {
    bloquants.push('Choisissez un compte d\'achat (4000, 4200 ou 4400).');
  }

  const doublon = opts.existantes.find(e => e.statut !== 'annulee'
    && e.fournisseur.trim().toLowerCase() === f.fournisseur.trim().toLowerCase()
    && (e.numero_facture ?? '').trim() === f.numero_facture.trim() && f.numero_facture.trim() !== '');
  if (doublon) {
    bloquants.push(`Cette facture est déjà enregistrée (facture du ${doublon.date_facture.split('-').reverse().join('.')}) : un second import doublerait le stock.`);
  }

  if (f.lignes.length === 0) bloquants.push('Aucune ligne d\'article.');
  f.lignes.forEach((l, i) => {
    const n = `Ligne ${i + 1}${l.designation ? ` (${l.designation})` : ''}`;
    if (!l.designation.trim()) bloquants.push(`${n} : désignation manquante.`);
    if (!(l.quantite > 0)) bloquants.push(`${n} : quantité invalide.`);
    if (!(l.prix_unitaire >= 0)) bloquants.push(`${n} : prix unitaire invalide.`);
    if (!l.product_id && l.usage_type === 'vente' && !(Number(l.prix_vente) > 0)) {
      bloquants.push(`${n} : nouveau produit de revente — indiquez son prix de vente.`);
    }
    if (l.rabais_pct === 100) avertissements.push(`${n} : article offert (rabais 100 %), entre en stock à CHF 0.`);
    if (!l.product_id && l.usage_type === 'vente' && Number(l.prix_vente) > 0
        && Number(l.prix_vente) <= coutUnitaireHT(l) * (1 + Number(l.taux_tva || 0) / 100)) {
      avertissements.push(`${n} : le prix de vente ne couvre pas le coût d'achat.`);
    }
  });

  const sommeLignes = r2(f.lignes.reduce((s, l) => s + totalLigneHT(l), 0));
  const ecart = r2(sommeLignes - f.montant_ht);
  if (Math.abs(ecart) > 0.05 && !opts.ecartJustifie) {
    bloquants.push(`Les lignes totalisent CHF ${sommeLignes.toFixed(2)} HT, la facture CHF ${f.montant_ht.toFixed(2)} HT : corrigez la lecture, ou cochez « écart justifié » (frais de port…).`);
  }

  if (f.confiance === 'basse') avertissements.push('Lecture incertaine : relisez chaque ligne avec la facture sous les yeux.');
  for (const r of f.remarques) avertissements.push(r);
  const totalEcheances = r2(f.echeances.reduce((s, e) => s + e.montant, 0));
  if (f.echeances.length > 0 && Math.abs(totalEcheances - f.montant_ttc) > 0.05) {
    avertissements.push(`L'échéancier lu (CHF ${totalEcheances.toFixed(2)}) ne fait pas le total TTC : vérifiez-le avant de le créer.`);
  }

  return { bloquants, avertissements, sommeLignes, ecart };
}
