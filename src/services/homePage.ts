import { getSettingsServer } from './settingsServer';
import { fetchPageBySlug } from './dynamicPages';
import type { DynamicPage } from './dynamicPages';

/**
 * Noms historiques de la page d'accueil, essayés quand aucun n'est choisi.
 * Ils restent en repli pour que les sites déjà en ligne ne changent pas de
 * comportement le jour où ce réglage apparaît.
 */
export const LEGACY_HOME_SLUGS = ['home', 'accueil'] as const;

/**
 * Page servie à la racine du site.
 *
 * Le slug retenu est renvoyé avec elle : le composant client s'en sert pour
 * ses propres relectures, sinon il redemanderait « home » — qui n'existe pas
 * forcément — et effacerait la page rendue par le serveur.
 */
export async function fetchHomePage(): Promise<{ page: DynamicPage | null; slug: string }> {
  const { home_page_slug } = await getSettingsServer(['home_page_slug']);
  const candidates = [home_page_slug.trim(), ...LEGACY_HOME_SLUGS].filter(Boolean);

  for (const slug of candidates) {
    // `true` : on sert aussi les brouillons à la racine, comme avant — la page
    // d'accueil du builder doit toujours primer sur le repli statique.
    const page = await fetchPageBySlug(slug, true);
    if (page) return { page, slug };
  }
  return { page: null, slug: candidates[0] ?? 'home' };
}
