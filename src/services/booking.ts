/**
 * Service de Réservations & Offre du Mois — Emmanuelle Esthétique
 *
 * Gère le cycle complet de réservation en ligne :
 *  - Disponibilités et calcul des créneaux (règles matin / après-midi, buffer de 30 min, durées réelles des soins)
 *  - Prise de rendez-vous avec création/rapprochement automatique dans la fiche cliente CRM (`clients`)
 *  - Envoi des notifications e-mail (salon et cliente) via Resend
 *  - Synchronisation bidirectionnelle Google Calendar (création, mise à jour, annulation d'événements)
 *  - Gestion de l'Offre du Mois (lecture publique, administration CRUD)
 */

import { supabase } from './supabase';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { sendEmail, plainTextToSimpleHtml } from './email';
import { SITE_CONFIG } from '../config/site';
import { getSecret } from './secrets';
import { emitAutomationEvent } from './automationRunner';
import { CARTE, getItem } from '../constants/carteSoins';

// ── Types & Interfaces ────────────────────────────────────────────────────────

export type BookingStatus = 'en_attente' | 'confirme' | 'refuse' | 'annule' | 'termine';

export interface BookingOption {
  id: string;
  nom: string;
  prix_chf: number;
  duree_minutes?: number;
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
  service_duree_minutes: number;
  options: BookingOption[];
  offer_of_month_id: string | null;
  date_rdv: string; // YYYY-MM-DD
  heure_rdv: string; // HH:mm
  statut: BookingStatus;
  notes_cliente: string | null;
  notes_admin: string | null;
  gcal_event_id: string | null;
  rappel_effectue: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingInput {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  service_id?: string | null;
  service_nom: string;
  service_prix_chf: number;
  service_duree_minutes?: number;
  options?: BookingOption[];
  offer_of_month_id?: string | null;
  date_rdv: string; // YYYY-MM-DD
  heure_rdv: string; // HH:mm
  notes_cliente?: string | null;
  bypass_availability_check?: boolean;
}

export interface MonthlyOffer {
  id: string;
  titre: string;
  description: string | null;
  prix_chf: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlyOfferInput {
  titre: string;
  description?: string | null;
  prix_chf: number;
  image_url?: string | null;
  active?: boolean;
}

export interface PlageHoraire {
  debut: string; // HH:mm
  fin: string;   // HH:mm
}

export interface JourOuvertureConfig {
  ouvert: boolean;
  plages: PlageHoraire[];
}

export interface BookingSettings {
  id: string;
  buffer_minutes: number;
  anticipation_min_heures: number;
  anticipation_max_jours: number;
  jours_ouverture: Record<string, JourOuvertureConfig>; // '0' (dimanche) à '6' (samedi)
  fermetures_exceptionnelles: string[]; // ['YYYY-MM-DD', ...]
  gcal_sync_enabled: boolean;
  gcal_calendar_id?: string | null;
  notification_email?: string | null;
}

export interface TimeSlot {
  heure: string; // HH:mm début
  fin: string;   // HH:mm fin du soin
  disponible: boolean;
  motif?: string;
}

export interface AvailableDaySlots {
  date: string;
  ouvert: boolean;
  buffer_minutes: number;
  service_duree_minutes: number;
  slots: TimeSlot[];
}

// ── Constantes & Réglages par défaut ──────────────────────────────────────────

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  id: 'default',
  buffer_minutes: 30, // 30 min de battement incompressible entre deux rendez-vous
  anticipation_min_heures: 2, // Réservation au plus tôt 2 heures à l'avance
  anticipation_max_jours: 60, // Calendrier ouvert jusqu'à 60 jours
  jours_ouverture: {
    // 1: Lundi à 6: Samedi (9h-12h et 14h-18h)
    '1': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    '2': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    '3': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    '4': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    '5': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    '6': { ouvert: true, plages: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
    // Dimanche fermé
    '0': { ouvert: false, plages: [] },
  },
  fermetures_exceptionnelles: [],
  gcal_sync_enabled: false,
  gcal_calendar_id: null,
  notification_email: null,
};

// ── Utilitaires de Temps & Calculs ───────────────────────────────────────────

/** Convertit une chaîne "HH:mm" en nombre total de minutes depuis minuit */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/** Convertit des minutes depuis minuit en chaîne "HH:mm" */
export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

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

/**
 * Calcule la durée totale d'un soin avec ses options éventuelles.
 */
export function calculateTotalDuration(
  serviceDurationOrStr: number | string | undefined,
  options?: BookingOption[]
): number {
  let duration = typeof serviceDurationOrStr === 'number'
    ? serviceDurationOrStr
    : parseDurationMinutes(serviceDurationOrStr, 60);

  if (options && options.length > 0) {
    for (const opt of options) {
      if (opt.duree_minutes && opt.duree_minutes > 0) {
        duration += opt.duree_minutes;
      }
    }
  }

  return duration;
}

/**
 * Résout la durée officielle d'un soin depuis le catalogue CARTE d'Emmanuelle Esthétique.
 */
export function resolveServiceDuration(serviceId?: string | null, fallbackMinutes = 60): number {
  if (!serviceId) return fallbackMinutes;
  try {
    const item = getItem(serviceId);
    if (item && item.duration) {
      return parseDurationMinutes(item.duration, fallbackMinutes);
    }
  } catch {
    // Si le service n'est pas dans carteSoins (ex: offre sur-mesure)
  }
  return fallbackMinutes;
}

// ── Paramètres de Réservation ────────────────────────────────────────────────

/**
 * Récupère la configuration des réservations (buffer, horaires matin/après-midi).
 */
export async function getBookingSettings(): Promise<BookingSettings> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  try {
    const { data, error } = await client
      .from('booking_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_BOOKING_SETTINGS;
    }

    return {
      id: data.id,
      buffer_minutes: data.buffer_minutes ?? DEFAULT_BOOKING_SETTINGS.buffer_minutes,
      anticipation_min_heures: data.anticipation_min_heures ?? DEFAULT_BOOKING_SETTINGS.anticipation_min_heures,
      anticipation_max_jours: data.anticipation_max_jours ?? DEFAULT_BOOKING_SETTINGS.anticipation_max_jours,
      jours_ouverture: data.jours_ouverture ?? DEFAULT_BOOKING_SETTINGS.jours_ouverture,
      fermetures_exceptionnelles: data.fermetures_exceptionnelles ?? DEFAULT_BOOKING_SETTINGS.fermetures_exceptionnelles,
      gcal_sync_enabled: Boolean(data.gcal_sync_enabled),
      gcal_calendar_id: data.gcal_calendar_id ?? null,
      notification_email: data.notification_email ?? null,
    };
  } catch (err) {
    console.warn('[getBookingSettings] Erreur lecture config, utilisation défauts:', err);
    return DEFAULT_BOOKING_SETTINGS;
  }
}

/**
 * Met à jour la configuration des réservations (Admin).
 */
export async function updateBookingSettings(
  settings: Partial<BookingSettings>
): Promise<{ success: boolean; data?: BookingSettings; error?: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { success: false, error: 'Accès admin non disponible sur le serveur.' };
  }

