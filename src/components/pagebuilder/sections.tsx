"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, X, ZoomIn, ChevronDown, ShieldCheck } from 'lucide-react';
import EditableText from './EditableText';
import EditableImage from './EditableImage';
import {
  ALIGN_CLASS,
  CARD_TITLE_RATIO,
  DENSITY_CLASS,
  EASE,
  HERO_IMAGE_WIDTH_CLASS,
  HERO_IMAGE_WIDTH_CLASS_RIGHT,
  HERO_TEXT_WIDTH_CLASS, type HeroTextWidth,
  HERO_FLUID_TITLE, HERO_FLUID_DESCRIPTION,
  type HeroImageWidth,
  type HeroTextOverlap,
  LAYOUT_DEFAULTS,
  WIDTH_CLASS,
  buttonVariantOf,
  type ButtonVariant,
  getTitleFontClass,
  getContentFontClass,
  getTitleFontStyle,
  getContentFontStyle,
} from './sectionLayout';
import { useSectionAnimation } from './sectionAnimation';


// Helper: classe conditionnelle selon le thème
const t = (dark: boolean, light: string, darkCls: string) => dark ? darkCls : light;

const Eyebrow = ({ text, dark, sectionIndex, fieldPath }: { text?: string; dark?: boolean; sectionIndex?: number; fieldPath?: string }) =>
  text ? (
    <span className="inline-flex items-center gap-2.5 font-bold tracking-[0.38em] uppercase text-[10px] mb-5 block text-sage">
      <span className="w-5 h-px bg-sage/60 shrink-0" />
      <EditableText sectionIndex={sectionIndex} fieldPath={fieldPath} value={text} as="span" />
    </span>
  ) : null;

// ─── Marquee1 ─────────────────────────────────────────────────────────────────
export interface Marquee1Data {
  items?: string[];
  bg_color?: string;
  text_color?: string;
  separator?: string;
  speed?: 'slow' | 'normal' | 'fast';
  italic?: boolean;
}

