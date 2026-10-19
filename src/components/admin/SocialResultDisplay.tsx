"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Loader2, Download, Instagram, Linkedin, Facebook, Send, Check,
  Smartphone, MapPin, Palette, Image as ImageIcon, PenLine, ExternalLink, Save, RotateCcw,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  renderCarouselSlide, renderHookCard, renderStorySlide, downloadCanvas, downloadImageFromUrl,
  FORMAT_LABELS, VISUAL_THEMES, BRAND_PHOTOS,
  BrandTokens, SocialCardFormat, SocialVisualTheme,
} from '../../utils/socialCards';
import type {
  SocialGenerationResult, SocialSlide, SocialStorySlide, SocialVisual, SocialGoogleBusiness,
} from '../../utils/socialGeneration';

export type SocialPlatformId = 'instagram' | 'stories' | 'facebook' | 'google' | 'linkedin';

interface Props {
  result: SocialGenerationResult;
  brand: BrandTokens;
  coverImage?: string;
  onRegenerate?: () => void;
  /** Permet de sauvegarder les retouches de texte ou le thème choisi dans Supabase. */
  onUpdateContent?: (next: SocialGenerationResult) => void | Promise<void>;
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

/**
 * Génère automatiquement les 3 slides de Story verticale 9:16 à partir du
 * carrousel et de la légende lorsque le post est ancien et n'a pas encore `stories`.
 */
export function deriveStories(result: SocialGenerationResult): SocialStorySlide[] {
  if (result.instagram?.stories && result.instagram.stories.length > 0) {
    return result.instagram.stories;
  }
  const slides = result.instagram?.slides || [];
  const firstSlide = slides[0];
  const midSlide = slides[Math.min(slides.length - 1, Math.max(1, Math.floor(slides.length / 2)))];
  const lastSlide = slides[slides.length - 1];

  return [
    {
      number: 1,
      label: 'L’observation',
      text: firstSlide?.text || result.instagram?.caption?.hook || 'Prenez un instant pour écouter votre peau.',
      highlight: firstSlide?.highlight,
      cta: 'Toucher pour la suite →',
    },
    {
      number: 2,
      label: 'Le geste soin',
      text: midSlide?.text || 'En cabine, chaque manœuvre relâche les tensions et réveille l’éclat naturel.',
      highlight: midSlide?.highlight,
      cta: 'Découvrir le conseil →',
    },
    {
      number: 3,
      label: 'À Palézieux-Gare',
      text: lastSlide?.text || result.instagram?.caption?.cta || 'Offrez-vous une parenthèse de douceur à 2 minutes de la gare.',
      highlight: lastSlide?.highlight,
      cta: 'Réserver votre soin · Lien en bio',
    },
  ];
}

/**
 * Génère automatiquement une actualité Google Business Profile locale pour
 * Palézieux-Gare si le post a été créé avant l'ajout de `google_business`.
 */
export function deriveGoogleBusiness(result: SocialGenerationResult): SocialGoogleBusiness {
  if (result.google_business && result.google_business.post) {
    return result.google_business;
  }
  const hook = result.instagram?.caption?.hook || result.instagram?.slides?.[0]?.text || 'Votre parenthèse beauté à Palézieux-Gare';
  const body = result.instagram?.caption?.body || result.facebook?.post || '';
  const firstSlide = result.instagram?.slides?.[0];

  const cleanBody = body
    .split('\n\n')
    .slice(0, 2)
    .join('\n\n')
    .trim();

  const localFooter =
    "Je vous accueille sur rendez-vous dans le calme de ma cabine privée à Palézieux-Gare (à 2 minutes à pied de la gare CFF, place de parc gratuite devant l'institut).";

  return {
    title: hook.slice(0, 80),
    post: [hook, cleanBody, localFooter].filter(Boolean).join('\n\n'),
    cta_label: 'Réserver un soin',
    cta_url: 'https://emmanuelle-esthetique.ch/contact',
    visual: {
      text: firstSlide?.text || hook,
      highlight: firstSlide?.highlight,
    },
  };
}

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
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
        state === 'copied'
          ? 'bg-emerald-50 text-emerald-800'
          : state === 'failed'
            ? 'bg-red-50 text-red-800'
            : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
      }`}
    >
      {state === 'copied' ? (
        <>
          <Check size={14} /> Copié
        </>
      ) : state === 'failed' ? (
        'Copie impossible'
      ) : (
        label
      )}
    </button>
  );
}

const PLATFORMS: {
  id: SocialPlatformId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}[] = [
  { id: 'instagram', label: 'Carrousel Instagram', shortLabel: 'Carrousel', icon: Instagram },
  { id: 'stories', label: 'Story Instagram (Vertical)', shortLabel: 'Story 9:16', icon: Smartphone },
  { id: 'facebook', label: 'Publication Facebook', shortLabel: 'Facebook', icon: Facebook },
  { id: 'google', label: 'Actualité Google (Palézieux-Gare)', shortLabel: 'Fiche Google', icon: MapPin },
  { id: 'linkedin', label: 'Post LinkedIn', shortLabel: 'LinkedIn', icon: Linkedin },
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

  const label =
    platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'LinkedIn';

  const handlePublish = async () => {
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
        setStatus({
          success: false,
          message: `La publication sur ${label} a échoué${data.error ? ` : ${data.error}` : '.'} Vérifiez que le compte est bien connecté dans les Paramètres.`,
        });
      }
    } catch {
      setStatus({ success: false, message: 'La publication a échoué : la connexion a été interrompue. Réessayez.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 my-1">
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
        <div
          role={status.success ? 'status' : 'alert'}
          className={`p-2.5 rounded-lg text-[13px] border ${
            status.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}

