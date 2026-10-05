/**
 * Accès Supabase des offres du moment, depuis l'admin et la caisse (session
 * connectée, RLS `authenticated`). Le site public et la réservation en ligne
 * passent par `offersServer.ts`, côté serveur.
 */
import { supabase } from './supabase';
import type { Offer, OfferInput, OfferStats } from '../types/offers';
import { isDescriptionEmpty, isOfferInPeriod, offerDescriptionHtml } from '../types/offers';

function normalize(row: Record<string, unknown>): Offer {
  return {
    ...(row as unknown as Offer),
    prix_chf: Number(row.prix_chf) || 0,
    prix_normal_chf: row.prix_normal_chf == null ? null : Number(row.prix_normal_chf),
    duree_minutes: Number(row.duree_minutes) || 60,
    places_max: row.places_max == null ? null : Number(row.places_max),
    reservable_en_ligne: row.reservable_en_ligne !== false,
    active: row.active !== false,
  };
}

function clean(input: OfferInput): Record<string, unknown> {
  return {
    titre: input.titre.trim(),
    // HTML de l'éditeur, nettoyé avant d'être stocké ; un éditeur vide donne `null`.
    description: isDescriptionEmpty(input.description) ? null : offerDescriptionHtml(input.description),
    prix_chf: Math.round(input.prix_chf * 100) / 100,
    prix_normal_chf: input.prix_normal_chf == null ? null : Math.round(input.prix_normal_chf * 100) / 100,
    duree_minutes: input.duree_minutes,
    conditions: input.conditions?.trim() || null,
    image_url: input.image_url?.trim() || null,
    date_debut: input.date_debut,
    date_fin: input.date_fin,
    places_max: input.places_max,
    reservable_en_ligne: input.reservable_en_ligne,
    active: input.active,
  };
}

export async function listOffers(): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('monthly_offers')
    .select('*')
    .order('date_debut', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalize);
}

/** Compteurs par offre (vue `monthly_offer_stats`). */
export async function listOfferStats(): Promise<Map<string, OfferStats>> {
  const { data, error } = await supabase.from('monthly_offer_stats').select('*');
  if (error) throw new Error(error.message);
  const map = new Map<string, OfferStats>();
  for (const r of data ?? []) {
    map.set(r.offer_id, {
      offer_id: r.offer_id,
      reservations_en_cours: Number(r.reservations_en_cours) || 0,
      reservations_total: Number(r.reservations_total) || 0,
      facturations: Number(r.facturations) || 0,
    });
  }
  return map;
}

/** Offres valables aujourd'hui (caisse), avec leurs compteurs. Une offre complète y figure encore. */
export async function listCurrentOffers(today: string): Promise<{ offers: Offer[]; stats: Map<string, OfferStats> }> {
  const { data, error } = await supabase
    .from('monthly_offers')
    .select('*')
    .eq('active', true)
    .is('archived_at', null)
    .lte('date_debut', today)
    .gte('date_fin', today)
    .order('date_fin', { ascending: true });
  if (error) throw new Error(error.message);
  const offers = (data ?? []).map(normalize).filter((o) => isOfferInPeriod(o, today));
  const stats = offers.length ? await listOfferStats().catch(() => new Map<string, OfferStats>()) : new Map<string, OfferStats>();
  return { offers, stats };
}

export async function createOffer(input: OfferInput): Promise<Offer> {
  const { data, error } = await supabase.from('monthly_offers').insert(clean(input)).select().single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function updateOffer(id: string, input: OfferInput): Promise<Offer> {
  const { data, error } = await supabase
    .from('monthly_offers')
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function setOfferArchived(id: string, archived: boolean): Promise<Offer> {
  const { data, error } = await supabase
    .from('monthly_offers')
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return normalize(data);
}

/**
 * Suppression réservée aux offres jamais utilisées. La base refuse de toute
 * façon d'effacer une offre facturée (clé étrangère RESTRICT) ; on vérifie
 * aussi les réservations, que la clé laisserait orphelines.
 */
export async function deleteOffer(id: string): Promise<void> {
  const [{ count: nbResa, error: e1 }, { count: nbFact, error: e2 }] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('offer_of_month_id', id),
    supabase.from('transaction_items').select('id', { count: 'exact', head: true }).eq('offer_id', id),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  if ((nbResa ?? 0) > 0 || (nbFact ?? 0) > 0) {
    throw new Error('Cette offre a déjà des réservations ou des factures : archivez-la pour garder son historique.');
  }
  const { error } = await supabase.from('monthly_offers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