  try {
    const { data, error } = await admin
      .from('booking_settings')
      .upsert({
        id: 'default',
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as BookingSettings };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur inconnue' };
  }
}

// ── Calcul des Créneaux Disponibles ──────────────────────────────────────────

/**
 * Calcule tous les créneaux disponibles pour une date et une durée de soin données.
 * Respecte :
 *  - Les plages d'ouverture matin & après-midi
 *  - Le buffer de battement (30 min par défaut) entre chaque prestation
 *  - L'exclusion des rendez-vous existants (en attente, confirmés ou terminés)
 *  - Le délai d'anticipation minimum si la date est aujourd'hui
 *  - Les fermetures exceptionnelles
 */
export async function getAvailableSlots(
  dateStr: string, // 'YYYY-MM-DD'
  serviceDurationMinutes: number
): Promise<AvailableDaySlots> {
  const settings = await getBookingSettings();
  const buffer = settings.buffer_minutes;

  const targetDate = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = targetDate.getDay().toString(); // 0: Dimanche, 1: Lundi, etc.

  // 1. Vérification fermeture exceptionnelle
  if (settings.fermetures_exceptionnelles.includes(dateStr)) {
    return {
      date: dateStr,
      ouvert: false,
      buffer_minutes: buffer,
      service_duree_minutes: serviceDurationMinutes,
      slots: [],
    };
  }

  // 2. Vérification jour d'ouverture
  const dayConfig = settings.jours_ouverture[dayOfWeek];
  if (!dayConfig || !dayConfig.ouvert || !dayConfig.plages || dayConfig.plages.length === 0) {
    return {
      date: dateStr,
      ouvert: false,
      buffer_minutes: buffer,
      service_duree_minutes: serviceDurationMinutes,
      slots: [],
    };
  }

  // 3. Récupération des réservations existantes pour ce jour (en attente ou confirmées)
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  const { data: existingBookings, error } = await client
    .from('bookings')
    .select('heure_rdv, service_duree_minutes, statut')
    .eq('date_rdv', dateStr)
    .not('statut', 'in', '("refuse","annule")');

  if (error) {
    console.error('[getAvailableSlots] Erreur lecture bookings:', error);
  }

  // Intervalles occupés (avec le buffer de 30 min après chaque soin)
  // [debut, fin_avec_buffer]
  const busyIntervals: Array<{ start: number; end: number }> = [];

  for (const b of existingBookings ?? []) {
    const start = timeToMinutes(b.heure_rdv);
    const duration = b.service_duree_minutes || 60;
    const endWithBuffer = start + duration + buffer;
    busyIntervals.push({ start, end: endWithBuffer });
  }

  // 4. Synchronisation Google Calendar (si configurée)
  if (settings.gcal_sync_enabled) {
    try {
      const gcalBusy = await getGoogleCalendarBusyIntervals(dateStr);
      for (const item of gcalBusy) {
        const start = timeToMinutes(item.start);
        const end = timeToMinutes(item.end);
        busyIntervals.push({ start, end: end + buffer });
      }
    } catch (gcalErr) {
      console.warn('[getAvailableSlots] Impossible de récupérer les indisponibilités GCal:', gcalErr);
    }
  }

  // 5. Calcul de l'heure courante pour la règle d'anticipation
  const now = new Date();
  const isToday =
    now.getFullYear() === targetDate.getFullYear() &&
    now.getMonth() === targetDate.getMonth() &&
    now.getDate() === targetDate.getDate();

  const currentMinutesToday = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  const minAllowedStart = isToday ? currentMinutesToday + settings.anticipation_min_heures * 60 : -1;

  // 6. Génération des créneaux par pas de 30 minutes dans chaque plage d'ouverture
  const stepMinutes = 30; // Créneaux proposés toutes les 30 min (ex: 09:00, 09:30, 10:00, 14:00, etc.)
  const slots: TimeSlot[] = [];

  for (const plage of dayConfig.plages) {
    const plageStart = timeToMinutes(plage.debut);
    const plageEnd = timeToMinutes(plage.fin);

    for (let currentSlotStart = plageStart; currentSlotStart + serviceDurationMinutes <= plageEnd; currentSlotStart += stepMinutes) {
      const slotEnd = currentSlotStart + serviceDurationMinutes;
      const slotEndWithBuffer = slotEnd + buffer;

      let disponible = true;
      let motif: string | undefined;

      // Règle d'anticipation (pour aujourd'hui)
      if (isToday && currentSlotStart < minAllowedStart) {
        disponible = false;
        motif = "Délai d'anticipation dépassé";
      }

      // Règle de collision avec les rendez-vous existants (+ buffer)
      if (disponible) {
        for (const busy of busyIntervals) {
          // Deux intervalles [A, A_end] et [B, B_end] se chevauchent si A < B_end et A_end > B
          if (currentSlotStart < busy.end && slotEndWithBuffer > busy.start) {
            disponible = false;
            motif = 'Créneau déjà réservé ou buffer de transition';
            break;
          }
        }
      }

      slots.push({
        heure: minutesToTime(currentSlotStart),
        fin: minutesToTime(slotEnd),
        disponible,
        motif: disponible ? undefined : motif,
      });
    }
  }

  return {
    date: dateStr,
    ouvert: true,
    buffer_minutes: buffer,
    service_duree_minutes: serviceDurationMinutes,
    slots,
  };
}

// ── Réservations (Bookings) : CRUD & Logique Métier ──────────────────────────

/**
 * Crée une réservation en ligne :
 *  1. Valide les données saisies
 *  2. Vérifie la disponibilité effective du créneau
 *  3. Recherche ou crée automatiquement la cliente dans le CRM `clients`
 *  4. Insère la réservation en base Supabase
 *  5. Synchronise avec Google Calendar (si actif)
 *  6. Notifie l'institut et la cliente par e-mail
 *  7. Déclenche les automatisations internes
 */
export async function createBooking(
  input: BookingInput
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  // Validation minimale
  if (!input.nom?.trim() || !input.prenom?.trim() || !input.telephone?.trim()) {
    return { success: false, error: 'Nom, prénom et numéro de téléphone sont requis.' };
  }
  if (!input.service_nom?.trim() || !input.date_rdv || !input.heure_rdv) {
    return { success: false, error: 'Le soin, la date et le créneau horaire sont requis.' };
  }

  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  const totalDuration = calculateTotalDuration(
    input.service_duree_minutes || resolveServiceDuration(input.service_id),
    input.options
  );

  // 1. Vérification de disponibilité anti-doublon (Race condition safe)
  if (!input.bypass_availability_check) {
    const availableCheck = await getAvailableSlots(input.date_rdv, totalDuration);
    const matchingSlot = availableCheck.slots.find((s) => s.heure === input.heure_rdv);

    if (!availableCheck.ouvert || !matchingSlot || !matchingSlot.disponible) {
      return {
        success: false,
        error: 'Ce créneau horaire n’est plus disponible. Veuillez en sélectionner un autre.',
      };
    }
  }

  // 2. Rapprochement CRM Cliente : recherche par téléphone ou e-mail
  let clientId: string | null = null;
  const cleanPhone = input.telephone.replace(/[\s\.\-\/]/g, '').trim();
  const cleanEmail = input.email?.trim().toLowerCase() || null;

  try {
    let query = client.from('clients').select('id, telephone, email').eq('archived', false);
    if (cleanPhone) {
      query = query.or(`telephone.eq.${cleanPhone}${cleanEmail ? `,email.eq.${cleanEmail}` : ''}`);
    } else if (cleanEmail) {
      query = query.eq('email', cleanEmail);
    }

    const { data: matchedClients } = await query.limit(1);

    if (matchedClients && matchedClients.length > 0) {
      clientId = matchedClients[0].id;
    } else {
      // Nouvelle cliente : création dans le fichier CRM clients
      const { data: newClient } = await client
        .from('clients')
        .insert({
          nom: input.nom.trim(),
          prenom: input.prenom.trim(),
          telephone: cleanPhone,
          email: cleanEmail,
          notes: `Créée automatiquement via la réservation en ligne (${input.date_rdv}).`,
        })
        .select('id')
        .single();

      if (newClient) {
        clientId = newClient.id;
      }
    }
  } catch (crmErr) {
    console.warn('[createBooking] Avertissement liaison CRM cliente:', crmErr);
  }

  // 3. Insertion de la réservation dans `bookings`
  const bookingData = {
    client_id: clientId,
    nom: input.nom.trim(),
    prenom: input.prenom.trim(),
    telephone: cleanPhone,
    email: cleanEmail,
    code_postal: input.code_postal?.trim() || null,
    ville: input.ville?.trim() || null,
    service_id: input.service_id || null,
    service_nom: input.service_nom.trim(),
    service_prix_chf: input.service_prix_chf,
    service_duree_minutes: totalDuration,
    options: input.options || [],
    offer_of_month_id: input.offer_of_month_id || null,
    date_rdv: input.date_rdv,
    heure_rdv: input.heure_rdv,
    statut: 'en_attente' as BookingStatus,
    notes_cliente: input.notes_cliente?.trim() || null,
  };

  const { data: booking, error: insertError } = await client
    .from('bookings')
    .insert(bookingData)
    .select()
    .single();

  if (insertError || !booking) {
    return {
      success: false,
      error: `Erreur lors de l'enregistrement de la réservation : ${insertError?.message}`,
    };
  }

  const createdBooking = booking as Booking;

  // 4. Synchronisation Google Calendar en arrière-plan si activée
  try {
    const settings = await getBookingSettings();
    if (settings.gcal_sync_enabled) {
      const gcalEventId = await createGoogleCalendarEvent(createdBooking);
      if (gcalEventId) {
        await client.from('bookings').update({ gcal_event_id: gcalEventId }).eq('id', createdBooking.id);
        createdBooking.gcal_event_id = gcalEventId;
      }
    }
  } catch (gcalErr) {
    console.warn('[createBooking] Google Calendar sync non bloquant:', gcalErr);
  }

  // 5. Envois d'e-mails de notification (Salon + Cliente)
  sendBookingNotifications(createdBooking).catch((mailErr) => {
    console.warn('[createBooking] Erreur notification email:', mailErr);
  });

  // 6. Déclenchement de l'événement d'automatisation Studio
  try {
    await emitAutomationEvent('booking.created', SITE_CONFIG.url);
  } catch (autoErr) {
    // Non bloquant
  }

  return { success: true, booking: createdBooking };
}

/**
 * Récupère la liste des réservations avec filtres (Admin).
 */
export async function getBookings(filter?: {
  date?: string;
  startDate?: string;
  endDate?: string;
  statut?: BookingStatus;
  clientId?: string;
  limit?: number;
}): Promise<Booking[]> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  let query = client.from('bookings').select('*');

