"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
  HelpCircle,
  User,
  Mail,
  MapPin,
  CalendarCheck,
  Heart,
  Droplets,
  Flower2,
  Scissors,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

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
  iconName?: string;
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

// ── Catalogue des Prestations Filtrées (Règles Métier) ──────────────────────

export const PRESTATIONS_CATALOG: PrestationItem[] = [
  // Soins du visage
  {
    id: 'peau-nette-eclat-express',
    category: 'visage',
    name: 'Soin Peau Nette & Coup d’Éclat Express',
    durationMinutes: 40,
    durationLabel: '40 min',
    priceChf: 90,
    description:
      'Nettoyage profond désincrustant sous serviettes chaudes, gommage marin enzymatique, masque chauffant détoxifiant et hydratation personnalisée Phytomer.',
    tag: 'Coup d’éclat immédiat',
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
    tag: 'Soin emblématique',
  },
  {
    id: 'expert-jeunesse',
    category: 'visage',
    name: 'Soin Expert Jeunesse — Correction Rides & Fermeté',
    durationMinutes: 75,
    durationLabel: '75 min',
    priceChf: 165,
    description:
      'Protocole anti-âge intensif. Modelage remodelant ciblé inspiré des techniques de digito-pression, suivi de la pose d’un masque plastifiant tenseur aux actifs marins purs.',
    tag: 'Anti-âge d’exception',
  },

  // Soins & Rituels du corps
  {
    id: 'voile-de-satin',
    category: 'corps',
    name: 'Soin Voile de Satin — Gommage Peau Neuve',
    durationMinutes: 45,
    durationLabel: '45 min',
    priceChf: 110,
    description:
      'Exfoliation complète aux cristaux de sels marins reminéralisants, suivie d’une application onctueuse et massée de lait satinant. La peau est exfoliée, douce et soyeuse.',
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
      'Massage complet du corps sur-mesure combinant effleurages profonds, drainages doux et pressions dénouantes à l’huile marine satinante au parfum envoûtant.',
    tag: 'Signature Cabine',
  },
  {
    id: 'echappee-belle',
    category: 'corps',
    name: 'Rituel Échappée Belle — Visage & Corps',
    durationMinutes: 105,
    durationLabel: '1h45',
    priceChf: 230,
    description:
      'La synergie bien-être absolue : gommage complet du corps Voile de Satin ou massage ciblé du dos, immédiatement suivi du Soin Hydra Originel complet.',
    tag: 'Le rituel prestige',
  },

  // Épilations : Uniquement les Forfaits Signature
  {
    id: 'forfait-douceur',
    category: 'epilation',
    name: 'Forfait Douceur',
    durationMinutes: 45,
    durationLabel: '45 min',
    priceChf: 95,
    description:
      'Demi-jambes + aisselles + maillot au choix (classique, brésilien ou intégral à la cire ou au sucre). Formule essentielle rapide, nette et durable.',
    tag: 'Forfait Signature',
  },
  {
    id: 'forfait-integral',
    category: 'epilation',
    name: 'Forfait Intégral',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 125,
    description:
      'Jambes complètes + aisselles + maillot au choix. Le rituel complet corps sans compromis avec émulsion marine apaisante offerte.',
    tag: 'Forfait Signature',
  },

  // Services : Mains & Pieds + Réhaussement
  {
    id: 'prestige-mains',
    category: 'services',
    name: 'Soin Prestige des Mains « Spa »',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 85,
    description:
      'Limage sur-mesure, travail précis des cuticules, gommage aux sels fins marins, masque régénérant tiède et modelage décontractant avant-bras et mains.',
  },
  {
    id: 'prestige-pieds',
    category: 'services',
    name: 'Soin Prestige des Pieds « Spa »',
    durationMinutes: 70,
    durationLabel: '70 min',
    priceChf: 105,
    description:
      'Élimination des callosités, mise en forme des ongles, soin des cuticules, gommage marin, masque sous serviettes chaudes et modelage défatigant de la voûte plantaire.',
  },
  {
    id: 'rehaussement-cils',
    category: 'services',
    name: 'Réhaussement de cils',
    durationMinutes: 60,
    durationLabel: '60 min',
    priceChf: 100,
    description:
      'Mise en valeur naturelle de la courbure des cils pour ouvrir et illuminer le regard sans maquillage durant 6 à 8 semaines.',
  },
];

