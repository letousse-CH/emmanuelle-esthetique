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
