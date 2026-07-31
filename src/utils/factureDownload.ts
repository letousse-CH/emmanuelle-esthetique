import { supabase } from '../services/supabase';

/**
 * Télécharge un PDF de caisse (quittance ou bon cadeau).
 *
 * Les routes sont protégées par le token Supabase, qu'un `<a href>` ne peut pas
 * porter : on récupère donc le PDF en fetch puis on déclenche le téléchargement
 * depuis un blob (même approche que les exports CSV de l'admin).
 */
async function downloadPdf(url: string, filename: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Génération du PDF impossible (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

export function downloadFacture(transactionId: string, numero: string): Promise<void> {
  return downloadPdf(`/api/caisse/facture/${transactionId}`, `${numero}.pdf`);
}

export function downloadBonCadeau(giftCardId: string, code: string): Promise<void> {
  return downloadPdf(`/api/caisse/bon/${giftCardId}`, `${code}.pdf`);
}
