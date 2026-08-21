"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { addDaysToKey, todayKey } from '../../../utils/dateKey';

interface Props {
  initialDate?: string;
  onClose: () => void;
  /** Appelé après création réussie, avec la date de planification retenue. */
  onCreated: (plannedDate: string) => void;
}

function newSourceRef(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `manual-${uuid}`;
}

/**
 * Création d'un post à partir d'une idée libre : l'IA génère le contenu
 * Instagram/LinkedIn/Facebook, puis il rejoint le calendrier comme n'importe
 * quel post issu d'un article ou d'un flux RSS.
 */
export default function NewSocialPostDialog({ initialDate, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [plannedDate, setPlannedDate] = useState(() => initialDate || addDaysToKey(todayKey(), 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Le titre est obligatoire.'); return; }
    if (!brief.trim()) { setError("Décrivez l'angle en quelques lignes — l'IA en a besoin pour écrire."); return; }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: title.trim(), intro: brief.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(
          data?.error === 'not_configured'
            ? "Clé API IA non configurée — ajoutez ANTHROPIC_API_KEY dans les variables d'environnement."
            : data?.error || `Génération impossible (HTTP ${res.status}).`
        );
      }

      const { error: insertError } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef(),
        title: title.trim(),
        cover_image: null,
        content: data,
        planned_date: plannedDate,
        status: 'ready',
      });
      if (insertError) throw new Error(insertError.message);

      onCreated(plannedDate);
    } catch (err: any) {
      setError(err?.message || 'Erreur inconnue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-social-post-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 id="new-social-post-title" className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Sparkles size={15} className="text-sage" /> Nouveau post depuis une idée
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="new-post-title" className="block text-[13px] font-medium text-stone-800">
              Titre / sujet
            </label>
            <input
              id="new-post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="Ex : Pourquoi il revient toujours au moment où vous allez mieux"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-post-brief" className="block text-[13px] font-medium text-stone-800">
              Angle / brief
            </label>
            <textarea
              id="new-post-brief"
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={busy}
              placeholder="En quelques lignes : l'idée à faire passer, l'exemple concret, ce que le lecteur doit comprendre à la fin."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 resize-none leading-relaxed disabled:opacity-60"
            />
            <p className="text-[12.5px] text-stone-500">Plus le brief est précis, moins le résultat aura besoin d'être retouché.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-post-date" className="block text-[13px] font-medium text-stone-800">
              Planifier le
            </label>
            <input
              id="new-post-date"
              type="date"
              value={plannedDate}
              onChange={(e) => e.target.value && setPlannedDate(e.target.value)}
              disabled={busy}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-px" /> {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busy ? <><Loader2 size={15} className="animate-spin" /> Génération…</> : <><Sparkles size={15} /> Générer le contenu</>}
            </button>
          </div>
          {busy && <p className="text-[12.5px] text-stone-500 text-center">L'IA écrit les 3 formats — comptez une dizaine de secondes.</p>}
        </form>
      </div>
    </div>
  );
}
