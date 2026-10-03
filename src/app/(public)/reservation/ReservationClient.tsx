"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Phone,
  MessageCircle,
  AlertCircle,
  CalendarCheck,
  Check,
  RefreshCw,
  Droplets,
  Flower2,
  Scissors,
  Star,
  Sun,
  Sunset,
} from 'lucide-react';

export function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface PrestationItem {
  id: string;
  category: 'visage' | 'corps' | 'epilation' | 'services';
  name: string;
  durationMinutes: number;
  durationLabel: string;
  priceChf: number;
  description: string;
  variants?: { durationMinutes: number; durationLabel: string; priceChf: number }[];
  tag?: string;
}

export interface PrivilegeOption {
  id: string;
  nom: string;
  duree_minutes: number;
  prix_chf: number;
  description: string;
}

export interface MonthlyOfferData {
  id: string;
  titre: string;
  description: string | null;
  prix_chf: number;
  image_url: string | null;
  active: boolean;
}

export interface TimeSlot {
  heure: string;
  fin: string;
  disponible: boolean;
  motif?: string;
}

// ── Catalogue des Prestations Filtrées (Conforme Carte Soins & Règles Métier) ─

export const PRESTATIONS_CATALOG: PrestationItem[] = [
  // 1. Soins du visage Phytomer (tous >= 90 CHF)
  {
    id: 'peau-nette-eclat-express',
    category: 'visage',
    name: 'Soin Peau Nette & Coup d’Éclat Express',
    durationMinutes: 40,
    durationLabel: '40 min',
    priceChf: 90,
    description:
      'Nettoyage profond désincrustant sous serviettes chaudes, gommage marin enzymatique, masque chauffant détoxifiant et hydratation personnalisée.',
    tag: 'Éclat express',
  },
  {
    id: 'hydra-originel',
    category: 'visage',
    name: 'Soin Hydra Originel — Désaltérant & Repulpant',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 140,
    description:
      'Véritable bain d’hydratation aux algues tissées bio. Comprend un gommage velours, un modelage délassant du visage et du décolleté, et un masque crémeux à l’algue Nori.',
    tag: 'Soin signature',
  },
  {
    id: 'expert-jeunesse',
    category: 'visage',
    name: 'Soin Expert Jeunesse — Correction Rides & Fermeté',
    durationMinutes: 75,
    durationLabel: '75 min',
    priceChf: 165,
    description:
      'Protocole anti-âge intensif. Modelage remodelant inspiré des techniques de digito-pression, suivi d’un masque plastifiant tenseur aux actifs marins purs.',
    tag: 'Haute technicité',
  },

  // 2. Soins & Rituels du corps (tous >= 90 CHF)
  {
    id: 'voile-de-satin',
    category: 'corps',
    name: 'Soin Voile de Satin — Gommage Peau Neuve',
    durationMinutes: 45,
    durationLabel: '45 min',
    priceChf: 110,
    description:
      'Exfoliation complète aux cristaux de sels marins reminéralisants, suivie d’une application onctueuse et massée de lait satinant. Peau douce et veloutée.',
  },
  {
    id: 'bulles-des-mers',
    category: 'corps',
    name: 'Soin Bulles des Mers — Détox & Pureté du Dos',
    durationMinutes: 45,
    durationLabel: '45 min',
    priceChf: 110,
    description:
      'Gommage purifiant du dos, pose sous occlusion thermique de boue marine auto-chauffante décontracturante, puis modelage délassant des trapèzes et du dos.',
  },
  {
    id: 'grand-massage-relaxant',
    category: 'corps',
    name: 'Grand Massage Relaxant Marine — Signature Spa',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 145,
    variants: [
      { durationMinutes: 60, durationLabel: '60 min', priceChf: 145 },
      { durationMinutes: 90, durationLabel: '90 min', priceChf: 210 },
    ],
    description:
      'Massage complet du corps sur-mesure combinant effleurages profonds, drainages doux et pressions dénouantes à l’huile marine satinante parfum printanier.',
    tag: 'Grand lâcher-prise',
  },
  {
    id: 'echappee-belle',
    category: 'corps',
    name: 'Rituel Échappée Belle — Visage & Corps',
    durationMinutes: 105,
    durationLabel: '1h45',
    priceChf: 230,
    description:
      'La synergie parfaite : le gommage complet du corps Voile de Satin ou massage ciblé du dos, immédiatement suivi du Soin Hydra Originel complet.',
    tag: 'Rituel d’exception',
  },

  // 3. Épilations (Uniquement les forfaits signature, pas à la carte)
  {
    id: 'forfait-douceur',
    category: 'epilation',
    name: 'Forfait Douceur (Demi-jambes + Aisselles + Maillot)',
    durationMinutes: 45,
    durationLabel: '45 min',
    priceChf: 95,
    description:
      'Demi-jambes + aisselles + maillot au choix. Formule essentielle rapide et nette avec cires douces haute tolérance, suivie d’une émulsion apaisante.',
    tag: 'Forfait signature',
  },
  {
    id: 'forfait-integral',
    category: 'epilation',
    name: 'Forfait Intégral (Jambes complètes + Aisselles + Maillot)',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 125,
    description:
      'Jambes complètes + aisselles + maillot au choix. Le rituel complet corps sans compromis avec soin apaisant post-épilation.',
    tag: 'Rituel complet',
  },

  // 4. Services (Beauté mains/pieds et réhaussement de cils)
  {
    id: 'prestige-mains',
    category: 'services',
    name: 'Soin Prestige des Mains « Spa »',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 85,
    description:
      'Limage sur-mesure, travail précis des cuticules, gommage aux sels fins marins, masque régénérant tiède et modelage décontractant de l’avant-bras et de la main.',
  },
  {
    id: 'prestige-pieds',
    category: 'services',
    name: 'Soin Prestige des Pieds « Spa »',
    durationMinutes: 70,
    durationLabel: '70 min',
    priceChf: 105,
    description:
      'Élimination des callosités, mise en forme de l’ongle, soin des cuticules, gommage exfoliant en profondeur, masque adoucissant sous serviettes chaudes et modelage défatigant.',
    tag: 'Détente absolue',
  },
  {
    id: 'rehaussement-cils',
    category: 'services',
    name: 'Réhaussement de cils',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 100,
    description:
      'Courbure naturelle et durable de vos cils pour ouvrir le regard sans recourbe-cils ni mascara. Résultat impeccable durant 6 à 8 semaines.',
  },
];

