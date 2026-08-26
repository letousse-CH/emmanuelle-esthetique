"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Wand2, X, Loader2, Check, Sparkles } from 'lucide-react';
import type { PageSection } from './wireframes.config';
import { SECTION_LABELS } from './sectionPreviews';
import VoiceInputButton from './VoiceInputButton';
import { supabase } from '../../services/supabase';
import FloatingPanel from './FloatingPanel';

interface Props {
  section: PageSection;
  sectionIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (newData: Record<string, unknown>) => void;
}

const PRESETS = [
  { id: 'hook', title: 'Accroche commerciale', prompt: 'Reformule les titres et descriptions pour créer une accroche claire, moderne et convaincante' },
  { id: 'short', title: 'Synthétique & court', prompt: 'Raccourcis le texte pour aller droit à l\'essentiel avec des phrases concises' },
  { id: 'luxury', title: 'Ton haut de gamme', prompt: 'Adopte un vocabulaire sobre, élégant et prestigieux' },
  { id: 'warm', title: 'Ton chaleureux', prompt: 'Rédige avec un ton accueillant, humain et rassurant' },
];

export default function SectionAiMiniModal({
  section,
  sectionIndex,
  isOpen,
  onClose,
  onApplyData,
}: Props) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const sectionLabel = SECTION_LABELS[section.type] ?? section.type;

  const handleGenerate = async (instructionToUse?: string) => {
    const finalInstruction = instructionToUse || customPrompt;
    if (!finalInstruction.trim()) return;

    setLoading(true);
    setSuccess(false);
    setErrorMsg('');

    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/modify-page-with-ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: `Pour la section de type "${section.type}", applique cette modification au texte : "${finalInstruction}". Conserve strictement le format JSON et les clefs existantes.`,
          sections: [section],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération IA.');

      if (data.sections && data.sections[0]?.data) {
        onApplyData(data.sections[0].data);
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1000);
      } else {
        throw new Error('Le format de la section générée est invalide.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceTranscript = (transcriptText: string) => {
    setCustomPrompt((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
  };

  const modalContent = (
    <FloatingPanel
      storageKey="studio.sectionAiMiniModal.box"
      ariaLabel={`Assistant IA : ${sectionLabel}`}
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white text-zinc-900 border-b border-zinc-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white text-[10.5px] font-extrabold uppercase tracking-wider shadow-[0_2px_10px_rgba(168,85,247,0.25)]">
                Modification IA
              </span>
              <span className="text-[11px] font-mono font-extrabold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-200 truncate">
                {section.type}
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-sm font-extrabold text-zinc-900 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-600" />
              Assistant IA — {sectionLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0"
            title="Fermer"
          >
            <X size={15} />
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between px-5 py-2 text-[11px] font-medium text-zinc-500 bg-zinc-50 border-t border-zinc-200">
          <span>Déplacez par l'en-tête, redimensionnez en bas à droite.</span>
        </div>
      }
    >
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            Amélioration rapide en 1 clic :
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => handleGenerate(preset.prompt)}
                className="p-2.5 text-left text-xs font-bold text-stone-800 bg-stone-50 hover:bg-stone-900 hover:text-white border border-stone-300/80 rounded-md transition-all cursor-pointer disabled:opacity-50"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Instruction personnalisée ou Dictée Vocale */}
        <div className="space-y-2 pt-3 border-t border-stone-200">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
              Instruction spécifique :
            </label>
            <VoiceInputButton onTranscript={handleVoiceTranscript} />
          </div>
          <textarea
            rows={3}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ex: Rends ce texte plus dynamique et ajoute une mention sur les prix..."
            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-purple-600 resize-none font-sans"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || !customPrompt.trim()}
            onClick={() => handleGenerate()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 font-extrabold rounded-full text-white text-xs shadow-[0_4px_14px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin text-white" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Wand2 size={13} className="text-white" />
                <span>Appliquer par IA</span>
              </>
            )}
          </button>
        </div>

        {success && (
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">
            <Check size={13} className="text-emerald-600" />
            <span>Section modifiée avec succès !</span>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-red-500 font-medium text-center bg-red-50 p-2 rounded-xl border border-red-100">
            {errorMsg}
          </p>
        )}
      </div>
    </FloatingPanel>
  );

  if (typeof window !== 'undefined') {
    const portalTarget = window.top?.document?.body || document.body;
    return createPortal(modalContent, portalTarget);
  }

  return modalContent;
}
