"use client";

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Clock, Mail, MapPin, Minus, Phone, Play, ShieldCheck, Sparkles, Star, Zap, Send } from 'lucide-react';

import EditableText from './EditableText';
import EditableImage from './EditableImage';
import { SectionWrapper } from './sections';
import { useSectionAnimation } from './sectionAnimation';
import { supabase } from '../../services/supabase';
import {
  getTitleFontClass,
  getContentFontClass,
  getTitleFontStyle,
  getContentFontStyle,
} from './sectionLayout';

/**
 * Sections complémentaires.
 *
 * Elles vivent à part de `sections.tsx` (2 500 lignes) pour rester lisibles.
 * Toutes suivent les mêmes règles que les originales :
 *
 * — `SectionWrapper` porte le fond, l'image de fond et le thème ;
 * — `data.theme === 'dark'` bascule chaque section en version foncée, sans
 *   quoi une page alternée aurait des trous ;
 * — les textes passent par `EditableText`, ce qui les rend modifiables
 *   directement dans l'aperçu du constructeur.
 */

type Base = { theme?: 'light' | 'dark'; bg_image?: string; bg_image_opacity?: number };
type Props<T> = { data: T; sectionIndex?: number };

/* Couleurs dérivées du thème — factorisées pour rester cohérentes partout. */
function tone(dark: boolean) {
  return {
    title: dark ? 'text-white' : 'text-stone-900',
    body: dark ? 'text-stone-300' : 'text-stone-500',
    faint: dark ? 'text-stone-400' : 'text-stone-400',
    card: dark ? 'bg-white/5 border-white/10' : 'bg-white border-stone-200',
    divide: dark ? 'divide-white/10' : 'divide-stone-200',
    border: dark ? 'border-white/10' : 'border-stone-200',
  };
}

/* ═══ Appels à l'action ═══════════════════════════════════════════════════ */

export interface Cta2Data extends Base {
  title: string;
  description?: string;
  cta_text?: string;
  cta_href?: string;
}

/** Bandeau pleine largeur — l'appel le plus insistant du catalogue. */
export function Cta2({ data, sectionIndex }: Props<Cta2Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
        variants={anim.container}
        className="mx-auto max-w-3xl text-center"
      >
        <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-4xl md:text-5xl font-bold leading-tight ${t.title}`)}>
          <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
        </motion.h2>
        {data.description && (
          <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `mt-6 text-lg leading-relaxed ${t.body}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
          </motion.p>
        )}
        {data.cta_text && (
          <motion.a
            variants={anim.item} data-btn="primary" href={data.cta_href ?? '#'}
            className="group mt-10 inline-flex items-center gap-2.5 bg-sage px-9 py-4 font-bold text-white transition-transform hover:scale-[1.02]"
          >
            <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </motion.a>
        )}
      </motion.div>
    </SectionWrapper>
  );
}

export interface Cta3Data extends Base {
  title: string;
  description?: string;
  cta_text?: string;
  cta_href?: string;
}