  if (filter?.date) {
    query = query.eq('date_rdv', filter.date);
  }
  if (filter?.startDate) {
    query = query.gte('date_rdv', filter.startDate);
  }
  if (filter?.endDate) {
    query = query.lte('date_rdv', filter.endDate);
  }
  if (filter?.statut) {
    query = query.eq('statut', filter.statut);
  }
  if (filter?.clientId) {
    query = query.eq('client_id', filter.clientId);
  }

  query = query.order('date_rdv', { ascending: true }).order('heure_rdv', { ascending: true });

  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[getBookings] Erreur chargement:', error);
    return [];
  }

  return (data || []) as Booking[];
}

/**
 * Récupère une réservation par son ID.
 */
export async function getBookingById(id: string): Promise<Booking | null> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  const { data, error } = await client.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Booking;
}

/**
 * Met à jour le statut d'une réservation (ex: 'confirme', 'refuse', 'annule', 'termine').
 * Met à jour Google Calendar et notifie la cliente si approprié.
 */
export async function updateBookingStatus(
  id: string,
  statut: BookingStatus,
  notes_admin?: string
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  const existing = await getBookingById(id);
  if (!existing) {
    return { success: false, error: 'Réservation introuvable.' };
  }

  const updates: Record<string, any> = {
    statut,
    updated_at: new Date().toISOString(),
  };
  if (typeof notes_admin === 'string') {
    updates.notes_admin = notes_admin;
  }

  const { data, error } = await client
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Erreur mise à jour statut' };
  }

  const updatedBooking = data as Booking;

  // Mise à jour Google Calendar
  if (updatedBooking.gcal_event_id) {
    if (statut === 'annule' || statut === 'refuse') {
      await deleteGoogleCalendarEvent(updatedBooking.gcal_event_id).catch(() => {});
    } else {
      await updateGoogleCalendarEvent(updatedBooking).catch(() => {});
    }
  }

  // Notifier la cliente du changement de statut (confirmation ou refus)
  if (updatedBooking.email && (statut === 'confirme' || statut === 'refuse')) {
    sendStatusUpdateEmail(updatedBooking, statut).catch((mailErr) => {
      console.warn('[updateBookingStatus] Erreur email statut cliente:', mailErr);
    });
  }

  return { success: true, booking: updatedBooking };
}

