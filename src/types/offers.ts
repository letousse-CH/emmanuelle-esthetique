/**
 * Offres du moment — types et règles pures, importables côté serveur comme
 * dans le navigateur (aucune dépendance à Supabase ici).
 *
 * Une offre est une campagne datée (table `monthly_offers`, migration
 * `20261005_offres_du_moment.sql`) : elle apparaît d'elle-même sur le site, au
 * formulaire de réservation et en caisse entre `date_debut` et `date_fin`
 * (dates de Zurich, bornes incluses), tant qu'il reste des places.
 *
 * Le visuel est CARRÉ (1:1) partout : site, réservation, caisse et admin le
 * cadrent de la même façon, rien n'est rogné d'un écran à l'autre.
 *
 * Le compteur de places se DÉDUIT des réservations et des factures :
 *
 *   places prises = lignes de facture non annulées portant l'offre
 *                 + réservations à venir (en attente ou confirmées)
 *
 * Une réservation encaissée depuis l'agenda passe en « terminé » : elle quitte
 * le second terme quand elle entre dans le premier.
 */

import { htmlToText, sanitizeHtml } from '../components/blocks/sanitize';

export interface Offer {
  id: string;
  titre: string;
  /** Texte riche (HTML de l'éditeur, nettoyé au rendu) — ou texte brut pour les offres antérieures. */
  description: string | null;
  prix_chf: number;
  /** Prix habituel, affiché barré. */
  prix_normal_chf: number | null;
  duree_minutes: number;
  conditions: string | null;
  /** Visuel carré (1:1), par exemple 1200 × 1200 px. */
  image_url: string | null;
  date_debut: string;
  date_fin: string;
  /** `null` = sans limite de nombre. */
  places_max: number | null;
  reservable_en_ligne: boolean;
  /** Publiée (faux = brouillon). */
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Ligne de la vue `monthly_offer_stats`. */
export interface OfferStats {
  offer_id: string;
  reservations_en_cours: number;
  reservations_total: number;
  facturations: number;
}

export const EMPTY_STATS: Omit<OfferStats, 'offer_id'> = {
  reservations_en_cours: 0,
  reservations_total: 0,
  facturations: 0,
};

/** Champs modifiables depuis l'admin. */
export type OfferInput = Pick<
  Offer,
  | 'titre' | 'description' | 'prix_chf' | 'prix_normal_chf' | 'duree_minutes' | 'conditions'
  | 'image_url' | 'date_debut' | 'date_fin' | 'places_max' | 'reservable_en_ligne' | 'active'
>;

/** Ce que voient le site et le formulaire de réservation : jamais de compteur brut. */
export interface PublicOffer {
  id: string;
  titre: string;
  description: string | null;
  prix_chf: number;
  prix_normal_chf: number | null;
  duree_minutes: number;
  conditions: string | null;
  image_url: string | null;
  date_debut: string;
  date_fin: string;
  places_max: number | null;
  /** `null` : pas de limite, ou compteur momentanément inconnu. */
  places_restantes: number | null;
  reservable_en_ligne: boolean;
}

export type OfferStatus = 'archivee' | 'brouillon' | 'a_venir' | 'en_cours' | 'complete' | 'terminee';

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  archivee: 'Archivée',
  brouillon: 'Brouillon',
  a_venir: 'À venir',
  en_cours: 'En cours',
  complete: 'Complète',
  terminee: 'Terminée',
};

// ── Règles ───────────────────────────────────────────────────────────────────

export function placesPrises(stats: Pick<OfferStats, 'facturations' | 'reservations_en_cours'> | null | undefined): number {
  if (!stats) return 0;
  return (Number(stats.facturations) || 0) + (Number(stats.reservations_en_cours) || 0);
}

/** Places encore libres, `null` si l'offre n'a pas de limite. Jamais négatif. */
export function placesRestantes(
  offer: Pick<Offer, 'places_max'>,
  stats: Pick<OfferStats, 'facturations' | 'reservations_en_cours'> | null | undefined,
): number | null {
  if (offer.places_max == null) return null;
  return Math.max(0, offer.places_max - placesPrises(stats));
}

/** Publiée, non archivée, et `today` (YYYY-MM-DD, Zurich) dans la période. */
export function isOfferInPeriod(
  offer: Pick<Offer, 'active' | 'archived_at' | 'date_debut' | 'date_fin'>,
  today: string,
): boolean {
  return offer.active && !offer.archived_at && offer.date_debut <= today && today <= offer.date_fin;
}

