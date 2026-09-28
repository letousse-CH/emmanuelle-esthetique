/**
 * llms.txt — descripteur factuel pour les moteurs IA (ChatGPT, Perplexity,
 * Claude, Google AI Overviews). Convention adoptée par Anthropic et
 * Perplexity : https://llmstxt.org/
 *
 * On sert le fichier via un route handler plutôt que depuis /public parce
 * que la route catch-all `[slug]` de ce site collisionne avec les fichiers
 * publics dont l'extension ressemble à un slug (`llms.txt`).
 *
 * Le contenu est dérivé des mêmes réglages que le JSON-LD BeautySalon et de la
 * carte des soins (constants/carteSoins.ts) : adresse, prix, durées. Une seule
 * source de vérité — rien n'est affirmé ici qui ne figure pas dans la carte ou
 * dans les réglages de l'entreprise.
 */

import { getBusinessInfoServer, SITE_CONFIG } from '../../config/site';
import { getSettingsServer } from '../../services/settingsServer';
import { CARTE, chf, itemPriceLabel } from '../../constants/carteSoins';

// ISR d'une heure — les faits changent rarement.
export const revalidate = 3600;

const DAYS: Record<string, string> = { Mo: 'lundi', Tu: 'mardi', We: 'mercredi', Th: 'jeudi', Fr: 'vendredi', Sa: 'samedi', Su: 'dimanche' };

/** « lundi au samedi, 09:00–19:00 » depuis le réglage JSON `business_opening_hours`. */
function formatHours(raw: string): string {
  try {
    const rows = JSON.parse(raw) as Array<{ days: string[]; opens: string; closes: string }>;
    return rows
      .map((r) => {
        const days = r.days.map((d) => DAYS[d] || d);
        const range = days.length > 1 ? `${days[0]} au ${days[days.length - 1]}` : days[0];
        return `${range}, ${r.opens.replace(':', 'h').replace(/h00$/, 'h')}–${r.closes.replace(':', 'h').replace(/h00$/, 'h')}`;
      })
      .join(' ; ');
  } catch {
    return '';
  }
}

export async function GET() {
  const site = SITE_CONFIG.url.replace(/\/$/, '');
  const b = await getBusinessInfoServer();
  const s = await getSettingsServer(['business_area_served', 'business_opening_hours']);

  const address = [b.addressStreet, `${b.addressPostal} ${b.addressCity}`, b.addressRegion, b.addressCountry]
    .filter(Boolean)
    .join(', ');
  const areaServed = s.business_area_served || 'Palézieux-Gare, Vaud';
  const phone = b.phone ? b.phone.replace(/\s+/g, '').replace(/^0/, '+41') : '';
  const hours = formatHours(s.business_opening_hours);

  const soins = CARTE.map((cat) => {
    const lines = cat.groups.flatMap((g) =>
      g.items.map((i) => `- ${i.name}${i.duration ? ` (${i.duration})` : ''} : ${itemPriceLabel(i)}`),
    );
    return `### [${cat.label}](${site}${cat.path})\n\n${cat.tagline}\n\n${lines.join('\n')}`;
  }).join('\n\n');

  const body =
    `# ${b.name || 'Emmanuelle Esthétique'} — Institut de beauté et bien-être à Palézieux-Gare (Vaud, Suisse)\n\n` +
    `> Cabine privée de soins esthétiques à Palézieux-Gare, tenue par ${b.owner}. Soins du visage et rituels du corps à la cosmétique marine Phytomer, beauté des mains et des pieds, beauté du regard, épilation à la cire douce et à la pâte de sucre. Sur rendez-vous.\n\n` +
    `## Faits à citer\n\n` +
    `- **Nom** : ${b.name}\n` +
    `- **Adresse** : ${address}\n` +
    `- **Lieu** : cabine privée, à 2 minutes à pied de la gare CFF de Palézieux\n` +
    `- **Zones desservies** : ${areaServed}\n` +
    (hours ? `- **Horaires** : ${hours}, sur rendez-vous\n` : `- **Réservation** : sur rendez-vous\n`) +
    `- **Téléphone** : ${phone || 'sur demande'}\n` +
    `- **E-mail** : ${b.email}\n` +
    `- **Cosmétiques** : Phytomer (cosmétique marine française)\n` +
    `- **Fourchette tarifaire** : de ${chf(15)} (épilation lèvre supérieure) à ${chf(230)} (rituel visage et corps)\n` +
    `- **Type Schema.org** : BeautySalon\n\n` +
    `## La carte des soins et tarifs\n\n` +
    `Détail et prix : [${site}/soins](${site}/soins)\n\n` +
    soins +
    `\n\n## Pages du site\n\n` +
    `- [Accueil](${site}/)\n` +
    `- [La carte des soins et tarifs](${site}/soins)\n` +
    `- [Phytomer, la cosmétique marine](${site}/phytomer)\n` +
    `- [À propos — ${b.owner}](${site}/a-propos)\n` +
    `- [Contact, accès et horaires](${site}/contact)\n` +
    `- [Bon cadeau](${site}/bon-cadeau)\n` +
    `- [Mentions légales](${site}/mentions-legales)\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
