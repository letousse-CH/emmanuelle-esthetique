"use client";

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Clock, Mail, MapPin, Minus, Phone, Play, ShieldCheck, Sparkles, Star, Zap, Send, Plus, Trash2 } from 'lucide-react';

import EditableText from './EditableText';
import EditableImage from './EditableImage';
import { SectionWrapper } from './sections';
import { useSectionAnimation } from './sectionAnimation';
import { supabase } from '../../services/supabase';
import { PageEditorContext } from '../../contexts/PageEditorContext';
import {
  getTitleFontClass,
  getContentFontClass,
  getTitleFontStyle,
  getContentFontStyle,
} from './sectionLayout';

export function InlineItemDelete({
  sectionIndex,
  fieldPath,
  array,
  itemIndex,
}: {
  sectionIndex?: number;
  fieldPath: string;
  array: any[];
  itemIndex: number;
}) {
  const ctx = React.useContext(PageEditorContext);
  if (!ctx?.isEditing || sectionIndex === undefined) return null;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newArray = array.filter((_, idx) => idx !== itemIndex);
    ctx.updateField?.(sectionIndex, fieldPath, newArray);
    ctx.savePage?.();
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      title="Supprimer cet élément"
      className="absolute top-3 right-3 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-md z-30 cursor-pointer"
    >
      <Trash2 size={13} />
    </button>
  );
}

export function InlineItemAdd({
  sectionIndex,
  fieldPath,
  array,
  newItem,
  label = 'Ajouter un élément',
}: {
  sectionIndex?: number;
  fieldPath: string;
  array: any[];
  newItem: any;
  label?: string;
}) {
  const ctx = React.useContext(PageEditorContext);
  if (!ctx?.isEditing || sectionIndex === undefined) return null;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newArray = [...(array || []), newItem];
    ctx.updateField?.(sectionIndex, fieldPath, newArray);
    ctx.savePage?.();
  };

  return (
    <div className="w-full flex justify-center pt-6 col-span-full">
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white hover:bg-stone-800 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
      >
        <Plus size={14} />
        <span>{label}</span>
      </button>
    </div>
  );
}

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

/* ═══ Boucle d'Articles de Blog Dynamique ══════════════════════════════════ */

export interface BlogGrid1Data extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  limit?: number;
  cta_text?: string;
  cta_href?: string;
}

/** Section Boucle d'Articles de Blog — Charge dynamiquement les derniers articles du site. */
export function BlogGrid1({ data, sectionIndex }: Props<BlogGrid1Data>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  const [articles, setArticles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadArticles() {
      try {
        const limitCount = data.limit ? Number(data.limit) : 3;
        const { data: rows } = await supabase
          .from('articles')
          .select('id, title, slug, meta_description, cover_image, category, created_at')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(limitCount);

        setArticles(rows || []);
      } catch (err) {
        console.warn('[BlogGrid1] Erreur de chargement des articles:', err);
      } finally {
        setLoading(false);
      }
    }
    loadArticles();
  }, [data.limit]);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-20">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={anim.container}
        className="mx-auto max-w-6xl space-y-12"
      >
        <div className="text-center max-w-2xl mx-auto space-y-4">
          {data.eyebrow && (
            <motion.span variants={anim.item} className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} />
            </motion.span>
          )}
          <motion.h2 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `font-serif text-3xl md:text-4xl font-extrabold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </motion.h2>
          {data.description && (
            <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-base ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </motion.p>
          )}
        </div>

        {/* Grille d'articles */}
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-xs">Chargement des derniers articles…</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-xs">Aucun article publié pour le moment.</div>
        ) : (
          <motion.div variants={anim.item} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {articles.map((art) => (
              <a
                key={art.id}
                href={`/blog/${art.slug}`}
                className={`group flex flex-col rounded-3xl overflow-hidden border transition-all hover:-translate-y-1 hover:shadow-xl ${t.card}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
                  <img
                    src={art.cover_image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'}
                    alt={art.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {art.category && (
                    <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md text-stone-900 text-[11px] font-extrabold rounded-full shadow-sm">
                      {art.category}
                    </span>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1 justify-between space-y-4">
                  <div className="space-y-2">
                    <span className={`text-[11.5px] font-bold ${t.faint}`}>
                      {new Date(art.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <h3 className={`text-lg font-bold group-hover:text-emerald-600 transition-colors line-clamp-2 ${t.title}`}>
                      {art.title}
                    </h3>
                    <p className={`text-xs line-clamp-3 leading-relaxed ${t.body}`}>
                      {art.meta_description || 'Découvrez nos réflexions et conseils d\'experts.'}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                    <span>Lire l'article</span>
                    <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>
              </a>
            ))}
          </motion.div>
        )}

        {data.cta_text && (
          <div className="text-center pt-4">
            <a
              href={data.cta_href || '/blog'}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-stone-900 text-white text-xs font-extrabold rounded-2xl hover:bg-stone-800 transition-all shadow-md"
            >
              <EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data.cta_text} />
              <ArrowRight size={15} />
            </a>
          </div>
        )}
      </motion.div>
    </SectionWrapper>
  );
}

