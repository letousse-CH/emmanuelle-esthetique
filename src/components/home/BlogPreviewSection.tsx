"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { proxyUrl } from '../../utils/media';
import { fetchRecentArticles } from '../../services/articles';
import { posts as staticPosts } from '../../data/posts';
import { fadeUp, stagger, AnimatedHeading } from './shared';

interface DisplayPost {
  id: string;
  title: string;
  slug: string;
  image: string;
  category: string;
  date: string;
}

export default function BlogPreviewSection() {
  const [posts, setPosts] = useState<DisplayPost[] | null>(null);

  useEffect(() => {
    fetchRecentArticles(3)
      .then(data => {
        if (data.length > 0) {
          setPosts(data.map(a => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
            image: proxyUrl(a.cover_image || '') || 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1000&auto=format&fit=crop',
            category: a.category || 'Spiritualité',
            date: new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          })));
        } else {
          setPosts(staticPosts.slice(0, 3).map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            image: p.image,
            category: p.category,
            date: p.date,
          })));
        }
      })
      .catch(() => {
        setPosts(staticPosts.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          image: p.image,
          category: p.category,
          date: p.date,
        })));
      });
  }, []);

  return (
    <section className="py-24 bg-white px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            Partage de Conscience
          </motion.span>
          <AnimatedHeading className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-6">
            Derniers Articles
          </AnimatedHeading>
          <motion.div variants={fadeUp} className="w-20 h-0.5 bg-wood mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {posts === null && [...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-stone-50 rounded-[2rem] overflow-hidden border border-stone-100">
              <div className="aspect-video bg-stone-200" />
              <div className="p-8 space-y-4">
                <div className="h-3 bg-stone-200 rounded w-24" />
                <div className="h-5 bg-stone-200 rounded w-full" />
                <div className="h-5 bg-stone-200 rounded w-4/5" />
                <div className="h-3 bg-stone-200 rounded w-20 mt-2" />
              </div>
            </div>
          ))}
          {posts !== null && posts.map((post, i) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              whileHover={{ y: -6 }}
              className="bg-stone-50 rounded-[2rem] overflow-hidden border border-stone-100 hover:shadow-xl transition-all duration-500 group"
            >
              <a href={`/blog/${post.slug}`} className="block">
                <div className="aspect-video overflow-hidden relative">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" decoding="async" width={600} height={338} />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm text-stone-900 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
                      {post.category}
                    </span>
                  </div>
                </div>
                <div className="p-8 space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{post.date}</p>
                  <h3 className="font-serif text-xl font-bold text-stone-900 group-hover:text-sage transition-colors line-clamp-2 leading-tight">
                    {post.title}
                  </h3>
                  <div className="pt-2 flex items-center gap-2 text-wood font-bold uppercase tracking-widest text-[10px] group-hover:gap-4 transition-all duration-300">
                    Lire la suite <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </a>
            </motion.article>
          ))}
        </div>

        <div className="mt-16 text-center">
          <a href="/blog" className="inline-flex items-center gap-3 text-stone-900 font-bold uppercase tracking-widest text-sm hover:text-sage transition-colors border-b-2 border-stone-100 pb-1 hover:border-sage">
            Voir tous les articles <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
