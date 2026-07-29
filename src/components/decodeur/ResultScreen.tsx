"use client";

import { useState } from 'react';
import { Share2, ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { trackEvent } from '../../utils/analytics';

type Profile = {
  id: string;
  tag: string;
  zone: string;
  title: string;
  tagline: string;
  body: string[];
  ctaType: 'soft' | 'strong';
  ctaLabel: string;
  ctaHref: string;
};

const ZONE_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  vert:     { bar: '#7DBB8C', text: 'text-[#5A9A68]', bg: 'bg-[#7DBB8C]/10' },
  attention:{ bar: '#E8B94A', text: 'text-[#B8860B]', bg: 'bg-[#E8B94A]/10' },
  alerte:   { bar: '#EC3875', text: 'text-sage',       bg: 'bg-sage/10' },
  danger:   { bar: '#23112E', text: 'text-stone-deep', bg: 'bg-stone-deep/10' },
};

export default function ResultScreen({
  profile,
  score,
  maxScore,
  shareTemplate,
}: {
  profile: Profile;
  score: number;
  maxScore: number;
  shareTemplate: string;
}) {
  const [shared, setShared] = useState(false);
  const percent = Math.round((score / maxScore) * 100);
  const colors = ZONE_COLORS[profile.zone] || ZONE_COLORS.attention;

  const shareText = shareTemplate
    .replace('{percent}', String(percent))
    .replace('{profileTitle}', profile.title);

  const handleShare = async () => {
    trackEvent('decodeur_share_click', { profile: profile.tag });
    const url = typeof window !== 'undefined' ? window.location.origin + '/decodeur' : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: shareText, url });
        return;
      } catch {
        // annulé ou non supporté, on retombe sur le copier-coller
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    }
  };

  const handleCtaClick = () => {
    trackEvent('decodeur_cta_click', { profile: profile.tag, cta_type: profile.ctaType });
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-16 md:py-24">
      <p className="text-sage font-bold tracking-[0.3em] uppercase text-xs mb-4 text-center">Votre résultat</p>

      <div className="mb-8">
        <div className="flex items-end justify-between mb-2">
          <span className="text-5xl font-bold text-stone-900">{score}<span className="text-xl text-stone-400">/{maxScore}</span></span>
          <span className={`text-sm font-bold uppercase tracking-widest ${colors.text}`}>{percent}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, backgroundColor: colors.bar }}
          />
        </div>
      </div>

      <div className={`rounded-3xl p-8 md:p-10 ${colors.bg} mb-8`}>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 mb-2">{profile.title}</h1>
        <p className={`text-lg font-medium mb-6 ${colors.text}`}>{profile.tagline}</p>
        <div className="space-y-4">
          {profile.body.map((paragraph, i) => (
            <p key={i} className="text-stone-600 leading-relaxed font-light">{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Link
          href={profile.ctaHref}
          onClick={handleCtaClick}
          className={`flex items-center justify-center gap-3 w-full py-4 rounded-full font-bold uppercase tracking-widest text-xs transition-colors ${
            profile.ctaType === 'strong'
              ? 'bg-sage text-white hover:bg-stone-deep'
              : 'border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white'
          }`}
        >
          {profile.ctaLabel} <ArrowRight className="w-4 h-4" />
        </Link>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 w-full py-3 text-stone-500 hover:text-stone-900 text-xs font-bold uppercase tracking-widest transition-colors"
        >
          <Share2 className="w-4 h-4" /> {shared ? 'Copié !' : 'Partager mon résultat'}
        </button>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 w-full py-2 text-stone-400 hover:text-stone-600 text-xs font-medium transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refaire le test
        </button>
      </div>
    </div>
  );
}
