"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Phone,
  AlertCircle,
  CalendarCheck,
  Check,
  RefreshCw,
  Droplets,
  Flower2,
  Scissors,
  Sun,
  Sunset,
  BadgePercent,
  Plus,
  X,
} from 'lucide-react';
import {
  PERIODE_LABEL,
  type AvailableDaySlots,
  type BookingPeriode,
  type PublicBookingErrorCode,
  type PublicBookingRequest,
  type PublicBookingView,
  type PublicCalendar,
  type TimeSlot,
} from '../../../types/booking';
import {
  PRESTATIONS_CATALOG,
  PRIVILEGE_OPTIONS,
  type PrestationItem,
  type PrivilegeOption,
} from './catalog';
import { addDays, formatDateLong, formatHeure, isValidDateStr, todayZurich } from './dates';
import { chf } from './format';
import { validateContact, type ContactErrors } from './validation';
import DayCalendar from './DayCalendar';
import ConfirmationStep from './ConfirmationStep';
import type { PublicOffer } from '../../../types/offers';
import { formatOfferDuration, formatOfferPeriod, offerDescriptionHtml } from '../../../types/offers';

// Exports conservés : l'ancienne page admin des réservations les importe encore
// (période de transition). `TimeSlot` est désormais celui des types partagés.
export { PRESTATIONS_CATALOG, PRIVILEGE_OPTIONS };
export type { PrestationItem, PrivilegeOption, TimeSlot };

/**
 * @deprecated Heure LOCALE DU NAVIGATEUR : ne pas l'utiliser pour décider d'une
 * ouverture ou d'un « aujourd'hui ». Le formulaire passe par `todayZurich()`.
 * Conservé uniquement pour les importeurs historiques.
 */
export function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type CategoryId = 'visage' | 'corps' | 'epilation' | 'services';

const CATEGORIES: Array<{ id: CategoryId; label: string; icon: typeof Droplets; desc: string }> = [
  { id: 'visage', label: 'Soins du visage', icon: Droplets, desc: 'Protocoles marins Phytomer' },
  { id: 'corps', label: 'Rituels corps', icon: Flower2, desc: 'Massages & gommages' },
  { id: 'epilation', label: 'Forfaits épilation', icon: Scissors, desc: 'Forfaits signature complets' },
  { id: 'services', label: 'Mains, pieds & cils', icon: Sparkles, desc: 'Rituels spa & regard' },
];

/** Fenêtre proposée dans le calendrier (le serveur borne en plus par ses propres règles). */
const CALENDAR_DAYS = 60;
const PERIODES: BookingPeriode[] = ['matin', 'apres_midi'];
/** Battement incompressible entre deux clientes (le serveur l'impose, voir bookingEngine). */
const BATTEMENT_MINUTES = 30;
/** Nombre maximal de soins ajoutés au premier (limite du serveur). */
const MAX_EXTRAS = 6;

/** Soin ou complément que la cliente peut ajouter à sa séance. */
interface ExtraItem {
  id: string;
  name: string;
  /** Rubrique affichée (« Compléments », « Soins du visage »…). */
  groupe: string;
  durationMinutes: number;
  priceChf: number;
  variants?: PrestationItem['variants'];
}

