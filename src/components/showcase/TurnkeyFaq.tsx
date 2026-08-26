"use client";

import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function TurnkeyFaq({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultFaqs = [
    {
      q: "Faut-il des connaissances techniques pour utiliser votre solution ?",
      a: "Absolument pas ! Tout a été spécialement conçu pour être utilisable par tout professionnel sans aucune compétence informatique. Vous pouvez modifier vos contenus par simple glisser-déposer ou en dictant directement vos instructions au microphone.",
    },
    {
      q: "La caisse enregistreuse est-elle conforme aux exigences légales et à la TVA en Suisse ?",
      a: "Oui, à 100 %. La caisse respecte strictement le Code des obligations suisse (art. 957a et 958f : traçabilité 10 ans, numérotation séquentielle continue FAC-2026-XXXX sans trous). Elle gère les taux de TVA suisse (0 %, 8.1 %, 3.8 %, 2.6 %) et génère des exports mensuels prêts pour votre fiduciaire.",
    },
    {
      q: "Comment fonctionnent exactement les commandes vocales ?",
      a: "Dans votre espace d'administration, chaque champ et chaque outil d'édition dispose d'une icône de microphone. Cliquez dessus et parlez naturellement en français. L'intelligence artificielle (Claude / Gemini) comprend votre consigne, rédige le texte ou effectue la mise à jour souhaitée instantanément.",
    },
    {
      q: "Puis-je utiliser la caisse sur une tablette ou mon téléphone portable ?",
      a: "Oui ! La caisse est une Progressive Web App (PWA). Vous pouvez l'installer en 1 clic sur l'écran d'accueil de votre iPad, tablette Android ou smartphone pour encaisser vos clients au comptoir ou en déplacement.",
    },
    {
      q: "Puis-je désactiver les fonctionnalités dont je n'ai pas besoin ?",
      a: "Tout à fait. Grâce au système de modules 1-Click (Feature Flags), vous activez ou désactivez le blog, les événements Stripe, la caisse ou la newsletter en un simple interrupteur depuis votre panneau de configuration.",
    },
    {
      q: "Combien de temps faut-il pour mettre en ligne mon nouveau site ?",
      a: "Grâce à notre accompagnement clé en main, votre site et vos outils d'administration sont configurés et prêts à l'emploi en généralement 48 à 72 heures après notre premier échange.",
    },
  ];

  const faqs = data?.faqs && data.faqs.length > 0 ? data.faqs : data?.items && data.items.length > 0 ? data.items.map((i: any) => ({ q: i.question || i.q, a: i.answer || i.a })) : defaultFaqs;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden">
      <div className="max-w-5xl mx-auto relative z-10">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider mb-4 ${
            dark
              ? 'bg-stone-800 border-stone-700 text-emerald-400'
              : 'bg-[var(--brand-surface,#f5f5f4)] border-[var(--brand-border,#e7e5e4)] text-[var(--brand-primary,#0f0e0d)]'
          }`}>
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Foire Aux Questions"} as="span" />
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Questions Fréquentes de"} />
            {" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Nos Futurs Clients"} />
            </span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Retrouvez ici toutes les réponses aux interrogations les plus fréquentes concernant votre nouvelle solution clé en main."} />
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((item: any, idx: number) => {
            const isOpen = openIdx === idx;
            const questionText = item.q || item.question || "";
            const answerText = item.a || item.answer || "";
            return (
              <div
                key={idx}
                className={`border rounded-2xl overflow-hidden transition-colors ${
                  dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
                }`}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex justify-between items-center gap-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <span className={`font-serif font-semibold text-base sm:text-lg ${dark ? 'text-white' : 'text-stone-900'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`faqs.${idx}.q`} value={questionText} as="span" />
                  </span>
                  <div className={`p-2 rounded-xl border transition-transform ${
                    isOpen ? 'rotate-180 bg-[var(--brand-primary,#0f0e0d)] text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200 dark:border-stone-700'
                  }`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className={`px-6 pb-6 pt-2 text-sm font-light leading-relaxed border-t ${
                        dark ? 'text-stone-300 border-stone-800' : 'text-[var(--brand-text-muted,#78716c)] border-stone-100'
                      }`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`faqs.${idx}.a`} value={answerText} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </SectionWrapper>
  );
}
