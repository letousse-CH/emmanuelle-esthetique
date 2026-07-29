export const revalidate = 60;
import React from 'react';
import { notFound } from 'next/navigation';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { fetchPublishedArticles } from '../../../services/articles';
import { proxyUrl } from '../../../utils/media';
import { NewsletterBanner } from '../../../components/NewsletterBanner';
import { SITE_CONFIG } from '../../../config/site';
import { isModuleEnabledServer } from '../../../config/modules';

export const metadata = {
  title: `Blog | ${SITE_CONFIG.name} - ${SITE_CONFIG.owner}`,
  description: "Conseils de soin du visage, rituels de beauté naturelle, Gua Sha et bien-être au quotidien, par Emmanuelle Esthétique à Palézieux.",
  keywords: "conseils soin du visage, routine peau naturelle, gua sha, head spa, cosmétique naturelle, bien-être Palézieux",
  alternates: {
    canonical: `${SITE_CONFIG.url}/blog`,
  },
  openGraph: {
    title: `Blog — Beauté & bien-être | ${SITE_CONFIG.name}`,
    description: "Conseils de soin, rituels de beauté naturelle et gestes bien-être à reproduire chez soi.",
    url: `${SITE_CONFIG.url}/blog`,
    images: [
      {
        url: SITE_CONFIG.seoDefaults.ogImage,
        alt: `Blog ${SITE_CONFIG.name}`,
      }
    ]
  }
};

export default async function BlogPage() {
  if (!(await isModuleEnabledServer('blog'))) {
    notFound();
  }

  let articles: any[] = [];
  try {
    articles = await fetchPublishedArticles();
  } catch (err) {
    console.error('Error fetching articles on server:', err);
  }

  const displayPosts = articles.map(a => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.meta_description || "Découvrez cet article de blog...",
    date: new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    author: SITE_CONFIG.owner,
    category: a.category || "Beauté & bien-être",
    image: proxyUrl(a.cover_image) || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000&auto=format&fit=crop",
    readTime: "5 min"
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `Blog ${SITE_CONFIG.name}`,
    "description": "Conseils de soin, rituels de beauté naturelle et gestes bien-être à reproduire chez soi.",
    "url": `${SITE_CONFIG.url}/blog`,
    "inLanguage": "fr-CH",
    "author": { "@type": "Person", "@id": `${SITE_CONFIG.url}/#owner`, "name": SITE_CONFIG.owner },
    "publisher": { "@type": "Organization", "name": SITE_CONFIG.name, "url": SITE_CONFIG.url },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": `${SITE_CONFIG.url}/` },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${SITE_CONFIG.url}/blog` }
      ]
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-stone-50 animate-fadein">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <section className="py-24 px-6 bg-paper border-b border-stone-100">
        <div className="max-w-4xl mx-auto text-center">
          <div>
            <span className="text-sage font-bold tracking-[0.3em] uppercase text-xs mb-6 block">Décoder les Mécanismes</span>
            <h1 className="font-serif text-5xl md:text-7xl font-bold mb-8 text-stone-900 leading-tight">Le Blog</h1>
            <p className="text-xl text-stone-600 font-light leading-relaxed max-w-2xl mx-auto italic">
              "Comprendre les codes de la manipulation pour cesser de douter de votre réalité et commencer à vous reconstruire."
            </p>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            {displayPosts.map((post) => (
              <article 
                key={post.id}
                className="bg-white rounded-[2.5rem] overflow-hidden border border-stone-200 shadow-sm hover:shadow-2xl transition-transform duration-500 hover:-translate-y-2 group"
              >
                <Link href={`/blog/${post.slug}`} className="block">
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <img
                      src={post.image}
                      alt={post.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute top-6 left-6">
                      <span className="bg-white/90 backdrop-blur-md text-stone-900 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-6">
                    <div className="flex items-center gap-6 text-xs text-stone-400 font-medium uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-sage" />
                        <span>{post.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sage" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-stone-900 leading-tight group-hover:text-sage transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-stone-500 font-light leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="pt-4 flex items-center gap-3 text-wood font-bold uppercase tracking-widest text-xs group-hover:gap-5 transition-all">
                      Lire l'article <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter / CTA */}
      <NewsletterBanner />
    </div>
  );
}
