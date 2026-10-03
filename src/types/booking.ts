/**
 * Types et helpers PURS du module de réservation (aucun import serveur) :
 * partagés par le service, les routes API, l'admin et le formulaire public.
 *
 * Modèle métier — voir PLAN-RESERVATIONS.md :
 *  - la cliente demande une DATE + une PÉRIODE (matin / après-midi) ;
 *  - Emmanuelle la rappelle, fait l'upselling, puis fixe l'HORAIRE DÉFINITIF ;
 *  - `horaire_fixe = false` : demande « souple », `heure_rdv` n'est qu'indicative ;
 *  - `horaire_fixe = true`  : l'heure est arrêtée et bloque réellement l'agenda.
 */

export type BookingStatus = 'en_attente' | 'confirme' | 'refuse' | 'annule' | 'termine';
export type BookingPeriode = 'matin' | 'apres_midi';
export type BookingSource = 'en_ligne' | 'admin' | 'telephone';

/** Statuts qui occupent l'agenda (les autres libèrent le créneau). */
export const ACTIVE_STATUSES: BookingStatus[] = ['en_attente', 'confirme', 'termine'];

export const PERIODE_LABEL: Record<BookingPeriode, string> = {
  matin: 'Matin',
  apres_midi: 'Après-midi',
};

export const STATUT_LABEL: Record<BookingStatus, string> = {
  en_attente: 'À confirmer',
  confirme: 'Confirmé',
  termine: 'Terminé',
  annule: 'Annulé',
  refuse: 'Refusé',
};

export interface BookingOption {
  /** UUID d'une ligne du catalogue `services`, ou `custom-…` pour une ligne libre saisie par l'admin. */
  id: string;
  nom: string;
  prix_chf: number;
  duree_minutes?: number;
  /** Qui l'a ajoutée : la cliente au formulaire, ou Emmanuelle au téléphone (upsell). */
  ajoute_par?: 'cliente' | 'admin';
}

