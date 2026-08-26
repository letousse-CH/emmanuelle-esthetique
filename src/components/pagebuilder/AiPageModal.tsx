"use client";

import React, { useState } from 'react';
import { X, Sparkles, Wand2, Edit3, CheckCircle2, AlertCircle, ArrowRight, Lightbulb, RefreshCw, Loader2 } from 'lucide-react';
import VoiceInputButton from './VoiceInputButton';

export type AiMode = 'generate' | 'modify';

interface AiPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
  onModify: (prompt: string) => Promise<void>;
  currentSectionsCount: number;
}

const GENERATE_SUGGESTIONS = [
  'Landing page haute conversion (Hero, Preuve sociale, Offre, Processus, Contact)',
  'Page de présentation de services et prestations avec tarifs et FAQ',
  'Page d’institut de beauté et soins bien-être avec visuels épurés',
  'Page d’événement ou atelier avec formulaire de réservation',
];

const MODIFY_SUGGESTIONS = [
  'Ajoute une section FAQ et une section Tarifs avec bouton de réservation',
  'Bascule les sections en alternance thématique clair / sombre',
  'Optimise les titres et descriptions pour la conversion marketing',
  'Reformule l’accroche du Hero et ajoute une liste d’atouts clés',
];

export default function AiPageModal({
  isOpen,
  onClose,
  onGenerate,
  onModify,
  currentSectionsCount,
}: AiPageModalProps) {
  const [mode, setMode] = useState<AiMode>(currentSectionsCount > 0 ? 'modify' : 'generate');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVoiceTranscript = (transcriptText: string) => {
    setPrompt(prev => (prev ? `${prev} ${transcriptText}` : transcriptText));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'generate') {
        await onGenerate(prompt);
      } else {
        await onModify(prompt);
      }
      onClose();
    } catch (err: unknown) {
      console.error('[AiPageModal] Action error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur s’est produite.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-fade-in select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Épuré Admin */}
        <div className="bg-stone-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300 shrink-0 font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-white uppercase">
                Assistant IA — Page Builder
              </h2>
              <p className="text-[11px] text-stone-300 font-light mt-0.5">
                Génération & modification assistée de la page
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sélecteur de mode épuré */}
        <div className="px-6 pt-5 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl gap-1 border border-stone-200">
            <button
              type="button"
              onClick={() => setMode('generate')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'generate'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <Wand2 size={14} />
              Générer la page
            </button>

            <button
              type="button"
              onClick={() => setMode('modify')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'modify'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <Edit3 size={14} />
              Modifier la page
            </button>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="bg-stone-50 border border-stone-200/90 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-2">
              {mode === 'generate' ? (
                <span>Description de la page à générer :</span>
              ) : (
                <span>Instructions de modification :</span>
              )}
            </label>

            <div className="flex items-start gap-2.5">
              <textarea
                rows={4}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={
                  mode === 'generate'
                    ? 'Ex: "Créer une landing page pour un cabinet avec section hero percutante, atouts, tarifs et FAQ…"'
                    : 'Ex: "Ajoute une section FAQ avec 4 questions et passe la première section en thème sombre…"'
                }
                className="flex-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-stone-900 text-stone-900 leading-relaxed placeholder:text-stone-400 transition-all"
              />

              <VoiceInputButton onTranscript={handleVoiceTranscript} />
            </div>
          </div>

          {/* Exemples rapides */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-stone-600 flex items-center gap-1.5">
              <Lightbulb size={13} className="text-amber-600" />
              Exemples d'instructions :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(mode === 'generate' ? GENERATE_SUGGESTIONS : MODIFY_SUGGESTIONS).map((sugg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(sugg)}
                  className="text-[11px] bg-stone-100 hover:bg-stone-900 hover:text-white text-stone-700 font-semibold px-3 py-1.5 rounded-xl border border-stone-200/80 transition-all text-left cursor-pointer"
                >
                  + {sugg}
                </button>
              ))}
            </div>
          </div>

          {mode === 'generate' && currentSectionsCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-semibold">
              <AlertCircle size={14} className="shrink-0 text-amber-600" />
              <span>Note : Générer une nouvelle page remplacera les {currentSectionsCount} section(s) existante(s).</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
              <AlertCircle size={14} className="shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="pt-2 flex items-center justify-end gap-2.5 shrink-0 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-xs font-extrabold transition-all disabled:opacity-40 shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Traitement en cours…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-300" />
                  <span>{mode === 'generate' ? 'Générer la page' : 'Appliquer les modifications'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
