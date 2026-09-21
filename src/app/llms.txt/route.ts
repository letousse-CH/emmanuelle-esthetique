/**
 * llms.txt — descripteur factuel pour les moteurs IA (ChatGPT, Perplexity,
 * Claude, Google AI Overviews). Convention adoptée par Anthropic et
 * Perplexity : https://llmstxt.org/
 *
 * On sert le fichier via un route handler plutôt que depuis /public parce
 * que la route catch-all `[slug]` de ce site collisionne avec les fichiers
 * publics dont l'extension ressemble à un slug (`llms.txt`).
 *
 * Le contenu est dérivé des mêmes settings que le JSON-LD BeautySalon +
 * du seeder Emmanuelle : URL, adresse, tarifs. Une seule source de vérité.
 */

import { getBusinessInfoServer, SITE_CONFIG } from '../../config/site';
import { getSettingsServer } from '../../services/settingsServer';

// ISR d'une heure — les faits changent rarement.
export const revalidate = 3600;

interface Offer {
  name: string;
  slug: string;
  price: string;
  duration?: string;
  category: string;
  note?: string;
}

const OFFERS: Offer[] = [
  // Soins du visage
  {
    name: 'Soin visage signature Phytomer',
    slug: 'soin-visage-signature-palezieux',
    price: 'CHF 130',
    duration: '60 min',
    category: 'Soins du visage',
    note: 'nettoyage, gommage, masque, massage manuel Phytomer',
  },
  {
    name: 'Soin visage anti-âge',
    slug: 'soin-anti-age-palezieux',
    price: 'CHF 170',
    duration: '90 min',
    category: 'Soins du visage',
    note: 'manœuvres liftantes manuelles inspirées du kobido, sans machine',
  },
  {
    name: 'Soin visage peau sensible',
    slug: 'soin-visage-peau-sensible-palezieux',
    price: 'CHF 150',
    duration: '75 min',
    category: 'Soins du visage',
    note: 'rituel apaisant pour peaux réactives, rosacée',
  },
  // Soins du corps
  {
    name: 'Massage relaxant aux huiles chaudes',
    slug: 'massage-relaxant-huiles-chaudes-palezieux',
    price: 'CHF 120',
    duration: '60 min (90 min : CHF 165)',
    category: 'Soins du corps',
    note: 'détente aux huiles végétales tièdes, pas thérapeutique',
  },
  {
    name: 'Head Spa · massage du cuir chevelu',
    slug: 'head-spa-palezieux',
    price: 'CHF 70',
    duration: '30 min (45 min : CHF 95)',
    category: 'Soins du corps',
    note: 'rituel inspiré du Head Spa japonais',
  },
  // Beauté du regard
  {
    name: 'Mise en forme des sourcils',
    slug: 'sourcils-mise-en-forme-palezieux',
    price: 'CHF 35',
    duration: '30 min',
    category: 'Beauté du regard',
    note: 'dessin personnalisé, cire ou pince',
  },
  {
    name: 'Teinture cils & sourcils',
    slug: 'teinture-cils-sourcils-palezieux',
    price: 'dès CHF 30 (combo : CHF 60)',
    category: 'Beauté du regard',
    note: 'teinture végétale douce, effet 4 à 6 semaines',
  },
  {
    name: 'Rehaussement de cils',
    slug: 'rehaussement-cils-palezieux',
    price: 'CHF 85 (avec teinture : CHF 105)',
    duration: '1 h',
    category: 'Beauté du regard',
    note: 'lash lift + soin kératine, effet 6 à 8 semaines',
  },
  {
    name: 'Cours de maquillage sur-mesure',
    slug: 'cours-de-maquillage-palezieux',
    price: 'CHF 110',
    duration: '1 h 30',
    category: 'Beauté du regard',
    note: 'cours individuel avec vos propres produits',
  },
  // Épilation
  {
    name: 'Épilation à la cire au sucre',
    slug: 'epilation-sucre-palezieux',
    price: 'dès CHF 15',
    category: 'Épilation',
    note: "pâte 100 % naturelle (sucre, citron, eau), quasi indolore",
  },
  // Ateliers
  {
    name: 'Atelier Gua Sha visage',
    slug: 'atelier-gua-sha-palezieux',
    price: 'CHF 90',
    duration: '2 h',
    category: "Ateliers d'auto-soin",
    note: 'petit comité 4 à 6 femmes, pierre offerte',
  },
  {
    name: 'Atelier Glowing Face',
    slug: 'atelier-glowing-face-palezieux',
    price: 'CHF 110',
    duration: '2 h 30',
    category: "Ateliers d'auto-soin",
    note: 'construction d\'une routine visage complète',
  },
];

