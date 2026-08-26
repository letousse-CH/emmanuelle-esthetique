"use client";

import React, { useState } from 'react';
import { Mic, MicOff, Sparkles, ArrowRight, ShieldCheck, Zap, Volume2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export interface AdminShowcaseHeroData {
  theme?: 'light' | 'dark' | 'surface' | 'primary';
  eyebrow?: string;
  title?: string;
  title_highlight?: string;
  description?: string;
  cta_primary_text?: string;
  cta_primary_href?: string;
  cta_secondary_text?: string;
  cta_secondary_href?: string;
  bg_image?: string;
}

export default function AdminShowcaseHero({ data, sectionIndex }: { data?: AdminShowcaseHeroData; sectionIndex?: number }) {
  const [isListening, setIsListening] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const voicePrompts = [
    {
      label: "Ligne éditoriale",
      speech: "« Je suis thérapeute en cabinet à Lausanne. Je propose du shiatsu et des soins relaxation. Mon ton est bienveillant, chaleureux et professionnel. »",
      result: "✨ Ligne éditoriale, persona cible et piliers de contenu configurés automatiquement !",
    },
    {
      label: "Création de prestation",
      speech: "« Ajoute un soin Head Spa Japonais de 60 minutes à CHF 140 dans la caisse et sur le site. »",
      result: "⚡ Prestation ajoutée au catalogue caisse et publiée en ligne instantanément !",
    },
    {
      label: "Article de blog",
      speech: "« Rédige un article sur les 5 bienfaits du drainage lymphatique en automne avec un appel à réserver. »",
      result: "📝 Article de 800 mots rédigé, illustré et optimisé SEO en 15 secondes !",
    },
  ];

  const currentPrompt = voicePrompts[activeStep];

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-16 lg:py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Eyebrow Badge */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs sm:text-sm font-semibold tracking-wide shadow-sm ${
              dark
                ? 'bg-stone-800/80 border-stone-700 text-emerald-400'
                : 'bg-[var(--brand-surface,#f5f5f4)] border-[var(--brand-border,#e7e5e4)] text-[var(--brand-primary,#0f0e0d)]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Solution Clé en Main Tout-en-Un & Commandes Vocales"} as="span" />
          </motion.div>
        </div>

        {/* Title & Description */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-serif font-semibold tracking-tight leading-[1.15] mb-6 ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Votre Activité Déployée & Pilotée en Toute Simplicité"} />
            {" "}
            <span className="block mt-2 font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Même à la Voix, Sans Rien Taper au Clavier."} />
            </span>
          </h1>

          <p className={`text-base sm:text-xl font-light leading-relaxed max-w-3xl mx-auto ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Découvrez la solution clé en main complète conçue pour vous faciliter la vie d'un point de vue pratique et efficace : site web dynamique, caisse conforme au droit suisse, fichier clients, réservations et assistant IA réactif à votre voix."} />
          </p>
        </div>

        {/* CTA Buttons & Reassurance Bar */}
        <div className="flex flex-col items-center justify-center mb-16">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-4">
            <Link
              href={data?.cta_primary_href || "#maquettes"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-[var(--brand-primary,#0f0e0d)] hover:bg-stone-800 text-white font-bold rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-sm border border-stone-800"
            >
              <span>{data?.cta_primary_text || "Explorer les Outils Admin"}</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </Link>
            <Link
              href={data?.cta_secondary_href || "/contact"}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 font-semibold rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-sm ${
                dark
                  ? 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
                  : 'bg-white text-[var(--brand-text,#1c1917)] border-[var(--brand-border,#e7e5e4)] hover:bg-stone-50 shadow-sm'
              }`}
            >
              <span>{data?.cta_secondary_text || "Demander une Démonstration"}</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-stone-600 dark:text-stone-300 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Configuration & Déploiement Clé en Main
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Caisse Certifiée CO Suisse & Export 1-Clic
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Sans Aucun Frais Caché
            </span>
          </div>
        </div>

        {/* Interactive Voice Demo Box */}
        <div className={`max-w-3xl mx-auto rounded-3xl p-6 sm:p-8 shadow-xl border backdrop-blur-md relative ${
          dark
            ? 'bg-stone-900/90 border-stone-800'
            : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
        }`}>
          <div className="flex items-center justify-between border-b pb-4 mb-6 border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <span className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-emerald-400' : 'text-stone-700'}`}>
                Démonstrateur Interactif — Dictée Vocale en Direct
              </span>
            </div>
            <div className="flex gap-2">
              {voicePrompts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                    activeStep === idx ? 'bg-[var(--brand-primary,#0f0e0d)] w-6' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                  aria-label={`Étape ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Voice Prompt Tabs */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {voicePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all border text-left cursor-pointer ${
                  activeStep === idx
                    ? 'bg-[var(--brand-primary,#0f0e0d)] text-white border-[var(--brand-primary,#0f0e0d)] shadow-md'
                    : dark
                      ? 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200'
                      : 'bg-white border-[var(--brand-border,#e7e5e4)] text-[var(--brand-text-muted,#78716c)] hover:text-stone-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Voice Mic Box */}
          <div className={`rounded-2xl p-5 border mb-6 ${
            dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
          }`}>
            <div className="flex items-start gap-4">
              <button
                onClick={() => setIsListening(!isListening)}
                className={`p-4 rounded-2xl transition-all cursor-pointer flex-shrink-0 border ${
                  isListening
                    ? 'bg-red-500/10 border-red-500/40 text-red-600 animate-pulse'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20'
                }`}
                title="Tester la commande vocale"
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider">Consigne vocale dictée :</span>
                </div>
                <p className={`font-serif italic text-base sm:text-lg leading-relaxed ${dark ? 'text-stone-200' : 'text-[var(--brand-text,#1c1917)]'}`}>
                  {currentPrompt.speech}
                </p>

                {/* Animated Voice Waves */}
                <div className="flex items-center gap-1 mt-4">
                  {[40, 75, 50, 90, 60, 30, 85, 45, 95, 65, 40, 70].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: isListening ? [10, h / 3, 10] : 8 }}
                      transition={{ duration: 0.5 + (i % 3) * 0.2, repeat: Infinity, repeatType: 'mirror' }}
                      className={`w-1 rounded-full ${isListening ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                      style={{ height: '8px' }}
                    />
                  ))}
                  <span className="ml-3 text-xs text-stone-400 font-medium">
                    {isListening ? 'Écoute active en cours...' : 'Cliquez sur le micro pour tester'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Result Box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm font-semibold border ${
                dark
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>{currentPrompt.result}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Webflow Hero Dashboard Screenshot Showcase */}
        {data?.bg_image && (
          <div className="mt-14 max-w-5xl mx-auto rounded-3xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.22)] bg-stone-950 group relative">
            <div className="bg-stone-900 px-4 py-3 border-b border-stone-800 flex items-center justify-between text-xs text-stone-400 font-mono z-10 relative">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
              </div>
              <div className="bg-stone-950/90 border border-stone-800 px-4 py-1 rounded-full text-[11px] text-stone-300 font-mono flex items-center gap-2 max-w-sm mx-auto justify-center shadow-inner">
                <span className="text-emerald-400">🔒</span>
                <span>https://votre-cabinet.ch/admin</span>
              </div>
              <span className="text-emerald-400 font-bold text-[11px] hidden sm:inline-block">Tableau de Bord Réel</span>
            </div>
            <div className="max-h-[460px] overflow-hidden relative">
              <img src={data.bg_image} alt="Aperçu Tableau de Bord" className="w-full h-auto object-cover object-top group-hover:scale-[1.02] transition-transform duration-700 ease-out" />
            </div>
          </div>
        )}

        {/* Feature Badges Below */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
            dark ? 'bg-stone-900/50 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
          }`}>
            <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className={`text-xs font-bold ${dark ? 'text-stone-200' : 'text-stone-900'}`}>Caisse Certifiée CO Suisse</p>
              <p className="text-[11px] text-stone-500">Conforme art. 957a / 958f & TVA</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
            dark ? 'bg-stone-900/50 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
          }`}>
            <Mic className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <p className={`text-xs font-bold ${dark ? 'text-stone-200' : 'text-stone-900'}`}>Commandes Vocales IA</p>
              <p className="text-[11px] text-stone-500">Ne tapez plus de longs textes</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
            dark ? 'bg-stone-900/50 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
          }`}>
            <CheckCircle2 className="w-6 h-6 text-teal-600 flex-shrink-0" />
            <div>
              <p className={`text-xs font-bold ${dark ? 'text-stone-200' : 'text-stone-900'}`}>Accompagnement Clé en Main</p>
              <p className="text-[11px] text-stone-500">Installation & support inclus</p>
            </div>
          </div>
        </div>

      </div>
    </SectionWrapper>
  );
}
