import { NextResponse } from 'next/server';
import { getSettingsServer } from '../../../../services/settingsServer';
import { SITE_CONFIG } from '../../../../config/site';

/**
 * Manifeste de la web app « Caisse » — servi sur /admin/caisse/manifest.
 *
 * Il n'est référencé que par le layout de /admin/caisse : le site public
 * n'annonce aucun manifeste et ne propose donc jamais l'installation.
 *
 * Deux détails qui cassent tout si on les rate :
 *  · `scope` sans slash final. La correspondance se fait par préfixe de chaîne :
 *    avec « /admin/caisse/ », `start_url` (« /admin/caisse ») tomberait hors
 *    scope et le navigateur ouvrirait l'app dans un onglet normal.
 *  · le manifeste est récupéré SANS cookies ni en-têtes d'auth. Cette route
 *    doit donc rester publique — d'où l'absence de données sensibles ici.
 */
export const revalidate = 3600;

export async function GET() {
  const s = await getSettingsServer(['business_name']);
  const name = s.business_name || SITE_CONFIG.name;

  return NextResponse.json(
    {
      id: '/admin/caisse',
      name: `Caisse — ${name}`,
      short_name: 'Caisse',
      // Tiret plutôt qu'un « de {name} » : le nom de l'entreprise est libre, et
      // « de Untel » demanderait une élision qu'on ne peut pas deviner.
      description: `Encaissement, clientèle et journal des recettes — ${name}.`,
      start_url: '/admin/caisse',
      scope: '/admin/caisse',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'fr-CH',
      dir: 'ltr',
      background_color: '#FAF7F2',
      theme_color: '#8A9A7B',
      categories: ['business', 'finance'],
      icons: [
        { src: '/icons/caisse-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/caisse-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        // Variante « maskable » : Android rogne l'icône selon la forme du
        // lanceur, le monogramme y est donc réduit pour rester dans la zone sûre.
        { src: '/icons/caisse-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Journal & CA', url: '/admin/caisse/journal' },
        { name: 'Clientes', url: '/admin/caisse/clients' },
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
