const FR_STOP = new Set([
  'le','la','les','de','du','des','un','une','en','et','ou','au','aux',
  'par','sur','dans','avec','pour','vers','ses','mes','tes','nos','vos',
  'mon','ton','son','ma','ta','sa','ce','se','ne','pas','mais','car','donc',
  'que','qui','dont','où','si','comme','tout','plus','très','aussi','bien',
  'même','déjà','encore','votre','notre','leur','leurs','cette','cela','ça',
  'être','avoir','faire','aller','venir','voir','savoir','vouloir','pouvoir',
  'comment','quand','pourquoi','quoi','après','avant','entre','depuis',
]);

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ');

function normalizeWithMap(text: string): { norm: string; indexMap: number[] } {
  let norm = '';
  const indexMap: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const clean = char.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mapped = /^[a-z0-9]$/.test(clean) ? clean : ' ';
    norm += mapped;
    indexMap.push(i);
  }
  indexMap.push(text.length);
  return { norm, indexMap };
}

export function titleToSearchPhrases(title: string): string[] {
  const words = normalize(title.split(/[:|—–]/)[0])
    .split(/\s+/)
    .filter(w => w.length >= 4 && !FR_STOP.has(w));
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 4 && words[i + 1].length >= 4)
      phrases.push(`${words[i]} ${words[i + 1]}`);
  }
  phrases.push(...words.filter(w => w.length >= 6));
  return phrases;
}

/**
 * Étend un match de mot-clé à une expression naturelle.
 * Remonte jusqu'à 6 mots en arrière et 2 mots en avant,
 * sans franchir la ponctuation (. ! ? ; , :).
 */
function expandToPhrase(
  text: string,
  matchStart: number,
  matchEnd: number
): { start: number; end: number } {
  const BOUNDARY = /[.!?;,:\n]/;

  let start = matchStart;
  let spacesBack = 0;
  while (start > 0) {
    if (BOUNDARY.test(text[start - 1])) break;
    if (text[start - 1] === ' ') {
      spacesBack++;
      if (spacesBack > 6) break;
    }
    start--;
  }
  while (start < matchStart && text[start] === ' ') start++;

  let end = matchEnd;
  let spacesForward = 0;
  while (end < text.length) {
    if (BOUNDARY.test(text[end])) break;
    if (text[end] === ' ') {
      spacesForward++;
      if (spacesForward > 2) break;
    }
    end++;
  }
  while (end > matchEnd && text[end - 1] === ' ') end--;

  return { start, end };
}

const SKIP_TAGS = new Set(['A','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','SCRIPT','STYLE']);