/** La date du SOIN doit tomber dans la période de l'offre. */
export function isDateInOffer(offer: Pick<Offer, 'date_debut' | 'date_fin'>, date: string): boolean {
  return offer.date_debut <= date && date <= offer.date_fin;
}

export function offerStatus(
  offer: Pick<Offer, 'active' | 'archived_at' | 'date_debut' | 'date_fin' | 'places_max'>,
  stats: Pick<OfferStats, 'facturations' | 'reservations_en_cours'> | null | undefined,
  today: string,
): OfferStatus {
  if (offer.archived_at) return 'archivee';
  if (!offer.active) return 'brouillon';
  if (today < offer.date_debut) return 'a_venir';
  if (today > offer.date_fin) return 'terminee';
  const restantes = placesRestantes(offer, stats);
  return restantes === 0 ? 'complete' : 'en_cours';
}

/** Une offre citée par une réservation ou une facture s'archive, elle ne se supprime pas. */
export function isOfferUsed(stats: Pick<OfferStats, 'reservations_total' | 'facturations'> | null | undefined): boolean {
  if (!stats) return false;
  return (Number(stats.reservations_total) || 0) > 0 || (Number(stats.facturations) || 0) > 0;
}

/** Année de rangement de l'historique : celle du début de l'offre. */
export function offerYear(offer: Pick<Offer, 'date_debut'>): string {
  return offer.date_debut.slice(0, 4);
}

/** Identifiant d'une offre dans le catalogue des soins de l'agenda (`bookings.service_id` est du texte). */
export const OFFER_SERVICE_PREFIX = 'offre:';

export function offerServiceId(offerId: string): string {
  return `${OFFER_SERVICE_PREFIX}${offerId}`;
}

