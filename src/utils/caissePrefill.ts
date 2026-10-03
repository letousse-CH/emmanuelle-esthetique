import type { CartLine, ModePaiement } from '../types/caisse';

/**
 * Passage de relais entre le journal et l'écran d'encaissement pour corriger
 * une erreur de caisse.
 *
 * La correction n'efface rien : la facture fautive est annulée (elle reste au
 * journal avec son numéro), puis une nouvelle est émise avec les données
 * rectifiées et un lien vers l'ancienne. C'est la seule façon légale de
 * corriger — le Code des obligations interdit de réécrire une écriture
 * (art. 957a), il exige que la correction soit visible.
 *
 * On passe par `sessionStorage` : le panier ne survit pas à la fermeture de
 * l'onglet, et il ne suit pas la cliente d'un appareil à l'autre.
 */
const KEY = 'caisse:correction';

export interface CaisseCorrection {
  corrigeTransactionId: string;
  numero: string;
  clientId: string | null;
  clientLabel: string;
  modePaiement: ModePaiement;
  note: string;
  lines: CartLine[];
}

export function setCaisseCorrection(correction: CaisseCorrection): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(correction));
  } catch {
    // Navigation privée ou quota plein : la correction se fera à la main.
  }
}

/** Lit la correction en attente **et la consomme** : un rechargement de la
 *  page ne doit pas re-remplir le panier une seconde fois. */
export function takeCaisseCorrection(): CaisseCorrection | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as CaisseCorrection;
  } catch {
    return null;
  }
}

/**
 * Brouillon de l'encaissement en cours.
 *
 * Passer à l'onglet Agenda ou Clientes démonte l'écran de caisse : sans cette
 * sauvegarde, le panier serait perdu. On garde aussi le lien vers le rendez-vous
 * en cours d'encaissement et la correction éventuelle, pour qu'un aller-retour
 * ne les détache pas silencieusement.
 *
 * Aucun montant n'est stocké en dehors des lignes du panier (qui ne sont que
 * ce que la caissière a choisi) : les totaux sont toujours recalculés, et le
 * bon cadeau est revérifié en base à la restauration.
 */
const DRAFT_KEY = 'caisse:brouillon';

export interface CaisseDraft {
  lines: CartLine[];
  clientId: string | null;
  clientLabel: string;
  mode: ModePaiement;
  note: string;
  giftCode: string | null;
  correction: { id: string; numero: string } | null;
  rdv: { id: string; label: string } | null;
}

export function saveCaisseDraft(draft: CaisseDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Navigation privée ou quota plein : le panier ne survivra pas au changement d'onglet.
  }
}

export function loadCaisseDraft(): CaisseDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<CaisseDraft>;
    if (!d || !Array.isArray(d.lines)) return null;
    return {
      lines: d.lines,
      clientId: d.clientId ?? null,
      clientLabel: d.clientLabel ?? '',
      mode: d.mode ?? 'twint',
      note: d.note ?? '',
      giftCode: d.giftCode ?? null,
      correction: d.correction ?? null,
      rdv: d.rdv ?? null,
    };
  } catch {
    return null;
  }
}

export function clearCaisseDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // rien à faire
  }
}
