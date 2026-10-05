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
import type { OfferStatus } from '../types/offers';
import { EMPTY_STATS, isOfferInPeriod, offerStatus, offerToPublic, placesRestantes } from '../types/offers';

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

const toPublicOffer = offerToPublic;

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

/**
 * Offre d'une page de partage (`/offre/<id>`), avec son statut du jour. `null`
 * si elle n'existe pas ou n'est qu'un brouillon (jamais exposé au public). Une
 * offre terminée, complète ou archivée revient avec son statut : la page dit
 * alors qu'elle est terminée plutôt que de répondre 404 à un lien déjà partagé.
 */
export async function getOfferForPage(id: string, today: string = zurichNow().date): Promise<{ offer: PublicOffer; status: OfferStatus } | null> {
  const full = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const short = /^[0-9a-f]{8}$/i.test(id);
  if (!full && !short) return null;
  const admin = getSupabaseAdmin();
  const db = admin || supabase;
  try {
    let row: Record<string, unknown> | null = null;
    if (full) {
      const { data, error } = await db.from('monthly_offers').select('*').eq('id', id).maybeSingle();
      if (error) return null;
      row = data;
    } else {
      // Lien court : la table ne compte que quelques dizaines d'offres, on cherche le préfixe ici.
      const { data, error } = await db.from('monthly_offers').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) return null;
      row = (data ?? []).find((r) => String(r.id).toLowerCase().startsWith(id.toLowerCase())) ?? null;
    }
    if (!row) return null;
    const o = normalize(row);
    if (!o.active) return null;
    const stats = admin ? await fetchOfferStats(admin, [o.id]).catch(() => null) : null;
    const s = stats?.get(o.id) ?? (stats ? { offer_id: o.id, ...EMPTY_STATS } : null);
    return { offer: toPublicOffer(o, s ? placesRestantes(o, s) : null), status: offerStatus(o, s, today) };
  } catch {
    return null;
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
