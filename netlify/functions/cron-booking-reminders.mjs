/** Rappel de la veille aux clientes — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

// 8 h UTC = 10 h à Zurich en été, 9 h en hiver : assez tôt pour qu'une cliente
// empêchée puisse prévenir dans la journée.
export const config = { schedule: '0 8 * * *' };

export default async function handler() {
  return callCron('booking-reminders');
}
