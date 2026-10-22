/** Publications programmées sur Instagram et Facebook — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

// Tous les quarts d'heure (dix minutes jusqu'au 2026-10-22, espacé pour
// économiser les crédits Netlify).
export const config = { schedule: '*/15 * * * *' };

export default async function handler() {
  return callCron('social-publish');
}
