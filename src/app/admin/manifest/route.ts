import { NextResponse } from 'next/server';
import { getSettingsServer } from '../../../services/settingsServer';
import { SITE_CONFIG } from '../../../config/site';

/**
 * Manifeste de la web app « Gestion » — servi sur /admin/manifest.
 *
 * Il n'est référencé que par le layout de /admin : le site public n'annonce
 * aucun manifeste et ne propose donc jamais l'installation. Remplace celui de
 * /admin/caisse (qui reste servi pour les installations existantes).
 *
 * Deux détails qui cassent tout si on les rate :
 *  · `scope` sans slash final. La correspondance se fait par préfixe de chaîne :
 *    avec « /admin/ », `start_url` (« /admin ») tomberait hors scope et le
 *    navigateur ouvrirait l'app dans un onglet normal.
 *  · le manifeste est récupéré SANS cookies ni en-têtes d'auth. Cette route
 *    doit donc rester publique — d'où l'absence de données sensibles ici.
 */
export const revalidate = 3600;

export async function GET() {
  const s = await getSettingsServer(['business_name']);
  const name = s.business_name || SITE_CONFIG.name;

  return NextResponse.json(
    {
      id: '/admin',
      name: `Gestion — ${name}`,
      short_name: 'Gestion',
      description: `Agenda, caisse, clientèle et site — ${name}.`,
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'fr-CH',
      dir: 'ltr',
      background_color: '#FFFFFF',
      theme_color: '#8A9A7B',
      categories: ['business', 'productivity'],
      icons: [
        { src: '/icons/algue-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/algue-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        // Variante « maskable » : Android rogne l'icône selon la forme du
        // lanceur, le monogramme y est donc réduit pour rester dans la zone sûre.
        { src: '/icons/algue-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Encaisser', short_name: 'Encaisser', url: '/admin/caisse' },
        { name: 'Agenda', short_name: 'Agenda', url: '/admin/reservations' },
        { name: 'Nouveau rendez-vous', short_name: 'Rendez-vous', url: '/admin/reservations?nouveau=1' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
