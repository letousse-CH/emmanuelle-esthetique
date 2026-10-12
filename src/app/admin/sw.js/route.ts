/**
 * Service worker de l'admin, servi sur /admin/sw.js.
 *
 * Il ne met RIEN en cache : les données (agenda, caisse, clientes) doivent
 * toujours venir du réseau. Ses deux rôles : rendre l'application
 * installable — Chrome sur Android n'émet `beforeinstallprompt` (donc n'offre
 * « Installer l'application » plutôt qu'un simple raccourci) que si une page
 * dispose d'un service worker avec un gestionnaire `fetch` — et afficher les
 * notifications push des nouvelles demandes de rendez-vous.
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

// Notifications push (nouvelle demande de rendez-vous) : voir services/pushNotifications.ts.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Nouvelle demande de rendez-vous', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/icons/algue-v2-192.png',
    badge: '/icons/algue-v2-192.png',
    vibrate: [200, 100, 200],
    data: { url: d.url || '/admin/reservations' },
  }));
});

// Toucher la notification : ramène l'admin déjà ouvert sur la demande, sinon l'ouvre.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const path = (e.notification.data && e.notification.data.url) || '/admin/reservations';
  const url = new URL(path.startsWith('/admin') ? path : '/admin', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).pathname.startsWith('/admin') && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
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
