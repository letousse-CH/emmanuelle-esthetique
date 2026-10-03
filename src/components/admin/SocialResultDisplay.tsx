"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Download, Instagram, Linkedin, Facebook, Send, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';
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
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // Presse-papiers refusé (navigateur ou autorisation) : on le dit au lieu de ne rien faire.
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      title={state === 'failed' ? 'Sélectionnez le texte et copiez-le à la main (Ctrl+C ou Cmd+C).' : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors cursor-pointer ${
        state === 'copied' ? 'bg-emerald-50 text-emerald-800'
        : state === 'failed' ? 'bg-red-50 text-red-800'
        : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
      }`}
    >
      {state === 'copied' ? <><Check size={14} /> Copié</> : state === 'failed' ? 'Copie impossible' : 'Copier'}
    </button>
  );
}

const PLATFORMS = [
  { id: 'instagram' as const, label: 'Instagram', icon: Instagram },
  { id: 'linkedin' as const, label: 'LinkedIn', icon: Linkedin },
  { id: 'facebook' as const, label: 'Facebook', icon: Facebook },
];

export function DirectPublishButton({
  platform,
  title,
  caption,
  imageUrl,
}: {
  platform: 'linkedin' | 'instagram' | 'facebook';
  title: string;
  caption: string;
  imageUrl?: string;
}) {
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const label = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;

  const handlePublish = async () => {
    // Une publication sur un réseau est visible tout de suite par vos abonnés :
    // on demande confirmation avant d'envoyer.
    if (!window.confirm(`Publier maintenant ce post sur ${label} ? Il sera visible immédiatement par vos abonnés.`)) return;
    setPublishing(true);
    setStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/social-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ platform, title, caption, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatus({ success: true, message: data.result?.message || `Post publié sur ${label}.` });
      } else {
        setStatus({ success: false, message: `La publication sur ${label} a échoué${data.error ? ` : ${data.error}` : '.'} Vérifiez que le compte est bien connecté dans les Paramètres.` });
      }
    } catch {
      setStatus({ success: false, message: 'La publication a échoué : la connexion a été interrompue. Réessayez.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 my-2">
      <button
        type="button"
        onClick={handlePublish}
        disabled={publishing}
        className="bg-accent hover:bg-accent-hover flex items-center gap-2 px-4 h-10 text-accent-fg rounded-lg text-[14px] font-semibold transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
      >
        {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        <span>{publishing ? 'Publication…' : `Publier sur ${label}`}</span>
      </button>

      {status && (
        <div role={status.success ? 'status' : 'alert'} className={`p-2.5 rounded-lg text-[13px] border ${status.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

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
      <div role="tablist" aria-label="Réseau" className="flex flex-wrap gap-1 border-b border-stone-200">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
              platform === p.id ? 'border-accent text-stone-950' : 'border-transparent text-stone-700 hover:text-stone-950'
            }`}
          >
            <p.icon size={14} /> {p.label}
          </button>
        ))}
      </div>

      {/* ── Instagram ────────────────────────────────────── */}
      {platform === 'instagram' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur Instagram</h4>
              <p className="text-[13px] text-stone-700">La photo de couverture et la légende partent sur votre compte connecté.</p>
            </div>
            <DirectPublishButton
              platform="instagram"
              title="Post Instagram"
              caption={`${result.instagram.caption.hook}\n\n${result.instagram.caption.body}\n\n${result.instagram.caption.cta}`}
              imageUrl={coverImage}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-stone-800">
                Images du carrousel ({result.instagram.slides.length})
              </p>
              <button
                type="button"
                onClick={downloadAllSlides}
                disabled={downloadingAll}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 disabled:opacity-45 cursor-pointer"
              >
                {downloadingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
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
              <p className="text-[13px] font-medium text-stone-800">Légende Instagram</p>
              <CopyButton text={`${result.instagram.caption.hook}\n\n${result.instagram.caption.body}\n\n${result.instagram.caption.cta}\n\n${result.instagram.caption.hashtags}`} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-200 divide-y divide-stone-200">
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Accroche</span>
                <p className="text-stone-900 font-medium text-sm">{result.instagram.caption.hook}</p>
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Texte</span>
                <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">{result.instagram.caption.body}</p>
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Invitation finale</span>
                <p className="text-stone-700 text-sm">{result.instagram.caption.cta}</p>
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Hashtags</span>
                <p className="text-stone-700 text-sm leading-relaxed">{result.instagram.caption.hashtags}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LinkedIn ─────────────────────────────────────── */}
      {platform === 'linkedin' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur LinkedIn</h4>
              <p className="text-[13px] text-stone-700">Le post part sur votre profil ou votre page LinkedIn connectée.</p>
            </div>
            <DirectPublishButton
              platform="linkedin"
              title="Post LinkedIn"
              caption={result.linkedin.hashtags ? `${result.linkedin.post}\n\n${result.linkedin.hashtags}` : result.linkedin.post}
              imageUrl={coverImage}
            />
          </div>

          <HookCardBlock
            format="linkedin-square"
            brand={brand}
            filename="visuel-linkedin.png"
            {...deriveVisual(result.linkedin.visual, result.linkedin.hook_variants?.[0] || result.linkedin.post)}
          />

          <div>
            <p className="text-[13px] font-medium text-stone-800 mb-3">Autres premières lignes possibles</p>
            <div className="space-y-2">
              {result.linkedin.hook_variants.map((hook, i) => (
                <div key={i} className="flex items-start gap-3 bg-stone-50 rounded-xl border border-stone-200 p-3">
                  <span className="text-[13px] font-semibold text-stone-600 mt-0.5">{i + 1}</span>
                  <p className="flex-1 text-sm text-stone-700">{hook}</p>
                  <CopyButton text={hook} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-stone-800">Post complet</p>
              <CopyButton text={result.linkedin.hashtags ? `${result.linkedin.post}\n\n${result.linkedin.hashtags}` : result.linkedin.post} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-5">
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">{result.linkedin.post}</p>
              {result.linkedin.hashtags && (
                <p className="text-stone-700 text-sm mt-3">{result.linkedin.hashtags}</p>
              )}
            </div>
          </div>

          <CoverImageBlock coverImage={coverImage} label="Autre option : la photo de couverture de l'article" />
        </div>
      )}

      {/* ── Facebook ─────────────────────────────────────── */}
      {platform === 'facebook' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur Facebook</h4>
              <p className="text-[13px] text-stone-700">Le post part sur votre page Facebook connectée.</p>
            </div>
            <DirectPublishButton
              platform="facebook"
              title="Post Facebook"
              caption={result.facebook.post}
              imageUrl={coverImage}
            />
          </div>

          <HookCardBlock
            format="facebook-landscape"
            brand={brand}
            filename="visuel-facebook.png"
            {...deriveVisual(result.facebook.visual, result.instagram.caption?.hook || result.facebook.post)}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-medium text-stone-800">Post Facebook</p>
              <CopyButton text={result.facebook.post} />
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-5">
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
          className="text-[13px] font-semibold text-stone-800 hover:text-stone-950 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sparkles size={14} /> Proposer une autre version
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
    <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
      <canvas ref={canvasRef} className="w-full aspect-[4/5] block bg-stone-200" />
      <div className="p-2.5 flex items-center justify-between gap-2">
        <p className="text-[13px] text-stone-700 leading-snug line-clamp-2 flex-1">{slide.text}</p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, `slide-${String(slide.number).padStart(2, '0')}.png`)}
          className="shrink-0 p-1.5 text-stone-700 hover:text-stone-950 hover:bg-stone-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
          title="Télécharger cette image"
          aria-label={`Télécharger l'image ${slide.number}`}
        >
          <Download size={15} />
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
        <p className="text-[13px] font-medium text-stone-800">
          Visuel · {FORMAT_LABELS[format]}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, filename)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 disabled:opacity-45 cursor-pointer"
        >
          <Download size={14} /> Télécharger
        </button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Visuel : ${text}`}
        className={`w-full max-w-md ${FORMAT_ASPECT[format]} block rounded-xl border border-stone-200 bg-stone-200`}
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
        <p className="text-[13px] font-medium text-stone-800">{label}</p>
        <button
          type="button"
          onClick={() => downloadImageFromUrl(coverImage, 'photo-couverture.jpg')}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 disabled:opacity-45 cursor-pointer"
        >
          <Download size={14} /> Télécharger
        </button>
      </div>
      <img src={coverImage} alt="Couverture de l'article" className="w-full max-w-sm aspect-video object-cover rounded-xl border border-stone-200" />
    </div>
  );
}
