"use client";

import React from 'react';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function TurnkeyOfferSection({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultInclusions = [
    { title: "Configuration & Import Initial Inclus", desc: "Nous paramétrons votre site, vos coordonnées, votre catalogue de soins et importons vos données." },
    { title: "Commandes Vocales & IA Avancées", desc: "Accès illimité à l'interview vocale Claude, à la dictée micro et à la génération d'articles." },
    { title: "Caisse Légale Conforme Droit Suisse", desc: "Gestion des factures FAC-2026, quittances PDF, décomptes TVA, bons cadeaux et export fiducie." },
    { title: "Nom de Domaine & Hébergement Haute Vitesse", desc: "Certificat SSL sécurisé, hébergement Cloudflare/Netlify et sauvegardes automatiques." },
    { title: "Formation & Support Réactif", desc: "Accompagnement pas à pas pour prendre en main vos outils à votre rythme sans aucun stress." },
  ];

  const inclusions = data?.inclusions && data.inclusions.length > 0 ? data.inclusions : defaultInclusions;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider mb-4 ${
            dark
              ? 'bg-stone-800 border-stone-700 text-emerald-400'
              : 'bg-[var(--brand-surface,#f5f5f4)] border-[var(--brand-border,#e7e5e4)] text-[var(--brand-primary,#0f0e0d)]'
          }`}>
            <Sparkles className="w-4 h-4 text-amber-500" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Accompagnement Personnalisé"} as="span" />
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Une Formule Clé en Main Tout Inclus :"} />
            {" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Zéro Souci Technique"} />
            </span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Ne perdez plus votre temps précieux à essayer de créer un site par vous-même. Nous livrons votre plateforme prête à l'emploi et clé en main."} />
          </p>
        </div>

        {/* Offer Box */}
        <div className={`max-w-4xl mx-auto rounded-3xl p-8 sm:p-12 border shadow-xl relative overflow-hidden ${
          dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-sm'
        }`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left List */}
            <div className="lg:col-span-8 space-y-6">
              <h3 className={`text-2xl font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
                Tout ce qui est inclus dans votre Solution Clé en Main :
              </h3>

              <div className="space-y-4">
                {inclusions.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="p-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${dark ? 'text-stone-200' : 'text-stone-900'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`inclusions.${idx}.title`} value={item.title} />
                      </h4>
                      <p className={`text-xs font-light mt-0.5 leading-relaxed ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`inclusions.${idx}.desc`} value={item.desc} />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right CTA Box */}
            <div className={`lg:col-span-4 p-6 rounded-2xl border text-center space-y-6 flex flex-col justify-between h-full ${
              dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)] shadow-xs'
            }`}>
              <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold uppercase tracking-wider block mb-4">
                  Prêt à démarrer ?
                </span>
                <h4 className={`text-xl font-serif font-bold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                  Demandez Votre Démo Personnalisée
                </h4>
                <p className={`text-xs font-light ${dark ? 'text-stone-400' : 'text-stone-500'}`}>
                  Échangez directement avec notre équipe pour configurer la solution adaptée à votre activité.
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <Link
                  href={data?.cta_href || "/contact"}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--brand-primary,#0f0e0d)] hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                >
                  <span><EditableText sectionIndex={sectionIndex} fieldPath="cta_text" value={data?.cta_text || "Nous Contacter"} as="span" /></span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-[11px] text-stone-400 font-medium">Réponse sous 24h ouvrées</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </SectionWrapper>
  );
}
