"use client";

import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { fadeUp, stagger, RevealImage, AnimatedHeading } from './shared';
import EditableText from '../pagebuilder/EditableText';

interface Props {
  content: Record<string, string>;
}

export default function ExpertiseSection({ content }: Props) {
  const imgErr = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2000&auto=format&fit=crop';
    e.currentTarget.onerror = null;
  }, []);

  return (
    <section id="expertise" className="py-32 bg-white px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">
        {/* Photo */}
        <div className="relative group order-2 md:order-1">
          <motion.div
            initial={{ opacity: 0, rotate: -2, scale: 0.95 }}
            whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative"
          >
            <div className="absolute -inset-4 border border-sage/15 rounded-[2rem] transition-all duration-500 group-hover:inset-0 group-hover:bg-sage/3" />
            <div className="relative aspect-[4/5] bg-stone-100 rounded-[1.5rem] overflow-hidden shadow-2xl">
              <RevealImage
                settingKey="home_expertise_photo"
                src="/images/hero-1400.webp"
                alt="Matthieu Le Tousse"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={imgErr}
                width={563}
                height={1000}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 to-transparent pointer-events-none" />
              <div className="absolute bottom-8 left-8 text-white z-10 pointer-events-auto">
                <p className="font-serif text-2xl font-bold">
                  <EditableText settingKey="home_expertise_author" value="Matthieu Le Tousse" as="span" />
                </p>
                <p className="text-paper/80 text-xs tracking-[0.25em] uppercase font-medium mt-1">
                  <EditableText settingKey="home_expertise_author_title" value="Spécialiste de la Reconstruction" as="span" />
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20, y: 10 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute -top-6 -right-6 bg-sage text-white rounded-2xl px-6 py-4 shadow-xl z-10 pointer-events-auto"
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5 opacity-80">
              <EditableText settingKey="home_expertise_badge_key" value="Basé en" as="span" />
            </p>
            <p className="font-serif font-bold text-lg">
              <EditableText settingKey="home_expertise_badge_val" value="Suisse 🇨🇭" as="span" />
            </p>
          </motion.div>
        </div>

        {/* Text */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="order-1 md:order-2"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[10px] mb-4 block">
            <EditableText settingKey="home_expertise_eyebrow" value="Votre Guide" as="span" />
          </motion.span>
          <AnimatedHeading className="font-serif text-4xl md:text-5xl font-bold mb-10 text-stone-900 leading-tight">
            <EditableText settingKey="home_expertise_title" value="Cheminez vers votre essence" as="span" />
          </AnimatedHeading>
          <motion.div variants={fadeUp} className="space-y-6 text-stone-600 text-lg leading-relaxed font-light mb-10">
            <p>
              <EditableText settingKey="home_expertise_text1" value={content.home_expertise_text1} />
            </p>
            <p>
              <EditableText settingKey="home_expertise_text2" value={content.home_expertise_text2} />
            </p>
          </motion.div>
          <motion.a
            variants={fadeUp}
            href="/a-propos"
            className="inline-flex items-center gap-3 text-stone-900 font-bold uppercase tracking-widest text-xs hover:text-sage transition-colors border-b-2 border-stone-200 hover:border-sage pb-1"
          >
            <EditableText settingKey="home_expertise_link_text" value="Découvrir mon parcours" as="span" /> <ArrowRight className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
