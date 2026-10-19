"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, AlertCircle, Image as ImageIcon, Check } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { addDaysToKey, todayKey } from '../../../utils/dateKey';
import {
  BRAND_PHOTOS,
  fetchMediaLibraryPhotos,
  pickBestLibraryPhoto,
  type MediaLibraryPhoto,
} from '../../../utils/socialCards';

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
 * Instagram/LinkedIn/Facebook/Google Business, et y associe obligatoirement
 * une image de la bibliothèque (`media_assets`).
 */
export default function NewSocialPostDialog({ initialDate, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [plannedDate, setPlannedDate] = useState(() => initialDate || addDaysToKey(todayKey(), 1));
  const [libraryPhotos, setLibraryPhotos] = useState<MediaLibraryPhoto[]>(BRAND_PHOTOS);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>(() => BRAND_PHOTOS[0].url);
  const [manualPhotoChoice, setManualPhotoChoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busyRef.current) onCloseRef.current(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    fetchMediaLibraryPhotos().then((photos) => {
      if (!active) return;
      setLibraryPhotos(photos);
      setSelectedPhotoUrl((prev) => prev || photos[0]?.url || BRAND_PHOTOS[0].url);
    });
    return () => { active = false; };
  }, []);

  // Sélection automatique de la photo de la bibliothèque la plus adaptée au sujet saisi
  useEffect(() => {
    if (manualPhotoChoice) return;
    const best = pickBestLibraryPhoto(`${title} ${brief}`, libraryPhotos);
    if (best) setSelectedPhotoUrl(best);
  }, [title, brief, libraryPhotos, manualPhotoChoice]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Indiquez le sujet du post.'); return; }
    if (!brief.trim()) { setError("Décrivez l'idée en quelques lignes : l'IA en a besoin pour écrire."); return; }

    const mandatoryPhoto = selectedPhotoUrl || pickBestLibraryPhoto(`${title} ${brief}`, libraryPhotos);
    if (!mandatoryPhoto) {
      setError('Veuillez choisir une image de la bibliothèque pour ce post.');
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/generate-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: title.trim(), intro: brief.trim(), preferredTheme: 'photo' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(
          data?.error === 'not_configured'
            ? "La rédaction automatique n'est pas activée sur ce site. Contactez la personne qui gère le site."
            : data?.error || `La rédaction a échoué (erreur ${res.status}). Réessayez dans un instant.`
        );
      }

      const finalCover = mandatoryPhoto || data.cover_image || BRAND_PHOTOS[0].url;
      const enrichedContent = {
        ...data,
        cover_image: finalCover,
        theme: data.theme || 'photo',
        visual_theme: data.theme || 'photo',
      };

      const { error: insertError } = await supabase.from('social_posts').insert({
        source_type: 'manual',
        source_ref: newSourceRef(),
        title: title.trim(),
        cover_image: finalCover,
        content: enrichedContent,
        planned_date: plannedDate,
        status: 'ready',
      });
      if (insertError) throw new Error(`Le texte a été écrit mais n'a pas pu être enregistré dans le calendrier. Réessayez. (Détail : ${insertError.message})`);

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
        className="bg-white w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
          <h3 id="new-social-post-title" className="text-[16px] font-semibold text-stone-950 flex items-center gap-2">
            <Sparkles size={16} className="text-stone-700" /> Nouveau post à partir d&apos;une idée
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fermer"
            className="p-1.5 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label htmlFor="new-post-title" className="block text-[14px] font-semibold text-stone-900">
              Sujet
            </label>
            <input
              id="new-post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              placeholder="ex : Trois gestes pour garder une peau souple en hiver"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-post-brief" className="block text-[14px] font-semibold text-stone-900">
              Ce que vous voulez dire
            </label>
            <textarea
              id="new-post-brief"
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={busy}
              placeholder="En quelques lignes : l'idée à faire passer, un exemple concret, ce que vos clientes doivent retenir."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 resize-none leading-relaxed disabled:opacity-60"
            />
            <p className="text-[13px] text-stone-600">Plus vous êtes précise, moins le texte aura besoin d&apos;être retouché.</p>
          </div>

          {/* Choix obligatoire de l'image de la bibliothèque */}
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-stone-900">
                <ImageIcon size={15} className="text-[#8A9A7B]" /> Image de votre bibliothèque (obligatoire)
              </span>
              {manualPhotoChoice && (
                <button
                  type="button"
                  onClick={() => setManualPhotoChoice(false)}
                  className="text-[12px] font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer"
                >
                  Sélection auto selon le sujet
                </button>
              )}
            </div>
            <p className="text-[12px] text-stone-600">
              Une photo de votre médiathèque est automatiquement associée à votre sujet. Cliquez sur une autre image ci-dessous si vous préférez :
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[165px] overflow-y-auto pr-1 pt-1">
              {libraryPhotos.map((photo) => {
                const isSelected = selectedPhotoUrl === photo.url;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSelectedPhotoUrl(photo.url);
                      setManualPhotoChoice(true);
                    }}
                    title={`${photo.label} (${photo.category})`}
                    className={`group relative aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-stone-950 ring-2 ring-stone-950'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-1">
                      <span className="block text-[9.5px] font-medium text-white truncate">
                        {photo.label}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="absolute top-1 right-1 inline-flex size-4 items-center justify-center rounded-full bg-stone-900 text-white shadow">
                        <Check size={10} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-post-date" className="block text-[14px] font-semibold text-stone-900">
              À publier le
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
            <p role="alert" className="flex items-start gap-1.5 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 h-10 rounded-lg bg-stone-100 text-stone-900 text-sm font-semibold hover:bg-stone-200 transition-colors disabled:opacity-45 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-45 cursor-pointer"
            >
              {busy ? <><Loader2 size={15} className="animate-spin" /> Rédaction…</> : <><Sparkles size={15} /> Rédiger le post avec cette image</>}
            </button>
          </div>
          {busy && <p role="status" className="text-[13px] text-stone-700 text-center">L&apos;IA écrit les versions Instagram, Stories, Facebook, Google et LinkedIn. Comptez une dizaine de secondes.</p>}
        </form>
      </div>
    </div>
  );
}