function getTextNodes(doc: Document): Text[] {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let el: Element | null = node.parentElement;
      while (el) {
        if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        el = el.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function createLink(doc: Document, href: string, text: string): HTMLAnchorElement {
  const a = doc.createElement('a');
  a.setAttribute('href', href);
  a.setAttribute('class', 'text-sage underline underline-offset-2 hover:text-stone-900 transition-colors');
  a.setAttribute('style', 'font-weight:bold');
  a.textContent = text;
  return a;
}

function injectAt(
  textNode: Text,
  doc: Document,
  matchStart: number,
  matchEnd: number,
  href: string,
  expand: boolean
): void {
  const original = textNode.textContent || '';
  if (matchStart < 0 || matchEnd > original.length) return;

  const { start, end } = expand
    ? expandToPhrase(original, matchStart, matchEnd)
    : { start: matchStart, end: matchEnd };

  const frag = doc.createDocumentFragment();
  if (start > 0) frag.appendChild(doc.createTextNode(original.slice(0, start)));
  frag.appendChild(createLink(doc, href, original.slice(start, end)));
  if (end < original.length) frag.appendChild(doc.createTextNode(original.slice(end)));
  if (textNode.parentNode) {
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

/** Phrases fixes vers les pages clés du site. */
const FIXED_PAGE_LINKS: Array<{ href: string; phrases: string[] }> = [
  {
    href: '/seance-individuelle',
    phrases: [
      'séance individuelle', 'une séance', 'prendre rendez-vous',
      'accompagnement individuel', 'première séance', 'séance de travail',
      'séance d accompagnement',
    ],
  },
  {
    href: '/about',
    phrases: [
      'matthieu le tousse', 'semeur d eveil', 'ma démarche',
      'mon approche', 'ma pratique', 'ma vision',
    ],
  },
];

function stripInternalLinks(doc: Document): void {
  doc.querySelectorAll('a[href^="/blog/"], a[href^="/seance-individuelle"], a[href^="/about"]').forEach(a => {
    const parent = a.parentNode;
    if (!parent) return;
    while (a.firstChild) parent.insertBefore(a.firstChild, a);
    parent.removeChild(a);
  });
}

export function injectInternalLinks(
  html: string,
  articles: Array<{ title: string; slug: string }>,
  currentSlug: string
): string {
  if (typeof window === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  stripInternalLinks(doc);

  // ── Phase 1 : article → article (max 5 liens, expression étendue) ───────
  const candidates: Array<{ phrase: string; slug: string }> = [];
  for (const art of articles) {
    if (art.slug === currentSlug) continue;
    for (const p of titleToSearchPhrases(art.title).slice(0, 3))
      candidates.push({ phrase: p, slug: art.slug });
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);

  const linkedSlugs = new Set<string>();
  let articleLinks = 0;

  for (const textNode of getTextNodes(doc)) {
    if (articleLinks >= 5) break;
    const original = textNode.textContent || '';
    const { norm, indexMap } = normalizeWithMap(original);

    for (const { phrase, slug } of candidates) {
      if (linkedSlugs.has(slug) || articleLinks >= 5) continue;
      const idx = norm.indexOf(phrase);
      if (idx === -1) continue;

      const origStart = indexMap[idx];
      const origEnd = indexMap[idx + phrase.length];
      injectAt(textNode, doc, origStart, origEnd, `/blog/${slug}`, true);
      linkedSlugs.add(slug);
      articleLinks++;
      break;
    }
  }

  // ── Phase 1b : fallback article si aucun lien naturel trouvé ────────────
  if (articleLinks === 0) {
    const fallback = articles.find(a => a.slug !== currentSlug);
    if (fallback) {
      const a = doc.createElement('a');
      a.setAttribute('href', `/blog/${fallback.slug}`);
      a.setAttribute('class', 'text-sage underline underline-offset-2 hover:text-stone-900 transition-colors');
      a.setAttribute('style', 'font-weight:bold');
      a.textContent = fallback.title;
      const p = doc.createElement('p');
      p.appendChild(doc.createTextNode('À lire aussi : '));
      p.appendChild(a);
      doc.body.appendChild(p);
    }
  }

  // ── Phase 2 : liens fixes (séance individuelle, à propos) ───────────────
  const linkedPages = new Set<string>();

  for (const { href, phrases } of FIXED_PAGE_LINKS) {
    for (const textNode of getTextNodes(doc)) {
      if (linkedPages.has(href)) break;
      const original = textNode.textContent || '';
      const { norm, indexMap } = normalizeWithMap(original);

      for (const phrase of phrases) {
        const idx = norm.indexOf(normalize(phrase));
        if (idx === -1) continue;
        const origStart = indexMap[idx];
        const origEnd = indexMap[idx + phrase.length];
        injectAt(textNode, doc, origStart, origEnd, href, false);
        linkedPages.add(href);
        break;
      }
    }
  }

  // ── Phase 3 : CTA de secours si les liens fixes n'ont pas été trouvés ───
  const missingLinks: { href: string; label: string }[] = [];
  if (!linkedPages.has('/seance-individuelle'))
    missingLinks.push({ href: '/seance-individuelle', label: 'un accompagnement individuel' });
  if (!linkedPages.has('/about'))
    missingLinks.push({ href: '/about', label: 'ma démarche' });

  if (missingLinks.length > 0) {
    const parts = missingLinks.map(({ href, label }) => {
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      a.setAttribute('class', 'text-sage underline underline-offset-2 hover:text-stone-900 transition-colors');
      a.setAttribute('style', 'font-weight:bold');
      a.textContent = label;
      return a.outerHTML;
    });
    const sentence = parts.length === 1
      ? `Si ce texte résonne en toi, peut-être est-il temps d'explorer ${parts[0]}.`
      : `Si ce texte résonne en toi, peut-être est-il temps d'explorer ${parts[0]} ou de découvrir ${parts[1]}.`;
    const p = doc.createElement('p');
    p.innerHTML = sentence;
    doc.body.appendChild(p);
  }

  return doc.body.innerHTML;
}
