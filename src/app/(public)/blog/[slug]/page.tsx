// ISR : page régénérée au plus toutes les 10 min (Core Web Vitals / budget crawl)
// au lieu d'un SSR complet à chaque hit. La publication admin reste visible
// rapidement via la revalidation périodique.
export const revalidate = 600;
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { posts as staticPosts } from '../../../../data/posts';
import { supabase } from '../../../../services/supabase';
import { getSettingsServer } from '../../../../services/settingsServer';
import { proxyUrl } from '../../../../utils/media';
import { NewsletterBanner } from '../../../../components/NewsletterBanner';
import { ShareButtons, TableOfContents, TocEntry } from '../../../../components/blog/BlogClientComponents';
import { isModuleEnabledServer } from '../../../../config/modules';

/* ── Regex-based server helpers to avoid browser DOMParser crashes ── */

// Strip des balises HTML + décodage des entités (l'éditeur stocke les espaces
// entre les mots sous forme de &nbsp;, qui ne sont pas des espaces pour \s —
// sans ce décodage, un paragraphe entier est compté comme un seul "mot").
function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function estimateWordCount(html: string): number {
  if (!html) return 0;
  return stripHtmlToText(html).trim().split(/\s+/).filter(Boolean).length;
}

function extractToc(html: string): TocEntry[] {
  if (!html) return [];
  const h2h3Regex = /<(h[23])(?:\s[^>]*)*>(.*?)<\/h[23]>/gi;
  const entries: TocEntry[] = [];
  let match;
  let index = 0;
  while ((match = h2h3Regex.exec(html)) !== null) {
    const level = parseInt(match[1][1]);
    const text = match[2]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    entries.push({
      id: `toc-${index++}`,
      text: text,
      level: level,
    });
  }
  return entries;
}

function injectHeadingIds(html: string): string {
  if (!html) return '';
  let index = 0;
  return html.replace(/<(h[23])(\s|>)/gi, (_, tag, rest) => {
    return `<${tag} id="toc-${index++}"${rest}`;
  });
}

// Ajoute loading="lazy" + decoding="async" aux <img> du corps d'article qui ne
// les ont pas, pour différer le chargement des images hors-écran (LCP / budget
// réseau). Les images du contenu passent par dangerouslySetInnerHTML et ne
// peuvent donc pas utiliser next/image.
function addLazyLoadingToImages(html: string): string {
  if (!html) return '';
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs: string) => {
    let a = attrs;
    if (!/\bloading\s*=/i.test(a)) a += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(a)) a += ' decoding="async"';
    return `<img${a}>`;
  });
}

// Retire les propriétés CSS inline qui cassent les mots ou justifient le texte,
// et supprime les caractères/balises invisibles qui forcent des coupures
// (&shy;, &#173;, ­, <wbr>, &#8203;, &ZeroWidthSpace;).
function sanitizeInlineStyles(html: string): string {
  if (!html) return '';
  // 1. Supprimer les balises <wbr> (word-break opportunity)
  let result = html.replace(/<wbr\s*\/?>/gi, '');
  // 2. Convertir les espaces insécables (&nbsp;) entre mots en espaces normaux
  // Le HTML stocké par l'éditeur remplace tous les espaces par &nbsp;, ce qui
  // empêche le navigateur de couper les lignes et force la coupure des mots.
  result = result.replace(/&nbsp;/g, ' ');
  // 3. Supprimer les tirets conditionnels (soft hyphen) sous toutes leurs formes
  result = result
    .replace(/&shy;/gi, '')
    .replace(/&#173;/gi, '')
    .replace(/&#xad;/gi, '')
    .replace(/­/g, '');
  // 4. Supprimer les espaces de largeur nulle
  result = result
    .replace(/&#8203;/gi, '')
    .replace(/&ZeroWidthSpace;/gi, '')
    .replace(/​/g, '');
  // 4. Nettoyer les propriétés CSS inline problématiques
  result = result.replace(/\sstyle="([^"]*)"/gi, (match, styles: string) => {
    const cleaned = styles
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        const prop = s.split(':')[0]?.trim().toLowerCase() ?? '';
        return !['word-break', 'word-wrap', 'overflow-wrap', 'hyphens', 'text-align', '-webkit-hyphens', '-moz-hyphens'].includes(prop);
      })
      .join('; ');
    return cleaned ? ` style="${cleaned}"` : '';
  });
  return result;
}

