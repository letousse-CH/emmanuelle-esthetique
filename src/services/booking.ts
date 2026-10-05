/**
 * Service de Réservations — Emmanuelle Esthétique
 *
 * Modèle (PLAN-RESERVATIONS.md) : la cliente dépose une DEMANDE = date + période
 * (matin / après-midi). Emmanuelle la rappelle, fait l'upselling puis FIXE
 * l'horaire définitif. Tant que `horaire_fixe = false`, la demande est « souple »
 * et n'occupe que de la capacité dans sa période.
 *
 * Ce fichier regroupe, côté serveur uniquement :
 *  - la lecture/écriture des réglages et des blocages (validation stricte) ;
 *  - le calcul de disponibilité (le calcul lui-même est dans `bookingEngine.ts`) ;
 *  - la création publique (prix/durée retrouvés au catalogue, jamais crus sur le
 *    navigateur), la saisie admin, le déplacement, l'annulation, la suppression ;
 *  - le rapprochement avec la fiche cliente CRM (règles : PLAN §5) ;
 *  - les e-mails (tout texte interpolé est échappé) et Google Agenda ;
 *  - la réservation d'une offre du moment (règles : `types/offers.ts`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { sendEmail } from './email';
import { SITE_CONFIG, getBusinessInfoServer } from '../config/site';
import { getSecret } from './secrets';
import { emitAutomationEvent } from './automationRunner';
import { flatCarte, getItem } from '../constants/carteSoins';
import { fetchOffer, fetchOfferStats, getCurrentOffersForAdmin } from './offersServer';
import {
  EMPTY_STATS,
  isDateInOffer,
  offerIdFromServiceId,
  offerLineLabel,
  offerServiceId,
  placesRestantes,
  type Offer,
} from '../types/offers';
import {
  ACTIVE_STATUSES,
  PERIODE_LABEL,
  STATUT_LABEL,
  bookingTotal,
  minutesToTime,
  timeToMinutes,
  type AdminAvailability,
  type AgendaData,
  type AvailableDaySlots,
  type Booking,
  type BookingBlock,
  type BookingBlockResult,
  type BookingConflict,
  type BookingDetail,
  type BookingEvent,
  type BookingOption,
  type BookingPatch,
  type BookingPeriode,
  type BookingSettings,
  type BookingSource,
  type BookingStatus,
  type ClientSummary,
  type JourOuvertureConfig,
  type PlageHoraire,
  type PublicBookingErrorCode,
  type PublicBookingView,
  type PublicCalendar,
  type SyncClientsResult,
  type AdminCatalogItem,
} from '../types/booking';
import {
  addDays,
  busyFromInstants,
  computeDay,
  computeRange,
  dateBoundsError,
  diffDays,
  eachDay,
  findFixedConflicts,
  isValidDateStr,
  isValidTimeStr,
  periodeOfTime,
  zurichInstant,
  zurichNow,
  type EngineBooking,
  type Interval,
} from './bookingEngine';

// ── Ré-exports (compatibilité des consommateurs existants) ───────────────────

export type {
  AdminAvailability,
  AgendaData,
  AvailableDaySlots,
  Booking,
  BookingBlock,
  BookingBlockResult,
  BookingConflict,
  BookingDetail,
  BookingEvent,
  BookingOption,
  BookingPatch,
  BookingPeriode,
  BookingSettings,
  BookingSource,
  BookingStatus,
  ClientSummary,
  JourOuvertureConfig,
  PeriodeDispo,
  PlageHoraire,
  PublicBookingErrorCode,
  PublicBookingRequest,
  PublicBookingView,
  AdminCatalogItem,
  PublicCalendar,
  SyncClientsResult,
  TimeSlot,
} from '../types/booking';
export {
  ACTIVE_STATUSES,
  PERIODE_LABEL,
  STATUT_LABEL,
  bookingTotal,
  formatCHF,
  minutesToTime,
  timeToMinutes,
} from '../types/booking';

// ── Erreurs ──────────────────────────────────────────────────────────────────

/**
 * Erreur « métier » avec un code HTTP : les routes la traduisent telle quelle.
 * 400 validation · 404 introuvable · 409 conflit · 422 donnée refusée · 503 base indisponible.
 */
export class BookingError extends Error {
  status: number;
  conflicts?: BookingConflict[];
  /** Code machine (POST /api/bookings) : voir `PublicBookingErrorCode`. */
  code?: PublicBookingErrorCode;
  constructor(status: number, message: string, conflicts?: BookingConflict[], code?: PublicBookingErrorCode) {
    super(message);
    this.name = 'BookingError';
    this.status = status;
    this.conflicts = conflicts;
    this.code = code;
  }
}

function adminDb(): SupabaseClient {
  const db = getSupabaseAdmin();
  if (!db) {
    throw new BookingError(
      503,
      'Le service de réservation est momentanément indisponible. Merci de réessayer dans quelques instants.',
    );
  }
  return db;
}

// ── Types propres au service ─────────────────────────────────────────────────

export interface BookingListFilter {
  /** jour précis (YYYY-MM-DD) */
  date?: string;
  from?: string;
  to?: string;
  /** alias historiques de from / to */
  startDate?: string;
  endDate?: string;
  statut?: BookingStatus;
  clientId?: string;
  /** recherche libre : nom, prénom, téléphone, e-mail, soin */
  q?: string;
  limit?: number;
}

// ── Constantes & réglages par défaut ─────────────────────────────────────────

const JOURNEE_TYPE: JourOuvertureConfig = {
  ouvert: true,
  plages: [
    { debut: '09:00', fin: '12:00' },
    { debut: '13:30', fin: '18:30' },
  ],
};

/** Doit refléter la migration : lun–ven 09:00–12:00 et 13:30–18:30, samedi/dimanche fermés. */
export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  id: 'default',
  buffer_minutes: 30,
  anticipation_min_heures: 2,
  anticipation_max_jours: 60,
  jours_ouverture: {
    '1': { ...JOURNEE_TYPE, plages: [...JOURNEE_TYPE.plages] },
    '2': { ...JOURNEE_TYPE, plages: [...JOURNEE_TYPE.plages] },
    '3': { ...JOURNEE_TYPE, plages: [...JOURNEE_TYPE.plages] },
    '4': { ...JOURNEE_TYPE, plages: [...JOURNEE_TYPE.plages] },
    '5': { ...JOURNEE_TYPE, plages: [...JOURNEE_TYPE.plages] },
    '6': { ouvert: false, plages: [] },
    '0': { ouvert: false, plages: [] },
  },
  fermetures_exceptionnelles: [],
  pas_creneau_minutes: 30,
  heure_coupure_periode: '13:00',
  gcal_sync_enabled: false,
  gcal_calendar_id: null,
  notification_email: null,
};

const PAS_VALIDES = [5, 10, 15, 20, 30, 60];
const MAX_DURATION_MINUTES = 600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Utilitaires de durée ─────────────────────────────────────────────────────

/**
 * Extrait la durée en minutes d'une chaîne textuelle ("40 min", "1h45", "60 min", "1 heure", "90 minutes").
 * Repli sur defaultMinutes si non trouvé.
 */
export function parseDurationMinutes(durationStr?: string | null, defaultMinutes = 60): number {
  if (!durationStr) return defaultMinutes;
  const raw = durationStr.toLowerCase().trim();

  // Motif "1h45" ou "1 h 45" ou "1h30min"
  const hMinMatch = raw.match(/(\d+)\s*h(?:eures?)?\s*(\d+)?/);
  if (hMinMatch) {
    const hours = parseInt(hMinMatch[1], 10);
    const mins = hMinMatch[2] ? parseInt(hMinMatch[2], 10) : 0;
    return hours * 60 + mins;
  }

  // Motif "45 min" ou "60 minutes"
  const minMatch = raw.match(/(\d+)\s*(?:min|minutes?)/);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  const numOnly = parseInt(raw, 10);
  if (!isNaN(numOnly) && numOnly > 0) return numOnly;

  return defaultMinutes;
}

/** Somme des durées des options (soin hors options exclu). */
function sumOptionDurations(options: BookingOption[] | undefined): number {
  return (options ?? []).reduce((s, o) => s + (Number(o.duree_minutes) > 0 ? Number(o.duree_minutes) : 0), 0);
}

/**
 * Durée totale d'un soin avec ses options. Conservé pour compatibilité ; la
 * création, elle, retrouve toujours la durée côté serveur.
 */
export function calculateTotalDuration(
  serviceDurationOrStr: number | string | undefined,
  options?: BookingOption[],
): number {
  const base =
    typeof serviceDurationOrStr === 'number' ? serviceDurationOrStr : parseDurationMinutes(serviceDurationOrStr, 60);
  return base + sumOptionDurations(options);
}

/** Durée officielle d'un soin de la carte (`carteSoins`). */
export function resolveServiceDuration(serviceId?: string | null, fallbackMinutes = 60): number {
  if (!serviceId) return fallbackMinutes;
  try {
    const item = getItem(serviceId);
    if (item && item.duration) return parseDurationMinutes(item.duration, fallbackMinutes);
  } catch {
    // Soin absent de la carte (offre sur-mesure) : durée de repli.
  }
  return fallbackMinutes;
}

// ── Catalogue : classification partagée avec /api/bookings/services ──────────

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export type CatalogCategory = 'visage' | 'corps' | 'epilation' | 'services';

export interface CatalogClassification {
  /** `service` : réservable en ligne · `option` : complément (upsell) · `hors_ligne` : non proposé en ligne */
  kind: 'service' | 'option' | 'hors_ligne';
  category?: CatalogCategory;
  durationMinutes: number;
}

/**
 * Règles de classement du catalogue `services` pour la réservation en ligne.
 * Source unique : la route publique `/api/bookings/services` et la création
 * côté serveur s'y réfèrent toutes deux (un soin non listé n'est pas réservable).
 */
export function classifyCatalogRow(
  row: { nom?: string | null; description?: string | null; prix_chf?: number | string | null; type?: string | null },
  categoryName: string,
): CatalogClassification {
  const nom = stripAccents((row.nom || '').toLowerCase());
  const desc = row.description || '';
  const prix = Number(row.prix_chf) || 0;
  const cat = stripAccents((categoryName || '').toLowerCase());

  // Durée : celle écrite dans la description DB, sinon celle de la carte (`carteSoins`) si le nom
  // correspond, sinon le défaut de la catégorie. Même règle pour le catalogue public, la création
  // côté serveur et le formulaire.
  const fromDesc = parseDurationMinutes(desc, 0);
  const dur = (fallback: number) => (fromDesc > 0 ? fromDesc : carteDurationForName(row.nom || '') ?? fallback);

  if (nom.includes('option') || nom.includes('teinture') || nom.includes('duo regard')) {
    return { kind: 'option', durationMinutes: nom.includes('duo regard') ? 20 : dur(15) };
  }

  if (
    cat.includes('corps') ||
    (nom.includes('corps') && !cat.includes('visage')) ||
    nom.includes('massage') ||
    nom.includes('voile') ||
    nom.includes('bulle') ||
    nom.includes('echappee')
  ) {
    return {
      kind: prix >= 90 ? 'service' : 'hors_ligne',
      category: 'corps',
      durationMinutes: dur(nom.includes('echappee') ? 105 : nom.includes('90') ? 90 : 60),
    };
  }

  if (cat.includes('visage') || nom.includes('visage')) {
    return { kind: prix >= 90 ? 'service' : 'hors_ligne', category: 'visage', durationMinutes: dur(60) };
  }

  if (cat.includes('epilation') || nom.includes('epilation')) {
    return {
      kind: nom.includes('forfait') || row.type === 'forfait' ? 'service' : 'hors_ligne',
      category: 'epilation',
      durationMinutes: dur(60),
    };
  }

  if (nom.includes('mains') || nom.includes('pieds') || nom.includes('rehaussement')) {
    return { kind: 'service', category: 'services', durationMinutes: dur(nom.includes('pieds') ? 70 : 60) };
  }

  return { kind: 'hors_ligne', durationMinutes: dur(60) };
}

