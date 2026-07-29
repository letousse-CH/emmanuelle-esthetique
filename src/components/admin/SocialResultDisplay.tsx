"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Download, Instagram, Linkedin, Facebook } from 'lucide-react';
import {
  renderCarouselSlide, renderHookCard, downloadCanvas, downloadImageFromUrl,
  FORMAT_LABELS, BrandTokens, SocialCardFormat,
} from '../../utils/socialCards';
import type { SocialGenerationResult, SocialSlide, SocialVisual } from '../../utils/socialGeneration';

export type SocialPlatformId = 'instagram' | 'linkedin' | 'facebook';

interface Props {
  result: SocialGenerationResult;
  brand: BrandTokens;
  coverImage?: string;
  onRegenerate?: () => void;
  /** Plateforme affichée à l'ouverture. */
  initialPlatform?: SocialPlatformId;
}

/**
 * Texte du visuel : fourni par l'IA depuis l'ajout du champ `visual`, sinon
 * dérivé du post pour rester lisible sur les contenus générés avant.
 */
export function deriveVisual(visual: SocialVisual | undefined, fallback: string): { text: string; highlight?: string } {
  const provided = visual?.text?.trim();
  if (provided) return { text: provided, highlight: visual?.highlight?.trim() || undefined };
  const firstLine = fallback.split('\n').map((l) => l.trim()).find(Boolean) || fallback.trim();
  return { text: firstLine.slice(0, 200) };
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all cursor-pointer ${
        copied ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
    >
      {copied ? '✓ Copié' : 'Copier'}
    </button>
  );
}