// Options privilèges complémentaires (Étape 2)
const PRIVILEGE_OPTIONS: PrivilegeOption[] = [
  {
    id: 'option-boue-marine-dos',
    nom: 'Boue Marine Auto-Chauffante Dos',
    duree_minutes: 0, // Posée pendant le soin du visage
    prix_chf: 30,
    description:
      'Application d’une boue marine effervescente et reminéralisante le long du dos pendant votre soin. Décontracte instantanément les trapèzes et la colonne vertébrale.',
  },
  {
    id: 'option-cuir-chevelu-nuque',
    nom: 'Massage Relaxant Cuir Chevelu & Nuque',
    duree_minutes: 15,
    prix_chf: 25,
    description:
      'Manœuvres lentes et enveloppantes pour libérer le mental, dissoudre les tensions crâniennes et prolonger la sensation de détente.',
  },
  {
    id: 'option-teinture-cils',
    nom: 'Teinture des cils',
    duree_minutes: 15,
    prix_chf: 30,
    description:
      'Intensifie la couleur naturelle des cils pour un effet mascara discret et élégant.',
  },
  {
    id: 'option-teinture-sourcils',
    nom: 'Teinture des sourcils',
    duree_minutes: 10,
    prix_chf: 22,
    description:
      'Redéfinit la ligne du sourcil avec une nuance harmonieuse adaptée à votre teint.',
  },
  {
    id: 'option-duo-regard',
    nom: 'Duo Regard (Cils & Sourcils)',
    duree_minutes: 20,
    prix_chf: 45,
    description:
      'La combinaison idéale pour un regard magnifié, structuré et contrasté tout en naturel.',
  },
];

const CATEGORIES = [
  { id: 'visage', label: 'Soins du Visage', icon: Sparkles, desc: 'Haute technicité Phytomer' },
  { id: 'corps', label: 'Soins & Rituels Corps', icon: Droplets, desc: 'Détente & lâcher-prise' },
  { id: 'epilation', label: 'Forfaits Épilation', icon: Flower2, desc: 'Forfaits Signature' },
  { id: 'services', label: 'Mains, Pieds & Cils', icon: Scissors, desc: 'Rituels de précision' },
] as const;

