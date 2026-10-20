/**
 * Adresse publique du site, pour les retours OAuth.
 *
 * Sur Netlify, `request.url` porte l'adresse interne du déploiement
 * (`<id>--<site>.netlify.app`), pas le domaine du site : une adresse de retour
 * construite dessus est inconnue de Facebook (« le domaine de cette URL n'est
 * pas inscrit ») et change à chaque déploiement. On prend donc l'adresse
 * canonique du site (SITE_CONFIG.url), sauf en local où c'est la requête qui
 * fait foi.
 */
import { SITE_CONFIG } from '../config/site';

export function publicOrigin(req: Request): string {
  const configured = (SITE_CONFIG.url || '').trim();
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) {
    try {
      return new URL(configured).origin;
    } catch {
      // adresse mal formée : repli sur la requête
    }
  }
  return new URL(req.url).origin;
}
