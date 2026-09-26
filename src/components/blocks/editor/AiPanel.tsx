"use client";

import { useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import VoiceInputButton from '../../pagebuilder/VoiceInputButton';

const PAGE_IDEAS = [
  'Rends les textes plus chaleureux et plus concrets, sans changer les prix.',
  'Ajoute une section de questions fréquentes adaptée à ce soin.',
  'Raccourcis la page : garde l\'essentiel et un seul appel à réserver à la fin.',
];
const SECTION_IDEAS = [
  'Réécris ce texte de façon plus simple et plus chaleureuse.',
  'Transforme cette section en deux colonnes avec une photo.',
  'Ajoute un bouton pour prendre rendez-vous.',
];

export default function AiPanel({ scope, onClose, onRun }: { scope: 'page' | 'section'; onClose: () => void; onRun: (instruction: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onRun(text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900"><Sparkles size={16} className="text-violet-600" /> {scope === 'page' ? 'Assistant IA — toute la page' : 'Assistant IA — cette section'}</p>
          <button type="button" aria-label="Fermer" onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>
        <div className="space-y-3 p-5">
          <div className="relative">
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
              placeholder="Dites ou écrivez ce que vous voulez changer…"
              className="w-full resize-none rounded-xl border border-stone-200 p-3 pr-11 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
            <div className="absolute right-2 top-2"><VoiceInputButton onTranscript={(t) => setText((v) => (v ? `${v} ${t}` : t))} /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(scope === 'page' ? PAGE_IDEAS : SECTION_IDEAS).map((idea) => (
              <button key={idea} type="button" onClick={() => setText(idea)} className="rounded-full border border-stone-200 px-2.5 py-1 text-[11px] text-stone-600 hover:border-violet-300 hover:bg-violet-50">{idea}</button>
            ))}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <p className="text-[11px] text-stone-500">Le résultat remplace le contenu actuel. Vous pourrez l&apos;annuler (Cmd/Ctrl + Z).</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Annuler</button>
          <button type="button" onClick={run} disabled={busy || !text.trim()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Rédaction…</> : <><Sparkles size={15} /> Appliquer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
