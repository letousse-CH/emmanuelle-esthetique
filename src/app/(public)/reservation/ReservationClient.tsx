"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Phone, RefreshCw, Send } from 'lucide-react';
import {
  PERIODE_LABEL,
  type AvailableDaySlots,
  type BookingPeriode,
  type PublicBookingErrorCode,
  type PublicBookingRequest,
  type PublicBookingView,
  type PublicCalendar,
} from '../../../types/booking';
import type { PublicOffer } from '../../../types/offers';
import { formatOfferPeriod } from '../../../types/offers';
import { PRESTATIONS_CATALOG, type PrestationItem, type PrivilegeOption } from './catalog';
import { addDays, formatDateLong, formatHeure, isValidDateStr, todayZurich } from './dates';
import { chf } from './format';
import { validateContact, type ContactErrors } from './validation';
import DayCalendar from './DayCalendar';
import ConfirmationStep from './ConfirmationStep';
import { FAMILIES, familyFromParam, familyOf, getFamily, type FamilyId } from './families';
import {
  MAX_EXTRAS,
  OFFER_PREFIX,
  addMinutes,
  buildSeance,
  formatDuree,
  rankComplements,
  suggestPairings,
  togglePick,
  type Pick,
} from './seance';
import {
  FamilyNav,
  FamilySection,
  MobileBar,
  OfferCard,
  PlusSection,
  QuickComplements,
  SeanceSummary,
  SoinRow,
  SoinSkeleton,
  Stepper,
  type StepNum,
} from './parts';

/** Fenêtre proposée dans le calendrier (le serveur borne en plus par ses propres règles). */
const CALENDAR_DAYS = 60;
const PERIODES: BookingPeriode[] = ['matin', 'apres_midi'];
/** Battement incompressible entre deux clientes (le serveur l'impose, voir bookingEngine). */
const BATTEMENT_MINUTES = 30;

const STEP_LABELS: Record<1 | 2 | 3, string> = { 1: 'Vos soins', 2: 'Date et heure', 3: 'Coordonnées' };

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

