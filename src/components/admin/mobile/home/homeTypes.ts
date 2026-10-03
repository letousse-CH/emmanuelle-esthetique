import type { Booking } from '../../../../types/booking';

/** État d'un bloc de l'accueil : chaque bloc charge et échoue indépendamment des autres. */
export type Block<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

export interface MoneyData {
  /** Recette encaissée aujourd'hui (`recetteEncaissee`, jamais la somme de total_ttc). */
  today: number;
  todayCount: number;
  /** Recette encaissée depuis le 1er du mois. */
  month: number;
  /** Recette du mois précédent, jusqu'au même jour du mois (comparaison à durée égale). */
  prevMonthToDate: number;
}

export interface LowStockItem {
  id: string;
  nom: string;
  stock: number;
  seuil: number;
}

export interface ExpiringCard {
  id: string;
  code: string;
  libelle: string;
  montantRestant: number;
  expireLe: string; // YYYY-MM-DD
  joursRestants: number;
}

export interface AlertsData {
  lowStock: LowStockItem[];
  expiringCards: ExpiringCard[];
}

export interface SiteStatsData {
  today: number;
  week: number;
}

export type HomeBlockKey = 'schedule' | 'pending' | 'money' | 'alerts' | 'siteStats';

export interface HomeData {
  /** Jour civil à Zurich (`YYYY-MM-DD`). */
  today: string;
  /** Rendez-vous de la semaine en cours (lundi → dimanche, et demain si besoin). */
  schedule: Block<Booking[]>;
  /** Demandes `en_attente` non contactées, toutes dates. */
  pending: Block<Booking[]>;
  money: Block<MoneyData>;
  alerts: Block<AlertsData>;
  siteStats: Block<SiteStatsData>;
}