/** Texte à gauche, bouton à droite — discret, pour un bas de page. */
export function Cta3({ data, sectionIndex }: Props<Cta3Data>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-16">
      <div className={`mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 border ${t.border} p-8 md:flex-row md:items-center md:p-12`}>
        <div className="max-w-xl">
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-2xl md:text-3xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mt-3 leading-relaxed ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>
        {data.cta_text && (
          <a data-btn="primary" href={data.cta_href ?? '#'} className="group inline-flex shrink-0 items-center gap-2.5 bg-sage px-7 py-3.5 font-bold text-white transition-transform hover:scale-[1.02]">
            <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
    </SectionWrapper>
  );
}

/* ═══ Témoignages ═════════════════════════════════════════════════════════ */

export interface Testimonial2Data extends Base {
  title?: string;
  cards: { quote: string; author: string; role?: string }[];
}

/** Trois témoignages côte à côte — plus crédible qu'un seul isolé. */
export function Testimonial2({ data, sectionIndex }: Props<Testimonial2Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {data.title && (
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `mb-14 text-center font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
        )}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          data-cards
          className="grid gap-6 md:grid-cols-3"
        >
          {(data.cards ?? []).map((card, i) => (
            <motion.figure key={i} variants={anim.item} className={`flex flex-col border p-7 ${t.card}`}>
              <blockquote className={`flex-1 leading-relaxed ${t.body}`}>
                «&nbsp;<EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.quote`} value={card.quote} as="span" />&nbsp;»
              </blockquote>
              <figcaption className={`mt-6 border-t pt-4 ${t.border}`}>
                <span className={`block text-sm font-bold ${t.title}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.author`} value={card.author} as="span" />
                </span>
                {card.role && (
                  <span className={`block text-xs ${t.faint}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.role`} value={card.role} as="span" />
                  </span>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Équipe ══════════════════════════════════════════════════════════════ */

export interface Team1Data extends Base {
  title?: string;
  description?: string;
  cards: { name: string; role?: string; image?: string; bio?: string }[];
}

/** Portraits en grille. */
export function Team1({ data, sectionIndex }: Props<Team1Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {data.title && (
          <div className="mb-14 text-center">
            <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
            </h2>
            {data.description && (
              <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mx-auto mt-4 max-w-2xl leading-relaxed ${t.body}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          data-cards
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {(data.cards ?? []).map((card, i) => (
            <motion.div key={i} variants={anim.item}>
              <div className="aspect-[4/5] overflow-hidden">
                <EditableImage
                  sectionIndex={sectionIndex} fieldPath={`cards.${i}.image`}
                  src={card.image ?? ''} alt={card.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className={`mt-4 font-serif text-lg font-bold ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.name`} value={card.name} as="span" />
              </p>
              {card.role && (
                <p className={`text-sm ${t.faint}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.role`} value={card.role} as="span" />
                </p>
              )}
              {card.bio && (
                <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.bio`} value={card.bio} />
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Contact ═════════════════════════════════════════════════════════════ */

export interface Contact1Data extends Base {
  title?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
}

/** Coordonnées en colonnes — l'information pratique, sans détour. */
export function Contact1({ data, sectionIndex }: Props<Contact1Data>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);

  const entries = [
    { icon: MapPin, label: 'Adresse', field: 'address', value: data.address },
    { icon: Phone, label: 'Téléphone', field: 'phone', value: data.phone },
    { icon: Mail, label: 'E-mail', field: 'email', value: data.email },
    { icon: Clock, label: 'Horaires', field: 'hours', value: data.hours },
  ].filter((e) => e.value);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {data.title && (
          <div className="mb-14 text-center">
            <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
            </h2>
            {data.description && (
              <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mx-auto mt-4 max-w-2xl leading-relaxed ${t.body}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}
        <div className={`grid gap-px border ${t.border} sm:grid-cols-2 lg:grid-cols-4`}>
          {entries.map(({ icon: Icon, label, field, value }) => (
            <div key={field} className={`p-7 ${dark ? 'bg-white/5' : 'bg-white'}`}>
              <Icon className="h-5 w-5 text-sage" />
              <p className={`mt-4 text-[11px] font-bold uppercase tracking-widest ${t.faint}`}>{label}</p>
              <p className={`mt-1.5 leading-relaxed ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={field} value={value as string} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Étapes ══════════════════════════════════════════════════════════════ */

export interface Steps1Data extends Base {
  title?: string;
  cards: { title: string; description?: string }[];
}

/** Étapes numérotées en ligne — un parcours qui se lit de gauche à droite. */
export function Steps1({ data, sectionIndex }: Props<Steps1Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {data.title && (
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `mb-14 text-center font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
        )}
        <motion.ol
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          data-cards
          className="grid gap-8 md:grid-cols-2 lg:grid-cols-4"
        >
          {(data.cards ?? []).map((card, i) => (
            <motion.li key={i} variants={anim.item} className={`border-t-2 pt-6 ${dark ? 'border-sage' : 'border-sage'}`}>
              <span className="font-serif text-4xl font-bold text-sage">{String(i + 1).padStart(2, '0')}</span>
              <p className={`mt-3 text-lg font-bold ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
              </p>
              {card.description && (
                <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                </p>
              )}
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Chiffres ════════════════════════════════════════════════════════════ */

export interface Stats2Data extends Base {
  cards: { value: string; label: string }[];
}

/** Bandeau de chiffres, sans titre — sert de respiration entre deux sections. */
export function Stats2({ data, sectionIndex }: Props<Stats2Data>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-16">
      <div data-cards className={`mx-auto grid max-w-5xl divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 ${t.divide}`}>
        {(data.cards ?? []).map((card, i) => (
          <div key={i} className="px-6 py-6 text-center">
            {/* Même raison que dans stats_1 : le chiffre est le titre de la carte. */}
            <p data-card-title className="font-serif text-4xl font-bold text-sage">
              <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.value`} value={card.value} as="span" />
            </p>
            <p className={`mt-2 text-sm ${t.body}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.label`} value={card.label} as="span" />
            </p>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

/* ═══ Questions fréquentes ════════════════════════════════════════════════ */

export interface Faq2Data extends Base {
  title?: string;
  cards: { question: string; answer: string }[];
}

/** FAQ sur deux colonnes, tout ouvert — se lit d'un coup, sans clic. */
export function Faq2({ data, sectionIndex }: Props<Faq2Data>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {data.title && (
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `mb-14 font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
        )}
        <div data-cards className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {(data.cards ?? []).map((card, i) => (
            <div key={i}>
              <p className={`font-bold ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.question`} value={card.question} as="span" />
              </p>
              <p className={`mt-2 leading-relaxed ${t.body}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.answer`} value={card.answer} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Comparatif ══════════════════════════════════════════════════════════ */

export interface Compare1Data extends Base {
  title?: string;
  left_label: string;
  right_label: string;
  rows: { label: string; left: boolean; right: boolean }[];
}

/** Tableau « avec / sans » — l'argumentaire le plus lisible qui soit. */
export function Compare1({ data, sectionIndex }: Props<Compare1Data>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        {data.title && (
          <h2 className={`mb-14 text-center font-serif text-3xl md:text-4xl font-bold ${t.title}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
        )}
        <table className={`w-full border ${t.border}`}>
          <thead>
            <tr className={`border-b ${t.border}`}>
              <th className="p-4" />
              <th className={`p-4 text-sm font-bold ${t.faint}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="left_label" value={data.left_label} as="span" />
              </th>
              <th className={`bg-sage/10 p-4 text-sm font-bold ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="right_label" value={data.right_label} as="span" />
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.divide}`}>
            {(data.rows ?? []).map((row, i) => (
              <tr key={i}>
                <td className={`p-4 text-sm ${t.body}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`rows.${i}.label`} value={row.label} as="span" />
                </td>
                <td className="p-4 text-center">
                  {row.left
                    ? <Check className="mx-auto h-4 w-4 text-sage" />
                    : <Minus className={`mx-auto h-4 w-4 ${t.faint}`} />}
                </td>
                <td className="bg-sage/5 p-4 text-center">
                  {row.right
                    ? <Check className="mx-auto h-4 w-4 text-sage" />
                    : <Minus className={`mx-auto h-4 w-4 ${t.faint}`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Bandeau d'annonce ═══════════════════════════════════════════════════ */

export interface Banner1Data extends Base {
  text: string;
  cta_text?: string;
  cta_href?: string;
}

/** Une ligne, pleine largeur — promotion, information, urgence. */
export function Banner1({ data, sectionIndex }: Props<Banner1Data>) {
  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-sm">
        <span className={data.theme === 'dark' ? 'text-stone-200' : 'text-stone-700'}>
          <EditableText sectionIndex={sectionIndex} fieldPath="text" value={data.text} as="span" />
        </span>
        {data.cta_text && (
          <a href={data.cta_href ?? '#'} className="font-bold text-sage underline-offset-4 hover:underline">
            <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} as="span" />
          </a>
        )}
      </div>
    </SectionWrapper>
  );
}

/* ═══ Hero Vidéo Premium ══════════════════════════════════════════════════ */

export interface HeroVideoData extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  cta_text?: string;
  cta_href?: string;
  video_url?: string;
  video_poster?: string;
  trust_text?: string;
}

export function HeroVideo({ data, sectionIndex }: Props<HeroVideoData>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
        variants={anim.container}
        className="mx-auto max-w-5xl text-center"
      >
        {data.eyebrow && (
          <motion.div variants={anim.item} className="mb-6 inline-flex items-center gap-2 rounded-full border border-sage/30 bg-sage/10 px-4 py-1.5 text-xs font-bold text-sage uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} as="span" />
          </motion.div>
        )}

        <motion.h1
          variants={anim.item}
          style={getTitleFontStyle(data)}
          className={getTitleFontClass(data, `font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight ${t.title}`)}
        >
          <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
        </motion.h1>

        {data.description && (
          <motion.p
            variants={anim.item}
            style={getContentFontStyle(data)}
            className={getContentFontClass(data, `mx-auto mt-6 max-w-2xl text-lg leading-relaxed ${t.body}`)}
          >
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
          </motion.p>
        )}

        {/* Aperçu vidéo avec bouton Play */}
        <motion.div variants={anim.item} className="relative mx-auto mt-12 aspect-video max-w-4xl overflow-hidden rounded-3xl border border-stone-200/80 shadow-2xl group">
          <EditableImage
            sectionIndex={sectionIndex}
            fieldPath="video_poster"
            src={data.video_poster || 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1200&q=80'}
            alt={data.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] transition-all group-hover:bg-stone-900/30 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="group/btn relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-stone-900 shadow-2xl transition-all hover:scale-110 cursor-pointer"
            >
              <span className="absolute -inset-2 rounded-full bg-white/30 animate-ping" />
              <Play className="h-8 w-8 translate-x-0.5 fill-stone-900 text-stone-900" />
            </button>
          </div>
        </motion.div>

        {/* Modal vidéo si lancée */}
        {isPlaying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md" onClick={() => setIsPlaying(false)}>
            <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl" onClick={e => e.stopPropagation()}>
              <iframe
                src={data.video_url || 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {data.trust_text && (
          <motion.p variants={anim.item} className={`mt-8 text-xs font-semibold uppercase tracking-widest ${t.faint}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="trust_text" value={data.trust_text} as="span" />
          </motion.p>
        )}
      </motion.div>
    </SectionWrapper>
  );
}

/* ═══ Pricing 2 avec Bascule Mensuel / Annuel ═════════════════════════════ */

export interface Pricing2Data extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  yearly_discount_badge?: string;
  plans: {
    name: string;
    price_monthly: string;
    price_yearly: string;
    period?: string;
    description?: string;
    badge?: string;
    popular?: boolean;
    features: string[];
    cta_text?: string;
    cta_href?: string;
  }[];
}

export function Pricing2({ data, sectionIndex }: Props<Pricing2Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  const [isYearly, setIsYearly] = React.useState(false);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          {data.eyebrow && (
            <span className="mb-4 inline-block rounded-full bg-sage/10 px-3.5 py-1 text-xs font-bold text-sage uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} as="span" />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-5xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mt-4 leading-relaxed ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}

          {/* Switcher Mensuel / Annuel */}
          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-stone-200 bg-stone-100/80 p-1.5">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${!isYearly ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer ${isYearly ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Annuel
              {data.yearly_discount_badge && (
                <span className="rounded-full bg-sage px-2 py-0.5 text-[10px] text-white">
                  <EditableText sectionIndex={sectionIndex} fieldPath="yearly_discount_badge" value={data.yearly_discount_badge} as="span" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Grille de cartes */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          className="mt-16 grid gap-8 md:grid-cols-3 items-stretch"
        >
          {(data.plans ?? []).map((plan, i) => {
            const price = isYearly ? plan.price_yearly : plan.price_monthly;
            return (
              <motion.div
                key={i}
                variants={anim.item}
                className={`relative flex flex-col rounded-3xl border p-8 transition-all ${
                  plan.popular
                    ? 'border-sage bg-sage/5 shadow-xl ring-2 ring-sage/20 scale-[1.02]'
                    : `${t.card}`
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-sage px-4 py-1 text-xs font-bold text-white shadow-md">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.badge`} value={plan.badge} as="span" />
                  </span>
                )}
                <h3 className={`font-serif text-xl font-bold ${t.title}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.name`} value={plan.name} as="span" />
                </h3>
                {plan.description && (
                  <p className={`mt-2 text-xs leading-relaxed ${t.body}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.description`} value={plan.description} />
                  </p>
                )}

                <div className="mt-6 flex items-baseline gap-1">
                  <span className={`font-serif text-4xl font-bold ${t.title}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.${isYearly ? 'price_yearly' : 'price_monthly'}`} value={price} as="span" />
                  </span>
                  <span className={`text-xs ${t.faint}`}>{plan.period ?? '/mois'}</span>
                </div>

                <ul className="mt-8 space-y-3 flex-1 border-t pt-6 border-stone-200/60">
                  {(plan.features ?? []).map((feat, fIdx) => (
                    <li key={fIdx} className={`flex items-center gap-2.5 text-sm ${t.body}`}>
                      <Check className="h-4 w-4 shrink-0 text-sage" />
                      <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.features.${fIdx}`} value={feat} as="span" />
                    </li>
                  ))}
                </ul>

                {plan.cta_text && (
                  <a
                    href={plan.cta_href ?? '#'}
                    className={`mt-8 w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all ${
                      plan.popular ? 'bg-sage text-white hover:bg-sage/90 shadow-md' : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    <EditableText sectionIndex={sectionIndex} fieldPath={`plans.${i}.cta_text`} value={plan.cta_text} as="span" />
                  </a>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Stats 3 (Grille de métriques Bento) ════════════════════════════════ */

export interface Stats3Data extends Base {
  title?: string;
  description?: string;
  cards: {
    metric: string;
    label: string;
    sublabel?: string;
    highlight?: boolean;
  }[];
}

export function Stats3({ data, sectionIndex }: Props<Stats3Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {data.title && (
          <div className="mb-14 text-center">
            <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold ${t.title}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
            </h2>
            {data.description && (
              <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mx-auto mt-4 max-w-2xl leading-relaxed ${t.body}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </p>
            )}
          </div>
        )}

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {(data.cards ?? []).map((card, i) => (
            <motion.div
              key={i}
              variants={anim.item}
              className={`flex flex-col justify-between rounded-3xl border p-8 transition-all hover:scale-[1.02] ${
                card.highlight ? 'bg-sage text-white border-sage shadow-xl' : `${t.card}`
              }`}
            >
              <div>
                <Zap className={`h-6 w-6 ${card.highlight ? 'text-white' : 'text-sage'}`} />
                <p className={`mt-6 font-serif text-4xl md:text-5xl font-bold ${card.highlight ? 'text-white' : t.title}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.metric`} value={card.metric} as="span" />
                </p>
              </div>
              <div className="mt-6 border-t pt-4 border-current/20">
                <p className={`font-bold text-sm ${card.highlight ? 'text-white' : t.title}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.label`} value={card.label} as="span" />
                </p>
                {card.sublabel && (
                  <p className={`mt-1 text-xs opacity-80 ${card.highlight ? 'text-white/80' : t.body}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.sublabel`} value={card.sublabel} as="span" />
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Newsletter 1 (Capture d'Email & Lead Magnet) ════════════════════════ */

export interface Newsletter1Data extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  placeholder?: string;
  button_text?: string;
  privacy_note?: string;
  features?: string[];
}

export function Newsletter1({ data, sectionIndex }: Props<Newsletter1Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) return;
    setStatus('loading');
    try {
      const { error } = await supabase.from('subscribers').insert([{ email: email.trim() }]);
      if (!error) {
        setStatus('success');
        setEmail('');
      } else if (error.code === '23505') {
        setStatus('duplicate');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const cardBg = dark ? 'bg-stone-900/90 border-stone-800' : 'bg-stone-50/90 border-stone-200/80';

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-20 lg:py-28">
      <div className={`mx-auto max-w-4xl overflow-hidden rounded-3xl border ${cardBg} p-8 sm:p-12 lg:p-16`}>
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          className="mx-auto max-w-2xl text-center"
        >
          {data.eyebrow && (
            <span className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs font-semibold tracking-wider uppercase ${dark ? 'border-stone-700 bg-stone-800/80 text-stone-300' : 'border-stone-300/80 bg-white text-stone-700'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} as="span" />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-bold tracking-tight ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mt-4 text-base md:text-lg leading-relaxed ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}

          {status === 'success' ? (
            <div className="mt-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 font-medium text-emerald-700 dark:text-emerald-400">
              ✓ Merci ! Votre inscription a bien été enregistrée.
            </div>
          ) : status === 'duplicate' ? (
            <div className="mt-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 font-medium text-amber-700 dark:text-amber-400">
              Vous êtes déjà inscrit(e) à notre newsletter !
            </div>
          ) : (
            <div className="mt-8 mx-auto max-w-md">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={data.placeholder || 'Votre adresse e-mail...'}
                  className={`w-full flex-1 rounded-xl border px-4 py-3.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                    dark
                      ? 'border-stone-700 bg-stone-800 text-white placeholder:text-stone-500 focus:border-stone-500 focus:ring-stone-600'
                      : 'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:ring-stone-900/10'
                  }`}
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className={`flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                    dark
                      ? 'bg-white text-stone-900 hover:bg-stone-100'
                      : 'bg-stone-900 text-white hover:bg-stone-800'
                  }`}
                >
                  {status === 'loading' ? (
                    <span>Inscription...</span>
                  ) : (
                    <>
                      <EditableText sectionIndex={sectionIndex} fieldPath="button_text" value={data.button_text || 'S’inscrire'} as="span" />
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {status === 'error' && (
            <p className="mt-3 text-xs text-red-600 font-medium">Une erreur s’est produite. Veuillez réessayer.</p>
          )}

          {data.privacy_note && (
            <p className={`mt-5 text-xs ${t.faint} flex items-center justify-center gap-1.5`}>
              <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
              <EditableText sectionIndex={sectionIndex} fieldPath="privacy_note" value={data.privacy_note} as="span" />
            </p>
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Bento Grid 1 (Apple / Relume Style) ═════════════════════════════════ */

export interface BentoGrid1Data extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  cards: {
    title: string;
    description?: string;
    tag?: string;
    image_url?: string;
    metric?: string;
  }[];
}

export function BentoGrid1({ data, sectionIndex }: Props<BentoGrid1Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center mb-16">
          {data.eyebrow && (
            <span className="mb-4 inline-block rounded-full bg-sage/10 px-3.5 py-1 text-xs font-bold text-sage uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} as="span" />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-5xl font-bold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} as="span" />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `mt-4 leading-relaxed ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>

        {/* Layout Bento Asymétrique */}
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          className="grid gap-6 md:grid-cols-3"
        >
          {(data.cards ?? []).map((card, i) => {
            const isWide = i === 0 || i === 3;
            return (
              <motion.div
                key={i}
                variants={anim.item}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border ${t.card} p-8 transition-all hover:shadow-xl ${
                  isWide ? 'md:col-span-2' : 'md:col-span-1'
                }`}
              >
                {card.image_url && (
                  <div className="mb-6 aspect-[16/9] overflow-hidden rounded-2xl">
                    <EditableImage
                      sectionIndex={sectionIndex}
                      fieldPath={`cards.${i}.image_url`}
                      src={card.image_url}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                <div>
                  {card.tag && (
                    <span className="mb-3 inline-block rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-600">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.tag`} value={card.tag} as="span" />
                    </span>
                  )}
                  {card.metric && (
                    <p className="font-serif text-4xl font-bold text-sage mb-2">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.metric`} value={card.metric} as="span" />
                    </p>
                  )}
                  <h3 className={`font-serif text-xl font-bold ${t.title}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.title`} value={card.title} as="span" />
                  </h3>
                  {card.description && (
                    <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`cards.${i}.description`} value={card.description} />
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