function extractFaqItems(html: string): Array<{ question: string; answer: string }> {
  if (!html) return [];
  // Capte les H2 ET H3 formulés en question (la section "Questions fréquentes"
  // du gabarit utilise des H3) → alimente le FAQPage JSON-LD.
  // Le motif "tempered" (?:(?!<\/?h[1-6]).)*? empêche la question de franchir un
  // autre titre : sur du HTML sans retours ligne (sortie Quill), un simple .*?\?
  // happerait le titre suivant et fusionnerait deux sections.
  const headingRegex = /<(h[23])(?:\s[^>]*)*>((?:(?!<\/?h[1-6]).)*?\?)<\/h[23]>/gi;
  const items: { question: string; answer: string }[] = [];
  const seen = new Set<string>();
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const question = stripHtmlToText(match[2]).trim();
    if (seen.has(question)) continue;
    seen.add(question);
    const startIndex = match.index + match[0].length;
    const nextHeadingIndex = html.slice(startIndex).search(/<h[1-6]/i);
    const sectionHtml = nextHeadingIndex !== -1
      ? html.slice(startIndex, startIndex + nextHeadingIndex)
      : html.slice(startIndex);

    const pMatch = /<p(?:\s[^>]*)*>(.*?)<\/p>/i.exec(sectionHtml);
    if (pMatch) {
      const answer = stripHtmlToText(pMatch[1]).trim();
      if (answer) {
        items.push({ question, answer });
      }
    }
  }
  return items;
}

async function getAuthorSettings() {
  const s = await getSettingsServer(['author_bio', 'author_link']);
  return { bio: s.author_bio, link: s.author_link };
}

async function getPost(slug: string) {
  // 1. Try Supabase first
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .single();

    if (data && !error) {
      return {
        id: data.id,
        title: data.title,
        meta_title: data.meta_title || null,
        slug: data.slug,
        excerpt: data.meta_description || "Découvrez cet article de blog...",
        keywords: data.meta_keywords || null,
        content: data.content,
        date: new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        dateIso: data.created_at,
        updatedAtIso: data.updated_at || data.created_at,
        author: "Matthieu Le Tousse",
        category: data.category || "Relation toxique",
        image: proxyUrl(data.cover_image) || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000&auto=format&fit=crop",
        // Temps de lecture calculé (~200 mots/min) au lieu d'une valeur figée :
        // signal de profondeur de contenu pour le SEO/GEO (cf. timeRequired JSON-LD).
        readTime: `${Math.max(1, Math.ceil(estimateWordCount(data.content || '') / 200))} min`
      };
    }
  } catch (err) {
    console.error('Error fetching blog post from Supabase:', err);
  }

  // 2. Fallback to static data
  const staticPost = staticPosts.find(p => p.slug === slug);
  if (staticPost) {
    return {
      ...staticPost,
      meta_title: null,
      dateIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
      image: proxyUrl(staticPost.image),
      keywords: null
    };
  }
  return null;
}

