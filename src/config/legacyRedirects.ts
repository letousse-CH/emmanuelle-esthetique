/**
 * Anciennes URL → nouvelles pages de l'arborescence en silo.
 *
 * Utilisé par la route `[...slug]` uniquement quand AUCUNE page publiée ne porte
 * le slug demandé : tant qu'une ancienne page existe, elle reste servie telle
 * quelle, et la redirection 301 ne s'enclenche qu'une fois la page retirée
 * (mise en ligne de la refonte). Les backlinks et les fiches Google déjà
 * indexées conservent ainsi leur valeur.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  // Visage (les trois anciens soins nommés rejoignent la page pilier)
  'soins-visage-palezieux': '/soins/visage',
  'soin-visage-signature-palezieux': '/soins/visage',
  'soin-anti-age-palezieux': '/soins/visage',
  'soin-visage-peau-sensible-palezieux': '/soins/visage',
  // Corps & massages
  'soins-corps-palezieux': '/soins/corps',
  'massage-relaxant-huiles-chaudes-palezieux': '/soins/corps',
  'head-spa-palezieux': '/soins/corps',
  // Regard
  'beaute-du-regard-palezieux': '/soins/regard',
  'sourcils-mise-en-forme-palezieux': '/soins/regard',
  'teinture-cils-sourcils-palezieux': '/soins/regard',
  'rehaussement-cils-palezieux': '/soins/regard',
  // Épilation
  'epilation-sucre-palezieux': '/soins/epilation',
  // Carte & prestations retirées de la carte (ateliers, cours de maquillage)
  'la-carte-des-soins': '/soins',
  'ateliers-bien-etre-palezieux': '/soins',
  'atelier-gua-sha-palezieux': '/soins',
  'atelier-glowing-face-palezieux': '/soins',
  'cours-de-maquillage-palezieux': '/soins',
};
