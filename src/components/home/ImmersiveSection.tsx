"use client";

import React, { useRef, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { isMobile, fadeUp, stagger } from './shared';
import EditableText from '../pagebuilder/EditableText';
import EditableImage from '../pagebuilder/EditableImage';

interface Props {
  content: Record<string, string>;
  photo2: string;
}

export default function ImmersiveSection({ content, photo2 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], isMobile ? ['0%', '0%'] : ['-8%', '8%']);

  const imgErr = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2000&auto=format&fit=crop';
    e.currentTarget.onerror = null;
  }, []);

  return (
    <section ref={ref} className="relative h-[80vh] flex items-center justify-center overflow-hidden">
      <motion.div className="absolute inset-0" style={{ y }}>
        <EditableImage
          settingKey="home_photo2"
          src={photo2}
          onError={imgErr}
          alt="Matthieu Le Tousse — regard vers le ciel"
          className="w-full h-[115%] object-cover pointer-events-auto"
          loading="lazy"
          decoding="async"
          width={1200}
          height={896}
        />
        <div className="absolute inset-0 bg-stone-900/60 pointer-events-none" />
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="relative z-10 text-center text-white max-w-3xl px-6"
      >
        <motion.div variants={fadeUp}>
          <Sparkles className="w-8 h-8 text-sage/60 mx-auto mb-8" />
        </motion.div>
        <motion.p variants={fadeUp} className="font-serif text-3xl md:text-5xl italic font-light leading-tight mb-10">
          <EditableText settingKey="home_immersive_quote" value={content.home_immersive_quote} />
        </motion.p>
        <motion.div variants={fadeUp} className="h-px w-16 bg-sage/50 mx-auto mb-10" />
        <motion.p variants={fadeUp} className="text-paper/70 text-sm uppercase tracking-[0.3em] font-medium">
          <EditableText settingKey="home_immersive_author" value="Matthieu Le Tousse" as="span" />
        </motion.p>
      </motion.div>
    </section>
  );
}
