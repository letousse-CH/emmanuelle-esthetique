/** Pré-génération du contenu réseaux sociaux — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

export const config = { schedule: '0 6 * * *' };

export default async function handler() {
  return callCron('generate-social');
}
