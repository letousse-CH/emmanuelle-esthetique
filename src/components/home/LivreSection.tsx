"use client";

import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from './shared';
import EditableText from '../pagebuilder/EditableText';
import EditableImage from '../pagebuilder/EditableImage';

interface Props {
  photo4: string;
}

export default function LivreSection({ photo4 }: Props) {
  return (
    <section className="py-32 bg-[#1a1714] px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
            <motion.span variants={fadeUp} className="text-wood font-bold tracking-[0.35em] uppercase text-[10px] mb-4 block">
              <EditableText settingKey="home_livre_eyebrow" value="Mon Livre" as="span" />
            </motion.span>
            <motion.h2 className="font-serif text-4xl md:text-5xl font-bold mb-8 text-white leading-tight" variants={fadeUp}>
              <EditableText settingKey="home_livre_title" value="Paroles & Silences" as="span" />
            </motion.h2>
            <motion.div variants={fadeUp} className="w-16 h-0.5 bg-wood mb-10" />
            <motion.p variants={fadeUp} className="text-stone-400 font-light leading-relaxed mb-6">
              <EditableText 
                settingKey="home_livre_desc1" 
                value="Une invitation à plonger dans l'espace entre les mots, là où la vérité se fait entendre. Un recueil de réflexions sur le silence, la présence et l'art de traverser les ombres." 
                as="span" 
              />
            </motion.p>
            <motion.p variants={fadeUp} className="text-stone-500 font-light leading-relaxed mb-10">
              <EditableText 
                settingKey="home_livre_desc2" 
                value="Chaque page est une respiration, une invitation à ralentir et à se retrouver. Un compagnon de route pour votre voyage intérieur." 
                as="span" 
              />
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 items-center">
              <a href="/paroles-et-silences" className="inline-flex items-center gap-3 bg-sage text-white px-8 py-4 rounded-full font-bold hover:bg-wood transition-colors duration-300 shadow-lg">
                <BookOpen className="w-4 h-4" /> <EditableText settingKey="home_livre_cta1" value="Découvrir le livre" as="span" />
              </a>
              <a href="https://amzn.eu/d/0eZHNYph" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-stone-400 hover:text-white transition-colors text-sm font-medium">
                <ArrowRight className="w-4 h-4" /> <EditableText settingKey="home_livre_cta2" value="Commander sur Amazon" as="span" />
              </a>
            </motion.div>
            <motion.p variants={fadeUp} className="text-stone-600 text-xs mt-8 italic">
              <EditableText 
                settingKey="home_livre_secondary_text" 
                value='Et aussi : "Si les arbres pouvaient parler…" — le récit d’une renaissance.' 
                as="span" 
              />
            </motion.p>
          </motion.div>

          <div className="relative group">
            <motion.div
              initial={{ opacity: 0, rotate: 3, scale: 0.96 }}
              whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="relative"
            >
              <div className="absolute -inset-6 bg-wood/10 rounded-[3rem] rotate-2 group-hover:rotate-1 transition-transform duration-700 pointer-events-none" />
              <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl">
                <EditableImage
                  settingKey="home_photo4"
                  src={photo4}
                  alt="Paroles & Silences — livre de Matthieu Le Tousse"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-auto"
                  loading="lazy"
                  decoding="async"
                  width={563}
                  height={1000}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent pointer-events-none" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="absolute -bottom-4 left-8 right-8 bg-stone-800 border border-stone-700 rounded-2xl px-6 py-4 shadow-xl flex items-center justify-between"
            >
              <div className="pointer-events-auto text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-500 mb-0.5">
                  <EditableText settingKey="home_livre_badge_text" value="Disponible maintenant" as="span" />
                </p>
                <p className="font-serif font-bold text-white">
                  <EditableText settingKey="home_livre_badge_val" value="Paroles & Silences" as="span" />
                </p>
              </div>
              <div className="w-10 h-10 bg-wood/20 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-wood" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