// Options Privilèges Cabine (Upselling doux)
export const PRIVILEGE_OPTIONS: PrivilegeOption[] = [
  {
    id: 'option-boue-marine-dos',
    nom: 'Option Boue Marine Auto-Chauffante Dos',
    prix_chf: 30,
    duree_minutes: 15,
    description:
      'Application d’une boue marine effervescente et reminéralisante le long de la colonne pendant votre soin. Dénoue le haut du corps.',
  },
  {
    id: 'option-cuir-chevelu-nuque',
    nom: 'Option Massage Relaxant Cuir Chevelu & Nuque',
    prix_chf: 25,
    duree_minutes: 15,
    description: 'Manœuvres lentes et enveloppantes pour libérer les micro-tensions crâniennes.',
  },
  {
    id: 'teinture-cils',
    nom: 'Teinture des cils',
    prix_chf: 30,
    duree_minutes: 15,
    description: 'Intensifie la noirceur naturelle des cils pour un regard profond dès le réveil.',
  },
  {
    id: 'teinture-sourcils',
    nom: 'Teinture des sourcils',
    prix_chf: 22,
    duree_minutes: 15,
    description: 'Redéfinit subtilement la ligne du sourcil en harmonie avec votre carnation.',
  },
  {
    id: 'duo-regard',
    nom: 'Duo Regard (Teinture cils & sourcils)',
    prix_chf: 45,
    duree_minutes: 20,
    description: 'La combinaison idéale pour un regard magnifié en douceur.',
  },
];

const CATEGORIES = [
  { id: 'visage', label: 'Soins du visage', icon: Droplets, desc: 'Protocoles marins Phytomer' },
  { id: 'corps', label: 'Rituels corps', icon: Flower2, desc: 'Massages & gommages' },
  { id: 'epilation', label: 'Forfaits épilation', icon: Scissors, desc: 'Forfaits signature complets' },
  { id: 'services', label: 'Mains, pieds & cils', icon: Sparkles, desc: 'Rituels spa & regard' },
];

interface ReservationClientProps {
  businessPhone?: string;
  businessOwner?: string;
}

