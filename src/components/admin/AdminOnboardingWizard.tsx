"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2, ChevronDown, ChevronUp, X, Building2, LayoutTemplate, CreditCard, ArrowRight, Bot } from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';

interface Props {
  hasBusinessInfo?: boolean;
  pageCount?: number;
  articleCount?: number;
  siteName?: string;
}

export default function AdminOnboardingWizard({
  hasBusinessInfo = false,
  pageCount = 0,
  articleCount = 0,
  siteName = '',
}: Props) {
  const moduleFlags = useModuleFlags();
  const caisseEnabled = moduleFlags.caisse;

  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('studio_onboarding_dismissed') === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('studio_onboarding_dismissed', 'true');
    setDismissed(true);
  };

  const handleRestore = () => {
    localStorage.removeItem('studio_onboarding_dismissed');
    setDismissed(false);
    setCollapsed(false);
  };

  // Calcul du taux de complétion (0 à 3)
  const step1Done = hasBusinessInfo || Boolean(siteName && siteName !== 'Studio Admin');
  const step2Done = pageCount > 0;
  const step3Done = articleCount > 0;

  const completedCount = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);
  const progressPercent = Math.round((completedCount / 3) * 100);

  if (dismissed) {
    return (
      <div className="flex justify-end mb-4">
        <button
          onClick={handleRestore}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-purple-200 text-purple-900 text-xs font-extrabold shadow-2xs hover:bg-purple-50 transition-all cursor-pointer"
        >
          <Sparkles size={14} className="text-purple-600 animate-pulse" />
          <span>Guide de démarrage ( {completedCount}/3 )</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-purple-100/90 rounded-3xl p-6 sm:p-7 shadow-[0_4px_25px_rgba(168,85,247,0.08)] relative overflow-hidden transition-all mb-8">
      {/* Halo lumineux d'arrière-plan */}
      <div className="absolute -top-16 -right-16 size-64 bg-gradient-to-br from-violet-400/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête de la carte d'onboarding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-purple-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white text-[10.5px] font-extrabold uppercase tracking-wider shadow-[0_2px_10px_rgba(168,85,247,0.25)] flex items-center gap-1.5">
              <Sparkles size={12} className="text-white" />
              Guide d'installation rapide
            </span>
            <span className="text-xs font-extrabold text-purple-900 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              {completedCount} / 3 étapes complétées
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight mt-2">
            Bienvenue ! Configurez votre espace en 3 étapes simples (0 jargon).
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium">
            Suivez ces 3 étapes guidées pour personnaliser votre entreprise, publier vos pages et lancer vos outils.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-all cursor-pointer"
            title={collapsed ? "Déplier le guide" : "Réduire le guide"}
          >
            {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
            title="Masquer le guide"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Barre de progression visuelle */}
      <div className="mt-4 mb-6">
        <div className="flex items-center justify-between text-xs font-extrabold text-zinc-700 mb-1.5">
          <span>Progression globale</span>
          <span className="text-purple-700">{progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden p-0.5 border border-zinc-200/80">
          <div
            className="h-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 rounded-full transition-all duration-500 shadow-[0_2px_8px_rgba(168,85,247,0.4)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Contenu détaillé des 3 étapes */}
      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 animate-fadein">
          {/* Étape 1 : Identité & Coordonnées */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            step1Done
              ? 'bg-emerald-50/40 border-emerald-200'
              : 'bg-white border-zinc-200/90 shadow-2xs hover:border-purple-300'
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-900">
                  <Building2 size={18} />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                  step1Done
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {step1Done ? <CheckCircle2 size={12} /> : null}
                  {step1Done ? 'Complété' : 'Étape 1'}
                </span>
              </div>
              <h3 className="font-extrabold text-zinc-900 text-sm mb-1">
                1. Identité & Coordonnées
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed font-medium mb-4">
                Indiquez le nom de votre établissement, vos numéros de contact, e-mail et logo pour vos factures et votre site.
              </p>
            </div>
            <Link
              href="/admin/settings?tab=business"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-center w-full mt-auto"
            >
              <span>{step1Done ? 'Modifier mes coordonnées' : 'Configurer mon entreprise'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Étape 2 : Structure & Contenus */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            step2Done
              ? 'bg-emerald-50/40 border-emerald-200'
              : 'bg-white border-zinc-200/90 shadow-2xs hover:border-purple-300'
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-900">
                  <LayoutTemplate size={18} />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                  step2Done
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {step2Done ? <CheckCircle2 size={12} /> : null}
                  {step2Done ? 'Complété' : 'Étape 2'}
                </span>
              </div>
              <h3 className="font-extrabold text-zinc-900 text-sm mb-1">
                2. Vos Pages & Vos Sections
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed font-medium mb-4">
                Personnalisez vos pages ou générez la structure idéale de votre site en 1 clic grâce à notre assistant IA.
              </p>
            </div>
            <Link
              href="/admin/pages"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(249,115,22,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-center w-full mt-auto"
            >
              <span>{step2Done ? 'Gérer mes pages' : 'Générer mes pages par IA'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Étape 3 : Vos Outils Métiers ou Assistants IA */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            step3Done
              ? 'bg-emerald-50/40 border-emerald-200'
              : 'bg-white border-zinc-200/90 shadow-2xs hover:border-purple-300'
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-900">
                  {caisseEnabled ? <CreditCard size={18} /> : <Bot size={18} />}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                  step3Done
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  {step3Done ? <CheckCircle2 size={12} /> : null}
                  {step3Done ? 'Complété' : 'Étape 3'}
                </span>
              </div>
              <h3 className="font-extrabold text-zinc-900 text-sm mb-1">
                {caisseEnabled ? '3. Caisse & Facturation' : '3. Assistant IA & Automatisations'}
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed font-medium mb-4">
                {caisseEnabled
                  ? 'Gérez vos prestations, vos encaissements et vos bons cadeaux directement depuis votre espace.'
                  : 'Pilotez votre assistant IA, rédigez vos contenus et automatisez la création de vos articles.'}
              </p>
            </div>
            <Link
              href={caisseEnabled ? '/admin/caisse' : '/admin/agents'}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-extrabold shadow-[0_4px_14px_rgba(99,102,241,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all text-center w-full mt-auto"
            >
              <span>{caisseEnabled ? 'Accéder à la caisse & factures' : 'Consulter l’Assistant IA'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
