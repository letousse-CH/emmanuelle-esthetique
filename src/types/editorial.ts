/**
 * Types et constantes du plan éditorial, partagés entre l'admin (navigateur) et
 * la génération (serveur). Volontairement séparés de `utils/editorialPlan`, qui
 * importe le SDK Anthropic et ne doit jamais partir dans le bundle client.
 */

export type EditorialPeriod = 'week' | 'month';

/** Nombre de posts proposés par période — cadence lundi / mercredi / vendredi. */
export const PERIOD_SIZES: Record<EditorialPeriod, number> = { week: 3, month: 12 };
export const PERIOD_LABELS: Record<EditorialPeriod, string> = { week: 'Semaine', month: 'Mois' };

export interface EditorialTopic {
  /** Date de publication proposée, au format YYYY-MM-DD. */
  date: string;
  /** Reconnaître · Comprendre · Sortir */
  pillar: string;
  title: string;
  /** Brief : l'angle, la scène concrète, ce que le lecteur comprend à la fin. */
  angle: string;
}

export const PILLAR_STYLES: Record<string, string> = {
  'Reconnaître': 'bg-sage/10 text-sage',
  'Comprendre': 'bg-amber-50 text-amber-700',
  'Sortir': 'bg-indigo-50 text-indigo-700',
};