/** Durée annoncée par la carte pour un soin dont le nom correspond (`null` si absente ou inconnue). */
function carteDurationForName(name: string): number | null {
  const norm = (x: string) => stripAccents(x.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  const n = norm(name);
  if (!n) return null;
  const item = flatCarte().find((i) => {
    const c = norm(i.name);
    return c === n || n.startsWith(c + ' ') || c.startsWith(n + ' ');
  });
  if (!item?.duration) return null;
  const d = parseDurationMinutes(item.duration, 0);
  return d > 0 ? d : null;
}

/** Option proposée même si absente de la table `services` (voir /api/bookings/services). */
export const FALLBACK_OPTIONS: Record<string, { nom: string; duree_minutes: number; prix_chf: number; description: string }> = {
  'option-boue-marine-dos': {
    nom: 'Option Boue Marine Auto-Chauffante Dos',
    duree_minutes: 15,
    prix_chf: 30,
    description: 'Application d’une boue marine effervescente le long de la colonne. Dénoue le dos.',
  },
};

export interface CatalogEntry {
  id: string;
  nom: string;
  prix_chf: number;
  duree_minutes: number;
  kind: CatalogClassification['kind'];
  origine: 'services' | 'carte' | 'repli' | 'offre';
  /** Renseigné quand l'entrée est une offre du moment (`service_id` = `offre:<uuid>`). */
  offer_id?: string;
}

/**
 * Soin proposé en plusieurs durées (ex. massage 60 min CHF 145 / 90 min CHF 210) : la table
 * `services` ne porte qu'une ligne, la variante vient donc de la carte (`carteSoins`), retrouvée
 * par le nom du soin. Durée absente ou égale à celle de la ligne : la ligne fait foi.
 */
function applyCarteVariant(entry: CatalogEntry, variantMinutes: number | null | undefined): CatalogEntry | null {
  if (!variantMinutes || variantMinutes === entry.duree_minutes) return entry;
  const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
  const nom = norm(entry.nom);
  const item = flatCarte().find((i) => {
    if (!i.variants?.length) return false;
    const n = norm(i.name);
    return n === nom || nom.includes(n) || n.includes(nom);
  });
  const v = item?.variants?.find((x) => parseDurationMinutes(x.duration, 0) === variantMinutes);
  if (!v) return null;
  return { ...entry, prix_chf: v.price, duree_minutes: variantMinutes };
}

async function fetchCatalogRows(db: SupabaseClient, ids: string[], onlyActive: boolean) {
  if (ids.length === 0) return { rows: [] as any[], categories: new Map<string, string>() };
  let q = db.from('services').select('*').in('id', ids);
  if (onlyActive) q = q.eq('active', true);
  const [rowsRes, catsRes] = await Promise.all([q, db.from('service_categories').select('id, nom')]);
  if (rowsRes.error) throw new BookingError(503, 'Catalogue des soins momentanément indisponible.');
  const categories = new Map<string, string>();
  for (const c of catsRes.data ?? []) categories.set(c.id, c.nom || '');
  return { rows: rowsRes.data ?? [], categories };
}

/**
 * Retrouve un soin ou une option par identifiant : UUID de `services`, sinon
 * identifiant de la carte (`carteSoins`) ou option de repli. `null` si inconnu.
 */
async function lookupCatalogEntry(
  db: SupabaseClient,
  id: string,
  opts: { onlyActive: boolean; variantMinutes?: number | null },
): Promise<CatalogEntry | null> {
  // Offre du moment choisie dans l'agenda : pas de contrôle de période ni de
  // places ici, c'est Emmanuelle qui décide (la réservation en ligne, elle, les
  // vérifie dans `createPublicBooking`).
  const offerId = offerIdFromServiceId(id);
  if (offerId) {
    const offer = await fetchOffer(db, offerId).catch(() => {
      throw new BookingError(503, 'Offres du moment momentanément indisponibles.');
    });
    if (!offer || (opts.onlyActive && (offer.archived_at || !offer.active))) return null;
    return offerCatalogEntry(offer);
  }

  if (UUID_RE.test(id)) {
    const { rows, categories } = await fetchCatalogRows(db, [id], opts.onlyActive);
    const row = rows[0];
    if (!row) return null;
    const c = classifyCatalogRow(row, row.category_id ? categories.get(row.category_id) || '' : '');
    const entry: CatalogEntry = {
      id: row.id,
      nom: String(row.nom || '').trim(),
      prix_chf: Number(row.prix_chf) || 0,
      duree_minutes: c.durationMinutes,
      kind: c.kind,
      origine: 'services',
    };
    return applyCarteVariant(entry, opts.variantMinutes);
  }

  if (FALLBACK_OPTIONS[id]) {
    const o = FALLBACK_OPTIONS[id];
    return { id, nom: o.nom, prix_chf: o.prix_chf, duree_minutes: o.duree_minutes, kind: 'option', origine: 'repli' };
  }

  try {
    const item = getItem(id);
    let prix = item.price;
    let duree = parseDurationMinutes(item.duration, 60);
    if (item.variants?.length) {
      if (opts.variantMinutes) {
        const v = item.variants.find((x) => parseDurationMinutes(x.duration, 0) === opts.variantMinutes);
        if (!v) return null;
        prix = v.price;
        duree = parseDurationMinutes(v.duration, duree);
      } else {
        // Sans précision : la première durée proposée (la moins chère).
        prix = item.variants[0].price;
        duree = parseDurationMinutes(item.variants[0].duration, duree);
      }
    }
    return { id, nom: item.name, prix_chf: prix, duree_minutes: duree, kind: 'service', origine: 'carte' };
  } catch {
    return null;
  }
}

/** Une offre du moment vue comme un soin du catalogue (nom figé, prix et durée de l'offre). */
function offerCatalogEntry(offer: Offer): CatalogEntry {
  return {
    id: offerServiceId(offer.id),
    nom: offerLineLabel(offer),
    prix_chf: offer.prix_chf,
    duree_minutes: offer.duree_minutes,
    kind: 'service',
    origine: 'offre',
    offer_id: offer.id,
  };
}

// ── Catalogue complet (admin) ────────────────────────────────────────────────

export const OFFER_CATALOG_CATEGORY = 'Offre du moment';

/**
 * Tous les services actifs, sans filtre « réservable en ligne », précédés des
 * offres du moment valables aujourd'hui (GET /api/admin/services-catalog).
 */
export async function getAdminCatalog(): Promise<AdminCatalogItem[]> {
  const db = adminDb();
  const [rowsRes, catsRes, offers] = await Promise.all([
    db.from('services').select('*').eq('active', true).order('ordre', { ascending: true }),
    db.from('service_categories').select('id, nom'),
    getCurrentOffersForAdmin(db),
  ]);
  if (rowsRes.error) throw new BookingError(503, 'Catalogue des soins momentanément indisponible.');
  const cats = new Map<string, string>();
  for (const c of catsRes.data ?? []) cats.set(c.id, c.nom || '');
  const offerItems: AdminCatalogItem[] = offers.map((o) => ({
    id: offerServiceId(o.id),
    nom: offerLineLabel(o),
    categorie: OFFER_CATALOG_CATEGORY,
    type: 'offre',
    prix_chf: o.prix_chf,
    duree_minutes: o.duree_minutes,
  }));
  return [...offerItems, ...(rowsRes.data ?? []).map((row: any) => {
    const categorie = row.category_id ? cats.get(row.category_id) ?? null : null;
    const c = classifyCatalogRow(row, categorie || '');
    const type: AdminCatalogItem['type'] =
      c.kind === 'option' || row.type === 'option' ? 'option' : row.type === 'forfait' ? 'forfait' : 'prestation';
    return {
      id: row.id,
      nom: String(row.nom || '').trim(),
      categorie,
      type,
      prix_chf: Number(row.prix_chf) || 0,
      duree_minutes: c.durationMinutes,
    };
  })];
}

// ── Normalisation des lignes de base ─────────────────────────────────────────

/** Rend une ligne `bookings` conforme au type `Booking` (défauts si la migration v2 est partielle). */
export function normalizeBookingRow(row: any): Booking {
  const statut = row.statut as BookingStatus;
  const options: BookingOption[] = Array.isArray(row.options) ? row.options : [];
  const heure = typeof row.heure_rdv === 'string' ? row.heure_rdv.slice(0, 5) : '09:00';
  const date = String(row.date_rdv).slice(0, 10);
  const prix = Number(row.service_prix_chf) || 0;
  return {
    ...row,
    date_rdv: date,
    heure_rdv: heure,
    options,
    service_prix_chf: prix,
    service_duree_minutes: Number(row.service_duree_minutes) || 60,
    horaire_fixe: typeof row.horaire_fixe === 'boolean' ? row.horaire_fixe : statut === 'confirme' || statut === 'termine',
    periode: row.periode ?? (timeToMinutes(heure) < 13 * 60 ? 'matin' : 'apres_midi'),
    date_demandee: row.date_demandee ?? date,
    periode_demandee: row.periode_demandee ?? row.periode ?? null,
    total_chf: row.total_chf != null ? Number(row.total_chf) : bookingTotal({ service_prix_chf: prix, options }),
    source: row.source ?? 'en_ligne',
    contacte_at: row.contacte_at ?? null,
    confirmation_envoyee_at: row.confirmation_envoyee_at ?? null,
    optin_promotions: Boolean(row.optin_promotions),
    gcal_event_id: row.gcal_event_id ?? null,
    rappel_effectue: Boolean(row.rappel_effectue),
    client_id: row.client_id ?? null,
    email: row.email ?? null,
    code_postal: row.code_postal ?? null,
    ville: row.ville ?? null,
    service_id: row.service_id ?? null,
    offer_of_month_id: row.offer_of_month_id ?? null,
    notes_cliente: row.notes_cliente ?? null,
    notes_admin: row.notes_admin ?? null,
  } as Booking;
}

const ENGINE_COLUMNS = 'id, created_at, date_rdv, heure_rdv, service_duree_minutes, statut, horaire_fixe, periode, nom, prenom';

function toEngine(row: any): EngineBooking {
  const b = normalizeBookingRow(row);
  return {
    id: b.id,
    created_at: b.created_at,
    date_rdv: b.date_rdv,
    heure_rdv: b.heure_rdv,
    service_duree_minutes: b.service_duree_minutes,
    statut: b.statut,
    horaire_fixe: b.horaire_fixe,
    periode: b.periode,
    nom: b.nom,
    prenom: b.prenom,
  };
}

async function fetchBooking(db: SupabaseClient, id: string): Promise<Booking> {
  if (!UUID_RE.test(id)) throw new BookingError(404, 'Réservation introuvable.');
  const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error) throw new BookingError(503, 'Lecture de la réservation impossible.');
  if (!data) throw new BookingError(404, 'Réservation introuvable.');
  return normalizeBookingRow(data);
}

// ── Journal des rendez-vous ──────────────────────────────────────────────────

async function logEvent(
  db: SupabaseClient,
  bookingId: string,
  type: BookingEvent['type'],
  detail: Record<string, unknown>,
  actor: BookingEvent['actor'],
): Promise<void> {
  try {
    const { error } = await db.from('booking_events').insert({ booking_id: bookingId, type, detail, actor });
    if (error) console.warn('[booking] Journal non écrit:', error.message);
  } catch (err) {
    console.warn('[booking] Journal non écrit:', err);
  }
}

// ── Réglages ─────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function coerceJours(raw: unknown): Record<string, JourOuvertureConfig> {
  if (!isPlainObject(raw)) return DEFAULT_BOOKING_SETTINGS.jours_ouverture;
  const out: Record<string, JourOuvertureConfig> = {};
  for (let d = 0; d <= 6; d++) {
    const cfg = raw[String(d)];
    if (isPlainObject(cfg) && typeof cfg.ouvert === 'boolean' && Array.isArray(cfg.plages)) {
      out[String(d)] = {
        ouvert: cfg.ouvert,
        plages: (cfg.plages as unknown[])
          .filter(isPlainObject)
          .filter((p) => isValidTimeStr(p.debut) && isValidTimeStr(p.fin))
          .map((p) => ({ debut: String(p.debut), fin: String(p.fin) })),
      };
    } else {
      out[String(d)] = DEFAULT_BOOKING_SETTINGS.jours_ouverture[String(d)];
    }
  }
  return out;
}

function coerceSettings(data: any): BookingSettings {
  const d = DEFAULT_BOOKING_SETTINGS;
  const pas = Number(data.pas_creneau_minutes);
  return {
    id: data.id ?? 'default',
    buffer_minutes: Number.isFinite(Number(data.buffer_minutes)) ? Number(data.buffer_minutes) : d.buffer_minutes,
    anticipation_min_heures: Number.isFinite(Number(data.anticipation_min_heures))
      ? Number(data.anticipation_min_heures)
      : d.anticipation_min_heures,
    anticipation_max_jours: Number(data.anticipation_max_jours) > 0 ? Number(data.anticipation_max_jours) : d.anticipation_max_jours,
    jours_ouverture: coerceJours(data.jours_ouverture),
    fermetures_exceptionnelles: Array.isArray(data.fermetures_exceptionnelles)
      ? data.fermetures_exceptionnelles.filter(isValidDateStr)
      : [],
    pas_creneau_minutes: PAS_VALIDES.includes(pas) ? pas : d.pas_creneau_minutes,
    heure_coupure_periode: isValidTimeStr(data.heure_coupure_periode) ? data.heure_coupure_periode : d.heure_coupure_periode,
    gcal_sync_enabled: Boolean(data.gcal_sync_enabled),
    gcal_calendar_id: data.gcal_calendar_id ?? null,
    notification_email: data.notification_email ?? null,
  };
}

/**
 * Réglages de réservation. `strict` (calcul de disponibilité) : une erreur de
 * lecture devient un 503 au lieu de retomber silencieusement sur les défauts.
 */
export async function getBookingSettings(opts: { strict?: boolean } = {}): Promise<BookingSettings> {
  const client = getSupabaseAdmin() || supabase;
  try {
    const { data, error } = await client.from('booking_settings').select('*').eq('id', 'default').maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_BOOKING_SETTINGS;
    return coerceSettings(data);
  } catch (err) {
    if (opts.strict) throw new BookingError(503, 'Les horaires de réservation sont momentanément indisponibles.');
    console.warn('[getBookingSettings] Lecture impossible, valeurs par défaut:', err);
    return DEFAULT_BOOKING_SETTINGS;
  }
}

function fail(message: string): never {
  throw new BookingError(400, message);
}

function intInRange(v: unknown, min: number, max: number, label: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    fail(`${label} : un entier entre ${min} et ${max} est attendu.`);
  }
  return n as number;
}

/** Validation stricte d'un corps de PUT /api/admin/booking-settings. Lève une 400. */
export function validateSettingsPatch(body: unknown): Partial<BookingSettings> {
  if (!isPlainObject(body)) fail('Corps de requête invalide.');
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  if (b.buffer_minutes !== undefined) out.buffer_minutes = intInRange(b.buffer_minutes, 0, 240, 'Battement entre soins (minutes)');
  if (b.anticipation_min_heures !== undefined) {
    out.anticipation_min_heures = intInRange(b.anticipation_min_heures, 0, 720, 'Délai minimum (heures)');
  }
  if (b.anticipation_max_jours !== undefined) {
    out.anticipation_max_jours = intInRange(b.anticipation_max_jours, 1, 730, 'Réservation possible jusqu\'à (jours)');
  }
  if (b.pas_creneau_minutes !== undefined) {
    const pas = intInRange(b.pas_creneau_minutes, 1, 1440, 'Pas de la grille');
    if (!PAS_VALIDES.includes(pas)) fail(`Pas de la grille : ${PAS_VALIDES.join(', ')} minutes uniquement.`);
    out.pas_creneau_minutes = pas;
  }
  if (b.heure_coupure_periode !== undefined) {
    if (!isValidTimeStr(b.heure_coupure_periode)) fail('Heure de coupure matin / après-midi : format HH:mm attendu.');
    out.heure_coupure_periode = b.heure_coupure_periode;
  }
  if (b.gcal_sync_enabled !== undefined) {
    if (typeof b.gcal_sync_enabled !== 'boolean') fail('Synchronisation Google Agenda : vrai ou faux attendu.');
    out.gcal_sync_enabled = b.gcal_sync_enabled;
  }
  if (b.gcal_calendar_id !== undefined) {
    if (b.gcal_calendar_id !== null && (typeof b.gcal_calendar_id !== 'string' || b.gcal_calendar_id.length > 200)) {
      fail('Identifiant de calendrier invalide.');
    }
    out.gcal_calendar_id = typeof b.gcal_calendar_id === 'string' && b.gcal_calendar_id.trim() ? b.gcal_calendar_id.trim() : null;
  }
  if (b.notification_email !== undefined) {
    if (b.notification_email !== null && b.notification_email !== '') {
      if (typeof b.notification_email !== 'string' || b.notification_email.length > 254 || !EMAIL_RE.test(b.notification_email.trim())) {
        fail('E-mail de notification invalide.');
      }
      out.notification_email = (b.notification_email as string).trim().toLowerCase();
    } else {
      out.notification_email = null;
    }
  }
  if (b.fermetures_exceptionnelles !== undefined) {
    if (!Array.isArray(b.fermetures_exceptionnelles) || !b.fermetures_exceptionnelles.every(isValidDateStr)) {
      fail('Fermetures exceptionnelles : liste de dates YYYY-MM-DD attendue.');
    }
    out.fermetures_exceptionnelles = [...new Set(b.fermetures_exceptionnelles as string[])].sort();
  }
  if (b.jours_ouverture !== undefined) {
    if (!isPlainObject(b.jours_ouverture)) fail('Horaires d\'ouverture : objet attendu.');
    const src = b.jours_ouverture as Record<string, unknown>;
    const jours: Record<string, JourOuvertureConfig> = {};
    for (let d = 0; d <= 6; d++) {
      const label = jourLabelByIndex(d);
      const cfg = src[String(d)];
      if (!isPlainObject(cfg) || typeof cfg.ouvert !== 'boolean' || !Array.isArray(cfg.plages)) {
        fail(`Horaires du ${label} : { ouvert, plages } attendu.`);
      }
      const c = cfg as { ouvert: boolean; plages: unknown[] };
      if (c.plages.length > 6) fail(`Horaires du ${label} : 6 plages au maximum.`);
      const plages: PlageHoraire[] = [];
      for (const p of c.plages) {
        if (!isPlainObject(p) || !isValidTimeStr(p.debut) || !isValidTimeStr(p.fin)) {
          fail(`Horaires du ${label} : chaque plage doit avoir un début et une fin au format HH:mm.`);
        }
        const plage = p as unknown as PlageHoraire;
        if (timeToMinutes(plage.fin) <= timeToMinutes(plage.debut)) {
          fail(`Horaires du ${label} : la fin (${plage.fin}) doit être après le début (${plage.debut}).`);
        }
        plages.push({ debut: plage.debut, fin: plage.fin });
      }
      plages.sort((x, y) => timeToMinutes(x.debut) - timeToMinutes(y.debut));
      for (let i = 1; i < plages.length; i++) {
        if (timeToMinutes(plages[i].debut) < timeToMinutes(plages[i - 1].fin)) {
          fail(`Horaires du ${label} : les plages ne doivent pas se chevaucher.`);
        }
      }
      if (c.ouvert && plages.length === 0) fail(`Horaires du ${label} : un jour ouvert a besoin d'au moins une plage.`);
      jours[String(d)] = { ouvert: c.ouvert, plages: c.ouvert ? plages : [] };
    }
    out.jours_ouverture = jours;
  }

  return out as Partial<BookingSettings>;
}