const PLATFORMS = [
  { id: 'instagram' as const, label: 'Instagram', icon: Instagram },
  { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
  { id: 'facebook' as const, label: 'Facebook', icon: Facebook },
];

/** Affichage (onglets Instagram/LinkedIn/Facebook + téléchargements) d'un contenu déjà généré. */
export default function SocialResultDisplay({ result, brand, coverImage, onRegenerate, initialPlatform }: Props) {
  const [platform, setPlatform] = useState<SocialPlatformId>(initialPlatform ?? 'instagram');
  const [downloadingAll, setDownloadingAll] = useState(false);
  const slideCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  useEffect(() => {
    if (initialPlatform) setPlatform(initialPlatform);
  }, [initialPlatform]);

  const downloadAllSlides = async () => {
    setDownloadingAll(true);
    for (const slide of result.instagram.slides) {
      const canvas = slideCanvasRefs.current[slide.number];
      if (canvas) downloadCanvas(canvas, `slide-${String(slide.number).padStart(2, '0')}.png`);
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloadingAll(false);
  };

  return (
    <div className="space-y-6">
      {/* Onglets plateforme */}
      <div className="flex gap-2 border-b border-stone-100 pb-px">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all cursor-pointer ${
              platform === p.id ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-stone-400 hover:text-stone-700'
            }`}
          >
            <p.icon size={14} /> {p.label}
          </button>
        ))}
      </div>

      {/* ── Instagram ────────────────────────────────────── */}
      {platform === 'instagram' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                Visuels du carrousel ({result.instagram.slides.length} slides)
              </p>
              <button
                type="button"
                onClick={downloadAllSlides}
                disabled={downloadingAll}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {downloadingAll ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Tout télécharger
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result.instagram.slides.map((slide, i) => (
                <SlideCard
                  key={slide.number}
                  slide={slide}
                  total={result.instagram.slides.length}
                  dark={i % 2 === 1}
                  brand={brand}
                  registerCanvas={(el) => { slideCanvasRefs.current[slide.number] = el; }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Légende Instagram</p>
              <CopyButton text={`${result.instagram.caption.hook}\n\n${result.instagram.caption.body}\n\n${result.instagram.caption.cta}\n\n${result.instagram.caption.hashtags}`} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-100 divide-y divide-stone-100">
              <div className="p-4">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest block mb-1.5">Hook</span>
                <p className="text-stone-900 font-medium text-sm">{result.instagram.caption.hook}</p>
              </div>
              <div className="p-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Corps</span>
                <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{result.instagram.caption.body}</p>
              </div>
              <div className="p-4">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1.5">Call-to-action</span>
                <p className="text-stone-700 text-sm">{result.instagram.caption.cta}</p>
              </div>
              <div className="p-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5"># Hashtags</span>
                <p className="text-indigo-600 text-sm font-mono leading-relaxed">{result.instagram.caption.hashtags}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LinkedIn ─────────────────────────────────────── */}
      {platform === 'linkedin' && (
        <div className="space-y-6">
          <HookCardBlock
            format="linkedin-square"
            brand={brand}
            filename="visuel-linkedin.png"
            {...deriveVisual(result.linkedin.visual, result.linkedin.hook_variants?.[0] || result.linkedin.post)}
          />

          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3">Variantes d'accroche (1ère ligne)</p>
            <div className="space-y-2">
              {result.linkedin.hook_variants.map((hook, i) => (
                <div key={i} className="flex items-start gap-3 bg-stone-50 rounded-xl border border-stone-100 p-3">
                  <span className="text-xs font-bold text-stone-300 mt-0.5">{i + 1}</span>
                  <p className="flex-1 text-sm text-stone-700">{hook}</p>
                  <CopyButton text={hook} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Post complet</p>
              <CopyButton text={result.linkedin.hashtags ? `${result.linkedin.post}\n\n${result.linkedin.hashtags}` : result.linkedin.post} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-100 p-5">
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">{result.linkedin.post}</p>
              {result.linkedin.hashtags && (
                <p className="text-indigo-600 text-sm font-mono mt-3">{result.linkedin.hashtags}</p>
              )}
            </div>
          </div>

          <CoverImageBlock coverImage={coverImage} label="Autre option : la photo de couverture de l'article" />
        </div>
      )}

      {/* ── Facebook ─────────────────────────────────────── */}
      {platform === 'facebook' && (
        <div className="space-y-6">
          <HookCardBlock
            format="facebook-landscape"
            brand={brand}
            filename="visuel-facebook.png"
            {...deriveVisual(result.facebook.visual, result.instagram.caption?.hook || result.facebook.post)}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Post Facebook</p>
              <CopyButton text={result.facebook.post} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-100 p-5">
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">{result.facebook.post}</p>
            </div>
          </div>

          <CoverImageBlock coverImage={coverImage} label="Autre option : la photo de couverture de l'article" />
        </div>
      )}

      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs text-stone-400 hover:text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles size={12} /> Régénérer
        </button>
      )}
    </div>
  );
}

function SlideCard({ slide, total, dark, brand, registerCanvas }: {
  slide: SocialSlide; total: number; dark: boolean; brand: BrandTokens; registerCanvas: (el: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerCanvas(canvasRef.current);
    let cancelled = false;
    if (canvasRef.current) {
      setReady(false);
      renderCarouselSlide({ canvas: canvasRef.current, text: slide.text, highlight: slide.highlight, number: slide.number, total, dark, brand })
        .then(() => { if (!cancelled) setReady(true); });
    }
    return () => { cancelled = true; registerCanvas(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.text, slide.highlight, slide.number, total, dark, brand.accent, brand.dark, brand.headingFont, brand.bodyFont]);

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-100 overflow-hidden">
      <canvas ref={canvasRef} className="w-full aspect-[4/5] block bg-stone-200" />
      <div className="p-2.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-stone-500 leading-snug line-clamp-2 flex-1">{slide.text}</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, `slide-${String(slide.number).padStart(2, '0')}.png`)}
          className="shrink-0 p-1.5 text-stone-400 hover:text-sage hover:bg-sage/10 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
          title="Télécharger ce visuel"
          aria-label={`Télécharger la slide ${slide.number}`}
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  );
}

const FORMAT_ASPECT: Record<SocialCardFormat, string> = {
  'instagram-portrait': 'aspect-[4/5]',
  'linkedin-square': 'aspect-square',
  'facebook-landscape': 'aspect-[40/21]',
};

/** Visuel unique portant le hook, au format de la plateforme. */
function HookCardBlock({ format, text, highlight, brand, filename }: {
  format: SocialCardFormat;
  text: string;
  highlight?: string;
  brand: BrandTokens;
  filename: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !text) return;
    setReady(false);
    renderHookCard({ canvas, text, highlight, dark: true, brand, format })
      .then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, highlight, format, brand.accent, brand.dark, brand.headingFont, brand.bodyFont]);

  if (!text) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">
          Visuel · {FORMAT_LABELS[format]}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, filename)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download size={12} /> Télécharger
        </button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Visuel : ${text}`}
        className={`w-full max-w-md ${FORMAT_ASPECT[format]} block rounded-xl border border-stone-100 bg-stone-200`}
      />
    </div>
  );
}

/**
 * Photo de couverture de l'article, proposée en alternative au visuel généré.
 * Son absence n'est plus un manque depuis que chaque plateforme a son propre
 * visuel : on n'affiche donc rien plutôt qu'un avertissement.
 */
function CoverImageBlock({ coverImage, label }: { coverImage?: string; label: string }) {
  if (!coverImage) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{label}</p>
        <button
          type="button"
          onClick={() => downloadImageFromUrl(coverImage, 'photo-couverture.jpg')}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors cursor-pointer"
        >
          <Download size={12} /> Télécharger
        </button>
      </div>
      <img src={coverImage} alt="Couverture de l'article" className="w-full max-w-sm aspect-video object-cover rounded-xl border border-stone-100" />
    </div>
  );
}