export default function ReservationClient({ businessPhone, businessOwner }: ReservationClientProps) {
  const searchParams = useSearchParams();
  const ownerFirstName = (businessOwner || '').trim().split(/\s+/)[0] || undefined;
  const owner = ownerFirstName || 'Emmanuelle';

  const [currentStep, setCurrentStep] = useState<StepNum>(1);

  // ── Catalogue : la base, sinon le repli codé en dur (ids de carteSoins, que le serveur accepte).
  const [servicesCatalog, setServicesCatalog] = useState<PrestationItem[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<PrivilegeOption[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogKey, setCatalogKey] = useState(0);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const catalogParamsApplied = useRef(false);

  // Offres du moment : réservées comme un soin à part entière.
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const offerParamApplied = useRef(false);

  // ── La séance : soins choisis, dans l'ordre des clics.
  // Univers à l'écran (barre collante) ; `?category=` / `?soin=` y font défiler une fois la carte chargée.
  const [activeFamily, setActiveFamily] = useState<FamilyId>('visage');
  const [scrollToFamily, setScrollToFamily] = useState<FamilyId | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announce, setAnnounce] = useState('');

  // ── Jour + heure
  const today = useMemo(() => todayZurich(), []);
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

  // ── Coordonnées
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

  // ── Demande enregistrée
  const [confirmedBooking, setConfirmedBooking] = useState<PublicBookingView | null>(null);
  const [submittedPrenom, setSubmittedPrenom] = useState('');
  const [submittedEstimate, setSubmittedEstimate] = useState(0);
  const [confirmedImage, setConfirmedImage] = useState<{ url: string; alt: string } | null>(null);

  // Défilement + focus au changement d'étape
  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    setDrawerOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    stepTopRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
  }, [currentStep]);

  // ── Catalogue des soins (base) + paramètres d'URL (?soin=, ?category=) ──
  useEffect(() => {
    let cancelled = false;

    const resolve = (list: PrestationItem[], options: PrivilegeOption[]) => {
      setServicesCatalog(list);
      setCatalogOptions(options);
      setCatalogReady(true);
      // Un soin retiré du catalogue entre-temps sort de la séance.
      setPicks((prev) =>
        prev.filter(
          (p) => p.key.startsWith(OFFER_PREFIX) || list.some((s) => s.id === p.key) || options.some((o) => o.id === p.key)
        )
      );

      if (catalogParamsApplied.current) return;
      catalogParamsApplied.current = true;
      const paramSoin = searchParams?.get('soin') || searchParams?.get('service');
      if (paramSoin) {
        const needle = paramSoin.toLowerCase();
        const match = list.find((s) => s.id.toLowerCase() === needle || s.name.toLowerCase().includes(needle));
        if (match) {
          setScrollToFamily(familyOf(match));
          setPicks((prev) => (prev.some((p) => p.key === match.id) ? prev : [...prev, { key: match.id, variantIndex: 0 }]));
          return;
        }
      }
      const fam = familyFromParam(searchParams?.get('category'));
      if (fam && list.some((s) => familyOf(s) === fam)) setScrollToFamily(fam);
    };

    fetch('/api/bookings/services')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.services) && data.services.length > 0) {
          resolve(data.services, Array.isArray(data.options) ? data.options : []);
        } else {
          // Base injoignable : le repli (ids de carteSoins) reste utilisable.
          resolve(PRESTATIONS_CATALOG, []);
        }
      })
      .catch((err) => {
        console.warn('[ReservationClient] Services dynamiques non chargés:', err);
        if (!cancelled) resolve(PRESTATIONS_CATALOG, []);
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
        setPicks((prev) =>
          prev.filter((p) => !p.key.startsWith(OFFER_PREFIX) || list.some((o) => `${OFFER_PREFIX}${o.id}` === p.key))
        );
        if (!offerParamApplied.current) {
          offerParamApplied.current = true;
          const paramOffre = searchParams?.get('offre');
          const match = paramOffre ? list.find((o) => o.id === paramOffre) : undefined;
          if (match) {
            const key = `${OFFER_PREFIX}${match.id}`;
            setPicks((prev) => togglePick(prev.filter((p) => p.key !== key), key) ?? prev);
          } else if (paramOffre) {
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

  // ── Séance : soin principal + soins en plus (estimation : le serveur recalcule) ──
  const seance = useMemo(
    () => buildSeance(picks, { services: servicesCatalog, options: catalogOptions, offers }),
    [picks, servicesCatalog, catalogOptions, offers]
  );
  const main = seance.main;
  const selectedOffer = main?.kind === 'offre' ? offers.find((o) => o.id === main.offerId) ?? null : null;
  const full = seance.lines.length >= MAX_EXTRAS + 1;
  const currentDurationMinutes = seance.durationMinutes || 60;

  const families = useMemo(
    () =>
      FAMILIES.map((family) => ({
        family,
        count: servicesCatalog.filter((s) => familyOf(s) === family.id).length,
        picked: seance.lines.filter((l) => l.family === family.id).length,
      })).filter((f) => f.count > 0),
    [servicesCatalog, seance.lines]
  );
  const complements = useMemo(() => rankComplements(catalogOptions, main), [catalogOptions, main]);
  const pairings = useMemo(() => suggestPairings(servicesCatalog, seance), [servicesCatalog, seance]);

  // ── Barre de menu du site (fixe, sa hauteur change au défilement) : la barre des
  // univers et le récapitulatif se collent juste dessous.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav.fixed, header.fixed');
    const root = rootRef.current;
    if (!nav || !root) return;
    const update = () => root.style.setProperty('--rsv-top', `${Math.max(0, Math.round(nav.getBoundingClientRect().bottom))}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Univers en cours de lecture : le dernier dont le haut a passé la barre collante.
  const familyEls = useRef<Partial<Record<FamilyId, HTMLElement | null>>>({});
  const spyLockedUntil = useRef(0);
  const familyIdsKey = families.map((f) => f.family.id).join(',');
  useEffect(() => {
    if (currentStep !== 1 || !catalogReady) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (Date.now() < spyLockedUntil.current) return;
        const top = parseInt(rootRef.current?.style.getPropertyValue('--rsv-top') || '112', 10) + 120;
        let current: FamilyId | null = null;
        for (const id of familyIdsKey.split(',') as FamilyId[]) {
          const el = familyEls.current[id];
          if (el && el.getBoundingClientRect().top <= top) current = id;
        }
        setActiveFamily(current ?? ((familyIdsKey.split(',')[0] as FamilyId) || 'visage'));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [currentStep, catalogReady, familyIdsKey]);

  const goToFamily = useCallback((id: FamilyId, smooth = true) => {
    const el = familyEls.current[id];
    if (!el) return;
    setActiveFamily(id);
    // Le suivi du défilement se tait le temps du trajet, sinon la barre égrène les univers traversés.
    spyLockedUntil.current = Date.now() + 900;
    const offset = parseInt(rootRef.current?.style.getPropertyValue('--rsv-top') || '112', 10) + 76;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!scrollToFamily || !catalogReady || currentStep !== 1) return;
    // Laisse les rubriques se mettre en page (et le navigateur restaurer sa position) avant de défiler.
    const t = window.setTimeout(() => {
      goToFamily(scrollToFamily);
      setScrollToFamily(null);
    }, 300);
    return () => window.clearTimeout(t);
  }, [scrollToFamily, catalogReady, currentStep, goToFamily]);

  const handleToggle = (key: string, variantIndex = 0) => {
    const wasPicked = picks.some((p) => p.key === key);
    const next = togglePick(picks, key, variantIndex);
    if (!next) {
      setLimitReached(true);
      return;
    }
    setLimitReached(false);
    setCatalogNotice(null);
    setPicks(next);
    const name = seance.lines.find((l) => l.key === key)?.name
      ?? servicesCatalog.find((s) => s.id === key)?.name
      ?? catalogOptions.find((o) => o.id === key)?.nom
      ?? offers.find((o) => `${OFFER_PREFIX}${o.id}` === key)?.titre
      ?? 'Soin';
    setAnnounce(wasPicked ? `${name} retiré de votre séance.` : `${name} ajouté à votre séance.`);
  };
  const setVariant = (key: string, variantIndex: number) =>
    setPicks((prev) => prev.map((p) => (p.key === key ? { ...p, variantIndex } : p)));

  const scrollToPlus = () => {
    const el = document.getElementById('rsv-plus');
    if (!el) return;
    setDrawerOpen(false);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  // ── Calendrier des jours (GET /api/bookings/calendar) ──
  // Avec une offre, seuls les jours de sa période sont proposés (le serveur le vérifie aussi).
  const calendarRange = useMemo(() => {
    const base = { from: today, to: addDays(today, CALENDAR_DAYS - 1) };
    if (!selectedOffer) return base;
    const from = selectedOffer.date_debut > today ? selectedOffer.date_debut : today;
    const to = selectedOffer.date_fin < base.to ? selectedOffer.date_fin : base.to;
    return { from, to: to < from ? from : to };
  }, [today, selectedOffer]);

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
  const when = currentStep >= 2 && selectedDate && selectedTime ? { day: formattedDate, time: selectedTimeLabel } : null;

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
    if (!main || !selectedDate || !selectedTime) {
      setSubmitError('Veuillez choisir un soin, un jour et une heure.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

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
      service_id: main.kind === 'soin' ? main.key : null,
      // Offre du moment : prix, durée, période et places sont contrôlés par le serveur.
      offer_of_month_id: main.kind === 'offre' ? main.offerId : null,
      // Soins ajoutés : identifiants seulement, le serveur retrouve prix et durées.
      options: seance.extras.map((x) => ({ id: x.key, variante_duree_minutes: x.variantMinutes })),
      variante_duree_minutes: main.kind === 'soin' ? main.variantMinutes : null,
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
          setPicks((prev) => prev.filter((p) => !p.key.startsWith(OFFER_PREFIX)));
          setCatalogKey((k) => k + 1);
          setCurrentStep(1);
        } else if (code === 'soin_inconnu' || (!code && res.status === 422)) {
          setCatalogNotice(
            'Un de vos soins n’est plus disponible à la réservation en ligne. Vérifiez votre séance, ou contactez l’institut.'
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
        service_nom: raw.service_nom || main.name,
        options: raw.options?.length ? raw.options : seance.extras.map((x) => ({ nom: x.name, prix_chf: x.priceChf })),
        date_rdv: raw.date_rdv ?? selectedDate,
        periode: raw.periode ?? (selectedTime < '13:00' ? 'matin' : 'apres_midi'),
        heure_rdv: raw.heure_rdv ?? selectedTime,
        service_duree_minutes: raw.service_duree_minutes ?? currentDurationMinutes,
        total_chf: typeof raw.total_chf === 'number' ? raw.total_chf : seance.priceChf,
      });
      const fam = main.family ? getFamily(main.family) : null;
      setConfirmedImage(fam ? { url: fam.image, alt: fam.imageAlt } : null);
      setSubmittedPrenom(formData.prenom.trim());
      setSubmittedEstimate(seance.priceChf);
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

  // ── Bouton d'action de l'étape (récapitulatif et barre du bas) ──
  const canGoStep2 = !!main;
  const canGoStep3 = !!calendar && !!selectedDate && !!selectedTime && !loadingSlots && !slotsError;
  const goTo = (s: StepNum) => {
    setCatalogNotice(null);
    setCurrentStep(s);
  };

  const renderCta = (compact: boolean) => {
    if (currentStep === 1) {
      return (
        <button type="button" data-btn="primary" disabled={!canGoStep2} onClick={() => goTo(2)}>
          {compact ? 'Choisir la date' : 'Choisir la date et l’heure'}
          <ArrowRight aria-hidden="true" />
        </button>
      );
    }
    if (currentStep === 2) {
      return (
        <button type="button" data-btn="primary" disabled={!canGoStep3} onClick={() => goTo(3)}>
          Continuer
          <ArrowRight aria-hidden="true" />
        </button>
      );
    }
    return (
      <button type="submit" form="rsv-form" data-btn="primary" disabled={submitting} aria-busy={submitting}>
        {submitting ? 'Envoi…' : compact ? 'Envoyer' : 'Envoyer ma demande'}
        {submitting ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
      </button>
    );
  };

  const summaryHint =
    currentStep === 1
      ? seance.lines.length > 0 && !main
        ? 'Un complément accompagne un soin : ajoutez un soin à votre séance.'
        : limitReached
          ? `${MAX_EXTRAS + 1} soins au plus par séance en ligne. Pour une plus longue séance, appelez l’institut.`
          : null
      : currentStep === 2 && !selectedTime
        ? 'Choisissez un jour, puis votre heure d’arrivée.'
        : currentStep === 3
          ? `Rien n’est débité : ${owner} confirme ensuite votre rendez-vous.`
          : null;

  const minComplement = catalogOptions.length ? Math.min(...catalogOptions.map((o) => o.prix_chf)) : null;
  const nudge =
    currentStep === 1 && main && seance.extras.length === 0 && (complements.length > 0 || pairings.length > 0)
      ? {
          label:
            minComplement != null
              ? `Prolonger le moment : un complément dès ${chf(minComplement)}`
              : 'Associer un autre soin à votre séance',
          onClick: scrollToPlus,
        }
      : null;

  const summaryProps = {
    seance,
    when,
    onRemove: (key: string) => handleToggle(key),
    hint: summaryHint,
    nudge,
    ownerFirstName,
    locked: currentStep > 1,
    onEdit: currentStep > 1 ? () => goTo(1) : undefined,
  };

  const headingText = currentStep === 4 ? '' : `Étape ${currentStep} sur 3 : ${STEP_LABELS[currentStep as 1 | 2 | 3]}`;

  // ── Petits composants de champ ──
  const field = (
    key: 'prenom' | 'nom' | 'telephone' | 'email',
    label: string,
    input: React.InputHTMLAttributes<HTMLInputElement>,
    opts: { required?: boolean; hint?: string } = {}
  ) => {
    const error = formErrors[key];
    const describedBy = error ? `rf-${key}-err` : opts.hint ? `rf-${key}-hint` : undefined;
    return (
      <div className="rsv-field">
        <label htmlFor={`rf-${key}`}>
          {label}
          {opts.required ? (
            <span aria-hidden="true"> *</span>
          ) : (
            <span className="rsv-opt"> (facultatif)</span>
          )}
        </label>
        <input
          id={`rf-${key}`}
          className="rsv-input"
          required={opts.required}
          aria-required={opts.required || undefined}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          value={formData[key]}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          {...input}
        />
        {error ? (
          <div id={`rf-${key}-err`} className="rsv-field__error">{error}</div>
        ) : opts.hint ? (
          <div id={`rf-${key}-hint`} className="rsv-field__hint">{opts.hint}</div>
        ) : null}
      </div>
    );
  };

  const emailFilled = formData.email.trim().length > 0;
  const phoneLink = businessPhone ? (
    <a href={`tel:${businessPhone.replace(/[^\d+]/g, '')}`}>{businessPhone}</a>
  ) : null;

  return (
    <div className="rsv" ref={rootRef}>
      {/* L'en-tête éditorial (H1) est rendu par page.tsx, côté serveur. */}
      <div ref={stepTopRef} style={{ scrollMarginTop: '6.5rem' }} />
      {currentStep < 4 && <Stepper step={currentStep} onGo={goTo} />}

      <div className="rsv-container rsv-body">
        {/* Titre d'étape : annoncé et focalisé à chaque changement d'étape */}
        {currentStep < 4 && (
          <h2 ref={headingRef} tabIndex={-1} className="sr-only focus:outline-none">
            {headingText}
          </h2>
        )}

        {currentStep === 4 && confirmedBooking ? (
          <ConfirmationStep
            booking={confirmedBooking}
            prenom={submittedPrenom}
            businessPhone={businessPhone}
            ownerFirstName={ownerFirstName}
            estimatedTotal={submittedEstimate}
            image={confirmedImage}
            headingRef={headingRef}
          />
        ) : (
          <div className="rsv-layout">
            {/* ═══ ÉTAPE 1 : SOINS ═══ */}
            {currentStep === 1 && (
              <div className="rsv-main animate-fadein">
                {catalogNotice && (
                  <div role="alert" className="rsv-notice">
                    <AlertCircle aria-hidden="true" />
                    <span>{catalogNotice}</span>
                  </div>
                )}

                {offers.length > 0 && (
                  <section aria-labelledby="rsv-offres-titre" style={{ display: 'grid', gap: 16 }}>
                    <h2 id="rsv-offres-titre" className="sr-only">
                      {offers.length > 1 ? 'Offres du moment' : 'Offre du moment'}
                    </h2>
                    {offers.map((o) => (
                      <OfferCard
                        key={o.id}
                        offer={o}
                        picked={picks.some((p) => p.key === `${OFFER_PREFIX}${o.id}`)}
                        disabled={full && !selectedOffer}
                        onToggle={() => handleToggle(`${OFFER_PREFIX}${o.id}`)}
                      />
                    ))}
                  </section>
                )}

                <div>
                  <div className="rsv-section-head" style={{ marginBottom: 22 }}>
                    <div className="rsv-eyebrow">{offers.length > 0 ? 'Ou choisissez dans la carte' : 'La carte des soins'}</div>
                    <h2 className="rsv-h2">Composez votre séance</h2>
                    <div className="rsv-lead">
                      Ajoutez un premier soin, puis, si vous le souhaitez, un complément ou un autre soin : ils
                      s&apos;enchaînent dans la même séance.
                    </div>
                  </div>

                  {catalogReady ? (
                    <>
                      {families.length > 1 && (
                        <FamilyNav families={families} active={activeFamily} onSelect={(id) => goToFamily(id)} />
                      )}
                      {families.map((entry) => (
                        <FamilySection
                          key={entry.family.id}
                          entry={entry}
                          sectionRef={(el) => {
                            familyEls.current[entry.family.id] = el;
                          }}
                        >
                          {servicesCatalog
                            .filter((item) => familyOf(item) === entry.family.id)
                            .map((item) => (
                              <SoinRow
                                key={item.id}
                                item={item}
                                pick={picks.find((p) => p.key === item.id)}
                                full={full}
                                onToggle={(v) => handleToggle(item.id, v)}
                                onVariant={(v) => setVariant(item.id, v)}
                              >
                                {main?.key === item.id && (
                                  <QuickComplements
                                    options={complements.slice(0, 3)}
                                    picks={picks}
                                    full={full}
                                    onToggle={(key) => handleToggle(key)}
                                  />
                                )}
                              </SoinRow>
                            ))}
                        </FamilySection>
                      ))}
                    </>
                  ) : (
                    <div role="status">
                      <span className="sr-only">Chargement de la carte des soins…</span>
                      <SoinSkeleton />
                    </div>
                  )}
                </div>

                {limitReached && (
                  <div role="alert" className="rsv-notice">
                    <AlertCircle aria-hidden="true" />
                    <span>
                      Une séance réservée en ligne compte {MAX_EXTRAS + 1} soins au plus. Pour une séance plus longue,
                      contactez l&apos;institut{businessPhone ? <> au {phoneLink}</> : null}.
                    </span>
                  </div>
                )}

                {main && (
                  <PlusSection
                    id="rsv-plus"
                    mainName={main.name}
                    complements={complements}
                    pairings={pairings}
                    picks={picks}
                    full={full}
                    onToggle={(key) => handleToggle(key)}
                  />
                )}
              </div>
            )}

            {/* ═══ ÉTAPE 2 : JOUR + HEURE ═══ */}
            {currentStep === 2 && (
              <div className="rsv-main animate-fadein" style={{ gap: 40 }}>
                <div className="rsv-section-head" style={{ marginBottom: 0 }}>
                  <div className="rsv-eyebrow">Date et heure</div>
                  <h2 className="rsv-h2">Quand souhaitez-vous venir ?</h2>
                  <div className="rsv-lead">
                    Votre séance dure {formatDuree(currentDurationMinutes)}. Seuls les horaires où elle tient
                    entièrement vous sont proposés ; il vous est réservé dès l&apos;envoi de votre demande, puis {owner}{' '}
                    vous confirme le rendez-vous.
                  </div>
                </div>

                {selectedOffer && (
                  <div className="rsv-notice rsv-notice--info">
                    <AlertCircle aria-hidden="true" />
                    <span>
                      <strong>{selectedOffer.titre}</strong> est valable{' '}
                      {formatOfferPeriod(selectedOffer.date_debut, selectedOffer.date_fin)} : seuls les jours de cette
                      période sont proposés.
                    </span>
                  </div>
                )}

                {slotsNotice && (
                  <div role="alert" className="rsv-notice">
                    <AlertCircle aria-hidden="true" />
                    <span>{slotsNotice}</span>
                  </div>
                )}

                {calendarLoading && !calendar ? (
                  <div role="status" className="rsv-loading">
                    <RefreshCw className="animate-spin" aria-hidden="true" />
                    Chargement de l&apos;agenda de l&apos;institut…
                  </div>
                ) : calendarError ? (
                  <div role="alert" className="rsv-notice">
                    <AlertCircle aria-hidden="true" />
                    <div>
                      {calendarError} Nous ne pouvons pas enregistrer de demande sans consulter l&apos;agenda.
                      {phoneLink && <> Vous pouvez aussi appeler l&apos;institut au {phoneLink}.</>}
                      <div>
                        <button type="button" className="rsv-retry" onClick={() => setCalendarKey((k) => k + 1)}>
                          <RefreshCw aria-hidden="true" />
                          Réessayer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : calendar && !selectedDate ? (
                  <div className="rsv-empty">
                    <div className="rsv-empty__title">Aucun jour disponible pour le moment</div>
                    <div className="rsv-empty__text">
                      L&apos;agenda est complet sur les prochaines semaines pour une séance de{' '}
                      {formatDuree(currentDurationMinutes)}.
                      {phoneLink && <> Contactez l&apos;institut au {phoneLink}.</>}
                    </div>
                  </div>
                ) : calendar ? (
                  <div className="rsv-when-grid">
                    <section aria-label="Jour du rendez-vous" className={calendarLoading ? 'opacity-60 pointer-events-none' : ''} aria-busy={calendarLoading}>
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
                    </section>

                    <section aria-labelledby="rsv-heure-titre">
                      <h3 id="rsv-heure-titre" className="rsv-times__day">
                        {formattedDate}
                      </h3>
                      <div className="rsv-times__sub">Choisissez votre heure d&apos;arrivée.</div>
                      {loadingSlots ? (
                        <div role="status" className="rsv-loading" style={{ padding: '32px 0' }}>
                          <RefreshCw className="animate-spin" aria-hidden="true" />
                          Vérification des disponibilités…
                        </div>
                      ) : slotsError ? (
                        <div role="alert" className="rsv-notice">
                          <AlertCircle aria-hidden="true" />
                          <div>
                            {slotsError}
                            <div>
                              <button type="button" className="rsv-retry" onClick={() => setSlotsKey((k) => k + 1)}>
                                <RefreshCw aria-hidden="true" />
                                Réessayer
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : dayInfo && (dayInfo.ouvert === false || freeSlots.length === 0) ? (
                        <div className="rsv-empty" style={{ textAlign: 'left', padding: '8px 0' }}>
                          <div className="rsv-empty__title">
                            {dayInfo.ouvert === false ? 'L’institut est fermé ce jour-là' : 'Plus d’horaire libre ce jour-là'}
                          </div>
                          <div className="rsv-empty__text">Choisissez un autre jour dans le calendrier.</div>
                        </div>
                      ) : dayInfo ? (
                        <fieldset className="min-w-0" style={{ border: 0, padding: 0, margin: 0 }}>
                          <legend className="sr-only">Choisissez votre heure d&apos;arrivée</legend>
                          {PERIODES.map((p) => {
                            const slots = freeSlots.filter((sl) => sl.periode === p);
                            return (
                              <div key={p} className="rsv-times__group">
                                <div className="rsv-times__label">{PERIODE_LABEL[p]}</div>
                                {slots.length === 0 ? (
                                  <div className="rsv-times__full">Complet</div>
                                ) : (
                                  <div className="rsv-times__grid">
                                    {slots.map((sl) => (
                                      <label key={sl.heure} className="rsv-time">
                                        <input
                                          type="radio"
                                          name="heure"
                                          value={sl.heure}
                                          checked={selectedTime === sl.heure}
                                          onChange={() => {
                                            setSlotsNotice(null);
                                            setSelectedTime(sl.heure);
                                          }}
                                          aria-label={`${formatHeure(sl.heure)}, fin vers ${formatHeure(addMinutes(sl.heure, currentDurationMinutes))}`}
                                        />
                                        {formatHeure(sl.heure)}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {selectedTime && (
                            <div className="rsv-times__chosen" aria-live="polite">
                              Votre séance : <strong>{selectedTimeLabel}</strong>
                            </div>
                          )}
                          <div className="rsv-times__sub" style={{ marginTop: 18, marginBottom: 0 }}>
                            {BATTEMENT_MINUTES} minutes séparent toujours deux clientes : la cabine est aérée et
                            préparée pour vous seule.
                          </div>
                        </fieldset>
                      ) : null}
                    </section>
                  </div>
                ) : null}

                <div className="rsv-actions rsv-actions--desktop">
                  <button type="button" className="rsv-back" onClick={() => goTo(1)}>
                    <ArrowLeft aria-hidden="true" />
                    Modifier mes soins
                  </button>
                </div>
              </div>
            )}

            {/* ═══ ÉTAPE 3 : COORDONNÉES ═══ */}
            {currentStep === 3 && (
              <form id="rsv-form" className="rsv-main animate-fadein" style={{ gap: 36 }} onSubmit={handleSubmitBooking} noValidate>
                <div className="rsv-section-head" style={{ marginBottom: 0 }}>
                  <div className="rsv-eyebrow">Vos coordonnées</div>
                  <h2 className="rsv-h2">Dernière étape</h2>
                  <div className="rsv-lead">
                    {owner} vous contacte à ce numéro pour confirmer votre rendez-vous. Vos coordonnées ne servent à
                    rien d&apos;autre sans votre accord.
                  </div>
                </div>

                {/* Récapitulatif visible sur mobile (le panneau latéral n'y est pas affiché) */}
                <div className="rsv-recap-mobile">
                  <div className="rsv-recap-mobile__k">Votre demande</div>
                  <div className="rsv-serif" style={{ fontSize: 17, color: 'var(--rsv-ink)' }}>
                    {main?.name}
                    {seance.extras.length > 0 && <span className="rsv-muted"> + {seance.extras.length} soin{seance.extras.length > 1 ? 's' : ''}</span>}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>, {selectedTimeLabel}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    {chf(seance.priceChf)} · {formatDuree(currentDurationMinutes)} · à régler sur place
                  </div>
                </div>

                {submitError && (
                  <div role="alert" className="rsv-notice rsv-notice--error">
                    <AlertCircle aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="rsv-form-grid">
                  {field('prenom', 'Prénom', { type: 'text', autoComplete: 'given-name', maxLength: 80, placeholder: 'Sophie' }, { required: true })}
                  {field('nom', 'Nom', { type: 'text', autoComplete: 'family-name', maxLength: 80, placeholder: 'Dufour' }, { required: true })}
                  {field(
                    'telephone',
                    'Téléphone',
                    { type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 30, placeholder: '079 123 45 67' },
                    { required: true, hint: `Mobile de préférence : ${owner} vous confirme le rendez-vous à ce numéro.` }
                  )}
                  {field(
                    'email',
                    'E-mail',
                    { type: 'email', inputMode: 'email', autoComplete: 'email', maxLength: 120, placeholder: 'sophie.dufour@exemple.ch' },
                    { hint: 'Pour recevoir le récapitulatif de votre demande.' }
                  )}
                  <div className="rsv-field">
                    <label htmlFor="rf-cp">
                      Code postal<span className="rsv-opt"> (facultatif)</span>
                    </label>
                    <input
                      id="rf-cp"
                      className="rsv-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      placeholder="1607"
                      value={formData.codePostal}
                      onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                    />
                  </div>
                  <div className="rsv-field">
                    <label htmlFor="rf-ville">
                      Localité<span className="rsv-opt"> (facultatif)</span>
                    </label>
                    <input
                      id="rf-ville"
                      className="rsv-input"
                      type="text"
                      autoComplete="address-level2"
                      maxLength={80}
                      placeholder="Palézieux"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    />
                  </div>
                  <div className="rsv-field rsv-field--wide">
                    <label htmlFor="rf-notes">
                      Un mot pour {owner}<span className="rsv-opt"> (facultatif)</span>
                    </label>
                    <textarea
                      id="rf-notes"
                      className="rsv-input"
                      rows={3}
                      maxLength={1000}
                      placeholder="Une préférence, une question…"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
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
                <fieldset className="rsv-consents min-w-0" style={{ border: 0, padding: '28px 0 0', margin: 0, borderTop: '1px solid var(--rsv-line)' }}>
                  <legend className="rsv-eyebrow rsv-eyebrow--plain" style={{ float: 'left', width: '100%', marginBottom: 6 }}>
                    Restons en contact (facultatif)
                  </legend>
                  {emailFilled && (
                    <label className="rsv-check">
                      <input type="checkbox" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
                      <span>
                        Je souhaite recevoir les offres de {owner} par <strong>e-mail</strong>. Désinscription possible à
                        tout moment, gratuitement.
                      </span>
                    </label>
                  )}
                  <label className="rsv-check">
                    <input type="checkbox" checked={consentWhatsapp} onChange={(e) => setConsentWhatsapp(e.target.checked)} />
                    <span>
                      Je souhaite recevoir les offres de {owner} par <strong>WhatsApp</strong>. Désinscription possible à
                      tout moment, gratuitement.
                    </span>
                  </label>
                  <div className="rsv-legal">
                    Ces cases ne sont pas nécessaires pour réserver. Vos coordonnées servent à traiter votre demande et
                    à vous rappeler ; elles ne sont utilisées pour des offres que si vous cochez l&apos;une de ces cases.{' '}
                    <Link href="/mentions-legales" target="_blank">
                      Mentions légales et protection des données
                      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                    </Link>
                    .
                  </div>
                </fieldset>

                <div className="rsv-actions">
                  <button type="button" className="rsv-back" onClick={() => goTo(2)} disabled={submitting}>
                    <ArrowLeft aria-hidden="true" />
                    Changer l&apos;horaire
                  </button>
                  <button type="submit" data-btn="primary" disabled={submitting} aria-busy={submitting}>
                    {submitting ? 'Envoi en cours…' : 'Envoyer ma demande'}
                    {submitting ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                  </button>
                </div>
              </form>
            )}

            <aside className="rsv-aside" aria-label="Votre séance">
              <SeanceSummary {...summaryProps} cta={renderCta(false)} />
              {businessPhone && (
                <div className="rsv-summary__hint" style={{ marginTop: 16 }}>
                  Une question ? <Phone className="inline w-3.5 h-3.5 -mt-0.5" aria-hidden="true" /> {phoneLink}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {currentStep < 4 && (
        <>
          {drawerOpen && (
            <>
              <button type="button" className="rsv-scrim" aria-label="Fermer le récapitulatif" onClick={() => setDrawerOpen(false)} />
              <div id="rsv-drawer" className="rsv-drawer">
                <SeanceSummary {...summaryProps} cta={null} />
              </div>
            </>
          )}
          <MobileBar
            seance={seance}
            open={drawerOpen}
            onToggle={() => setDrawerOpen((o) => !o)}
            cta={renderCta(true)}
          />
        </>
      )}

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
