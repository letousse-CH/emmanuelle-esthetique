"use client";

import React from 'react';
import { Receipt, Mic, Users, Search, Calendar, Smartphone, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';
import EditableText from '../pagebuilder/EditableText';

export default function TurnkeyBentoGrid({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

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
            <Sparkles className="w-4 h-4 text-amber-500" />
            <EditableText sectionIndex={sectionIndex} fieldPath="eyebrow" value={data?.eyebrow || "Tous Vos Outils Réunis au Même Endroit"} as="span" />
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="title" value={data?.title || "Une Solution Tout-en-Un Conçue Pour"} />
            {" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">
              <EditableText sectionIndex={sectionIndex} fieldPath="title_highlight" value={data?.title_highlight || "Vous Faciliter la Vie"} />
            </span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            <EditableText sectionIndex={sectionIndex} fieldPath="description" value={data?.description || "Profitez de la puissance d'une suite logicielle complète sans la complexité. Découvrez l'ensemble des piliers de votre nouvelle plateforme."} />
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* CARD 1: Caisse & Facturation (8 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`md:col-span-8 rounded-3xl p-8 lg:p-10 border relative overflow-hidden group transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
              dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80 shadow-sm hover:border-stone-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-900 dark:text-stone-100">
                  <Receipt className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="px-3.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium rounded-full">
                  🇨🇭 Conforme Droit Suisse CO
                </span>
              </div>

              <h3 className={`text-2xl sm:text-3xl font-serif font-semibold mb-3 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card1_title" value={data?.card1_title || "Caisse Enregistreuse & Facturation Réglementaire"} />
              </h3>
              <p className={`text-sm sm:text-base font-light leading-relaxed mb-6 max-w-xl ${dark ? 'text-stone-300' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card1_desc" value={data?.card1_desc || "Encaissez vos prestations et produits en toute sérénité. Conforme au Code des obligations suisse (art. 957a / 958f), la caisse alloue une numérotation continue certifiée (FAC-2026-XXXX), gère vos bons cadeaux et génère un export fiduciaire mensuel automatisé."} />
              </p>
            </div>

            {/* VISUAL 1: Caisse & Facturation Suisse (Brand Light Warm Style) */}
            <div className="mt-6 mb-6 rounded-2xl p-6 sm:p-8 bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-[var(--brand-border,#e7e5e4)] shadow-xs relative overflow-hidden group">
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Left side: Invoice preview */}
                <div className="sm:col-span-7 bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                      <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                      <span className="text-xs font-mono text-stone-500 ml-2">FAC-2026-0042.pdf</span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200">
                      ✓ Certifié CO Suisse
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <p className="font-semibold text-stone-900">Soin Signature & Massage Naturo</p>
                        <p className="text-[11px] text-stone-500">Cliente : Sophie Martin (Lausanne)</p>
                      </div>
                      <p className="font-mono font-bold text-stone-900 text-sm">CHF 160.00</p>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-stone-600 pt-2 border-t border-stone-100">
                      <span>Mode d'encaissement :</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-200 text-[10px]">
                          + TWINT
                        </span>
                        <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px]">
                          Carte Bancaire
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-stone-500">
                      <span>TVA (8.1% incluse) :</span>
                      <span className="font-mono text-stone-700">CHF 12.00</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Interactive Graphic Badge */}
                <div className="sm:col-span-5 flex flex-col justify-center gap-3">
                  <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-xs flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200">
                      <ShieldCheck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">Export Fiducie 1-Clic</p>
                      <p className="text-[11px] text-stone-500">Fichier CSV & PDF zippé mensuel</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-xs flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-stone-100 text-stone-800 font-bold border border-stone-200">
                      <Zap className="w-5 h-5 text-stone-700" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">Quittance SMS & Email</p>
                      <p className="text-[11px] text-stone-500">Envoi automatique à la cliente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-stone-100 dark:border-stone-800 text-xs font-medium">
              <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
                <ShieldCheck className="w-4 h-4 text-stone-800 dark:text-stone-200 flex-shrink-0" />
                <span>Quittances PDF Instantanées</span>
              </div>
              <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
                <ShieldCheck className="w-4 h-4 text-stone-800 dark:text-stone-200 flex-shrink-0" />
                <span>Gestion TVA Multi-taux</span>
              </div>
              <div className="flex items-center gap-2.5 text-stone-700 dark:text-stone-300">
                <ShieldCheck className="w-4 h-4 text-stone-800 dark:text-stone-200 flex-shrink-0" />
                <span>Bons Cadeaux Suivis</span>
              </div>
            </div>
          </motion.div>

          {/* CARD 2: Commandes Vocales (4 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`md:col-span-4 rounded-3xl p-8 border relative overflow-hidden group transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
              dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80 shadow-sm hover:border-amber-400/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300">
                  <Mic className="w-6 h-6 animate-pulse text-amber-600" />
                </div>
                <span className="px-3.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/60 text-xs font-medium rounded-full">
                  100% Vocal
                </span>
              </div>

              <h3 className={`text-xl font-serif font-semibold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card2_title" value={data?.card2_title || "Commandes Vocales & IA"} />
              </h3>
              <p className={`text-sm font-light leading-relaxed mb-6 ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card2_desc" value={data?.card2_desc || "Ne tapez plus vos textes au clavier. Dictez vos offres, vos consignes et vos articles de blog directement au microphone."} />
              </p>
            </div>

            {/* VISUAL 2: Voice Orb Brand Light Illustration */}
            <div className="my-4 rounded-2xl p-5 bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-center mb-3 relative">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center relative z-10 shadow-sm">
                  <Mic className="w-7 h-7 text-amber-700" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 border border-stone-200 text-center relative z-10 shadow-xs">
                <p className="text-[11px] font-serif italic text-stone-800">
                  "Rédige une offre spéciale de printemps pour un soin éclat à CHF 120.-"
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-amber-800 font-semibold">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Généré en 1.4 sec</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-400 font-semibold">
              <span>Interview Vocale Claude</span>
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </motion.div>

          {/* CARD 3: Fichier Clients (4 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className={`md:col-span-4 rounded-3xl p-8 border relative overflow-hidden group transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
              dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80 shadow-sm hover:border-stone-300'
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-900 dark:text-stone-100 mb-6">
                <Users className="w-6 h-6 text-stone-900 dark:text-stone-100" />
              </div>
              <h3 className={`text-xl font-serif font-semibold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card3_title" value={data?.card3_title || "Fichier Clients & CRM"} />
              </h3>
              <p className={`text-sm font-light leading-relaxed mb-6 ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card3_desc" value={data?.card3_desc || "Conservez l'historique complet de vos clientes : rendez-vous, préférences de soin, achats de produits et bons cadeaux rattachés."} />
              </p>
            </div>

            {/* VISUAL 3: Customer Card Brand Light UI */}
            <div className="my-4 rounded-2xl p-4 bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-stone-900 font-bold flex items-center justify-center text-white text-sm shadow-xs">
                  SM
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">Sophie Martin</h4>
                  <p className="text-[11px] text-stone-500">Cliente V.I.P • 14 Rendez-vous</p>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] bg-white p-3 rounded-xl border border-stone-200 shadow-xs">
                <div className="flex justify-between text-stone-700">
                  <span>Dernier Soin :</span>
                  <span className="font-semibold text-stone-900">Massages Naturo</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Total Encaissé :</span>
                  <span className="font-mono text-stone-900 font-medium">CHF 1'840.00</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Bon Cadeau Actif :</span>
                  <span className="text-amber-800 font-medium">BON-2026 (CHF 80.-)</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CARD 4: SEO Auto (4 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className={`md:col-span-4 rounded-3xl p-8 border relative overflow-hidden group transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
              dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80 shadow-sm hover:border-stone-300'
            }`}
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-900 dark:text-stone-100 mb-6">
                <Search className="w-6 h-6 text-stone-900 dark:text-stone-100" />
              </div>
              <h3 className={`text-xl font-serif font-semibold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card4_title" value={data?.card4_title || "Référencement SEO Auto"} />
              </h3>
              <p className={`text-sm font-light leading-relaxed mb-6 ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card4_desc" value={data?.card4_desc || "Optimisation automatique pour Bing et Google : balises Schema.org, plan sitemap.xml, cartes OpenGraph et mots-clés intégrés."} />
              </p>
            </div>

            {/* VISUAL 4: Google Lighthouse Brand Light UI */}
            <div className="my-4 rounded-2xl p-4 bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs">
              <div className="flex items-center justify-between mb-2.5 border-b border-stone-200 pb-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-stone-800">
                  <span className="text-stone-900 font-bold">Google</span>
                  <span className="ml-1 text-[11px] text-stone-500">Search</span>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-stone-900 text-white text-[10px] font-bold">
                  Score 99/100
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-1 shadow-xs">
                <p className="text-xs font-medium text-stone-900 truncate">
                  Cabinet Naturopathie & Massage Lausanne
                </p>
                <p className="text-[10px] text-amber-800">https://votre-cabinet.ch › soins</p>
                <p className="text-[10px] text-stone-500 line-clamp-2">
                  Prise de rendez-vous en ligne instantanée. Quittance certifiée et remboursement assurances complémentaires.
                </p>
              </div>
            </div>
          </motion.div>

          {/* CARD 5: Ateliers & PWA (4 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className={`md:col-span-4 rounded-3xl p-8 border relative overflow-hidden group transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
              dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/80 shadow-sm hover:border-stone-300'
            }`}
          >
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-900 dark:text-stone-100">
                  <Calendar className="w-6 h-6 text-stone-900 dark:text-stone-100" />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300">
                  <Smartphone className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <h3 className={`text-xl font-serif font-semibold mb-2 ${dark ? 'text-white' : 'text-stone-900'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card5_title" value={data?.card5_title || "Ateliers Stripe & Application PWA"} />
              </h3>
              <p className={`text-sm font-light leading-relaxed mb-6 ${dark ? 'text-stone-400' : 'text-stone-600'}`}>
                <EditableText sectionIndex={sectionIndex} fieldPath="card5_desc" value={data?.card5_desc || "Organisez des événements et ateliers avec réservation Stripe. Installez votre caisse directement sur l'écran d'accueil de votre tablette."} />
              </p>
            </div>

            {/* VISUAL 5: Stripe Event Pass Brand Light UI */}
            <div className="my-4 rounded-2xl p-4 bg-[var(--brand-surface,#f8f8f7)] text-stone-900 border border-stone-200 shadow-xs relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800">Billetterie Stripe</span>
                  <h4 className="text-xs font-semibold text-stone-900">Atelier Sophrologie & Sommeil</h4>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[10px] border border-amber-200">
                  CHF 60.00
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                <span>Samedi 14 Octobre • 14:00</span>
                <span className="text-stone-900 font-semibold">8 / 10 Places Reservées</span>
              </div>
            </div>
          </motion.div>

        </div>

      </div>
    </SectionWrapper>
  );
}