/* ═══ Tailwind UI Marketing Block 1 : Hero Split Badge & Glow ═════════════════ */

export interface HeroSplitBadgeData extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  primary_cta_text?: string;
  primary_cta_href?: string;
  secondary_cta_text?: string;
  secondary_cta_href?: string;
  image_url?: string;
}

export function HeroSplitBadge({ data, sectionIndex }: Props<HeroSplitBadgeData>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="relative overflow-hidden px-6 py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Text Left */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={anim.container}
            className="lg:col-span-7 space-y-6"
          >
            {data.eyebrow && (
              <motion.div variants={anim.item} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-bold tracking-tight">
                <Sparkles size={14} className="text-amber-600" />
                <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} />
              </motion.div>
            )}

            <motion.h1 variants={anim.item} style={getTitleFontStyle(data)} className={getTitleFontClass(data, `text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight ${t.title}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
            </motion.h1>

            {data.description && (
              <motion.p variants={anim.item} style={getContentFontStyle(data)} className={getContentFontClass(data, `text-lg sm:text-xl leading-relaxed max-w-2xl ${t.body}`)}>
                <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
              </motion.p>
            )}

            <motion.div variants={anim.item} className="flex flex-wrap items-center gap-4 pt-2">
              {data.primary_cta_text && (
                <a
                  href={data.primary_cta_href || '#'}
                  className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-stone-900 text-white text-sm font-extrabold hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95"
                >
                  <EditableText sectionIndex={sectionIndex} fieldPath="primary_cta_text" value={data.primary_cta_text} />
                  <ArrowRight size={16} />
                </a>
              )}

              {data.secondary_cta_text && (
                <a
                  href={data.secondary_cta_href || '#'}
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white border border-stone-200 text-stone-800 text-sm font-extrabold hover:bg-stone-50 transition-all shadow-xs active:scale-95"
                >
                  <Play size={15} className="fill-current text-stone-700" />
                  <EditableText sectionIndex={sectionIndex} fieldPath="secondary_cta_text" value={data.secondary_cta_text} />
                </a>
              )}
            </motion.div>
          </motion.div>

          {/* Image / Media Right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="lg:col-span-5 relative"
          >
            <div className="relative rounded-3xl overflow-hidden border border-stone-200/80 bg-white p-3 shadow-2xl">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden relative bg-stone-100">
                <EditableImage
                  sectionIndex={sectionIndex}
                  fieldPath="image_url"
                  src={data.image_url || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80'}
                  alt={data.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Tailwind UI Marketing Block 2 : Features 2x2 Offset Grid ═══════════════ */

export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
}

export interface FeaturesGridOffsetData extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  items?: FeatureItem[];
}

export function FeaturesGridOffset({ data, sectionIndex }: Props<FeaturesGridOffsetData>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  const defaultItems: FeatureItem[] = [
    { title: 'Design Moderne 2026', description: 'Interfaces ultra-soignées, adaptées à tous les écrans avec animations fluides.' },
    { title: 'Haute Performance', description: 'Temps de chargement instantané et optimisation SEO native pour Google.' },
    { title: 'Sécurité Réseau', description: 'Cryptage de bout en bout et hébergement sécurisé sur infrastructure cloud.' },
    { title: 'IA Autonome Intégrée', description: 'Génération de contenu et assistants intelligents à portée de clic.' },
  ];

  const items = data.items && data.items.length > 0 ? data.items : defaultItems;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-16 space-y-4">
          {data.eyebrow && (
            <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `text-3xl sm:text-4xl lg:text-5xl font-extrabold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `text-base sm:text-lg leading-relaxed ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          variants={anim.container}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              variants={anim.item}
              className={`relative group p-8 rounded-3xl border transition-all hover:shadow-lg ${t.card}`}
            >
              <InlineItemDelete sectionIndex={sectionIndex} fieldPath="items" array={items} itemIndex={i} />

              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center mb-6 shadow-xs">
                <Check size={22} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${t.title}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}.title`} value={item.title} />
              </h3>
              <p className={`text-sm leading-relaxed ${t.body}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}.description`} value={item.description} />
              </p>
            </motion.div>
          ))}

          <InlineItemAdd
            sectionIndex={sectionIndex}
            fieldPath="items"
            array={items}
            newItem={{ title: 'Nouvel atout 2026', description: 'Description de la fonctionnalité…' }}
            label="Ajouter un atout"
          />
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Tailwind UI Marketing Block 3 : Pricing 3-Tier Grid ═════════════════════ */

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  popular?: boolean;
  features: string[];
  cta_text: string;
  cta_href?: string;
}