export interface Booking {
  id: string;
  client_id: string | null;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
  code_postal: string | null;
  ville: string | null;
  service_id: string | null;
  service_nom: string;
  service_prix_chf: number;
  service_duree_minutes: number; // durée TOTALE (soin + options)
  options: BookingOption[];
  offer_of_month_id: string | null;
  date_rdv: string;   // YYYY-MM-DD
  heure_rdv: string;  // HH:mm — indicative tant que horaire_fixe = false
  periode: BookingPeriode | null;
  horaire_fixe: boolean;
  date_demandee: string | null;
  periode_demandee: BookingPeriode | null;
  total_chf: number | null;
  source: BookingSource;
  statut: BookingStatus;
  notes_cliente: string | null;
  notes_admin: string | null;
  contacte_at: string | null;
  confirmation_envoyee_at: string | null;
  optin_promotions: boolean;
  gcal_event_id: string | null;
  rappel_effectue: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingEvent {
  id: string;
  booking_id: string;
  type: 'creation' | 'statut' | 'deplacement' | 'modification' | 'contact' | 'email' | 'crm' | 'note';
  detail: Record<string, unknown>;
  actor: 'cliente' | 'admin' | 'systeme';
  created_at: string;
}

export interface BookingBlock {
  id: string;
  date_debut: string;       // YYYY-MM-DD
  date_fin: string;         // YYYY-MM-DD (= date_debut pour un jour seul)
  heure_debut: string | null; // HH:mm — null = journée(s) entière(s)
  heure_fin: string | null;
  motif: string | null;
  created_at: string;
}

export interface PlageHoraire { debut: string; fin: string }
export interface JourOuvertureConfig { ouvert: boolean; plages: PlageHoraire[] }

export interface BookingSettings {
  id: string;
  buffer_minutes: number;
  anticipation_min_heures: number;
  anticipation_max_jours: number;
  /** '0' (dimanche) … '6' (samedi) */
  jours_ouverture: Record<string, JourOuvertureConfig>;
  /** Hérité : vidé par la migration, remplacé par `booking_blocks`. */
  fermetures_exceptionnelles: string[];
  pas_creneau_minutes: number;
  heure_coupure_periode: string;
  gcal_sync_enabled: boolean;
  gcal_calendar_id?: string | null;
  notification_email?: string | null;
}

export interface TimeSlot {
  heure: string;
  fin: string;
  disponible: boolean;
  periode: BookingPeriode;
  motif?: string;
}

export interface PeriodeDispo {
  disponible: boolean;
  /** Premier créneau exact libre dans la période (indicatif). */
  premier_creneau: string | null;
  motif?: string;
}

/** Réponse publique de GET /api/bookings/available-slots */
export interface AvailableDaySlots {
  date: string;
  ouvert: boolean;
  buffer_minutes: number;
  service_duree_minutes: number;
  periodes: Record<BookingPeriode, PeriodeDispo>;
  slots: TimeSlot[];
}

/** Réponse publique de GET /api/bookings/calendar */
export interface PublicCalendar {
  from: string;
  to: string;
  jours: Record<string, Record<BookingPeriode, boolean>>; // date → période → disponible
}

// ── Écritures ────────────────────────────────────────────────────────────────

/** Corps de POST /api/bookings (formulaire public). Prix et durées sont recalculés côté serveur. */
export interface PublicBookingRequest {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  service_id: string;
  /** Identifiants du catalogue uniquement : le serveur retrouve nom, prix, durée. */
  options?: Array<{ id: string }>;
  offer_of_month_id?: string | null;
  /**
   * Durée du soin choisie quand la carte en propose plusieurs (ex. massage 60 / 90 min).
   * Absent = durée par défaut du soin. Le serveur retrouve le prix correspondant dans le catalogue.
   */
  variante_duree_minutes?: number | null;
  date_rdv: string;
  periode: BookingPeriode;
  notes_cliente?: string | null;
  consent_email?: boolean;
  consent_whatsapp?: boolean;
  /** Piège à robots : doit rester vide (champ masqué, nom volontairement sans rapport avec un champ « classique »). */
  champ_piege?: string;
  /** @deprecated Ignoré : certains gestionnaires de mots de passe remplissaient `website`. Utiliser `champ_piege`. */
  website?: string;
}

/** Réponse de POST /api/bookings : le strict nécessaire pour l'écran de confirmation. */
export interface PublicBookingView {
  id: string;
  service_nom: string;
  options: Array<{ nom: string; prix_chf: number }>;
  date_rdv: string;
  periode: BookingPeriode;
  service_duree_minutes: number;
  total_chf: number;
}

/** Réponse JSON de POST /api/bookings (201). */
export interface PublicBookingResponse {
  success: boolean;
  booking: PublicBookingView;
}

/** Corps de PATCH /api/admin/bookings/[id] et de POST /api/admin/bookings (tous champs optionnels sauf création). */
export interface BookingPatch {
  statut?: BookingStatus;
  notes_admin?: string | null;
  date_rdv?: string;
  heure_rdv?: string;
  periode?: BookingPeriode;
  horaire_fixe?: boolean;
  service_id?: string | null;
  service_nom?: string;
  service_prix_chf?: number;
  /** Durée du soin seul. La durée totale (soin + options) est recalculée par le serveur. */
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
  /** Prévenir la cliente par e-mail. Défaut serveur : voir PLAN-RESERVATIONS.md. */
  notify_client?: boolean;
  /** Enregistrer malgré des conflits d'agenda (l'admin a le dernier mot). */
  force?: boolean;
  /** Création admin uniquement : `admin` (défaut) ou `telephone`. */
  source?: Exclude<BookingSource, 'en_ligne'>;
}

export interface BookingConflict {
  type: 'rdv' | 'blocage' | 'hors_horaires';
  libelle: string;
  booking_id?: string;
  block_id?: string;
  debut?: string;
  fin?: string;
}

export interface ClientSummary {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  notes: string | null;
  consent_email: boolean;
  consent_whatsapp: boolean;
  visites: number;
  derniere_visite: string | null;
}

/** Réponse de GET /api/admin/bookings/[id] */
export interface BookingDetail {
  booking: Booking;
  client: ClientSummary | null;
  /** Autres rendez-vous de la même cliente (10 derniers, hors celui-ci). */
  historique: Booking[];
  events: BookingEvent[];
}

/** Réponse de GET /api/admin/bookings/availability : créneaux exacts pour fixer l'horaire. */
export interface AdminAvailability {
  date: string;
  ouvert: boolean;
  motif?: string;
  buffer_minutes: number;
  slots: TimeSlot[];
}

/** Réponse de POST /api/admin/booking-blocks */
export interface BookingBlockResult {
  block: BookingBlock;
  /** Rendez-vous actifs touchés par le blocage : à signaler, jamais annulés automatiquement. */
  impactes: Booking[];
}

/** Réponse de POST /api/admin/bookings/sync-clients */
export interface SyncClientsResult {
  rattaches: number;
  crees: number;
  ignores: number;
}

/** Réponse de GET /api/admin/bookings/agenda */
export interface AgendaData {
  from: string;
  to: string;
  bookings: Booking[];
  blocks: BookingBlock[];
  settings: BookingSettings;
}

// ── Helpers purs ─────────────────────────────────────────────────────────────

export function bookingTotal(b: Pick<Booking, 'service_prix_chf' | 'options'>): number {
  const opts = (b.options ?? []).reduce((s, o) => s + (Number(o.prix_chf) || 0), 0);
  return Math.round((Number(b.service_prix_chf) + opts) * 100) / 100;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTime(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Formate un montant à la suisse : `CHF 1'234.50` (de-CH, jamais fr-CH — voir CLAUDE.md). */
export function formatCHF(n: number): string {
  return `CHF ${new Intl.NumberFormat('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)}`;
}

// ── Ajouts (passe de correction) ─────────────────────────────────────────────

/** Codes machine des erreurs de POST /api/bookings (en plus de `error`, lisible). */
export type PublicBookingErrorCode =
  | 'periode_complete'
  | 'doublon'
  | 'trop_de_demandes'
  | 'offre_indisponible'
  | 'soin_inconnu';

/** Ligne du catalogue COMPLET côté admin (GET /api/admin/services-catalog). */
export interface AdminCatalogItem {
  id: string;
  nom: string;
  categorie: string | null;
  type: 'prestation' | 'forfait' | 'option';
  prix_chf: number;
  duree_minutes: number;
}
