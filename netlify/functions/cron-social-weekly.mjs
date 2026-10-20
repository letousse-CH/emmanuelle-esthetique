/**
 * Pilote hebdomadaire des réseaux sociaux — ordonnanceur Netlify.
 * Chaque matin ; la route ne travaille que le jour réglé (mercredi par défaut).
 */
import { callCron } from './cron-publish.mjs';

export const config = { schedule: '0 5 * * *' };

export default async function handler() {
  return callCron('social-weekly');
}