function jourLabelByIndex(d: number): string {
  return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d];
}

/** Met à jour les réglages (après `validateSettingsPatch`). */
export async function updateBookingSettings(
  settings: Partial<BookingSettings>,
): Promise<{ success: boolean; data?: BookingSettings; error?: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { success: false, error: 'Accès admin non disponible sur le serveur.' };

  try {
    const { id: _id, ...rest } = settings as Record<string, unknown>;
    void _id;
    const { data, error } = await admin
      .from('booking_settings')
      .upsert({ id: 'default', ...rest, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: coerceSettings(data) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur inconnue' };
  }
}

// ── Blocages (indisponibilités) ──────────────────────────────────────────────

function normalizeBlock(row: any): BookingBlock {
  return {
    id: row.id,
    date_debut: String(row.date_debut).slice(0, 10),
    date_fin: String(row.date_fin).slice(0, 10),
    heure_debut: row.heure_debut ?? null,
    heure_fin: row.heure_fin ?? null,
    motif: row.motif ?? null,
    created_at: row.created_at,
  };
}

export async function listBlocks(range?: { from?: string; to?: string }): Promise<BookingBlock[]> {
  const db = adminDb();
  let q = db.from('booking_blocks').select('*');
  if (range?.from) q = q.gte('date_fin', range.from);
  if (range?.to) q = q.lte('date_debut', range.to);
  const { data, error } = await q.order('date_debut', { ascending: true }).order('heure_debut', { ascending: true });
  if (error) throw new BookingError(503, 'Lecture des indisponibilités impossible.');
  return (data ?? []).map(normalizeBlock);
}

/** Rendez-vous actifs touchés par un blocage (à signaler, jamais annulés d'office). */
async function bookingsImpactedBy(
  db: SupabaseClient,
  block: { date_debut: string; date_fin: string; heure_debut: string | null; heure_fin: string | null },
  settings: BookingSettings,
): Promise<Booking[]> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .gte('date_rdv', block.date_debut)
    .lte('date_rdv', block.date_fin)
    .in('statut', ACTIVE_STATUSES)
    .order('date_rdv', { ascending: true })
    .order('heure_rdv', { ascending: true });
  if (error) throw new BookingError(503, 'Lecture des rendez-vous impossible.');
  const all = (data ?? []).map(normalizeBookingRow);
  if (!block.heure_debut || !block.heure_fin) return all;

  const bs = timeToMinutes(block.heure_debut);
  const be = timeToMinutes(block.heure_fin);
  const coupure = timeToMinutes(settings.heure_coupure_periode);
  return all.filter((b) => {
    if (b.horaire_fixe) {
      const s = timeToMinutes(b.heure_rdv);
      return s < be && s + b.service_duree_minutes > bs;
    }
    // Demande souple : touchée si le blocage recouvre sa période.
    return b.periode === 'apres_midi' ? be > coupure : bs < coupure;
  });
}

export async function createBlock(body: unknown): Promise<BookingBlockResult> {
  if (!isPlainObject(body)) fail('Corps de requête invalide.');
  const b = body as Record<string, unknown>;
  if (!isValidDateStr(b.date_debut)) fail('Date de début invalide (YYYY-MM-DD).');
  const dateDebut = b.date_debut as string;
  const dateFin = b.date_fin === undefined || b.date_fin === null || b.date_fin === '' ? dateDebut : b.date_fin;
  if (!isValidDateStr(dateFin)) fail('Date de fin invalide (YYYY-MM-DD).');
  if ((dateFin as string) < dateDebut) fail('La date de fin doit être égale ou postérieure à la date de début.');
  if (diffDays(dateDebut, dateFin as string) > 366) fail('Une indisponibilité ne peut pas dépasser un an.');

  const hd = b.heure_debut === undefined || b.heure_debut === '' ? null : b.heure_debut;
  const hf = b.heure_fin === undefined || b.heure_fin === '' ? null : b.heure_fin;
  if ((hd === null) !== (hf === null)) fail('Indiquez l\'heure de début ET l\'heure de fin, ou aucune des deux (journée entière).');
  if (hd !== null) {
    if (!isValidTimeStr(hd) || !isValidTimeStr(hf)) fail('Heures invalides (HH:mm).');
    if (timeToMinutes(hf as string) <= timeToMinutes(hd as string)) fail('L\'heure de fin doit être après l\'heure de début.');
    if (dateFin !== dateDebut) fail('Une plage horaire se pose sur un seul jour.');
  }
  let motif: string | null = null;
  if (b.motif !== undefined && b.motif !== null) {
    if (typeof b.motif !== 'string' || b.motif.length > 200) fail('Motif : 200 caractères au maximum.');
    motif = b.motif.trim() || null;
  }

  const db = adminDb();
  const row = { date_debut: dateDebut, date_fin: dateFin, heure_debut: hd, heure_fin: hf, motif };
  const { data, error } = await db.from('booking_blocks').insert(row).select().single();
  if (error || !data) throw new BookingError(500, `Enregistrement de l'indisponibilité impossible : ${error?.message ?? ''}`.trim());

  const settings = await getBookingSettings();
  const block = normalizeBlock(data);
  const impactes = await bookingsImpactedBy(db, block, settings);
  return { block, impactes };
}

export async function deleteBlock(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new BookingError(404, 'Indisponibilité introuvable.');
  const db = adminDb();
  const { data, error } = await db.from('booking_blocks').delete().eq('id', id).select('id');
  if (error) throw new BookingError(500, 'Suppression impossible.');
  if (!data || data.length === 0) throw new BookingError(404, 'Indisponibilité introuvable.');
}

// ── Chargement des données d'un jour / d'une période ─────────────────────────

interface DayData {
  settings: BookingSettings;
  blocks: BookingBlock[];
  bookings: EngineBooking[];
  externalBusy: Interval[];
}

async function loadRangeData(from: string, to: string, withExternal = true): Promise<{
  settings: BookingSettings;
  blocks: BookingBlock[];
  bookings: EngineBooking[];
  externalByDate: Record<string, Interval[]>;
}> {
  const db = adminDb();
  const settings = await getBookingSettings({ strict: true });
  const [bk, bl] = await Promise.all([
    db
      .from('bookings')
      .select(ENGINE_COLUMNS)
      .gte('date_rdv', from)
      .lte('date_rdv', to)
      .in('statut', ACTIVE_STATUSES),
    db.from('booking_blocks').select('*').lte('date_debut', to).gte('date_fin', from),
  ]);
  if (bk.error || bl.error) {
    console.error('[booking] Lecture agenda impossible:', bk.error || bl.error);
    throw new BookingError(503, 'L\'agenda est momentanément indisponible. Merci de réessayer dans quelques instants.');
  }

  const externalByDate: Record<string, Interval[]> = {};
  if (withExternal && settings.gcal_sync_enabled) {
    try {
      const instants = await getGoogleCalendarBusyInstants(from, to);
      for (const date of eachDay(from, to)) externalByDate[date] = busyFromInstants(date, instants);
    } catch (err) {
      console.warn('[booking] Google Agenda ignoré (non bloquant):', err);
    }
  }
  return {
    settings,
    blocks: (bl.data ?? []).map(normalizeBlock),
    bookings: (bk.data ?? []).map(toEngine),
    externalByDate,
  };
}

async function loadDayData(date: string, withExternal = true): Promise<DayData> {
  const r = await loadRangeData(date, date, withExternal);
  return { settings: r.settings, blocks: r.blocks, bookings: r.bookings, externalBusy: r.externalByDate[date] ?? [] };
}

function clampDuration(raw: unknown, fallback = 60): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_DURATION_MINUTES);
}

// ── Disponibilités ───────────────────────────────────────────────────────────

/**
 * Disponibilité publique d'un jour. Fail-closed : sans client admin ou si la base
 * ne répond pas, lève une 503 — jamais « tout est libre ».
 */
export async function getAvailableSlots(date: string, durationMinutes: number): Promise<AvailableDaySlots> {
  const data = await loadDayData(date);
  const r = computeDay({
    date,
    duration: clampDuration(durationMinutes),
    settings: data.settings,
    blocks: data.blocks,
    bookings: data.bookings,
    externalBusy: data.externalBusy,
    now: zurichNow(),
  });
  // On ne divulgue ni les identifiants ni la charge des autres demandes.
  return {
    date: r.date,
    ouvert: r.ouvert,
    buffer_minutes: r.buffer_minutes,
    service_duree_minutes: r.service_duree_minutes,
    // Aucun motif interne (libellé d'un blocage…) côté public : libellé générique.
    periodes: {
      matin: publicPeriode(r.periodes.matin),
      apres_midi: publicPeriode(r.periodes.apres_midi),
    },
    slots: r.slots.map(({ motif: _m, ...slot }) => (_m ? { ...slot, motif: 'Indisponible' } : slot)),
  };
}

/** Motifs publics autorisés ; tout le reste devient « Indisponible ». */
function publicPeriode(p: { disponible: boolean; premier_creneau: string | null; motif?: string }) {
  const SAFE = ['Complet', "Délai d'anticipation dépassé", 'Fermé ce jour.'];
  if (!p.motif) return p;
  return { ...p, motif: SAFE.includes(p.motif) ? p.motif : 'Indisponible' };
}

export async function getPublicCalendar(from: string, to: string, durationMinutes: number): Promise<PublicCalendar> {
  const data = await loadRangeData(from, to);
  return computeRange(from, to, {
    duration: clampDuration(durationMinutes),
    settings: data.settings,
    blocks: data.blocks,
    bookings: data.bookings,
    externalBusyByDate: data.externalByDate,
    now: zurichNow(),
  });
}

/** Créneaux EXACTS pour fixer l'horaire définitif (rdv `excludeId` ignoré, pas de bornes d'anticipation). */
export async function getAdminAvailability(date: string, durationMinutes: number, excludeId?: string): Promise<AdminAvailability> {
  const data = await loadDayData(date);
  if (excludeId && UUID_RE.test(excludeId)) {
    const own = await getBookingById(excludeId).catch(() => null);
    data.externalBusy = dropOwnGoogleEvent(data.externalBusy, own ?? undefined, date);
  }
  const r = computeDay({
    date,
    duration: clampDuration(durationMinutes),
    settings: data.settings,
    blocks: data.blocks,
    bookings: data.bookings,
    externalBusy: data.externalBusy,
    now: zurichNow(),
    excludeId,
    mode: 'admin',
  });
  return { date, ouvert: r.ouvert, ...(r.motif ? { motif: r.motif } : {}), buffer_minutes: r.buffer_minutes, slots: r.slots };
}

// ── Téléphone & e-mail : normalisation ───────────────────────────────────────

/**
 * Normalise un numéro en E.164 (`+41791234567`). Gère `0041`, le `0` initial,
 * `+41 (0)79…`, espaces, points et tirets. `null` si le numéro est invraisemblable.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\(0\)/g, '');
  if (!s) return null;
  let digits = s.replace(/\D/g, '');
  if (!digits) return null;

  if (s.startsWith('+')) {
    // déjà international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = '41' + digits.slice(1); // numéro national suisse
  } else if (digits.startsWith('41') && digits.length === 11) {
    // 41791234567 sans « + »
  } else if (digits.length === 9) {
    digits = '41' + digits; // 791234567
  } else if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  if (digits.startsWith('410') && digits.length === 12) digits = '41' + digits.slice(3); // +41 0 79…
  if (digits.startsWith('41') && digits.length !== 11) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** `+41791234567` → `+41 79 123 45 67` (les autres numéros restent en E.164). */
export function formatPhone(e164: string): string {
  const m = /^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

function cleanText(v: unknown, max: number, label: string, required = false): string {
  if (v === undefined || v === null || v === '') {
    if (required) fail(`${label} est requis.`);
    return '';
  }
  if (typeof v !== 'string') fail(`${label} : texte attendu.`);
  // eslint-disable-next-line no-control-regex
  const s = (v as string).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (required && !s) fail(`${label} est requis.`);
  if (s.length > max) fail(`${label} : ${max} caractères au maximum.`);
  return s;
}

function cleanEmail(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') fail('Adresse e-mail invalide.');
  const s = (v as string).trim().toLowerCase();
  if (!s) return null;
  if (s.length > 254 || !EMAIL_RE.test(s)) fail('Adresse e-mail invalide.');
  return s;
}

function cleanPhone(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) fail('Le numéro de téléphone est requis.');
  const e164 = normalizePhone(v as string);
  if (!e164) fail('Numéro de téléphone invalide. Exemple : 079 123 45 67.');
  return formatPhone(e164 as string);
}

