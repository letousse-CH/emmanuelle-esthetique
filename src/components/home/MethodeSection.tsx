"use client";

import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Building2, Compass } from 'lucide-react';
import { fadeUp, stagger, AnimatedHeading, TiltCard } from './shared';
import EditableText from '../pagebuilder/EditableText';

const STEPS = [
  { 
    n: '01', 
    icon: ShieldCheck, 
    color: 'sage', 
    titleKey: 'home_methode_step1_title', 
    descKey: 'home_methode_step1_desc', 
    defaultTitle: 'Apaisement', 
    defaultDesc: 'Retrouver le calme physique et nerveux pour pouvoir réfléchir sereinement.' 
  },
  { 
    n: '02', 
    icon: Building2, 
    color: 'wood', 
    titleKey: 'home_methode_step2_title', 
    descKey: 'home_methode_step2_desc', 
    defaultTitle: 'Analyse', 
    defaultDesc: 'Identifier les blocages et comprendre les racines de votre situation actuelle.' 
  },
  { 
    n: '03', 
    icon: Compass, 
    color: 'sage', 
    titleKey: 'home_methode_step3_title', 
    descKey: 'home_methode_step3_desc', 
    defaultTitle: 'Action', 
    defaultDesc: 'Mettre en place des outils concrets pour une reconstruction durable et solide.' 
  },
];

export default function MethodeSection() {
  return (
    <section id="methode" className="py-32 bg-stone-50 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-24"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[10px] mb-4 block">
            <EditableText settingKey="home_methode_eyebrow" value="La Démarche" as="span" />
          </motion.span>
          <AnimatedHeading className="font-serif text-4xl md:text-6xl font-bold mb-6 text-stone-900">
            <EditableText settingKey="home_methode_title" value="Une Méthode en 3 Étapes" as="span" />
          </AnimatedHeading>
          <motion.p variants={fadeUp} className="text-xl text-stone-500 font-light max-w-2xl mx-auto">
            <EditableText settingKey="home_methode_subtitle" value="Concrète, pragmatique et adaptée à votre rythme." as="span" />
          </motion.p>
        </motion.div>

        <div className="space-y-8 md:space-y-0 md:grid md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <TiltCard
              key={i}
              delay={i * 0.18}
              className="relative bg-white rounded-[2rem] p-10 shadow-sm border border-stone-100 hover:shadow-xl transition-all duration-500 overflow-hidden group cursor-pointer hover:border-sage/40"
            >
              <span className={`absolute -top-4 -right-2 font-serif text-[8rem] font-bold leading-none text-${step.color}/5 select-none pointer-events-none`}>
                {step.n}
              </span>
              <div className={`w-16 h-16 bg-${step.color}/10 text-${step.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500`}>
                <step.icon className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900 mb-4">
                {i + 1}. <EditableText settingKey={step.titleKey} value={step.defaultTitle} as="span" />
              </h3>
              <p className="text-stone-600 font-light leading-relaxed">
                <EditableText settingKey={step.descKey} value={step.defaultDesc} as="span" />
              </p>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}
