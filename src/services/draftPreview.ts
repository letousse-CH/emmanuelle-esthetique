/**
 * Aperçu local des brouillons de la refonte du site.
 *
 * Les pages de la refonte sont enregistrées dans `dynamic_pages` sous un slug
 * préfixé (`brouillon/soins/visage`), non publiées : les visiteurs et la
 * production ne les voient jamais. Avec `DRAFT_PREVIEW=1` (script
 * `npm run dev:brouillons`), le site local sert ces brouillons à l'URL
 * définitive (`/soins/visage`) et lit le menu `navigation_menu_draft` — de quoi
 * parcourir la nouvelle arborescence avec tous ses liens, sans rien toucher au
 * site en ligne. Ne jamais définir cette variable sur Netlify.
 *
 * Le jour de la mise en ligne, `scripts/publish-site-v2.mjs` retire le préfixe.
 */
export const DRAFT_PREFIX = 'brouillon/';
export const DRAFT_PREVIEW = process.env.DRAFT_PREVIEW === '1';

export function draftSlug(slug: string): string {
  return `${DRAFT_PREFIX}${slug}`;
}
