"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface Review {
  author: string;
  photo: string;
  rating: number;
  text: string;
  time: string;
}

interface ReviewData {
  rating: number;
  total: number;
  reviews: Review[];
}

// État neutre affiché si l'API Google n'est pas configurée, échoue, ou ne
// renvoie aucun avis réel — aucun témoignage n'est jamais inventé. Dans ce
// cas, le composant ne rend rien (cf. `if (!displayed.total) return null`).
const EMPTY: ReviewData = { rating: 0, total: 0, reviews: [] };

function Stars({ count, size = 'sm' }: { count: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`${px} ${i <= count ? 'text-[#FBBC04]' : 'text-stone-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function Avatar({ photo, author }: { photo: string; author: string }) {
  if (photo) {
    return <img src={photo} alt={author} className="w-11 h-11 rounded-full object-cover" referrerPolicy="no-referrer" width={44} height={44} loading="lazy" decoding="async" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-sage/20 flex items-center justify-center text-sage font-bold text-lg">
      {author.charAt(0)}
    </div>
  );
}

export default function GoogleReviews({ bg = 'bg-stone-50', theme = 'light' }: { bg?: string; theme?: 'dark' | 'light' }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/google-reviews')
      .then((r) => r.json())
      .then((json) => {
        if (json.error || !json.reviews) {
          setData(EMPTY);
        } else {
          setData(json);
        }
      })
      .catch(() => setData(EMPTY))
      .finally(() => setLoading(false));
  }, []);

  const displayed = data ?? EMPTY;

  const themeClasses = theme === 'dark' ? {
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    textMuted: 'text-white/45',
    border: 'border-white/5',
    cardBg: 'bg-[#0A0A0A] border-white/5',
  } : {
    textPrimary: 'text-stone-900',
    textSecondary: 'text-stone-600',
    textMuted: 'text-stone-400',
    border: 'border-stone-100',
    cardBg: 'bg-white border-stone-100',
  };

  const bgStyle = bg.startsWith('#') || bg.startsWith('rgb') ? { backgroundColor: bg } : {};
  const bgClass = bg.startsWith('#') || bg.startsWith('rgb') ? '' : bg;

  if (loading) return (
    <section 
      style={bgStyle}
      className={`py-24 ${bgClass} px-6 transition-colors duration-500`}
      aria-hidden="true"
    >
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse text-center mb-16 space-y-4">
          <div className="h-3 bg-stone-200/50 rounded w-28 mx-auto" />
          <div className="h-8 bg-stone-200/50 rounded w-64 mx-auto" />
          <div className="h-1 bg-stone-200/50 rounded w-24 mx-auto mt-2" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`animate-pulse ${theme === 'dark' ? 'bg-[#0A0A0A] border border-white/5' : 'bg-white border border-stone-100'} rounded-2xl shadow-sm p-7 space-y-4`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-stone-200/50" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-stone-200/50 rounded w-24" />
                  <div className="h-3 bg-stone-200/50 rounded w-16" />
                </div>
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, j) => <div key={j} className="w-4 h-4 rounded bg-stone-200/50" />)}
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-stone-200/50 rounded w-full" />
                <div className="h-3 bg-stone-200/50 rounded w-full" />
                <div className="h-3 bg-stone-200/50 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // Aucun avis réel disponible : on n'affiche rien plutôt que d'inventer un
  // état de secours (ni note, ni témoignage fictif dans le HTML).
  if (!displayed.total || displayed.reviews.length === 0) return null;

  return (
    <section
      style={bgStyle}
      className={`py-24 ${bgClass} px-6 transition-colors duration-500`}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="text-sage font-bold tracking-[0.3em] uppercase text-xs mb-4 block">Témoignages</span>
          <h2 className={`font-serif text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>Ce qu'ils en disent</h2>
          <div className="w-24 h-1 bg-wood mx-auto mb-8" />

          {/* Score global */}
          <div className={`inline-flex items-center gap-4 ${themeClasses.cardBg} border shadow-sm px-8 py-4 rounded-2xl`}>
            <div className="flex flex-col items-center">
              <span className={`text-4xl font-bold ${themeClasses.textPrimary}`}>{displayed.rating.toFixed(1)}</span>
              <Stars count={Math.round(displayed.rating)} size="sm" />
              <span className={`text-xs ${themeClasses.textMuted} mt-1`}>{displayed.total} avis</span>
            </div>
            <div className={`h-12 w-px ${theme === 'dark' ? 'bg-white/10' : 'bg-stone-100'}`} />
            {/* Logo Google */}
            <svg className="w-20 h-auto" viewBox="0 0 272 92" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18S71.25 59.95 71.25 47.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.33 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
              <path fill="#FBBC05" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18S119.25 59.95 119.25 47.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.33 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
              <path fill="#4285F4" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"/>
              <path fill="#34A853" d="M225 3v65h-9.5V3h9.5z"/>
              <path fill="#EA4335" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/>
              <path fill="#4285F4" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.46.36 15.03 16.32-.43 35.34-.43c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.5-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.53.01z"/>
            </svg>
          </div>
        </motion.div>

        {/* Cartes avis */}
        <div className="grid md:grid-cols-3 gap-6">
          {displayed.reviews.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`${themeClasses.cardBg} border shadow-sm rounded-2xl p-7 flex flex-col gap-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center gap-3">
                <Avatar photo={review.photo} author={review.author} />
                <div>
                  <p className={`font-bold ${themeClasses.textPrimary} text-sm`}>{review.author}</p>
                  <p className={`text-xs ${themeClasses.textMuted}`}>{review.time}</p>
                </div>
              </div>
              <Stars count={review.rating} />
              <p className={`${themeClasses.textSecondary} text-sm leading-relaxed font-light line-clamp-5 flex-1`}>
                "{review.text}"
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA Google */}
        <div className="mt-12 text-center">
          <a
            href="https://www.google.com/search?q=matthieu-le-tousse"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-3 ${
              theme === 'dark'
                ? 'bg-stone-900 border-white/10 text-white/80 hover:border-sage hover:text-sage'
                : 'bg-white border-stone-200 text-stone-700 hover:border-sage hover:text-sage'
            } border shadow-sm px-8 py-4 rounded-full text-sm font-bold uppercase tracking-widest transition-all`}
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Voir tous les avis sur Google
          </a>
        </div>
      </div>
    </section>
  );
}

