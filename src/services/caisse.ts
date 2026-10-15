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
  CartLine, Client, ClientStats, ForfaitItem, GiftCard, ModePaiement,
  Product, Service, ServiceCategory, StockMovement, Transaction, TransactionWithItems,
} from '../types/caisse';
import { remiseLabel } from '../types/caisse';

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

export type ClientInput = Pick<
  Client,
  'nom' | 'prenom' | 'telephone' | 'email' | 'notes' | 'date_naissance'
  | 'consent_email' | 'consent_whatsapp' | 'consent_source'
>;

// `consent_at` est absent volontairement : il est posé et effacé par le trigger
// `clients_consent_stamp`, pour qu'une fiche ne puisse jamais garder la date
// d'un accord qu'elle n'a plus.

/** Partiel à dessein : la caisse crée une fiche minimale en pleine vente (nom
 *  et téléphone), le reste garde ses valeurs par défaut — dont les deux
 *  consentements à `false`, qui ne s'accordent jamais par omission. */
export async function createClient(input: Partial<ClientInput> & Pick<Client, 'nom'>): Promise<Client> {
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

/**
 * Chiffres « nationaux » d'un numéro, pour comparer `079 123`, `+41 79 123 45 67`
 * et `0041791234567` : indicatif 41 et 0 initial retirés.
 */
function nationalDigits(raw: string): string {
  const t = (raw ?? '').trim();
  let d = t.replace(/\D/g, '');
  if (t.startsWith('+') || t.startsWith('00')) {
    if (t.startsWith('00')) d = d.slice(2);
    if (d.startsWith('41')) d = d.slice(2);
  } else if (!d.startsWith('0') && d.startsWith('41') && d.length >= 11) {
    d = d.slice(2);
  }
  return d.replace(/^0+/, '');
}

/** Filtre local sur nom, prénom ou téléphone — utilisé par la barre de recherche. */
export function matchClient(c: Client, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  // Téléphone : comparé sur les chiffres nationaux des deux côtés (« 079 123 » trouve « +41 79 123 45 67 »).
  const phone = nationalDigits(c.telephone ?? '');
  const qPhone = nationalDigits(term);
  const looksLikePhone = /^[\d\s+.\-/()]+$/.test(term.trim());
  return (
    `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
    `${c.nom} ${c.prenom}`.toLowerCase().includes(q) ||
    (c.email ?? '').toLowerCase().includes(q) ||
    (looksLikePhone && qPhone.length >= 2 && phone.includes(qPhone))
  );
}

/**
 * Agrégats par cliente (vue `client_stats`) : nombre de visites, dernière
 * visite, total encaissé. Retourné en `Map` — tous les appelants (segments,
 * fiche cliente, relances) cherchent par identifiant.
 */
export async function listClientStats(): Promise<Map<string, ClientStats>> {
  const { data, error } = await supabase.from('client_stats').select('*').limit(5000);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map(r => [(r as ClientStats).client_id, r as ClientStats]));
}

/** Historique de passage d'une cliente — factures et leur détail. */
export async function listClientTransactions(clientId: string): Promise<TransactionWithItems[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map(t => ({
    ...(t as TransactionWithItems),
    transaction_items: [...((t as TransactionWithItems).transaction_items ?? [])]
      .sort((a, b) => a.ordre - b.ordre),
  }));
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

export type ServiceInput = Pick<
  Service,
  'nom' | 'description' | 'prix_chf' | 'taux_tva_defaut' | 'active' | 'ordre' | 'category_id' | 'type'
>;

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

/**
 * Supprime une prestation du catalogue.
 *
 * Refuse si elle compose encore un forfait : la laisser partir viderait ce
 * forfait en silence, et son prix groupé ne correspondrait plus à rien. La base
 * l'interdit déjà (`ON DELETE RESTRICT`), mais elle répondrait par une erreur
 * de clé étrangère — on préfère nommer le forfait fautif.
 */
export async function deleteService(id: string): Promise<void> {
  const { data: used, error: usedError } = await supabase
    .from('service_forfait_items')
    .select('forfait_id')
    .eq('service_id', id);
  if (usedError) throw new Error(usedError.message);

  if ((used ?? []).length > 0) {
    const ids = [...new Set((used as { forfait_id: string }[]).map(u => u.forfait_id))];
    const { data: forfaits } = await supabase.from('services').select('nom').in('id', ids);
    const noms = (forfaits ?? []).map(f => `« ${(f as { nom: string }).nom} »`).join(', ');
    throw new Error(
      `Cette prestation compose ${ids.length > 1 ? 'les forfaits' : 'le forfait'} ${noms || 'un forfait'}. `
      + 'Retire-la d\'abord de sa composition, ou masque-la au lieu de la supprimer.',
    );
  }

  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Catégories de prestations ───────────────────────────────────────────────

export async function listServiceCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCategory[];
}

export type ServiceCategoryInput = Pick<ServiceCategory, 'nom' | 'ordre' | 'active'>;

export async function createServiceCategory(input: ServiceCategoryInput): Promise<ServiceCategory> {
  const { data, error } = await supabase
    .from('service_categories')
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceCategory;
}

export async function updateServiceCategory(id: string, input: Partial<ServiceCategoryInput>): Promise<ServiceCategory> {
  const { data, error } = await supabase
    .from('service_categories')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceCategory;
}

/** Supprimer une catégorie ne supprime rien d'autre : ses prestations
 *  retombent en « Sans catégorie » (`ON DELETE SET NULL`). */
export async function deleteServiceCategory(id: string): Promise<void> {
  const { error } = await supabase.from('service_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Composition des forfaits ────────────────────────────────────────────────

/**
 * Toutes les compositions en une requête — la page catalogue en a besoin pour
 * afficher l'économie de chaque forfait. Le rapprochement avec les fiches
 * prestations se fait côté client, qui les a déjà toutes chargées : deux
 * clés étrangères pointent ici vers `services`, et demander la jointure à
 * PostgREST obligerait à la désambiguïser par le nom de la contrainte.
 */
export async function listAllForfaitItems(): Promise<ForfaitItem[]> {
  const { data, error } = await supabase
    .from('service_forfait_items')
    .select('*')
    .order('ordre', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ForfaitItem[];
}

/**
 * Réécrit la composition d'un forfait. On vide puis on réinsère : la table est
 * purement descriptive (aucune facture n'en dépend), donc un état intermédiaire
 * vide ne peut rien casser — contrairement à ce qui vaut pour les écritures.
 */
export async function setForfaitItems(
  forfaitId: string,
  entries: { service_id: string; quantite: number }[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('service_forfait_items')
    .delete()
    .eq('forfait_id', forfaitId);
  if (delError) throw new Error(delError.message);

  if (entries.length === 0) return;

  const { error } = await supabase.from('service_forfait_items').insert(
    entries.map((e, ordre) => ({
      forfait_id: forfaitId,
      service_id: e.service_id,
      quantite: e.quantite,
      ordre,
    })),
  );
  if (error) throw new Error(error.message);
}

// ── Produits revendus & stock ──────────────────────────────────────────────
//
// Aucun repli local : une écriture que la base refuse doit le dire. Un produit
// « créé » dans le seul navigateur n'existerait pas pour la caisse (la vente
// échouerait sur sa clé étrangère) et disparaîtrait au rechargement ; un
// mouvement de stock « enregistré » localement mentirait sur l'inventaire.

export async function listProducts(includeInactive = true): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });
  if (!includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

/** Champs saisissables. `stock` n'en fait pas partie : Postgres refuse de
 *  l'écrire (privilèges colonne par colonne), il naît des mouvements. */
export type ProductInput = Pick<
  Product,
  'nom' | 'marque' | 'reference' | 'description' | 'prix_achat_chf' | 'prix_vente_chf'
  | 'taux_tva_defaut' | 'seuil_alerte' | 'active' | 'ordre'
> & {
  usage_type?: 'vente' | 'cabine' | 'consommable' | 'testeur' | 'echantillon';
  contenance?: string | null;
};

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Product;
}

/** Un produit qui a une histoire en stock est désactivé, jamais supprimé. */
export async function deleteOrArchiveProduct(id: string): Promise<'deleted' | 'archived'> {
  const { count, error: countError } = await supabase
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    await updateProduct(id, { active: false });
    return 'archived';
  }
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return 'deleted';
}

// ── Journal de stock ────────────────────────────────────────────────────────

export async function listStockMovements(productId?: string, limit = 200): Promise<StockMovement[]> {
  let query = supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (productId) query = query.eq('product_id', productId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovement[];
}

/**
 * Réception ou perte : passe par Postgres, qui signe la quantité. Une
 * réception porte la facture d'achat qui la justifie (`expenseId`) ; une vente
 * naît de la caisse, un retour cliente de la correction de sa facture.
 */
export async function stockMovement(input: {
  productId: string;
  type: 'reception' | 'perte';
  quantite: number;
  prixAchatUnitaire?: number | null;
  motif?: string | null;
  expenseId?: string | null;
}): Promise<Product> {
  const { data, error } = await supabase.rpc('caisse_stock_movement', {
    p_product_id: input.productId,
    p_type: input.type,
    p_quantite: Math.abs(Number(input.quantite || 0)),
    p_prix_achat_unitaire: input.prixAchatUnitaire ?? null,
    p_motif: input.motif ?? null,
    p_expense_id: input.type === 'reception' ? input.expenseId ?? null : null,
  });
  if (error) throw new Error(error.message);
  return data as Product;
}

/** Inventaire : on saisit ce qu'on a compté, Postgres archive l'écart. */
export async function stockInventaire(productId: string, stockReel: number, motif?: string): Promise<Product> {
  const { data, error } = await supabase.rpc('caisse_stock_inventaire', {
    p_product_id: productId,
    p_stock_reel: Math.max(0, Number(stockReel || 0)),
    p_motif: motif ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Product;
}

// ── Encaissements ───────────────────────────────────────────────────────────

export interface CreateTransactionInput {
  clientId: string | null;
  clientLabel: string;
  modePaiement: ModePaiement;
  note: string;
  lines: CartLine[];
  /** Bon présenté en paiement, et montant prélevé dessus. */
  giftCardCode?: string | null;
  montantBon?: number;
  /** Facture que cet encaissement corrige. */
  corrigeTransactionId?: string | null;
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  // `ordre` fait le lien entre une ligne du panier et le bon qu'elle émet :
  // c'est l'indice de la ligne, que Postgres retrouve pour imprimer le code du
  // bon sur la quittance. Rapprocher par montant se tromperait dès que deux
  // bons de même valeur sont vendus ensemble.
  const emissions = input.lines
    .map((l, ordre) => ({ line: l, ordre }))
    .filter(({ line }) => line.gift_card)
    .map(({ line, ordre }) => ({
      ordre,
      montant: line.prix_unitaire_ttc * line.quantite,
      libelle: line.description,
      beneficiaire: line.gift_card!.beneficiaire || null,
      validite_mois: line.gift_card!.validiteMois,
    }));

  const { data, error } = await supabase.rpc('caisse_create_transaction', {
    p_client_id: input.clientId,
    p_client_label: input.clientLabel,
    p_mode_paiement: input.modePaiement,
    p_note: input.note,
    p_items: input.lines.map(l => ({
      service_id: l.service_id,
      product_id: l.product_id ?? null,
      offer_id: l.offer_id ?? null,
      description: remiseLabel(l),
      prix_unitaire_ttc: l.prix_unitaire_ttc,
      quantite: l.quantite,
      taux_tva: l.taux_tva,
    })),
    p_gift_card_code: input.giftCardCode ?? null,
    p_montant_bon: input.montantBon ?? 0,
    p_emissions: emissions.length > 0 ? emissions : null,
    p_corrige_transaction_id: input.corrigeTransactionId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Transaction;
}

// ── Bons cadeaux ────────────────────────────────────────────────────────────

export async function listGiftCards(): Promise<GiftCard[]> {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .order('emis_le', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as GiftCard[];
}

/** Recherche par code exact, pour le champ « présenter un bon » de la caisse. */
export async function findGiftCardByCode(code: string): Promise<GiftCard | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  // Égalité exacte sur le code en majuscules (tous les codes le sont) : `ilike`
  // traiterait « _ » et « % » saisis par erreur comme des jokers.
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('code', trimmed.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GiftCard) ?? null;
}

/** Bons émis par une vente — pour afficher leur code juste après l'encaissement. */
export async function listGiftCardsForSale(transactionId: string): Promise<GiftCard[]> {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('sale_transaction_id', transactionId)
    .order('number_seq', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GiftCard[];
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

