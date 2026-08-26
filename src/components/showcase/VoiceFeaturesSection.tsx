"use client";

import React, { useState } from 'react';
import { Mic, MessageSquareText, FileText, Layout, Wand2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function VoiceFeaturesSection({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const [activeTab, setActiveTab] = useState(0);
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

  const defaultVoiceFeatures = [
    {
      id: "interview",
      icon: MessageSquareText,
      badge: "Démarrage Express",
      title: "L'Interview Vocale de Démarrage (Claude IA)",
      subtitle: "Parlez pendant 3 minutes avec l'assistant, votre site est prêt.",
      description: "Vous n'avez aucun questionnaire rébarbatif à remplir. Vous cliquez sur 'Lancer l'interview vocale', et vous répondez aux questions posées par l'assistant IA de viva voce. Claude synthétise l'ensemble de vos propos et configure immédiatement vos coordonnées, votre persona cible, votre ton de marque et vos thématiques de contenu.",
      speechExample: "« Bonjour, je suis naturopathe spécialisée en gestion du stress et troubles du sommeil. Mes consultations ont lieu en cabinet et en téléconsultation. Je souhaite un ton rassurant, scientifique et accessible. »",
      aiResult: "✅ Persona cible, ton de voix, positionnement et piliers de contenus configurés automatiquement dans l'admin !",
      stepNumber: "01",
    },
    {
      id: "dictee",
      icon: FileText,
      badge: "Rédaction Rapide",
      title: "La Dictée Vocale d'Articles de Blog",
      subtitle: "Ne tapez plus de longs paragraphes au clavier.",
      description: "Vous souhaitez publier un conseil ou présenter un nouveau soin ? Activez le microphone et racontez simplement ce que vous voulez transmettre. L'IA structure votre pensée, génère un titre accrocheur, les intertitres, le corps du texte et les méta-balises SEO tout en respectant scrupuleusement votre style.",
      speechExample: "« Explique en 4 points pourquoi le massage aux pierres chaudes soulage la fatigue musculaire pendant l'hiver et propose de prendre rendez-vous à la fin. »",
      aiResult: "✅ Article structuré de 750 mots, illustré et optimisé pour Google généré en 10 secondes !",
      stepNumber: "02",
    },
    {
      id: "pagebuilder",
      icon: Layout,
      badge: "Édition Instantanée",
      title: "La Retouche de Section à la Voix",
      subtitle: "Modifiez n'importe quel bloc d'un simple ordre oral.",
      description: "Vous voulez adapter le texte d'un bouton, reformuler une présentation ou ajouter un tarif ? Dans le constructeur de page, cliquez sur l'icône micro sur n'importe quel bloc et dites ce que vous voulez changer. L'IA effectue la modification en direct.",
      speechExample: "« Rend ce paragraphe plus dynamique et mets en valeur le fait que les séances ont lieu le samedi aussi. »",
      aiResult: "✅ Section réécrite et mise en page mise à jour sous vos yeux !",
      stepNumber: "03",
    },
  ];

  const voiceFeatures = data?.voiceFeatures && data.voiceFeatures.length > 0 ? data.voiceFeatures : defaultVoiceFeatures;
  const activeFeature = voiceFeatures[activeTab] || voiceFeatures[0];
  const ActiveIcon = activeFeature.icon || defaultVoiceFeatures[activeTab % 3].icon;

  return (
    <SectionWrapper data={data} sectionIndex={sectionIndex} className="py-20 lg:py-28 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider mb-4 ${
            dark
              ? 'bg-amber-950/60 border-amber-800 text-amber-400'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <Mic className="w-4 h-4 text-amber-600 animate-pulse" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Innovation Commandes Vocales"} as="span" />
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Gagnez un Temps Précieux :"} />
            {" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Pilotez Tout à la Voix"} />
            </span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Plus besoin de passer des heures le soir à saisir de longs textes au clavier. Avec notre bouton micro présent dans tous vos outils d'administration, dictez simplement vos envies."} />
          </p>
        </div>

        {/* Feature Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {voiceFeatures.map((feat: any, idx: number) => {
            const Icon = feat.icon || defaultVoiceFeatures[idx % 3].icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={feat.id || idx}
                onClick={() => setActiveTab(idx)}
                className={`p-6 rounded-3xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-[var(--brand-primary,#0f0e0d)] text-white border-[var(--brand-primary,#0f0e0d)] shadow-lg -translate-y-1'
                    : dark
                      ? 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                      : 'bg-white border-[var(--brand-border,#e7e5e4)] text-[var(--brand-text,#1c1917)] hover:bg-stone-50 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl border ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-2xl font-serif font-bold ${isActive ? 'text-amber-400' : 'text-stone-400'}`}>{feat.stepNumber || `0${idx + 1}`}</span>
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-amber-300' : 'text-stone-500'}`}>
                    <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${idx}.badge`} value={feat.badge} as="span" />
                  </span>
                  <h3 className="text-lg font-serif font-semibold mt-1 mb-2">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${idx}.title`} value={feat.title} />
                  </h3>
                </div>
                <p className={`text-xs line-clamp-2 ${isActive ? 'text-stone-200' : 'text-stone-500'}`}>
                  <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${idx}.subtitle`} value={feat.subtitle} />
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Feature Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className={`rounded-3xl p-8 lg:p-12 border shadow-xl backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
              dark
                ? 'bg-stone-900 border-stone-800'
                : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
            }`}
          >
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-4">
                <ActiveIcon className="w-4 h-4 text-amber-600" />
                <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${activeTab}.badge`} value={activeFeature.badge} as="span" />
              </div>
              <h3 className={`text-2xl sm:text-3xl font-serif font-semibold mb-4 ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${activeTab}.title`} value={activeFeature.title} />
              </h3>
              <p className={`text-sm sm:text-base font-light leading-relaxed mb-6 ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${activeTab}.description`} value={activeFeature.description} />
              </p>

              <div className="space-y-3">
                <div className={`flex items-center gap-3 text-xs sm:text-sm font-medium ${dark ? 'text-stone-300' : 'text-[var(--brand-text,#1c1917)]'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Aucun apprentissage technique nécessaire : parlez naturellement.</span>
                </div>
                <div className={`flex items-center gap-3 text-xs sm:text-sm font-medium ${dark ? 'text-stone-300' : 'text-[var(--brand-text,#1c1917)]'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Compréhension contextuelle fine de vos termes métiers.</span>
                </div>
                <div className={`flex items-center gap-3 text-xs sm:text-sm font-medium ${dark ? 'text-stone-300' : 'text-[var(--brand-text,#1c1917)]'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Fonctionne sur ordinateur, tablette et smartphone.</span>
                </div>
              </div>
            </div>

            {/* Right Mockup Box (Brand Light Warm Style) */}
            <div className={`lg:col-span-5 rounded-3xl p-6 border flex flex-col justify-between space-y-4 ${
              dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border-stone-200 shadow-xs'
            }`}>
              <div className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs relative overflow-hidden group">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4 text-xs font-mono">
                  <span className="text-amber-800 font-semibold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    Microphone Actif
                  </span>
                  <span className="text-stone-500">Claude 3.5 Sonnet</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-serif italic">
                    "{activeFeature.prompt}"
                  </div>
                  <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-800 font-medium">
                    ✓ Transcrit & Mis en page automatiquement sur le site.
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between border-b pb-3 mb-4 border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>Enregistrement vocal simulé</span>
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">00:14 / 00:30</span>
                </div>

                <div className="bg-amber-50/50 dark:bg-stone-900 p-4 rounded-xl border border-amber-200 dark:border-stone-800 mb-4">
                  <span className="text-[11px] text-stone-500 block mb-1 font-semibold">Votre parole :</span>
                  <p className="text-xs sm:text-sm text-stone-800 dark:text-amber-200 font-serif italic leading-relaxed">
                    <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${activeTab}.speechExample`} value={activeFeature.speechExample} />
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  <Wand2 className="w-4 h-4 text-emerald-600" />
                  <span>Résultat instantané de l'IA :</span>
                </div>
                <p className="text-xs text-emerald-900 dark:text-stone-200 font-medium">
                  <EditableText sectionIndex={sectionIndex} fieldPath={`voiceFeatures.${activeTab}.aiResult`} value={activeFeature.aiResult} />
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </SectionWrapper>
  );
}
