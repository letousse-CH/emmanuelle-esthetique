/** Automatisations planifiées — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

// Toutes les cinq minutes : c'est la granularité réelle des automatisations,
// dont l'échéance est comparée à la dernière occurrence prévue et non à
// l'heure exacte de l'appel.
export const config = { schedule: '*/5 * * * *' };

export default async function handler() {
  return callCron('automations');
}
