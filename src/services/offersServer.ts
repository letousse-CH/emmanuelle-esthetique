/**
 * Offres du moment côté SERVEUR : site public (bloc « Offre du moment »),
 * formulaire de réservation, création de réservation et catalogue de l'agenda.
 *
 * Les compteurs se lisent avec la clé de service : la vue `monthly_offer_stats`
 * n'est pas accessible au rôle `anon`. Sans clé de service, le site affiche
 * l'offre sans compteur ; la réservation, elle, échoue en 503 (fail-closed).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { zurichNow } from './bookingEngine';
import type { Offer, OfferStats, PublicOffer } from '../types/offers';
import { EMPTY_STATS, isOfferInPeriod, placesRestantes } from '../types/offers';

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

export function toPublicOffer(o: Offer, restantes: number | null): PublicOffer {
  return {
    id: o.id,
    titre: o.titre,
    description: o.description,
    prix_chf: o.prix_chf,
    prix_normal_chf: o.prix_normal_chf,
    duree_minutes: o.duree_minutes,
    conditions: o.conditions,
    image_url: o.image_url,
    date_debut: o.date_debut,
    date_fin: o.date_fin,
    places_max: o.places_max,
    places_restantes: restantes,
    reservable_en_ligne: o.reservable_en_ligne,
  };
}

/** Compteurs d'une liste d'offres. Lève une erreur si la base ne répond pas. */
export async function fetchOfferStats(db: SupabaseClient, ids: string[]): Promise<Map<string, OfferStats>> {
  const map = new Map<string, OfferStats>();
  if (ids.length === 0) return map;
  const { data, error } = await db.from('monthly_offer_stats').select('*').in('offer_id', ids);
  if (error) throw new Error(error.message);
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

/**
 * Offres affichées sur le site aujourd'hui : publiées, non archivées, dans leur
 * période et non complètes. Ne lève jamais : une erreur donne une liste vide
 * (le bloc disparaît, la page reste servie).
 */
export async function getPublicOffers(today: string = zurichNow().date): Promise<PublicOffer[]> {
  const admin = getSupabaseAdmin();
  const db = admin || supabase;
  try {
    const { data, error } = await db
      .from('monthly_offers')
      .select('*')
      .eq('active', true)
      .is('archived_at', null)
      .lte('date_debut', today)
      .gte('date_fin', today)
      .order('date_fin', { ascending: true });
    if (error) throw error;
    const offers = (data ?? []).map(normalize).filter((o) => isOfferInPeriod(o, today));
    if (offers.length === 0) return [];

    let stats: Map<string, OfferStats> | null = null;
    if (admin) {
      stats = await fetchOfferStats(admin, offers.map((o) => o.id)).catch((err) => {
        console.warn('[getPublicOffers] Compteurs indisponibles:', err);
        return null;
      });
    }

    const out: PublicOffer[] = [];
    for (const o of offers) {
      // Compteur inconnu : on affiche l'offre sans « places restantes » ; la
      // création de réservation refera le contrôle avec la clé de service.
      const restantes = stats ? placesRestantes(o, stats.get(o.id) ?? { offer_id: o.id, ...EMPTY_STATS }) : null;
      if (restantes === 0) continue; // complète : elle a expiré pour le public
      out.push(toPublicOffer(o, restantes));
    }
    return out;
  } catch (err) {
    console.warn('[getPublicOffers] Lecture impossible:', err);
    return [];
  }
}

/** Une offre par identifiant (clé de service), ou `null`. */
export async function fetchOffer(db: SupabaseClient, id: string): Promise<Offer | null> {
  const { data, error } = await db.from('monthly_offers').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data) : null;
}

/** Offres valables aujourd'hui, pour le catalogue de l'agenda (complètes comprises : c'est Emmanuelle qui décide). */
export async function getCurrentOffersForAdmin(db: SupabaseClient, today: string = zurichNow().date): Promise<Offer[]> {
  const { data, error } = await db
    .from('monthly_offers')
    .select('*')
    .eq('active', true)
    .is('archived_at', null)
    .lte('date_debut', today)
    .gte('date_fin', today)
    .order('date_fin', { ascending: true });
  if (error) return [];
  return (data ?? []).map(normalize);
}
