"use client";

import React from 'react';
import { Settings, Mic, Award, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';
import Link from 'next/link';

export default function HowItWorksSection({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultSteps = [
    {
      number: "01",
      icon: Settings,
      title: "Setup & Configuration Clé en Main",
      description: "Nous construisons votre site dynamique, importons votre catalogue de prestations et configurons votre caisse certifiée aux normes suisses (CO).",
      badge: "Clé en Main",
    },
    {
      number: "02",
      icon: Mic,
      title: "Pilotage Intuitif & Assistant Vocal",
      description: "Vous encaissez par TWINT/CB et dictez vos consignes ou articles de blog au microphone. L'IA rédige et met en page sans que vous touchiez au clavier.",
      badge: "Commandes Vocales",
    },
    {
      number: "03",
      icon: Award,
      title: "Sérénité & Gain de 5h par Semaine",
      description: "Vos clientes reçoivent leurs quittances SMS/PDF certifiées. En fin de mois, exportez votre journal des recettes et décomptes TVA pour votre fiducie en 1 clic.",
      badge: "Conformité CO Suisse",
    },
  ];

  const steps = data?.steps && data.steps.length > 0 ? data.steps : defaultSteps;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden bg-[var(--brand-surface,#f8f8f7)]">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-200 bg-white text-xs font-semibold uppercase tracking-wider mb-4 text-stone-800 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Démo Express — Didactique 1-2-3"} as="span" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-stone-900">
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Comment Ça Marche ?"} />
            {" "}
            <span className="font-serif italic text-amber-700">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "En 3 Étapes Simples"} />
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg font-light leading-relaxed text-stone-600">
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Une méthode éprouvée pour digitaliser et automatiser votre activité d'indépendant(e) sans aucun casse-tête technique."} />
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((step: any, idx: number) => {
            const Icon = step.icon || defaultSteps[idx % 3].icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-4xl font-serif font-bold text-amber-600/30 group-hover:text-amber-600 transition-colors">
                      {step.number || `0${idx + 1}`}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 font-medium text-xs border border-amber-200">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`steps.${idx}.badge`} value={step.badge || defaultSteps[idx % 3].badge} as="span" />
                    </span>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-amber-700" />
                  </div>

                  <h3 className="text-xl font-serif font-semibold text-stone-900 mb-3">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`steps.${idx}.title`} value={step.title || defaultSteps[idx % 3].title} />
                  </h3>
                  <p className="text-sm font-light text-stone-600 leading-relaxed">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`steps.${idx}.description`} value={step.description || defaultSteps[idx % 3].description} />
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-amber-800">
                  <span>Étape {idx + 1} sur 3</span>
                  <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA Footer banner */}
        <div className="bg-stone-900 text-white rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <h4 className="text-xl font-serif font-semibold text-white">Prêt(e) à simplifier votre quotidien d'indépendant(e) ?</h4>
            <p className="text-sm text-stone-400 font-light mt-1">Demandez votre démonstrateur personnalisé sans engagement.</p>
          </div>
          <Link
            href="/contact"
            className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-2xl text-sm transition-all shadow-md shrink-0 flex items-center gap-2"
          >
            <span>Demander Ma Démo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </SectionWrapper>
  );
}