// ── CRM : rapprochement / création de la fiche cliente ───────────────────────

export interface CrmMatchInput {
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  /** `true` uniquement si la case a été cochée : on ne retire jamais un accord existant. */
  consentEmail?: boolean;
  consentWhatsapp?: boolean;
  consentSource?: string;
}

export interface CrmMatchResult {
  clientId: string | null;
  action: 'rattachee' | 'creee' | 'aucune';
  matchedBy?: 'email' | 'telephone';
  doublonPossible?: string[];
  completed?: string[];
}

function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * PLAN §5 : e-mail exact (insensible à la casse) → téléphone normalisé comparé
 * en JS sur un lot de candidats → sinon création. JAMAIS de rapprochement par
 * nom seul : à nom identique mais coordonnées différentes, on crée et on
 * signale un doublon possible. Consentements à `false` par défaut.
 */
export async function matchOrCreateClient(db: SupabaseClient, input: CrmMatchInput): Promise<CrmMatchResult> {
  const e164 = normalizePhone(input.telephone);
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const columns = 'id, nom, prenom, telephone, email, consent_email, consent_whatsapp, consent_source';
  let matched: any = null;
  let matchedBy: 'email' | 'telephone' | undefined;

  if (email) {
    const { data } = await db
      .from('clients')
      .select(columns)
      .ilike('email', likeEscape(email))
      .eq('archived', false)
      .limit(10);
    matched = (data ?? []).find((c: any) => (c.email || '').trim().toLowerCase() === email) ?? null;
    if (matched) matchedBy = 'email';
  }

  if (!matched && e164) {
    // Le téléphone est stocké avec espaces : on cherche les 6 derniers chiffres dans l'ordre,
    // séparateurs quelconques, puis on tranche en JS sur le numéro normalisé.
    const tail = e164.replace(/\D/g, '').slice(-6).split('').join('%');
    const { data } = await db
      .from('clients')
      .select(columns)
      .ilike('telephone', `%${tail}%`)
      .eq('archived', false)
      .limit(100);
    matched = (data ?? []).find((c: any) => normalizePhone(c.telephone) === e164) ?? null;
    if (matched) matchedBy = 'telephone';
  }

  const wantsEmail = Boolean(input.consentEmail) && Boolean(email);
  const wantsWhatsapp = Boolean(input.consentWhatsapp) && Boolean(e164);
  const source = input.consentSource || 'reservation_en_ligne';

  if (matched) {
    const updates: Record<string, unknown> = {};
    const completed: string[] = [];
    if (!matched.email && email) {
      updates.email = email;
      completed.push('email');
    }
    if (!matched.telephone && e164) {
      updates.telephone = formatPhone(e164);
      completed.push('telephone');
    }
    let flipped = false;
    if (wantsEmail && !matched.consent_email) {
      updates.consent_email = true;
      flipped = true;
    }
    if (wantsWhatsapp && !matched.consent_whatsapp) {
      updates.consent_whatsapp = true;
      flipped = true;
    }
    if (flipped && !matched.consent_source) updates.consent_source = source;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await db.from('clients').update(updates).eq('id', matched.id);
      if (error) console.warn('[booking] Complément de fiche cliente impossible:', error.message);
    }
    return { clientId: matched.id, action: 'rattachee', matchedBy, completed };
  }

  // Aucune correspondance : homonyme éventuel (signalé, jamais fusionné).
  let doublon: string[] = [];
  if (input.nom.trim()) {
    const { data } = await db
      .from('clients')
      .select('id')
      .ilike('nom', likeEscape(input.nom.trim()))
      .ilike('prenom', likeEscape(input.prenom.trim()))
      .eq('archived', false)
      .limit(5);
    doublon = (data ?? []).map((c: any) => c.id);
  }

  const { data: created, error } = await db
    .from('clients')
    .insert({
      nom: input.nom.trim(),
      prenom: input.prenom.trim(),
      telephone: e164 ? formatPhone(e164) : input.telephone?.trim() || null,
      email,
      consent_email: wantsEmail,
      consent_whatsapp: wantsWhatsapp,
      ...(wantsEmail || wantsWhatsapp ? { consent_source: source } : {}),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !created) {
    console.warn('[booking] Création de la fiche cliente impossible:', error?.message);
    return { clientId: null, action: 'aucune' };
  }
  return { clientId: created.id, action: 'creee', doublonPossible: doublon.length ? doublon : undefined };
}

/** Rapproche une réservation de la CRM, l'y rattache et journalise (événement `crm`). Non bloquant. */
async function linkBookingToClient(
  db: SupabaseClient,
  booking: Booking,
  consent: { email?: boolean; whatsapp?: boolean },
  actor: BookingEvent['actor'],
): Promise<string | null> {
  try {
    const r = await matchOrCreateClient(db, {
      nom: booking.nom,
      prenom: booking.prenom,
      telephone: booking.telephone,
      email: booking.email,
      consentEmail: consent.email,
      consentWhatsapp: consent.whatsapp,
      consentSource: 'reservation_en_ligne',
    });
    if (!r.clientId) return null;
    await db.from('bookings').update({ client_id: r.clientId }).eq('id', booking.id);
    await logEvent(
      db,
      booking.id,
      'crm',
      {
        action: r.action === 'creee' ? 'fiche_creee' : 'fiche_rattachee',
        client_id: r.clientId,
        ...(r.matchedBy ? { rapprochement: r.matchedBy } : {}),
        ...(r.completed?.length ? { complete: r.completed } : {}),
        ...(r.doublonPossible
          ? { doublon_possible: r.doublonPossible, note: 'Doublon possible : une fiche de même nom existe avec d\'autres coordonnées.' }
          : {}),
      },
      actor,
    );
    return r.clientId;
  } catch (err) {
    console.warn('[booking] Rapprochement CRM non bloquant:', err);
    return null;
  }
}

/** Rattache à la CRM les rendez-vous qui n'ont pas de `client_id` (POST /api/admin/bookings/sync-clients). */
export async function syncBookingsToClients(): Promise<SyncClientsResult> {
  const db = adminDb();
  const result: SyncClientsResult = { rattaches: 0, crees: 0, ignores: 0 };
  const BATCH = 200;
  const MAX_BATCHES = 25; // 5 000 rendez-vous au plus par appel
  // Les lignes traitées avec succès quittent la liste (client_id posé) ; les ignorées y restent :
  // on avance donc d'autant dans la pagination, sans jamais bloquer les lignes suivantes.
  let skip = 0;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .is('client_id', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(skip, skip + BATCH - 1);
    if (error) throw new BookingError(503, 'Lecture des rendez-vous impossible.');
    if (!data || data.length === 0) break;

    for (const row of data) {
      const booking = normalizeBookingRow(row);
      if (!normalizePhone(booking.telephone) && !booking.email) {
        result.ignores += 1;
        skip += 1;
        continue;
      }
      try {
        const r = await matchOrCreateClient(db, {
          nom: booking.nom,
          prenom: booking.prenom,
          telephone: booking.telephone,
          email: booking.email,
        });
        if (!r.clientId) {
          result.ignores += 1;
          skip += 1;
          continue;
        }
        const { error: upErr } = await db.from('bookings').update({ client_id: r.clientId }).eq('id', booking.id);
        if (upErr) {
          result.ignores += 1;
          skip += 1;
          continue;
        }
        await logEvent(
          db,
          booking.id,
          'crm',
          {
            action: r.action === 'creee' ? 'fiche_creee' : 'fiche_rattachee',
            client_id: r.clientId,
            origine: 'synchronisation',
            ...(r.matchedBy ? { rapprochement: r.matchedBy } : {}),
            ...(r.doublonPossible ? { doublon_possible: r.doublonPossible } : {}),
          },
          'admin',
        );
        if (r.action === 'creee') result.crees += 1;
        else result.rattaches += 1;
      } catch {
        result.ignores += 1;
        skip += 1;
      }
    }
    if (data.length < BATCH) break;
  }
  return result;
}

// ── Lecture admin ────────────────────────────────────────────────────────────

export async function getBookingById(id: string): Promise<Booking | null> {
  const db = adminDb();
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return normalizeBookingRow(data);
}

