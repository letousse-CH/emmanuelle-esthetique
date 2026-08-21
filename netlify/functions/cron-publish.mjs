/**
 * Publication des articles planifiés — ordonnanceur Netlify.
 *
 * Les routes `/api/cron/*` savent quoi faire mais n'ont jamais été déclenchées
 * par quoi que ce soit : rien, dans le dépôt, ne les appelait. Ces fonctions
 * planifiées comblent ce trou. Elles ne contiennent aucune logique métier —
 * elles se contentent d'appeler la route avec le secret.
 */
export const config = { schedule: '*/15 * * * *' };

export default async function handler() {
  return callCron('publish');
}

export async function callCron(name) {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error(`[cron-${name}] URL ou CRON_SECRET manquant : rien n'est déclenché.`);
    return new Response('missing configuration', { status: 500 });
  }
  const response = await fetch(`${base}/api/cron/${name}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.text();
  console.log(`[cron-${name}] ${response.status} ${body.slice(0, 300)}`);
  return new Response(body, { status: response.ok ? 200 : 500 });
}