export interface PricingCardsModernData extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  tiers?: PricingTier[];
}

export function PricingCardsModern({ data, sectionIndex }: Props<PricingCardsModernData>) {
  const anim = useSectionAnimation();
  const dark = data.theme === 'dark';
  const t = tone(dark);

  const defaultTiers: PricingTier[] = [
    {
      name: 'Starter',
      price: '29 €',
      period: '/ mois',
      description: 'Idéal pour démarrer votre activité en ligne sereinement.',
      popular: false,
      features: ['Page unique ou landing page', 'Hébergement haute vitesse', 'Support par email'],
      cta_text: 'Démarrer avec Starter',
    },
    {
      name: 'Professionnel',
      price: '79 €',
      period: '/ mois',
      description: 'La solution complète pour développer votre visibilité et vos ventes.',
      popular: true,
      features: ['Site multi-pages complet', 'Pilote automatique IA', 'Module Caisse & Paiements', 'Support prioritaire 7j/7'],
      cta_text: 'Choisir la formule Pro',
    },
    {
      name: 'Sur-Mesure',
      price: '199 €',
      period: '/ mois',
      description: 'Pour les entreprises exigeantes ayant des besoins personnalisés.',
      popular: false,
      features: ['Architecture dédiée', 'Agents IA personnalisés', 'Accompagnement VIP', 'SLA garanti 99.9%'],
      cta_text: 'Contacter l\'équipe',
    },
  ];

  const tiers = data.tiers && data.tiers.length > 0 ? data.tiers : defaultTiers;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center mb-16 space-y-4">
          {data.eyebrow && (
            <span className="inline-block px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `text-3xl sm:text-4xl lg:text-5xl font-extrabold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `text-base sm:text-lg ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>

        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={anim.container}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch"
        >
          {tiers.map((tier, i) => {
            const isPop = tier.popular;
            return (
              <motion.div
                key={i}
                variants={anim.item}
                className={`relative group flex flex-col justify-between p-8 rounded-3xl border transition-all ${
                  isPop
                    ? 'bg-stone-900 text-white border-stone-900 shadow-2xl scale-[1.02] z-10'
                    : `bg-white text-stone-900 border-stone-200/80 shadow-xs hover:shadow-lg`
                }`}
              >
                <InlineItemDelete sectionIndex={sectionIndex} fieldPath="tiers" array={tiers} itemIndex={i} />

                {isPop && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-stone-950 text-[11px] font-black uppercase tracking-wider shadow-md">
                    Le plus populaire
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className={`text-xl font-bold ${isPop ? 'text-white' : 'text-stone-900'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`tiers.${i}.name`} value={tier.name} />
                    </h3>
                    <p className={`mt-2 text-xs leading-relaxed ${isPop ? 'text-stone-300' : 'text-stone-500'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`tiers.${i}.description`} value={tier.description} />
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold tracking-tight ${isPop ? 'text-white' : 'text-stone-900'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`tiers.${i}.price`} value={tier.price} />
                    </span>
                    {tier.period && (
                      <span className={`text-xs font-semibold ${isPop ? 'text-stone-400' : 'text-stone-500'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`tiers.${i}.period`} value={tier.period} />
                      </span>
                    )}
                  </div>

                  <ul className="space-y-3 pt-4 border-t border-stone-200/20 text-xs">
                    {(tier.features || []).map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2.5">
                        <Check size={16} className={isPop ? 'text-amber-400 shrink-0' : 'text-emerald-600 shrink-0'} />
                        <span className={isPop ? 'text-stone-200' : 'text-stone-700'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <a
                    href={tier.cta_href || '#'}
                    className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                      isPop
                        ? 'bg-amber-400 text-stone-950 hover:bg-amber-300 shadow-md'
                        : 'bg-stone-900 text-white hover:bg-stone-800 shadow-xs'
                    }`}
                  >
                    <EditableText sectionIndex={sectionIndex} fieldPath={`tiers.${i}.cta_text`} value={tier.cta_text} />
                  </a>
                </div>
              </motion.div>
            );
          })}

          <InlineItemAdd
            sectionIndex={sectionIndex}
            fieldPath="tiers"
            array={tiers}
            newItem={{ name: 'Nouvelle Formule', price: '49 €', period: '/ mois', description: 'Description de l\'offre…', popular: false, features: ['Avantage 1', 'Avantage 2'], cta_text: 'Choisir' }}
            label="Ajouter une formule tarifaire"
          />
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

/* ═══ Tailwind UI Marketing Block 5 : FAQ Accordion Modern ═════════════════════ */

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqAccordionModernData extends Base {
  eyebrow?: string;
  title: string;
  description?: string;
  items?: FaqItem[];
}

export function FaqAccordionModern({ data, sectionIndex }: Props<FaqAccordionModernData>) {
  const dark = data.theme === 'dark';
  const t = tone(dark);
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const defaultItems: FaqItem[] = [
    { question: "Comment fonctionne l'éditeur en direct ?", answer: "Vous cliquez directement sur les textes et images dans l'aperçu pour les modifier en temps réel sans connaissances techniques." },
    { question: "Le site est-il optimisé pour le référencement Google ?", answer: "Oui, la structure HTML5, le balisage Schema.org et les métadonnées SEO sont générés automatiquement pour un référencement optimal." },
    { question: "Puis-je utiliser mon propre nom de domaine ?", answer: "Absolument. Vous pouvez lier votre propre nom de domaine personnalisé en quelques secondes depuis les paramètres." },
  ];

  const items = data.items && data.items.length > 0 ? data.items : defaultItems;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-16 space-y-4">
          {data.eyebrow && (
            <span className="inline-block px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold uppercase tracking-wider">
              <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data.eyebrow} />
            </span>
          )}
          <h2 style={getTitleFontStyle(data)} className={getTitleFontClass(data, `text-3xl sm:text-4xl font-extrabold ${t.title}`)}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data.title} />
          </h2>
          {data.description && (
            <p style={getContentFontStyle(data)} className={getContentFontClass(data, `text-base ${t.body}`)}>
              <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data.description} />
            </p>
          )}
        </div>

        <div className="space-y-4">
          {items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`relative group rounded-2xl border transition-all overflow-hidden ${t.card}`}
              >
                <InlineItemDelete sectionIndex={sectionIndex} fieldPath="items" array={items} itemIndex={i} />

                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left font-bold text-sm sm:text-base cursor-pointer pr-12"
                >
                  <span className={t.title}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}.question`} value={item.question} />
                  </span>
                  <span className={`p-1 rounded-full border transition-transform duration-200 ${isOpen ? 'rotate-180 bg-stone-900 text-white' : 'text-stone-500'}`}>
                    <Minus size={14} />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-0 text-xs sm:text-sm leading-relaxed border-t border-stone-100 mt-1 pt-4 text-stone-600">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`items.${i}.answer`} value={item.answer} />
                  </div>
                )}
              </div>
            );
          })}

          <InlineItemAdd
            sectionIndex={sectionIndex}
            fieldPath="items"
            array={items}
            newItem={{ question: 'Nouvelle question FAQ ?', answer: 'Réponse à la question…' }}
            label="Ajouter une question FAQ"
          />
        </div>
      </div>
    </SectionWrapper>
  );
}

export { default as AdminShowcaseHero } from '../showcase/AdminShowcaseHero';
export { default as ClientNeedsSection } from '../showcase/ClientNeedsSection';
export { default as VoiceFeaturesSection } from '../showcase/VoiceFeaturesSection';
export { default as AdminMockupsGallery } from '../showcase/AdminMockupsGallery';
export { default as TurnkeyBentoGrid } from '../showcase/TurnkeyBentoGrid';
export { default as TurnkeyOfferSection } from '../showcase/TurnkeyOfferSection';
export { default as TurnkeyFaq } from '../showcase/TurnkeyFaq';