/** `75` → `1h15`, `60` → `1h`, `45` → `45 min`. */
function formatDuree(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Heure de fin d'une séance (`09:00` + 70 min → `10:10`). */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// 1 Soin(s) · 2 Date & heure · 3 Coordonnées · 4 Confirmation
type StepNum = 1 | 2 | 3 | 4;

interface ReservationClientProps {
  businessPhone?: string;
  businessOwner?: string;
}

async function readJson<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function ReservationClient({ businessPhone }: ReservationClientProps) {
  const searchParams = useSearchParams();

  const [currentStep, setCurrentStep] = useState<StepNum>(1);

  // Catalogue : repli codé en dur tant que la base n'a pas répondu (ou si elle échoue).
  const [servicesCatalog, setServicesCatalog] = useState<PrestationItem[]>(PRESTATIONS_CATALOG);
  const [catalogKey, setCatalogKey] = useState(0);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const catalogParamsApplied = useRef(false);

  // Étape 1 : prestation
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('visage');
  const [selectedService, setSelectedService] = useState<PrestationItem | null>(PRESTATIONS_CATALOG[0]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  // Soins ajoutés au premier (autres soins de la carte ou compléments), dans l'ordre du choix.
  const [catalogOptions, setCatalogOptions] = useState<PrivilegeOption[]>([]);
  const [extras, setExtras] = useState<Array<{ id: string; variantIndex: number }>>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);

  // Offre du moment : réservée comme un soin à part entière. Quand elle est
  // choisie, elle prime sur `selectedService` (gardé pour revenir en arrière).
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<PublicOffer | null>(null);
  const offerParamApplied = useRef(false);

  // Étape 2 : jour + heure
  const today = useMemo(() => todayZurich(), []);
  // Avec une offre, seuls les jours de sa période sont proposés (le serveur le vérifie aussi).
  const calendarRange = useMemo(() => {
    const base = { from: today, to: addDays(today, CALENDAR_DAYS - 1) };
    if (!selectedOffer) return base;
    const from = selectedOffer.date_debut > today ? selectedOffer.date_debut : today;
    const to = selectedOffer.date_fin < base.to ? selectedOffer.date_fin : base.to;
    return { from, to: to < from ? from : to };
  }, [today, selectedOffer]);
  const [calendar, setCalendar] = useState<PublicCalendar | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dayInfo, setDayInfo] = useState<AvailableDaySlots | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsKey, setSlotsKey] = useState(0);
  const [slotsNotice, setSlotsNotice] = useState<string | null>(null);

  // Étape 3 : coordonnées
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    codePostal: '',
    ville: '',
    notes: '',
  });
  const [consentEmail, setConsentEmail] = useState(false);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [champPiege, setChampPiege] = useState('');
  const [formErrors, setFormErrors] = useState<ContactErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Étape 4 : confirmation
  const [confirmedBooking, setConfirmedBooking] = useState<PublicBookingView | null>(null);
  const [submittedPrenom, setSubmittedPrenom] = useState('');
  const [submittedEstimate, setSubmittedEstimate] = useState(0);

  // Focus / défilement au changement d'étape
  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  const stepsList = [
    { num: 1, label: 'Prestation' },
    { num: 2, label: 'Séance' },
    { num: 3, label: 'Coordonnées' },
  ];
  const stepIndex = stepsList.findIndex((s) => s.num === currentStep);
  const stepLabel = stepsList[stepIndex]?.label ?? '';

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    stepTopRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  // ── Catalogue des soins (base) + paramètres d'URL ──
  useEffect(() => {
    let cancelled = false;

    const resolve = (list: PrestationItem[]) => {
      const paramSoin = searchParams?.get('soin') || searchParams?.get('service');
      const paramCat = searchParams?.get('category');

      if (!catalogParamsApplied.current) {
        catalogParamsApplied.current = true;
        if (paramSoin) {
          const needle = paramSoin.toLowerCase();
          const match = list.find((s) => s.id.toLowerCase() === needle || s.name.toLowerCase().includes(needle));
          if (match) {
            setSelectedCategory(match.category);
            setSelectedService(match);
            setSelectedVariantIndex(0);
            return;
          }
        }
        if (paramCat && CATEGORIES.some((c) => c.id === paramCat)) {
          const firstInCat = list.find((s) => s.category === paramCat);
          if (firstInCat) {
            setSelectedCategory(paramCat as CategoryId);
            setSelectedService(firstInCat);
            setSelectedVariantIndex(0);
            return;
          }
        }
      }

      // Rattache la sélection courante aux identifiants réels (UUID) de la base.
      setSelectedService((prev) => {
        if (!prev) return list[0] ?? null;
        const found = list.find((s) => s.id === prev.id || s.name.toLowerCase() === prev.name.toLowerCase());
        return found || list.find((s) => s.category === prev.category) || list[0] || null;
      });
    };

    fetch('/api/bookings/services')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.services) && data.services.length > 0) {
          setServicesCatalog(data.services);
          setCatalogOptions(Array.isArray(data.options) ? data.options : []);
          resolve(data.services);
        } else {
          // Base injoignable : le repli (ids de carteSoins) reste utilisable.
          resolve(PRESTATIONS_CATALOG);
        }
      })
      .catch((err) => {
        console.warn('[ReservationClient] Services dynamiques non chargés:', err);
        if (!cancelled) resolve(PRESTATIONS_CATALOG);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, catalogKey]);

  // ── Offres du moment (GET /api/offers) + paramètre `?offre=` ──
  useEffect(() => {
    let cancelled = false;
    fetch('/api/offers', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list: PublicOffer[] = Array.isArray(data?.offers)
          ? data.offers.filter((o: PublicOffer) => o.reservable_en_ligne)
          : [];
        setOffers(list);
        // L'offre choisie a pu expirer ou se remplir entre-temps.
        setSelectedOffer((prev) => (prev ? list.find((o) => o.id === prev.id) ?? null : prev));
        if (!offerParamApplied.current) {
          offerParamApplied.current = true;
          const paramOffre = searchParams?.get('offre');
          const match = paramOffre ? list.find((o) => o.id === paramOffre) : undefined;
          if (match) setSelectedOffer(match);
          else if (paramOffre) {
            setCatalogNotice('Cette offre n’est plus disponible : elle a pris fin ou toutes ses places sont réservées. Choisissez un autre soin ci-dessous.');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, catalogKey]);

  const handleCategoryChange = (catId: CategoryId) => {
    setSelectedCategory(catId);
    setSelectedOffer(null);
    const firstInCat = servicesCatalog.find((p) => p.category === catId);
    if (firstInCat) {
      setSelectedService(firstInCat);
      setSelectedVariantIndex(0);
    }
  };

  // ── Soins à ajouter : la carte (hors premier soin) puis les compléments ──
  const mainId = selectedOffer ? null : selectedService?.id ?? null;
  const extraCatalog = useMemo<ExtraItem[]>(() => {
    const catLabel = (c: CategoryId) => CATEGORIES.find((x) => x.id === c)?.label ?? 'Soins';
    return [
      ...catalogOptions.map((o) => ({
        id: o.id,
        name: o.nom,
        groupe: 'Compléments',
        durationMinutes: o.duree_minutes,
        priceChf: o.prix_chf,
      })),
      ...CATEGORIES.flatMap((c) =>
        servicesCatalog
          .filter((p) => p.category === c.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            groupe: catLabel(c.id),
            durationMinutes: p.durationMinutes,
            priceChf: p.priceChf,
            variants: p.variants,
          })),
      ),
    ];
  }, [catalogOptions, servicesCatalog]);

  // Soins ajoutés encore valables (le catalogue a pu changer ; le premier soin n'est jamais doublé).
  const chosenExtras = useMemo(
    () =>
      extras
        .filter((x) => x.id !== mainId)
        .map((x) => {
          const item = extraCatalog.find((i) => i.id === x.id);
          if (!item) return null;
          const v = item.variants?.[x.variantIndex];
          return {
            item,
            variantIndex: x.variantIndex,
            durationMinutes: v?.durationMinutes ?? item.durationMinutes,
            priceChf: v?.priceChf ?? item.priceChf,
            variantMinutes: v ? v.durationMinutes : null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [extras, extraCatalog, mainId]
  );

  const toggleExtra = (id: string) => {
    setExtras((prev) => {
      if (prev.some((x) => x.id === id)) return prev.filter((x) => x.id !== id);
      if (prev.filter((x) => x.id !== mainId).length >= MAX_EXTRAS) return prev;
      return [...prev, { id, variantIndex: 0 }];
    });
  };
  const setExtraVariant = (id: string, variantIndex: number) =>
    setExtras((prev) => prev.map((x) => (x.id === id ? { ...x, variantIndex } : x)));

  // ── Totaux (estimation d'affichage : le serveur recalcule prix et durée) ──
  const { baseDurationMinutes, basePriceChf, currentServiceName } = useMemo(() => {
    if (selectedOffer) {
      return {
        baseDurationMinutes: selectedOffer.duree_minutes,
        basePriceChf: selectedOffer.prix_chf,
        currentServiceName: selectedOffer.titre,
      };
    }
    if (!selectedService) {
      return { baseDurationMinutes: 60, basePriceChf: 0, currentServiceName: '' };
    }
    const variant = selectedService.variants?.[selectedVariantIndex];
    return {
      baseDurationMinutes: variant?.durationMinutes ?? selectedService.durationMinutes,
      basePriceChf: variant?.priceChf ?? selectedService.priceChf,
      currentServiceName: selectedService.name,
    };
  }, [selectedService, selectedVariantIndex, selectedOffer]);
  const currentDurationMinutes = baseDurationMinutes + chosenExtras.reduce((t, x) => t + x.durationMinutes, 0);
  const currentPriceChf = basePriceChf + chosenExtras.reduce((t, x) => t + x.priceChf, 0);

  // ── Calendrier des jours (GET /api/bookings/calendar) ──
  const atSlotsStep = currentStep >= 2;
  useEffect(() => {
    if (!atSlotsStep) return;
    const ctrl = new AbortController();
    setCalendarLoading(true);
    setCalendarError(null);

    const { from, to } = calendarRange;
    fetch(`/api/bookings/calendar?from=${from}&to=${to}&duration=${currentDurationMinutes}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 503
              ? "L'agenda est momentanément indisponible."
              : "Impossible de charger le calendrier de l'institut."
          );
        }
        const data = await readJson<PublicCalendar>(res);
        if (!data || typeof data.jours !== 'object' || data.jours === null) {
          throw new Error("Réponse inattendue du calendrier de l'institut.");
        }
        return data;
      })
      .then((data) => {
        setCalendar(data);
        setCalendarLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error('[ReservationClient] calendrier:', err);
        setCalendar(null);
        setCalendarError(err?.message || "Impossible de charger le calendrier de l'institut.");
        setCalendarLoading(false);
      });

    return () => ctrl.abort();
  }, [atSlotsStep, currentDurationMinutes, calendarKey, calendarRange]);

  const isDayAvailable = useCallback(
    (d: string) => {
      const j = calendar?.jours?.[d];
      return !!j && (j.matin || j.apres_midi);
    },
    [calendar]
  );

  // Choix du jour : on garde celui de la cliente s'il est toujours libre, sinon
  // le paramètre d'URL (?date=), sinon le premier jour disponible.
  useEffect(() => {
    if (!calendar) return;
    setSelectedDate((prev) => {
      if (prev && isDayAvailable(prev)) return prev;
      const paramDate = searchParams?.get('date');
      if (!prev && isValidDateStr(paramDate) && isDayAvailable(paramDate)) return paramDate;
      let d = calendarRange.from;
      for (let i = 0; i < CALENDAR_DAYS; i++, d = addDays(d, 1)) {
        if (isDayAvailable(d)) return d;
      }
      return '';
    });
  }, [calendar, isDayAvailable, searchParams, calendarRange]);

  // ── Horaires du jour choisi (GET /api/bookings/available-slots) ──
  useEffect(() => {
    if (!atSlotsStep || !selectedDate) {
      setDayInfo(null);
      return;
    }
    const ctrl = new AbortController();
    setLoadingSlots(true);
    setSlotsError(null);
    setDayInfo(null);

    fetch(`/api/bookings/available-slots?date=${selectedDate}&duration=${currentDurationMinutes}`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = res.status === 400 ? await readJson<{ error?: string }>(res) : null;
          throw new Error(
            res.status === 503
              ? "L'agenda est momentanément indisponible. Veuillez réessayer dans un instant."
              : body?.error || 'Impossible de charger les disponibilités.'
          );
        }
        const data = await readJson<AvailableDaySlots>(res);
        if (!data || !Array.isArray(data.slots)) {
          throw new Error('Réponse inattendue de l’agenda.');
        }
        return data;
      })
      .then((data) => {
        setDayInfo(data);
        // On garde l'heure choisie si elle tient encore (autre jour, soin ajouté) ; sinon la cliente choisit.
        const open = data.ouvert !== false;
        setSelectedTime((prev) =>
          open && prev && data.slots.some((sl) => sl.heure === prev && sl.disponible) ? prev : null
        );
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error('[ReservationClient] créneaux:', err);
        setSelectedTime(null);
        setSlotsError(err?.message || "Erreur lors de la vérification de l'agenda.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingSlots(false);
      });

    return () => ctrl.abort();
  }, [atSlotsStep, selectedDate, currentDurationMinutes, slotsKey]);

  const freeSlots = useMemo(() => (dayInfo?.slots ?? []).filter((sl) => sl.disponible), [dayInfo]);
  const selectedTimeLabel = selectedTime
    ? `${formatHeure(selectedTime)} à ${formatHeure(addMinutes(selectedTime, currentDurationMinutes))}`
    : '';
  const formattedDate = selectedDate ? formatDateLong(selectedDate) : '';

  // ── Soumission (POST /api/bookings) ──
  const focusFirstError = (errors: ContactErrors) => {
    const order: Array<keyof ContactErrors> = ['prenom', 'nom', 'telephone', 'email'];
    const first = order.find((k) => errors[k]);
    if (first) document.getElementById(`rf-${first}`)?.focus();
  };

  const handleSubmitBooking = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submittingRef.current) return; // anti double-clic (le state n'est pas encore à jour)

    const errors = validateContact(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors);
      return;
    }
    if ((!selectedService && !selectedOffer) || !selectedDate || !selectedTime) {
      setSubmitError('Veuillez choisir un soin, un jour et une heure.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const variant = selectedOffer ? undefined : selectedService?.variants?.[selectedVariantIndex];
    const email = formData.email.trim();

    // Le navigateur n'envoie que des identifiants : nom, prix et durée sont
    // retrouvés dans le catalogue par le serveur.
    const payload: PublicBookingRequest = {
      nom: formData.nom.trim(),
      prenom: formData.prenom.trim(),
      telephone: formData.telephone.trim(),
      email: email || null,
      code_postal: formData.codePostal.trim() || null,
      ville: formData.ville.trim() || null,
      service_id: selectedOffer ? null : selectedService?.id ?? null,
      // Offre du moment : prix, durée, période et places sont contrôlés par le serveur.
      offer_of_month_id: selectedOffer?.id ?? null,
      // Soins ajoutés : identifiants seulement, le serveur retrouve prix et durées.
      options: chosenExtras.map((x) => ({ id: x.item.id, variante_duree_minutes: x.variantMinutes })),
      variante_duree_minutes: variant ? variant.durationMinutes : null,
      date_rdv: selectedDate,
      heure_rdv: selectedTime,
      notes_cliente: formData.notes.trim() || null,
      consent_email: !!email && consentEmail,
      consent_whatsapp: consentWhatsapp,
      champ_piege: champPiege,
    };

    const phoneHint = businessPhone ? ` ou appelez l’institut au ${businessPhone}` : '';

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{
        booking?: Partial<PublicBookingView>;
        error?: string;
        code?: PublicBookingErrorCode;
      }>(res);

      if (!res.ok) {
        const code = data?.code;
        const serverMessage = data?.error;
        if (code === 'doublon') {
          // Pas de retour à l'étape 2 : l'horaire n'est pas en cause.
          setSubmitError(
            `${serverMessage ? `${serverMessage} ` : ''}Votre demande est peut-être déjà enregistrée : vérifiez vos e-mails${
              businessPhone ? ` ou appelez l’institut au ${businessPhone}` : ' ou appelez l’institut'
            }.`
          );
        } else if (code === 'trop_de_demandes') {
          setSubmitError(
            serverMessage || `Trop de demandes pour le moment. Patientez un peu avant de réessayer${phoneHint}.`
          );
        } else if (code === 'offre_complete' || code === 'offre_indisponible') {
          setCatalogNotice(
            serverMessage ||
              'Cette offre n’est plus disponible : elle a pris fin ou toutes ses places sont réservées. Choisissez un autre soin.'
          );
          setSelectedOffer(null);
          setCatalogKey((k) => k + 1);
          setCurrentStep(1);
        } else if (code === 'soin_inconnu') {
          setCatalogNotice(
            'Ce soin n’est plus disponible à la réservation en ligne. Choisissez-en un autre, ou contactez l’institut.'
          );
          setCatalogKey((k) => k + 1);
          setCurrentStep(1);
        } else if (code === 'creneau_pris' || code === 'periode_complete' || (!code && res.status === 409)) {
          // L'horaire a été pris entre-temps : on recharge les disponibilités.
          setSlotsNotice(
            `${serverMessage || 'Cet horaire vient d’être pris.'} Les horaires ci-dessous sont à jour.`
          );
          setSelectedTime(null);
          setCalendarKey((k) => k + 1);
          setSlotsKey((k) => k + 1);
          setCurrentStep(2);
        } else if (!code && res.status === 422) {
          setCatalogNotice(
            'Ce soin n’est plus disponible à la réservation en ligne. Choisissez-en un autre, ou contactez l’institut.'
          );
          setCatalogKey((k) => k + 1);
          setCurrentStep(1);
        } else if (res.status === 429) {
          setSubmitError(`Trop de tentatives. Patientez quelques minutes avant de réessayer${phoneHint}.`);
        } else if (res.status === 400) {
          setSubmitError(data?.error || 'Certaines informations sont invalides. Vérifiez le formulaire.');
        } else {
          setSubmitError(
            `Une erreur est survenue de notre côté. Réessayez dans un instant${phoneHint}.`
          );
        }
        return;
      }

      // Une réponse de piège à robots est factice : on complète avec ce que la cliente a choisi.
      const raw = data?.booking ?? {};
      setConfirmedBooking({
        id: raw.id ?? '',
        service_nom: raw.service_nom || currentServiceName,
        options: raw.options?.length ? raw.options : chosenExtras.map((x) => ({ nom: x.item.name, prix_chf: x.priceChf })),
        date_rdv: raw.date_rdv ?? selectedDate,
        periode: raw.periode ?? (selectedTime < '13:00' ? 'matin' : 'apres_midi'),
        heure_rdv: raw.heure_rdv ?? selectedTime,
        service_duree_minutes: raw.service_duree_minutes ?? currentDurationMinutes,
        total_chf: typeof raw.total_chf === 'number' ? raw.total_chf : currentPriceChf,
      });
      setSubmittedPrenom(formData.prenom.trim());
      setSubmittedEstimate(currentPriceChf);
      setCurrentStep(4);
    } catch (err) {
      console.error('Erreur réservation:', err);
      setSubmitError(
        `Connexion impossible. Vérifiez votre réseau et réessayez. Si le problème persiste, contactez l’institut${
          businessPhone ? ` au ${businessPhone}` : ''
        }.`
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ── Petits composants de champ ──
  const fieldClass = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border bg-paper text-sm focus:outline-none transition-all ${
      hasError ? 'border-red-600 bg-red-50/30' : 'border-border focus:border-sage focus:ring-1 focus:ring-sage'
    }`;
  const labelClass = 'text-xs font-semibold text-stone-deep uppercase tracking-wider block';

  const emailFilled = formData.email.trim().length > 0;
  const stepTotal = stepsList.length;
  const headingText =
    currentStep === 4 ? '' : `Étape ${stepIndex + 1} sur ${stepTotal} : ${stepLabel}`;

  const estimatedSummary = `${chf(currentPriceChf)} · ${formatDuree(currentDurationMinutes)}`;

  return (
    <div className="min-h-screen bg-paper text-stone-deep pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* L'en-tête éditorial (H1) est rendu par page.tsx, côté serveur. */}

        {/* Ancre de défilement / focus au changement d'étape */}
        <div ref={stepTopRef} className="scroll-mt-28" />

        {/* Stepper horizontal */}
        {currentStep < 4 && (
          <div className="mb-10">
            <div data-surface className="bg-surface border border-border rounded-[var(--radius-base,1rem)] p-3 sm:p-4 shadow-xs">
              <nav aria-label="Étapes de réservation">
                <ol className="flex items-center justify-between">
                  {stepsList.map((step, idx, arr) => {
                    const isActive = currentStep === step.num;
                    const isCompleted = currentStep > step.num;
                    return (
                      <React.Fragment key={step.num}>
                        <li className="flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (step.num < currentStep) setCurrentStep(step.num as StepNum);
                            }}
                            disabled={step.num > currentStep}
                            aria-current={isActive ? 'step' : undefined}
                            aria-label={`Étape ${idx + 1} sur ${arr.length} : ${step.label}${
                              isCompleted ? ' (terminée, revenir)' : isActive ? ' (en cours)' : ''
                            }`}
                            className={`flex items-center gap-2 sm:gap-2.5 transition-all text-left ${
                              step.num < currentStep ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isActive
                                  ? 'bg-sage text-white shadow-sm ring-4 ring-sage/20'
                                  : isCompleted
                                  ? 'bg-sage/80 text-white'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                            </span>
                            <span className="hidden sm:inline" aria-hidden="true">
                              <span
                                className={`block text-xs font-semibold uppercase tracking-wider ${
                                  isActive ? 'text-sage' : isCompleted ? 'text-stone-700' : 'text-stone-600'
                                }`}
                              >
                                {step.label}
                              </span>
                            </span>
                          </button>
                        </li>
                        {idx < arr.length - 1 && (
                          <li
                            aria-hidden="true"
                            className={`h-0.5 flex-1 mx-2 sm:mx-4 rounded-full transition-colors ${
                              currentStep > step.num ? 'bg-sage' : 'bg-border'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </ol>
              </nav>
            </div>
          </div>
        )}

        {/* Titre d'étape : annoncé et focalisé à chaque changement d'étape */}
        {currentStep < 4 && (
          <h2 ref={headingRef} tabIndex={-1} className="sr-only focus:outline-none">
            {headingText}
          </h2>
        )}

        {/* ═══ ÉTAPE 1 : PRESTATION ═══ */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-fadein">
            {catalogNotice && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{catalogNotice}</span>
              </div>
            )}

            {offers.length > 0 && (
              <fieldset className="space-y-3 min-w-0">
                <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sage mb-3">
                  <BadgePercent className="w-4 h-4" aria-hidden="true" />
                  {offers.length > 1 ? 'Offres du moment' : 'Offre du moment'}
                </legend>
                {offers.map((o) => {
                  const isSel = selectedOffer?.id === o.id;
                  return (
                    <label
                      key={o.id}
                      data-surface
                      className={`group block cursor-pointer overflow-hidden rounded-[var(--radius-base,1rem)] border transition-all bg-surface focus-within:ring-2 focus-within:ring-sage/40 ${
                        isSel ? 'border-sage ring-2 ring-sage/20 shadow-md bg-sage/5' : 'border-sage/40 hover:border-sage hover:shadow-xs'
                      }`}
                    >
                      <input
                        type="radio"
                        name="soin"
                        value={`offre-${o.id}`}
                        checked={isSel}
                        onChange={() => setSelectedOffer(o)}
                        aria-labelledby={`rf-offre-${o.id}-nom`}
                        aria-describedby={`rf-offre-${o.id}-desc`}
                        className="sr-only"
                      />
                      <div className="flex flex-col sm:flex-row">
                        {o.image_url && (
                          // Visuel carré, comme partout ailleurs : il n'est jamais rogné différemment ici.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.image_url}
                            alt=""
                            className="w-full sm:w-44 aspect-square object-cover shrink-0 sm:self-start sm:m-5 sm:mr-0 sm:rounded-[var(--radius-base,0.75rem)]"
                          />
                        )}
                        <div className="flex-1 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <span id={`rf-offre-${o.id}-nom`} className="block text-lg font-serif font-medium text-stone-deep group-hover:text-sage transition-colors">
                              {o.titre}
                            </span>
                            {/* `div` et non `p` : la charte du site impose sa taille à tout paragraphe. */}
                            <div id={`rf-offre-${o.id}-desc`} className="text-muted text-xs sm:text-sm leading-relaxed font-light space-y-2">
                              {o.description && (
                                <div className="rich-text" dangerouslySetInnerHTML={{ __html: offerDescriptionHtml(o.description) }} />
                              )}
                              <div className="font-medium text-stone-deep">Valable {formatOfferPeriod(o.date_debut, o.date_fin)}.</div>
                            </div>
                            {o.places_restantes != null && (
                              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage/10 text-sage border border-sage/20">
                                {o.places_restantes === 1
                                  ? 'Dernière place'
                                  : o.places_restantes <= 5
                                    ? `Plus que ${o.places_restantes} places`
                                    : `${o.places_restantes} places disponibles`}
                              </span>
                            )}
                            {o.conditions && <div className="text-[11px] text-muted leading-snug whitespace-pre-line">{o.conditions}</div>}
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                            <div className="text-right">
                              <div className="text-xl font-serif font-semibold text-sage">{chf(o.prix_chf)}</div>
                              {o.prix_normal_chf != null && o.prix_normal_chf > o.prix_chf && (
                                <div className="text-xs text-muted">
                                  au lieu de <s>{chf(o.prix_normal_chf)}</s>
                                </div>
                              )}
                              <div className="inline-flex items-center gap-1 text-xs text-muted">
                                <Clock className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                                {formatOfferDuration(o.duree_minutes)}
                              </div>
                            </div>
                            <div
                              aria-hidden="true"
                              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                                isSel ? 'bg-sage border-sage text-white' : 'border-border text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
                <p className="text-xs text-muted pt-1">Ou choisissez un soin de la carte :</p>
              </fieldset>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" role="group" aria-label="Catégories de soins">
              {CATEGORIES.map((cat) => {
                const isCatActive = !selectedOffer && selectedCategory === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isCatActive}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`p-3.5 sm:p-4 rounded-[var(--radius-base,0.75rem)] text-left border transition-all ${
                      isCatActive
                        ? 'bg-sage text-white border-sage shadow-sm'
                        : 'bg-surface text-stone-deep border-border hover:border-sage/40 hover:bg-stone-50'
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 mb-2 ${isCatActive ? 'text-white' : 'text-sage'}`}
                      aria-hidden="true"
                    />
                    <div className="text-xs sm:text-sm font-semibold leading-tight">{cat.label}</div>
                    <div className={`text-[11px] mt-0.5 truncate ${isCatActive ? 'text-white/90' : 'text-muted'}`}>
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <fieldset className="space-y-4 min-w-0">
              <legend className="sr-only">Choisissez votre soin</legend>
              {servicesCatalog
                .filter((p) => p.category === selectedCategory)
                .map((item) => {
                  const isSelected = !selectedOffer && selectedService?.id === item.id;
                  const shownVariant = item.variants && isSelected ? item.variants[selectedVariantIndex] : undefined;
                  return (
                    <div
                      key={item.id}
                      data-surface
                      className={`group relative rounded-[var(--radius-base,1rem)] border transition-all bg-surface focus-within:ring-2 focus-within:ring-sage/40 ${
                        isSelected
                          ? 'border-sage ring-2 ring-sage/20 shadow-md bg-sage/5'
                          : 'border-border hover:border-sage/40 hover:shadow-xs'
                      }`}
                    >
                      <label className="block cursor-pointer p-5 sm:p-6">
                        <input
                          type="radio"
                          name="soin"
                          value={item.id}
                          checked={isSelected}
                          aria-labelledby={`rf-soin-${item.id}-nom`}
                          aria-describedby={`rf-soin-${item.id}-desc`}
                          onChange={() => {
                            setSelectedService(item);
                            setSelectedVariantIndex(0);
                            setSelectedOffer(null);
                          }}
                          className="sr-only"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                id={`rf-soin-${item.id}-nom`}
                                className="text-lg font-serif font-medium text-stone-deep group-hover:text-sage transition-colors"
                              >
                                {item.name}
                              </span>
                              {item.tag && (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sage/10 text-sage border border-sage/20">
                                  {item.tag}
                                </span>
                              )}
                            </div>
                            <p
                              id={`rf-soin-${item.id}-desc`}
                              className="text-muted text-xs sm:text-sm leading-relaxed max-w-2xl font-light"
                            >
                              {item.description}
                            </p>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                            <div className="text-right">
                              <div className="text-xl font-serif font-semibold text-sage">
                                {chf(shownVariant?.priceChf ?? item.priceChf)}
                              </div>
                              <div className="inline-flex items-center gap-1 text-xs text-muted">
                                <Clock className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                                {shownVariant?.durationLabel ?? item.durationLabel}
                              </div>
                            </div>
                            <div
                              aria-hidden="true"
                              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                                isSelected ? 'bg-sage border-sage text-white' : 'border-border text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </label>

                      {/* Variantes de durée (ex. massage relaxant 60 ou 90 min) */}
                      {item.variants && item.variants.length > 0 && isSelected && (
                        <fieldset className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-2 flex flex-wrap items-center gap-2 min-w-0">
                          <legend className="text-xs text-muted font-medium float-left mr-2 py-1.5">
                            Choisissez la durée :
                          </legend>
                          {item.variants.map((v, idx) => (
                            <label key={v.durationMinutes} className="cursor-pointer">
                              <input
                                type="radio"
                                name={`duree-${item.id}`}
                                checked={selectedVariantIndex === idx}
                                onChange={() => setSelectedVariantIndex(idx)}
                                className="sr-only peer"
                              />
                              <span
                                className={`inline-block px-3 py-2 rounded-lg text-xs font-semibold transition-all peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-sage ${
                                  selectedVariantIndex === idx
                                    ? 'bg-sage text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                }`}
                              >
                                {v.durationLabel} — {chf(v.priceChf)}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                      )}
                    </div>
                  );
                })}
            </fieldset>

            {/* Soins en plus : s'enchaînent dans la même séance, la durée totale est réservée */}
            {(selectedService || selectedOffer) && extraCatalog.length > 0 && (
              <section
                data-surface
                aria-labelledby="rf-extras-titre"
                className="bg-surface rounded-[var(--radius-base,1rem)] border border-border shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setExtrasOpen((o) => !o)}
                  aria-expanded={extrasOpen}
                  aria-controls="rf-extras-liste"
                  className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage shrink-0"
                    >
                      <Plus className="w-5 h-5" />
                    </span>
                    <span>
                      <span id="rf-extras-titre" className="block text-sm sm:text-base font-serif font-semibold text-stone-deep">
                        Ajouter un autre soin à votre séance
                      </span>
                      <span className="block text-xs text-muted font-light">
                        Facultatif · les soins s&apos;enchaînent, la durée totale vous est réservée
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-sage shrink-0">
                    {chosenExtras.length > 0
                      ? `${chosenExtras.length} ajouté${chosenExtras.length > 1 ? 's' : ''}`
                      : extrasOpen
                        ? 'Masquer'
                        : 'Voir'}
                  </span>
                </button>

                {chosenExtras.length > 0 && (
                  <ul className="px-4 sm:px-5 pb-4 flex flex-wrap gap-2" aria-label="Soins ajoutés">
                    {chosenExtras.map((x) => (
                      <li key={x.item.id}>
                        <button
                          type="button"
                          onClick={() => toggleExtra(x.item.id)}
                          className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-sage/10 border border-sage/30 text-xs font-medium text-stone-deep hover:border-sage"
                        >
                          {x.item.name} · {formatDuree(x.durationMinutes)}
                          <X className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
                          <span className="sr-only"> (retirer)</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {extrasOpen && (
                  <div id="rf-extras-liste" className="border-t border-border px-4 sm:px-5 py-4 space-y-5">
                    {[...new Set(extraCatalog.map((i) => i.groupe))].map((groupe) => {
                      const items = extraCatalog.filter((i) => i.groupe === groupe && i.id !== mainId);
                      if (items.length === 0) return null;
                      return (
                        <fieldset key={groupe} className="min-w-0 space-y-2">
                          <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">{groupe}</legend>
                          {items.map((item) => {
                            const chosen = chosenExtras.find((x) => x.item.id === item.id);
                            const full = !chosen && chosenExtras.length >= MAX_EXTRAS;
                            const v = chosen && item.variants?.[chosen.variantIndex];
                            return (
                              <div
                                key={item.id}
                                className={`rounded-[var(--radius-base,0.75rem)] border transition-colors ${
                                  chosen ? 'border-sage bg-sage/5' : 'border-border hover:border-sage/40'
                                } ${full ? 'opacity-50' : ''}`}
                              >
                                <label className={`flex items-center gap-3 p-3 ${full ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input
                                    type="checkbox"
                                    checked={!!chosen}
                                    disabled={full}
                                    onChange={() => toggleExtra(item.id)}
                                    className="w-4 h-4 shrink-0 accent-[var(--color-sage)]"
                                  />
                                  <span className="flex-1 min-w-0 text-sm text-stone-deep leading-snug">{item.name}</span>
                                  <span className="text-right shrink-0">
                                    <span className="block text-sm font-semibold text-sage">
                                      + {chf(v ? v.priceChf : item.priceChf)}
                                    </span>
                                    <span className="block text-[11px] text-muted">
                                      + {formatDuree(v ? v.durationMinutes : item.durationMinutes)}
                                    </span>
                                  </span>
                                </label>
                                {chosen && item.variants && item.variants.length > 1 && (
                                  <div className="px-3 pb-3 flex flex-wrap gap-2" role="group" aria-label={`Durée de ${item.name}`}>
                                    {item.variants.map((vv, idx) => (
                                      <button
                                        key={vv.durationMinutes}
                                        type="button"
                                        aria-pressed={chosen.variantIndex === idx}
                                        onClick={() => setExtraVariant(item.id, idx)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                          chosen.variantIndex === idx ? 'bg-sage text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                        }`}
                                      >
                                        {vv.durationLabel} — {chf(vv.priceChf)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </fieldset>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-4 sm:p-5 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-muted block font-medium">
                  {chosenExtras.length > 0 ? 'Votre séance :' : 'Soin sélectionné :'}
                </span>
                <span className="text-base sm:text-lg font-serif font-semibold text-stone-deep">
                  {currentServiceName || 'Veuillez choisir un soin'}
                </span>
                {chosenExtras.map((x) => (
                  <span key={x.item.id} className="block text-xs text-stone-deep">
                    + {x.item.name}
                  </span>
                ))}
                <div className="text-xs text-sage font-medium mt-0.5">
                  {chf(selectedService || selectedOffer ? currentPriceChf : 0)} · Durée : {formatDuree(currentDurationMinutes)}
                </div>
              </div>

              <button
                type="button"
                data-btn="primary"
                onClick={() => {
                  setCatalogNotice(null);
                  setCurrentStep(2);
                }}
                disabled={!selectedService && !selectedOffer}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 font-medium tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Choisir votre séance
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 2 : JOUR + HEURE ═══ */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-fadein">
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage shrink-0" aria-hidden="true">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm text-stone-deep font-light">
                <p className="font-semibold text-stone-deep">Vous choisissez votre jour et votre heure.</p>
                <p className="text-muted">
                  Votre horaire vous est réservé dès l&apos;envoi de la demande ; Emmanuelle vous recontacte ensuite pour
                  <strong> confirmer votre rendez-vous</strong>. {BATTEMENT_MINUTES} minutes de battement sont prévues
                  entre deux clientes pour aérer et désinfecter la cabine, et garantir votre discrétion.
                </p>
              </div>
            </div>

            {selectedOffer && (
              <div className="p-4 rounded-xl bg-sage/5 border border-sage/30 text-stone-deep text-sm flex items-start gap-3">
                <BadgePercent className="w-5 h-5 shrink-0 text-sage" aria-hidden="true" />
                <span>
                  <strong className="font-semibold">{selectedOffer.titre}</strong> est valable{' '}
                  {formatOfferPeriod(selectedOffer.date_debut, selectedOffer.date_fin)} : seuls les jours de cette période
                  sont proposés.
                </span>
              </div>
            )}

            {slotsNotice && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{slotsNotice}</span>
              </div>
            )}

            {/* Jour */}
            <section className="space-y-3" aria-labelledby="rf-jour-titre">
              <h3 id="rf-jour-titre" className="text-base sm:text-lg font-serif font-medium text-stone-deep">
                1. Choisissez le jour de votre rendez-vous
              </h3>

              {calendarLoading && !calendar ? (
                <div role="status" className="py-12 text-center space-y-3 bg-surface rounded-[var(--radius-base,1rem)] border border-border">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sage" aria-hidden="true" />
                  <p className="text-xs sm:text-sm text-muted font-light">Chargement du calendrier de l&apos;institut…</p>
                </div>
              ) : calendarError ? (
                <div role="alert" className="p-5 rounded-[var(--radius-base,1rem)] bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
                    <p>
                      {calendarError} Nous ne pouvons pas enregistrer de demande sans consulter l&apos;agenda.
                      {businessPhone && (
                        <>
                          {' '}Vous pouvez aussi appeler l&apos;institut au{' '}
                          <a href={`tel:${businessPhone.replace(/[^\d+]/g, '')}`} className="underline font-semibold">
                            {businessPhone}
                          </a>
                          .
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-btn="secondary"
                    onClick={() => setCalendarKey((k) => k + 1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    Réessayer
                  </button>
                </div>
              ) : calendar && !selectedDate ? (
                <div className="py-10 text-center bg-surface rounded-[var(--radius-base,1rem)] border border-border p-6 space-y-2">
                  <Clock className="w-8 h-8 text-muted mx-auto" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-stone-deep">Aucun jour disponible pour le moment</h4>
                  <p className="text-xs text-muted max-w-sm mx-auto font-light">
                    L&apos;agenda est complet sur les prochaines semaines pour la durée de ce soin.
                    {businessPhone && ` Contactez l’institut au ${businessPhone}.`}
                  </p>
                </div>
              ) : calendar ? (
                <div className={calendarLoading ? 'opacity-60 pointer-events-none' : ''} aria-busy={calendarLoading}>
                  <DayCalendar
                    from={calendarRange.from}
                    to={calendarRange.to}
                    jours={calendar.jours}
                    selected={selectedDate}
                    today={today}
                    onSelect={(d) => {
                      setSlotsNotice(null);
                      setSelectedDate(d);
                    }}
                  />
                </div>
              ) : null}
            </section>

            {/* Heure */}
            {calendar && selectedDate && (
              <section className="space-y-4" aria-labelledby="rf-heure-titre">
                <div className="border-b border-border pb-3">
                  <h3 id="rf-heure-titre" className="text-base sm:text-lg font-serif font-medium text-stone-deep">
                    2. À quelle heure, le <span>{formattedDate}</span> ?
                  </h3>
                  <p className="text-xs text-muted font-light mt-0.5">
                    Votre séance dure {formatDuree(currentDurationMinutes)}. Seuls les horaires où elle tient entièrement
                    sont proposés, avec {BATTEMENT_MINUTES} minutes de battement entre deux clientes.
                  </p>
                </div>

                <div>
                  {loadingSlots ? (
                    <div role="status" className="py-14 text-center space-y-3 bg-surface rounded-[var(--radius-base,1rem)] border border-border">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sage" aria-hidden="true" />
                      <p className="text-xs sm:text-sm text-muted font-light">
                        Vérification des disponibilités…
                      </p>
                    </div>
                  ) : slotsError ? (
                    <div role="alert" className="p-5 rounded-[var(--radius-base,1rem)] bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 text-amber-700" aria-hidden="true" />
                        <p>{slotsError}</p>
                      </div>
                      <button
                        type="button"
                        data-btn="secondary"
                        onClick={() => setSlotsKey((k) => k + 1)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold"
                      >
                        <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        Réessayer
                      </button>
                    </div>
                  ) : dayInfo && (dayInfo.ouvert === false || freeSlots.length === 0) ? (
                    <div className="py-10 text-center bg-surface rounded-[var(--radius-base,1rem)] border border-border p-6 space-y-2">
                      <Clock className="w-8 h-8 text-muted mx-auto" aria-hidden="true" />
                      <h4 className="text-sm font-semibold text-stone-deep">
                        {dayInfo.ouvert === false ? 'L’institut est fermé ce jour-là' : 'Plus d’horaire libre ce jour-là pour cette durée'}
                      </h4>
                      <p className="text-xs text-muted max-w-sm mx-auto font-light">
                        Veuillez sélectionner un autre jour dans le calendrier ci-dessus.
                      </p>
                    </div>
                  ) : dayInfo ? (
                    <fieldset className="min-w-0 space-y-5">
                      <legend className="sr-only">Choisissez votre heure d&apos;arrivée</legend>
                      {PERIODES.map((p) => {
                        const slots = freeSlots.filter((sl) => sl.periode === p);
                        const Icon = p === 'matin' ? Sun : Sunset;
                        return (
                          <div key={p} className="space-y-2.5">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-deep">
                              <Icon className="w-4 h-4 text-sage" aria-hidden="true" />
                              {PERIODE_LABEL[p]}
                              {slots.length === 0 && (
                                <span className="normal-case tracking-normal font-light text-muted">— complet</span>
                              )}
                            </div>
                            {slots.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                                {slots.map((sl) => {
                                  const checked = selectedTime === sl.heure;
                                  return (
                                    <label
                                      key={sl.heure}
                                      className={`relative cursor-pointer rounded-lg border px-2 py-2.5 text-center text-sm font-semibold transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage has-[:focus-visible]:ring-offset-2 ${
                                        checked
                                          ? 'bg-sage text-white border-sage shadow-sm'
                                          : 'bg-surface text-stone-deep border-border hover:border-sage hover:bg-stone-50'
                                      }`}
                                    >
                                      <input
                                        type="radio"
                                        name="heure"
                                        value={sl.heure}
                                        checked={checked}
                                        onChange={() => {
                                          setSlotsNotice(null);
                                          setSelectedTime(sl.heure);
                                        }}
                                        aria-label={`${formatHeure(sl.heure)}, fin vers ${formatHeure(addMinutes(sl.heure, currentDurationMinutes))}`}
                                        className="sr-only"
                                      />
                                      {formatHeure(sl.heure)}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </fieldset>
                  ) : null}
                </div>
              </section>
            )}

            {/* Récapitulatif + navigation */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-4 sm:p-5 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage shrink-0" aria-hidden="true">
                  <CalendarCheck className="w-5 h-5 text-sage" />
                </div>
                <div>
                  <span className="text-xs text-muted block font-medium">Votre demande :</span>
                  {selectedTime && selectedDate ? (
                    <div className="text-base sm:text-lg font-serif font-semibold text-stone-deep">
                      <span className="capitalize">{formattedDate}</span> —{' '}
                      <span className="text-sage">{selectedTimeLabel}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted italic">Choisissez un jour, puis votre heure</div>
                  )}
                  <span className="text-xs text-muted block font-light">
                    Confirmée ensuite par Emmanuelle
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  data-btn="secondary"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-3 text-sm font-medium transition-all"
                >
                  Retour
                </button>
                <button
                  type="button"
                  data-btn="primary"
                  onClick={() => setCurrentStep(3)}
                  disabled={!calendar || !selectedTime || !selectedDate || loadingSlots || !!slotsError}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3.5 font-medium text-sm sm:text-base tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer vers vos coordonnées
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 3 : COORDONNÉES ═══ */}
        {currentStep === 3 && (
          <form className="space-y-8 animate-fadein" onSubmit={handleSubmitBooking} noValidate>
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted font-medium">Récapitulatif de votre demande :</span>
                <div className="text-base font-serif font-semibold text-stone-deep">
                  {currentServiceName}
                </div>
                {chosenExtras.length > 0 && (
                  <ul className="text-xs text-stone-deep">
                    {chosenExtras.map((x) => (
                      <li key={x.item.id}>+ {x.item.name}</li>
                    ))}
                  </ul>
                )}
                <div className="text-xs text-muted flex flex-wrap items-center gap-x-2">
                  <span className="capitalize">{formattedDate}</span>
                  <span aria-hidden="true">—</span>
                  <span className="font-semibold text-stone-deep">{selectedTimeLabel}</span>
                  <span className="font-light">({formatDuree(currentDurationMinutes)})</span>
                </div>
                <div className="text-[11px] text-muted font-light">Horaire réservé pour vous, confirmé ensuite par Emmanuelle.</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block">Total estimé, à régler sur place :</span>
                <span className="text-2xl font-serif font-bold text-sage">{chf(currentPriceChf)}</span>
              </div>
            </div>

            {/* Charte de confiance */}
            <div className="rounded-[var(--radius-base,1rem)] border border-sage/30 bg-surface p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage">
                <ShieldCheck className="w-4 h-4 text-sage" aria-hidden="true" />
                Charte sérénité &amp; confiance Emmanuelle Esthétique
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    n: 1,
                    title: 'Aucun paiement en ligne',
                    text: 'Votre demande se fait sans carte bancaire sur le site. Vous réglez sur place le jour de votre venue (cartes, Twint ou espèces).',
                  },
                  {
                    n: 2,
                    title: 'Confirmation personnelle',
                    text: 'Votre horaire vous est réservé dès l’envoi. Emmanuelle vous recontacte personnellement pour confirmer votre rendez-vous et répondre à vos éventuelles attentes.',
                  },
                  {
                    n: 3,
                    title: 'Cabine privée exclusive',
                    text: 'Vous êtes l’unique hôte de l’institut. 30 minutes de battement séparent toujours deux clientes, pour votre entière tranquillité.',
                  },
                ].map((c) => (
                  <div key={c.n} className="bg-paper rounded-xl p-4 border border-border space-y-1.5">
                    <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">
                      {c.n}
                    </div>
                    <h4 className="text-xs font-bold text-stone-deep uppercase tracking-wide">{c.title}</h4>
                    <p className="text-[12px] text-muted font-light leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Coordonnées */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-6 sm:p-8 border border-border shadow-sm space-y-6">
              <h3 className="text-xl font-serif font-medium text-stone-deep">Vos coordonnées de contact</h3>

              {submitError && (
                <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs sm:text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Prénom */}
                <div className="space-y-1">
                  <label htmlFor="rf-prenom" className={labelClass}>
                    Prénom <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rf-prenom"
                    type="text"
                    required
                    aria-required="true"
                    autoComplete="given-name"
                    maxLength={80}
                    placeholder="Ex : Sophie"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    aria-invalid={!!formErrors.prenom}
                    aria-describedby={formErrors.prenom ? 'rf-prenom-err' : undefined}
                    className={fieldClass(!!formErrors.prenom)}
                  />
                  {formErrors.prenom && <p id="rf-prenom-err" className="text-xs text-red-700">{formErrors.prenom}</p>}
                </div>

                {/* Nom */}
                <div className="space-y-1">
                  <label htmlFor="rf-nom" className={labelClass}>
                    Nom de famille <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="rf-nom"
                    type="text"
                    required
                    aria-required="true"
                    autoComplete="family-name"
                    maxLength={80}
                    placeholder="Ex : Dufour"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    aria-invalid={!!formErrors.nom}
                    aria-describedby={formErrors.nom ? 'rf-nom-err' : undefined}
                    className={fieldClass(!!formErrors.nom)}
                  />
                  {formErrors.nom && <p id="rf-nom-err" className="text-xs text-red-700">{formErrors.nom}</p>}
                </div>

                {/* Téléphone */}
                <div className="space-y-1">
                  <label htmlFor="rf-telephone" className={labelClass}>
                    Téléphone (mobile de préférence) <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="rf-telephone"
                      type="tel"
                      inputMode="tel"
                      required
                      aria-required="true"
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="079 123 45 67"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      aria-invalid={!!formErrors.telephone}
                      aria-describedby={formErrors.telephone ? 'rf-telephone-err' : 'rf-telephone-hint'}
                      className={`${fieldClass(!!formErrors.telephone)} pr-11`}
                    />
                    <Phone className="w-4 h-4 text-muted absolute right-4 top-3.5" aria-hidden="true" />
                  </div>
                  {formErrors.telephone ? (
                    <p id="rf-telephone-err" className="text-xs text-red-700">{formErrors.telephone}</p>
                  ) : (
                    <p id="rf-telephone-hint" className="text-xs text-muted font-light">
                      Emmanuelle vous contacte sur ce numéro pour confirmer votre rendez-vous.
                    </p>
                  )}
                </div>

                {/* E-mail */}
                <div className="space-y-1">
                  <label htmlFor="rf-email" className={labelClass}>
                    Adresse e-mail (optionnelle)
                  </label>
                  <input
                    id="rf-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={120}
                    placeholder="sophie.dufour@exemple.ch"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    aria-invalid={!!formErrors.email}
                    aria-describedby={formErrors.email ? 'rf-email-err' : 'rf-email-hint'}
                    className={fieldClass(!!formErrors.email)}
                  />
                  {formErrors.email ? (
                    <p id="rf-email-err" className="text-xs text-red-700">{formErrors.email}</p>
                  ) : (
                    <p id="rf-email-hint" className="text-xs text-muted font-light">
                      Pour recevoir un accusé de réception de votre demande.
                    </p>
                  )}
                </div>

                {/* Code postal */}
                <div className="space-y-1">
                  <label htmlFor="rf-cp" className={labelClass}>
                    Code postal
                  </label>
                  <input
                    id="rf-cp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={10}
                    placeholder="Ex : 1607"
                    value={formData.codePostal}
                    onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                    className={fieldClass(false)}
                  />
                </div>

                {/* Ville */}
                <div className="space-y-1">
                  <label htmlFor="rf-ville" className={labelClass}>
                    Localité / Ville
                  </label>
                  <input
                    id="rf-ville"
                    type="text"
                    autoComplete="address-level2"
                    maxLength={80}
                    placeholder="Ex : Palézieux"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className={fieldClass(false)}
                  />
                </div>
              </div>

              {/* Remarques */}
              <div className="space-y-1">
                <label htmlFor="rf-notes" className={labelClass}>
                  Message supplémentaire (optionnel)
                </label>
                <textarea
                  id="rf-notes"
                  rows={3}
                  maxLength={1000}
                  placeholder="Un message pour Emmanuelle…"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={fieldClass(false)}
                />
              </div>

              {/* Piège à robots : invisible et hors parcours clavier, doit rester vide */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
              >
                <label htmlFor="rf-champ-piege">Laisser vide</label>
                <input
                  id="rf-champ-piege"
                  type="text"
                  name="champ_piege"
                  tabIndex={-1}
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  value={champPiege}
                  onChange={(e) => setChampPiege(e.target.value)}
                />
              </div>

              {/* Consentements : facultatifs, jamais précochés */}
              <fieldset className="space-y-3 pt-2 border-t border-border min-w-0">
                <legend className="text-xs font-semibold text-stone-deep uppercase tracking-wider pt-4 pb-1">
                  Restons en contact (facultatif)
                </legend>

                {emailFilled && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentEmail}
                      onChange={(e) => setConsentEmail(e.target.checked)}
                      className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-sage)]"
                    />
                    <span className="text-sm text-stone-deep font-light leading-relaxed">
                      Je souhaite recevoir les offres d&apos;Emmanuelle par <strong className="font-semibold">e-mail</strong>.
                      Désinscription possible à tout moment, gratuitement.
                    </span>
                  </label>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentWhatsapp}
                    onChange={(e) => setConsentWhatsapp(e.target.checked)}
                    className="mt-1 w-4 h-4 shrink-0 accent-[var(--color-sage)]"
                  />
                  <span className="text-sm text-stone-deep font-light leading-relaxed">
                    Je souhaite recevoir les offres d&apos;Emmanuelle par <strong className="font-semibold">WhatsApp</strong>.
                    Désinscription possible à tout moment, gratuitement.
                  </span>
                </label>

                <p className="text-xs text-muted font-light leading-relaxed">
                  Ces cases ne sont pas nécessaires pour réserver. Vos coordonnées servent à traiter votre demande et à
                  vous rappeler ; elles ne sont utilisées pour des offres que si vous cochez l&apos;une de ces cases.{' '}
                  <Link href="/mentions-legales" target="_blank" className="underline text-sage font-medium">
                    Mentions légales et protection des données
                    <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                  </Link>
                  .
                </p>
              </fieldset>
            </div>

            {/* Envoi */}
            <div className="flex items-center justify-between pt-2 gap-3">
              <button
                type="button"
                data-btn="secondary"
                onClick={() => setCurrentStep(2)}
                disabled={submitting}
                className="px-5 py-3 text-sm font-medium transition-all"
              >
                Retour
              </button>

              <button
                type="submit"
                data-btn="primary"
                disabled={submitting}
                aria-busy={submitting}
                className="inline-flex items-center gap-2 px-6 sm:px-9 py-3.5 font-medium text-sm sm:text-base tracking-wide shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Envoi en cours…
                  </>
                ) : (
                  <>
                    Envoyer ma demande
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-xs text-muted font-light -mt-4">
              {estimatedSummary} · Votre rendez-vous sera confirmé par Emmanuelle.
            </p>
          </form>
        )}

        {/* ═══ ÉTAPE 4 : DEMANDE ENREGISTRÉE ═══ */}
        {currentStep === 4 && confirmedBooking && (
          <ConfirmationStep
            booking={confirmedBooking}
            prenom={submittedPrenom}
            businessPhone={businessPhone}
            estimatedTotal={submittedEstimate}
            headingRef={headingRef}
          />
        )}
      </div>
    </div>
  );
}