// ── Notifications E-mail ─────────────────────────────────────────────────────

async function sendBookingNotifications(booking: Booking): Promise<void> {
  const salonEmail = SITE_CONFIG.receiverEmail || 'contact@emmanuelle-esthetique.ch';
  const formattedDate = new Date(`${booking.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // 1. E-mail à l'institut Emmanuelle Esthétique
  const adminSubject = `[Nouveau Rendez-vous] ${booking.prenom} ${booking.nom} — ${booking.service_nom}`;
  const adminHtml = `
    <div style="font-family: sans-serif; font-size: 15px; color: #1c1917; line-height: 1.6;">
      <h2 style="color: #292524; font-size: 18px; margin-bottom: 8px;">Nouvelle demande de rendez-vous en ligne</h2>
      <p>Une cliente vient de réserver un créneau sur le site :</p>
      
      <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p><strong>Cliente :</strong> ${booking.prenom} ${booking.nom}</p>
        <p><strong>Téléphone :</strong> <a href="tel:${booking.telephone}">${booking.telephone}</a></p>
        ${booking.email ? `<p><strong>E-mail :</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>` : ''}
        ${booking.ville ? `<p><strong>Localité :</strong> ${booking.code_postal || ''} ${booking.ville}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 12px 0;" />
        <p><strong>Soin réservé :</strong> ${booking.service_nom}</p>
        <p><strong>Date & Heure :</strong> ${formattedDate} à <strong>${booking.heure_rdv}</strong></p>
        <p><strong>Durée prévue :</strong> ${booking.service_duree_minutes} minutes (+ buffer 30 min)</p>
        <p><strong>Tarif :</strong> CHF ${booking.service_prix_chf}</p>
        ${booking.notes_cliente ? `<p><strong>Message / Remarque :</strong> ${booking.notes_cliente}</p>` : ''}
      </div>

      <p style="margin-top: 16px;">
        <a href="${SITE_CONFIG.url}/admin/reservations" style="display: inline-block; background: #292524; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 500;">
          Consulter dans l'administration
        </a>
      </p>
    </div>
  `;

  await sendEmail({
    to: salonEmail,
    subject: adminSubject,
    html: adminHtml,
  });

  // 2. Accusé de réception à la cliente
  if (booking.email) {
    const clientSubject = `Votre demande de rendez-vous chez Emmanuelle Esthétique (${formattedDate})`;
    const clientHtml = `
      <div style="font-family: sans-serif; font-size: 15px; color: #1c1917; line-height: 1.6;">
        <h2 style="color: #292524; font-size: 18px; margin-bottom: 8px;">Bonjour ${booking.prenom},</h2>
        <p>Nous avons bien reçu votre demande de rendez-vous pour votre <strong>${booking.service_nom}</strong>.</p>
        
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Rendez-vous souhaité :</strong> ${formattedDate} à ${booking.heure_rdv}</p>
          <p><strong>Durée du soin :</strong> ${booking.service_duree_minutes} minutes</p>
          <p><strong>Tarif indicatif :</strong> CHF ${booking.service_prix_chf}</p>
          <p><strong>Lieu :</strong> Institut Emmanuelle Esthétique, Palézieux-Gare</p>
        </div>

        <p>Votre rendez-vous est actuellement <em>en cours de confirmation</em>. Emmanuelle vous confirmera le créneau par SMS ou e-mail très rapidement.</p>
        
        <p style="margin-top: 24px; font-size: 14px; color: #78716c;">
          Au plaisir de vous accueillir pour ce moment de bien-être et de sérénité,<br />
          <strong>Emmanuelle Esthétique</strong><br />
          Palézieux-Gare
        </p>
      </div>
    `;

    await sendEmail({
      to: booking.email,
      subject: clientSubject,
      html: clientHtml,
    });
  }
}

async function sendStatusUpdateEmail(booking: Booking, statut: 'confirme' | 'refuse'): Promise<void> {
  if (!booking.email) return;

  const formattedDate = new Date(`${booking.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (statut === 'confirme') {
    await sendEmail({
      to: booking.email,
      subject: `Confirmation de votre rendez-vous du ${formattedDate} — Emmanuelle Esthétique`,
      html: `
        <div style="font-family: sans-serif; font-size: 15px; color: #1c1917; line-height: 1.6;">
          <h2 style="color: #292524; font-size: 18px;">Votre rendez-vous est confirmé !</h2>
          <p>Bonjour ${booking.prenom},</p>
          <p>Je me réjouis de vous accueillir pour votre <strong>${booking.service_nom}</strong> :</p>
          
          <div style="background: #f5f5f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 6px;">📅 <strong>Date :</strong> ${formattedDate}</p>
            <p style="margin: 0 0 6px;">⏰ <strong>Heure :</strong> ${booking.heure_rdv}</p>
            <p style="margin: 0 0 6px;">🌿 <strong>Prestation :</strong> ${booking.service_nom}</p>
            <p style="margin: 0;">📍 <strong>Adresse :</strong> Emmanuelle Esthétique, Palézieux-Gare</p>
          </div>

          <p style="font-size: 14px; color: #78716c;">
            <em>Conseil : prévoyez quelques minutes d'avance pour vous installer sereinement. En cas d'imprévu, merci de me prévenir au moins 24h à l'avance.</em>
          </p>

          <p style="margin-top: 24px;">À très bientôt,<br /><strong>Emmanuelle</strong></p>
        </div>
      `,
    });
  } else if (statut === 'refuse') {
    await sendEmail({
      to: booking.email,
      subject: `Information concernant votre demande de rendez-vous — Emmanuelle Esthétique`,
      html: `
        <div style="font-family: sans-serif; font-size: 15px; color: #1c1917; line-height: 1.6;">
          <p>Bonjour ${booking.prenom},</p>
          <p>Je n'ai malheureusement pas la possibilité de vous accueillir au créneau souhaité du ${formattedDate} à ${booking.heure_rdv}.</p>
          <p>N'hésitez pas à choisir un autre créneau en ligne ou à me contacter directement au <strong>${SITE_CONFIG.owner}</strong> afin que nous trouvions ensemble une date qui vous convienne.</p>
          <p style="margin-top: 24px;">Avec mes sincères salutations,<br /><strong>Emmanuelle Esthétique</strong></p>
        </div>
      `,
    });
  }
}

// ── Offres du Mois (Monthly Offers) ──────────────────────────────────────────

/**
 * Récupère l'offre du mois active pour le site public (Hero, bannière, formulaire).
 */
export async function getActiveMonthlyOffer(): Promise<MonthlyOffer | null> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  try {
    const { data, error } = await client
      .from('monthly_offers')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as MonthlyOffer;
  } catch (err) {
    console.warn('[getActiveMonthlyOffer] Erreur lecture offre du mois:', err);
    return null;
  }
}

/**
 * Récupère l'ensemble des offres du mois (Admin).
 */
export async function getAllMonthlyOffers(): Promise<MonthlyOffer[]> {
  const admin = getSupabaseAdmin();
  const client = admin || supabase;

  const { data, error } = await client
    .from('monthly_offers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAllMonthlyOffers] Erreur lecture:', error);
    return [];
  }
  return (data || []) as MonthlyOffer[];
}

/**
 * Crée une nouvelle offre du mois. Si elle est active, désactive les précédentes.
 */
export async function createMonthlyOffer(input: MonthlyOfferInput): Promise<MonthlyOffer> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Accès admin requis');

  const active = input.active ?? true;

  if (active) {
    // Désactiver les autres offres actives
    await admin.from('monthly_offers').update({ active: false }).eq('active', true);
  }

  const { data, error } = await admin
    .from('monthly_offers')
    .insert({
      titre: input.titre.trim(),
      description: input.description?.trim() || null,
      prix_chf: input.prix_chf,
      image_url: input.image_url?.trim() || null,
      active,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Erreur création offre du mois : ${error?.message}`);
  }

  return data as MonthlyOffer;
}

/**
 * Met à jour une offre du mois existante.
 */
export async function updateMonthlyOffer(
  id: string,
  input: Partial<MonthlyOfferInput>
): Promise<MonthlyOffer> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Accès admin requis');

  if (input.active) {
    await admin.from('monthly_offers').update({ active: false }).neq('id', id);
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (input.titre !== undefined) updates.titre = input.titre.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.prix_chf !== undefined) updates.prix_chf = input.prix_chf;
  if (input.image_url !== undefined) updates.image_url = input.image_url?.trim() || null;
  if (input.active !== undefined) updates.active = input.active;

  const { data, error } = await admin
    .from('monthly_offers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Erreur mise à jour offre : ${error?.message}`);
  }

  return data as MonthlyOffer;
}

