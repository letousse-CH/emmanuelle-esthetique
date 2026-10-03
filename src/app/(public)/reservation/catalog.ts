/**
 * Catalogue de REPLI du formulaire de réservation.
 *
 * La source de vérité est la table `services` (GET /api/bookings/services,
 * ids = UUID). Ce catalogue ne sert que si cette route est injoignable :
 * ses `id` sont ceux de `src/constants/carteSoins.ts`, que le serveur accepte
 * en repli — le formulaire n'envoie donc jamais un identifiant que personne
 * ne sait résoudre. Les prix et durées affichés ici sont indicatifs : le
 * serveur recalcule tout à partir de l'identifiant.
 *
 * `PRESTATIONS_CATALOG`, `PrestationItem` et `PRIVILEGE_OPTIONS` sont encore
 * importés (via `ReservationClient`) par l'ancienne page admin des
 * réservations : ne pas les retirer pendant la transition.
 */

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
    // La carte ne donne pas de durée aux forfaits : le serveur retient 60 min.
    durationMinutes: 60,
    durationLabel: '60 min',
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
