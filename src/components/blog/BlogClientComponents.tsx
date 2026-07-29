"use client";

import React, { useState, useEffect } from 'react';
import { Share2, Link as LinkIcon, Check } from 'lucide-react';

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

import { SITE_CONFIG } from '../../config/site';

export function ShareButtons({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_CONFIG.url}/blog/${slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const twitterUrl  = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-bold uppercase tracking-widest text-stone-400">Partager</span>
      <div className="flex gap-3">
        {/* Facebook */}
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Partager sur Facebook"
          className="w-10 h-10 rounded-full border border-stone-100 flex items-center justify-center hover:bg-[#1877F2] hover:border-[#1877F2] hover:text-white transition-all text-stone-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
        </a>
        {/* LinkedIn */}
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Partager sur LinkedIn"
          className="w-10 h-10 rounded-full border border-stone-100 flex items-center justify-center hover:bg-[#0A66C2] hover:border-[#0A66C2] hover:text-white transition-all text-stone-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0h.003z"/>
          </svg>
        </a>
        {/* X / Twitter */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Partager sur X"
          className="w-10 h-10 rounded-full border border-stone-100 flex items-center justify-center hover:bg-stone-900 hover:border-stone-900 hover:text-white transition-all text-stone-700"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        {/* Copier le lien */}
        <button
          onClick={copyLink}
          title="Copier le lien"
          className="w-10 h-10 rounded-full border border-stone-100 flex items-center justify-center hover:bg-sage hover:border-sage hover:text-white transition-all text-stone-700"
        >
          {copied
            ? <Check className="w-4 h-4 text-green-500" />
            : <LinkIcon className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  );
}

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    entries.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-stone-50 border-b border-stone-100 px-5 py-3.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-stone-500">Table des matières</p>
      </div>
      <ol className="p-4 space-y-0.5">
        {entries.map(({ id, text, level }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={e => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`flex items-start gap-2.5 py-1.5 px-2 rounded-lg text-sm leading-snug transition-all break-words group ${
                level === 3 ? 'pl-5' : ''
              } ${
                active === id
                  ? 'bg-sage/8 text-sage font-semibold'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <span className={`mt-[5px] w-1 h-1 rounded-full shrink-0 transition-colors ${active === id ? 'bg-sage' : 'bg-stone-300 group-hover:bg-stone-400'}`} />
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
