"use client";

import React, { useState } from 'react';
import { Receipt, Users, LayoutGrid, SlidersHorizontal, Download, Gift, ShieldCheck, Sparkles, Phone, Mail, Calendar, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SectionWrapper } from '../pagebuilder/sections';

export default function AdminMockupsGallery({ data, sectionIndex }: { data?: any; sectionIndex?: number }) {
  const [activeTab, setActiveTab] = useState<'caisse' | 'crm' | 'builder' | 'modules'>('caisse');
  const dark = data?.theme === 'dark' || data?.theme === 'primary';

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
            <span>Découvrez Votre Interface Admin</span>
          </div>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold ${dark ? 'text-white' : 'text-[var(--brand-text,#1c1917)]'}`}>
            Une Suite d'Outils Pensée Pour{" "}
            <span className="font-serif italic text-amber-600 dark:text-amber-300">Votre Efficacité au Quotidien</span>
          </h2>
          <p className={`mt-4 text-base sm:text-lg font-light leading-relaxed ${dark ? 'text-stone-300' : 'text-[var(--brand-text-muted,#78716c)]'}`}>
            Explorez les captations d'écran et les interfaces réelles de votre espace d'administration. Tout a été optimisé pour être fluide, rapide et utilisable même depuis une tablette.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            { key: 'caisse', label: 'Caisse Légale Suisse (CO)', icon: Receipt },
            { key: 'crm', label: 'Fichier Clients & CRM', icon: Users },
            { key: 'builder', label: 'PageBuilder & Voix', icon: LayoutGrid },
            { key: 'modules', label: 'Modules 1-Click', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--brand-primary,#0f0e0d)] text-white border-[var(--brand-primary,#0f0e0d)] shadow-md'
                    : dark
                      ? 'bg-stone-900 text-stone-300 border-stone-800 hover:bg-stone-800'
                      : 'bg-white text-[var(--brand-text,#1c1917)] border-[var(--brand-border,#e7e5e4)] hover:bg-stone-50 shadow-xs'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mockup Display Box */}
        <div className={`rounded-3xl p-6 sm:p-10 border shadow-xl backdrop-blur-xl ${
          dark ? 'bg-stone-900 border-stone-800' : 'bg-white border-[var(--brand-border,#e7e5e4)] shadow-xs'
        }`}>
          {/* Captation d'écran réelle transmise depuis le CDN (Cadre Navigateur Mac Webflow) */}
          {data?.[`mockup_image_${activeTab}`] && (
            <div className="mb-10 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.18)] relative group bg-stone-950">
              {/* Toolbar Navigateur Mac Premium */}
              <div className="bg-stone-900 px-4 py-3 border-b border-stone-800 flex items-center justify-between text-xs text-stone-400 font-mono z-10 relative">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-xs" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-xs" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-xs" />
                </div>

                {/* Barre d'adresse URL */}
                <div className="bg-stone-950/80 border border-stone-800 px-4 py-1 rounded-full text-[11px] text-stone-300 font-mono flex items-center gap-2 w-full max-w-sm sm:max-w-md mx-auto justify-center shadow-inner">
                  <span className="text-emerald-400">🔒</span>
                  <span className="truncate">https://votre-cabinet.ch/admin/{activeTab}</span>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                    🇨🇭 Live CDN R2
                  </span>
                </div>
              </div>

              {/* Image d'interface réelle recadrée avec zoom net sur la fonction */}
              <div className="overflow-hidden max-h-[520px] h-[360px] sm:h-[480px] relative bg-stone-950">
                <img
                  src={data[`mockup_image_${activeTab}`]}
                  alt={`Capture réelle de l'admin - module ${activeTab}`}
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.65] ${
                    activeTab === 'caisse' ? 'scale-[1.6] origin-[15%_18%]' :
                    activeTab === 'crm' ? 'scale-[1.6] origin-[12%_15%]' :
                    activeTab === 'builder' ? 'scale-[1.6] origin-[30%_15%]' : 'scale-[1.6] origin-[15%_15%]'
                  }`}
                />

                {/* Badge flottant Webflow Over-Image */}
                <div className="absolute bottom-4 right-4 bg-stone-900/90 backdrop-blur-md border border-stone-700/80 text-white px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    {activeTab === 'caisse' && 'Encaissement & Numérotation FAC-2026'}
                    {activeTab === 'crm' && 'Fichier Clients & Soins Rattachés'}
                    {activeTab === 'builder' && 'Éditeur Visuel & Dictée Micro'}
                    {activeTab === 'modules' && 'Activation Modules 1-Click'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            
            {/* TAB 1: CAISSE ENREGISTREUSE */}
            {activeTab === 'caisse' && (
              <motion.div
                key="caisse"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl border ${
                  dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Conforme Code des Obligations Suisse (CO art. 957a / 958f)</span>
                    </div>
                    <h3 className={`text-lg font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
                      Module Caisse Enregistreuse & Facturation Clientèle
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-mono font-bold border border-emerald-300">
                    Prochaine Facture : FAC-2026-0042
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Catalogue */}
                  <div className={`lg:col-span-7 p-5 rounded-2xl border space-y-4 ${
                    dark ? 'bg-stone-950/60 border-stone-800' : 'bg-stone-50 border-stone-200'
                  }`}>
                    <h4 className="text-xs font-bold uppercase text-stone-500 tracking-wider">
                      Catalogue des Soins & Prestations (Sélection rapide)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border border-emerald-500/40 flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <p className="font-semibold text-stone-900 dark:text-stone-200">Soin Visage Glowing Face</p>
                          <p className="text-[11px] text-stone-400">60 min • TVA 0%</p>
                        </div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">CHF 130.00</span>
                      </div>
                      <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <p className="font-semibold text-stone-900 dark:text-stone-200">Head Spa Japonais</p>
                          <p className="text-[11px] text-stone-400">75 min • TVA 0%</p>
                        </div>
                        <span className="font-bold text-stone-700 dark:text-stone-300">CHF 160.00</span>
                      </div>
                      <div className="p-3.5 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center text-xs shadow-xs">
                        <div>
                          <p className="font-semibold text-stone-900 dark:text-stone-200">Massage Drainage</p>
                          <p className="text-[11px] text-stone-400">50 min • TVA 0%</p>
                        </div>
                        <span className="font-bold text-stone-700 dark:text-stone-300">CHF 120.00</span>
                      </div>
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-700 flex justify-between items-center text-xs shadow-xs">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="font-semibold text-amber-900 dark:text-amber-200">Bon Cadeau Utilisé</p>
                            <p className="text-[11px] text-amber-600 font-mono">BON-2026-0012</p>
                          </div>
                        </div>
                        <span className="font-bold text-amber-700 dark:text-amber-400">- CHF 50.00</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 flex items-center justify-between">
                      <span>💡 <strong>Traçabilité légale 10 ans</strong> : Calculs certifiés serveur Postgres.</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">Export Fiducie XLS/PDF</span>
                    </div>
                  </div>

                  {/* Right Invoice Box */}
                  <div className={`lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                    dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-sm'
                  }`}>
                    <div>
                      <div className="flex justify-between items-center pb-3 border-b border-stone-200 dark:border-stone-800 text-xs">
                        <span className="font-mono text-stone-500">FACTURE N° FAC-2026-0041</span>
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded text-[10px] font-bold">Payée (TWINT)</span>
                      </div>

                      <div className="py-3 text-xs space-y-2">
                        <div className="flex justify-between font-medium">
                          <span className="text-stone-900 dark:text-stone-200">Cliente : Mme Sophie Martin</span>
                          <span className="text-stone-400">22.08.2026</span>
                        </div>
                        <div className="flex justify-between text-stone-500">
                          <span>Soin Visage Glowing Face</span>
                          <span>CHF 130.00</span>
                        </div>
                        <div className="flex justify-between text-amber-700 dark:text-amber-400">
                          <span>Bon Cadeau (BON-2026-0012)</span>
                          <span>- CHF 50.00</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Recette encaissée :</span>
                        <span className="text-lg font-serif font-bold text-emerald-700 dark:text-emerald-400">CHF 80.00</span>
                      </div>
                    </div>

                    <button className="w-full py-2.5 bg-[var(--brand-primary,#0f0e0d)] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                      <Download className="w-4 h-4" />
                      <span>Télécharger Quittance PDF</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: CRM CLIENTS */}
            {activeTab === 'crm' && (
              <motion.div
                key="crm"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className={`p-4 rounded-2xl border ${
                  dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
                }`}>
                  <h3 className={`text-lg font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
                    Fichier Clientes & Historique des Visites
                  </h3>
                  <p className="text-xs text-stone-500">Centralisez l'historique d'achats, les notes de soin et les bons cadeaux de chaque client.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Client 1 */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-sm border border-emerald-300">
                        SM
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${dark ? 'text-stone-100' : 'text-stone-900'}`}>Sophie Martin</h4>
                        <p className="text-[11px] text-stone-400">Cliente fidèle • 8 visites</p>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 pt-2 border-t border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2 text-stone-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span>+41 79 123 45 67</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Dernier soin : 22 août 2026</span>
                      </div>
                    </div>
                    <div className="bg-stone-50 dark:bg-stone-900 p-2.5 rounded-xl text-[11px] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800">
                      <p className="font-semibold">Note : Pression douce pour les massages du visage.</p>
                    </div>
                  </div>

                  {/* Client 2 */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold flex items-center justify-center text-sm border border-stone-300">
                        CD
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${dark ? 'text-stone-100' : 'text-stone-900'}`}>Claire Dubois</h4>
                        <p className="text-[11px] text-stone-400">Nouvelle cliente • 2 visites</p>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 pt-2 border-t border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2 text-stone-500">
                        <Mail className="w-3.5 h-3.5" />
                        <span>claire.dubois@email.ch</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Gift className="w-3.5 h-3.5" />
                        <span className="font-mono">Bon actif : BON-2026-0089</span>
                      </div>
                    </div>
                  </div>

                  {/* Client 3 */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold flex items-center justify-center text-sm border border-stone-300">
                        LR
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${dark ? 'text-stone-100' : 'text-stone-900'}`}>Laura Rossier</h4>
                        <p className="text-[11px] text-stone-400">Abonnée Newsletter • 5 visites</p>
                      </div>
                    </div>
                    <div className="text-xs space-y-1 pt-2 border-t border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2 text-stone-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Dernière visite : 14 juillet 2026</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: PAGEBUILDER */}
            {activeTab === 'builder' && (
              <motion.div
                key="builder"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className={`p-4 rounded-2xl border ${
                  dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
                }`}>
                  <h3 className={`text-lg font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
                    PageBuilder Visuel & Retouche Vocale en Direct
                  </h3>
                  <p className="text-xs text-stone-500">Glissez-déposez des blocs, modifiez vos textes à la voix ou laissez l'IA générer vos pages.</p>
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    dark ? 'bg-stone-950 border-emerald-800' : 'bg-white border-emerald-400 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-200">Section Hero #1 (En-tête principale)</p>
                        <p className="text-[11px] text-stone-400">Titre : « Vos Soins du Visage & Head Spa à Palézieux »</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" />
                      <span>Retoucher à la voix</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: MODULES 1-CLICK */}
            {activeTab === 'modules' && (
              <motion.div
                key="modules"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className={`p-4 rounded-2xl border ${
                  dark ? 'bg-stone-950 border-stone-800' : 'bg-[var(--brand-surface,#f8f8f7)] border-[var(--brand-border,#e7e5e4)]'
                }`}>
                  <h3 className={`text-lg font-serif font-semibold ${dark ? 'text-white' : 'text-stone-900'}`}>
                    Gestion des Modules en 1 Clic (Feature Flags)
                  </h3>
                  <p className="text-xs text-stone-500">Activez ou désactivez les fonctionnalités selon vos besoins. Aucun code requis.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "Caisse Enregistreuse", desc: "Encaissement, factures CO suisse & fiducie" },
                    { name: "Blog & Articles IA", desc: "Rédaction assistée & référencement SEO" },
                    { name: "Événements & Ateliers", desc: "Réservation en ligne avec paiements Stripe" },
                    { name: "Newsletter & Abonnés", desc: "Formulaire de captage & envois d'emails" },
                    { name: "Génération Vocale IA", desc: "Interview Claude & dictée au micro" },
                    { name: "Promotions & Codes", desc: "Gestion des remises pour vos clientes" },
                  ].map((mod, i) => (
                    <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between ${
                      dark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-xs'
                    }`}>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200">{mod.name}</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">{mod.desc}</p>
                      </div>
                      <div className="w-9 h-5 rounded-full bg-emerald-500 flex items-center justify-end px-0.5 cursor-pointer">
                        <div className="w-4 h-4 rounded-full bg-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </SectionWrapper>
  );
}
