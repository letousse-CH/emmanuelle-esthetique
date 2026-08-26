"use client";

import React from 'react';
import { Star, ShieldCheck, Quote, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function TurnkeyTestimonialsSection({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultTestimonials = [
    {
      name: "Sophie Martin",
      role: "Naturopathe & Thérapeute (Lausanne)",
      text: "J'ai économisé 4 heures d'administratif par semaine dès le premier mois. Mes clientes adorent recevoir leurs quittances SMS certifiées ASCA/RME et payer par TWINT sur ma tablette.",
      metrics: "Gain : 4h / semaine • 100% Remboursé ASCA",
      rating: 5,
    },
    {
      name: "Élodie Dubois",
      role: "Fondatrice Institut & Head Spa (Genève)",
      text: "La vente directe de bons cadeaux en ligne et la caisse conforme CO Suisse ont changé mon quotidien. En fin de mois, l'export pour ma fiduciaire se fait en 1 seul clic sans aucune erreur.",
      metrics: "+35% de Bons Cadeaux • Export Fiducie 1-Clic",
      rating: 5,
    },
    {
      name: "Marc Vuilleumier",
      role: "Consultant & Coach Indépendant (Vevey)",
      text: "Dicter mes articles de blog au micro entre deux rendez-vous est une vraie révolution. L'assistant IA met en page et optimise le SEO Google automatiquement. Mon site n'a jamais été aussi bien référencé.",
      metrics: "Score Google 99/100 • 100% Vocal",
      rating: 5,
    },
  ];

  const testimonials = data?.testimonials && data.testimonials.length > 0 ? data.testimonials : defaultTestimonials;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-200 bg-[var(--brand-surface,#f8f8f7)] text-xs font-semibold uppercase tracking-wider mb-4 text-stone-800 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Témoignages & Retours d'Expérience"} as="span" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-stone-900">
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Ce Que Disent Les Indépendants"} />
            {" "}
            <span className="font-serif italic text-amber-700">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Qui Utilisent La Solution"} />
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg font-light leading-relaxed text-stone-600">
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Découvrez comment des thérapeutes, esthéticiennes et consultants suisses ont simplifié leur gestion et gagné un temps précieux au quotidien."} />
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((item: any, idx: number) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15 }}
              className="bg-[var(--brand-surface,#f8f8f7)] rounded-3xl p-8 border border-stone-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(item.rating || 5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500" />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-stone-300 group-hover:text-amber-600 transition-colors" />
                </div>

                <p className="text-sm leading-relaxed text-stone-700 font-serif italic mb-6">
                  "<EditableText sectionIndex={sectionIndex} fieldPath={`testimonials.${idx}.text`} value={item.text} />"
                </p>
              </div>

              <div>
                <div className="p-2.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-amber-900 mb-4 flex items-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><EditableText sectionIndex={sectionIndex} fieldPath={`testimonials.${idx}.metrics`} value={item.metrics} /></span>
                </div>

                <div className="border-t border-stone-200/80 pt-3">
                  <h4 className="text-sm font-bold text-stone-900">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`testimonials.${idx}.name`} value={item.name} />
                  </h4>
                  <p className="text-xs text-stone-500 font-light">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`testimonials.${idx}.role`} value={item.role} />
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </SectionWrapper>
  );
}
