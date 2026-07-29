"use client";

import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { fadeUp, stagger } from './shared';
import EditableText from '../pagebuilder/EditableText';
import EditableImage from '../pagebuilder/EditableImage';

interface Props {
  content: Record<string, string>;
  photo1: string;
}

export default function IntroSection({ content, photo1 }: Props) {
  const imgErr = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = '/images/hero-1400.webp';
    e.currentTarget.onerror = null;
  }, []);

  return (
    <section className="grid lg:grid-cols-2 items-start overflow-hidden">
      {/* Photo */}
      <div className="relative overflow-hidden bg-stone-200 h-[140vw] lg:h-screen">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.1 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <EditableImage
            settingKey="home_photo1"
            src={photo1}
            onError={(e: any) => imgErr(e)}
            alt="Matthieu Le Tousse — présence et méditation"
            className="w-full h-full object-cover object-center lg:object-[center_20%]"
            loading="lazy"
            decoding="async"
            width={563}
            height={1000}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-stone-50/20 lg:bg-gradient-to-r lg:from-transparent lg:to-stone-50/10 pointer-events-none" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute bottom-8 left-8 bg-white/90 backdrop-blur-md rounded-2xl px-6 py-4 shadow-xl"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sage mb-1">Palézieux, Suisse</p>
          <p className="font-serif text-stone-900 font-bold text-lg">Matthieu Le Tousse</p>
        </motion.div>
      </div>

      {/* Text */}
      <div className="flex items-center bg-white px-10 lg:px-20 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="max-w-lg"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[10px] mb-6 block">
            Semeur d'Eveil
          </motion.span>
          <motion.h2 variants={fadeUp} className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-8 leading-tight">
            <EditableText settingKey="home_intro_quote" value={content.home_intro_quote} />
          </motion.h2>
          <motion.div variants={fadeUp} className="w-16 h-0.5 bg-wood mb-10" />
          <motion.p variants={fadeUp} className="text-xl text-stone-600 font-light leading-relaxed mb-8">
            <EditableText settingKey="home_intro_text" value={content.home_intro_text} />
          </motion.p>
          <motion.a
            variants={fadeUp}
            href="/a-propos"
            className="inline-flex items-center gap-3 text-stone-900 font-bold uppercase tracking-widest text-xs hover:text-sage transition-colors border-b-2 border-stone-200 hover:border-sage pb-1"
          >
            En savoir plus <ArrowRight className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
