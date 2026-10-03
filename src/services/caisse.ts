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

// ── Produits revendus & Stock Local Fallback ───────────────────────────────

const STORAGE_PRODUCTS_KEY = 'emmanuelle_caisse_products_v1';
const STORAGE_MOVEMENTS_KEY = 'emmanuelle_caisse_movements_v1';

const DEFAULT_INITIAL_PRODUCTS: Product[] = [
  // Produits boutique (vente) existants
  {
    id: 'prod-phytomer-100119',
    nom: 'Rosée Visage - Gelée Nettoyante - 150 ml',
    marque: 'Phytomer',
    reference: '100119',
    description: 'Gelée nettoyante démaquillante visage à l’eau florale d’ajonc',
    prix_achat_chf: 17.25,
    prix_vente_chf: 38.00,
    taux_tva_defaut: 8.1,
    stock: 3, // Stock actuel avant réception
    seuil_alerte: 2,
    active: true,
    ordre: 1,
    usage_type: 'vente',
    contenance: '150 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'prod-phytomer-100100',
    nom: 'Perfect Visage - Lait Démaquillant Douceur - 250 ml',
    marque: 'Phytomer',
    reference: '100100',
    description: 'Lait démaquillant fondant confort',
    prix_achat_chf: 16.70,
    prix_vente_chf: 36.50,
    taux_tva_defaut: 8.1,
    stock: 2, // Stock actuel
    seuil_alerte: 2,
    active: true,
    ordre: 2,
    usage_type: 'vente',
    contenance: '250 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'prod-phytomer-100101',
    nom: 'Rosée Visage - Lotion Démaquillante - 250 ml',
    marque: 'Phytomer',
    reference: '100101',
    description: 'Lotion tonique florale sans alcool',
    prix_achat_chf: 16.70,
    prix_vente_chf: 36.50,
    taux_tva_defaut: 8.1,
    stock: 1, // Stock actuel
    seuil_alerte: 2,
    active: true,
    ordre: 3,
    usage_type: 'vente',
    contenance: '250 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'prod-phytomer-100118',
    nom: 'Scrub Marin - Crème de Gommage - 50 ml',
    marque: 'Phytomer',
    reference: '100118',
    description: 'Gommage exfoliant doux grains naturels',
    prix_achat_chf: 24.50,
    prix_vente_chf: 52.00,
    taux_tva_defaut: 8.1,
    stock: 4, // Stock actuel
    seuil_alerte: 2,
    active: true,
    ordre: 4,
    usage_type: 'vente',
    contenance: '50 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },

  // Produits cabine existants
  {
    id: 'prod-phytomer-113060',
    nom: 'Crème Nettoyante Démaquillante Cabine - 500 ml',
    marque: 'Phytomer',
    reference: '113060',
    description: 'Grand format professionnel cabine pour le démaquillage des soins',
    prix_achat_chf: 31.90,
    prix_vente_chf: 0,
    taux_tva_defaut: 8.1,
    stock: 1, // Stock actuel en cabine
    seuil_alerte: 1,
    active: true,
    ordre: 10,
    usage_type: 'cabine',
    contenance: '500 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'prod-phytomer-113061',
    nom: 'Lotion Démaquillante Tonique Cabine - 1000 ml',
    marque: 'Phytomer',
    reference: '113061',
    description: 'Flacon cabine 1 litre pour lotion tonique préparatoire',
    prix_achat_chf: 38.40,
    prix_vente_chf: 0,
    taux_tva_defaut: 8.1,
    stock: 2, // Stock actuel en cabine
    seuil_alerte: 1,
    active: true,
    ordre: 11,
    usage_type: 'cabine',
    contenance: '1000 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'prod-phytomer-110050',
    nom: 'Peeling Végétal Cabine - 150 ml',
    marque: 'Phytomer',
    reference: '110050',
    description: 'Exfoliant enzymatique professionnel cabine',
    prix_achat_chf: 28.50,
    prix_vente_chf: 0,
    taux_tva_defaut: 8.1,
    stock: 1, // Stock actuel en cabine
    seuil_alerte: 1,
    active: true,
    ordre: 12,
    usage_type: 'cabine',
    contenance: '150 ml',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },

  // Consommable existant
  {
    id: 'prod-phytomer-119047',
    nom: 'Drap d’Examen Gaufré Blanc 50x38 - Carton 9 Rlx',
    marque: 'Phytomer',
    reference: '119047',
    description: 'Protection hygiénique de la table de soin',
    prix_achat_chf: 49.90,
    prix_vente_chf: 0,
    taux_tva_defaut: 8.1,
    stock: 2, // Stock actuel
    seuil_alerte: 1,
    active: true,
    ordre: 20,
    usage_type: 'consommable',
    contenance: 'Carton 9 rlx',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
];

function getLocalProducts(): Product[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_PRODUCTS;
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(DEFAULT_INITIAL_PRODUCTS));
      return DEFAULT_INITIAL_PRODUCTS;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : DEFAULT_INITIAL_PRODUCTS;
  } catch {
    return DEFAULT_INITIAL_PRODUCTS;
  }
}

