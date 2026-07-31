import { supabase } from '../services/supabase';

/**
 * Télécharge la quittance PDF d'un encaissement.
 *
 * La route est protégée par le token Supabase, qu'un `<a href>` ne peut pas
 * porter : on récupère donc le PDF en fetch puis on déclenche le téléchargement
 * depuis un blob (même approche que les exports CSV de l'admin).
 */
export async function downloadFacture(transactionId: string, numero: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/caisse/facture/${transactionId}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `Génération du PDF impossible (HTTP ${res.status}).`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
