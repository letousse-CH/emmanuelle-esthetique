'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Loader2,
  FileText,
  Check,
  Globe,
  Layout,
  Wand2
} from 'lucide-react';

interface AutoGenerateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface ProposedPage {
  id: string;
  title: string;
  slug: string;
  description: string;
  recommendedSections: string[];
  selected: boolean;
}

export default function AutoGenerateSiteModal({
  isOpen,
  onClose,
  onComplete,
}: AutoGenerateSiteModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<'checking' | 'missing_editorial' | 'proposal' | 'generating' | 'done'>('checking');
  const [siteName, setSiteName] = useState('');
  const [pages, setPages] = useState<ProposedPage[]>([]);
  const [generationIndex, setGenerationIndex] = useState(0);
  const [generatingTitle, setGeneratingTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check editorial status and fetch proposed sitemap
  useEffect(() => {
    if (!isOpen) return;

    const checkAndPropose = async () => {
      setStage('checking');
      setErrorMsg(null);

      try {
        const res = await fetch('/api/admin/generate-site-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_and_propose' }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors du contrôle.');

        if (!data.hasEditorial) {
          setStage('missing_editorial');
        } else {
          setSiteName(data.siteName || 'Votre Site');
          const mapped: ProposedPage[] = (data.proposedPages || []).map((p: any, idx: number) => ({
            id: `page-${idx}-${Date.now()}`,
            title: p.title || 'Nouvelle Page',
            slug: p.slug || 'page',
            description: p.description || '',
            recommendedSections: p.recommendedSections || ['hero_1', 'features_1', 'cta_1'],
            selected: true,
          }));
          setPages(mapped);
          setStage('proposal');
        }
      } catch (err: any) {
        console.error('Erreur auto-site :', err);
        setErrorMsg(err.message || 'Erreur lors de la préparation du site.');
        setStage('proposal');
      }
    };

    checkAndPropose();
  }, [isOpen]);

  const togglePageSelect = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = pages.every((p) => p.selected);
    setPages((prev) => prev.map((p) => ({ ...p, selected: !allSelected })));
  };

  // Launch batch page generation
  const handleStartGeneration = async () => {
    const selectedPages = pages.filter((p) => p.selected);
    if (selectedPages.length === 0) return;

    setStage('generating');
    setGenerationIndex(0);
    setErrorMsg(null);

    const generatedPagesList: Array<{ title: string; slug: string }> = [];

    for (let i = 0; i < selectedPages.length; i += 1) {
      const pageToGen = selectedPages[i];
      setGenerationIndex(i + 1);
      setGeneratingTitle(pageToGen.title);

      try {
        const res = await fetch('/api/admin/generate-site-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_single_page',
            pageSpec: {
              title: pageToGen.title,
              slug: pageToGen.slug,
              description: pageToGen.description,
              recommendedSections: pageToGen.recommendedSections,
            },
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          generatedPagesList.push({
            title: data.title || pageToGen.title,
            slug: data.slug || pageToGen.slug,
          });
        }
      } catch (err: any) {
        console.error(`Échec sur la page ${pageToGen.title} :`, err);
      }
    }

    // Automatically generate and update navigation menu setting
    if (generatedPagesList.length > 0) {
      try {
        await fetch('/api/admin/generate-site-structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_navigation_menu',
            generatedPages: generatedPagesList,
          }),
        });
      } catch (err) {
        console.error('Erreur mise à jour menu :', err);
      }
    }

    setStage('done');
  };

  if (!isOpen) return null;

  const selectedCount = pages.filter((p) => p.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-fadein">
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
              <Wand2 size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                Création Automatique du Site
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal border border-amber-500/30">
                  IA Éditoriale
                </span>
              </h3>
              <p className="text-stone-400 text-xs">
                Génération des pages sur-mesure basées sur votre ligne éditoriale
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STAGE 1: CHECKING */}
          {stage === 'checking' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={36} className="text-amber-600 animate-spin" />
              <p className="text-sm font-medium text-stone-700 text-center">
                Analyse de votre ligne éditoriale et conception du sitemap par Claude…
              </p>
            </div>
          )}

          {/* STAGE 2: MISSING EDITORIAL */}
          {stage === 'missing_editorial' && (
            <div className="space-y-6 py-4">
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <BookOpen size={20} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-base text-amber-950">
                    Ligne éditoriale non renseignée !
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Pour générer automatiquement un site web 100% sur-mesure et pertinent, Claude a besoin de connaître votre métier, vos prestations, votre persona cible et votre ton de voix.
                  </p>
                  <p className="text-xs font-medium text-amber-900">
                    Vous pouvez remplir ces informations en 2 minutes grâce à l'interview vocale dans les paramètres.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/admin/settings');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <BookOpen size={16} />
                  Compléter la ligne éditoriale (Paramètres)
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: PROPOSAL */}
          {stage === 'proposal' && (
            <div className="space-y-5">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <Globe size={16} className="text-amber-600" />
                    Arborescence proposée pour « {siteName} »
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Claude a analysé votre ligne éditoriale et recommande les pages suivantes :
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                >
                  {pages.every((p) => p.selected) ? 'Décocher tout' : 'Cocher tout'}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              {/* Pages Cards List */}
              <div className="space-y-3">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => togglePageSelect(p.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      p.selected
                        ? 'bg-amber-50/40 border-amber-300 shadow-sm'
                        : 'bg-white border-stone-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                        p.selected
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'border-stone-300 bg-white'
                      }`}
                    >
                      {p.selected && <Check size={12} strokeWidth={3} />}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-semibold text-sm text-stone-900 flex items-center gap-2">
                          {p.title}
                          <span className="font-mono text-[11px] text-stone-400 font-normal">
                            /{p.slug}
                          </span>
                        </h5>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">
                          {p.recommendedSections.length} sections recommandées
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 4: GENERATING */}
          {stage === 'generating' && (
            <div className="py-12 space-y-6 text-center">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin" />
                <Sparkles size={28} className="text-amber-600" />
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-semibold text-stone-900">
                  Génération des pages en cours par Claude…
                </h4>
                <p className="text-xs text-stone-600 font-medium">
                  Page {generationIndex} sur {selectedCount} : « {generatingTitle} »
                </p>
              </div>

              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden max-w-md mx-auto">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                  style={{ width: `${(generationIndex / selectedCount) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STAGE 5: DONE */}
          {stage === 'done' && (
            <div className="py-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-green-100 text-green-600 mx-auto flex items-center justify-center shadow-sm">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-lg font-semibold text-stone-900">
                  Félicitations ! Votre site est illustré, publié & configuré.
                </h4>
                <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                  Toutes les pages sur-mesure ont été créées, illustrées avec des visuels HD ciblés, publiées automatiquement et votre menu de navigation a été généré.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          {stage === 'proposal' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-200/60 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={handleStartGeneration}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-semibold shadow-lg disabled:opacity-50 transition-all cursor-pointer"
              >
                <Sparkles size={16} />
                Générer les {selectedCount} pages sélectionnées
              </button>
            </>
          )}

          {stage === 'done' && (
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Voir les pages dynamiques
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
