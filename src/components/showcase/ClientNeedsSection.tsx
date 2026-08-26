"use client";

import React from 'react';
import { UserCheck, ShieldAlert, CheckCircle, Stethoscope, Scissors, Briefcase, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function ClientNeedsSection({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultPersonas = [
    {
      icon: Stethoscope,
      title: "Thérapeutes & Praticiens",
      description: "Ostéopathes, sophrologues, naturopathes, praticiens shiatsu. Présentez vos approches et gérez vos séances sans perte de temps.",
      badge: "Bien-être & Santé",
    },
    {
      icon: Scissors,
      title: "Instituts, Coiffure & Head Spa",
      description: "Esthéticiennes, salons de coiffure, spas. Vendez vos soins et vos bons cadeaux tout en tenant votre caisse légale sans effort.",
      badge: "Beauté & Soins",
    },
    {
      icon: Briefcase,
      title: "Artisans & Consultants",
      description: "Prestataires indépendants, coachs, créateurs. Valorisez vos réalisations et automatisez la relation avec vos clients.",
      badge: "Services & Conseils",
    },
  ];

  const defaultPainPoints = [
    {
      beforeTitle: "Perte de temps sur 4 logiciels différents",
      beforeDesc: "Un outil pour le site, un autre pour la caisse, Excel pour les clients et des mails manuels.",
      afterTitle: "Une seule plateforme tout-en-un",
      afterDesc: "Votre site, votre caisse certifiée, vos clients et vos rendez-vous centralisés dans un espace unique.",
    },
    {
      beforeTitle: "Longues heures passées à taper des textes",
      beforeDesc: "Rédiger des articles de blog ou modifier une page le soir quand vous êtes fatigué(e).",
      afterTitle: "Pilotage intégral à la voix et par IA",
      afterDesc: "Vous dictez vos idées au micro, l'assistant IA rédige et met à jour votre site instantanément.",
    },
    {
      beforeTitle: "Angoisse de la conformité comptable",
      beforeDesc: "Peur des erreurs de numérotation de facture ou de calcul de TVA lors de la transmission à la fiducie.",
      afterTitle: "Caisse 100% conforme au droit suisse (CO)",
      afterDesc: "Numérotation continue certifiée FAC-2026, décomptes automatiques et export fiduciaire en 1 clic.",
    },
  ];

  const personas = data?.personas && data.personas.length > 0 ? data.personas : defaultPersonas;
  const painPoints = data?.painPoints && data.painPoints.length > 0 ? data.painPoints : defaultPainPoints;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider mb-4 ${
            dark
              ? 'bg-stone-800 border-stone-700 text-emerald-400'
              : 'bg-[var(--brand-surface,#f5f5f4)] border-[var(--brand-border,#e7e5e4)] text-[var(--brand-primary,#0f0e0d)]'
          }`}>
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Pensé Pour Votre Métier d'Indépendant"} as="span" />
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Une Solution Conçue Pour Résoudre"} />
            {" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Vos Vrais Défis du Quotidien"} />
            </span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Vous exercez votre métier passion. Notre rôle est de vous libérer de toutes les contraintes techniques, administratives et de rédaction pour que vous puissiez vous concentrer sur vos clients."} />
          </p>
        </div>

        {/* Persona Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {personas.map((item: any, idx: number) => {
            const Icon = item.icon || defaultPersonas[idx % 3].icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`rounded-3xl p-8 border transition-all duration-300 group hover:-translate-y-1 shadow-sm flex flex-col justify-between ${
                  dark
                    ? 'bg-stone-900 border-stone-800 hover:border-amber-500/40'
                    : 'bg-white border-stone-200/80 hover:border-stone-400 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-amber-600" />
                    </div>
                    <span className="px-3.5 py-1 bg-stone-100 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700 rounded-full text-xs font-medium text-stone-700 dark:text-stone-300">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`personas.${idx}.badge`} value={item.badge} as="span" />
                    </span>
                  </div>
                  <h3 className={`text-2xl font-serif font-semibold mb-3 ${dark ? 'text-white' : 'text-stone-900'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`personas.${idx}.title`} value={item.title} />
                  </h3>
                  <p className={`text-sm leading-relaxed font-light mb-6 ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`personas.${idx}.description`} value={item.description} />
                  </p>
                </div>

                {/* Vector Graphic Specific to Each Profession (Brand Light Warm Style) */}
                {idx === 0 && (
                  <div className="my-4 p-4 rounded-2xl bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs">
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="font-semibold text-stone-900">Séance Naturopathie & Soin</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-medium border border-amber-200">Remboursé ASCA/RME</span>
                    </div>
                    <div className="text-[11px] text-stone-600 space-y-1">
                      <p>• Génération de la quittance de soin PDF</p>
                      <p>• Suivi des dossiers & rappel SMS de rdv</p>
                    </div>
                  </div>
                )}

                {idx === 1 && (
                  <div className="my-4 p-4 rounded-2xl bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs">
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="font-semibold text-stone-900">Bon Cadeau Soin Visage</span>
                      <span className="font-mono font-bold text-amber-900">CHF 150.-</span>
                    </div>
                    <div className="text-[11px] text-stone-600 space-y-1">
                      <p>• Code unique : BON-2026-SOIN</p>
                      <p>• Vente directe sur le site & encaissement TWINT</p>
                    </div>
                  </div>
                )}

                {idx === 2 && (
                  <div className="my-4 p-4 rounded-2xl bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs">
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="font-semibold text-stone-900">Devis & Prestation Conseil</span>
                      <span className="text-[10px] bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-medium border border-stone-200">Signature en Ligne</span>
                    </div>
                    <div className="text-[11px] text-stone-600 space-y-1">
                      <p>• Transformation du devis en facture en 1 clic</p>
                      <p>• Numérotation certifiée FAC-2026</p>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center text-xs font-semibold text-stone-900 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
                  <span>Adapté à votre activité</span>
                  <ChevronRight className="w-4 h-4 ml-1 text-amber-600" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Pain Points Matrix */}
        <div className={`rounded-3xl p-8 sm:p-12 border shadow-lg ${
          dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80'
        }`}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className={`text-2xl sm:text-4xl font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
              <EditableText sectionIndex={sectionIndex} fieldPath="matrix_title" value={data?.matrix_title || "Avant vs. Avec Votre Solution Clé en Main"} />
            </h3>
            <p className="text-stone-600 text-base mt-3 font-light">
              <EditableText sectionIndex={sectionIndex} fieldPath="matrix_desc" value={data?.matrix_desc || "Découvrez la sérénité d'un outil unique conçu pour votre quotidien."} />
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold shadow-2xs">
                💡 Économie moyenne : ~ CHF 180.-/mois sur les abonnements cumulés
              </span>
              <span className="px-3.5 py-1.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold shadow-2xs">
                ⏱️ Gain moyen : 5 heures de gestion par semaine
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {painPoints.map((row: any, idx: number) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before */}
                <div className={`border rounded-2xl p-6 flex items-start gap-4 ${
                  dark ? 'bg-stone-950 border-red-900/40' : 'bg-red-50/40 border-red-200/60'
                }`}>
                  <div className="p-2.5 rounded-xl bg-red-100 text-red-700 border border-red-200 flex-shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-red-700 block mb-1">
                      Avant (Les contraintes)
                    </span>
                    <h4 className={`text-base font-semibold mb-1.5 ${dark ? 'text-stone-200' : 'text-stone-900'}`}>
                      <EditableText sectionIndex={sectionIndex} fieldPath={`painPoints.${idx}.beforeTitle`} value={row.beforeTitle} />
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-light leading-relaxed">
                      <EditableText sectionIndex={sectionIndex} fieldPath={`painPoints.${idx}.beforeDesc`} value={row.beforeDesc} />
                    </p>
                  </div>
                </div>

                {/* After */}
                <div className={`border rounded-2xl p-6 flex flex-col justify-between ${
                  dark ? 'bg-emerald-950/40 border-emerald-800' : 'bg-emerald-50/50 border-emerald-200/80'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-emerald-500 text-stone-950 font-bold flex-shrink-0 mt-0.5 shadow-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-800 dark:text-emerald-400 block mb-1">
                        Avec la Solution Clé en Main
                      </span>
                      <h4 className={`text-base font-semibold mb-1.5 ${dark ? 'text-emerald-200' : 'text-stone-900'}`}>
                        <EditableText sectionIndex={sectionIndex} fieldPath={`painPoints.${idx}.afterTitle`} value={row.afterTitle} />
                      </h4>
                      <p className="text-xs font-light leading-relaxed text-stone-700 dark:text-stone-300">
                        <EditableText sectionIndex={sectionIndex} fieldPath={`painPoints.${idx}.afterDesc`} value={row.afterDesc} />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </SectionWrapper>
  );
}
