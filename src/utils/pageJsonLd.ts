/**
 * Constructeurs de JSON-LD par page.
 *
 * Deux schémas riches qui accompagnent chaque page dynamique :
 *
 * 1. `FAQPage` : injecté si la page contient une section `faq_1` ou `faq_2`.
 *    Chaque question/réponse devient un `Question` + `Answer` — Google
 *    autorise l'affichage en résultat enrichi et Perplexity/ChatGPT s'en
 *    servent comme source structurée.
 *
 * 2. `BreadcrumbList` : reconstitue un fil d'ariane logique à partir du slug,
 *    via une table `SLUG_TO_CATEGORY`. Rester conforme à la vraie navigation
 *    — un breadcrumb qui pointe vers une catégorie qui n'existe pas dégrade
 *    la confiance de l'entité.
 */

import type { PageSection } from '../components/pagebuilder/wireframes.config';

/**
 * Mapping slug → parent (nom + slug de la catégorie).
 * Ajoutez ici toute nouvelle page de soin pour qu'elle hérite d'un fil d'Ariane.
 * `null` = pas de parent hors racine.
 */
const SLUG_TO_CATEGORY: Record<string, { name: string; slug: string } | null> = {
  // Hubs racine
  home: null,
  soins: null,
  'a-propos': null,
  contact: null,
  'bon-cadeau': null,
  'mentions-legales': null,

  // Catégories (parent = /soins)
  'soins-visage-palezieux': { name: 'Tous les soins', slug: 'soins' },
  'soins-corps-palezieux': { name: 'Tous les soins', slug: 'soins' },
  'beaute-du-regard-palezieux': { name: 'Tous les soins', slug: 'soins' },
  'epilation-sucre-palezieux': { name: 'Tous les soins', slug: 'soins' },
  'ateliers-bien-etre-palezieux': { name: 'Tous les soins', slug: 'soins' },

  // Soins visage
  'soin-visage-signature-palezieux': {
    name: 'Soins du visage',
    slug: 'soins-visage-palezieux',
  },
  'soin-anti-age-palezieux': {
    name: 'Soins du visage',
    slug: 'soins-visage-palezieux',
  },
  'soin-visage-peau-sensible-palezieux': {
    name: 'Soins du visage',
    slug: 'soins-visage-palezieux',
  },

  // Soins corps
  'massage-relaxant-huiles-chaudes-palezieux': {
    name: 'Soins du corps',
    slug: 'soins-corps-palezieux',
  },
  'head-spa-palezieux': {
    name: 'Soins du corps',
    slug: 'soins-corps-palezieux',
  },

  // Beauté du regard
  'sourcils-mise-en-forme-palezieux': {
    name: 'Beauté du regard',
    slug: 'beaute-du-regard-palezieux',
  },
  'teinture-cils-sourcils-palezieux': {
    name: 'Beauté du regard',
    slug: 'beaute-du-regard-palezieux',
  },
  'rehaussement-cils-palezieux': {
    name: 'Beauté du regard',
    slug: 'beaute-du-regard-palezieux',
  },
  'cours-de-maquillage-palezieux': {
    name: 'Beauté du regard',
    slug: 'beaute-du-regard-palezieux',
  },

  // Ateliers
  'atelier-gua-sha-palezieux': {
    name: "Ateliers d'auto-soin",
    slug: 'ateliers-bien-etre-palezieux',
  },
  'atelier-glowing-face-palezieux': {
    name: "Ateliers d'auto-soin",
    slug: 'ateliers-bien-etre-palezieux',
  },
};

/**
 * Nettoie une réponse FAQ : supprime les balises HTML et normalise les
 * espaces, pour tenir la contrainte Google d'un texte "propre" dans
 * `acceptedAnswer.text`.
 */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFaqJsonLd(sections: PageSection[]): object | null {
  const faqSections = sections.filter(
    (s) => s.type === 'faq_1' || s.type === 'faq_2',
  );
  if (faqSections.length === 0) return null;

  const cards: Array<{ question: string; answer: string }> = [];
  for (const s of faqSections) {
    const list = ((s.data as any)?.cards || []) as Array<{
      question?: string;
      answer?: string;
    }>;
    for (const c of list) {
      const q = (c.question || '').trim();
      const a = stripHtml(c.answer || '');
      if (q && a) cards.push({ question: q, answer: a });
    }
  }
  if (cards.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cards.map((c) => ({
      '@type': 'Question',
      name: c.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: c.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(opts: {
  slug: string;
  pageTitle: string;
  siteUrl: string;
}): object | null {
  const { slug, pageTitle, siteUrl } = opts;
  // Home : pas de breadcrumb utile.
  if (slug === 'home' || slug === '') return null;
  // Slug inconnu : on renvoie Accueil > Titre uniquement.
  const category = SLUG_TO_CATEGORY[slug];
  const items: Array<{ name: string; url: string }> = [
    { name: 'Accueil', url: `${siteUrl}/` },
  ];
  if (category) {
    items.push({
      name: category.name,
      url: `${siteUrl}/${category.slug}`,
    });
  }
  items.push({ name: pageTitle, url: `${siteUrl}/${slug}` });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