export async function getBookings(filter: BookingListFilter = {}): Promise<Booking[]> {
  const db = adminDb();
  const from = filter.from ?? filter.startDate;
  const to = filter.to ?? filter.endDate;
  const q = filter.q ? filter.q.replace(/[%,()*\\"':]/g, ' ').trim().slice(0, 80) : '';

  const base = () => {
    let query = db.from('bookings').select('*');
    if (filter.date) query = query.eq('date_rdv', filter.date);
    if (from) query = query.gte('date_rdv', from);
    if (to) query = query.lte('date_rdv', to);
    if (filter.clientId) query = query.eq('client_id', filter.clientId);
    if (q) {
      const p = `%${q}%`;
      query = query.or(`nom.ilike.${p},prenom.ilike.${p},telephone.ilike.${p},email.ilike.${p},service_nom.ilike.${p}`);
    }
    return query;
  };
  const limit = Math.min(Math.max(filter.limit || 1000, 1), 1000);

  // La limite garde les rendez-vous les plus récents / à venir (tri décroissant côté requête),
  // puis on remet l'ordre croissant. Les demandes « à appeler » sont toujours renvoyées en entier.
  let main = base().order('date_rdv', { ascending: false }).order('heure_rdv', { ascending: false }).limit(limit);
  if (filter.statut) main = main.eq('statut', filter.statut);
  const wantPending = !filter.statut;
  const [mainRes, pendingRes] = await Promise.all([
    main,
    wantPending ? base().eq('statut', 'en_attente').limit(5000) : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (mainRes.error || pendingRes.error) {
    console.error('[getBookings] Erreur chargement:', mainRes.error || pendingRes.error);
    throw new BookingError(503, 'Lecture des réservations impossible.');
  }
  const byId = new Map<string, any>();
  for (const row of [...(mainRes.data ?? []), ...(pendingRes.data ?? [])]) byId.set(row.id, row);
  return [...byId.values()]
    .map(normalizeBookingRow)
    .sort((x, y) => (x.date_rdv + x.heure_rdv).localeCompare(y.date_rdv + y.heure_rdv));
}

export async function getBookingDetail(id: string): Promise<BookingDetail> {
  const db = adminDb();
  const booking = await fetchBooking(db, id);

  let client: ClientSummary | null = null;
  if (booking.client_id) {
    const { data: c } = await db
      .from('clients')
      .select('id, nom, prenom, telephone, email, notes, consent_email, consent_whatsapp')
      .eq('id', booking.client_id)
      .maybeSingle();
    if (c) {
      let visites = 0;
      let derniere: string | null = null;
      try {
        const { data: st } = await db
          .from('client_stats')
          .select('nb_visites, derniere_visite')
          .eq('client_id', c.id)
          .maybeSingle();
        visites = Number(st?.nb_visites) || 0;
        derniere = st?.derniere_visite ?? null;
      } catch {
        // vue absente : repères non affichés
      }
      client = {
        id: c.id,
        nom: c.nom,
        prenom: c.prenom ?? '',
        telephone: c.telephone ?? null,
        email: c.email ?? null,
        notes: c.notes ?? null,
        consent_email: Boolean(c.consent_email),
        consent_whatsapp: Boolean(c.consent_whatsapp),
        visites,
        derniere_visite: derniere,
      };
    }
  }

  let histQuery = db.from('bookings').select('*').neq('id', booking.id);
  histQuery = booking.client_id ? histQuery.eq('client_id', booking.client_id) : histQuery.eq('telephone', booking.telephone);
  const [{ data: hist }, { data: evs }] = await Promise.all([
    histQuery.order('date_rdv', { ascending: false }).limit(10),
    db.from('booking_events').select('*').eq('booking_id', booking.id).order('created_at', { ascending: false }),
  ]);

  return {
    booking,
    client,
    historique: (hist ?? []).map(normalizeBookingRow),
    events: (evs ?? []) as BookingEvent[],
  };
}

export async function getAgendaData(from: string, to: string): Promise<AgendaData> {
  const db = adminDb();
  const settings = await getBookingSettings({ strict: true });
  const [bk, bl] = await Promise.all([
    db.from('bookings').select('*').gte('date_rdv', from).lte('date_rdv', to).order('date_rdv').order('heure_rdv'),
    db.from('booking_blocks').select('*').lte('date_debut', to).gte('date_fin', from).order('date_debut'),
  ]);
  if (bk.error || bl.error) throw new BookingError(503, 'Lecture de l\'agenda impossible.');
  return {
    from,
    to,
    bookings: (bk.data ?? []).map(normalizeBookingRow),
    blocks: (bl.data ?? []).map(normalizeBlock),
    settings,
  };
}

// ── Validation des écritures ─────────────────────────────────────────────────

const STATUTS: BookingStatus[] = ['en_attente', 'confirme', 'refuse', 'annule', 'termine'];
const PERIODES: BookingPeriode[] = ['matin', 'apres_midi'];

interface CleanPatch {
  statut?: BookingStatus;
  notes_admin?: string | null;
  date_rdv?: string;
  heure_rdv?: string;
  periode?: BookingPeriode;
  horaire_fixe?: boolean;
  service_id?: string | null;
  service_nom?: string;
  service_prix_chf?: number;
  service_duree_soin_minutes?: number;
  options?: BookingOption[];
  nom?: string;
  prenom?: string;
  telephone?: string;
  email?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  client_id?: string | null;
  contacte_at?: string | null;
  notify_client?: boolean;
  force?: boolean;
  source?: Exclude<BookingSource, 'en_ligne'>;
}

function isAdminDate(s: unknown): s is string {
  if (!isValidDateStr(s)) return false;
  const today = zurichNow().date;
  return s >= '2020-01-01' && diffDays(today, s as string) <= 1095;
}

function validatePatch(patch: unknown): CleanPatch {
  if (!isPlainObject(patch)) fail('Corps de requête invalide.');
  const p = patch as Record<string, unknown>;
  const out: CleanPatch = {};

  if (p.statut !== undefined) {
    if (!STATUTS.includes(p.statut as BookingStatus)) fail(`Statut invalide : ${String(p.statut)}`);
    out.statut = p.statut as BookingStatus;
  }
  if (p.notes_admin !== undefined) out.notes_admin = cleanText(p.notes_admin, 4000, 'Notes') || null;
  if (p.date_rdv !== undefined) {
    if (!isAdminDate(p.date_rdv)) fail('Date invalide (YYYY-MM-DD).');
    out.date_rdv = p.date_rdv as string;
  }
  if (p.heure_rdv !== undefined) {
    if (!isValidTimeStr(p.heure_rdv)) fail('Heure invalide (HH:mm).');
    out.heure_rdv = p.heure_rdv as string;
  }
  if (p.periode !== undefined) {
    if (!PERIODES.includes(p.periode as BookingPeriode)) fail('Période invalide (matin ou apres_midi).');
    out.periode = p.periode as BookingPeriode;
  }
  if (p.horaire_fixe !== undefined) {
    if (typeof p.horaire_fixe !== 'boolean') fail('horaire_fixe : vrai ou faux attendu.');
    out.horaire_fixe = p.horaire_fixe as boolean;
  }
  if (p.service_id !== undefined) {
    if (p.service_id !== null && (typeof p.service_id !== 'string' || p.service_id.length > 80)) fail('Identifiant de soin invalide.');
    out.service_id = (p.service_id as string | null) || null;
  }
  if (p.service_nom !== undefined) out.service_nom = cleanText(p.service_nom, 200, 'Nom du soin', true);
  if (p.service_prix_chf !== undefined) {
    const n = Number(p.service_prix_chf);
    if (!Number.isFinite(n) || n < 0 || n > 100000) fail('Prix du soin invalide.');
    out.service_prix_chf = Math.round(n * 100) / 100;
  }
  if (p.service_duree_soin_minutes !== undefined) {
    out.service_duree_soin_minutes = intInRange(p.service_duree_soin_minutes, 1, MAX_DURATION_MINUTES, 'Durée du soin (minutes)');
  }
  if (p.options !== undefined) {
    if (!Array.isArray(p.options) || p.options.length > 20) fail('Options : liste de 20 lignes au maximum.');
    out.options = (p.options as unknown[]).map((o, i) => {
      if (!isPlainObject(o)) fail(`Option ${i + 1} invalide.`);
      const oo = o as Record<string, unknown>;
      const prix = Number(oo.prix_chf);
      if (!Number.isFinite(prix) || prix < 0 || prix > 100000) fail(`Option ${i + 1} : prix invalide.`);
      const duree = oo.duree_minutes === undefined || oo.duree_minutes === null ? 0 : Number(oo.duree_minutes);
      if (!Number.isFinite(duree) || duree < 0 || duree > MAX_DURATION_MINUTES) fail(`Option ${i + 1} : durée invalide.`);
      return {
        id: cleanText(oo.id, 80, `Option ${i + 1} : identifiant`, true),
        nom: cleanText(oo.nom, 200, `Option ${i + 1} : nom`, true),
        prix_chf: Math.round(prix * 100) / 100,
        duree_minutes: Math.round(duree),
        ajoute_par: oo.ajoute_par === 'cliente' ? 'cliente' : 'admin',
      } as BookingOption;
    });
  }
  if (p.nom !== undefined) out.nom = cleanText(p.nom, 80, 'Nom', true);
  if (p.prenom !== undefined) out.prenom = cleanText(p.prenom, 80, 'Prénom', true);
  if (p.telephone !== undefined) out.telephone = cleanPhone(p.telephone);
  if (p.email !== undefined) out.email = cleanEmail(p.email);
  if (p.code_postal !== undefined) out.code_postal = cleanText(p.code_postal, 10, 'Code postal') || null;
  if (p.ville !== undefined) out.ville = cleanText(p.ville, 80, 'Ville') || null;
  if (p.client_id !== undefined) {
    if (p.client_id !== null && (typeof p.client_id !== 'string' || !UUID_RE.test(p.client_id))) fail('Identifiant de cliente invalide.');
    out.client_id = (p.client_id as string | null) || null;
  }
  if (p.contacte_at !== undefined) {
    if (p.contacte_at !== null && (typeof p.contacte_at !== 'string' || isNaN(Date.parse(p.contacte_at)))) fail('Date de contact invalide.');
    out.contacte_at = p.contacte_at ? new Date(p.contacte_at as string).toISOString() : null;
  }
  if (p.notify_client !== undefined) {
    if (typeof p.notify_client !== 'boolean') fail('notify_client : vrai ou faux attendu.');
    out.notify_client = p.notify_client as boolean;
  }
  if (p.force !== undefined) out.force = p.force === true;
  if (p.source !== undefined) {
    if (p.source !== 'admin' && p.source !== 'telephone') fail('Source invalide (admin ou telephone).');
    out.source = p.source as 'admin' | 'telephone';
  }
  return out;
}

/** Période d'un horaire arrêté, selon la coupure des réglages. */
function periodeFor(heure: string, settings: BookingSettings): BookingPeriode {
  return periodeOfTime(heure, settings);
}

/** Heure indicative d'une demande souple : premier créneau libre de la période, sinon début de plage. */
async function indicativeHour(
  date: string,
  periode: BookingPeriode,
  duration: number,
  excludeId: string | undefined,
  settings: BookingSettings,
): Promise<string | null> {
  try {
    const data = await loadDayData(date, false);
    const r = computeDay({
      date,
      duration,
      settings,
      blocks: data.blocks,
      bookings: data.bookings,
      now: zurichNow(),
      excludeId,
      mode: 'admin',
    });
    const inPeriod = r.slots.filter((s) => s.periode === periode);
    return (inPeriod.find((s) => s.disponible) ?? inPeriod[0])?.heure ?? null;
  } catch {
    return null;
  }
}

/**
 * Best effort : l'événement Google Agenda du rendez-vous édité occupe lui-même son ancien créneau.
 * On retire l'occupation FreeBusy de même intervalle exact, pour qu'un déplacement qui chevauche
 * son ancien horaire ne se signale pas lui-même.
 */
function dropOwnGoogleEvent(busy: Interval[], own: Booking | undefined, date: string): Interval[] {
  if (!own || !own.gcal_event_id || own.date_rdv !== date || !own.horaire_fixe) return busy;
  const start = timeToMinutes(own.heure_rdv);
  const end = start + own.service_duree_minutes;
  return busy.filter((i) => !(i.start === start && i.end === end));
}

/** Conflits à signaler pour un rendez-vous actif (arrêté ou souple). */
async function detectConflicts(
  next: Pick<Booking, 'date_rdv' | 'heure_rdv' | 'periode' | 'horaire_fixe' | 'service_duree_minutes'>,
  excludeId: string | undefined,
  own?: Booking,
): Promise<BookingConflict[]> {
  const data = await loadDayData(next.date_rdv);
  data.externalBusy = dropOwnGoogleEvent(data.externalBusy, own, next.date_rdv);
  if (next.horaire_fixe) {
    return findFixedConflicts({
      date: next.date_rdv,
      heure: next.heure_rdv,
      duration: next.service_duree_minutes,
      settings: data.settings,
      blocks: data.blocks,
      bookings: data.bookings,
      externalBusy: data.externalBusy,
      excludeId,
      now: zurichNow(),
    });
  }
  // Demande souple : la période doit encore avoir de la place.
  const r = computeDay({
    date: next.date_rdv,
    duration: next.service_duree_minutes,
    settings: data.settings,
    blocks: data.blocks,
    bookings: data.bookings,
    externalBusy: data.externalBusy,
    now: zurichNow(),
    excludeId,
    ignoreBounds: true,
  });
  if (!r.ouvert) {
    return [
      {
        type: r.motif && r.motif.startsWith('Fermé') ? 'hors_horaires' : 'blocage',
        libelle: r.motif || 'Indisponible ce jour.',
      },
    ];
  }
  const periode = next.periode ?? 'matin';
  if (!r.periodes[periode].disponible) {
    return [
      {
        type: 'rdv',
        libelle: `La période « ${PERIODE_LABEL[periode].toLowerCase()} » n'a plus de place pour ce soin ce jour-là.`,
      },
    ];
  }
  return [];
}

// ── Création publique ────────────────────────────────────────────────────────

interface ValidatedPublicRequest {
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  code_postal: string | null;
  ville: string | null;
  service_id: string;
  optionIds: string[];
  offer_of_month_id: string | null;
  variantMinutes: number | null;
  date_rdv: string;
  periode: BookingPeriode;
  notes_cliente: string | null;
  consent_email: boolean;
  consent_whatsapp: boolean;
}

/** Le champ-piège `champ_piege` est rempli (`website` est ignoré) : c'est un robot (la route répond 200 sans rien écrire). */
export function isHoneypotTriggered(raw: unknown): boolean {
  return isPlainObject(raw) && typeof raw.champ_piege === 'string' && raw.champ_piege.trim() !== '';
}

function validatePublicRequest(raw: unknown): ValidatedPublicRequest {
  if (!isPlainObject(raw)) fail('Requête invalide.');
  const r = raw as Record<string, unknown>;

  let offer: string | null = null;
  if (r.offer_of_month_id !== undefined && r.offer_of_month_id !== null && r.offer_of_month_id !== '') {
    if (typeof r.offer_of_month_id !== 'string' || !UUID_RE.test(r.offer_of_month_id)) fail('Offre invalide.');
    offer = r.offer_of_month_id as string;
  }

  // Une offre du moment se réserve comme un soin : `service_id` n'est alors pas requis.
  if (!offer && (typeof r.service_id !== 'string' || !r.service_id.trim() || r.service_id.length > 80)) fail('Choisissez un soin.');
  if (!isValidDateStr(r.date_rdv)) fail('Date invalide.');
  if (!PERIODES.includes(r.periode as BookingPeriode)) fail('Choisissez le matin ou l\'après-midi.');

  const optionIds: string[] = [];
  if (r.options !== undefined && r.options !== null) {
    if (!Array.isArray(r.options) || r.options.length > 6) fail('Options : 6 au maximum.');
    for (const o of r.options as unknown[]) {
      const id = isPlainObject(o) ? o.id : undefined;
      if (typeof id !== 'string' || !id.trim() || id.length > 80) fail('Option invalide.');
      if (!optionIds.includes(id as string)) optionIds.push(id as string);
    }
  }

  let variantMinutes: number | null = null;
  const vm = (r as any).variante_duree_minutes;
  if (vm !== undefined && vm !== null) {
    const n = Number(vm);
    if (!Number.isInteger(n) || n < 5 || n > MAX_DURATION_MINUTES) fail('Durée du soin invalide.');
    variantMinutes = n;
  }

  return {
    nom: cleanText(r.nom, 80, 'Votre nom', true),
    prenom: cleanText(r.prenom, 80, 'Votre prénom', true),
    telephone: cleanPhone(r.telephone),
    email: cleanEmail(r.email),
    code_postal: cleanText(r.code_postal, 10, 'Code postal') || null,
    ville: cleanText(r.ville, 80, 'Localité') || null,
    service_id: offer ? '' : (r.service_id as string).trim(),
    optionIds: offer ? [] : optionIds,
    offer_of_month_id: offer,
    variantMinutes,
    date_rdv: r.date_rdv as string,
    periode: r.periode as BookingPeriode,
    notes_cliente: cleanText(r.notes_cliente, 1000, 'Votre message') || null,
    consent_email: r.consent_email === true,
    consent_whatsapp: r.consent_whatsapp === true,
  };
}

export function toPublicView(b: Booking): PublicBookingView {
  return {
    id: b.id,
    service_nom: b.service_nom,
    options: b.options.map((o) => ({ nom: o.nom, prix_chf: o.prix_chf })),
    date_rdv: b.date_rdv,
    periode: b.periode ?? periodeOfTime(b.heure_rdv, DEFAULT_BOOKING_SETTINGS),
    service_duree_minutes: b.service_duree_minutes,
    total_chf: b.total_chf ?? bookingTotal(b),
  };
}

/**
 * Offre du moment réservable en ligne pour un soin le `dateRdv` : publiée, non
 * archivée, ouverte à la réservation, en cours (« présente dans les dates
 * imparties »), soin dans la période, et encore une place. 503 si les compteurs
 * ne répondent pas — on ne vend pas une place qu'on ne sait pas compter.
 */
async function loadBookableOffer(db: SupabaseClient, id: string, dateRdv: string, today: string): Promise<Offer> {
  let offer: Offer | null;
  try {
    offer = await fetchOffer(db, id);
  } catch {
    throw new BookingError(503, 'Les offres du moment sont momentanément indisponibles. Merci de réessayer dans quelques instants.');
  }
  if (!offer || !offer.active || offer.archived_at || !offer.reservable_en_ligne || today < offer.date_debut || today > offer.date_fin) {
    throw new BookingError(422, 'Cette offre du moment n\'est plus disponible.', undefined, 'offre_indisponible');
  }
  if (!isDateInOffer(offer, dateRdv)) {
    throw new BookingError(
      422,
      `Cette offre est valable jusqu'au ${formatDateLong(offer.date_fin)} : choisissez une date dans cette période.`,
      undefined,
      'offre_indisponible',
    );
  }
  if (offer.places_max != null) {
    let stats;
    try {
      stats = await fetchOfferStats(db, [offer.id]);
    } catch {
      throw new BookingError(503, 'Les offres du moment sont momentanément indisponibles. Merci de réessayer dans quelques instants.');
    }
    if (placesRestantes(offer, stats.get(offer.id) ?? { offer_id: offer.id, ...EMPTY_STATS }) === 0) {
      throw new BookingError(409, 'Toutes les places de cette offre ont été réservées.', undefined, 'offre_complete');
    }
  }
  return offer;
}

/**
 * Après insertion : la demande tient-elle dans les places de l'offre ? Calcul
 * déterministe (factures + rang de la demande parmi les réservations à venir,
 * ordre `created_at, id`), donc deux requêtes simultanées tranchent pareil.
 * Lève une erreur si la base ne répond pas : l'appelant retire alors la ligne.
 */
async function offerPlaceHeld(db: SupabaseClient, offer: Offer, bookingId: string): Promise<boolean> {
  if (offer.places_max == null) return true;
  const [rowsRes, stats] = await Promise.all([
    db
      .from('bookings')
      .select('id')
      .eq('offer_of_month_id', offer.id)
      .in('statut', ['en_attente', 'confirme'])
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    fetchOfferStats(db, [offer.id]),
  ]);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  const rank = (rowsRes.data ?? []).findIndex((r: { id: string }) => r.id === bookingId) + 1;
  const facturations = stats.get(offer.id)?.facturations ?? 0;
  return rank > 0 && facturations + rank <= offer.places_max;
}

/**
 * Création d'une demande par une cliente (POST /api/bookings).
 *
 *  1. validation stricte ; prix, durée et options retrouvés AU CATALOGUE (jamais crus
 *     sur le navigateur) ; offre du moment relue en base ;
 *  2. la période demandée doit avoir de la place (sinon 409) ;
 *  3. INSERT, puis RE-VÉRIFICATION déterministe (même calcul, ordre `created_at, id`,
 *     ligne insérée comprise) : si la demande n'est plus placée, elle est supprimée
 *     et la cliente reçoit un 409 ;
 *  4. seulement ensuite : fiche CRM, journal, e-mails, automatisation.
 */
export async function createPublicBooking(raw: unknown): Promise<{ booking: Booking; view: PublicBookingView }> {
  const input = validatePublicRequest(raw);
  const db = adminDb(); // 503 sans client de service : on n'écrit jamais en `anon`

  // Bornes de date (Zurich)
  const settings = await getBookingSettings({ strict: true });
  const now = zurichNow();
  const bounds = dateBoundsError(input.date_rdv, settings, now);
  if (bounds) fail(bounds);

  // Soin, options, offre : tout vient du serveur
  let service: CatalogEntry;
  let offer: Offer | null = null;
  const options: BookingOption[] = [];
  if (input.offer_of_month_id) {
    // L'offre EST le soin : son prix, sa durée, sa période et ses places font foi.
    offer = await loadBookableOffer(db, input.offer_of_month_id, input.date_rdv, now.date);
    service = offerCatalogEntry(offer);
  } else {
    const entry = await lookupCatalogEntry(db, input.service_id, { onlyActive: true, variantMinutes: input.variantMinutes });
    if (!entry) throw new BookingError(422, 'Ce soin n\'est pas disponible. Merci d\'en choisir un autre.', undefined, 'soin_inconnu');
    if (entry.kind !== 'service') throw new BookingError(422, 'Ce soin ne se réserve pas en ligne : contactez directement l\'institut.', undefined, 'soin_inconnu');
    // Une offre passée par `service_id` (`offre:<uuid>`) contournerait le contrôle des places.
    if (entry.origine === 'offre') throw new BookingError(422, 'Cette offre du moment n\'est plus disponible.', undefined, 'offre_indisponible');
    service = entry;

    for (const id of input.optionIds) {
      const opt = await lookupCatalogEntry(db, id, { onlyActive: true });
      if (!opt || opt.kind !== 'option') throw new BookingError(422, 'Une des options choisies n\'est plus disponible.', undefined, 'soin_inconnu');
      options.push({ id: opt.id, nom: opt.nom, prix_chf: opt.prix_chf, duree_minutes: opt.duree_minutes, ajoute_par: 'cliente' });
    }
  }

  const duree = service.duree_minutes + sumOptionDurations(options);
  if (duree > MAX_DURATION_MINUTES) fail('La durée totale demandée est trop longue.');
  const total = bookingTotal({ service_prix_chf: service.prix_chf, options });

  // Anti-spam léger : trop de demandes en cours avec le même numéro
  const { count: enCours } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('telephone', input.telephone)
    .eq('source', 'en_ligne')
    .eq('statut', 'en_attente');
  if ((enCours ?? 0) >= 3) {
    throw new BookingError(409, 'Vous avez déjà plusieurs demandes en cours. Emmanuelle vous rappellera très prochainement.', undefined, 'trop_de_demandes');
  }

  // La période a-t-elle de la place ?
  const dayData = await loadDayData(input.date_rdv);
  const dispo = computeDay({
    date: input.date_rdv,
    duration: duree,
    settings: dayData.settings,
    blocks: dayData.blocks,
    bookings: dayData.bookings,
    externalBusy: dayData.externalBusy,
    now,
  });
  const periodeDispo = dispo.periodes[input.periode];
  if (!dispo.ouvert || !periodeDispo.disponible || !periodeDispo.premier_creneau) {
    throw new BookingError(409, 'Cette période n\'est plus disponible. Merci d\'en choisir une autre.', undefined, 'periode_complete');
  }

  const insertRow = {
    client_id: null,
    nom: input.nom,
    prenom: input.prenom,
    telephone: input.telephone,
    email: input.email,
    code_postal: input.code_postal,
    ville: input.ville,
    service_id: service.id,
    service_nom: service.nom,
    service_prix_chf: service.prix_chf,
    service_duree_minutes: duree,
    options,
    offer_of_month_id: input.offer_of_month_id,
    date_rdv: input.date_rdv,
    heure_rdv: periodeDispo.premier_creneau,
    periode: input.periode,
    horaire_fixe: false,
    date_demandee: input.date_rdv,
    periode_demandee: input.periode,
    total_chf: total,
    source: 'en_ligne',
    statut: 'en_attente',
    notes_cliente: input.notes_cliente,
    optin_promotions: input.consent_email || input.consent_whatsapp,
  };

  const { data: inserted, error: insertError } = await db.from('bookings').insert(insertRow).select().single();
  if (insertError || !inserted) {
    if (insertError?.code === '23505') {
      throw new BookingError(409, 'Vous avez déjà une demande pour cette date et cette période. Emmanuelle vous rappellera pour la confirmer.', undefined, 'doublon');
    }
    console.error('[createPublicBooking] INSERT refusé:', insertError);
    const msg = insertError?.message ?? '';
    if (/column .* does not exist|schema cache/i.test(msg)) {
      throw new BookingError(503, 'Le service de réservation est en cours de mise à jour. Merci de réessayer dans quelques minutes.');
    }
    throw new BookingError(500, 'Votre demande n\'a pas pu être enregistrée. Merci de réessayer ou d\'appeler l\'institut.');
  }
  let booking = normalizeBookingRow(inserted);

  // Re-vérification déterministe, ligne insérée comprise
  try {
    const after = await loadDayData(input.date_rdv, false);
    const verif = computeDay({
      date: input.date_rdv,
      duration: duree,
      settings: after.settings,
      blocks: after.blocks,
      bookings: after.bookings,
      now,
      ignoreBounds: true,
    });
    const placement = verif.placements.find((p) => p.booking_id === booking.id);
    if (!verif.ouvert || !placement) {
      await db.from('bookings').delete().eq('id', booking.id);
      throw new BookingError(409, 'Cette période vient d\'être prise par une autre demande. Merci d\'en choisir une autre.', undefined, 'periode_complete');
    }
    // Même principe pour les places d'une offre limitée : deux clientes qui
    // prennent la dernière place à la même seconde ne la gardent pas toutes les deux.
    if (offer && !(await offerPlaceHeld(db, offer, booking.id))) {
      await db.from('bookings').delete().eq('id', booking.id);
      throw new BookingError(409, 'La dernière place de cette offre vient d\'être réservée. Choisissez un autre soin ou contactez l\'institut.', undefined, 'offre_complete');
    }
    if (placement.heure !== booking.heure_rdv) {
      const { data: upd } = await db.from('bookings').update({ heure_rdv: placement.heure }).eq('id', booking.id).select().single();
      if (upd) booking = normalizeBookingRow(upd);
    }
  } catch (err) {
    if (err instanceof BookingError) throw err;
    // Impossible de re-vérifier : on retire la ligne plutôt que de risquer une surréservation.
    await db.from('bookings').delete().eq('id', booking.id);
    throw new BookingError(503, 'Votre demande n\'a pas pu être vérifiée. Merci de réessayer dans quelques instants.');
  }

  await logEvent(
    db,
    booking.id,
    'creation',
    { source: 'en_ligne', date: booking.date_rdv, periode: booking.periode, total_chf: booking.total_chf },
    'cliente',
  );

  const clientId = await linkBookingToClient(
    db,
    booking,
    { email: input.consent_email, whatsapp: input.consent_whatsapp },
    'systeme',
  );
  if (clientId) booking = { ...booking, client_id: clientId };

  // E-mails : attendus avant de répondre (une fonction serverless est gelée dès la réponse envoyée).
  await sendNewRequestMails(db, booking, settings).catch((err) => console.warn('[createPublicBooking] E-mails:', err));

  try {
    await emitAutomationEvent('booking.created', SITE_CONFIG.url);
  } catch {
    // non bloquant
  }

  return { booking, view: toPublicView(booking) };
}

// ── Écriture admin ───────────────────────────────────────────────────────────

/** Soin + options → champs recalculés par le serveur. */
function buildServiceFields(base: { nom: string; prix: number; duree: number }, options: BookingOption[]) {
  const duree = Math.min(MAX_DURATION_MINUTES * 2, Math.max(1, Math.round(base.duree)) + sumOptionDurations(options));
  return {
    service_nom: base.nom,
    service_prix_chf: base.prix,
    service_duree_minutes: duree,
    options,
    total_chf: bookingTotal({ service_prix_chf: base.prix, options }),
  };
}

/** Saisie d'un rendez-vous par l'administratrice (téléphone, passage à l'institut…). */
export async function createAdminBooking(patch: BookingPatch): Promise<{ booking: Booking; warnings: string[] }> {
  const db = adminDb();
  const p = validatePatch(patch);
  const warnings: string[] = [];

  if (!p.nom || !p.prenom || !p.telephone) fail('Nom, prénom et téléphone sont requis.');
  if (!p.date_rdv || !p.heure_rdv) fail('La date et l\'heure sont requises.');
  if (!p.service_id && !p.service_nom) fail('Indiquez le soin.');

  const settings = await getBookingSettings({ strict: true });

  // Soin : catalogue si on a un identifiant, valeurs explicites prioritaires
  let nom = p.service_nom;
  let prix = p.service_prix_chf;
  let duree = p.service_duree_soin_minutes;
  if (p.service_id) {
    const entry = await lookupCatalogEntry(db, p.service_id, { onlyActive: false });
    if (!entry && (nom === undefined || prix === undefined)) throw new BookingError(422, 'Soin inconnu dans le catalogue.');
    nom = nom ?? entry?.nom;
    prix = prix ?? entry?.prix_chf;
    duree = duree ?? entry?.duree_minutes;
  }
  if (!nom) fail('Indiquez le soin.');
  if (prix === undefined) fail('Indiquez le prix du soin.');
  const fields = buildServiceFields({ nom: nom as string, prix: prix as number, duree: duree ?? 60 }, p.options ?? []);

  const statut = p.statut ?? 'confirme';
  const horaireFixe = p.horaire_fixe ?? true;
  const periode = horaireFixe ? periodeFor(p.heure_rdv as string, settings) : p.periode ?? periodeFor(p.heure_rdv as string, settings);

  const next = {
    date_rdv: p.date_rdv as string,
    heure_rdv: p.heure_rdv as string,
    periode,
    horaire_fixe: horaireFixe,
    service_duree_minutes: fields.service_duree_minutes,
  };
  if (ACTIVE_STATUSES.includes(statut)) {
    const conflicts = await detectConflicts(next, undefined);
    if (conflicts.length > 0) {
      if (!p.force) throw new BookingError(409, 'Ce créneau n\'est pas libre.', conflicts);
      warnings.push(...conflicts.map((c) => `Enregistré malgré : ${c.libelle}`));
    }
  }

  const nowIso = new Date().toISOString();
  const row = {
    client_id: p.client_id ?? null,
    nom: p.nom,
    prenom: p.prenom,
    telephone: p.telephone,
    email: p.email ?? null,
    code_postal: p.code_postal ?? null,
    ville: p.ville ?? null,
    service_id: p.service_id ?? null,
    ...fields,
    // Offre du moment choisie dans l'agenda : elle compte dans ses places.
    offer_of_month_id: offerIdFromServiceId(p.service_id),
    date_rdv: next.date_rdv,
    heure_rdv: next.heure_rdv,
    periode,
    horaire_fixe: horaireFixe,
    date_demandee: next.date_rdv,
    periode_demandee: periode,
    source: p.source ?? 'admin',
    statut,
    notes_admin: p.notes_admin ?? null,
    notes_cliente: null,
    contacte_at: p.contacte_at ?? (statut === 'confirme' || statut === 'termine' ? nowIso : null),
    optin_promotions: false,
  };

  const { data, error } = await db.from('bookings').insert(row).select().single();
  if (error || !data) {
    console.error('[createAdminBooking] INSERT refusé:', error);
    throw new BookingError(500, 'Enregistrement impossible. Merci de réessayer.');
  }
  let booking = normalizeBookingRow(data);

  await logEvent(db, booking.id, 'creation', { source: row.source, statut, date: row.date_rdv, heure: row.heure_rdv }, 'admin');

  if (!booking.client_id) {
    const clientId = await linkBookingToClient(db, booking, {}, 'admin'); // consentements : jamais accordés ici
    if (clientId) booking = { ...booking, client_id: clientId };
  }

  booking = await syncGoogleEventAfterWrite(db, null, booking, settings);

  // Aucune notification à l'institut pour une saisie admin. La cliente n'est prévenue que sur demande.
  if (p.notify_client === true) {
    if (!booking.email) warnings.push('Aucune adresse e-mail : la cliente n\'a pas été prévenue.');
    else if (booking.statut === 'confirme' && booking.horaire_fixe) {
      const sent = await sendClientMail(db, booking, 'confirmation', {}, 'admin');
      if (sent.ok) booking = { ...booking, confirmation_envoyee_at: sent.at ?? booking.confirmation_envoyee_at };
      else warnings.push(`E-mail non envoyé : ${sent.error}`);
    } else {
      warnings.push('E-mail non envoyé : le rendez-vous n\'est pas confirmé à un horaire arrêté.');
    }
  }

  return { booking, warnings };
}

/** « 05.10 matin » (demande souple) ou « 06.10 10:00 » (horaire arrêté) : lisible dans le journal. */
function slotLabel(b: Pick<Booking, 'date_rdv' | 'heure_rdv' | 'periode' | 'horaire_fixe'>): string {
  const [, m, d] = b.date_rdv.split('-');
  const quand = b.horaire_fixe ? b.heure_rdv : b.periode === 'apres_midi' ? 'après-midi' : 'matin';
  return `${d}.${m} ${quand}`;
}

/**
 * Modification d'un rendez-vous (PLAN §4).
 *  - le serveur recalcule durée totale et `total_chf` ;
 *  - un changement de date/heure/période écrit un événement `deplacement` ;
 *  - `confirme` fixe l'horaire (`horaire_fixe`) et date l'appel (`contacte_at`) ;
 *  - conflits d'agenda → 409 avec `conflicts[]`, sauf `force` ;
 *  - e-mails : seulement si quelque chose de pertinent a changé (voir `decideMail`).
 */
export async function updateBooking(
  id: string,
  patch: BookingPatch,
  opts: { notify?: boolean; actor?: BookingEvent['actor'] } = {},
): Promise<{ booking: Booking; warnings: string[] }> {
  const db = adminDb();
  const actor = opts.actor ?? 'admin';
  const existing = await fetchBooking(db, id);
  const p = validatePatch(patch);
  const settings = await getBookingSettings({ strict: true });
  const warnings: string[] = [];

  const next: Booking = { ...existing };

  // Coordonnées
  if (p.nom !== undefined) next.nom = p.nom;
  if (p.prenom !== undefined) next.prenom = p.prenom;
  if (p.telephone !== undefined) next.telephone = p.telephone;
  if (p.email !== undefined) next.email = p.email;
  if (p.code_postal !== undefined) next.code_postal = p.code_postal;
  if (p.ville !== undefined) next.ville = p.ville;
  if (p.client_id !== undefined) next.client_id = p.client_id;
  if (p.notes_admin !== undefined) next.notes_admin = p.notes_admin;

  // Soin & options → durée et total recalculés
  let baseNom = existing.service_nom;
  let basePrix = existing.service_prix_chf;
  let baseDuree = Math.max(1, existing.service_duree_minutes - sumOptionDurations(existing.options));
  if (p.service_id !== undefined && p.service_id !== existing.service_id) {
    if (p.service_id) {
      const entry = await lookupCatalogEntry(db, p.service_id, { onlyActive: false });
      if (entry) {
        baseNom = entry.nom;
        basePrix = entry.prix_chf;
        baseDuree = entry.duree_minutes;
      } else if (p.service_nom === undefined) {
        throw new BookingError(422, 'Soin inconnu dans le catalogue.');
      }
    }
    next.service_id = p.service_id;
    next.offer_of_month_id = offerIdFromServiceId(p.service_id);
  }
  if (p.service_nom !== undefined) baseNom = p.service_nom;
  if (p.service_prix_chf !== undefined) basePrix = p.service_prix_chf;
  if (p.service_duree_soin_minutes !== undefined) baseDuree = p.service_duree_soin_minutes;
  const options = p.options ?? existing.options;
  const fields = buildServiceFields({ nom: baseNom, prix: basePrix, duree: baseDuree }, options);
  next.service_nom = fields.service_nom;
  next.service_prix_chf = fields.service_prix_chf;
  next.service_duree_minutes = fields.service_duree_minutes;
  next.options = fields.options;
  next.total_chf = fields.total_chf;

  // Statut, horaire, période
  next.statut = p.statut ?? existing.statut;
  next.date_rdv = p.date_rdv ?? existing.date_rdv;
  next.heure_rdv = p.heure_rdv ?? existing.heure_rdv;
  next.horaire_fixe = p.horaire_fixe ?? existing.horaire_fixe;
  if (p.horaire_fixe === undefined && (next.statut === 'confirme' || next.statut === 'termine')) next.horaire_fixe = true;

  const dateChanged = next.date_rdv !== existing.date_rdv;
  const heureChanged = next.heure_rdv !== existing.heure_rdv;
  if (next.horaire_fixe) {
    next.periode = periodeFor(next.heure_rdv, settings);
  } else {
    next.periode = p.periode ?? (p.heure_rdv !== undefined ? periodeFor(next.heure_rdv, settings) : existing.periode ?? periodeFor(next.heure_rdv, settings));
    // Demande souple déplacée sans heure : nouvelle heure indicative dans la période.
    if (p.heure_rdv === undefined && (dateChanged || next.periode !== existing.periode)) {
      const h = await indicativeHour(next.date_rdv, next.periode as BookingPeriode, next.service_duree_minutes, id, settings);
      if (h) next.heure_rdv = h;
    }
  }
  if (next.statut === 'confirme' && !next.contacte_at) next.contacte_at = new Date().toISOString();
  if (p.contacte_at !== undefined) next.contacte_at = p.contacte_at;

  const moved =
    next.date_rdv !== existing.date_rdv ||
    next.heure_rdv !== existing.heure_rdv ||
    next.periode !== existing.periode ||
    next.horaire_fixe !== existing.horaire_fixe;
  const statutChanged = next.statut !== existing.statut;

  // Conflits : seulement si le temps occupé a réellement changé
  const wasActive = ACTIVE_STATUSES.includes(existing.statut);
  const isActive = ACTIVE_STATUSES.includes(next.statut);
  const durationChanged = next.service_duree_minutes !== existing.service_duree_minutes;
  if (isActive && (moved || durationChanged || !wasActive)) {
    const conflicts = await detectConflicts(next, id, existing);
    if (conflicts.length > 0) {
      if (!p.force) throw new BookingError(409, 'Ce créneau n\'est pas libre.', conflicts);
      warnings.push(...conflicts.map((c) => `Enregistré malgré : ${c.libelle}`));
    }
  }

  // Colonnes réellement modifiées
  const updates: Record<string, unknown> = {};
  const changed: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const track = (key: keyof Booking, group?: string) => {
    if (!same(next[key], existing[key])) {
      updates[key as string] = next[key];
      if (group) changed.push(group);
    }
  };
  track('nom', 'coordonnées');
  track('prenom', 'coordonnées');
  track('telephone', 'coordonnées');
  track('email', 'coordonnées');
  track('code_postal', 'coordonnées');
  track('ville', 'coordonnées');
  track('client_id');
  track('service_id', 'soin');
  track('offer_of_month_id');
  track('service_nom', 'soin');
  track('service_prix_chf', 'soin');
  track('service_duree_minutes', 'soin');
  track('options', 'options');
  track('total_chf');
  track('date_rdv');
  track('heure_rdv');
  track('periode');
  track('horaire_fixe');
  track('statut');
  track('notes_admin');
  track('contacte_at');
  if (!existing.date_demandee) updates.date_demandee = existing.date_rdv;
  if (!existing.periode_demandee) updates.periode_demandee = existing.periode;

  if (Object.keys(updates).length === 0) {
    if (p.notify_client === true || opts.notify === true) warnings.push('Aucun changement : e-mail non envoyé.');
    return { booking: existing, warnings };
  }

  updates.updated_at = new Date().toISOString();
  const { data, error } = await db.from('bookings').update(updates).eq('id', id).select().single();
  if (error?.code === '23505') {
    throw new BookingError(409, 'Cette cliente a déjà une demande en ligne ce jour-là à cette période.', undefined, 'doublon');
  }
  if (error || !data) {
    console.error('[updateBooking] UPDATE refusé:', error);
    throw new BookingError(500, 'Mise à jour impossible. Merci de réessayer.');
  }
  let booking = normalizeBookingRow(data);

  // Journal
  const snap = (b: Booking) => ({ date: b.date_rdv, heure: b.heure_rdv, periode: b.periode, horaire_fixe: b.horaire_fixe });
  // « Déplacement » = la date ou l'heure change vraiment (pour une demande souple : la date ou la
  // période — son heure n'est qu'indicative). Arrêter l'horaire à la confirmation n'en est pas un.
  const movedForLog = existing.horaire_fixe
    ? booking.date_rdv !== existing.date_rdv || booking.heure_rdv !== existing.heure_rdv
    : booking.date_rdv !== existing.date_rdv || booking.periode !== existing.periode;
  if (movedForLog) {
    await logEvent(
      db,
      id,
      'deplacement',
      { de: slotLabel(existing), vers: slotLabel(booking), avant: snap(existing), apres: snap(booking) },
      actor,
    );
  } else if (booking.heure_rdv !== existing.heure_rdv || booking.horaire_fixe !== existing.horaire_fixe) {
    changed.push('horaire');
  }
  if (statutChanged) {
    await logEvent(
      db,
      id,
      'statut',
      {
        de: STATUT_LABEL[existing.statut],
        vers: STATUT_LABEL[booking.statut],
        statut_avant: existing.statut,
        statut_apres: booking.statut,
        ...(!existing.horaire_fixe && booking.horaire_fixe ? { horaire: `arrêté à ${booking.heure_rdv}` } : {}),
      },
      actor,
    );
  }
  const modifGroups = [...new Set(changed)];
  if (modifGroups.length > 0) {
    await logEvent(
      db,
      id,
      'modification',
      { champs: modifGroups, total_chf: { avant: existing.total_chf, apres: booking.total_chf } },
      actor,
    );
  }
  if (!same(existing.contacte_at, booking.contacte_at)) {
    await logEvent(db, id, 'contact', { contacte_at: booking.contacte_at }, actor);
  }
  if (!same(existing.notes_admin, booking.notes_admin)) {
    await logEvent(db, id, 'note', { notes_admin: booking.notes_admin }, actor);
  }

  // Google Agenda (non bloquant)
  booking = await syncGoogleEventAfterWrite(db, existing, booking, settings);

  // E-mail à la cliente
  const wanted = opts.notify ?? p.notify_client;
  const decision = decideMail(existing, booking, wanted);
  if (decision.warning) warnings.push(decision.warning);
  if (decision.template) {
    if (!booking.email) {
      warnings.push('Aucune adresse e-mail : la cliente n\'a pas été prévenue.');
    } else {
      const sent = await sendClientMail(db, booking, decision.template, { previous: existing }, actor);
      if (sent.ok) booking = { ...booking, confirmation_envoyee_at: sent.at ?? booking.confirmation_envoyee_at };
      else warnings.push(`E-mail non envoyé : ${sent.error}`);
    }
  }

  return { booking, warnings };
}

export type MailTemplate = 'accuse' | 'confirmation' | 'deplacement' | 'annulation' | 'refus';

/**
 * Politique d'envoi (PLAN §4). Par défaut, e-mail seulement pour : première
 * confirmation, déplacement d'un rendez-vous déjà confirmé, annulation/refus.
 * `wanted === false` coupe tout ; `true` ne force JAMAIS un renvoi quand rien de
 * pertinent n'a changé (note, téléphone…).
 */
export function decideMail(
  before: Booking,
  after: Booking,
  wanted: boolean | undefined,
): { template: MailTemplate | null; warning?: string } {
  if (wanted === false) return { template: null };

  let template: MailTemplate | null = null;
  const statutChanged = before.statut !== after.statut;
  const movedWhileConfirmed =
    before.statut === 'confirme' &&
    after.statut === 'confirme' &&
    after.horaire_fixe &&
    (before.date_rdv !== after.date_rdv || before.heure_rdv !== after.heure_rdv);

  if (statutChanged && after.statut === 'confirme' && after.horaire_fixe) template = 'confirmation';
  else if (statutChanged && (after.statut === 'annule' || after.statut === 'refuse') && ACTIVE_STATUSES.includes(before.statut)) {
    template = after.statut === 'refuse' ? 'refus' : 'annulation';
  } else if (movedWhileConfirmed) template = 'deplacement';

  if (!template) {
    return wanted === true
      ? { template: null, warning: 'Rien de pertinent n\'a changé pour la cliente : e-mail non envoyé.' }
      : { template: null };
  }
  return { template };
}

/**
 * Suppression : réservée aux demandes `en_attente`, `refuse` ou `annule`
 * (spam, essais). Un rendez-vous confirmé ou terminé s'annule, il ne s'efface pas.
 */
export async function deleteBooking(id: string): Promise<void> {
  const db = adminDb();
  const existing = await fetchBooking(db, id);
  if (!(['en_attente', 'refuse', 'annule'] as BookingStatus[]).includes(existing.statut)) {
    throw new BookingError(
      409,
      'Un rendez-vous confirmé ou terminé ne se supprime pas : annulez-le (il reste au journal).',
    );
  }
  const { error } = await db.from('bookings').delete().eq('id', id);
  if (error) throw new BookingError(500, `Suppression impossible : ${error.message}`);
  if (existing.gcal_event_id) await deleteGoogleCalendarEvent(existing.gcal_event_id).catch(() => false);
}

// ── E-mails ──────────────────────────────────────────────────────────────────

/** Échappe tout texte interpolé dans du HTML (nom, notes, soin, ville…). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pas de saut de ligne dans un objet d'e-mail (injection d'en-tête). */
function oneLine(s: unknown): string {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
}

/** `CHF 1'234.50` : convention suisse (de-CH), centimes affichés dès qu'il y en a. */
export function chfMail(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const fraction = Number.isInteger(v) ? 0 : 2;
  return `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: fraction, maximumFractionDigits: 2 }).format(v)}`;
}

/** « lundi 5 octobre 2026 », calculé en Zurich quel que soit le fuseau du serveur. */
export function formatDateLong(date: string): string {
  const [y, m, d] = date.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  });
}

function periodeText(p: BookingPeriode | null): string {
  return p === 'apres_midi' ? 'l\'après-midi' : 'le matin';
}

export interface Biz {
  name: string;
  phone: string;
  email: string;
  address: string;
}

async function getBiz(): Promise<Biz> {
  try {
    const b = await getBusinessInfoServer();
    const ville = [b.addressPostal, b.addressCity].filter(Boolean).join(' ');
    return {
      name: b.name || 'Emmanuelle Esthétique',
      phone: (b.phone || '').trim(),
      email: (b.email || '').trim(),
      address: [b.addressStreet, ville].filter(Boolean).join(', ') || 'Palézieux-Gare',
    };
  } catch {
    return { name: 'Emmanuelle Esthétique', phone: '', email: SITE_CONFIG.receiverEmail, address: 'Palézieux-Gare' };
  }
}

function mailRow(label: string, valueHtml: string): string {
  return `<p style="margin:0 0 6px;"><strong>${escapeHtml(label)}</strong> ${valueHtml}</p>`;
}

function mailShell(innerHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1917;max-width:560px;">${innerHtml}</div>`;
}

function summaryBlock(b: Booking, rows: string[]): string {
  const opts = b.options.length
    ? `<p style="margin:0 0 6px;"><strong>Options :</strong> ${b.options.map((o) => escapeHtml(o.nom)).join(', ')}</p>`
    : '';
  return `<div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
    ${rows.join('\n')}
    <p style="margin:0 0 6px;"><strong>Soin :</strong> ${escapeHtml(b.service_nom)}</p>
    ${opts}
    <p style="margin:0 0 6px;"><strong>Durée :</strong> ${b.service_duree_minutes} minutes</p>
    <p style="margin:0;"><strong>Tarif :</strong> ${escapeHtml(chfMail(b.total_chf ?? bookingTotal(b)))}</p>
  </div>`;
}

function phoneSentence(biz: Biz): string {
  return biz.phone
    ? `au <a href="tel:${escapeHtml(biz.phone.replace(/\s+/g, ''))}">${escapeHtml(biz.phone)}</a>`
    : 'en répondant à ce message';
}

export interface BuiltMail {
  subject: string;
  html: string;
}

export function buildClientMail(
  template: MailTemplate,
  b: Booking,
  biz: Biz,
  previous: Booking | undefined,
): BuiltMail {
  const first = escapeHtml(b.prenom);
  const dateLong = formatDateLong(b.date_rdv);
  const signature = `<p style="margin-top:24px;color:#57534e;">À bientôt,<br/><strong>${escapeHtml(biz.name)}</strong><br/>${escapeHtml(biz.address)}</p>`;

  if (template === 'accuse') {
    const periode = b.periode ?? 'matin';
    return {
      subject: `Votre demande de rendez-vous — ${dateLong} (${PERIODE_LABEL[periode].toLowerCase()})`,
      html: mailShell(`
        <p>Bonjour ${first},</p>
        <p>Nous avons bien reçu votre demande de rendez-vous pour le <strong>${escapeHtml(dateLong)}, ${escapeHtml(periodeText(periode))}</strong>.</p>
        ${summaryBlock(b, [mailRow('Date souhaitée :', `${escapeHtml(dateLong)} — ${escapeHtml(PERIODE_LABEL[periode].toLowerCase())}`)])}
        <p><strong>Votre rendez-vous n'est pas encore confirmé.</strong> Emmanuelle vous rappelle prochainement pour confirmer l'horaire exact.</p>
        ${signature}`),
    };
  }

  if (template === 'confirmation') {
    return {
      subject: `Rendez-vous confirmé le ${dateLong} à ${b.heure_rdv}`,
      html: mailShell(`
        <h2 style="font-size:18px;margin:0 0 12px;">Votre rendez-vous est confirmé</h2>
        <p>Bonjour ${first},</p>
        <p>Je me réjouis de vous accueillir.</p>
        ${summaryBlock(b, [
          mailRow('Date :', escapeHtml(dateLong)),
          mailRow('Heure :', `<strong>${escapeHtml(b.heure_rdv)}</strong>`),
          mailRow('Lieu :', escapeHtml(biz.address)),
        ])}
        <p style="font-size:14px;color:#57534e;">Prévoyez quelques minutes d'avance pour vous installer sereinement. En cas d'imprévu, merci de me prévenir au moins 24 heures à l'avance ${phoneSentence(biz)}.</p>
        <p style="margin-top:24px;">À très bientôt,<br/><strong>Emmanuelle</strong></p>`),
    };
  }

  if (template === 'deplacement') {
    const old = previous ?? b;
    return {
      subject: `Votre rendez-vous est déplacé au ${dateLong} à ${b.heure_rdv}`,
      html: mailShell(`
        <h2 style="font-size:18px;margin:0 0 12px;">Votre rendez-vous a changé de date ou d'heure</h2>
        <p>Bonjour ${first},</p>
        <p>Votre rendez-vous initialement prévu le ${escapeHtml(formatDateLong(old.date_rdv))} à ${escapeHtml(old.heure_rdv)} est <strong>déplacé</strong>.</p>
        ${summaryBlock(b, [
          mailRow('Nouvelle date :', escapeHtml(dateLong)),
          mailRow('Nouvelle heure :', `<strong>${escapeHtml(b.heure_rdv)}</strong>`),
          mailRow('Lieu :', escapeHtml(biz.address)),
        ])}
        <p style="font-size:14px;color:#57534e;">Si ce nouvel horaire ne vous convient pas, appelez-moi ${phoneSentence(biz)} pour que nous trouvions une autre date.</p>
        <p style="margin-top:24px;">Avec mes excuses pour le changement,<br/><strong>Emmanuelle</strong></p>`),
    };
  }

  if (template === 'annulation') {
    return {
      subject: `Votre rendez-vous du ${dateLong} est annulé`,
      html: mailShell(`
        <p>Bonjour ${first},</p>
        <p>Votre rendez-vous du <strong>${escapeHtml(dateLong)}${b.horaire_fixe ? ` à ${escapeHtml(b.heure_rdv)}` : ''}</strong> (${escapeHtml(b.service_nom)}) est annulé.</p>
        <p>Pour convenir d'une nouvelle date, vous pouvez me joindre ${phoneSentence(biz)} ou réserver à nouveau en ligne.</p>
        <p style="margin-top:24px;">Avec mes salutations,<br/><strong>Emmanuelle</strong></p>`),
    };
  }

  return {
    subject: 'À propos de votre demande de rendez-vous',
    html: mailShell(`
      <p>Bonjour ${first},</p>
      <p>Je n'ai malheureusement pas la possibilité de vous accueillir le <strong>${escapeHtml(dateLong)}</strong> (${escapeHtml(b.service_nom)}).</p>
      <p>Je serais ravie de trouver avec vous une autre date : vous pouvez me joindre ${phoneSentence(biz)} ou réserver à nouveau en ligne.</p>
      <p style="margin-top:24px;">Avec mes salutations,<br/><strong>Emmanuelle</strong></p>`),
  };
}

/** Envoie un e-mail à la cliente, journalise (`email`) et date `confirmation_envoyee_at`. */
async function sendClientMail(
  db: SupabaseClient,
  booking: Booking,
  template: MailTemplate,
  ctx: { previous?: Booking },
  actor: BookingEvent['actor'],
): Promise<{ ok: true; at: string | null } | { ok: false; error: string }> {
  if (!booking.email) return { ok: false, error: 'aucune adresse e-mail' };
  const biz = await getBiz();
  const mail = buildClientMail(template, booking, biz, ctx.previous);
  const res = await sendEmail({
    to: booking.email,
    subject: oneLine(mail.subject),
    html: mail.html,
    replyTo: biz.email || undefined,
  });
  const at = new Date().toISOString();
  await logEvent(
    db,
    booking.id,
    'email',
    { template, destinataire: 'cliente', ok: res.success, ...(res.success ? {} : { erreur: (res as any).error }) },
    actor,
  );
  if (!res.success) return { ok: false, error: (res as any).error || 'envoi refusé' };
  // `confirmation_envoyee_at` ne date que la confirmation ou le déplacement (pas accusé, refus, annulation).
  if (template !== 'confirmation' && template !== 'deplacement') return { ok: true, at: null };
  await db.from('bookings').update({ confirmation_envoyee_at: at }).eq('id', booking.id);
  return { ok: true, at };
}

/** Accusé de réception à la cliente + notification à l'institut (demandes EN LIGNE uniquement). */
async function sendNewRequestMails(db: SupabaseClient, booking: Booking, settings: BookingSettings): Promise<void> {
  if (booking.source !== 'en_ligne') return;

  if (booking.email) {
    const sent = await sendClientMail(db, booking, 'accuse', {}, 'systeme');
    if (!sent.ok) console.warn('[booking] Accusé de réception non envoyé:', sent.error);
  }

  const biz = await getBiz();
  const to = settings.notification_email || biz.email || SITE_CONFIG.receiverEmail;
  if (!to) {
    console.warn('[booking] Aucune adresse de notification pour l\'institut (réglage ou CONTACT_EMAIL).');
    return;
  }
  const periode = booking.periode ?? 'matin';
  const html = mailShell(`
    <h2 style="font-size:18px;margin:0 0 8px;">Nouvelle demande de rendez-vous</h2>
    <p>Une cliente a déposé une demande sur le site. <strong>Elle attend votre appel</strong> pour confirmer l'horaire.</p>
    <div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
      ${mailRow('Cliente :', `${escapeHtml(booking.prenom)} ${escapeHtml(booking.nom)}`)}
      ${mailRow('Téléphone :', `<a href="tel:${escapeHtml(booking.telephone.replace(/\s+/g, ''))}">${escapeHtml(booking.telephone)}</a>`)}
      ${booking.email ? mailRow('E-mail :', `<a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a>`) : ''}
      ${booking.ville ? mailRow('Localité :', `${escapeHtml(booking.code_postal ?? '')} ${escapeHtml(booking.ville)}`) : ''}
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:12px 0;"/>
      ${mailRow('Soin :', escapeHtml(booking.service_nom))}
      ${booking.options.length ? mailRow('Options :', booking.options.map((o) => escapeHtml(o.nom)).join(', ')) : ''}
      ${mailRow('Souhait :', `${escapeHtml(formatDateLong(booking.date_rdv))} — ${escapeHtml(PERIODE_LABEL[periode].toLowerCase())}`)}
      ${mailRow('Durée :', `${booking.service_duree_minutes} minutes`)}
      ${mailRow('Total :', escapeHtml(chfMail(booking.total_chf ?? bookingTotal(booking))))}
      ${booking.notes_cliente ? mailRow('Message :', escapeHtml(booking.notes_cliente).replace(/\n/g, '<br/>')) : ''}
    </div>
    <p><a href="${escapeHtml(SITE_CONFIG.url)}/admin/reservations" style="display:inline-block;background:#292524;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;">Ouvrir dans l'administration</a></p>`);

  const res = await sendEmail({
    to,
    subject: oneLine(`Nouvelle demande — ${booking.prenom} ${booking.nom} — ${booking.service_nom}`),
    html,
  });
  await logEvent(db, booking.id, 'email', { template: 'notification_institut', destinataire: 'institut', ok: res.success }, 'systeme');
}

// ── Google Agenda (REST, sans dépendance) — toujours non bloquant ────────────

interface GCalCredentials {
  calendarId: string;
  accessToken: string;
}

async function getGoogleCalendarCredentials(): Promise<GCalCredentials | null> {
  const calendarId = (await getSecret('google_calendar_id')) || process.env.GOOGLE_CALENDAR_ID || '';
  const accessToken = (await getSecret('google_calendar_access_token')) || process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || '';
  if (!calendarId || !accessToken) return null;
  return { calendarId: encodeURIComponent(calendarId), accessToken };
}

function gcalWindow(booking: Booking): { start: string; end: string } {
  const startMin = timeToMinutes(booking.heure_rdv);
  const endMin = startMin + booking.service_duree_minutes;
  // Un soin ne passe pas minuit ; on borne par sécurité.
  return {
    start: `${booking.date_rdv}T${booking.heure_rdv}:00`,
    end: `${booking.date_rdv}T${minutesToTime(Math.min(endMin, 1439))}:00`,
  };
}

/**
 * Crée un événement. Seuls les rendez-vous à horaire ARRÊTÉ ont un événement :
 * une demande souple n'a pas d'heure et fausserait les occupations lues en retour.
 */
export async function createGoogleCalendarEvent(booking: Booking): Promise<string | null> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return null;

  try {
    const { start, end } = gcalWindow(booking);
    const summary = `RDV Soin: ${booking.service_nom} — ${booking.prenom} ${booking.nom}`;
    const description = [
      `Prestation : ${booking.service_nom} (${booking.service_duree_minutes} min)`,
      `Tarif : ${chfMail(booking.total_chf ?? bookingTotal(booking))}`,
      `Cliente : ${booking.prenom} ${booking.nom}`,
      `Téléphone : ${booking.telephone}`,
      booking.email ? `Email : ${booking.email}` : '',
      booking.notes_cliente ? `Note cliente : ${booking.notes_cliente}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start, timeZone: 'Europe/Zurich' },
        end: { dateTime: end, timeZone: 'Europe/Zurich' },
        location: 'Emmanuelle Esthétique, Palézieux-Gare',
      }),
    });
    if (!res.ok) {
      console.warn('[GCal] Échec création événement HTTP:', res.status);
      return null;
    }
    const json = await res.json();
    return json.id || null;
  } catch (err) {
    console.warn('[GCal] Erreur création événement:', err);
    return null;
  }
}

export async function updateGoogleCalendarEvent(booking: Booking): Promise<boolean> {
  if (!booking.gcal_event_id) return false;
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return false;

  try {
    const { start, end } = gcalWindow(booking);
    const prefix = booking.statut === 'confirme' ? '[Confirmé]' : `[${booking.statut}]`;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events/${encodeURIComponent(booking.gcal_event_id)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `${prefix} RDV Soin: ${booking.service_nom} — ${booking.prenom} ${booking.nom}`,
          start: { dateTime: start, timeZone: 'Europe/Zurich' },
          end: { dateTime: end, timeZone: 'Europe/Zurich' },
        }),
      },
    );
    return res.ok;
  } catch (err) {
    console.warn('[GCal] Erreur mise à jour événement:', err);
    return false;
  }
}

export async function deleteGoogleCalendarEvent(gcalEventId: string): Promise<boolean> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return false;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events/${encodeURIComponent(gcalEventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${creds.accessToken}` } },
    );
    return res.ok || res.status === 404 || res.status === 410;
  } catch (err) {
    console.warn('[GCal] Erreur suppression événement:', err);
    return false;
  }
}