function saveLocalProducts(list: Product[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Erreur sauvegarde localStorage produits:', e);
  }
}

function getLocalMovements(): StockMovement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_MOVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMovements(list: StockMovement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MOVEMENTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Erreur sauvegarde localStorage mouvements:', e);
  }
}

export async function listProducts(includeInactive = true): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .order('ordre', { ascending: true })
      .order('nom', { ascending: true });
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      saveLocalProducts(data as Product[]);
      return data as Product[];
    }
  } catch {
    // Mode local déconnecté
  }

  const local = getLocalProducts();
  return includeInactive ? local : local.filter(p => p.active);
}

export type ProductInput = Pick<
  Product,
  'nom' | 'marque' | 'reference' | 'description' | 'prix_achat_chf' | 'prix_vente_chf'
  | 'taux_tva_defaut' | 'seuil_alerte' | 'active' | 'ordre'
> & {
  usage_type?: 'vente' | 'cabine' | 'consommable' | 'testeur' | 'echantillon';
  contenance?: string | null;
  stock?: number;
};

export async function createProduct(input: ProductInput): Promise<Product> {
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `prod-${Date.now()}`;
  const now = new Date().toISOString();
  const initialStock = Number(input.stock || 0);

  const newProduct: Product = {
    id: newId,
    nom: input.nom,
    marque: input.marque ?? null,
    reference: input.reference ?? null,
    description: input.description ?? null,
    prix_achat_chf: Number(input.prix_achat_chf || 0),
    prix_vente_chf: Number(input.prix_vente_chf || 0),
    taux_tva_defaut: Number(input.taux_tva_defaut || 0),
    stock: initialStock,
    seuil_alerte: Number(input.seuil_alerte || 0),
    active: input.active ?? true,
    ordre: Number(input.ordre || 0),
    usage_type: input.usage_type || 'vente',
    contenance: input.contenance ?? null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...input,
        stock: initialStock,
        updated_at: now,
      })
      .select()
      .single();

    if (!error && data) {
      newProduct.id = data.id;
    }
  } catch {
    // Mode local
  }

  const local = getLocalProducts();
  saveLocalProducts([...local, newProduct]);
  return newProduct;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const now = new Date().toISOString();
  let updatedProduct: Product | null = null;

  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...input, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      updatedProduct = data as Product;
    }
  } catch {
    // Mode local
  }

  const local = getLocalProducts();
  const next = local.map(p => {
    if (p.id === id) {
      const merged: Product = {
        ...p,
        ...input,
        stock: input.stock !== undefined ? Number(input.stock) : p.stock,
        updated_at: now,
      };
      if (!updatedProduct) updatedProduct = merged;
      return merged;
    }
    return p;
  });
  saveLocalProducts(next);

  if (!updatedProduct) {
    throw new Error('Produit introuvable');
  }
  return updatedProduct;
}