export function Marquee1({ data, sectionIndex }: { data: Marquee1Data; sectionIndex?: number }) {
  const items: string[] = (data.items && data.items.length > 0) ? data.items : ['Première prestation', 'Deuxième prestation', 'Troisième prestation'];
  const sep = data.separator ?? '★';
  const speed = data.speed ?? 'normal';
  const durationMap = { slow: '40s', normal: '24s', fast: '12s' };
  const duration = durationMap[speed];
  const bgColor = data.bg_color || '#0f0e0d';
  const textColor = data.text_color || '#d4b483';

  const repeated = [...items, ...items, ...items, ...items];

  return (
    <section
      id={sectionIndex !== undefined ? `section-${sectionIndex}` : undefined}
      className="overflow-hidden py-4"
      style={{ backgroundColor: bgColor }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `sde-marquee ${duration} linear infinite`,
          willChange: 'transform',
        }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-4 text-sm font-medium tracking-widest uppercase px-4 ${data.italic ? 'italic' : ''}`}
            style={{ color: textColor, flexShrink: 0 }}
          >
            {item}
            <span className="opacity-60" style={{ color: textColor }}>{sep}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── SectionWrapper ──────────────────────────────────────────────────────────
const PATTERN_SCALE_MAP: Record<string, number> = {
  small: 20,
  normal: 40,
  large: 80,
  xlarge: 120,
};

function SVGPatternOverlay({
  pattern,
  isDark,
  scale,
  opacity,
  sectionIndex,
}: {
  pattern: string;
  isDark: boolean;
  scale: string;
  repeat?: string;
  opacity: number;
  sectionIndex?: number;
}) {
  const color = isDark ? '#ffffff' : '#000000';
  const size = PATTERN_SCALE_MAP[scale] || 40;
  const patternId = `svg-pat-${pattern}-${sectionIndex ?? Math.random().toString(36).substring(2, 7)}`;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-300"
      style={{ opacity: opacity ? opacity / 100 : 0.18 }}
    >
      <defs>
        <pattern
          id={patternId}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          {pattern === 'dots' && <circle cx={size / 4} cy={size / 4} r={Math.max(size / 20, 1.5)} fill={color} />}
          {pattern === 'grid' && <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={color} strokeWidth="1" />}
          {pattern === 'blueprint' && (
            <>
              <path d={`M ${size} 0 L 0 0 0 ${size}`} fill="none" stroke={color} strokeWidth="0.8" />
              <path d={`M ${size / 2} 0 L ${size / 2} ${size} M 0 ${size / 2} L ${size} ${size / 2}`} fill="none" stroke={color} strokeWidth="0.4" strokeDasharray="2,2" />
            </>
          )}
          {pattern === 'waves' && <path d={`M 0 ${size / 2} Q ${size / 4} ${size}, ${size / 2} ${size / 2} T ${size} ${size / 2}`} fill="none" stroke={color} strokeWidth="1" />}
          {pattern === 'topography' && (
            <>
              <path d={`M 0 ${size / 3} Q ${size / 4} 0 ${size / 2} ${size / 3} T ${size} ${size / 3}`} fill="none" stroke={color} strokeWidth="1" />
              <path d={`M 0 ${(2 * size) / 3} Q ${size / 3} ${size} ${(2 * size) / 3} ${(2 * size) / 3} T ${size} ${(2 * size) / 3}`} fill="none" stroke={color} strokeWidth="1" />
            </>
          )}
          {pattern === 'diagonal' && <path d={`M 0 ${size} L ${size} 0`} stroke={color} strokeWidth="1" />}
          {pattern === 'hexagons' && (
            <path
              d={`M ${size / 2} 0 L ${size} ${size / 4} L ${size} ${(3 * size) / 4} L ${size / 2} ${size} L 0 ${(3 * size) / 4} L 0 ${size / 4} Z`}
              fill="none"
              stroke={color}
              strokeWidth="1"
            />
          )}
          {pattern === 'crosses' && (
            <path
              d={`M ${size / 2} ${size / 4} V ${(3 * size) / 4} M ${size / 4} ${size / 2} H ${(3 * size) / 4}`}
              stroke={color}
              strokeWidth="1.2"
            />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

const THEME_CLASSES: Record<string, string> = {
  light: 'bg-[var(--brand-bg,#ffffff)] text-[var(--brand-text,#1c1917)]',
  dark: 'bg-[var(--brand-text,#1c1917)] text-[var(--brand-bg,#ffffff)]',
  surface: 'bg-[var(--brand-surface,#f5f5f4)] text-[var(--brand-text,#1c1917)]',
  primary: 'bg-[var(--brand-primary,#0f0e0d)] text-white',
};

export function SectionWrapper({
  data,
  sectionIndex,
  children,
  className = "",
  contentClassName = ""
}: {
  data: any;
  sectionIndex?: number;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const bgImage = data?.bg_image;
  const bgOpacity = data?.bg_image_opacity !== undefined ? data.bg_image_opacity : 50;
  const bgPosition = data?.bg_image_position || 'center';
  const bgColor = data?.bg_color;
  const bgPattern = data?.bg_pattern;
  const bgPatternScale = data?.bg_pattern_scale || 'normal';
  const bgPatternRepeat = data?.bg_pattern_repeat || 'repeat';
  const bgPatternOpacity = data?.bg_pattern_opacity !== undefined ? Number(data.bg_pattern_opacity) : 12;

  const theme = data?.theme || 'light';
  const isDark = theme === 'dark' || theme === 'primary';
  const themeClass = THEME_CLASSES[theme] || THEME_CLASSES.light;

  const density = data?.density ?? LAYOUT_DEFAULTS.density;
  const width = data?.width ?? LAYOUT_DEFAULTS.width;
  const align = data?.align ?? LAYOUT_DEFAULTS.align;

  const explicitDensity = data?.density as keyof typeof DENSITY_CLASS | undefined;
  const setsOwnPadding = /\bpy-|\bpt-|\bpb-/.test(className);

  const sectionClassName = explicitDensity
    ? className
        .replace(/(^|\s)(?:[a-z0-9]+:)?p[ytb]-\S+/g, '$1')
        .replace(explicitDensity === 'none' ? /(^|\s)(?:[a-z0-9]+:)?p[xlr]-\S+/g : /(?!)/g, '$1')
        .trim()
    : className;
  const densityClass = explicitDensity
    ? DENSITY_CLASS[explicitDensity] ?? ''
    : setsOwnPadding
      ? ''
      : DENSITY_CLASS[density as keyof typeof DENSITY_CLASS] ?? '';
  const widthClass = WIDTH_CLASS[width as keyof typeof WIDTH_CLASS] ?? '';
  const alignClass = ALIGN_CLASS[align as keyof typeof ALIGN_CLASS] ?? '';

  const legacyScale = (data?.text_scale ?? data?.cards_text_scale) as string | undefined;
  const cardsTextSize =
    (data?.cards_text_size as string | undefined)?.trim()
    || (legacyScale === 'small' ? '0.875rem' : legacyScale === 'large' ? '1.125rem' : '');
  const cardsTitleSize =
    (data?.cards_title_size as string | undefined)?.trim()
    || (cardsTextSize ? `calc(${cardsTextSize} * ${CARD_TITLE_RATIO})` : '');

  React.useEffect(() => {
    if (sectionIndex === 0 && typeof window !== 'undefined') {
      const event = new CustomEvent('sde:heroColor', { detail: theme });
      window.dispatchEvent(event);
    }
  }, [sectionIndex, theme]);

  return (
    <section
      id={sectionIndex !== undefined ? `section-${sectionIndex}` : undefined}
      className={`relative overflow-hidden transition-colors duration-300 ${themeClass} ${sectionClassName}`}
      style={{
        backgroundColor: bgColor || undefined,
      }}
    >
      {bgPattern && bgPattern !== 'none' && (
        <SVGPatternOverlay
          pattern={bgPattern}
          isDark={isDark}
          scale={bgPatternScale}
          repeat={bgPatternRepeat}
          opacity={bgPatternOpacity}
          sectionIndex={sectionIndex}
        />
      )}

      {bgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <EditableImage
            sectionIndex={sectionIndex}
            fieldPath="bg_image"
            src={bgImage}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: bgOpacity / 100, objectPosition: bgPosition }}
          />
          <div
            className={`absolute inset-0 ${
              isDark
                ? 'bg-gradient-to-b from-stone-900/60 via-stone-900/40 to-stone-900/80'
                : 'bg-gradient-to-b from-white/60 via-white/40 to-white/80'
            }`}
          />
        </div>
      )}
      {/*
        `data-density` / `data-width` ne sont posés que si l'utilisateur a
        réellement choisi la valeur dans le constructeur. Ils servent de
        marqueur d'exclusion pour la feuille de style globale : sans eux, le
        rythme et la largeur réglés dans « Design & Style » écrasaient — en
        `!important` — le choix fait section par section.
      */}
      <div
        data-section
        data-density={explicitDensity ?? undefined}
        className={`relative z-10 h-full w-full ${densityClass}`}
      >
        <div
          data-container
          data-block-stack
          data-width={data?.width ? width : undefined}
          /* Sans marge latérale demandée, le gabarit global ne doit pas en
             réimposer une : `GlobalStyles` exclut les conteneurs marqués. */
          data-gutter={explicitDensity === 'none' ? 'none' : undefined}
          /*
            La taille des cartes passe par deux variables CSS et une règle de
            `index.css` : une classe Tailwind ne peut pas l'emporter sur les
            règles typographiques `!important` de `GlobalStyles`.
          */
          data-cards-text-size={cardsTextSize || undefined}
          data-cards-title-size={cardsTitleSize || undefined}
          style={cardsTextSize || cardsTitleSize ? ({
            ...(cardsTextSize ? { ['--cards-text' as string]: cardsTextSize } : {}),
            ...(cardsTitleSize ? { ['--cards-title' as string]: cardsTitleSize } : {}),
          }) : undefined}
          className={`${widthClass} ${alignClass} ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// ─── Lightbox ──────────────────────────────────────────────────────────────────
interface LightboxImage {
  src: string;
  title?: string;
  description?: string;
}

function Lightbox({
  images,
  initialIndex,
  onClose
}: {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  const current = images[index];

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[99999] flex flex-col justify-between p-6 select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center text-white/80 z-10">
        <span className="text-sm font-medium">
          {index + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Image View */}
      <div className="flex-1 flex items-center justify-center relative my-4">
        {images.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-4 p-3 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronLeft size={36} />
          </button>
        )}

        <motion.img
          key={index}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          src={current?.src}
          alt={current?.title || ""}
          className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {images.length > 1 && (
          <button
            onClick={next}
            className="absolute right-4 p-3 hover:bg-white/10 text-white rounded-full transition-colors cursor-pointer z-10"
          >
            <ChevronRight size={36} />
          </button>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="text-center text-white max-w-2xl mx-auto z-10 bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
        {current?.title && (
          <h4 className="font-serif text-xl font-bold mb-1">{current.title}</h4>
        )}
        {current?.description && (
          <p className="text-stone-300 text-sm font-light leading-relaxed">{current.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── hero_1 ───────────────────────────────────────────────────────────────────
export interface Hero1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  title_italic?: string;
  description?: string;
  cta_primary_text?: string;
  cta_primary_href?: string;
  cta_secondary_text?: string;
  cta_secondary_href?: string;
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
  image_opacity?: number;
  button_style?: ButtonVariant | 'green' | 'white';
  proof_rating?: number;
  proof_text?: string;
  /** Part de largeur prise par l'image sur grand écran. */
  image_width?: HeroImageWidth;
  /** Côté où se place l'image. */
  image_side?: 'left' | 'right';
  /** Largeur du bloc de texte — décide de l'ampleur du recouvrement. */
  text_box_width?: HeroTextWidth;
  /** Le texte reste-t-il à côté, mord-il un peu, ou passe-t-il par-dessus ? */
  text_overlap?: HeroTextOverlap;
}

export function Hero1({ data, sectionIndex }: { data: Hero1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const hasImage = !!(data.image_url && !data.bg_image);

  /*
    Répartition image / texte. Les valeurs par défaut reproduisent exactement le
    rendu d'origine — 58 % pour l'image, à gauche, sans recouvrement — pour que
    les pages déjà en ligne ne bougent pas.
  */
  const imageRight = data.image_side === 'right';
  const overlap = data.text_overlap ?? 'none';
  /*
    Deux défauts distincts pour ne rien déplacer sur les pages en ligne : le
    bloc était plus large quand le texte passait sur l'image, plus étroit sinon.
  */
  const textWidthClass =
    HERO_TEXT_WIDTH_CLASS[data.text_box_width ?? (overlap === 'over' ? 'medium' : 'narrow')];
  const widthClass = data.image_width
    ? (imageRight ? HERO_IMAGE_WIDTH_CLASS_RIGHT : HERO_IMAGE_WIDTH_CLASS)[data.image_width]
    : imageRight ? 'lg:grid-cols-[42%_58%]' : 'lg:grid-cols-[58%_42%]';

  /*
    Sur petit écran, image et texte s'empilent : la colonne garde donc toujours
    le fond du thème. C'est seulement à partir de `lg`, quand le recouvrement
    existe, que la colonne s'efface au profit du bloc de texte.
  */
  const themeBg = dark ? 'bg-stone-900' : 'bg-white';
  const columnBg = overlap === 'over' ? `${themeBg} lg:bg-transparent` : themeBg;
  const columnPadding =
    overlap === 'over'
      ? 'px-8 lg:px-0 py-28 pt-36 lg:py-16'
      : 'px-8 lg:px-16 xl:px-20 py-28 pt-36 lg:pt-28';

  // Le texte mord sur l'image en se décalant vers elle, et passe au-dessus.
  const overlapClass =
    overlap === 'none' ? ''
    : overlap === 'slight'
      ? `relative z-10 ${imageRight ? 'lg:mr-[-6%]' : 'lg:ml-[-6%]'}`
      : `relative z-10 ${imageRight ? 'lg:mr-[-16%]' : 'lg:ml-[-16%]'}`;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="overflow-hidden">
      <div style={{ minHeight: '100svh' }} className={`relative grid ${widthClass} items-stretch`}>

        {/* ── Image column ── */}
        {hasImage ? (
          <div className={`relative overflow-hidden min-h-[60vw] lg:min-h-0 ${imageRight ? 'lg:order-last' : ''}`}>
            <EditableImage
              sectionIndex={sectionIndex} fieldPath="image_url"
              src={data.image_url!} alt={data.image_alt || data.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: (data.image_opacity ?? 85) / 100 }}
              initialPosition={data.image_url_pos}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 via-transparent to-transparent pointer-events-none" />
            <div className={`absolute inset-0 bg-gradient-to-r ${dark ? 'from-transparent to-stone-900/30' : 'from-transparent to-white/20'} pointer-events-none`} />
          </div>
        ) : (
          <div className={`hidden lg:block ${imageRight ? 'lg:order-last' : ''} ${dark ? 'bg-stone-800' : 'bg-stone-100'}`} />
        )}

        {/* ── Text column ── */}
        {/*
          Par-dessus l'image, c'est le **bloc de texte** qui porte le fond, pas
          la colonne : un fond translucide sur toute la hauteur laissait
          transparaître la photo derrière le titre, et la colonne courait du
          haut en bas de l'écran sans rapport avec la longueur du texte. Le bloc
          est ici opaque et se contente de la place qu'il lui faut, avec de la
          marge autour.
        */}
        <div className={`flex items-center ${columnPadding} ${overlapClass} ${columnBg}`}>
          <motion.div
            /*
              `container-type: inline-size` fait de ce bloc l'unité de mesure du
              titre et du paragraphe : leurs `clamp(..cqw..)` se calculent sur sa
              largeur, pas sur celle de l'écran. C'est ce qui fait qu'élargir la
              colonne agrandit vraiment le texte, sur mobile comme sur desktop.
            */
            style={{ containerType: 'inline-size' }}
            className={`w-full ${textWidthClass} ${
              overlap === 'over'
                ? `lg:px-12 lg:py-14 ${dark ? 'lg:bg-stone-900' : 'lg:bg-white'}`
                : ''
            }`}
            initial="hidden"
            animate="visible"
            variants={anim.container}
          >
            <motion.div variants={anim.item}>
              <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>

            {/*
              Le titre entrait mot à mot, chaque mot enveloppé dans son propre
              `motion.span`. Deux conséquences : l'effet passait outre le réglage
              « Animation » de la section, et surtout le titre n'était plus
              modifiable en ligne — le découpage remplaçait `EditableText` par du
              texte brut. Il apparaît maintenant d'un bloc, comme les autres.
            */}
            <motion.h1
              variants={anim.item}
              style={getTitleFontStyle(data) || { fontSize: HERO_FLUID_TITLE }}
              className={getTitleFontClass(data, `font-serif font-bold tracking-tight leading-[1.1] mb-8 break-words ${dark ? 'text-white' : 'text-stone-900'}`)}
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
              {data.title_italic && (
                <span className="block italic font-light text-sage mt-1">
                  <EditableText sectionIndex={sectionIndex} fieldPath="title_italic" value={data.title_italic} as="span" />
                </span>
              )}
            </motion.h1>

            <motion.div variants={anim.item} className="h-px w-10 bg-sage mb-8" />

            {data.description && (
              <motion.p
                variants={anim.item}
                style={getContentFontStyle(data) || { fontSize: HERO_FLUID_DESCRIPTION }}
                className={getContentFontClass(data, `font-light leading-relaxed mb-12 ${dark ? 'text-stone-300' : 'text-stone-500'}`)}
              >
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}

            {(data.cta_primary_text || data.cta_secondary_text) && (
              <motion.div variants={anim.item} className="flex flex-col sm:flex-row items-start gap-4">
                {data.cta_primary_text && (
                  <a data-btn={buttonVariantOf(data.button_style)} href={data.cta_primary_href ?? '#'}
                    className={`group inline-flex items-center gap-3 px-9 py-4 rounded-full font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900 hover:bg-stone-100 shadow-white/20' : 'bg-sage text-white hover:shadow-sage/30'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="cta_primary_text" value={data.cta_primary_text} as="span" />
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                )}
                {data.cta_secondary_text && (
                  <a data-btn="secondary" href={data.cta_secondary_href ?? '#'}
                    className={`inline-flex items-center gap-3 px-9 py-4 rounded-full font-bold transition-all duration-300 cursor-pointer border ${dark ? 'border-white/20 text-white hover:border-white/40 hover:bg-white/8' : 'border-stone-200 text-stone-700 hover:border-stone-400'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="cta_secondary_text" value={data.cta_secondary_text} as="span" />
                  </a>
                )}
              </motion.div>
            )}

            {(data.proof_rating || data.proof_text) && (
              <motion.div variants={anim.item} className="mt-8 flex items-center gap-3">
                {data.proof_rating ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} className={`w-4 h-4 ${s <= Math.round(data.proof_rating!) ? 'text-yellow-400' : dark ? 'text-stone-600' : 'text-stone-200'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-stone-900'}`}>{data.proof_rating.toFixed(1).replace('.0', '')}/5</span>
                  </div>
                ) : null}
                {data.proof_text && (
                  <span className={`text-xs font-light leading-snug ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="proof_text" value={data.proof_text} as="span" />
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}

// ─── hero_2 ───────────────────────────────────────────────────────────────────
export interface Hero2Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cta_text?: string;
  cta_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
  min_height?: number;
}

export function Hero2({ data, sectionIndex }: { data: Hero2Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 text-center overflow-hidden">
      <div style={{ minHeight: data.min_height ? `${data.min_height}px` : '100svh' }} className="flex flex-col items-center justify-center py-32 relative">
        {/* Decorative circle */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none ${dark ? 'bg-sage/8' : 'bg-sage/5'}`} />

        <motion.div className="relative z-10 max-w-4xl mx-auto" initial="hidden" animate="visible" variants={anim.container}>
          <motion.div variants={anim.item} className="flex justify-center">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>

          <motion.h1 variants={{ visible: { transition: { staggerChildren: 0.07 } } }} initial="hidden" animate="visible">
            {data.title.split(' ').reduce<string[][]>((lines, word, i) => {
              const lineIdx = Math.floor(i / 3);
              if (!lines[lineIdx]) lines[lineIdx] = [];
              lines[lineIdx].push(word);
              return lines;
            }, []).map((line, li) => (
              <div key={li} className="overflow-hidden">
                <motion.div
                  variants={{ hidden: { y: 60 }, visible: { y: 0, transition: { duration: 0.9, ease: EASE } } }}
                  style={getTitleFontStyle(data)}
                  className={getTitleFontClass(data, `font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight ${dark ? 'text-white' : 'text-stone-900'} ${li % 2 === 1 ? 'text-sage' : ''}`)}
                >
                  <EditableText sectionIndex={sectionIndex} fieldPath="title" value={line.join(' ')} as="span" />
                </motion.div>
              </div>
            ))}
          </motion.h1>

          {data.description && (
            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-xl font-light mt-10 mb-14 max-w-xl mx-auto leading-relaxed ${dark ? 'text-stone-300' : 'text-stone-500'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}
          {data.cta_text && (
            <motion.a variants={anim.item} data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
              className={`group inline-flex items-center gap-3 px-10 py-4 rounded-full font-bold shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900' : 'bg-sage text-white shadow-sage/25'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.a>
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── hero_3 ───────────────────────────────────────────────────────────────────
export interface Hero3Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  title_italic?: string;
  description?: string;
  items?: string[];
  cta_primary_text?: string;
  cta_primary_href?: string;
  cta_secondary_text?: string;
  cta_secondary_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
}

/** Titre centré puis portrait en arche — esprit institut / spa. */
export function Hero3({ data, sectionIndex }: { data: Hero3Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 overflow-hidden">
      <div className={`max-w-3xl mx-auto pt-36 pb-24 lg:pt-40 lg:pb-28 text-center ${dark ? 'text-white' : ''}`}>
        <motion.div initial="hidden" animate="visible" variants={anim.container}>
          <motion.div variants={anim.item} className="flex justify-center">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>

          <motion.h1
            variants={anim.item}
            style={getTitleFontStyle(data)}
            className={getTitleFontClass(data, `font-serif text-4xl md:text-6xl font-bold leading-[1.08] tracking-tight ${t(dark, 'text-stone-900', 'text-white')}`)}
          >
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
            {data.title_italic && (
              <span className="block italic font-light text-sage mt-2">
                <EditableText sectionIndex={sectionIndex} fieldPath="title_italic" value={data.title_italic} as="span" />
              </span>
            )}
          </motion.h1>

          <motion.div variants={anim.item} className="h-px w-12 bg-sage/70 mx-auto my-8" />

          {data.description && (
            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light leading-relaxed max-w-xl mx-auto ${t(dark, 'text-stone-500', '')}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}

          {data.items && data.items.length > 0 && (
            <motion.ul variants={anim.item} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-9">
              {data.items.map((item, i) => (
                <li
                  key={i}
                  className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full border ${t(dark, 'border-stone-200 text-stone-500', 'border-white/15 text-stone-300')}`}
                >
                  <span className="w-1 h-1 rounded-full bg-sage shrink-0" />
                  <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}`} value={item} as="span" />
                </li>
              ))}
            </motion.ul>
          )}

          {(data.cta_primary_text || data.cta_secondary_text) && (
            <motion.div variants={anim.item} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-11">
              {data.cta_primary_text && (
                <a
                  data-btn={buttonVariantOf(data.button_style)} href={data.cta_primary_href ?? '#'}
                  className={`group inline-flex items-center gap-3 px-9 py-4 rounded-full font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900 hover:bg-stone-100' : 'bg-sage text-white hover:shadow-sage/30'}`}
                >
                  <EditableText sectionIndex={sectionIndex} fieldPath="cta_primary_text" value={data.cta_primary_text} as="span" />
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              )}
              {data.cta_secondary_text && (
                <a
                  data-btn="secondary" href={data.cta_secondary_href ?? '#'}
                  className={`inline-flex items-center gap-3 px-9 py-4 rounded-full font-bold transition-all duration-300 cursor-pointer border ${t(dark, 'border-stone-200 text-stone-700 hover:border-stone-400', 'border-white/20 text-white hover:border-white/40 hover:bg-white/8')}`}
                >
                  <EditableText sectionIndex={sectionIndex} fieldPath="cta_secondary_text" value={data.cta_secondary_text} as="span" />
                </a>
              )}
            </motion.div>
          )}
        </motion.div>

        {data.image_url && (
          <motion.div
            initial={anim.instant ? false : { opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim.instant ? { duration: 0 } : { duration: 1, ease: EASE, delay: 0.3 }}
            className="relative z-10 mx-auto mt-16 w-full max-w-sm"
          >
            <div className={`relative overflow-hidden rounded-t-[13rem] rounded-b-3xl aspect-[3/4] shadow-2xl ring-1 ${t(dark, 'ring-stone-200', 'ring-white/10')}`}>
              <EditableImage
                sectionIndex={sectionIndex}
                fieldPath="image_url"
                src={data.image_url}
                alt={data.image_alt || data.title}
                className="w-full h-full object-cover"
                initialPosition={data.image_url_pos}
                loading="lazy"
              />
            </div>
          </motion.div>
        )}
      </div>
    </SectionWrapper>
  );
}

// ─── hero_4 ───────────────────────────────────────────────────────────────────
export interface Hero4Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  title_italic?: string;
  description?: string;
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
  image_opacity?: number;
  card_title?: string;
  card_text?: string;
  cta_text?: string;
  cta_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
  min_height?: number;
}

/** Photo plein cadre, titre ancré en bas et carte d'informations flottante. */
export function Hero4({ data, sectionIndex }: { data: Hero4Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  // Même règle que hero_1 : l'image de fond de section prend le pas sur la photo.
  const hasImage = !!(data.image_url && !data.bg_image);
  // Texte clair dès qu'il repose sur une photo, sinon selon le thème.
  const onDark = hasImage || dark;
  const hasCard = !!(data.card_title || data.card_text || data.cta_text);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="overflow-hidden">
      <div
        style={{ minHeight: data.min_height ? `${data.min_height}px` : '100svh' }}
        className="relative flex items-end"
      >
        {hasImage && (
          <>
            <EditableImage
              sectionIndex={sectionIndex}
              fieldPath="image_url"
              src={data.image_url!}
              alt={data.image_alt || data.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: (data.image_opacity ?? 100) / 100 }}
              initialPosition={data.image_url_pos}
            />
            {/* Voile assez dense pour que le texte reste lisible quelle que soit
                la photo (les zones claires rendaient la description illisible). */}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/55 to-stone-900/20 pointer-events-none" />
          </>
        )}

        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 lg:px-14 pt-40 pb-16 lg:pb-20 grid lg:grid-cols-[1fr_auto] items-end gap-10 lg:gap-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={anim.container}
            /* `text-white` doit être posé ici et non sur le <p> : GlobalStyles
               impose `body, p { color: … }` hors @layer, ce qui bat les classes
               Tailwind ; seul `.text-white p { color: inherit !important }`
               laisse le paragraphe hériter. */
            className={`max-w-2xl ${onDark ? 'text-white' : ''} ${hasImage ? '[text-shadow:0_2px_18px_rgb(0_0_0_/_0.45)]' : ''}`}
          >
            <motion.div variants={anim.item}>
              <Eyebrow text={data.eyebrow} dark={onDark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>

            <motion.h1
              variants={anim.item}
              style={getTitleFontStyle(data)}
              className={getTitleFontClass(data, `font-serif text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight ${onDark ? 'text-white' : 'text-stone-900'}`)}
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
              {data.title_italic && (
                <span className={`block italic font-light mt-2 ${onDark ? 'text-white/70' : 'text-sage'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath="title_italic" value={data.title_italic} as="span" />
                </span>
              )}
            </motion.h1>

            {data.description && (
              <motion.p
                variants={anim.item}
                style={getContentFontStyle(data)}
                className={getContentFontClass(data, `text-lg font-light leading-relaxed mt-7 max-w-lg ${onDark ? '' : 'text-stone-500'}`)}
              >
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}
          </motion.div>

          {hasCard && (
            <motion.div
              initial={anim.instant ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={anim.instant ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.35 }}
              className={`w-full lg:w-80 rounded-3xl p-7 shadow-2xl backdrop-blur-md ${dark ? 'bg-stone-900/85 text-white ring-1 ring-white/10' : 'bg-white/95'}`}
            >
              {data.card_title && (
                <p className={`font-serif text-xl font-bold leading-snug ${dark ? 'text-white' : 'text-stone-900'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath="card_title" value={data.card_title} as="span" />
                </p>
              )}
              {data.card_text && (
                <p className={`text-sm font-light leading-relaxed mt-3 ${dark ? 'opacity-80' : 'text-stone-500'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath="card_text" value={data.card_text} />
                </p>
              )}
              {data.cta_text && (
                <a
                  data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
                  className={`group mt-6 flex items-center justify-center gap-2.5 w-full px-6 py-3.5 rounded-full font-bold transition-all duration-300 cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-stone-900 text-white hover:bg-stone-800' : 'bg-sage text-white hover:shadow-lg hover:shadow-sage/30'}`}
                >
                  <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}

// ─── hero_5 ───────────────────────────────────────────────────────────────────
export interface Hero5Data {
  button_style?: ButtonVariant | 'green' | 'white';
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  cta_text?: string;
  cta_href?: string;
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
  image_opacity?: number;
  min_height?: number;
}

/** Bandeau compact pour les pages intérieures — hauteur mesurée, pas de plein écran. */
export function Hero5({ data, sectionIndex }: { data: Hero5Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const hasImage = !!(data.image_url && !data.bg_image);
  const onDark = hasImage || dark;
  const centered = (data.align ?? 'center') === 'center';

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="overflow-hidden">
      <div
        style={{ minHeight: data.min_height ? `${data.min_height}px` : '420px' }}
        className="relative flex items-center px-6"
      >
        {hasImage && (
          <>
            <EditableImage
              sectionIndex={sectionIndex}
              fieldPath="image_url"
              src={data.image_url!}
              alt={data.image_alt || data.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: (data.image_opacity ?? 100) / 100 }}
              initialPosition={data.image_url_pos}
            />
            <div className="absolute inset-0 bg-stone-900/65 pointer-events-none" />
          </>
        )}

        <motion.div
          initial="hidden"
          animate="visible"
          variants={anim.container}
          className={`relative z-10 w-full max-w-4xl pt-28 pb-14 ${centered ? 'mx-auto text-center' : 'mr-auto lg:pl-8'} ${onDark ? 'text-white' : ''} ${hasImage ? '[text-shadow:0_2px_18px_rgb(0_0_0_/_0.45)]' : ''}`}
        >
          <motion.div variants={anim.item} className={centered ? 'flex justify-center' : ''}>
            <Eyebrow text={data.eyebrow} dark={onDark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>

          <motion.h1
            variants={anim.item}
            style={getTitleFontStyle(data)}
            className={getTitleFontClass(data, `font-serif text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight ${onDark ? 'text-white' : 'text-stone-900'}`)}
          >
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </motion.h1>

          <motion.div variants={anim.item} className={`h-px w-10 bg-sage my-6 ${centered ? 'mx-auto' : ''}`} />

          {data.description && (
            <motion.p
              variants={anim.item}
              className={`text-base md:text-lg font-light leading-relaxed max-w-2xl ${centered ? 'mx-auto' : ''} ${onDark ? '' : 'text-stone-500'}`}
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}

          {data.cta_text && (
            <motion.a
              variants={anim.item}
              data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
              className={`group inline-flex items-center gap-2 mt-8 text-sm font-bold uppercase tracking-widest border-b pb-1 transition-colors cursor-pointer ${onDark ? 'text-white border-white/40 hover:border-white' : 'text-sage border-sage/40 hover:border-sage'}`}
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </motion.a>
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── intro_1 ──────────────────────────────────────────────────────────────────
export interface Intro1Data {
  button_style?: ButtonVariant | 'green' | 'white';
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  quote: string;
  text: string;
  cta_text?: string;
  cta_href?: string;
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
  image_position?: 'left' | 'right';
}

export function Intro1({ data, sectionIndex }: { data: Intro1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const isImageRight = (data as any).image_side === 'right' || data.image_position === 'right';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[52%_48%] items-stretch min-h-[75vh]">

        {/* Image column — bords à vif */}
        <div className={`relative overflow-hidden min-h-[60vw] md:min-h-0 ${isImageRight ? 'md:order-last' : 'md:order-first'}`}>
          {data.image_url
            ? (
              <>
                <motion.div
                  className="absolute inset-0"
                  initial={{ scale: 1.06 }} whileInView={{ scale: 1 }}
                  viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
                >
                  <EditableImage sectionIndex={sectionIndex} fieldPath="image_url" src={data.image_url} alt={data.image_alt || data.quote}
                    className="w-full h-full object-cover" loading="lazy" initialPosition={data.image_url_pos} />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/30 to-transparent pointer-events-none" />
              </>
            )
            : <div className={`w-full h-full ${dark ? 'bg-stone-800' : 'bg-stone-100'}`} />
          }
        </div>

        {/* Text column */}
        <motion.div
          className={`flex items-center px-8 md:px-12 lg:px-16 xl:px-20 py-16 md:py-20 ${dark ? 'bg-stone-900' : 'bg-white'} ${isImageRight ? 'md:order-first' : 'md:order-last'}`}
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={anim.container}
        >
          <div className="max-w-lg">
            <motion.div variants={anim.item}>
              <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>

            {/* Pull-quote style heading */}
            <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-8 ${dark ? 'text-white' : 'text-stone-900'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="quote" value={data.quote} />
            </motion.h2>

            <motion.div variants={anim.item} className="h-px w-12 bg-sage mb-9" />

            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light leading-relaxed mb-10 ${dark ? 'text-stone-300' : 'text-stone-500'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="text" value={data.text} />
            </motion.p>

            {data.cta_text && (
              <motion.a variants={anim.item} data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
                className="group inline-flex items-center gap-3 font-bold uppercase tracking-widest text-xs text-sage transition-all duration-300 cursor-pointer">
                <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </motion.a>
            )}
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── features_1 ───────────────────────────────────────────────────────────────
export interface Features1Data {
  button_style?: ButtonVariant | 'green' | 'white';
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  quote?: string;
  items?: string[];
  cta_text?: string;
  cta_href?: string;
  show_image?: boolean;
  image_url?: string;
  image_url_pos?: string;
  image_alt?: string;
  image_position?: 'left' | 'right';
  image_side?: 'left' | 'right';
  title_size?: string;
  content_size?: string;
  stretch_image?: boolean;
}

export function Features1({ data, sectionIndex }: { data: Features1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const showImg = (data.show_image !== false) && !!data.image_url;
  const isImageRight = (data as any).image_side === 'right' || data.image_position === 'right';
  const stretchImg = !!data.stretch_image;

  const content = (
    <motion.div className={showImg ? "w-full" : "max-w-2xl mx-auto"} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={anim.container}>
      <motion.div variants={anim.item}>
        <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
      </motion.div>
      <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-4xl md:text-5xl font-bold mb-6 leading-tight ${dark ? 'text-white' : 'text-stone-900'}`)}>
        <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
      </motion.h2>
      <motion.div variants={anim.item} className="h-px w-10 bg-sage mb-8" />
      {data.description && (
        <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light leading-relaxed mb-8 ${dark ? 'text-stone-300' : 'text-stone-500'}`)}>
          <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
        </motion.p>
      )}
      {data.quote && (
        <motion.blockquote variants={anim.item} className={`relative pl-6 border-l-2 border-sage italic mb-10 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
          <p className="font-serif text-xl leading-relaxed">
            "<EditableText sectionIndex={sectionIndex} fieldPath="quote" value={data.quote} as="span" />"
          </p>
        </motion.blockquote>
      )}
      {data.items && data.items.length > 0 && (
        <motion.ul variants={anim.container} className="space-y-0 mb-10">
          {data.items.map((item, i) => (
            <motion.li key={i} variants={anim.item}
              className={`flex items-start gap-5 py-4 border-b last:border-0 ${dark ? 'border-stone-800' : 'border-stone-100'}`}>
              <span className={`font-serif text-xs font-bold tabular-nums mt-0.5 shrink-0 ${dark ? 'text-stone-500' : 'text-stone-300'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`text-base font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}`} value={item} as="span" />
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
      {data.cta_text && (
        <motion.a variants={anim.item} data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
          className="group inline-flex items-center gap-3 font-bold uppercase tracking-widest text-xs text-sage transition-all duration-300 cursor-pointer">
          <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
        </motion.a>
      )}
    </motion.div>
  );

  if (showImg) {
    const gridCols = isImageRight ? 'md:grid-cols-[1fr_480px]' : 'md:grid-cols-[480px_1fr]';
    return (
      <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6"
        contentClassName={`max-w-6xl mx-auto grid grid-cols-1 ${gridCols} gap-12 lg:gap-16 ${stretchImg ? 'items-stretch' : 'items-center'}`}>
        <div className={`relative overflow-hidden rounded-3xl ${isImageRight ? 'md:order-last' : 'md:order-first'} ${stretchImg ? 'h-full min-h-[350px]' : 'h-[55vw] lg:h-[520px] min-h-[300px]'}`}>
          <EditableImage sectionIndex={sectionIndex} fieldPath="image_url" src={data.image_url!} alt={data.image_alt || data.title}
            className="w-full h-full object-cover" loading="lazy" initialPosition={data.image_url_pos} />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 to-transparent pointer-events-none" />
        </div>
        <div className={`flex flex-col justify-center ${isImageRight ? 'md:order-first' : 'md:order-last'}`}>{content}</div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
      {content}
    </SectionWrapper>
  );
}

// ─── features_2 ───────────────────────────────────────────────────────────────
export interface Features2Card {
  title: string;
  description: string;
  icon?: string;
  icon_image?: string;
  icon_image_bleed?: boolean;
  link_text?: string;
  link_href?: string;
  theme?: 'light' | 'dark';
}

export interface Features2Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cards: Features2Card[];
  show_image?: boolean;
  image_url?: string;
  image_url_pos?: string;
  image_alt?: string;
  image_position?: 'left' | 'right';
  image_side?: 'left' | 'right';
  title_size?: string;
  content_size?: string;
  cards_theme?: 'light' | 'dark';
  /** Fond des cartes, choisi dans la charte. Vide = suit `cards_theme`. */
  cards_bg_color?: string;
  /** Taille du texte dans les cartes. */
  cards_text_scale?: 'small' | 'normal' | 'large';
  stretch_image?: boolean;
}

export function Features2({ data, sectionIndex }: { data: Features2Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const showImg = (data.show_image !== false) && !!data.image_url;
  const isImageRight = (data as any).image_side === 'right' || data.image_position === 'right';
  const cardsTheme = data.cards_theme || (dark ? 'dark' : 'light');
  const isCardsDark = cardsTheme === 'dark';
  const stretchImg = !!data.stretch_image;

  const cardGrid = (cols2 = false) => (
    <div data-cards className={`grid gap-5 ${cols2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
      {data.cards.map((card, i) => {
        const cardDark = card.theme !== undefined ? card.theme === 'dark' : isCardsDark;
        return (
          <motion.div
            key={i}
            data-surface
            initial={anim.instant ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.8, delay: i * 0.1, ease: EASE }}
            whileHover={{ y: -4 }}
            /* Une couleur choisie dans la charte l'emporte sur l'aplat clair/foncé. */
            style={data.cards_bg_color ? { backgroundColor: data.cards_bg_color } : undefined}
            className={`group relative rounded-3xl border overflow-hidden transition-all duration-400 cursor-default ${cardDark ? 'bg-stone-800 border-stone-700 text-white hover:border-sage/40' : 'bg-white border-stone-100 text-stone-900 hover:border-sage/25 hover:shadow-lg'}`}
          >
            {/* Number badge — masqué si une image de carte est présente (contraste imprévisible) */}
            {!card.icon_image && (
              <span className={`absolute top-6 right-7 font-serif text-xs font-bold tabular-nums ${cardDark ? 'text-stone-600' : 'text-stone-200'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
            )}
            {card.icon_image && (
              <div className={card.icon_image_bleed ? 'w-full aspect-[16/10]' : 'w-full aspect-[16/10] px-5 pt-5'}>
                <EditableImage
                  sectionIndex={sectionIndex}
                  fieldPath={`cards.${i}.icon_image`}
                  src={card.icon_image}
                  alt={card.title || ''}
                  className={`w-full h-full object-cover ${card.icon_image_bleed ? '' : 'rounded-2xl'}`}
                  loading="lazy" decoding="async"
                />
              </div>
            )}
            <div className="p-8">
              {!card.icon_image && card.icon && (
                <div className="text-3xl mb-5 leading-none">
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.icon`} value={card.icon} as="span" />
                </div>
              )}
              <h3 className="font-serif text-xl font-bold mb-3">
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
              </h3>
              <p className={`text-sm font-light leading-relaxed ${cardDark ? 'text-stone-400' : 'text-stone-500'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
              </p>
              {card.link_text && (
                <div className="mt-5">
                  <a href={card.link_href || '#'} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sage group-hover:gap-2.5 transition-all duration-300 cursor-pointer">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.link_text`} value={card.link_text} as="span" />
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  if (showImg) {
    const gridCols = isImageRight ? 'md:grid-cols-[1fr_420px]' : 'md:grid-cols-[420px_1fr]';
    return (
      <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6"
        contentClassName={`max-w-6xl mx-auto grid grid-cols-1 ${gridCols} gap-12 lg:gap-16 ${stretchImg ? 'items-stretch' : 'items-center'}`}>
        <div className={`relative overflow-hidden rounded-3xl ${isImageRight ? 'md:order-last' : 'md:order-first'} ${stretchImg ? 'h-full min-h-[450px]' : 'h-[60vw] lg:h-[560px] min-h-[400px]'}`}>
          <EditableImage sectionIndex={sectionIndex} fieldPath="image_url" src={data.image_url!} alt={data.image_alt || data.title}
            className="w-full h-full object-cover" loading="lazy" initialPosition={data.image_url_pos} />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/20 to-transparent pointer-events-none" />
        </div>
        <div className={`flex flex-col justify-center ${isImageRight ? 'md:order-first' : 'md:order-last'}`}>
          <motion.div className="mb-10" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
            <motion.div variants={anim.item}><Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" /></motion.div>
            <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold mb-4 leading-tight ${dark ? 'text-white' : 'text-stone-900'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
            </motion.h2>
            {data.description && (
              <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light ${dark ? 'text-stone-400' : 'text-stone-500'}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}
          </motion.div>
          {cardGrid(true)}
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
          <motion.div variants={anim.item} className="flex justify-center">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>
          <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-4xl md:text-5xl font-bold mb-5 ${dark ? 'text-white' : 'text-stone-900'}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </motion.h2>
          {data.description && (
            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light max-w-xl mx-auto ${dark ? 'text-stone-400' : 'text-stone-500'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}
        </motion.div>
        {cardGrid(false)}
      </div>
    </SectionWrapper>
  );
}

// ─── features_3 ───────────────────────────────────────────────────────────────
export interface Features3Card {
  title: string;
  description: string;
  items?: string[];
  cta_text?: string;
  cta_href?: string;
  badge?: string;
  theme?: 'light' | 'dark';
}

export interface Features3Data {
  /** Taille du texte dans les cartes. */
  cards_text_scale?: 'small' | 'normal' | 'large';
  /** Fond des cartes, choisi dans la charte. Vide = suit le thème. */
  cards_bg_color?: string;
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  button_style?: ButtonVariant | 'green' | 'white';
  title: string;
  description?: string;
  cards: Features3Card[];
}

export function Features3({ data, sectionIndex }: { data: Features3Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
      <div className={`mx-auto ${data.cards.length >= 3 ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container} className="text-center mb-16">
          <motion.div variants={anim.item} className="flex justify-center">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>
          <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-4xl md:text-5xl font-bold mb-5 ${dark ? 'text-white' : 'text-stone-900'}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </motion.h2>
          {data.description && (
            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light max-w-xl mx-auto ${dark ? 'text-stone-400' : 'text-stone-500'}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}
        </motion.div>

        <div data-cards className={`grid md:grid-cols-2 gap-6 text-left ${data.cards.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
          {data.cards.map((card, i) => {
            const cardDark = card.theme !== undefined ? card.theme === 'dark' : dark;
            return (
              <motion.div
                key={i}
                data-surface
                initial={anim.instant ? false : { opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.9, delay: i * 0.13, ease: EASE }}
                whileHover={{ y: -5 }}
                style={data.cards_bg_color ? { backgroundColor: data.cards_bg_color } : undefined}
                className={`relative rounded-3xl p-10 flex flex-col justify-between transition-all duration-400 overflow-hidden ${cardDark ? 'bg-[#1a1714] border border-stone-800 hover:border-sage/30' : 'bg-white border border-stone-100 hover:border-sage/20 hover:shadow-xl'}`}
              >
                {card.badge && (
                  <span className="absolute top-7 right-7 bg-sage/10 text-sage px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">
                    {card.badge}
                  </span>
                )}
                <div>
                  <h3 className={`font-serif text-2xl font-bold mb-3 leading-snug ${cardDark ? 'text-white' : 'text-stone-900'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
                  </h3>
                  <p className={`font-light leading-relaxed mb-8 ${cardDark ? 'text-stone-400' : 'text-stone-500'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                  </p>
                  {card.items && (
                    <ul className="space-y-3 mb-10">
                      {card.items.map((li, j) => (
                        <li key={j} className={`flex items-start gap-3 text-sm ${cardDark ? 'text-stone-300' : 'text-stone-600'}`}>
                          <div className="w-4 h-4 rounded-full bg-sage/15 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-sage" />
                          </div>
                          <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.items.${j}`} value={li} as="span" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {card.cta_text && (
                  <a data-btn={buttonVariantOf(data.button_style)} href={card.cta_href ?? '#'}
                    className={`inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900 border border-stone-200 hover:bg-stone-50' : cardDark ? 'bg-sage text-white hover:shadow-lg hover:shadow-sage/25' : 'bg-stone-900 text-white hover:bg-sage'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.cta_text`} value={card.cta_text} as="span" />
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

// ─── cta_1 ────────────────────────────────────────────────────────────────────
export interface Cta1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cta_text: string;
  cta_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
}

export function Cta1({ data, sectionIndex }: { data: Cta1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme !== 'light';
  return (
    <SectionWrapper data={{ ...data, theme: data.theme ?? 'dark' }} sectionIndex={sectionIndex} className="relative py-32 lg:py-40 px-6 text-center overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sage/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

      <motion.div className="relative z-10 max-w-2xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
        <motion.div variants={anim.item} className="flex justify-center mb-8">
          <div className="h-px w-10 bg-sage/50" />
        </motion.div>
        <motion.div variants={anim.item}>
          {data.eyebrow && (
            <span className="inline-flex items-center gap-2 text-sage font-bold tracking-[0.38em] uppercase text-[10px] mb-5 block justify-center">
              <span className="w-4 h-px bg-sage/60" />
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} as="span" />
            </span>
          )}
        </motion.div>
        <motion.h2 variants={anim.item} className={`font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tight ${dark ? 'text-white' : 'text-stone-900'}`}>
          <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
        </motion.h2>
        {data.description && (
          <motion.p variants={anim.item} className={`text-lg font-light mb-12 max-w-lg mx-auto leading-relaxed ${dark ? 'text-white/50' : 'text-stone-500'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
          </motion.p>
        )}
        <motion.a variants={anim.item} data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
          className={`group inline-flex items-center gap-3 px-12 py-4 rounded-full font-bold shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900 shadow-white/15 hover:shadow-white/25' : 'bg-sage text-white shadow-sage/30 hover:shadow-sage/50'}`}>
          <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </motion.a>
      </motion.div>
    </SectionWrapper>
  );
}

// ─── testimonial_1 ────────────────────────────────────────────────────────────
export interface Testimonial1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  quote: string;
  author?: string;
  role?: string;
}

export function Testimonial1({ data, sectionIndex }: { data: Testimonial1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="relative py-28 lg:py-36 px-6 text-center overflow-hidden">
      {/* Background glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none ${dark ? 'bg-sage/8' : 'bg-sage/5'}`} />

      <motion.div
        className="relative z-10 max-w-2xl mx-auto"
        initial={anim.instant ? false : { opacity: 0 }} whileInView={{ opacity: 1 }}
        viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.8 }}
      >
        {/* Decorative lines */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className={`h-px w-12 ${dark ? 'bg-white/20' : 'bg-stone-200'}`} />
          <div className="w-1.5 h-1.5 rounded-full bg-sage" />
          <div className={`h-px w-12 ${dark ? 'bg-white/20' : 'bg-stone-200'}`} />
        </div>

        <motion.blockquote
          initial={anim.instant ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 1, delay: 0.1, ease: EASE }}
          className={`font-serif text-2xl md:text-3xl lg:text-4xl font-light italic leading-snug mb-10 ${dark ? 'text-white' : 'text-stone-800'}`}
        >
          "<EditableText sectionIndex={sectionIndex} fieldPath="quote" value={data.quote} as="span" />"
        </motion.blockquote>

        {data.author && (
          <motion.div
            initial={anim.instant ? false : { opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.7, delay: 0.3 }}
            className="flex flex-col items-center gap-1"
          >
            <div className={`h-px w-8 mb-3 ${dark ? 'bg-white/20' : 'bg-stone-200'}`} />
            <p className={`font-bold text-[11px] uppercase tracking-[0.35em] ${dark ? 'text-stone-300' : 'text-stone-700'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="author" value={data.author} as="span" />
            </p>
            {data.role && (
              <p className={`text-xs font-light ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="role" value={data.role} as="span" />
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </SectionWrapper>
  );
}

// ─── text_1 ───────────────────────────────────────────────────────────────────
export interface Text1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  content: string;
}

export function Text1({ data, sectionIndex }: { data: Text1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6">
      <motion.div className="max-w-2xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
        {(data.eyebrow || data.title) && (
          <div className="mb-8">
            <motion.div variants={anim.item}><Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" /></motion.div>
            {data.title && (
              <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold leading-tight mb-4 ${dark ? 'text-white' : 'text-stone-900'}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </motion.h2>
            )}
            <motion.div variants={anim.item} className="h-px w-8 bg-sage mb-6" />
          </div>
        )}
        <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-stone-500'}`)}>
          <EditableText sectionIndex={sectionIndex} fieldPath="content" value={data.content} />
        </motion.p>
      </motion.div>
    </SectionWrapper>
  );
}

// ─── text_image_1 ───────────────────────────────────────────────────────────
export interface TextImage1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  content: string;
  image_url?: string;
  image_alt?: string;
  image_url_pos?: string;
  image_position?: 'left' | 'right';
  image_side?: 'left' | 'right';
  title_size?: string;
  content_size?: string;
  ratio?: 'quarter' | 'third' | 'half';
  image_width?: number;
}

// Proportion de la colonne image (le texte occupe le reste)
const RATIO_IMAGE_FR: Record<NonNullable<TextImage1Data['ratio']>, string> = {
  quarter: '25%',
  third: '33.333%',
  half: '50%',
};

export function TextImage1({ data, sectionIndex }: { data: TextImage1Data, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const isImageRight = (data as any).image_side === 'right' || data.image_position === 'right';
  const imgFr = RATIO_IMAGE_FR[data.ratio ?? 'half'];
  const imgWidth = typeof data.image_width === 'number' ? data.image_width : 100;
  const gridCols = isImageRight ? `minmax(0,1fr) ${imgFr}` : `${imgFr} minmax(0,1fr)`;

  const prose = [
    '[&_h2]:font-serif [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:mt-8 [&_h2]:mb-4',
    '[&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-3',
    '[&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1',
    '[&_strong]:font-bold [&_em]:italic [&_a]:text-sage [&_a]:underline hover:[&_a]:text-sage/80',
    dark ? '[&_h2]:text-white [&_h3]:text-white' : '[&_h2]:text-stone-900 [&_h3]:text-stone-900',
  ].join(' ');

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:[grid-template-columns:var(--cols)] items-center gap-10 md:gap-16" style={{ ['--cols' as any]: gridCols }}>
          {/* Image column */}
          {data.image_url && (
            <motion.div
              className={`flex ${isImageRight ? 'md:order-last justify-center md:justify-end' : 'md:order-first justify-center md:justify-start'}`}
              initial={anim.instant ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }} transition={anim.instant ? { duration: 0 } : { duration: 0.8, ease: EASE }}
            >
              <div style={{ width: `${imgWidth}%` }} className="max-w-full">
                <EditableImage
                  sectionIndex={sectionIndex} fieldPath="image_url" src={data.image_url} alt={data.image_alt || data.title || ''}
                  className="w-full h-auto rounded-xl object-cover shadow-sm" loading="lazy" initialPosition={data.image_url_pos}
                />
              </div>
            </motion.div>
          )}

          {/* Text column */}
          <motion.div className={isImageRight ? 'md:order-first' : 'md:order-last'} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={anim.container}>
            {(data.eyebrow || data.title) && (
              <div className="mb-6">
                <motion.div variants={anim.item}><Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" /></motion.div>
                {data.title && (
                  <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold leading-tight ${dark ? 'text-white' : 'text-stone-900'}`)}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
                  </motion.h2>
                )}
                <motion.div variants={anim.item} className="h-px w-8 bg-sage mt-5" />
              </div>
            )}
            <motion.div
              variants={anim.item}
              style={getContentFontStyle(data)}
              className={getContentFontClass(data, `text-lg font-light leading-relaxed ${prose} ${dark ? 'text-stone-300' : 'text-stone-600'}`)}
              dangerouslySetInnerHTML={{ __html: data.content || '' }}
            />
          </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── GALLERY SECTIONS (Relume Inspired) ───────────────────────────────────────
export interface GalleryCard {
  image: string;
  // Cadrage choisi via le bouton « Position » de l'image : il était enregistré
  // mais jamais relu, le recadrage disparaissait donc au rechargement.
  image_pos?: string;
  title?: string;
  description?: string;
  link?: string;
}

// 1. Gallery Grid
export interface GalleryGridData {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  columns?: '2' | '3' | '4';
  cards: GalleryCard[];
}

export function GalleryGrid({ data, sectionIndex }: { data: GalleryGridData, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const dark = data.theme === 'dark';
  const cards = data.cards || [];
  const colCount = data.columns || '3';
  
  const gridClass = colCount === '2' 
    ? 'grid-cols-1 md:grid-cols-2' 
    : colCount === '4'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {(data.eyebrow || data.title || data.description) && (
          <div className="text-center mb-16 max-w-2xl mx-auto">
            {data.eyebrow && <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />}
            {data.title && (
              <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </h2>
            )}
            {data.description && (
              <p className="text-lg font-light opacity-80">
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}

        <div data-cards className={`grid ${gridClass} gap-6`}>
          {cards.map((card, i) => (
            <motion.div
              key={i}
              data-surface
              initial={anim.instant ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={anim.instant ? { duration: 0 } : { duration: 0.5, delay: i * 0.1 }}
              className={`group relative rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ${
                dark ? 'bg-stone-850 border border-stone-750' : 'bg-white border border-stone-200'
              }`}
            >
              <div 
                className="relative aspect-video md:aspect-[4/3] overflow-hidden cursor-zoom-in"
                onClick={() => setActiveIdx(i)}
              >
                <EditableImage 
                  sectionIndex={sectionIndex} 
                  fieldPath={`cards.${i}.image`} 
                  src={card.image || ''} 
                  initialPosition={card.image_pos}
                  alt={card.title || ""}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                  <ZoomIn className="text-white w-8 h-8" />
                </div>
              </div>
              
              {(card.title || card.description) && (
                <div className="p-6">
                  {card.title && (
                    <h3 className="font-serif text-xl font-bold mb-2">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
                    </h3>
                  )}
                  {card.description && (
                    <p className="text-sm font-light leading-relaxed opacity-75 mb-4">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                    </p>
                  )}
                  {card.link && (
                    <a 
                      href={card.link} 
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sage hover:text-wood transition-colors"
                    >
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.link`} value={card.link === '#' ? 'Voir plus' : card.link} as="span" />
                      <ArrowRight size={12} />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeIdx !== null && (
          <Lightbox
            images={cards.map(c => ({
              src: c.image || "",
              title: c.title,
              description: c.description
            }))}
            initialIndex={activeIdx}
            onClose={() => setActiveIdx(null)}
          />
        )}
      </AnimatePresence>
    </SectionWrapper>
  );
}

// 2. Gallery Carousel
export interface GalleryCarouselData {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  cards: GalleryCard[];
}

export function GalleryCarousel({ data, sectionIndex }: { data: GalleryCarouselData, sectionIndex?: number }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const dark = data.theme === 'dark';
  const cards = data.cards || [];
  
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {(data.eyebrow || data.title || data.description) && (
          <div className="text-center mb-16 max-w-2xl mx-auto">
            {data.eyebrow && <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />}
            {data.title && (
              <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </h2>
            )}
            {data.description && (
              <p className="text-lg font-light opacity-80">
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}

        {/* Scrollable Row */}
        <div className="relative">
          <div data-cards className="flex gap-6 overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-stone-200 snap-x">
            {cards.map((card, i) => (
              <motion.div
                key={i}
                data-surface
                className={`flex-none w-[80vw] sm:w-[50vw] md:w-[30vw] snap-align-start rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${
                  dark ? 'bg-stone-850 border border-stone-750' : 'bg-white border border-stone-200'
                }`}
              >
                <div 
                  className="relative aspect-video overflow-hidden cursor-zoom-in"
                  onClick={() => setActiveIdx(i)}
                >
                  <EditableImage 
                    sectionIndex={sectionIndex} 
                    fieldPath={`cards.${i}.image`} 
                    src={card.image || ''} 
                    initialPosition={card.image_pos}
                    alt={card.title || ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <ZoomIn className="text-white w-6 h-6" />
                  </div>
                </div>
                
                {(card.title || card.description) && (
                  <div className="p-5">
                    {card.title && (
                      <h3 className="font-serif text-lg font-bold mb-1">
                        <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
                      </h3>
                    )}
                    {card.description && (
                      <p className="text-xs font-light leading-relaxed opacity-75 mb-3">
                        <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                      </p>
                    )}
                    {card.link && (
                      <a 
                        href={card.link} 
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sage hover:text-wood transition-colors"
                      >
                        <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.link`} value={card.link === '#' ? 'Détails' : card.link} as="span" />
                        <ArrowRight size={10} />
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {activeIdx !== null && (
          <Lightbox
            images={cards.map(c => ({
              src: c.image || "",
              title: c.title,
              description: c.description
            }))}
            initialIndex={activeIdx}
            onClose={() => setActiveIdx(null)}
          />
        )}
      </AnimatePresence>
    </SectionWrapper>
  );
}

// 3. Gallery Masonry
export interface GalleryMasonryData {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  cards: GalleryCard[];
}

export function GalleryMasonry({ data, sectionIndex }: { data: GalleryMasonryData, sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const dark = data.theme === 'dark';
  const cards = data.cards || [];

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {(data.eyebrow || data.title || data.description) && (
          <div className="text-center mb-16 max-w-2xl mx-auto">
            {data.eyebrow && <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />}
            {data.title && (
              <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </h2>
            )}
            {data.description && (
              <p className="text-lg font-light opacity-80">
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}

        <div data-cards className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              data-surface
              initial={anim.instant ? false : { opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={anim.instant ? { duration: 0 } : { duration: 0.6, delay: i * 0.08 }}
              className={`break-inside-avoid mb-6 group rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ${
                dark ? 'bg-stone-850 border border-stone-750' : 'bg-white border border-stone-200'
              }`}
            >
              <div 
                className="relative overflow-hidden cursor-zoom-in"
                onClick={() => setActiveIdx(i)}
              >
                <EditableImage 
                  sectionIndex={sectionIndex} 
                  fieldPath={`cards.${i}.image`} 
                  src={card.image || ''} 
                  initialPosition={card.image_pos}
                  alt={card.title || ""}
                  className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                  <ZoomIn className="text-white w-6 h-6" />
                </div>
              </div>

              {(card.title || card.description) && (
                <div className="p-6">
                  {card.title && (
                    <h3 className="font-serif text-lg font-bold mb-2">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
                    </h3>
                  )}
                  {card.description && (
                    <p className="text-xs font-light leading-relaxed opacity-75 mb-3">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                    </p>
                  )}
                  {card.link && (
                    <a 
                      href={card.link} 
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sage hover:text-wood transition-colors"
                    >
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.link`} value={card.link === '#' ? 'En savoir plus' : card.link} as="span" />
                      <ArrowRight size={10} />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {activeIdx !== null && (
          <Lightbox
            images={cards.map(c => ({
              src: c.image || "",
              title: c.title,
              description: c.description
            }))}
            initialIndex={activeIdx}
            onClose={() => setActiveIdx(null)}
          />
        )}
      </AnimatePresence>
    </SectionWrapper>
  );
}

// ─── Reviews Carousel ─────────────────────────────────────────────────────────
export interface ReviewCard {
  name: string;
  date?: string;
  rating?: number;
  text: string;
}

export interface Reviews1Data {
  button_style?: ButtonVariant | 'green' | 'white';
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  title_bold?: string;
  description?: string;
  cta_text?: string;
  cta_href?: string;
  cards: ReviewCard[];
}

function StarRating({ rating, dark }: { rating: number; dark?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-5 h-5 ${s <= rating ? 'text-yellow-400' : dark ? 'text-stone-600' : 'text-stone-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function Reviews1({ data, sectionIndex }: { data: Reviews1Data; sectionIndex?: number }) {
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const cards = data.cards || [];
  const dark = data.theme === 'dark';
  const visible = 3;
  const total = cards.length;
  const canPrev = current > 0;
  const canNext = current + visible < total;

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(total - visible, c + 1));

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-12">
          <div>
            {data.eyebrow && <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />}
            <h2 className="font-serif text-4xl md:text-5xl font-bold leading-tight">
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              {data.title_bold && (
                <> <em className="not-italic font-bold"><EditableText sectionIndex={sectionIndex} fieldPath="title_bold" value={data.title_bold} /></em></>
              )}
            </h2>
            {data.description && (
              <p className="mt-2 opacity-70 font-light">
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
          {data.cta_text && (
            <a
              data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
              className={`shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-colors ${
                dark ? 'bg-white text-stone-900 hover:bg-stone-100' : 'bg-stone-900 text-white hover:bg-sage'
              }`}
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
              <ArrowRight size={16} />
            </a>
          )}
        </div>

        {/* Carousel */}
        {cards.length === 0 ? (
          <p className="text-center opacity-40 italic text-sm py-12">Aucun avis. Ajoutez des avis dans la barre latérale.</p>
        ) : (
          <div className="relative">
            {/* Prev */}
            <button
              onClick={prev}
              disabled={!canPrev}
              className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                canPrev
                  ? dark ? 'bg-white text-stone-900 hover:bg-stone-100' : 'bg-white text-stone-900 hover:bg-stone-50 border border-stone-200'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Cards */}
            <div className="overflow-hidden">
              <motion.div
                data-cards
                className="flex gap-6"
                animate={{ x: `calc(-${current} * (100% / ${visible} + 1.5rem / ${visible} * (${visible} - 1)))` }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
              >
                {cards.map((card, j) => (
                  <div
                    key={j}
                    data-surface
                    className={`flex-none rounded-2xl p-6 shadow-sm border flex flex-col gap-3 ${
                      dark ? 'bg-stone-800 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-900'
                    }`}
                    style={{ width: `calc(${100 / visible}% - ${(visible - 1) / visible * 1.5}rem)` }}
                  >
                    {/* Nom + badge */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                        ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-rose-500','bg-amber-500'][j % 5]
                      }`}>
                        {card.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">
                          <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${j}.name`} value={card.name} as="span" />
                        </p>
                        {card.date && (
                          <p className={`text-xs ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                            <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${j}.date`} value={card.date} as="span" />
                          </p>
                        )}
                      </div>
                      {/* G badge */}
                      <div className="ml-auto shrink-0 flex items-center gap-1">
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      </div>
                    </div>

                    {/* Stars */}
                    <StarRating rating={card.rating ?? 5} dark={dark} />

                    {/* Texte */}
                    <div className="flex-1">
                      <p className={`text-sm font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-stone-700'} ${expanded[j] ? '' : 'line-clamp-4'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${j}.text`} value={card.text} />
                      </p>
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [j]: !prev[j] }))}
                        className={`mt-2 text-xs font-semibold transition-colors ${dark ? 'text-stone-400 hover:text-white' : 'text-stone-400 hover:text-stone-700'}`}
                      >
                        {expanded[j] ? 'Réduire ↑' : 'Lire la suite ↓'}
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Next */}
            <button
              onClick={next}
              disabled={!canNext}
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                canNext
                  ? dark ? 'bg-white text-stone-900 hover:bg-stone-100' : 'bg-white text-stone-900 hover:bg-stone-50 border border-stone-200'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Dots */}
        {total > visible && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: total - visible + 1 }).map((_, d) => (
              <button
                key={d}
                onClick={() => setCurrent(d)}
                className={`w-2 h-2 rounded-full transition-all ${
                  d === current
                    ? dark ? 'bg-white scale-125' : 'bg-stone-900 scale-125'
                    : dark ? 'bg-stone-600' : 'bg-stone-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
export interface FaqItem {
  question: string;
  answer: string;
}

export interface Faq1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cards?: FaqItem[];
}

export function Faq1({ data, sectionIndex }: { data: Faq1Data; sectionIndex?: number }) {
  const dark = data.theme === 'dark';
  const cards = data.cards || [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // FAQPage émis directement depuis les questions/réponses affichées ici — pas
  // de duplication de contenu. Réutilisable sur toute page utilisant faq_1.
  const faqJsonLd = cards.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cards
      .filter((c) => c.question && c.answer)
      .map((c) => ({
        '@type': 'Question',
        name: c.question,
        acceptedAnswer: { '@type': 'Answer', text: c.answer },
      })),
  } : null;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 md:py-32 px-6">
      {faqJsonLd && faqJsonLd.mainEntity.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4 tracking-tight leading-tight">
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </h2>
          {data.description && (
            <p className="text-stone-500 font-light text-base md:text-lg max-w-xl mx-auto mt-4">
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {cards.length === 0 ? (
            <p className="text-center text-stone-600 text-sm py-8">
              Aucune question. Ajoutez des questions-réponses dans la barre latérale.
            </p>
          ) : (
            cards.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className={`border-b transition-all duration-300 ${
                    dark ? 'border-stone-800' : 'border-stone-200'
                  }`}
                >
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between py-5 text-left focus:outline-none group cursor-pointer"
                  >
                    <span className={`font-serif text-base md:text-lg font-semibold transition-colors ${
                      isOpen 
                        ? 'text-sage' 
                        : dark ? 'text-white' : 'text-stone-900'
                    }`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${idx}.question`} value={item.question} />
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="text-sage p-1 shrink-0 ml-4"
                    >
                      <ChevronDown size={18} />
                    </motion.span>
                  </button>

                  <motion.div
                    initial={false}
                    animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                    className="overflow-hidden"
                  >
                    <p className={`pb-6 text-sm md:text-base font-light leading-relaxed ${
                      dark ? 'text-stone-400' : 'text-stone-600'
                    }`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${idx}.answer`} value={item.answer} />
                    </p>
                  </motion.div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}


// ─── pricing_1 ────────────────────────────────────────────────────────────────
export interface Pricing1Plan {
  name?: string;
  tagline?: string;
  badge?: string;
  highlight?: boolean;
  price: string;
  price_original?: string;
  price_note?: string;
  items?: string[];
  guarantee?: string;
  cta_text?: string;
  cta_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
}

export interface Pricing1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  price: string;
  price_original?: string;
  price_note?: string;
  items?: string[];
  cta_text?: string;
  cta_href?: string;
  button_style?: ButtonVariant | 'green' | 'white';
  footnote?: string;
  guarantee?: string;
  // Mode 2 offres : si présent, on affiche une grille de cartes au lieu de la carte unique.
  plans?: Pricing1Plan[];
}

export function Pricing1({ data, sectionIndex }: { data: Pricing1Data; sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const items = data.items || [];

  // ── Mode 2 offres ──────────────────────────────────────────────────────────
  if (data.plans && data.plans.length > 0) {
    const plans = data.plans;
    return (
      <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container} className="text-center mb-14">
            <motion.div variants={anim.item} className="flex justify-center">
              <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>
            <motion.h2 variants={anim.item} className={`font-serif text-4xl md:text-5xl font-bold mb-5 ${dark ? 'text-white' : 'text-stone-900'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
            </motion.h2>
            {data.description && (
              <motion.p variants={anim.item} className={`text-lg font-light max-w-2xl mx-auto ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {plans.map((plan, pi) => {
              const featured = !!plan.highlight;
              const planItems = plan.items || [];
              return (
                <motion.div
                  key={pi}
                  initial={anim.instant ? false : { opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.8, ease: EASE, delay: pi * 0.1 }}
                  className={`relative flex flex-col rounded-3xl overflow-hidden border p-8 md:p-10 ${
                    featured
                      ? (dark ? 'bg-[#1a1714] border-sage shadow-2xl shadow-sage/10' : 'bg-white border-sage shadow-2xl ring-1 ring-sage/20')
                      : (dark ? 'bg-[#161310] border-stone-800' : 'bg-white/70 border-stone-200 shadow-sm')
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${featured ? 'bg-sage' : 'bg-stone-300/40'}`} />
                  {plan.badge && (
                    <span className={`inline-block self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 ${featured ? 'bg-sage text-white' : 'bg-stone-100 text-stone-500'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].badge`} value={plan.badge} as="span" />
                    </span>
                  )}
                  {plan.name && (
                    <h3 className={`font-serif text-2xl font-bold mb-1 ${dark ? 'text-white' : 'text-stone-900'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].name`} value={plan.name} as="span" />
                    </h3>
                  )}
                  {plan.tagline && (
                    <p className={`text-sm font-light mb-6 ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].tagline`} value={plan.tagline} as="span" />
                    </p>
                  )}
                  <div className="flex items-baseline gap-3 flex-wrap mb-1">
                    {plan.price_original && (
                      <span className={`font-serif text-xl line-through decoration-2 ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].price_original`} value={plan.price_original} as="span" className="line-through decoration-2" />
                      </span>
                    )}
                    <span className={`font-serif text-4xl md:text-5xl font-bold ${dark ? 'text-white' : 'text-stone-900'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].price`} value={plan.price} as="span" />
                    </span>
                  </div>
                  {plan.price_note && (
                    <p className={`text-sm font-light mb-6 ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].price_note`} value={plan.price_note} />
                    </p>
                  )}
                  {planItems.length > 0 && (
                    <ul className="space-y-3 mb-8 mt-2">
                      {planItems.map((li, i) => (
                        <li key={i} className={`flex items-start gap-3 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${featured ? 'bg-sage/20' : 'bg-stone-200/60'}`}>
                            <Check className={`w-3 h-3 ${featured ? 'text-sage' : 'text-stone-400'}`} />
                          </div>
                          <span className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: li }} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {plan.guarantee && (
                    <div className={`mt-auto flex items-start gap-2 rounded-xl px-4 py-3 ${dark ? 'bg-sage/10' : 'bg-sage/5'}`}>
                      <ShieldCheck className="w-5 h-5 text-sage shrink-0 mt-0.5" />
                      <p className={`text-xs leading-snug ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].guarantee`} value={plan.guarantee} />
                      </p>
                    </div>
                  )}
                  {plan.cta_text && (
                    <a href={plan.cta_href ?? '#'}
                      className={`${plan.guarantee ? 'mt-4' : 'mt-auto'} inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-300 ${
                        featured
                          ? 'bg-sage text-white hover:shadow-lg hover:shadow-sage/25'
                          : (dark ? 'bg-white/5 text-white border border-stone-700 hover:bg-white/10' : 'bg-white text-stone-900 border border-stone-200 hover:bg-stone-50')
                      }`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans[${pi}].cta_text`} value={plan.cta_text} as="span" />
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>

          {data.guarantee && (
            <div className="mt-10 flex justify-center">
              <div className={`flex items-center gap-3 rounded-2xl border px-6 py-4 max-w-2xl ${dark ? 'bg-sage/10 border-sage/30 text-stone-200' : 'bg-sage/5 border-sage/30 text-stone-700'}`}>
                <ShieldCheck className="w-7 h-7 text-sage shrink-0" />
                <p className="text-sm font-medium leading-snug">
                  <EditableText sectionIndex={sectionIndex} fieldPath="guarantee" value={data.guarantee} />
                </p>
              </div>
            </div>
          )}

          {data.footnote && (
            <p className={`mt-6 text-xs font-light text-center max-w-2xl mx-auto ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="footnote" value={data.footnote} />
            </p>
          )}
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container} className="text-center mb-14">
          <motion.div variants={anim.item} className="flex justify-center">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </motion.div>
          <motion.h2 variants={anim.item} className={`font-serif text-4xl md:text-5xl font-bold mb-5 ${dark ? 'text-white' : 'text-stone-900'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </motion.h2>
          {data.description && (
            <motion.p variants={anim.item} className={`text-lg font-light max-w-xl mx-auto ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}
        </motion.div>

        <motion.div
          initial={anim.instant ? false : { opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={anim.instant ? { duration: 0 } : { duration: 0.9, ease: EASE }}
          className={`relative rounded-3xl overflow-hidden border ${dark ? 'bg-[#1a1714] border-stone-800' : 'bg-white border-stone-100 shadow-xl'}`}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-sage" />
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 pb-10 border-b border-stone-200/20">
              <div>
                {data.badge && (
                  <span className="inline-block bg-sage/10 text-sage px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                    <EditableText sectionIndex={sectionIndex} fieldPath="badge" value={data.badge} as="span" />
                  </span>
                )}
                <div className="flex items-baseline gap-4 flex-wrap">
                  {data.price_original && (
                    <span className={`font-serif text-2xl md:text-3xl line-through decoration-2 ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath="price_original" value={data.price_original} as="span" className="line-through decoration-2" />
                    </span>
                  )}
                  <span className={`font-serif text-5xl md:text-6xl font-bold ${dark ? 'text-white' : 'text-stone-900'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="price" value={data.price} as="span" />
                  </span>
                </div>
                {data.price_note && (
                  <p className={`mt-3 text-sm font-light ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath="price_note" value={data.price_note} />
                  </p>
                )}
              </div>
              {data.cta_text && (
                <a data-btn={buttonVariantOf(data.button_style)} href={data.cta_href ?? '#'}
                  className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-300 shrink-0 ${buttonVariantOf(data.button_style) !== 'primary' ? 'bg-white text-stone-900 border border-stone-200 hover:bg-stone-50' : 'bg-sage text-white hover:shadow-lg hover:shadow-sage/25'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>
            {items.length > 0 && (
              <ul className="grid md:grid-cols-2 gap-x-10 gap-y-4 mb-2">
                {items.map((li, i) => (
                  <li key={i} className={`flex items-start gap-3 ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
                    <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-sage" />
                    </div>
                    <span className="text-sm leading-relaxed">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}`} value={li} as="span" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.footnote && (
              <p className={`mt-8 text-xs font-light text-center ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="footnote" value={data.footnote} />
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── stats_1 ────────────────────────────────────────────────────────────────
export interface Stats1Card {
  value: string;
  label: string;
}

export interface Stats1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  cards: Stats1Card[];
}

export function Stats1({ data, sectionIndex }: { data: Stats1Data; sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        {(data.eyebrow || data.title) && (
          <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
            <motion.div variants={anim.item} className="flex justify-center">
              <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>
            {data.title && (
              <motion.h2 variants={anim.item} className={`font-serif text-3xl md:text-4xl font-bold ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </motion.h2>
            )}
          </motion.div>
        )}
        <motion.div
          data-cards
          className={`grid gap-8 text-center ${data.cards.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}
        >
          {data.cards.map((card, i) => (
            <motion.div key={i} variants={anim.item}>
              {/* Le chiffre tient lieu de titre de carte : sans ce marqueur, la
                  taille « titre » ne l'atteignait pas — il n'est pas un `h3` —
                  et la taille « texte » le rabaissait au niveau du libellé. */}
              <p data-card-title className="font-serif text-4xl md:text-5xl font-bold mb-2 tabular-nums text-sage">
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.value`} value={card.value} as="span" />
              </p>
              <p className={`text-xs uppercase tracking-widest font-medium ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.label`} value={card.label} as="span" />
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── timeline_1 ───────────────────────────────────────────────────────────────
export interface Timeline1Card {
  title: string;
  description?: string;
}

export interface Timeline1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  bg_image?: string;
  bg_image_opacity?: number;
  bg_image_position?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  cards: Timeline1Card[];
}

export function Timeline1({ data, sectionIndex }: { data: Timeline1Data; sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-24 lg:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        {(data.eyebrow || data.title || data.description) && (
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}>
            <motion.div variants={anim.item} className="flex justify-center">
              <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
            </motion.div>
            {data.title && (
              <motion.h2 variants={anim.item} className={`font-serif text-4xl md:text-5xl font-bold mb-5 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
              </motion.h2>
            )}
            {data.description && (
              <motion.p variants={anim.item} className={`text-lg font-light max-w-xl mx-auto ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}
          </motion.div>
        )}
        <motion.div
          data-cards
          className="grid gap-10 sm:gap-6 sm:grid-flow-col sm:auto-cols-fr relative"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}
        >
          <div className={`hidden sm:block absolute top-5 left-0 right-0 h-px ${dark ? 'bg-stone-700' : 'bg-stone-200'}`} />
          {data.cards.map((card, i) => (
            <motion.div key={i} variants={anim.item} className="relative text-center sm:text-left">
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm mb-4 mx-auto sm:mx-0 ${dark ? 'bg-stone-800 text-sage border border-sage/30' : 'bg-white text-sage border border-sage/30 shadow-sm'}`}>
                {i + 1}
              </div>
              <h3 className={`font-serif text-lg font-bold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
              </h3>
              {card.description && (
                <p className={`text-sm font-light leading-relaxed ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── logos_1 ────────────────────────────────────────────────────────────────
export interface Logos1Card {
  image: string;
  alt?: string;
  link?: string;
}

export interface Logos1Data {
  theme?: 'light' | 'dark';
  bg_color?: string;
  eyebrow?: string;
  cards: Logos1Card[];
}

export function Logos1({ data, sectionIndex }: { data: Logos1Data; sectionIndex?: number }) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-14 px-6">
      <div className="max-w-5xl mx-auto">
        {data.eyebrow && (
          <div className="flex justify-center mb-8">
            <Eyebrow text={data.eyebrow} dark={dark} sectionIndex={sectionIndex} fieldPath="eyebrow" />
          </div>
        )}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={anim.container}
        >
          {data.cards.map((card, i) => {
            const img = (
              <EditableImage
                sectionIndex={sectionIndex}
                fieldPath={`cards.${i}.image`}
                src={card.image}
                alt={card.alt || ''}
                className={`h-7 md:h-9 w-auto object-contain transition-opacity ${dark ? 'opacity-70 hover:opacity-100 brightness-0 invert' : 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0'}`}
              />
            );
            return (
              <motion.div key={i} variants={anim.item}>
                {card.link ? <a href={card.link} target="_blank" rel="noopener noreferrer">{img}</a> : img}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