export default function ReservationClient({ businessPhone, businessOwner }: ReservationClientProps) {
  const searchParams = useSearchParams();

  // Étape courante (1: Prestation, 2: Privilèges/Upsell, 3: Créneau, 4: Coordonnées, 5: Confirmation)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Catalogues dynamiques synchronisés avec la base de données
  const [servicesCatalog, setServicesCatalog] = useState<PrestationItem[]>(PRESTATIONS_CATALOG);
  const [privilegesCatalog, setPrivilegesCatalog] = useState<PrivilegeOption[]>(PRIVILEGE_OPTIONS);

  // Étape 1 : Prestation
  const [selectedCategory, setSelectedCategory] = useState<'visage' | 'corps' | 'epilation' | 'services'>('visage');
  const [selectedService, setSelectedService] = useState<PrestationItem | null>(PRESTATIONS_CATALOG[0]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  // Étape 2 : Offre du moment exclusive (Upselling doux unique)
  const [includeMonthlyOffer, setIncludeMonthlyOffer] = useState<boolean>(false);
  const [monthlyOffer, setMonthlyOffer] = useState<MonthlyOfferData | null>(null);

  // Étape 3 : Date & Moment (Matin dès 9h ou Après-midi dès 14h)
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // '09:00' = Matin, '14:00' = Après-midi
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Étape 4 : Coordonnées
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    codePostal: '',
    ville: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Étape 5 : Confirmation
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // ── Chargement de l'Offre du moment active ──
  useEffect(() => {
    fetch('/api/bookings/monthly-offer')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.offer?.active) {
          setMonthlyOffer(data.offer);
        }
      })
      .catch(() => {});
  }, []);

  // ── Chargement des soins dynamiques & gestion des paramètres d'URL ──
  useEffect(() => {
    fetch('/api/bookings/services')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.services) && data.services.length > 0) {
          setServicesCatalog(data.services);

          const paramSoin = searchParams?.get('soin') || searchParams?.get('service');
          const paramCat = searchParams?.get('category');

          if (paramSoin) {
            const needle = paramSoin.toLowerCase();
            const match = data.services.find(
              (s: PrestationItem) =>
                s.id.toLowerCase() === needle ||
                s.name.toLowerCase().includes(needle)
            );
            if (match) {
              setSelectedCategory(match.category);
              setSelectedService(match);
              setSelectedVariantIndex(0);
              return;
            }
          }

          if (paramCat && ['visage', 'corps', 'epilation', 'services'].includes(paramCat)) {
            setSelectedCategory(paramCat as any);
            const firstInCat = data.services.find((s: PrestationItem) => s.category === paramCat);
            if (firstInCat) {
              setSelectedService(firstInCat);
              setSelectedVariantIndex(0);
              return;
            }
          }

          // Mise à jour de selectedService avec les UUIDs réels de la BDD
          setSelectedService((prev) => {
            if (!prev) return data.services[0];
            const found = data.services.find(
              (s: PrestationItem) => s.id === prev.id || s.name.toLowerCase() === prev.name.toLowerCase()
            );
            return found || data.services[0];
          });
        }
      })
      .catch((err) => console.warn('[ReservationClient] Services dynamiques non chargés:', err));
  }, [searchParams]);

  // Initialisation de la date (prochain jour ouvré dès le lendemain, hors dimanche, ou paramètre URL)
  useEffect(() => {
    const paramDate = searchParams?.get('date');
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      setSelectedDate(paramDate);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Passer au lundi si dimanche
    setSelectedDate(toLocalDateStr(d));
  }, [searchParams]);

  // Gestion du changement de catégorie : sélectionne automatiquement le premier soin de la nouvelle catégorie
  const handleCategoryChange = (catId: 'visage' | 'corps' | 'epilation' | 'services') => {
    setSelectedCategory(catId);
    const firstInCat = servicesCatalog.find((p) => p.category === catId);
    if (firstInCat) {
      setSelectedService(firstInCat);
      setSelectedVariantIndex(0);
    }
  };

  // ── Calcul des totaux (durée et prix) ──
  const { currentDurationMinutes, baseDurationMinutes, currentPriceChf, currentServiceName } = useMemo(() => {
    if (!selectedService) {
      return { currentDurationMinutes: 60, baseDurationMinutes: 60, currentPriceChf: 0, currentServiceName: '' };
    }

    const baseDuration = selectedService.variants
      ? selectedService.variants[selectedVariantIndex]?.durationMinutes ?? selectedService.durationMinutes
      : selectedService.durationMinutes;

    let basePrice = selectedService.variants
      ? selectedService.variants[selectedVariantIndex]?.priceChf ?? selectedService.priceChf
      : selectedService.priceChf;

    let duration = baseDuration;
    let price = basePrice;

    // Ajout de l'Offre du moment
    if (includeMonthlyOffer && monthlyOffer) {
      price += Number(monthlyOffer.prix_chf);
      duration += 30;
    }

    return {
      currentDurationMinutes: duration,
      baseDurationMinutes: baseDuration,
      currentPriceChf: price,
      currentServiceName: selectedService.name,
    };
  }, [selectedService, selectedVariantIndex, includeMonthlyOffer, monthlyOffer]);

  // ── Chargement des créneaux disponibles & auto-sélection Matin / Après-midi ──
  useEffect(() => {
    if (!selectedDate || currentStep < 3) return;

    setLoadingSlots(true);
    setSlotsError(null);

    const url = `/api/bookings/available-slots?date=${selectedDate}&duration=${currentDurationMinutes}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Impossible de charger les disponibilités');
        return res.json();
      })
      .then((data) => {
        if (data.ouvert === false) {
          setAvailableSlots([]);
          setSelectedSlot(null);
          setSlotsError("L'institut est fermé à cette date. Veuillez choisir un autre jour.");
        } else {
          const slots: TimeSlot[] = data.slots || [];
          setAvailableSlots(slots);

          const hasMorning = slots.some((s) => parseInt(s.heure.split(':')[0], 10) < 13 && s.disponible);
          const hasAfternoon = slots.some((s) => parseInt(s.heure.split(':')[0], 10) >= 13 && s.disponible);

          if (!hasMorning && !hasAfternoon) {
            setSelectedSlot(null);
            setSlotsError("Aucune disponibilité pour cette date. Veuillez choisir un autre jour.");
          } else {
            // Sélection automatique de la période préférée
            setSelectedSlot((prev) => {
              if (prev === '09:00' && hasMorning) return '09:00';
              if (prev === '14:00' && hasAfternoon) return '14:00';
              if (hasMorning) return '09:00';
              return '14:00';
            });
          }
        }
      })
      .catch((err) => {
        console.error(err);
        setSelectedSlot(null);
        setSlotsError("Erreur lors de la vérification de l'agenda. Veuillez réessayer.");
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate, currentDurationMinutes, currentStep]);

  // Détection de la disponibilité Matin et Après-midi
  const isMorningAvailable = useMemo(() => {
    return availableSlots.some((s) => parseInt(s.heure.split(':')[0], 10) < 13 && s.disponible);
  }, [availableSlots]);

  const isAfternoonAvailable = useMemo(() => {
    return availableSlots.some((s) => parseInt(s.heure.split(':')[0], 10) >= 13 && s.disponible);
  }, [availableSlots]);


  // ── Créneaux filtrés par période (Matin dès 9h / Après-midi dès 14h) ──
  const { morningSlots, afternoonSlots } = useMemo(() => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];

    for (const s of availableSlots) {
      const [h] = s.heure.split(':').map((x) => parseInt(x, 10));
      if (h < 13) {
        morning.push(s);
      } else {
        afternoon.push(s);
      }
    }

    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [availableSlots]);

  // 14 prochains jours ouvrés (du lundi au samedi) calculés en heure locale
  const dateOptions = useMemo(() => {
    const dates: { dateStr: string; dayName: string; dayNumber: number; monthName: string; isSunday: boolean }[] = [];
    const now = new Date();

    for (let i = 1; i <= 28 && dates.length < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const isSunday = d.getDay() === 0;

      if (!isSunday) {
        const dateStr = toLocalDateStr(d);
        const dayName = d.toLocaleDateString('fr-CH', { weekday: 'short' });
        const dayNumber = d.getDate();
        const monthName = d.toLocaleDateString('fr-CH', { month: 'short' });
        dates.push({ dateStr, dayName, dayNumber, monthName, isSunday });
      }
    }
    return dates;
  }, []);


  // ── Validation de l'étape coordonnées ──
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.nom.trim()) errors.nom = 'Votre nom est requis.';
    if (!formData.prenom.trim()) errors.prenom = 'Votre prénom est requis.';
    if (!formData.telephone.trim()) {
      errors.telephone = 'Le numéro de téléphone est indispensable pour vous confirmer le rendez-vous.';
    } else if (formData.telephone.replace(/[^\d+]/g, '').length < 8) {
      errors.telephone = 'Veuillez renseigner un numéro de téléphone valide.';
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Adresse e-mail invalide.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Soumission finale de la réservation ──
  const handleSubmitBooking = async () => {
    if (!validateForm()) return;
    if (!selectedService || !selectedSlot) {
      alert('Veuillez sélectionner un soin et un créneau horaire.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Préparation de l'Offre du Moment exclusive (si cochée)
    const optionsToSend: { id: string; nom: string; prix_chf: number; duree_minutes: number }[] = [];
    if (includeMonthlyOffer && monthlyOffer) {
      optionsToSend.push({
        id: monthlyOffer.id,
        nom: `Offre du Moment : ${monthlyOffer.titre}`,
        prix_chf: Number(monthlyOffer.prix_chf),
        duree_minutes: 30,
      });
    }

    const periodLabel = selectedSlot === '09:00' ? 'La séance du matin (dès 09h00)' : "La séance de l'après-midi (dès 14h00)";
    const periodNote = `Période souhaitée : ${periodLabel} — Horaire définitif fixé avec Emmanuelle`;
    const finalNotes = formData.notes?.trim()
      ? `${periodNote}\nNotes : ${formData.notes.trim()}`
      : periodNote;

    try {
      const payload = {
        nom: formData.nom,
        prenom: formData.prenom,
        telephone: formData.telephone,
        email: formData.email || null,
        code_postal: formData.codePostal || null,
        ville: formData.ville || null,
        service_id: selectedService.id,
        service_nom: currentServiceName,
        service_prix_chf: currentPriceChf,
        // On transmet la durée de base, le serveur calcule base + options
        service_duree_minutes: baseDurationMinutes,
        options: optionsToSend,
        offer_of_month_id: includeMonthlyOffer && monthlyOffer ? monthlyOffer.id : null,
        date_rdv: selectedDate,
        heure_rdv: selectedSlot,
        notes_cliente: finalNotes,
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la réservation.');
      }

      setConfirmedBooking(data.booking);
      setCurrentStep(5);
      window.scrollTo({ top: 80, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Erreur réservation:', err);
      setSubmitError(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    const d = new Date(`${selectedDate}T12:00:00`);
    return d.toLocaleDateString('fr-CH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  // Fichier ICS calendrier
  const downloadIcs = () => {
    if (!confirmedBooking) return;
    const startStr = `${confirmedBooking.date_rdv.replace(/-/g, '')}T${confirmedBooking.heure_rdv.replace(':', '')}00`;
    const [h, m] = confirmedBooking.heure_rdv.split(':').map((x: string) => parseInt(x, 10));
    const endMinutes = h * 60 + m + (confirmedBooking.service_duree_minutes || 60);
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endStr = `${confirmedBooking.date_rdv.replace(/-/g, '')}T${endH.toString().padStart(2, '0')}${endM.toString().padStart(2, '0')}00`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Emmanuelle Esthetique//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `SUMMARY:Rendez-vous Emmanuelle Esthétique — ${confirmedBooking.service_nom}`,
      `DESCRIPTION:Soin en cabine privée : ${confirmedBooking.service_nom}. En attente de validation définitive par Emmanuelle.`,
      `LOCATION:Emmanuelle Esthétique, Palézieux-Gare (Vaud, Suisse)`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      'STATUS:TENTATIVE',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `rendez-vous-emmanuelle-${confirmedBooking.date_rdv}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-paper text-stone-deep py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tête éditorial */}
        <div className="text-center mb-8 sm:mb-12 space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-sage/10 text-sage border border-sage/20">
            <Sparkles className="w-3.5 h-3.5 text-sage" />
            Cabine Privée · Soins d'Exception
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-stone-deep font-normal tracking-tight">
            Réserver votre soin en ligne
          </h1>
          <p className="text-muted max-w-xl mx-auto text-sm sm:text-base font-light leading-relaxed">
            Offrez-vous une parenthèse marine exclusive. Choisissez votre rituel, personnalisez vos privilèges et sélectionnez votre créneau en toute quiétude.
          </p>
        </div>

        {/* Stepper horizontal */}
        {currentStep < 5 && (
          <div className="mb-10">
            <div data-surface className="bg-surface border border-border rounded-[var(--radius-base,1rem)] p-3 sm:p-4 shadow-xs">
              <nav aria-label="Étapes de réservation" className="flex items-center justify-between">
                {(monthlyOffer && monthlyOffer.active
                  ? [
                      { num: 1, label: 'Prestation' },
                      { num: 2, label: 'Offre du moment' },
                      { num: 3, label: 'Séance' },
                      { num: 4, label: 'Coordonnées' },
                    ]
                  : [
                      { num: 1, label: 'Prestation' },
                      { num: 3, label: 'Séance' },
                      { num: 4, label: 'Coordonnées' },
                    ]
                ).map((step, idx, arr) => {
                  const isActive = currentStep === step.num;
                  const isCompleted = currentStep > step.num;
                  return (
                    <React.Fragment key={step.num}>
                      <button
                        type="button"
                        onClick={() => {
                          if (step.num < currentStep) setCurrentStep(step.num as any);
                        }}
                        disabled={step.num > currentStep}
                        className={`flex items-center gap-2 sm:gap-2.5 transition-all text-left ${
                          step.num < currentStep ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-sage text-white shadow-sm ring-4 ring-sage/20'
                              : isCompleted
                              ? 'bg-sage/80 text-white'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                        </span>
                        <span className="hidden sm:inline">
                          <span
                            className={`block text-xs font-semibold uppercase tracking-wider ${
                              isActive ? 'text-sage' : isCompleted ? 'text-stone-700' : 'text-stone-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </span>
                      </button>
                      {idx < arr.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 sm:mx-4 rounded-full transition-colors ${
                            currentStep > step.num ? 'bg-sage' : 'bg-border'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>
          </div>

        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 1 : CHOIX DE LA PRESTATION
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-fadein">
            {/* Onglets de catégories */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {CATEGORIES.map((cat) => {
                const isCatActive = selectedCategory === cat.id;
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id as any)}
                    className={`p-3.5 sm:p-4 rounded-[var(--radius-base,0.75rem)] text-left border transition-all ${
                      isCatActive
                        ? 'bg-sage text-white border-sage shadow-sm'
                        : 'bg-surface text-stone-deep border-border hover:border-sage/40 hover:bg-stone-50'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 mb-2 ${isCatActive ? 'text-white' : 'text-sage'}`} />
                    <div className="text-xs sm:text-sm font-semibold leading-tight">{cat.label}</div>
                    <div className={`text-[11px] mt-0.5 truncate ${isCatActive ? 'text-white/80' : 'text-muted'}`}>
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Liste des soins de la catégorie sélectionnée */}
            <div className="space-y-4">
              {servicesCatalog.filter((p) => p.category === selectedCategory).map((item) => {
                const isSelected = selectedService?.id === item.id;
                return (
                  <div
                    key={item.id}
                    data-surface
                    onClick={() => {
                      setSelectedService(item);
                      setSelectedVariantIndex(0);
                    }}
                    className={`group relative p-5 sm:p-6 rounded-[var(--radius-base,1rem)] border transition-all cursor-pointer bg-surface ${
                      isSelected
                        ? 'border-sage ring-2 ring-sage/20 shadow-md bg-sage/5'
                        : 'border-border hover:border-sage/40 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif font-medium text-stone-deep group-hover:text-sage transition-colors">
                            {item.name}
                          </h3>
                          {item.tag && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sage/10 text-sage border border-sage/20">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-muted text-xs sm:text-sm leading-relaxed max-w-2xl font-light">
                          {item.description}
                        </p>

                        {/* Variantes (ex: Grand massage relaxant 60 min ou 90 min) */}
                        {item.variants && item.variants.length > 0 && isSelected && (
                          <div className="pt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted font-medium">Choisissez la durée :</span>
                            {item.variants.map((v, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedVariantIndex(idx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  selectedVariantIndex === idx
                                    ? 'bg-sage text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                }`}
                              >
                                {v.durationLabel} — CHF {v.priceChf}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                        <div className="text-right">
                          <div className="text-xl font-serif font-semibold text-sage">
                            CHF{' '}
                            {item.variants && isSelected
                              ? item.variants[selectedVariantIndex]?.priceChf
                              : item.priceChf}
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-muted">
                            <Clock className="w-3.5 h-3.5 text-muted" />
                            {item.variants && isSelected
                              ? item.variants[selectedVariantIndex]?.durationLabel
                              : item.durationLabel}
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-sage border-sage text-white' : 'border-border text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barre récapitulative et bouton de progression Étape 1 */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-4 sm:p-5 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-muted block font-medium">Soin sélectionné :</span>
                <span className="text-base sm:text-lg font-serif font-semibold text-stone-deep">
                  {currentServiceName || 'Veuillez choisir un soin'}
                </span>
                <div className="text-xs text-sage font-medium mt-0.5">
                  CHF {currentPriceChf} · Durée : {baseDurationMinutes} min
                </div>
              </div>

              <button
                type="button"
                data-btn="primary"
                onClick={() => {
                  if (monthlyOffer && monthlyOffer.active) {
                    setCurrentStep(2);
                  } else {
                    setCurrentStep(3);
                  }
                }}
                disabled={!selectedService}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 font-medium tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {monthlyOffer && monthlyOffer.active ? "Continuer vers l'Offre du Moment" : "Choisir votre séance"}
                <ChevronRight className="w-4 h-4" />
              </button>

            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 2 : L'OFFRE DU MOMENT
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-fadein">
            {/* Récapitulatif du soin principal sélectionné */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted font-medium">Votre soin principal sélectionné :</div>
                  <div className="text-base font-serif font-semibold text-stone-deep">{currentServiceName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-serif font-semibold text-sage">CHF {selectedService?.priceChf}</div>
                <div className="text-xs text-muted">{baseDurationMinutes} min</div>
              </div>
            </div>

            {/* Mise en avant de l'Offre du Moment */}
            {monthlyOffer && monthlyOffer.active && (
              <div
                data-surface
                className="relative overflow-hidden rounded-[var(--radius-base,1rem)] border-2 border-sage/40 bg-surface p-6 sm:p-7 shadow-sm"
              >
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  {monthlyOffer.image_url && (
                    <div className="w-full md:w-52 h-44 rounded-xl overflow-hidden shrink-0 shadow-inner bg-stone-100">
                      <img
                        src={monthlyOffer.image_url}
                        alt={monthlyOffer.titre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-2.5 text-left">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage text-white text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      Offre Exclusive du Moment
                    </div>
                    <h3 className="text-xl sm:text-2xl font-serif font-semibold text-stone-deep">{monthlyOffer.titre}</h3>
                    {monthlyOffer.description && (
                      <p className="text-muted text-xs sm:text-sm font-light leading-relaxed">
                        {monthlyOffer.description}
                      </p>
                    )}
                    <div className="text-lg font-serif font-semibold text-sage">
                      Tarif Préférentiel : CHF {monthlyOffer.prix_chf}
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      data-btn={includeMonthlyOffer ? 'primary' : 'secondary'}
                      onClick={() => setIncludeMonthlyOffer(!includeMonthlyOffer)}
                      className="w-full md:w-auto px-6 py-3.5 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      {includeMonthlyOffer ? (
                        <>
                          <Check className="w-4 h-4" />
                          Offre du moment ajoutée
                        </>
                      ) : (
                        '+ Ajouter cette offre à mon soin'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Barre de total estimé & navigation */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-muted block">Total estimé de votre soin :</span>
                <span className="text-2xl font-serif font-bold text-sage">
                  CHF {currentPriceChf}
                </span>
                <span className="text-xs text-muted ml-2">({currentDurationMinutes} min prévues)</span>
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
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-medium tracking-wide shadow-md transition-all"
                >
                  Choisir votre séance
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 3 : SÉLECTION DU CRÉNEAU HORAIRE
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-fadein">
            {/* Guide & explication buffer cabine */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm text-stone-deep font-light">
                <p className="font-semibold text-stone-deep">
                  Sélection en temps réel · Lundi au Samedi de 9h00 à 18h00
                </p>
                <p className="text-muted">
                  Un battement sanitaire et sérénité de <strong>30 minutes</strong> est automatiquement réservé après chaque soin pour assurer une aération complète, la désinfection de la cabine et votre absolue discrétion.
                </p>
              </div>
            </div>

            {/* Sélecteur de date rapide */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-serif font-medium text-stone-deep">
                  1. Choisissez le jour de votre rendez-vous :
                </h3>
                <span className="text-xs text-muted font-light">Fermé le dimanche</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {dateOptions.map((item) => {
                  const isDateSelected = selectedDate === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`p-3 rounded-[var(--radius-base,0.75rem)] border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                        isDateSelected
                          ? 'bg-sage text-white border-sage shadow-sm ring-2 ring-sage/20'
                          : 'bg-surface text-stone-deep border-border hover:border-sage hover:bg-stone-50'
                      }`}
                    >
                      <span className={`text-[11px] uppercase tracking-wider font-semibold ${isDateSelected ? 'text-white/80' : 'text-muted'}`}>
                        {item.dayName}
                      </span>
                      <span className="text-lg font-bold font-serif leading-tight">{item.dayNumber}</span>
                      <span className={`text-[10px] ${isDateSelected ? 'text-white/70' : 'text-muted'}`}>
                        {item.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Champ calendrier natif pour date ultérieure */}
              <div className="flex items-center gap-2 pt-2 text-xs text-muted">
                <Calendar className="w-3.5 h-3.5 text-sage" />
                <span>Autre date :</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-stone-deep focus:outline-none focus:ring-1 focus:ring-sage"
                />
              </div>
            </div>

            {/* Sélection de la séance : Matin ou Après-midi */}
            <div className="space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="text-base sm:text-lg font-serif font-medium text-stone-deep">
                  2. Choisissez votre séance pour le <span className="capitalize">{formattedDate}</span> :
                </h3>
                <p className="text-xs text-muted font-light mt-0.5">
                  Emmanuelle réserve la cabine pour vous le matin ou l'après-midi. L'horaire exact sera fixé directement avec vous lors de sa confirmation téléphonique.
                </p>
              </div>

              {loadingSlots ? (
                <div className="py-16 text-center space-y-3 bg-surface rounded-[var(--radius-base,1rem)] border border-border">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sage" />
                  <p className="text-xs sm:text-sm text-muted font-light">
                    Interrogation de l'agenda d'Emmanuelle et vérification des disponibilités...
                  </p>
                </div>
              ) : slotsError ? (
                <div className="p-6 rounded-[var(--radius-base,1rem)] bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                  <p>{slotsError}</p>
                </div>
              ) : !isMorningAvailable && !isAfternoonAvailable ? (
                <div className="py-12 text-center bg-surface rounded-[var(--radius-base,1rem)] border border-border p-6 space-y-2">
                  <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                  <h4 className="text-sm font-semibold text-stone-deep">Aucune séance disponible pour cette journée</h4>
                  <p className="text-xs text-muted max-w-sm mx-auto font-light">
                    Emmanuelle est complète ou indisponible ce jour-là. Veuillez sélectionner une autre date parmi les propositions ci-dessus.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Carte 1 : La séance du matin */}
                  <button
                    type="button"
                    disabled={!isMorningAvailable}
                    onClick={() => setSelectedSlot('09:00')}
                    className={`p-6 rounded-[var(--radius-base,1rem)] border text-left transition-all relative flex flex-col justify-between gap-4 ${
                      !isMorningAvailable
                        ? 'bg-stone-50/70 border-border opacity-50 cursor-not-allowed'
                        : selectedSlot === '09:00'
                        ? 'bg-sage/10 border-sage ring-2 ring-sage shadow-md text-stone-deep'
                        : 'bg-surface border-border hover:border-sage hover:bg-stone-50/50 text-stone-deep shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            selectedSlot === '09:00' ? 'bg-sage text-white shadow-xs' : 'bg-sage/10 text-sage'
                          }`}
                        >
                          <Sun className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-base sm:text-lg font-serif font-bold text-stone-deep">
                            La séance du matin
                          </h4>
                          <span className="text-xs text-muted font-light">Dès 09h00</span>
                        </div>
                      </div>
                      <div>
                        {isMorningAvailable ? (
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              selectedSlot === '09:00'
                                ? 'bg-sage text-white'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            Disponible
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-stone-100 text-stone-400 border border-stone-200">
                            Complet
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted font-light leading-relaxed">
                      Idéal pour commencer votre journée dans la douceur et la sérénité en cabine privée.
                    </p>

                    <div className="text-[11px] text-sage font-medium pt-3 border-t border-border/60 flex items-center justify-between">
                      <span>Horaire définitif fixé avec Emmanuelle</span>
                      {selectedSlot === '09:00' && <CheckCircle2 className="w-4 h-4 text-sage" />}
                    </div>
                  </button>

                  {/* Carte 2 : La séance de l'après-midi */}
                  <button
                    type="button"
                    disabled={!isAfternoonAvailable}
                    onClick={() => setSelectedSlot('14:00')}
                    className={`p-6 rounded-[var(--radius-base,1rem)] border text-left transition-all relative flex flex-col justify-between gap-4 ${
                      !isAfternoonAvailable
                        ? 'bg-stone-50/70 border-border opacity-50 cursor-not-allowed'
                        : selectedSlot === '14:00'
                        ? 'bg-sage/10 border-sage ring-2 ring-sage shadow-md text-stone-deep'
                        : 'bg-surface border-border hover:border-sage hover:bg-stone-50/50 text-stone-deep shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            selectedSlot === '14:00' ? 'bg-sage text-white shadow-xs' : 'bg-sage/10 text-sage'
                          }`}
                        >
                          <Sunset className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-base sm:text-lg font-serif font-bold text-stone-deep">
                            La séance de l'après-midi
                          </h4>
                          <span className="text-xs text-muted font-light">Dès 14h00</span>
                        </div>
                      </div>
                      <div>
                        {isAfternoonAvailable ? (
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              selectedSlot === '14:00'
                                ? 'bg-sage text-white'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            Disponible
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-stone-100 text-stone-400 border border-stone-200">
                            Complet
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted font-light leading-relaxed">
                      Parfait pour vous offrir une parenthèse de déconnexion et de ressourcement dans l'après-midi.
                    </p>

                    <div className="text-[11px] text-sage font-medium pt-3 border-t border-border/60 flex items-center justify-between">
                      <span>Horaire définitif fixé avec Emmanuelle</span>
                      {selectedSlot === '14:00' && <CheckCircle2 className="w-4 h-4 text-sage" />}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Récapitulatif du créneau retenu & navigation étape 3 */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-4 sm:p-5 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage shrink-0">
                  <CalendarCheck className="w-5 h-5 text-sage" />
                </div>
                <div>
                  <span className="text-xs text-muted block font-medium">Votre séance choisie :</span>
                  {selectedSlot ? (
                    <div className="text-base sm:text-lg font-serif font-semibold text-stone-deep capitalize">
                      {formattedDate} —{' '}
                      <span className="text-sage">
                        {selectedSlot === '09:00' ? 'La séance du matin (dès 09h00)' : "La séance de l'après-midi (dès 14h00)"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400 italic">Veuillez choisir la séance du matin ou de l'après-midi</div>
                  )}
                  <span className="text-xs text-muted block font-light">
                    Horaire exact fixé avec Emmanuelle lors de la confirmation téléphonique
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  data-btn="secondary"
                  onClick={() => setCurrentStep(monthlyOffer?.active ? 2 : 1)}
                  className="px-5 py-3 text-sm font-medium transition-all"
                >
                  Retour
                </button>
                <button
                  type="button"
                  data-btn="primary"
                  onClick={() => setCurrentStep(4)}
                  disabled={!selectedSlot}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3.5 font-medium text-sm sm:text-base tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer vers vos Coordonnées
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 4 : COORDONNÉES & MENTION RASSURANTE 1-2-3
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 4 && (
          <div className="space-y-8 animate-fadein">
            {/* Récapitulatif sélection date & soin */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-5 border border-border shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted font-medium">Récapitulatif de votre séance :</span>
                <div className="text-base font-serif font-semibold text-stone-deep">
                  {currentServiceName}
                  {includeMonthlyOffer && monthlyOffer && ` + Offre du Moment (${monthlyOffer.titre})`}
                </div>
                <div className="text-xs text-muted flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-sage" />
                  <span className="capitalize">{formattedDate}</span> —{' '}
                  <span className="font-semibold text-stone-deep">
                    {selectedSlot === '09:00' ? 'La séance du matin (dès 09h00)' : "La séance de l'après-midi (dès 14h00)"}
                  </span>
                  <span className="text-muted font-light">({currentDurationMinutes} min)</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted block">Montant à régler sur place :</span>
                <span className="text-2xl font-serif font-bold text-sage">CHF {currentPriceChf}</span>
              </div>
            </div>

            {/* Mention rassurante 1-2-3 (Charte Confiance Cabine Privée) */}
            <div className="rounded-[var(--radius-base,1rem)] border border-sage/30 bg-surface p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage">
                <ShieldCheck className="w-4 h-4 text-sage" />
                Charte Sérénité & Confiance Emmanuelle Esthétique
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-paper rounded-xl p-4 border border-border space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-stone-deep uppercase tracking-wide">Aucun paiement en ligne</h4>
                  <p className="text-[12px] text-muted font-light leading-relaxed">
                    Votre réservation se fait sans carte bancaire sur le site. Vous réglez sur place le jour de votre venue (cartes, Twint ou espèces).
                  </p>
                </div>

                <div className="bg-paper rounded-xl p-4 border border-border space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-stone-deep uppercase tracking-wide">Confirmation personnelle</h4>
                  <p className="text-[12px] text-muted font-light leading-relaxed">
                    Emmanuelle vérifie son planning et vous rappelle personnellement pour confirmer l’horaire exact et vos éventuelles attentes spécifiques.
                  </p>
                </div>

                <div className="bg-paper rounded-xl p-4 border border-border space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-sage text-white flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-stone-deep uppercase tracking-wide">Cabine privée exclusive</h4>
                  <p className="text-[12px] text-muted font-light leading-relaxed">
                    Vous êtes l’unique hôte de l'institut. 30 minutes de battement sont réservées avant et après pour votre entière tranquillité.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulaire des coordonnées */}
            <div data-surface className="bg-surface rounded-[var(--radius-base,1rem)] p-6 sm:p-8 border border-border shadow-sm space-y-6">
              <h3 className="text-xl font-serif font-medium text-stone-deep">Vos coordonnées de contact</h3>

              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Prénom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sophie"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className={`w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border bg-paper text-sm focus:outline-none transition-all ${
                      formErrors.prenom ? 'border-red-400 bg-red-50/30' : 'border-border focus:border-sage focus:ring-1 focus:ring-sage'
                    }`}
                  />
                  {formErrors.prenom && <p className="text-[11px] text-red-500">{formErrors.prenom}</p>}
                </div>

                {/* Nom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Nom de famille <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dufour"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className={`w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border bg-paper text-sm focus:outline-none transition-all ${
                      formErrors.nom ? 'border-red-400 bg-red-50/30' : 'border-border focus:border-sage focus:ring-1 focus:ring-sage'
                    }`}
                  />
                  {formErrors.nom && <p className="text-[11px] text-red-500">{formErrors.nom}</p>}
                </div>

                {/* Téléphone */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Numéro de Téléphone (Mobile) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="+41 79 123 45 67"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className={`w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border bg-paper text-sm focus:outline-none transition-all ${
                        formErrors.telephone ? 'border-red-400 bg-red-50/30' : 'border-border focus:border-sage focus:ring-1 focus:ring-sage'
                      }`}
                    />
                    <Phone className="w-4 h-4 text-muted absolute right-4 top-3.5" />
                  </div>
                  {formErrors.telephone ? (
                    <p className="text-[11px] text-red-500">{formErrors.telephone}</p>
                  ) : (
                    <p className="text-[11px] text-muted font-light">Emmanuelle vous appelle ou vous écrit sur ce numéro.</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Adresse e-mail (optionnelle)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="sophie.dufour@exemple.ch"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border bg-paper text-sm focus:outline-none transition-all ${
                        formErrors.email ? 'border-red-400 bg-red-50/30' : 'border-border focus:border-sage focus:ring-1 focus:ring-sage'
                      }`}
                    />
                  </div>
                  {formErrors.email ? (
                    <p className="text-[11px] text-red-500">{formErrors.email}</p>
                  ) : (
                    <p className="text-[11px] text-muted font-light">Pour recevoir une copie de confirmation.</p>
                  )}
                </div>

                {/* Code Postal */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Code Postal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1607"
                    value={formData.codePostal}
                    onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                    className="w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border border-border bg-paper text-sm focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
                  />
                </div>

                {/* Ville */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                    Localité / Ville
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Palézieux"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className="w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border border-border bg-paper text-sm focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
                  />
                </div>
              </div>

              {/* Notes et souhaits particuliers */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-deep uppercase tracking-wider block">
                  Remarques ou souhaits particuliers (allergies, peaux sensibles, cadeau, etc.)
                </label>
                <textarea
                  rows={3}
                  placeholder="Précisez ici vos attentes ou sensibilités cutanées particulières pour qu'Emmanuelle prépare au mieux votre cabine..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-[var(--radius-base,0.75rem)] border border-border bg-paper text-sm focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage transition-all"
                />
              </div>
            </div>

            {/* Validation & Envoi */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                data-btn="secondary"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-3 text-sm font-medium transition-all"
              >
                Retour
              </button>

              <button
                type="button"
                data-btn="primary"
                onClick={handleSubmitBooking}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-9 py-3.5 font-medium text-sm sm:text-base tracking-wide shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enregistrement de votre demande...
                  </>
                ) : (
                  <>
                    Confirmer ma demande de rendez-vous
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 5 : RÉCAPITULATIF ET CONFIRMATION DIDACTIQUE
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 5 && confirmedBooking && (
          <div className="space-y-8 animate-fadein">
            <div
              data-surface
              className="bg-surface rounded-[var(--radius-base,1.5rem)] p-8 sm:p-10 border border-sage/30 shadow-md text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-sage/10 border border-sage/30 text-sage flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-sage">
                  Demande bien transmise
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-stone-deep font-normal">
                  Merci {confirmedBooking.prenom}, votre rendez-vous est pré-réservé !
                </h2>
                <p className="text-muted text-sm max-w-lg mx-auto font-light leading-relaxed">
                  Emmanuelle a bien reçu votre demande. Elle vérifie son carnet de rendez-vous et vous contactera très rapidement par téléphone ou WhatsApp pour valider l'horaire précis.
                </p>
              </div>

              {/* Carte de détails */}
              <div className="bg-paper rounded-[var(--radius-base,1rem)] p-6 max-w-lg mx-auto text-left border border-border space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs text-muted">Référence dossier :</span>
                  <span className="text-xs font-mono font-semibold text-stone-deep">
                    {confirmedBooking.id?.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-muted font-medium">Soin réservé :</div>
                  <div className="text-base font-serif font-bold text-stone-deep">
                    {confirmedBooking.service_nom}
                  </div>
                  {confirmedBooking.options && confirmedBooking.options.length > 0 && (
                    <div className="text-xs text-muted">
                      Options : {confirmedBooking.options.map((o: any) => o.nom).join(', ')}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                  <div>
                    <span className="text-xs text-muted block">Séance demandée :</span>
                    <span className="text-sm font-semibold text-stone-deep capitalize">
                      {new Date(`${confirmedBooking.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      —{' '}
                      <strong>
                        {confirmedBooking.heure_rdv === '09:00'
                          ? 'Séance du matin'
                          : confirmedBooking.heure_rdv === '14:00'
                          ? "Séance de l'après-midi"
                          : confirmedBooking.heure_rdv}
                      </strong>
                    </span>
                    <span className="text-[10px] text-muted block font-light">
                      Horaire exact convenu avec Emmanuelle
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Durée prévue :</span>
                    <span className="text-sm font-semibold text-stone-deep">
                      {confirmedBooking.service_duree_minutes} minutes
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">Tarif à régler sur place :</span>
                  <span className="text-xl font-serif font-bold text-sage">
                    CHF {confirmedBooking.service_prix_chf}
                  </span>
                </div>
              </div>

              {/* Actions de confirmation */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  data-btn="secondary"
                  onClick={downloadIcs}
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-xs"
                >
                  <CalendarCheck className="w-4 h-4 text-sage" />
                  Ajouter à mon agenda (.ics)
                </button>

                {businessPhone && (
                  <a
                    href={`https://wa.me/${businessPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                      `Bonjour Emmanuelle, je viens d'effectuer une réservation pour le soin ${confirmedBooking.service_nom} le ${confirmedBooking.date_rdv} à ${confirmedBooking.heure_rdv}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-btn="primary"
                    className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Écrire sur WhatsApp
                  </a>
                )}

                <Link
                  href="/"
                  data-btn="ghost"
                  className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold transition-all"
                >
                  Retourner à l’accueil
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
