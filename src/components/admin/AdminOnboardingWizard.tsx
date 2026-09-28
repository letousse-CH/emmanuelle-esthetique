"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, X, ArrowRight } from 'lucide-react';
import { useModuleFlags } from '../../hooks/useModuleFlags';

interface Props {
  hasBusinessInfo?: boolean;
  pageCount?: number;
  articleCount?: number;
  siteName?: string;
}

/**
 * Guide de démarrage en trois étapes. Il disparaît de lui-même une fois les
 * trois étapes faites ; masqué à la main, il laisse un simple lien pour revenir.
 */
export default function AdminOnboardingWizard({
  hasBusinessInfo = false,
  pageCount = 0,
  articleCount = 0,
  siteName = '',
}: Props) {
  const moduleFlags = useModuleFlags();
  const caisseEnabled = moduleFlags.caisse;

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem('studio_onboarding_dismissed') === 'true');
    } catch { /* stockage indisponible */ }
  }, []);

  const handleDismiss = () => {
    try { localStorage.setItem('studio_onboarding_dismissed', 'true'); } catch {}
    setDismissed(true);
  };

  const handleRestore = () => {
    try { localStorage.removeItem('studio_onboarding_dismissed'); } catch {}
    setDismissed(false);
  };

  const steps = [
    {
      done: hasBusinessInfo || Boolean(siteName && siteName !== 'Studio Admin'),
      title: 'Coordonnées',
      text: 'Nom, téléphone, e-mail et logo, repris sur le site et les quittances.',
      href: '/admin/settings?tab=business',
      cta: 'Renseigner',
    },
    {
      done: pageCount > 0,
      title: 'Pages du site',
      text: 'Composez vos pages, ou laissez l’assistant en proposer une structure.',
      href: '/admin/pages',
      cta: 'Ouvrir les pages',
    },
    caisseEnabled
      ? {
          done: articleCount > 0,
          title: 'Caisse',
          text: 'Prestations, encaissements et bons cadeaux au même endroit.',
          href: '/admin/caisse',
          cta: 'Ouvrir la caisse',
        }
      : {
          done: articleCount > 0,
          title: 'Premier article',
          text: 'Rédigez un article, seul ou avec l’assistant.',
          href: '/admin/blog/new',
          cta: 'Rédiger',
        },
  ];

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  if (dismissed) {
    return (
      <button
        onClick={handleRestore}
        className="text-[13px] text-stone-600 hover:text-accent underline-offset-4 hover:underline cursor-pointer"
      >
        Afficher le guide de démarrage ({completed}/{steps.length})
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white">
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="text-[18px] font-semibold text-stone-950">Pour bien démarrer</h2>
          <p className="mt-1 text-[14px] text-stone-600">
            {completed} étape{completed > 1 ? 's' : ''} sur {steps.length} terminée{completed > 1 ? 's' : ''}.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-2 -m-2 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          aria-label="Masquer le guide"
          title="Masquer le guide"
        >
          <X size={18} />
        </button>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-px bg-stone-100 mt-6 border-t border-stone-200 rounded-b-xl overflow-hidden">
        {steps.map((step, i) => (
          <li key={step.title} className="bg-white p-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium ${
                  step.done ? 'bg-accent text-accent-fg' : 'border-2 border-stone-300 text-stone-800 font-semibold'
                }`}
              >
                {step.done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <h3 className={`text-[16px] ${step.done ? 'font-medium text-stone-500 line-through decoration-stone-400' : 'font-semibold text-stone-950'}`}>
                {step.title}
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed text-stone-700">{step.text}</p>
            {!step.done && (
              <Link
                href={step.href}
                className="mt-auto inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline underline-offset-4"
              >
                {step.cta} <ArrowRight size={15} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
