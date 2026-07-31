/**
 * Accès Supabase du module Caisse.
 *
 * Les lectures et la gestion clientèle/catalogue passent par le client anon +
 * RLS `authenticated`, comme le reste de l'admin. En revanche, **créer** ou
 * **annuler** un encaissement passe obligatoirement par une fonction Postgres :
 * c'est elle qui alloue le numéro de facture sans trou et qui calcule les
 * totaux — le navigateur n'a pas le droit d'écrire un montant.
 */
import { supabase } from './supabase';
import type {
  CartLine, Client, ModePaiement, Service, Transaction, TransactionWithItems,
} from '../types/caisse';

// ── Clientèle ───────────────────────────────────────────────────────────────

export async function listClients(includeArchived = false): Promise<Client[]> {
  let query = supabase
    .from('clients')
    .select('*')
    .order('nom', { ascending: true })
    .order('prenom', { ascending: true })
    .limit(2000);
  if (!includeArchived) query = query.eq('archived', false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export type ClientInput = Pick<Client, 'nom' | 'prenom' | 'telephone' | 'email' | 'notes'>;

export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function updateClient(id: string, input: Partial<ClientInput> & { archived?: boolean }): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}

/**
 * Supprime une fiche cliente, ou l'archive si elle est citée sur une facture :
 * les pièces comptables doivent rester lisibles 10 ans (CO art. 958f).
 * Retourne ce qui a réellement été fait, pour que l'UI le dise à l'utilisateur.
 */
export async function deleteOrArchiveClient(id: string): Promise<'deleted' | 'archived'> {
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    await updateClient(id, { archived: true });
    return 'archived';
  }
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return 'deleted';
}

/** Filtre local sur nom, prénom ou téléphone — utilisé par la barre de recherche. */
export function matchClient(c: Client, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const phone = (c.telephone ?? '').replace(/[\s.\-/()]/g, '');
  const qPhone = q.replace(/[\s.\-/()]/g, '');
  return (
    `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
    `${c.nom} ${c.prenom}`.toLowerCase().includes(q) ||
    (c.email ?? '').toLowerCase().includes(q) ||
    (qPhone.length >= 2 && phone.includes(qPhone))
  );
}

// ── Catalogue de prestations ────────────────────────────────────────────────

export async function listServices(includeInactive = true): Promise<Service[]> {
  let query = supabase
    .from('services')
    .select('*')
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Service[];
}

export type ServiceInput = Pick<Service, 'nom' | 'description' | 'prix_chf' | 'taux_tva_defaut' | 'active' | 'ordre'>;

export async function createService(input: ServiceInput): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Service;
}

export async function updateService(id: string, input: Partial<ServiceInput>): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Service;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Encaissements ───────────────────────────────────────────────────────────

export interface CreateTransactionInput {
  clientId: string | null;
  clientLabel: string;
  modePaiement: ModePaiement;
  note: string;
  lines: CartLine[];
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const { data, error } = await supabase.rpc('caisse_create_transaction', {
    p_client_id: input.clientId,
    p_client_label: input.clientLabel,
    p_mode_paiement: input.modePaiement,
    p_note: input.note,
    p_items: input.lines.map(l => ({
      service_id: l.service_id,
      description: l.description,
      prix_unitaire_ttc: l.prix_unitaire_ttc,
      quantite: l.quantite,
      taux_tva: l.taux_tva,
    })),
  });
  if (error) throw new Error(error.message);
  return data as Transaction;
}

export async function cancelTransaction(id: string, reason: string): Promise<Transaction> {
  const { data, error } = await supabase.rpc('caisse_cancel_transaction', {
    p_id: id,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as Transaction;
}

/**
 * Journal des recettes sur une période. `from`/`to` sont des instants ISO —
 * l'appelant les construit à partir de dates locales (heure suisse) pour que
 * « juillet » couvre bien le 1ᵉʳ 00:00 au 31 23:59 vécus à l'institut.
 */
export async function listTransactions(from: string, to: string): Promise<TransactionWithItems[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map(t => ({
    ...(t as TransactionWithItems),
    transaction_items: [...((t as TransactionWithItems).transaction_items ?? [])]
      .sort((a, b) => a.ordre - b.ordre),
  }));
}

export async function getTransaction(id: string): Promise<TransactionWithItems | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const tx = data as TransactionWithItems;
  tx.transaction_items = [...(tx.transaction_items ?? [])].sort((a, b) => a.ordre - b.ordre);
  return tx;
}