export default function ReservationClient({
  businessPhone,
  businessOwner,
}: {
  businessPhone?: string;
  businessOwner?: string;
}) {
  // ── États du Wizard ──
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Étape 1 : Prestation
  const [selectedCategory, setSelectedCategory] = useState<'visage' | 'corps' | 'epilation' | 'services'>('visage');
  const [selectedService, setSelectedService] = useState<PrestationItem | null>(PRESTATIONS_CATALOG[1]); // Hydra originel par défaut
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  // Étape 2 : Upselling & Offre du mois
  const [monthlyOffer, setMonthlyOffer] = useState<MonthlyOfferData | null>(null);
  const [includeMonthlyOffer, setIncludeMonthlyOffer] = useState(false);
  const [selectedPrivileges, setSelectedPrivileges] = useState<string[]>([]);

  // Étape 3 : Date & Créneau
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Demain ou lundi si weekend
    const d = new Date();
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Pas le dimanche
    return d.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [timePeriodFilter, setTimePeriodFilter] = useState<'all' | 'matin' | 'aprem'>('all');

  // Étape 4 : Coordonnées
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    codePostal: '',
    ville: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Étape 5 : Résultat / Envoi
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // ── Chargement de l'offre du mois active ──
  useEffect(() => {
    fetch('/api/bookings/monthly-offer')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.offer) {
          setMonthlyOffer(data.offer);
        }
      })
      .catch((err) => console.warn('Impossible de charger l’offre du mois:', err));
  }, []);

  // ── Calcul de la durée totale et du prix ──
  const { currentDurationMinutes, currentPriceChf, currentServiceName } = useMemo(() => {
    if (!selectedService) return { currentDurationMinutes: 60, currentPriceChf: 0, currentServiceName: '' };

    let duration = selectedService.durationMinutes;
    let price = selectedService.priceChf;

    if (selectedService.variants && selectedService.variants.length > 0) {
      const v = selectedService.variants[selectedVariantIndex] || selectedService.variants[0];
      duration = v.durationMinutes;
      price = v.priceChf;
    }

    // Ajout des privilèges
    for (const optId of selectedPrivileges) {
      const opt = PRIVILEGE_OPTIONS.find((p) => p.id === optId);
      if (opt) {
        price += opt.prix_chf;
        duration += opt.duree_minutes;
      }
    }

    // Ajout offre du mois si cochée
    if (includeMonthlyOffer && monthlyOffer) {
      price += Number(monthlyOffer.prix_chf);
      duration += 30; // 30 min estimées
    }

    return {
      currentDurationMinutes: duration,
      currentPriceChf: price,
      currentServiceName: selectedService.name,
    };
  }, [selectedService, selectedVariantIndex, selectedPrivileges, includeMonthlyOffer, monthlyOffer]);

  // ── Chargement des créneaux disponibles ──
  useEffect(() => {
    if (!selectedDate || currentStep < 3) return;

    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);

    const url = `/api/bookings/available-slots?date=${selectedDate}&duration=${currentDurationMinutes}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Impossible de charger les disponibilités');
        return res.json();
      })
      .then((data) => {
        if (data.ouvert === false) {
          setAvailableSlots([]);
          setSlotsError("L'institut est fermé à cette date. Veuillez choisir un autre jour.");
        } else {
          setAvailableSlots(data.slots || []);
        }
      })
      .catch((err) => {
        console.error(err);
        setSlotsError("Erreur lors de la vérification de l'agenda. Veuillez réessayer.");
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate, currentDurationMinutes, currentStep]);

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

  // Génération des 14 prochains jours ouvrés pour la sélection de date rapide
  const dateOptions = useMemo(() => {
    const dates: { dateStr: string; dayName: string; dayNumber: number; monthName: string; isSunday: boolean }[] = [];
    const now = new Date();

    for (let i = 1; i <= 21 && dates.length < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const isSunday = d.getDay() === 0;

      if (!isSunday) {
        const dateStr = d.toISOString().split('T')[0];
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

    // Préparation des options
    const optionsToSend = selectedPrivileges.map((id) => {
      const p = PRIVILEGE_OPTIONS.find((opt) => opt.id === id)!;
      return {
        id: p.id,
        nom: p.nom,
        prix_chf: p.prix_chf,
        duree_minutes: p.duree_minutes,
      };
    });

    if (includeMonthlyOffer && monthlyOffer) {
      optionsToSend.push({
        id: monthlyOffer.id,
        nom: `Offre du Mois : ${monthlyOffer.titre}`,
        prix_chf: Number(monthlyOffer.prix_chf),
        duree_minutes: 30,
      });
    }

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
        service_duree_minutes: currentDurationMinutes,
        options: optionsToSend,
        offer_of_month_id: includeMonthlyOffer && monthlyOffer ? monthlyOffer.id : null,
        date_rdv: selectedDate,
        heure_rdv: selectedSlot,
        notes_cliente: formData.notes || null,
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
      // Remonter en haut de page pour visualiser la confirmation
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Erreur réservation:', err);
      setSubmitError(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Formatage de la date en français suisse ──
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

  // ── Génération du fichier ICS pour ajout calendrier ──
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
      `DESCRIPTION:Soin : ${confirmedBooking.service_nom} (CHF ${confirmedBooking.service_prix_chf}). Cabine privée et intimité garantie.`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `LOCATION:Emmanuelle Esthétique, Suisse`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `rendez-vous-${confirmedBooking.date_rdv}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#22252A] pt-28 pb-24 px-4 sm:px-6 lg:px-8 selection:bg-sage/20">
      <div className="max-w-4xl mx-auto">
        {/* En-tête prestigieux univers Phytomer & cabine privée */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF1ED] border border-[#829B88]/20 text-[#2C5E55] text-xs font-semibold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-[#829B88]" />
            Cabine Privée & Rituels Phytomer
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[#183B36] font-normal tracking-tight">
            Réserver votre soin en ligne
          </h1>
          <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base font-light leading-relaxed">
            Offrez-vous une parenthèse marine exclusive. Choisissez votre rituel, personnalisez vos privilèges et sélectionnez votre créneau en toute quiétude.
          </p>
        </div>

        {/* Stepper horizontal élégant */}
        {currentStep < 5 && (
          <div className="mb-10">
            <div className="bg-white/80 backdrop-blur border border-stone-200/80 rounded-2xl p-3 sm:p-4 shadow-xs">
              <nav aria-label="Étapes de réservation" className="flex items-center justify-between">
                {[
                  { num: 1, label: 'Prestation' },
                  { num: 2, label: 'Privilèges' },
                  { num: 3, label: 'Créneau' },
                  { num: 4, label: 'Coordonnées' },
                ].map((step, idx) => {
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
                              ? 'bg-[#183B36] text-white shadow-sm ring-4 ring-[#183B36]/10'
                              : isCompleted
                              ? 'bg-[#829B88] text-white'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                        </span>
                        <span className="hidden sm:inline">
                          <span
                            className={`block text-xs font-semibold uppercase tracking-wider ${
                              isActive ? 'text-[#183B36]' : isCompleted ? 'text-stone-700' : 'text-stone-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </span>
                      </button>
                      {idx < 3 && (
                        <div
                          className={`h-0.5 flex-1 mx-2 sm:mx-4 rounded-full transition-colors ${
                            currentStep > idx + 1 ? 'bg-[#829B88]' : 'bg-stone-200'
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
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`p-3.5 sm:p-4 rounded-xl text-left border transition-all ${
                      isCatActive
                        ? 'bg-[#183B36] text-white border-[#183B36] shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 hover:border-[#829B88]/50 hover:bg-stone-50/50'
                    }`}
                  >
                    <IconComponent className={`w-5 h-5 mb-2 ${isCatActive ? 'text-[#A3B899]' : 'text-[#829B88]'}`} />
                    <div className="text-xs sm:text-sm font-semibold leading-tight">{cat.label}</div>
                    <div className={`text-[11px] mt-0.5 truncate ${isCatActive ? 'text-white/70' : 'text-stone-400'}`}>
                      {cat.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Liste des soins de la catégorie sélectionnée */}
            <div className="space-y-4">
              {PRESTATIONS_CATALOG.filter((p) => p.category === selectedCategory).map((item) => {
                const isSelected = selectedService?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedService(item);
                      setSelectedVariantIndex(0);
                    }}
                    className={`group relative p-5 sm:p-6 rounded-2xl border transition-all cursor-pointer bg-white ${
                      isSelected
                        ? 'border-[#183B36] ring-2 ring-[#183B36]/15 shadow-md'
                        : 'border-stone-200 hover:border-stone-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-serif font-medium text-[#183B36] group-hover:text-[#2C5E55] transition-colors">
                            {item.name}
                          </h3>
                          {item.tag && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#EBF1ED] text-[#2C5E55] border border-[#829B88]/20">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-stone-600 text-xs sm:text-sm leading-relaxed max-w-2xl font-light">
                          {item.description}
                        </p>

                        {/* Variantes multiples (ex: Grand massage relaxant 60 min ou 90 min) */}
                        {item.variants && item.variants.length > 0 && isSelected && (
                          <div className="pt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-stone-500 font-medium">Choisissez la durée :</span>
                            {item.variants.map((v, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedVariantIndex(idx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  selectedVariantIndex === idx
                                    ? 'bg-[#183B36] text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                }`}
                              >
                                {v.durationLabel} — CHF {v.priceChf}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <div className="text-right">
                          <div className="text-xl font-serif font-semibold text-[#183B36]">
                            CHF{' '}
                            {item.variants && isSelected
                              ? item.variants[selectedVariantIndex]?.priceChf
                              : item.priceChf}
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <Clock className="w-3.5 h-3.5" />
                            {item.variants && isSelected
                              ? item.variants[selectedVariantIndex]?.durationLabel
                              : item.durationLabel}
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-[#183B36] border-[#183B36] text-white'
                              : 'border-stone-300 text-transparent'
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

            {/* Bouton de progression */}
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={!selectedService}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-[#183B36] hover:bg-[#234E46] text-white font-medium text-sm sm:text-base tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-0.5"
              >
                Continuer vers les Privilèges
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 2 : UPSELLING & OFFRE DU MOIS
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-fadein">
            {/* Récapitulatif du soin principal sélectionné */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EBF1ED] flex items-center justify-center text-[#2C5E55]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-stone-500 font-medium">Votre soin principal sélectionné :</div>
                  <div className="text-base font-serif font-semibold text-[#183B36]">{currentServiceName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-serif font-semibold text-[#183B36]">CHF {selectedService?.priceChf}</div>
                <div className="text-xs text-stone-500">{currentDurationMinutes} min</div>
              </div>
            </div>

            {/* 1. Mise en avant de l'Offre du Mois (si active) */}
            {monthlyOffer && monthlyOffer.active && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-[#829B88]/40 bg-gradient-to-br from-[#F4F7F5] via-white to-[#EBF1ED] p-6 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  {monthlyOffer.image_url && (
                    <div className="w-full md:w-44 h-36 rounded-xl overflow-hidden shrink-0 shadow-inner bg-stone-100">
                      <img
                        src={monthlyOffer.image_url}
                        alt={monthlyOffer.titre}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-2 text-left">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#183B36] text-white text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#A3B899]" />
                      Offre Exclusive du Mois
                    </div>
                    <h3 className="text-xl font-serif font-semibold text-[#183B36]">{monthlyOffer.titre}</h3>
                    {monthlyOffer.description && (
                      <p className="text-stone-600 text-xs sm:text-sm font-light leading-relaxed">
                        {monthlyOffer.description}
                      </p>
                    )}
                    <div className="text-lg font-serif font-semibold text-[#2C5E55]">
                      Tarif Privilège : CHF {monthlyOffer.prix_chf}
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setIncludeMonthlyOffer(!includeMonthlyOffer)}
                      className={`w-full md:w-auto px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        includeMonthlyOffer
                          ? 'bg-[#183B36] text-white shadow-sm ring-2 ring-[#829B88]'
                          : 'bg-white text-[#183B36] border border-[#829B88] hover:bg-[#EBF1ED]'
                      }`}
                    >
                      {includeMonthlyOffer ? (
                        <>
                          <Check className="w-4 h-4 text-[#A3B899]" />
                          Offre ajoutée à votre séance
                        </>
                      ) : (
                        '+ Ajouter cette offre exclusive'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Options Privilèges Complémentaires (Upselling doux & non intrusif) */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-serif text-[#183B36]">Les Privilèges Cabine Complémentaires</h3>
                <p className="text-xs sm:text-sm text-stone-600 font-light">
                  Complétez votre soin par une attention sur-mesure pour prolonger la détente (réalisées durant votre protocole ou en temps additionnel).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PRIVILEGE_OPTIONS.map((opt) => {
                  const isChecked = selectedPrivileges.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setSelectedPrivileges((prev) =>
                          isChecked ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                        );
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 bg-white ${
                        isChecked
                          ? 'border-[#183B36] ring-1 ring-[#183B36] bg-[#F7FAF8]'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                          isChecked
                            ? 'bg-[#183B36] border-[#183B36] text-white'
                            : 'border-stone-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold text-[#183B36] truncate">{opt.nom}</h4>
                          <span className="text-sm font-serif font-semibold text-[#2C5E55] shrink-0">
                            + CHF {opt.prix_chf}
                          </span>
                        </div>
                        <p className="text-[12px] text-stone-500 font-light mt-0.5 line-clamp-2">
                          {opt.description}
                        </p>
                        {opt.duree_minutes > 0 && (
                          <span className="inline-block mt-1 text-[11px] text-[#829B88] font-medium">
                            +{opt.duree_minutes} min de bien-être
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Barre de total estimé & navigation */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-stone-500 block">Total estimé de la séance :</span>
                <span className="text-2xl font-serif font-bold text-[#183B36]">
                  CHF {currentPriceChf}
                </span>
                <span className="text-xs text-stone-500 ml-2">({currentDurationMinutes} min prévues)</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-5 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-all"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#183B36] hover:bg-[#234E46] text-white text-sm font-medium tracking-wide shadow-md transition-all hover:translate-x-0.5"
                >
                  Choisir le créneau
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
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#EBF1ED] flex items-center justify-center text-[#2C5E55] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm text-stone-600 font-light">
                <p className="font-medium text-[#183B36]">
                  Sélection en temps réel · Lundi au Samedi de 9h00 à 18h00
                </p>
                <p>
                  Un battement sanitaire et sérénité de <strong>30 minutes</strong> est automatiquement réservé après chaque soin pour assurer une aération complète, la désinfection de la cabine et votre absolue discrétion.
                </p>
              </div>
            </div>

            {/* Sélecteur de date (Carrousel / grille de dates ouvrées) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-serif font-medium text-[#183B36]">
                  1. Choisissez le jour de votre rendez-vous :
                </h3>
                <span className="text-xs text-stone-500 font-light">Fermé le dimanche</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {dateOptions.map((item) => {
                  const isDateSelected = selectedDate === item.dateStr;
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                        isDateSelected
                          ? 'bg-[#183B36] text-white border-[#183B36] shadow-sm ring-2 ring-[#829B88]/20'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-[#829B88] hover:bg-stone-50'
                      }`}
                    >
                      <span className={`text-[11px] uppercase tracking-wider font-semibold ${isDateSelected ? 'text-white/80' : 'text-stone-400'}`}>
                        {item.dayName}
                      </span>
                      <span className="text-lg font-bold font-serif leading-tight">{item.dayNumber}</span>
                      <span className={`text-[10px] ${isDateSelected ? 'text-white/70' : 'text-stone-500'}`}>
                        {item.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Champ calendrier natif pour date ultérieure */}
              <div className="flex items-center gap-2 pt-2 text-xs text-stone-500">
                <Calendar className="w-3.5 h-3.5 text-[#829B88]" />
                <span>Autre date :</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#829B88]"
                />
              </div>
            </div>

            {/* 2. Grille des créneaux horaires disponibles avec séparation Matin / Après-midi */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <h3 className="text-base sm:text-lg font-serif font-medium text-[#183B36]">
                  2. Créneaux disponibles pour le <span className="capitalize">{formattedDate}</span> :
                </h3>

                {/* Filtre Matin / Après-midi */}
                <div className="inline-flex rounded-lg bg-stone-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimePeriodFilter('all')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      timePeriodFilter === 'all' ? 'bg-white text-[#183B36] font-semibold shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimePeriodFilter('matin')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      timePeriodFilter === 'matin' ? 'bg-white text-[#183B36] font-semibold shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Matin (dès 9h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimePeriodFilter('aprem')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      timePeriodFilter === 'aprem' ? 'bg-white text-[#183B36] font-semibold shadow-xs' : 'text-stone-600'
                    }`}
                  >
                    Après-midi (dès 14h)
                  </button>
                </div>
              </div>

              {loadingSlots ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-stone-200">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#829B88]" />
                  <p className="text-xs sm:text-sm text-stone-500 font-light">
                    Interrogation de l'agenda d'Emmanuelle et calcul des battements...
                  </p>
                </div>
              ) : slotsError ? (
                <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                  <p>{slotsError}</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-6 space-y-2">
                  <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                  <h4 className="text-sm font-semibold text-stone-800">Aucun créneau disponible pour cette journée</h4>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto font-light">
                    Emmanuelle est complète ou fermée ce jour-là. Veuillez sélectionner une autre date parmi les propositions ci-dessus.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Section MATIN (dès 09h00) */}
                  {(timePeriodFilter === 'all' || timePeriodFilter === 'matin') && (
                    <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2C5E55]">
                        <Clock className="w-4 h-4 text-[#829B88]" />
                        Matinée (dès 9h00)
                      </div>

                      {morningSlots.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">Aucun créneau disponible en matinée.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                          {morningSlots.map((slot) => {
                            const isSlotSelected = selectedSlot === slot.heure;
                            return (
                              <button
                                key={slot.heure}
                                type="button"
                                disabled={!slot.disponible}
                                onClick={() => setSelectedSlot(slot.heure)}
                                className={`py-3 px-2 rounded-xl text-center border transition-all ${
                                  !slot.disponible
                                    ? 'bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed line-through'
                                    : isSlotSelected
                                    ? 'bg-[#183B36] text-white border-[#183B36] shadow-sm font-bold ring-2 ring-[#829B88]/20'
                                    : 'bg-white text-stone-800 border-stone-200 hover:border-[#829B88] hover:bg-stone-50 font-medium'
                                }`}
                              >
                                <span className="text-sm block">{slot.heure}</span>
                                <span className="text-[10px] block opacity-70">jusqu'à {slot.fin}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section APRÈS-MIDI (dès 14h00) */}
                  {(timePeriodFilter === 'all' || timePeriodFilter === 'aprem') && (
                    <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2C5E55]">
                        <Clock className="w-4 h-4 text-[#829B88]" />
                        Après-midi (dès 14h00)
                      </div>

                      {afternoonSlots.length === 0 ? (
                        <p className="text-xs text-stone-400 italic">Aucun créneau disponible l'après-midi.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                          {afternoonSlots.map((slot) => {
                            const isSlotSelected = selectedSlot === slot.heure;
                            return (
                              <button
                                key={slot.heure}
                                type="button"
                                disabled={!slot.disponible}
                                onClick={() => setSelectedSlot(slot.heure)}
                                className={`py-3 px-2 rounded-xl text-center border transition-all ${
                                  !slot.disponible
                                    ? 'bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed line-through'
                                    : isSlotSelected
                                    ? 'bg-[#183B36] text-white border-[#183B36] shadow-sm font-bold ring-2 ring-[#829B88]/20'
                                    : 'bg-white text-stone-800 border-stone-200 hover:border-[#829B88] hover:bg-stone-50 font-medium'
                                }`}
                              >
                                <span className="text-sm block">{slot.heure}</span>
                                <span className="text-[10px] block opacity-70">jusqu'à {slot.fin}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation étape 3 */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-all"
              >
                Retour
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                disabled={!selectedSlot}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#183B36] hover:bg-[#234E46] text-white font-medium text-sm sm:text-base tracking-wide shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-0.5"
              >
                Continuer vers vos Coordonnées
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ÉTAPE 4 : COORDONNÉES & MENTION RASSURANTE 1-2-3
            ═══════════════════════════════════════════════════════════════════ */}
        {currentStep === 4 && (
          <div className="space-y-8 animate-fadein">
            {/* Récapitulatif sélection date & soin */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-stone-400 font-medium">Récapitulatif de votre séance :</span>
                <div className="text-base font-serif font-semibold text-[#183B36]">
                  {currentServiceName}
                  {selectedPrivileges.length > 0 && ` + ${selectedPrivileges.length} privilège(s)`}
                </div>
                <div className="text-xs text-stone-600 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#829B88]" />
                  <span className="capitalize">{formattedDate}</span> à <strong>{selectedSlot}</strong> ({currentDurationMinutes} min)
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-400 block">Montant à régler sur place :</span>
                <span className="text-2xl font-serif font-bold text-[#183B36]">CHF {currentPriceChf}</span>
              </div>
            </div>

            {/* Mention rassurante 1-2-3 (Charte Confiance Cabine Privée) */}
            <div className="rounded-2xl border border-[#829B88]/30 bg-gradient-to-r from-[#F4F7F5] to-[#EBF1ED] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#183B36]">
                <ShieldCheck className="w-4 h-4 text-[#829B88]" />
                Charte Sérénité & Confiance Emmanuelle Esthétique
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-stone-200/60 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#183B36] text-white flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">Aucun paiement en ligne</h4>
                  <p className="text-[12px] text-stone-600 font-light leading-relaxed">
                    Votre réservation se fait sans carte bancaire sur le site. Vous réglez sur place le jour de votre venue (cartes, Twint ou espèces).
                  </p>
                </div>

                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-stone-200/60 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#183B36] text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">Confirmation personnelle</h4>
                  <p className="text-[12px] text-stone-600 font-light leading-relaxed">
                    Emmanuelle vérifie son planning et vous rappelle personnellement pour confirmer l’horaire exact et vos éventuelles attentes spécifiques.
                  </p>
                </div>

                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-stone-200/60 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#183B36] text-white flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">Cabine privée exclusive</h4>
                  <p className="text-[12px] text-stone-600 font-light leading-relaxed">
                    Vous êtes l’unique hôte de l'institut. 30 minutes de battement sont réservées avant et après pour votre entière tranquillité.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulaire des coordonnées */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
              <h3 className="text-xl font-serif font-medium text-[#183B36]">Vos coordonnées de contact</h3>

              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Prénom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sophie"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.prenom ? 'border-red-400 bg-red-50/30' : 'border-stone-200 focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20'
                    }`}
                  />
                  {formErrors.prenom && <p className="text-[11px] text-red-500">{formErrors.prenom}</p>}
                </div>

                {/* Nom */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Nom de famille <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Dufour"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.nom ? 'border-red-400 bg-red-50/30' : 'border-stone-200 focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20'
                    }`}
                  />
                  {formErrors.nom && <p className="text-[11px] text-red-500">{formErrors.nom}</p>}
                </div>

                {/* Téléphone */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Numéro de Téléphone (Mobile) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="+41 79 123 45 67"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                        formErrors.telephone ? 'border-red-400 bg-red-50/30' : 'border-stone-200 focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20'
                      }`}
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute right-4 top-3.5" />
                  </div>
                  {formErrors.telephone ? (
                    <p className="text-[11px] text-red-500">{formErrors.telephone}</p>
                  ) : (
                    <p className="text-[11px] text-stone-400 font-light">Emmanuelle vous appelle ou vous écrit sur ce numéro.</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Adresse e-mail (optionnelle)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="sophie.dufour@exemple.ch"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
                        formErrors.email ? 'border-red-400 bg-red-50/30' : 'border-stone-200 focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20'
                      }`}
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute right-4 top-3.5" />
                  </div>
                  {formErrors.email ? (
                    <p className="text-[11px] text-red-500">{formErrors.email}</p>
                  ) : (
                    <p className="text-[11px] text-stone-400 font-light">Pour recevoir une copie du récapitulatif.</p>
                  )}
                </div>

                {/* Code Postal */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Code Postal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1200"
                    value={formData.codePostal}
                    onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20 transition-all"
                  />
                </div>

                {/* Ville */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                    Localité / Ville
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Genève"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20 transition-all"
                  />
                </div>
              </div>

              {/* Notes et souhaits particuliers */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
                  Remarques ou souhaits particuliers (allergies, peaux sensibles, cadeau, etc.)
                </label>
                <textarea
                  rows={3}
                  placeholder="Précisez ici vos attentes ou sensibilités cutanées particulières pour qu'Emmanuelle prépare au mieux votre cabine..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#829B88] focus:ring-2 focus:ring-[#829B88]/20 transition-all"
                />
              </div>
            </div>

            {/* Validation & Envoi */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-5 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-all"
              >
                Retour
              </button>

              <button
                type="button"
                onClick={handleSubmitBooking}
                disabled={submitting}
                className="inline-flex items-center gap-2.5 px-9 py-4 rounded-xl bg-[#183B36] hover:bg-[#234E46] text-white font-medium text-sm sm:text-base tracking-wide shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enregistrement de votre demande...
                  </>
                ) : (
                  <>
                    Confirmer ma demande de rendez-vous
                    <CheckCircle2 className="w-5 h-5 text-[#A3B899]" />
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
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#829B88]/30 shadow-md text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#EBF1ED] border border-[#829B88]/30 text-[#2C5E55] flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#829B88]">
                  Demande bien transmise
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#183B36] font-normal">
                  Merci {confirmedBooking.prenom}, votre rendez-vous est pré-réservé !
                </h2>
                <p className="text-stone-600 text-sm max-w-lg mx-auto font-light leading-relaxed">
                  Emmanuelle a bien reçu votre demande. Elle vérifie son carnet de rendez-vous et vous contactera très rapidement par téléphone ou WhatsApp pour valider l'horaire précis.
                </p>
              </div>

              {/* Carte de détails */}
              <div className="bg-[#FAF7F2] rounded-2xl p-6 max-w-lg mx-auto text-left border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <span className="text-xs text-stone-500">Référence dossier :</span>
                  <span className="text-xs font-mono font-semibold text-stone-800">
                    {confirmedBooking.id?.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-stone-400 font-medium">Soin réservé :</div>
                  <div className="text-base font-serif font-bold text-[#183B36]">
                    {confirmedBooking.service_nom}
                  </div>
                  {confirmedBooking.options && confirmedBooking.options.length > 0 && (
                    <div className="text-xs text-stone-600">
                      Options : {confirmedBooking.options.map((o: any) => o.nom).join(', ')}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-200">
                  <div>
                    <span className="text-xs text-stone-400 block">Date & Heure :</span>
                    <span className="text-sm font-semibold text-stone-800 capitalize">
                      {new Date(`${confirmedBooking.date_rdv}T12:00:00`).toLocaleDateString('fr-CH', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      à <strong>{confirmedBooking.heure_rdv}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-stone-400 block">Durée prévue :</span>
                    <span className="text-sm font-semibold text-stone-800">
                      {confirmedBooking.service_duree_minutes} minutes
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  <span className="text-xs text-stone-500">Tarif à régler sur place :</span>
                  <span className="text-xl font-serif font-bold text-[#183B36]">
                    CHF {confirmedBooking.service_prix_chf}
                  </span>
                </div>
              </div>

              {/* Actions de confirmation */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={downloadIcs}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs sm:text-sm font-semibold transition-all shadow-xs"
                >
                  <CalendarCheck className="w-4 h-4 text-[#829B88]" />
                  Ajouter à mon agenda (.ics)
                </button>

                {businessPhone && (
                  <a
                    href={`https://wa.me/${businessPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                      `Bonjour Emmanuelle, je viens d'effectuer une réservation pour le soin ${confirmedBooking.service_nom} le ${confirmedBooking.date_rdv} à ${confirmedBooking.heure_rdv}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Écrire sur WhatsApp
                  </a>
                )}

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#183B36] hover:bg-[#234E46] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
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
