import * as cheerio from 'cheerio';

/**
 * Extraction du contenu d'une page existante.
 *
 * Le but n'est pas de reproduire la page mais d'en tirer la **matière** : ce
 * que l'entreprise fait, comment elle le dit, ses coordonnées, ses images. La
 * mise en forme d'origine est délibérément jetée — c'est précisément ce qu'on
 * vient remplacer.
 *
 * Aucun appel IA ici : cette étape est déterministe, gratuite et vérifiable.
 * L'interprétation vient après.
 */

export interface ExtractedSite {
  url: string;
  domain: string;
  title: string;
  description: string;
  lang: string;
  /** Titres dans l'ordre du document, avec leur niveau. */
  headings: { level: number; text: string }[];
  /** Paragraphes significatifs, dédoublonnés. */
  paragraphs: string[];
  /** Éléments de liste : souvent les prestations. */
  listItems: string[];
  images: { src: string; alt: string }[];
  navLabels: string[];
  emails: string[];
  phones: string[];
  /** Texte des boutons et liens d'action — révèle les intentions du site. */
  ctas: string[];
  /** Adresse postale devinée depuis le pied de page. */
  address?: string;
  socials: string[];
}

const NOISE = /^(accueil|home|menu|fermer|close|cookies?|accepter|rechercher|search|retour|lire la suite|en savoir plus)$/i;

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function extractSite(html: string, pageUrl: string): ExtractedSite {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);

  // Le bruit structurel fausserait tout le reste : on l'ôte d'abord.
  $('script, style, noscript, svg, iframe, template').remove();

  const absolute = (src: string) => {
    try {
      return new URL(src, base).toString();
    } catch {
      return '';
    }
  };

  const headings = $('h1, h2, h3')
    .toArray()
    .map((el) => ({
      level: Number(el.tagName.replace('h', '')),
      text: clean($(el).text()),
    }))
    .filter((h) => h.text.length > 2 && h.text.length < 200);

  const paragraphs = unique(
    $('p')
      .toArray()
      .map((el) => clean($(el).text()))
      // Sous 40 caractères c'est presque toujours une mention légale, une
      // date ou un fragment d'interface — pas du contenu.
      .filter((text) => text.length >= 40 && text.length <= 1200),
  );

  const listItems = unique(
    $('li')
      .toArray()
      .map((el) => clean($(el).text()))
      .filter((text) => text.length >= 3 && text.length <= 120 && !NOISE.test(text)),
  ).slice(0, 60);

  const images = $('img')
    .toArray()
    .map((el) => ({
      src: absolute($(el).attr('src') ?? $(el).attr('data-src') ?? ''),
      alt: clean($(el).attr('alt') ?? ''),
    }))
    .filter((img) => {
      if (!img.src || img.src.startsWith('data:')) return false;
      // Les pictogrammes et pixels de suivi n'ont aucun intérêt éditorial.
      return !/(sprite|icon|logo-?\d*\.svg|pixel|tracking|1x1)/i.test(img.src);
    })
    .slice(0, 30);

  const navLabels = unique(
    $('nav a, header a')
      .toArray()
      .map((el) => clean($(el).text()))
      .filter((text) => text.length > 1 && text.length < 40 && !NOISE.test(text)),
  ).slice(0, 20);

  const ctas = unique(
    $('a[class*="btn"], a[class*="button"], button, .cta a')
      .toArray()
      .map((el) => clean($(el).text()))
      .filter((text) => text.length > 2 && text.length < 40 && !NOISE.test(text)),
  ).slice(0, 15);

  const bodyText = clean($('body').text());

  const emails = unique(
    [
      ...(bodyText.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) ?? []),
      ...$('a[href^="mailto:"]')
        .toArray()
        .map((el) => ($(el).attr('href') ?? '').replace('mailto:', '')),
    ].map((e) => e.split('?')[0]),
  ).slice(0, 5);

  const phones = unique(
    [
      ...(bodyText.match(/(?:\+41|0)\s?[1-9](?:[\s.\-/]?\d{2}){4}/g) ?? []),
      ...$('a[href^="tel:"]')
        .toArray()
        .map((el) => ($(el).attr('href') ?? '').replace('tel:', '')),
    ],
  ).slice(0, 5);

  const socials = unique(
    $('a[href]')
      .toArray()
      .map((el) => $(el).attr('href') ?? '')
      .filter((href) => /facebook|instagram|linkedin|youtube|tiktok|x\.com|twitter/i.test(href))
      .map((href) => absolute(href)),
  ).slice(0, 8);

  // L'adresse se trouve presque toujours en pied de page, dans un bloc court.
  const footerText = clean($('footer').text());
  const address = footerText.match(
    /\d{1,4}[,\s][^,\n]{3,60}[,\s]\d{4}\s+[A-ZÀ-Ü][\wÀ-ü-]+/,
  )?.[0];

  return {
    url: pageUrl,
    domain: base.hostname.replace(/^www\./, ''),
    title: clean($('title').first().text()),
    description: clean(
      $('meta[name="description"]').attr('content') ??
        $('meta[property="og:description"]').attr('content') ??
        '',
    ),
    lang: ($('html').attr('lang') ?? 'fr').slice(0, 5),
    headings: headings.slice(0, 40),
    paragraphs: paragraphs.slice(0, 30),
    listItems,
    images,
    navLabels,
    ctas,
    emails,
    phones,
    address,
    socials,
  };
}

/**
 * Réduit l'extraction à un condensé textuel destiné au modèle.
 *
 * Envoyer la structure brute coûterait cher en jetons pour rien : le modèle
 * n'a besoin que de la matière, pas du détail de la page.
 */
export function toPromptDigest(site: ExtractedSite): string {
  const lines = [
    `Domaine : ${site.domain}`,
    `Titre : ${site.title}`,
    site.description && `Description : ${site.description}`,
    site.navLabels.length && `Navigation : ${site.navLabels.join(' · ')}`,
    '',
    'Titres de la page :',
    ...site.headings.map((h) => `  ${'#'.repeat(h.level)} ${h.text}`),
    '',
    'Paragraphes :',
    ...site.paragraphs.map((p) => `  - ${p}`),
    site.listItems.length ? '\nÉléments de liste :' : '',
    ...site.listItems.map((i) => `  - ${i}`),
    site.ctas.length ? `\nBoutons : ${site.ctas.join(' · ')}` : '',
    site.emails.length ? `E-mail : ${site.emails.join(', ')}` : '',
    site.phones.length ? `Téléphone : ${site.phones.join(', ')}` : '',
    site.address ? `Adresse : ${site.address}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}
