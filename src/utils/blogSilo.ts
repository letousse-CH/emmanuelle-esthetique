/**
 * Le blog au service du silo (voir CLAUDE.md, « Architecture du site »).
 *
 * Un article de blog est un contenu de soutien : il répond à une question et
 * renvoie vers la page pilier du soin concerné. Ce module fournit
 *  - aux prompts IA, la seule liste de soins, de prix et de pages autorisée
 *    (`siteFactsForPrompt`) : sans elle, le modèle inventait des soins et des
 *    tarifs que la cabine ne propose pas ;
 *  - à la page article, la page pilier à laquelle la rattacher (`pillarForArticle`).
 *
 * Pur et sans dépendance à Next.js : importé aussi par les tâches de fond
 * (`services/aiTasks`, empaquetées à part).
 */
import { CARTE, type CarteCategory, chf, itemPriceLabel } from '../constants/carteSoins';

/** Pages vers lesquelles un article peut faire un lien, en plus des piliers. */
const OTHER_PAGES: Array<{ path: string; label: string }> = [
  { path: '/soins', label: 'La carte des soins et tarifs' },
  { path: '/phytomer', label: 'La cosmétique marine Phytomer' },
  { path: '/bon-cadeau', label: 'Bon cadeau' },
  { path: '/reservation', label: 'Réserver un soin en ligne' },
  { path: '/contact', label: 'Contact et accès' },
];

/**
 * La carte des soins et les interdits (rien d'inventé, pas d'allégation
 * médicale) : socle commun des prompts d'article et de réseaux sociaux.
 */
export function carteFactsForPrompt(settings: Record<string, string | undefined>): string {
  const owner = settings.business_owner?.trim();
  const bio = settings.business_owner_bio?.trim();
  const carte = CARTE.map((c) => {
    const items = c.groups.flatMap((g) => g.items).map((i) =>
      `  - ${i.name}${i.duration ? ` (${i.duration})` : ''} : ${itemPriceLabel(i)}`,
    );
    return `${c.label} — page ${c.path}\n${items.join('\n')}`;
  }).join('\n\n');

  return `━━━ CE QUE L'INSTITUT PROPOSE VRAIMENT — SEULE SOURCE AUTORISÉE ━━━
${owner || bio ? `Qui écrit : ${[owner, bio].filter(Boolean).join(' — ')}\n` : ''}
Carte des soins (noms, durées et prix exacts) :
${carte}

Règles absolues :
- Ne cite que des soins de cette carte, avec leur nom, leur durée et leur prix exacts. N'invente aucun soin, aucun prix, aucune durée, aucun produit, aucune promotion.
- N'invente ni cliente, ni témoignage, ni anecdote datée, ni chiffre, ni statistique. Une observation de métier reste générale (« beaucoup de peaux… », « en cabine, on voit souvent… »).
- Aucune allégation médicale : pas de diagnostic, pas de promesse de résultat. En cas de doute (peau lésée, maladie de peau, grossesse, traitement), conseille un avis médical.
- Les soins sont réservés aux femmes.`;
}

export function siteFactsForPrompt(settings: Record<string, string | undefined>): string {
  return `${carteFactsForPrompt(settings)}

━━━ LIENS INTERNES — OBLIGATOIRES ━━━
- Fais 1 à 3 liens vers la page du soin dont parle l'article (adresse « page /soins/… » ci-dessus), dans une phrase naturelle : <a href="/soins/visage">les soins du visage Phytomer</a>.
- Termine par un lien vers <a href="/reservation">la réservation en ligne</a>.
- Autres pages possibles : ${OTHER_PAGES.map((p) => `${p.path} (${p.label})`).join(', ')}.
- Aucune autre adresse interne : n'invente jamais une URL du site.`;
}

/*
  Rattachement d'un article à sa page pilier, sans champ en base : d'abord le
  premier lien interne de l'article vers une page de soin (c'est ce que le
  prompt demande), sinon des mots du titre et des mots-clés. L'ordre compte :
  « épilation des sourcils » relève de l'épilation, pas du regard ni du visage.
*/
const PILLAR_WORDS: Array<[CarteCategory['id'], RegExp]> = [
  ['epilation', /[ée]pilation|cire|p[aâ]te de sucre|\bsucre\b|poils?\b/i],
  ['regard', /\bcils\b|sourcils|regard|r[ée]haussement/i],
  ['mains-pieds', /\bmains?\b|\bpieds?\b|ongles?|manucure|p[ée]dicure|cuticules?/i],
  ['corps', /massage|\bcorps\b|gommage|\bdos\b|relaxant/i],
  ['visage', /visage|\bpeau\b|teint|hydrat|rides?\b|[ée]clat|anti-[âa]ge/i],
];

export function pillarForArticle(article: {
  title?: string | null;
  meta_keywords?: string | null;
  content?: string | null;
}): CarteCategory | null {
  const linked = (article.content || '').match(/href="(\/soins\/[a-z-]+)"/);
  if (linked) {
    const byLink = CARTE.find((c) => c.path === linked[1]);
    if (byLink) return byLink;
  }
  const text = `${article.title || ''} ${article.meta_keywords || ''}`;
  const hit = PILLAR_WORDS.find(([, re]) => re.test(text));
  return hit ? CARTE.find((c) => c.id === hit[0]) ?? null : null;
}

/**
 * « dès CHF 90 » : le plus petit prix du groupe principal de la catégorie. Les
 * groupes titrés (options « Privilèges », forfaits) ne sont pas des soins seuls :
 * une option à CHF 25 ne fait pas un soin du visage « dès CHF 25 ».
 */
export function pillarFromPrice(category: CarteCategory): string {
  const main = category.groups.find((g) => !g.title) ?? category.groups[0];
  const prices = main.items
    .flatMap((i) => (i.variants?.length ? i.variants.map((v) => v.price) : [i.price]));
  return `dès ${chf(Math.min(...prices))}`;
}