/**
 * Occupations Google Agenda (FreeBusy) entre deux jours INCLUS, en instants ISO.
 * La fenêtre va de minuit Zurich du premier jour à minuit Zurich du lendemain du
 * dernier (et non `T00:00:00Z`, décalé de 1 à 2 heures).
 */
export async function getGoogleCalendarBusyInstants(
  fromDate: string,
  toDate: string,
): Promise<Array<{ start: string; end: string }>> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return [];

  const timeMin = zurichInstant(fromDate, 0).toISOString();
  const timeMax = zurichInstant(addDays(toDate, 1), 0).toISOString();
  const calendarId = decodeURIComponent(creds.calendarId);

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, timeZone: 'Europe/Zurich', items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error(`FreeBusy HTTP ${res.status}`);
  const data = await res.json();
  const busy: Array<{ start?: string; end?: string }> = data?.calendars?.[calendarId]?.busy || [];
  return busy.filter((b): b is { start: string; end: string } => Boolean(b.start && b.end));
}

/**
 * Aligne l'événement Google Agenda sur le rendez-vous après une écriture :
 * créé/mis à jour pour un horaire arrêté actif, supprimé pour une annulation, un
 * refus ou un retour en demande souple. Renvoie la réservation (avec `gcal_event_id` à jour).
 */