export async function generateStaticParams() {
  try {
    const { data: articles } = await supabase
      .from('articles')
      .select('slug')
      .eq('published', true);

    const supabaseParams = (articles || []).map((art) => ({
      slug: art.slug,
    }));

    const staticParams = staticPosts.map((post) => ({
      slug: post.slug,
    }));

    return [...supabaseParams, ...staticParams];
  } catch (err) {
    console.error('Error generating static params:', err);
    return staticPosts.map((post) => ({
      slug: post.slug,
    }));
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return {
      title: "Article non trouvé | Au-delà des Chaînes",
    };
  }

  const title = post.meta_title || `${post.title} | Au-delà des Chaînes`;

  return {
    title: title,
    description: post.excerpt,
    keywords: post.keywords || `${post.category}, relation toxique, emprise psychologique, Matthieu Le Tousse`,
    alternates: {
      canonical: `https://audeladeschaines.com/blog/${post.slug}`,
    },
    openGraph: {
      title: title,
      description: post.excerpt,
      url: `https://audeladeschaines.com/blog/${post.slug}`,
      type: "article",
      images: [
        {
          url: post.image,
          width: 1200,
          height: 630,
          alt: `${title} — Au-delà des Chaînes`,
        }
      ],
      publishedTime: post.dateIso,
      modifiedTime: post.updatedAtIso,
      section: post.category,
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isModuleEnabledServer('blog'))) {
    notFound();
  }

  const { slug } = await params;
  const [post, author, decodeurEnabled] = await Promise.all([getPost(slug), getAuthorSettings(), isModuleEnabledServer('decodeur')]);

  if (!post) {
    notFound();
  }

  const toc = extractToc(post.content || '');
  const sanitized = addLazyLoadingToImages(sanitizeInlineStyles(post.content || ''));
  const contentWithIds = injectHeadingIds(sanitized);
  const faqItems = extractFaqItems(post.content || '');
  const wordCount = estimateWordCount(post.content || '');
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "image": post.image,
    "url": `https://audeladeschaines.com/blog/${post.slug}`,
    "datePublished": post.dateIso,
    "dateModified": post.updatedAtIso,
    "wordCount": wordCount,
    "timeRequired": `PT${readingMinutes}M`,
    "author": {
      "@type": "Person",
      "@id": "https://audeladeschaines.com/#matthieu-le-tousse",
      "name": "Matthieu Le Tousse"
    },
    "publisher": {
      "@type": "Organization",
      "@id": "https://audeladeschaines.com/#organization",
      "name": "Au-delà des Chaînes",
      "url": "https://audeladeschaines.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1780852325790-logo-au-dela-des-chaines--1-.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://audeladeschaines.com/blog/${post.slug}`
    },
    "isPartOf": { "@type": "Blog", "@id": "https://audeladeschaines.com/blog" },
    "articleSection": post.category,
    "inLanguage": "fr-CH"
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqItems.length >= 2 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          "mainEntity": faqItems.map(({ question, answer }) => ({
            "@type": "Question", "name": question,
            "acceptedAnswer": { "@type": "Answer", "text": answer }
          }))
        }) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://audeladeschaines.com/" },
          { "@type": "ListItem", "position": 2, "name": "Blog",    "item": "https://audeladeschaines.com/blog" },
          { "@type": "ListItem", "position": 3, "name": post.title, "item": `https://audeladeschaines.com/blog/${post.slug}` }
        ]
      }) }} />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden bg-white">
        {/* Fond image flouté très subtil */}
        <div className="absolute inset-0 opacity-[0.04]">
          <img src={post.image} alt="" className="w-full h-full object-cover" aria-hidden loading="lazy" decoding="async" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-stone-400 hover:text-sage transition-colors text-xs font-bold uppercase tracking-widest mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Blog
          </Link>

          {/* Méta */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-white bg-sage px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              <Calendar className="w-3.5 h-3.5" /> {post.date}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              <Clock className="w-3.5 h-3.5" /> {post.readTime} de lecture
            </span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-stone-900 leading-[1.1] tracking-tight mb-6">
            {post.title}
          </h1>

        </div>
      </section>

      {/* ── Image couverture ──────────────────────────────────── */}
      <section className="px-6 pb-0">
        <div className="max-w-5xl mx-auto">
          <div className="aspect-[16/7] rounded-2xl overflow-hidden shadow-lg">
            {/* Image LCP de l'article : priorité haute de chargement.
                Le conteneur aspect-[16/7] réserve déjà l'espace (pas de CLS). */}
            <img
              src={post.image}
              alt={post.title}
              width={1200}
              height={525}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Contenu + Sidebar ────────────────────────────────── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-12 xl:gap-20 items-start">

            <article className="min-w-0 w-full overflow-x-hidden">
              <div
                lang="fr"
                className="blog-article-body prose prose-stone prose-lg max-w-none
                  prose-headings:font-serif prose-headings:font-bold prose-headings:text-stone-900
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-8
                  prose-p:leading-[1.85] prose-p:text-stone-700
                  prose-blockquote:not-italic prose-blockquote:font-serif prose-blockquote:text-lg
                  prose-blockquote:text-stone-700 prose-blockquote:border-l-4 prose-blockquote:border-sage
                  prose-blockquote:bg-sage/5 prose-blockquote:px-6 prose-blockquote:py-4
                  prose-blockquote:rounded-r-xl prose-blockquote:my-8
                  prose-strong:text-stone-900 prose-strong:font-semibold
                  prose-a:text-sage prose-a:no-underline hover:prose-a:underline
                  prose-img:rounded-xl prose-img:shadow-md prose-img:max-w-full
                  prose-pre:overflow-x-auto [&_*]:max-w-full"
                dangerouslySetInnerHTML={{ __html: contentWithIds }}
              />

              {/* Share */}
              <div className="mt-16 pt-10 border-t border-stone-100 flex justify-center">
                <ShareButtons title={post.title} slug={post.slug} />
              </div>
            </article>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-28 space-y-5">
              {toc.length > 0 && <TableOfContents entries={toc} />}

              {/* Maillage interne : Décodeur (capture) + Arsenal (conversion) —
                  généré automatiquement, présent sur tout article. */}
              <div className="bg-stone-900 text-white rounded-2xl p-5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Aller plus loin</p>
                {decodeurEnabled && (
                  <Link
                    href="/decodeur"
                    className="block bg-sage/15 hover:bg-sage/25 border border-sage/30 rounded-xl p-4 transition-colors"
                  >
                    <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-sage bg-sage/15 rounded-full px-2 py-0.5 mb-2">Gratuit</span>
                    <p className="font-serif text-base font-bold text-white mb-1">Le Décodeur</p>
                    <p className="text-xs text-stone-300 leading-relaxed">Identifiez gratuitement, en 2 minutes, le profil auquel vous faites face.</p>
                  </Link>
                )}
                <Link
                  href="/arsenal-tactique"
                  className="block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors"
                >
                  <p className="font-serif text-sm font-bold text-white mb-1">L'Arsenal Tactique</p>
                  <p className="text-xs text-stone-400 leading-relaxed">L'accompagnement complet pour sortir de l'emprise.</p>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Auteur ─────────────────────────────────────────────── */}
      <section className="py-12 px-6 border-t border-stone-100 bg-stone-50">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <img
              src="https://pub-06788dc2f8884cb1bba449c00813d758.r2.dev/1782229256675-Matthieu-Le-Tousse.webp"
              alt="Matthieu Le Tousse"
              className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md shrink-0"
              loading="lazy"
            />
            <div className="text-center sm:text-left space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sage">À propos de l'auteur</p>
              <p className="font-serif text-lg font-bold text-stone-900">Matthieu Le Tousse</p>
              <p className="text-stone-500 text-sm leading-relaxed">{author.bio}</p>
              <Link
                href={author.link}
                className="inline-flex items-center gap-1.5 text-sm text-sage font-semibold hover:gap-3 transition-all"
              >
                En savoir plus <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Newsletter ─────────────────────────────────────────── */}
      <NewsletterBanner />
    </div>
  );
}
