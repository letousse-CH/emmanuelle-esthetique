"use client";

import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { Quote } from 'lucide-react';
import { fadeUp, stagger, RevealImage, AnimatedHeading } from './shared';
import EditableText from '../pagebuilder/EditableText';

interface Props {
  content: Record<string, string>;
  photo3: string;
  photo1: string;
}

export default function ProblemeSection({ content, photo3, photo1 }: Props) {
  const imgErr = useCallback((e: React.SyntheticEvent<HTMLImageElement>, fb: string) => {
    e.currentTarget.src = fb;
    e.currentTarget.onerror = null;
  }, []);

  const items = [
    content.home_problem_item1,
    content.home_problem_item2,
    content.home_problem_item3,
    content.home_problem_item4,
  ];

  return (
    <section id="probleme" className="py-32 bg-white px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[10px] mb-4 block">
              <EditableText settingKey="home_problem_eyebrow" value="Le point de départ" as="span" />
            </motion.span>
            <AnimatedHeading className="font-serif text-4xl md:text-5xl font-bold mb-8 text-stone-900 leading-tight">
              Pourquoi rester dans la pénombre ?
            </AnimatedHeading>
            <motion.div variants={fadeUp} className="space-y-8 text-stone-600 text-lg leading-relaxed font-light">
              <p>
                <EditableText 
                  settingKey="home_problem_description" 
                  value="Beaucoup ignorent leurs parts d'ombre jusqu'à ce qu'elles s'imposent par le stress ou le vide. Ces fissures sont pourtant les portes d'entrée vers votre connaissance de soi." 
                  as="span" 
                />
              </p>
              <blockquote className="bg-stone-50 p-8 rounded-2xl shadow-sm border-l-4 border-sage italic text-stone-700">
                "<EditableText 
                  settingKey="home_problem_quote" 
                  value="Traverser ses ombres n'est pas un fardeau, c'est le seul chemin authentique pour embrasser pleinement sa propre lumière." 
                  as="span" 
                />"
              </blockquote>
              {content.home_problem_intro && (
                <p className="font-semibold text-stone-800">
                  <EditableText settingKey="home_problem_intro" value={content.home_problem_intro} as="span" />
                </p>
              )}
              <ul className="space-y-4">
                {items.map((item, i) => (
                  <motion.li key={i} variants={fadeUp} className="flex items-center gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
                    <EditableText settingKey={`home_problem_item${i + 1}`} value={item} as="span" />
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          {/* Mosaic */}
          <div className="relative">
            <div className="absolute -inset-4 bg-sage/5 rounded-[3rem] -rotate-2" />
            <div className="relative grid grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="aspect-[3/4] bg-stone-100 rounded-3xl overflow-hidden shadow-lg">
                  <RevealImage
                    settingKey="home_photo3"
                    src={photo3}
                    alt="Matthieu en forêt — ancrage"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    onError={(e) => imgErr(e, 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2000&auto=format&fit=crop')}
                    width={506}
                    height={900}
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="aspect-square bg-stone-900 rounded-3xl flex items-center justify-center p-8 text-white text-center shadow-xl"
                >
                  <p className="font-serif text-xl italic font-light leading-relaxed">
                    "<EditableText settingKey="home_problem_mosaic_text" value="Un espace pour souffler" as="span" />"
                  </p>
                </motion.div>
              </div>
              <div className="space-y-6 mt-10">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                  className="aspect-square bg-sage rounded-3xl flex items-center justify-center p-8 text-white text-center shadow-xl"
                >
                  <Quote className="w-12 h-12 opacity-30" />
                </motion.div>
                <div className="aspect-[3/4] bg-stone-100 rounded-3xl overflow-hidden shadow-lg">
                  <RevealImage
                    settingKey="home_photo1"
                    src={photo1}
                    alt="Matthieu — sérénité au bord du lac"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    onError={(e) => imgErr(e, '/images/hero-1400.webp')}
                    width={563}
                    height={1000}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