export async function deleteOrArchiveProduct(id: string): Promise<'deleted' | 'archived'> {
  let hasMovements = false;
  try {
    const { count } = await supabase
      .from('stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);
    if ((count ?? 0) > 0) hasMovements = true;
  } catch {
    const movements = getLocalMovements();
    hasMovements = movements.some(m => m.product_id === id);
  }

  if (hasMovements) {
    await updateProduct(id, { active: false });
    return 'archived';
  }

  try {
    await supabase.from('products').delete().eq('id', id);
  } catch {
    // Mode local
  }

  const local = getLocalProducts();
  saveLocalProducts(local.filter(p => p.id !== id));
  return 'deleted';
}

// ── Journal de stock ────────────────────────────────────────────────────────

export async function listStockMovements(productId?: string, limit = 200): Promise<StockMovement[]> {
  try {
    let query = supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (productId) query = query.eq('product_id', productId);
    const { data, error } = await query;
    if (!error && data) return data as StockMovement[];
  } catch {
    // Mode local
  }

  let list = getLocalMovements();
  if (productId) list = list.filter(m => m.product_id === productId);
  return list.slice(0, limit);
}

export async function stockMovement(input: {
  productId: string;
  type: 'reception' | 'retour' | 'perte';
  quantite: number;
  prixAchatUnitaire?: number | null;
  motif?: string | null;
}): Promise<Product> {
  const quantite = Math.abs(Number(input.quantite || 0));
  const signe = input.type === 'perte' ? -1 : 1;

  try {
    const { data, error } = await supabase.rpc('caisse_stock_movement', {
      p_product_id: input.productId,
      p_type: input.type,
      p_quantite: quantite,
      p_prix_achat_unitaire: input.prixAchatUnitaire ?? null,
      p_motif: input.motif ?? null,
    });
    if (!error && data) {
      // Met à jour le cache local
      const local = getLocalProducts();
      saveLocalProducts(local.map(p => p.id === input.productId ? (data as Product) : p));
      return data as Product;
    }
  } catch {
    // Fallback local
  }

  // Fallback local direct
  const local = getLocalProducts();
  const target = local.find(p => p.id === input.productId);
  if (!target) throw new Error('Produit introuvable.');

  const nextStock = Math.max(0, Number(target.stock || 0) + signe * quantite);
  const updated: Product = {
    ...target,
    stock: nextStock,
    prix_achat_chf: (input.type === 'reception' && input.prixAchatUnitaire) ? input.prixAchatUnitaire : target.prix_achat_chf,
    updated_at: new Date().toISOString(),
  };

  saveLocalProducts(local.map(p => p.id === input.productId ? updated : p));

  // Archivage mouvement local
  const newMovement: StockMovement = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mov-${Date.now()}`,
    product_id: input.productId,
    type: input.type,
    quantite: signe * quantite,
    prix_achat_unitaire: input.type === 'reception' ? (input.prixAchatUnitaire ?? null) : null,
    transaction_id: null,
    motif: input.motif ?? null,
    created_at: new Date().toISOString(),
  };
  saveLocalMovements([newMovement, ...getLocalMovements()]);

  return updated;
}

export async function stockInventaire(productId: string, stockReel: number, motif?: string): Promise<Product> {
  const stockFinal = Math.max(0, Number(stockReel || 0));

  try {
    const { data, error } = await supabase.rpc('caisse_stock_inventaire', {
      p_product_id: productId,
      p_stock_reel: stockFinal,
      p_motif: motif ?? null,
    });
    if (!error && data) {
      const local = getLocalProducts();
      saveLocalProducts(local.map(p => p.id === productId ? (data as Product) : p));
      return data as Product;
    }
  } catch {
    // Fallback local
  }

  const local = getLocalProducts();
  const target = local.find(p => p.id === productId);
  if (!target) throw new Error('Produit introuvable.');

  const ecart = stockFinal - Number(target.stock || 0);
  const updated: Product = {
    ...target,
    stock: stockFinal,
    updated_at: new Date().toISOString(),
  };
  saveLocalProducts(local.map(p => p.id === productId ? updated : p));

  if (ecart !== 0) {
    const newMovement: StockMovement = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mov-${Date.now()}`,
      product_id: productId,
      type: 'inventaire',
      quantite: ecart,
      prix_achat_unitaire: target.prix_achat_chf,
      transaction_id: null,
      motif: motif || `Inventaire physique (${stockFinal})`,
      created_at: new Date().toISOString(),
    };
    saveLocalMovements([newMovement, ...getLocalMovements()]);
  }

  return updated;
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
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .ilike('code', trimmed)
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

