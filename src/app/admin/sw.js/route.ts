/**
 * Service worker de l'admin, servi sur /admin/sw.js.
 *
 * Il ne met RIEN en cache : les données (agenda, caisse, clientes) doivent
 * toujours venir du réseau. Son seul rôle est de rendre l'application
 * installable — Chrome sur Android n'émet `beforeinstallprompt` (donc n'offre
 * « Installer l'application » plutôt qu'un simple raccourci) que si une page
 * dispose d'un service worker avec un gestionnaire `fetch`.
 *
 * `Service-Worker-Allowed: /admin` : sans lui le scope serait `/admin/`, qui
 * n'inclurait pas `start_url` (« /admin », sans slash final).
 */
export const dynamic = 'force-static';

const SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// Gestionnaire volontairement passif : aucune réponse interceptée, le navigateur
// traite la requête normalement (réseau).
self.addEventListener('fetch', () => {});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/admin',
      'Cache-Control': 'no-cache',
    },
  });
}