/**
 * Studio d'aperçu, de personnalisation visuelle et de téléchargement
 * des publications Emmanuelle Esthétique.
 */
export default function SocialResultDisplay({
  result,
  brand,
  coverImage,
  onRegenerate,
  onUpdateContent,
  initialPlatform,
}: Props) {
  const [platform, setPlatform] = useState<SocialPlatformId>(initialPlatform ?? 'instagram');
  const [draft, setDraft] = useState<SocialGenerationResult>(() => result);
  const [theme, setTheme] = useState<SocialVisualTheme>(() => result.theme || 'creme');
  const [bgImageUrl, setBgImageUrl] = useState<string>(() => coverImage || BRAND_PHOTOS[0].url);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingStories, setDownloadingStories] = useState(false);

  const slideCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const storyCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  useEffect(() => {
    setDraft(result);
    if (result.theme) setTheme(result.theme);
    setDirty(false);
  }, [result]);

  useEffect(() => {
    if (coverImage) setBgImageUrl(coverImage);
  }, [coverImage]);

  useEffect(() => {
    if (initialPlatform) setPlatform(initialPlatform);
  }, [initialPlatform]);

  const handleSelectTheme = (nextTheme: SocialVisualTheme) => {
    setTheme(nextTheme);
    if (nextTheme === 'photo') {
      setShowPhotoPicker(true);
    }
    const nextDraft: SocialGenerationResult = { ...draft, theme: nextTheme };
    setDraft(nextDraft);
    setDirty(true);
    setSavedNotice(false);
  };

  const handleSelectPhoto = (url: string) => {
    setBgImageUrl(url);
    if (theme !== 'photo') {
      setTheme('photo');
      setDraft((prev) => ({ ...prev, theme: 'photo' }));
      setDirty(true);
    }
  };

  const updateDraft = (updater: (prev: SocialGenerationResult) => SocialGenerationResult) => {
    setDraft((prev) => {
      const next = updater(prev);
      return { ...next, theme };
    });
    setDirty(true);
    setSavedNotice(false);
  };

  const handleSaveChanges = async () => {
    if (!onUpdateContent) return;
    setSaving(true);
    try {
      await onUpdateContent({ ...draft, theme });
      setDirty(false);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const downloadAllSlides = async () => {
    setDownloadingAll(true);
    for (const slide of draft.instagram.slides) {
      const canvas = slideCanvasRefs.current[slide.number];
      if (canvas) downloadCanvas(canvas, `carrousel-emmanuelle-${String(slide.number).padStart(2, '0')}.png`);
      await new Promise((r) => setTimeout(r, 280));
    }
    setDownloadingAll(false);
  };

  const stories = deriveStories(draft);
  const googleData = deriveGoogleBusiness(draft);

  const downloadAllStories = async () => {
    setDownloadingStories(true);
    for (const st of stories) {
      const canvas = storyCanvasRefs.current[st.number];
      if (canvas) downloadCanvas(canvas, `story-emmanuelle-${String(st.number).padStart(2, '0')}.png`);
      await new Promise((r) => setTimeout(r, 280));
    }
    setDownloadingStories(false);
  };

  const instagramHookVariants =
    draft.instagram?.hook_variants && draft.instagram.hook_variants.length > 0
      ? draft.instagram.hook_variants
      : draft.linkedin?.hook_variants || [];

  const applyInstagramHook = (newHook: string) => {
    updateDraft((prev) => {
      const nextSlides = [...(prev.instagram?.slides || [])];
      if (nextSlides.length > 0) {
        nextSlides[0] = { ...nextSlides[0], text: newHook };
      }
      return {
        ...prev,
        instagram: {
          ...prev.instagram,
          slides: nextSlides,
          caption: {
            ...prev.instagram.caption,
            hook: newHook,
          },
        },
      };
    });
  };

  const photoChoices = [
    ...(coverImage
      ? [{ id: 'cover-photo', label: 'Photo du sujet', category: 'Couverture', url: coverImage }]
      : []),
    ...BRAND_PHOTOS,
  ];

  return (
    <div className="space-y-6">
      {/* ── Sélecteur d'habillage visuel ("Personnaliser l'Écrin") ───────────── */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#3A3730] border border-stone-200">
              <Palette size={16} />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-stone-950">
                Personnaliser l’écrin visuel
              </h3>
              <p className="text-[13px] text-stone-600">
                Changez d’ambiance en 1 clic : toutes vos images se redessinent instantanément.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPhotoPicker((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors cursor-pointer border ${
                showPhotoPicker || theme === 'photo'
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
              }`}
            >
              <ImageIcon size={14} />
              Photos de l’institut
            </button>

            <button
              type="button"
              onClick={() => setEditingText((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors cursor-pointer border ${
                editingText
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
              }`}
            >
              <PenLine size={14} />
              {editingText ? 'Fermer l’édition' : 'Retoucher les textes'}
            </button>

            {onUpdateContent && dirty && (
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 text-[13px] font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer mes retouches
              </button>
            )}

            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">
                <Check size={14} /> Enregistré
              </span>
            )}
          </div>
        </div>

        {/* Grille des 5 thèmes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {VISUAL_THEMES.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTheme(item.id)}
                className={`group flex flex-col items-start rounded-xl p-3 text-left transition-all cursor-pointer border ${
                  active
                    ? 'border-stone-900 bg-stone-50 ring-2 ring-stone-900/10'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/60'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-serif font-bold border border-black/10"
                    style={{ backgroundColor: item.previewBg, color: item.previewFg }}
                  >
                    <span>Aa</span>
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: item.previewAccent }}
                    />
                  </span>
                  {active && (
                    <span className="inline-flex size-4 items-center justify-center rounded-full bg-stone-900 text-white">
                      <Check size={10} />
                    </span>
                  )}
                </div>
                <span className="text-[13.5px] font-semibold text-stone-900 leading-snug">
                  {item.label}
                </span>
                <span className="mt-0.5 text-[11.5px] text-stone-600 leading-snug line-clamp-2">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sélecteur de photo de soin (affiché quand le thème Photo est actif ou ouvert) */}
        {(theme === 'photo' || showPhotoPicker) && (
          <div className="pt-3 border-t border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-stone-800">
                Choisissez la photo d’arrière-plan (soins Phytomer, massages, regard, cabine) :
              </p>
              {theme !== 'photo' && (
                <span className="text-[12px] text-stone-600">
                  Cliquer sur une photo activera l’écrin « Photo de Soin »
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
              {photoChoices.map((photo) => {
                const selected = bgImageUrl === photo.url && theme === 'photo';
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => handleSelectPhoto(photo.url)}
                    className={`group relative overflow-hidden rounded-lg border text-left transition-all cursor-pointer aspect-square ${
                      selected
                        ? 'border-stone-950 ring-2 ring-stone-950'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                    title={`${photo.label} (${photo.category})`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5">
                      <span className="block text-[10px] font-medium text-white leading-tight truncate">
                        {photo.label}
                      </span>
                    </div>
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-stone-900 text-white shadow">
                        <Check size={11} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Onglets des 5 formats réseaux ───────────────────────────────────── */}
      <div role="tablist" aria-label="Format de publication" className="flex flex-wrap gap-1.5 border-b border-stone-200 pb-2">
        {PLATFORMS.map((p) => {
          const isActive = platform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200 hover:text-stone-950'
              }`}
            >
              <p.icon size={14} />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 1. Carrousel Instagram (4:5) ────────────────────────────────────── */}
      {platform === 'instagram' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur Instagram</h4>
              <p className="text-[13px] text-stone-700">
                La photo de couverture et la légende partent sur votre compte Instagram connecté.
              </p>
            </div>
            <DirectPublishButton
              platform="instagram"
              title="Post Instagram"
              caption={`${draft.instagram.caption.hook}\n\n${draft.instagram.caption.body}\n\n${draft.instagram.caption.cta}\n\n${draft.instagram.caption.hashtags}`}
              imageUrl={coverImage || bgImageUrl}
            />
          </div>

          {/* Choix parmi les 3 phrases d'accroche */}
          {instagramHookVariants.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2.5">
              <p className="text-[13px] font-semibold text-stone-900">
                3 idées de phrases d’accroche (cliquez sur « Choisir » pour l’appliquer à la 1re image) :
              </p>
              <div className="space-y-2">
                {instagramHookVariants.map((hook, idx) => {
                  const isCurrent = draft.instagram.slides?.[0]?.text === hook;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                        isCurrent ? 'border-accent bg-white' : 'border-stone-200 bg-white/80'
                      }`}
                    >
                      <p className="flex-1 min-w-[200px] text-[13.5px] font-medium text-stone-800">
                        « {hook} »
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyInstagramHook(hook)}
                          className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-accent text-accent-fg'
                              : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                          }`}
                        >
                          {isCurrent ? (
                            <>
                              <Check size={13} /> Accroche active
                            </>
                          ) : (
                            'Choisir cette accroche'
                          )}
                        </button>
                        <CopyButton text={hook} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Slides du carrousel */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[14px] font-semibold text-stone-900">
                  Images du carrousel ({draft.instagram.slides.length} images au format 4:5)
                </p>
                <p className="text-[12.5px] text-stone-600">
                  Téléchargez toutes les images d’un coup ou retouchez le texte d’une carte.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadAllSlides}
                disabled={downloadingAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-45 cursor-pointer"
              >
                {downloadingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Tout télécharger ({draft.instagram.slides.length} PNG)
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {draft.instagram.slides.map((slide, i) => (
                <SlideCard
                  key={slide.number}
                  slide={slide}
                  total={draft.instagram.slides.length}
                  dark={i % 2 === 1}
                  brand={brand}
                  theme={theme}
                  bgImageUrl={bgImageUrl}
                  editing={editingText}
                  onChangeSlide={(nextSlide) => {
                    updateDraft((prev) => ({
                      ...prev,
                      instagram: {
                        ...prev.instagram,
                        slides: prev.instagram.slides.map((s) =>
                          s.number === slide.number ? nextSlide : s,
                        ),
                      },
                    }));
                  }}
                  registerCanvas={(el) => {
                    slideCanvasRefs.current[slide.number] = el;
                  }}
                />
              ))}
            </div>
          </div>

          {/* Légende Instagram */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-stone-900">Légende accompagnant le post Instagram</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingText((v) => !v)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <PenLine size={13} />
                  {editingText ? 'Terminer' : 'Modifier'}
                </button>
                <CopyButton
                  label="Copier toute la légende"
                  text={`${draft.instagram.caption.hook}\n\n${draft.instagram.caption.body}\n\n${draft.instagram.caption.cta}\n\n${draft.instagram.caption.hashtags}`}
                />
              </div>
            </div>

            <div className="bg-stone-50 rounded-xl border border-stone-200 divide-y divide-stone-200">
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Accroche</span>
                {editingText ? (
                  <input
                    type="text"
                    value={draft.instagram.caption.hook}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        instagram: {
                          ...prev.instagram,
                          caption: { ...prev.instagram.caption, hook: e.target.value },
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-900 font-medium text-sm">{draft.instagram.caption.hook}</p>
                )}
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Conseil & récit</span>
                {editingText ? (
                  <textarea
                    rows={5}
                    value={draft.instagram.caption.body}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        instagram: {
                          ...prev.instagram,
                          caption: { ...prev.instagram.caption, body: e.target.value },
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 leading-relaxed focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">
                    {draft.instagram.caption.body}
                  </p>
                )}
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Invitation finale</span>
                {editingText ? (
                  <input
                    type="text"
                    value={draft.instagram.caption.cta}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        instagram: {
                          ...prev.instagram,
                          caption: { ...prev.instagram.caption, cta: e.target.value },
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-700 text-sm">{draft.instagram.caption.cta}</p>
                )}
              </div>
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1.5">Mots-clés (Hashtags)</span>
                {editingText ? (
                  <input
                    type="text"
                    value={draft.instagram.caption.hashtags}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        instagram: {
                          ...prev.instagram,
                          caption: { ...prev.instagram.caption, hashtags: e.target.value },
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-700 text-sm leading-relaxed">{draft.instagram.caption.hashtags}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Story Instagram Verticale (9:16) ─────────────────────────────── */}
      {platform === 'stories' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">
                Séquence de 3 Stories verticales (format plein écran 9:16)
              </h4>
              <p className="text-[13px] text-stone-600">
                Prêtes à publier en Story Instagram, Facebook ou statut WhatsApp : 1. L’accroche · 2. Le conseil soin · 3. L’invitation à l’institut.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadAllStories}
              disabled={downloadingStories}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-900 px-4 text-[13.5px] font-semibold text-white hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-45"
            >
              {downloadingStories ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Télécharger les 3 Stories (PNG)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stories.map((story, idx) => (
              <StorySlideCard
                key={story.number || idx + 1}
                story={story}
                total={stories.length}
                dark={idx === 1}
                brand={brand}
                theme={theme}
                bgImageUrl={bgImageUrl}
                editing={editingText}
                onChangeStory={(nextStory) => {
                  const currentStories = deriveStories(draft);
                  const updated = currentStories.map((s, i) => (i === idx ? nextStory : s));
                  updateDraft((prev) => ({
                    ...prev,
                    instagram: {
                      ...prev.instagram,
                      stories: updated,
                    },
                  }));
                }}
                registerCanvas={(el) => {
                  storyCanvasRefs.current[story.number || idx + 1] = el;
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Publication Facebook (Paysage) ───────────────────────────────── */}
      {platform === 'facebook' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur Facebook</h4>
              <p className="text-[13px] text-stone-700">
                Le texte et l’image partent directement sur la page Facebook de l’institut.
              </p>
            </div>
            <DirectPublishButton
              platform="facebook"
              title="Post Facebook"
              caption={draft.facebook.post}
              imageUrl={coverImage || bgImageUrl}
            />
          </div>

          <HookCardBlock
            format="facebook-landscape"
            brand={brand}
            theme={theme}
            bgImageUrl={bgImageUrl}
            filename="visuel-facebook-emmanuelle.png"
            editing={editingText}
            onChangeVisual={(nextVis) =>
              updateDraft((prev) => ({
                ...prev,
                facebook: { ...prev.facebook, visual: nextVis },
              }))
            }
            {...deriveVisual(draft.facebook.visual, draft.instagram.caption?.hook || draft.facebook.post)}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-stone-900">Texte de la publication Facebook</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingText((v) => !v)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <PenLine size={13} />
                  {editingText ? 'Terminer' : 'Modifier'}
                </button>
                <CopyButton text={draft.facebook.post} />
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-5">
              {editingText ? (
                <textarea
                  rows={6}
                  value={draft.facebook.post}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      facebook: { ...prev.facebook, post: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 leading-relaxed focus:border-accent focus:outline-none"
                />
              ) : (
                <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">
                  {draft.facebook.post}
                </p>
              )}
            </div>
          </div>

          <CoverImageBlock coverImage={coverImage} label="Autre option : la photo de couverture d'origine" />
        </div>
      )}

      {/* ── 4. Actualité Google (Palézieux-Gare) ────────────────────────────── */}
      {platform === 'google' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0 max-w-xl">
              <h4 className="text-[15px] font-semibold text-stone-900">
                Actualité pour votre fiche Google (Palézieux-Gare)
              </h4>
              <p className="text-[13px] text-stone-700 mt-0.5">
                Les clientes d’Oron, Palézieux et Châtel-St-Denis voient cette actualité directement sur Google Maps lorsqu’elles cherchent un institut de beauté.
              </p>
            </div>
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-900 px-4 text-[13.5px] font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              <span>Ouvrir ma fiche Google</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <HookCardBlock
            format="google-business"
            brand={brand}
            theme={theme}
            bgImageUrl={bgImageUrl}
            badgeText="INSTITUT À PALÉZIEUX-GARE"
            ctaText={`${googleData.cta_label || 'Prendre rendez-vous'} · emmanuelle-esthetique.ch`}
            filename="actualite-google-palezieux.png"
            editing={editingText}
            onChangeVisual={(nextVis) =>
              updateDraft((prev) => ({
                ...prev,
                google_business: {
                  ...deriveGoogleBusiness(prev),
                  visual: nextVis,
                },
              }))
            }
            {...deriveVisual(googleData.visual, googleData.title || draft.instagram.caption?.hook)}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-stone-900">
                Texte de l’actualité locale Google (prêt à copier-coller)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingText((v) => !v)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <PenLine size={13} />
                  {editingText ? 'Terminer' : 'Modifier'}
                </button>
                <CopyButton
                  label="Copier le texte Google"
                  text={`${googleData.title}\n\n${googleData.post}`}
                />
              </div>
            </div>

            <div className="bg-stone-50 rounded-xl border border-stone-200 divide-y divide-stone-200">
              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1">
                  Titre de l’actualité
                </span>
                {editingText ? (
                  <input
                    type="text"
                    value={googleData.title}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        google_business: {
                          ...deriveGoogleBusiness(prev),
                          title: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-900 font-semibold text-sm">{googleData.title}</p>
                )}
              </div>

              <div className="p-4">
                <span className="block text-[13px] font-semibold text-stone-800 mb-1">
                  Description locale (Palézieux-Gare, Oron, Broye)
                </span>
                {editingText ? (
                  <textarea
                    rows={5}
                    value={googleData.post}
                    onChange={(e) =>
                      updateDraft((prev) => ({
                        ...prev,
                        google_business: {
                          ...deriveGoogleBusiness(prev),
                          post: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 leading-relaxed focus:border-accent focus:outline-none"
                  />
                ) : (
                  <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">
                    {googleData.post}
                  </p>
                )}
              </div>

              <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="block text-[13px] font-semibold text-stone-800">
                    Bouton conseillé sur Google : « {googleData.cta_label || 'Réserver'} »
                  </span>
                  <span className="text-[13px] text-stone-600">
                    Lien à coller : {googleData.cta_url || 'https://emmanuelle-esthetique.ch/contact'}
                  </span>
                </div>
                <CopyButton
                  label="Copier le lien"
                  text={googleData.cta_url || 'https://emmanuelle-esthetique.ch/contact'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Post LinkedIn (Carré) ────────────────────────────────────────── */}
      {platform === 'linkedin' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-stone-900">Publier directement sur LinkedIn</h4>
              <p className="text-[13px] text-stone-700">
                Le post part sur votre profil ou votre page LinkedIn connectée.
              </p>
            </div>
            <DirectPublishButton
              platform="linkedin"
              title="Post LinkedIn"
              caption={
                draft.linkedin.hashtags
                  ? `${draft.linkedin.post}\n\n${draft.linkedin.hashtags}`
                  : draft.linkedin.post
              }
              imageUrl={coverImage || bgImageUrl}
            />
          </div>

          <HookCardBlock
            format="linkedin-square"
            brand={brand}
            theme={theme}
            bgImageUrl={bgImageUrl}
            filename="visuel-linkedin-emmanuelle.png"
            editing={editingText}
            onChangeVisual={(nextVis) =>
              updateDraft((prev) => ({
                ...prev,
                linkedin: { ...prev.linkedin, visual: nextVis },
              }))
            }
            {...deriveVisual(draft.linkedin.visual, draft.linkedin.hook_variants?.[0] || draft.linkedin.post)}
          />

          {draft.linkedin.hook_variants && draft.linkedin.hook_variants.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-stone-800 mb-2.5">
                Autres premières lignes possibles :
              </p>
              <div className="space-y-2">
                {draft.linkedin.hook_variants.map((hook, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-3 bg-stone-50 rounded-xl border border-stone-200 p-3"
                  >
                    <span className="text-[13px] font-semibold text-stone-600">{i + 1}</span>
                    <p className="flex-1 text-sm text-stone-700">{hook}</p>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((prev) => ({
                          ...prev,
                          linkedin: {
                            ...prev.linkedin,
                            visual: { text: hook, highlight: prev.linkedin.visual?.highlight },
                          },
                        }))
                      }
                      className="inline-flex h-8 items-center rounded-lg bg-white border border-stone-200 px-2.5 text-[12px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                    >
                      Mettre sur l’image
                    </button>
                    <CopyButton text={hook} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-stone-900">Post LinkedIn complet</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingText((v) => !v)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  <PenLine size={13} />
                  {editingText ? 'Terminer' : 'Modifier'}
                </button>
                <CopyButton
                  text={
                    draft.linkedin.hashtags
                      ? `${draft.linkedin.post}\n\n${draft.linkedin.hashtags}`
                      : draft.linkedin.post
                  }
                />
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-5">
              {editingText ? (
                <textarea
                  rows={7}
                  value={draft.linkedin.post}
                  onChange={(e) =>
                    updateDraft((prev) => ({
                      ...prev,
                      linkedin: { ...prev.linkedin, post: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 leading-relaxed focus:border-accent focus:outline-none"
                />
              ) : (
                <>
                  <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-line">
                    {draft.linkedin.post}
                  </p>
                  {draft.linkedin.hashtags && (
                    <p className="text-stone-700 text-sm mt-3">{draft.linkedin.hashtags}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <CoverImageBlock coverImage={coverImage} label="Autre option : la photo de couverture de l'article" />
        </div>
      )}

      {onRegenerate && (
        <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onRegenerate}
            className="text-[13px] font-semibold text-stone-800 hover:text-stone-950 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} /> Proposer une autre rédaction
          </button>
        </div>
      )}
    </div>
  );
}

function SlideCard({
  slide,
  total,
  dark,
  brand,
  theme,
  bgImageUrl,
  editing,
  onChangeSlide,
  registerCanvas,
}: {
  slide: SocialSlide;
  total: number;
  dark: boolean;
  brand: BrandTokens;
  theme: SocialVisualTheme;
  bgImageUrl?: string;
  editing?: boolean;
  onChangeSlide: (next: SocialSlide) => void;
  registerCanvas: (el: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerCanvas(canvasRef.current);
    let cancelled = false;
    if (canvasRef.current) {
      setReady(false);
      renderCarouselSlide({
        canvas: canvasRef.current,
        text: slide.text,
        highlight: slide.highlight,
        number: slide.number,
        total,
        dark,
        brand,
        theme,
        bgImageUrl,
      }).then(() => {
        if (!cancelled) setReady(true);
      });
    }
    return () => {
      cancelled = true;
      registerCanvas(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slide.text,
    slide.highlight,
    slide.number,
    total,
    dark,
    theme,
    bgImageUrl,
    brand.accent,
    brand.dark,
    brand.headingFont,
    brand.bodyFont,
    brand.siteName,
  ]);

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden flex flex-col">
      <canvas ref={canvasRef} className="w-full aspect-[4/5] block bg-stone-200" />
      <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
        {editing ? (
          <div className="space-y-1.5">
            <textarea
              rows={2}
              value={slide.text}
              onChange={(e) => onChangeSlide({ ...slide, text: e.target.value })}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-900 focus:border-accent focus:outline-none"
              placeholder="Texte de la carte…"
            />
            <input
              type="text"
              value={slide.highlight || ''}
              onChange={(e) => onChangeSlide({ ...slide, highlight: e.target.value })}
              className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11.5px] text-stone-700 focus:border-accent focus:outline-none"
              placeholder="Mots en couleur (ex: éclat naturel)"
            />
          </div>
        ) : (
          <p className="text-[12.5px] text-stone-700 leading-snug line-clamp-2 flex-1">
            {slide.text}
          </p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-semibold text-stone-500">
            Carte {slide.number}/{total}
          </span>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              canvasRef.current &&
              downloadCanvas(canvasRef.current, `carrousel-emmanuelle-${String(slide.number).padStart(2, '0')}.png`)
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-semibold text-stone-800 hover:text-stone-950 hover:bg-stone-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer"
            title="Télécharger cette image"
          >
            <Download size={13} /> PNG
          </button>
        </div>
      </div>
    </div>
  );
}

function StorySlideCard({
  story,
  total,
  dark,
  brand,
  theme,
  bgImageUrl,
  editing,
  onChangeStory,
  registerCanvas,
}: {
  story: SocialStorySlide;
  total: number;
  dark: boolean;
  brand: BrandTokens;
  theme: SocialVisualTheme;
  bgImageUrl?: string;
  editing?: boolean;
  onChangeStory: (next: SocialStorySlide) => void;
  registerCanvas: (el: HTMLCanvasElement | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerCanvas(canvasRef.current);
    let cancelled = false;
    if (canvasRef.current) {
      setReady(false);
      renderStorySlide({
        canvas: canvasRef.current,
        text: story.text,
        highlight: story.highlight,
        number: story.number,
        total,
        dark,
        brand,
        theme,
        bgImageUrl,
        badgeText: story.label,
        ctaText: story.cta,
      }).then(() => {
        if (!cancelled) setReady(true);
      });
    }
    return () => {
      cancelled = true;
      registerCanvas(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    story.text,
    story.highlight,
    story.label,
    story.cta,
    story.number,
    total,
    dark,
    theme,
    bgImageUrl,
    brand.accent,
    brand.dark,
    brand.headingFont,
    brand.bodyFont,
    brand.siteName,
  ]);

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden flex flex-col">
      <canvas ref={canvasRef} className="w-full aspect-[9/16] block bg-stone-200" />
      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
        {editing ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={story.label || ''}
              onChange={(e) => onChangeStory({ ...story, label: e.target.value })}
              className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-stone-700"
              placeholder="Pastille du haut (ex: L'observation)"
            />
            <textarea
              rows={2}
              value={story.text}
              onChange={(e) => onChangeStory({ ...story, text: e.target.value })}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-[12px] text-stone-900"
              placeholder="Texte de la Story…"
            />
            <input
              type="text"
              value={story.cta || ''}
              onChange={(e) => onChangeStory({ ...story, cta: e.target.value })}
              className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11.5px] text-stone-700"
              placeholder="Bouton du bas…"
            />
          </div>
        ) : (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Story {story.number}/{total} · {story.label}
            </span>
            <p className="text-[13px] text-stone-800 leading-snug mt-0.5 line-clamp-2">
              {story.text}
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            canvasRef.current &&
            downloadCanvas(canvasRef.current, `story-emmanuelle-${String(story.number).padStart(2, '0')}.png`)
          }
          className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-stone-200/80 hover:bg-stone-200 px-3 text-[12.5px] font-semibold text-stone-900 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Download size={13} /> Télécharger Story {story.number}
        </button>
      </div>
    </div>
  );
}

const FORMAT_ASPECT: Record<SocialCardFormat, string> = {
  'instagram-portrait': 'aspect-[4/5]',
  'instagram-story': 'aspect-[9/16]',
  'linkedin-square': 'aspect-square',
  'facebook-landscape': 'aspect-[40/21]',
  'google-business': 'aspect-[4/3]',
};

/** Visuel unique portant le hook, au format de la plateforme. */
function HookCardBlock({
  format,
  text,
  highlight,
  brand,
  theme,
  bgImageUrl,
  badgeText,
  ctaText,
  filename,
  editing,
  onChangeVisual,
}: {
  format: SocialCardFormat;
  text: string;
  highlight?: string;
  brand: BrandTokens;
  theme: SocialVisualTheme;
  bgImageUrl?: string;
  badgeText?: string;
  ctaText?: string;
  filename: string;
  editing?: boolean;
  onChangeVisual?: (next: SocialVisual) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !text) return;
    setReady(false);
    renderHookCard({
      canvas,
      text,
      highlight,
      dark: true,
      brand,
      format,
      theme,
      bgImageUrl,
      badgeText,
      ctaText,
    }).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    text,
    highlight,
    format,
    theme,
    bgImageUrl,
    badgeText,
    ctaText,
    brand.accent,
    brand.dark,
    brand.headingFont,
    brand.bodyFont,
    brand.siteName,
  ]);

  if (!text) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold text-stone-900">
          Visuel · {FORMAT_LABELS[format]}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => canvasRef.current && downloadCanvas(canvasRef.current, filename)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-45 cursor-pointer"
        >
          <Download size={14} /> Télécharger l’image (PNG)
        </button>
      </div>

      {editing && onChangeVisual && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg bg-stone-50 p-3 rounded-xl border border-stone-200">
          <div>
            <label className="block text-[11.5px] font-semibold text-stone-700 mb-1">
              Texte inscrit sur l’image
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => onChangeVisual({ text: e.target.value, highlight })}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-stone-700 mb-1">
              Mots mis en couleur
            </label>
            <input
              type="text"
              value={highlight || ''}
              onChange={(e) => onChangeVisual({ text, highlight: e.target.value })}
              className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
            />
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Visuel : ${text}`}
        className={`w-full max-w-md ${FORMAT_ASPECT[format]} block rounded-xl border border-stone-200 bg-stone-200 shadow-xs`}
      />
    </div>
  );
}

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
      <img
        src={coverImage}
        alt="Couverture de l'article"
        className="w-full max-w-sm aspect-video object-cover rounded-xl border border-stone-200"
      />
    </div>
  );
}