/**
 * Active une offre du mois et désactive les autres.
 */
export async function setActiveMonthlyOffer(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Accès admin requis');

  await admin.from('monthly_offers').update({ active: false }).neq('id', id);
  await admin.from('monthly_offers').update({ active: true }).eq('id', id);
}

/**
 * Supprime une offre du mois.
 */
export async function deleteMonthlyOffer(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Accès admin requis');

  const { error } = await admin.from('monthly_offers').delete().eq('id', id);
  if (error) throw new Error(`Erreur suppression offre : ${error.message}`);
}

// ── Intégration Google Calendar (REST API sans dépendances lourdes) ────────────

interface GCalCredentials {
  calendarId: string;
  accessToken: string;
}

async function getGoogleCalendarCredentials(): Promise<GCalCredentials | null> {
  const calendarId =
    (await getSecret('google_calendar_id')) ||
    process.env.GOOGLE_CALENDAR_ID ||
    '';

  const accessToken =
    (await getSecret('google_calendar_access_token')) ||
    process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ||
    '';

  if (!calendarId || !accessToken) {
    return null;
  }

  return { calendarId: encodeURIComponent(calendarId), accessToken };
}

/**
 * Crée un événement sur Google Calendar pour une réservation donnée.
 */
export async function createGoogleCalendarEvent(booking: Booking): Promise<string | null> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return null;

  try {
    const startIso = `${booking.date_rdv}T${booking.heure_rdv}:00`;
    const endMinutes = timeToMinutes(booking.heure_rdv) + booking.service_duree_minutes;
    const endIso = `${booking.date_rdv}T${minutesToTime(endMinutes)}:00`;

    const summary = `RDV Soin: ${booking.service_nom} — ${booking.prenom} ${booking.nom}`;
    const description = [
      `Prestation : ${booking.service_nom} (${booking.service_duree_minutes} min)`,
      `Tarif : CHF ${booking.service_prix_chf}`,
      `Cliente : ${booking.prenom} ${booking.nom}`,
      `Téléphone : ${booking.telephone}`,
      booking.email ? `Email : ${booking.email}` : '',
      booking.notes_cliente ? `Note cliente : ${booking.notes_cliente}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          description,
          start: { dateTime: startIso, timeZone: 'Europe/Zurich' },
          end: { dateTime: endIso, timeZone: 'Europe/Zurich' },
          location: 'Emmanuelle Esthétique, Palézieux-Gare',
        }),
      }
    );

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

/**
 * Met à jour un événement existant dans Google Calendar.
 */
export async function updateGoogleCalendarEvent(booking: Booking): Promise<boolean> {
  if (!booking.gcal_event_id) return false;
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return false;

  try {
    const startIso = `${booking.date_rdv}T${booking.heure_rdv}:00`;
    const endMinutes = timeToMinutes(booking.heure_rdv) + booking.service_duree_minutes;
    const endIso = `${booking.date_rdv}T${minutesToTime(endMinutes)}:00`;

    const statusPrefix = booking.statut === 'confirme' ? '[Confirmé]' : `[${booking.statut}]`;
    const summary = `${statusPrefix} RDV Soin: ${booking.service_nom} — ${booking.prenom} ${booking.nom}`;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events/${encodeURIComponent(
        booking.gcal_event_id
      )}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          start: { dateTime: startIso, timeZone: 'Europe/Zurich' },
          end: { dateTime: endIso, timeZone: 'Europe/Zurich' },
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.warn('[GCal] Erreur mise à jour événement:', err);
    return false;
  }
}

/**
 * Supprime un événement de Google Calendar.
 */
export async function deleteGoogleCalendarEvent(gcalEventId: string): Promise<boolean> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return false;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${creds.calendarId}/events/${encodeURIComponent(
        gcalEventId
      )}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
        },
      }
    );
    return res.ok || res.status === 404;
  } catch (err) {
    console.warn('[GCal] Erreur suppression événement:', err);
    return false;
  }
}

/**
 * Récupère les périodes occupées (busy) depuis Google Calendar FreeBusy API pour une date donnée.
 */
export async function getGoogleCalendarBusyIntervals(
  dateStr: string
): Promise<Array<{ start: string; end: string }>> {
  const creds = await getGoogleCalendarCredentials();
  if (!creds) return [];

  try {
    const timeMin = `${dateStr}T00:00:00Z`;
    const timeMax = `${dateStr}T23:59:59Z`;

    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: decodeURIComponent(creds.calendarId) }],
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const calendarBusy = data?.calendars?.[decodeURIComponent(creds.calendarId)]?.busy || [];

    const busyRanges: Array<{ start: string; end: string }> = [];
    for (const b of calendarBusy) {
      if (b.start && b.end) {
        const startH = new Date(b.start).toLocaleTimeString('fr-CH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zurich',
        });
        const endH = new Date(b.end).toLocaleTimeString('fr-CH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zurich',
        });
        busyRanges.push({ start: startH, end: endH });
      }
    }
    return busyRanges;
  } catch (err) {
    console.warn('[GCal] Erreur interrogation freeBusy:', err);
    return [];
  }
}