async function syncGoogleEventAfterWrite(
  db: SupabaseClient,
  before: Booking | null,
  after: Booking,
  settings: BookingSettings,
): Promise<Booking> {
  if (!settings.gcal_sync_enabled) return after;
  try {
    const shouldExist = after.horaire_fixe && (after.statut === 'confirme' || after.statut === 'termine' || after.statut === 'en_attente');
    if (after.gcal_event_id && !shouldExist) {
      await deleteGoogleCalendarEvent(after.gcal_event_id);
      await db.from('bookings').update({ gcal_event_id: null }).eq('id', after.id);
      return { ...after, gcal_event_id: null };
    }
    if (shouldExist && !after.gcal_event_id) {
      const eventId = await createGoogleCalendarEvent(after);
      if (eventId) {
        await db.from('bookings').update({ gcal_event_id: eventId }).eq('id', after.id);
        return { ...after, gcal_event_id: eventId };
      }
      return after;
    }
    if (shouldExist && after.gcal_event_id) {
      const relevant =
        !before ||
        before.date_rdv !== after.date_rdv ||
        before.heure_rdv !== after.heure_rdv ||
        before.service_duree_minutes !== after.service_duree_minutes ||
        before.statut !== after.statut ||
        before.service_nom !== after.service_nom;
      if (relevant) await updateGoogleCalendarEvent(after);
    }
  } catch (err) {
    console.warn('[booking] Synchronisation Google Agenda non bloquante:', err);
  }
  return after;
}
