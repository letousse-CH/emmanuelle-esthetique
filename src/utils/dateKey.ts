/**
 * Clés de date `YYYY-MM-DD` alignées sur le calendrier local.
 *
 * `Date.toISOString().slice(0, 10)` donne la date **UTC** : sur un fuseau à
 * décalage positif (Europe/Zurich = UTC+1/+2), le minuit local d'un jour tombe
 * la veille en UTC et la clé obtenue est décalée d'un jour. Les colonnes
 * `date` de Postgres, elles, sont des dates civiles sans fuseau — il faut donc
 * les lire et les écrire dans le calendrier local, jamais via UTC.
 */

/** Date civile locale d'un `Date`, au format `YYYY-MM-DD`. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `Date` à midi local pour une clé `YYYY-MM-DD` (midi : à l'abri des sauts DST). */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/** Clé de date décalée de `days` jours (négatif accepté). */
export function addDaysToKey(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Clé de date d'aujourd'hui. */
export function todayKey(): string {
  return toDateKey(new Date());
}