export function offerIdFromServiceId(serviceId: string | null | undefined): string | null {
  if (!serviceId || !serviceId.startsWith(OFFER_SERVICE_PREFIX)) return null;
  const id = serviceId.slice(OFFER_SERVICE_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** Libellé figé sur la facture et sur la réservation. */
export function offerLineLabel(offer: Pick<Offer, 'titre'>): string {
  return `${offer.titre.trim()} (offre du moment)`;
}

// ── Affichage ────────────────────────────────────────────────────────────────

function noon(d: string): Date {
  return new Date(`${d}T12:00:00Z`);
}

const DAY_MONTH = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dayLabel(d: string, withYear: boolean): string {
  const s = (withYear ? DAY_MONTH_YEAR : DAY_MONTH).format(noon(d));
  // « 1 octobre » → « 1er octobre »
  return s.replace(/^1 /, '1er ');
}

/** « du 1er au 15 octobre 2026 », « du 20 octobre au 5 novembre 2026 », « le 3 octobre 2026 ». */
export function formatOfferPeriod(debut: string, fin: string): string {
  if (!debut || !fin) return '';
  if (debut === fin) return `le ${dayLabel(debut, true)}`;
  const sameYear = debut.slice(0, 4) === fin.slice(0, 4);
  const sameMonth = sameYear && debut.slice(5, 7) === fin.slice(5, 7);
  if (sameMonth) {
    const d = Number(debut.slice(8, 10));
    return `du ${d === 1 ? '1er' : d} au ${dayLabel(fin, true)}`;
  }
  return `du ${dayLabel(debut, !sameYear)} au ${dayLabel(fin, true)}`;
}

/** Aujourd'hui à Palézieux (`YYYY-MM-DD`), quel que soit le fuseau de la machine. */
export function todayInZurich(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Nombre de jours restants jusqu'à `fin` inclus (0 = dernier jour). */
export function daysLeft(fin: string, today: string): number {
  return Math.round((noon(fin).getTime() - noon(today).getTime()) / 86_400_000);
}

/** Montant public : « CHF 99.– » pour un entier, « CHF 99.50 » sinon (convention de-CH). */
export function formatOfferPrice(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return `CHF ${new Intl.NumberFormat('de-CH').format(v)}.–`;
  return `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HTML_RE = /<\/?(p|ul|ol|li|br|strong|em|b|i|h[2-4]|blockquote|a)\b/i;

/**
 * Description prête à afficher : le HTML de l'éditeur, nettoyé (liste blanche
 * de `sanitize.ts`). Une description en texte brut (offres créées avant
 * l'éditeur) devient des paragraphes : une ligne vide sépare deux paragraphes.
 */
export function offerDescriptionHtml(desc: string | null | undefined): string {
  const d = (desc ?? '').trim();
  if (!d) return '';
  if (HTML_RE.test(d)) return sanitizeHtml(d);
  return d
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Vrai si la description ne contient aucun texte (l'éditeur vide renvoie `<p></p>`). */
export function isDescriptionEmpty(desc: string | null | undefined): boolean {
  return htmlToText(desc ?? '').trim() === '';
}

/** « 1 h 30 », « 45 min ». */
export function formatOfferDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

// ── Partage ──────────────────────────────────────────────────────────────────

/** Adresse publique d'une offre : sa page porte l'aperçu de partage (visuel, titre, prix). */
export function offerPagePath(id: string): string {
  return `/offre/${id}`;
}

/** Vue publique d'une offre, à partir de la ligne complète (admin) et de ses places restantes. */
export function offerToPublic(o: Offer, restantes: number | null): PublicOffer {
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

function decodeEntities(t: string): string {
  return t
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function truncate(t: string, max: number): string {
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

/** Phrase d'accroche : l'intertitre de la description s'il y en a un, sinon son premier paragraphe. */
export function offerAccroche(desc: string | null | undefined, max = 180): string {
  const html = offerDescriptionHtml(desc);
  if (!html) return '';
  const h3 = html.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1];
  const p = html.match(/<p>([\s\S]*?)<\/p>/i)?.[1];
  const raw = decodeEntities((h3 ?? p ?? htmlToText(html)).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  return truncate(raw, max);
}

function offerPriceLine(o: Pick<PublicOffer, 'prix_chf' | 'prix_normal_chf' | 'date_debut' | 'date_fin'>): string {
  const prix = o.prix_normal_chf != null && o.prix_normal_chf > o.prix_chf
    ? `${formatOfferPrice(o.prix_chf)} au lieu de ${formatOfferPrice(o.prix_normal_chf)}`
    : formatOfferPrice(o.prix_chf);
  return `${prix} · valable ${formatOfferPeriod(o.date_debut, o.date_fin)}`;
}

/** Description de l'aperçu de partage (balises Open Graph). */
export function offerShareSummary(o: PublicOffer): string {
  const accroche = offerAccroche(o.description, 150);
  return truncate(`${accroche ? `${accroche} — ` : ''}${offerPriceLine(o)}`, 230);
}

/**
 * Message prêt à partager (WhatsApp, e-mail, réseaux) : titre, accroche, prix,
 * période, première condition, lien de réservation. Modifiable avant envoi.
 */
export function offerShareMessage(o: PublicOffer, url: string, brand?: string | null): string {
  const lines = [`✨ ${o.titre}${brand ? ` — ${brand}` : ''}`];
  const accroche = offerAccroche(o.description);
  if (accroche && accroche !== o.titre) lines.push('', accroche);
  lines.push('', offerPriceLine(o));
  const condition = o.conditions?.split('\n').map((l) => l.trim()).find(Boolean);
  if (condition) lines.push(condition);
  lines.push('', `Réserver : ${url}`);
  return lines.join('\n');
}

// ── Validation (admin) ───────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = noon(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type OfferErrors = Partial<Record<keyof OfferInput, string>>;

/** Mêmes règles que les contraintes de la migration, dites en français. */
export function validateOffer(input: OfferInput): OfferErrors {
  const e: OfferErrors = {};
  if (!input.titre.trim()) e.titre = 'Donnez un titre à l’offre.';
  else if (input.titre.trim().length > 120) e.titre = '120 caractères au maximum.';
  if (!Number.isFinite(input.prix_chf) || input.prix_chf < 0) e.prix_chf = 'Indiquez le tarif de l’offre.';
  if (input.prix_normal_chf != null) {
    if (!Number.isFinite(input.prix_normal_chf) || input.prix_normal_chf < 0) e.prix_normal_chf = 'Montant non reconnu.';
    else if (input.prix_normal_chf <= input.prix_chf) e.prix_normal_chf = 'Le prix habituel doit être plus élevé que le tarif de l’offre.';
  }
  if (!Number.isInteger(input.duree_minutes) || input.duree_minutes < 5 || input.duree_minutes > 600) {
    e.duree_minutes = 'Entre 5 et 600 minutes.';
  }
  if (!isRealDate(input.date_debut)) e.date_debut = 'Date de début requise.';
  if (!isRealDate(input.date_fin)) e.date_fin = 'Date de fin requise.';
  else if (isRealDate(input.date_debut) && input.date_fin < input.date_debut) e.date_fin = 'La fin doit suivre le début.';
  if (input.places_max != null && (!Number.isInteger(input.places_max) || input.places_max < 1)) {
    e.places_max = 'Un nombre entier, au moins 1 — ou laissez vide pour ne pas limiter.';
  }
  if (input.image_url && !/^https?:\/\//i.test(input.image_url)) e.image_url = 'Adresse d’image non reconnue.';
  return e;
}
