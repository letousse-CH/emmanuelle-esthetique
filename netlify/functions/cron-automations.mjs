/** Automatisations planifiées — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

// Tous les quarts d'heure (cinq minutes jusqu'au 2026-10-22, espacé pour
// économiser les crédits Netlify) : une automatisation n'a pas besoin de
// partir à la minute près, son échéance est comparée à la dernière occurrence
// prévue (rattrapage sur 24 h) et non à l'heure exacte de l'appel.
export const config = { schedule: '*/15 * * * *' };

export default async function handler() {
  return callCron('automations');
}
