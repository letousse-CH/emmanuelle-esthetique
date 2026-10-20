/** Publications programmées sur Instagram et Facebook — ordonnanceur Netlify. */
import { callCron } from './cron-publish.mjs';

export const config = { schedule: '*/10 * * * *' };

export default async function handler() {
  return callCron('social-publish');
}