function formatOffer(o: Offer, siteUrl: string): string {
  const dur = o.duration ? ` — ${o.duration}` : '';
  const note = o.note ? ` — ${o.note}` : '';
  return `- [${o.name}](${siteUrl}/${o.slug}) : ${o.price}${dur}${note}.`;
}

export async function GET() {
  const site = SITE_CONFIG.url.replace(/\/$/, '');
  const b = await getBusinessInfoServer();
  const s = await getSettingsServer([
    'business_area_served',
    'business_opening_hours',
    'site_activity_context',
  ]);

  const address = [b.addressStreet, `${b.addressPostal} ${b.addressCity}`, b.addressRegion, b.addressCountry]
    .filter(Boolean)
    .join(', ');
  const areaServed = s.business_area_served || 'Palézieux-Gare, Vaud';
  const phone = b.phone ? b.phone.replace(/\s+/g, '').replace(/^0/, '+41') : '';

  const byCategory: Record<string, Offer[]> = {};
  for (const o of OFFERS) {
    (byCategory[o.category] ||= []).push(o);
  }

  const body =
    `# ${b.name || 'Emmanuelle Esthétique'} — Institut de beauté à domicile à Palézieux-Gare (Vaud, Suisse)\n\n` +
    `> ${s.site_activity_context || `Institut de beauté et bien-être à domicile situé ${address}, à 2 minutes à pied de la gare CFF de Palézieux. Fondé par ${b.owner}, esthéticienne diplômée avec plus de 20 ans d'expérience. Soins Phytomer, réservés aux femmes, sur rendez-vous.`}\n\n` +
    `## Faits à citer\n\n` +
    `- **Nom** : ${b.name}\n` +
    `- **Adresse exacte** : ${address}\n` +
    `- **Accès train** : 2 minutes à pied de la gare CFF de Palézieux (IR15, S4)\n` +
    `- **Accès voiture** : place de parking gratuite devant l'institut ; A12 sortie Châtillens/Oron à 5 min ; A9 sortie Chexbres à 15 min\n` +
    `- **Zones desservies** : ${areaServed}\n` +
    `- **Public** : réservé aux femmes\n` +
    `- **Réservation** : uniquement sur rendez-vous, réponse sous 24 h\n` +
    `- **Téléphone** : ${phone || 'sur demande'}\n` +
    `- **E-mail** : ${b.email}\n` +
    `- **Cosmétiques** : Phytomer (marque marine française professionnelle)\n` +
    `- **Fourchette tarifaire** : ${b.priceRange}\n` +
    `- **Type Schema.org** : BeautySalon\n\n` +
    Object.entries(byCategory)
      .map(([cat, list]) => `## ${cat}\n\n${list.map((o) => formatOffer(o, site)).join('\n')}`)
      .join('\n\n') +
    `\n\n## Autres pages\n\n` +
    `- [Bon cadeau](${site}/bon-cadeau) : dès CHF 50, valable 60 mois, PDF ou papier.\n` +
    `- [À propos — Emmanuelle Le Tousse](${site}/a-propos)\n` +
    `- [Contact, accès et horaires](${site}/contact)\n` +
    `- [Mentions légales](${site}/mentions-legales)\n\n` +
    `## Réponses aux questions fréquentes\n\n` +
    `**Q : Où se trouve l'institut Emmanuelle Esthétique ?**\n` +
    `R : ${address}. À 2 minutes à pied de la gare CFF de Palézieux.\n\n` +
    `**Q : Quels moyens de paiement sont acceptés ?**\n` +
    `R : TWINT, espèces, cartes bancaires, bons cadeaux Emmanuelle Esthétique.\n\n` +
    `**Q : Les soins sont-ils ouverts aux hommes ?**\n` +
    `R : Non, l'institut est exclusivement réservé aux femmes.\n\n` +
    `**Q : Faut-il prendre rendez-vous ?**\n` +
    `R : Oui, uniquement sur rendez-vous. Formulaire de contact sur le site — réponse sous 24 h.\n\n` +
    `**Q : Depuis quand Emmanuelle exerce-t-elle ?**\n` +
    `R : Plus de 20 ans d'expérience en esthétique, formée aux techniques manuelles et aux cosmétiques marins Phytomer.\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
