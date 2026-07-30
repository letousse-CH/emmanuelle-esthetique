"use client";

import React, { useState } from 'react';
import { Link2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export interface AddedMediaAsset {
  id: string;
  file_name: string;
  url: string;
  alt_text: string;
  created_at: string;
}

interface AddMediaByUrlProps {
  /** Appelé avec la ligne insérée, pour rafraîchir la liste appelante. */
  onAdded: (asset: AddedMediaAsset) => void;
  /** Variante compacte (barre d'un modal) ou encadré autonome (page admin). */
  variant?: 'bar' | 'card';
  className?: string;
}

/**
 * Ajout d'une image **par URL** dans la bibliothèque médias.
 *
 * C'est le seul chemin d'ajout disponible tant que le stockage (R2) n'est pas
 * configuré : `/api/upload-media` répond alors 501. Ce composant est partagé
 * par les trois écrans médias (page /admin/medias, bibliothèque, sélecteur du
 * page builder) pour que le comportement soit identique partout.
 */
export default function AddMediaByUrl({ onAdded, variant = 'bar', className = '' }: AddMediaByUrlProps) {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const raw = urlInput.trim();
    if (!raw) return;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      setError("URL invalide — elle doit commencer par https://");
      return;
    }
    if (parsed.protocol !== 'https:') {
      setError("Seules les URLs en https:// sont acceptées.");
      return;
    }

    setError('');
    setIsAdding(true);
    try {
      const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'image');
      const { data, error: dbError } = await supabase
        .from('media_assets')
        .insert([{
          file_name: fileName,
          url: raw,
          alt_text: fileName.replace(/\.[a-z0-9]+$/i, ''),
        }])
        .select('*');

      if (dbError) throw new Error(dbError.message);
      if (!data?.length) {
        // Insertion acceptée mais rien retourné : typiquement une policy RLS
        // de lecture manquante. Message explicite plutôt qu'un échec muet.
        throw new Error("Image enregistrée mais illisible — vérifiez les policies RLS de la table media_assets.");
      }

      onAdded(data[0]);
      setUrlInput('');
    } catch (err: any) {
      console.error('[AddMediaByUrl]', err);
      setError(err?.message || "Impossible d'ajouter cette image.");
    } finally {
      setIsAdding(false);
    }
  };

  const isCard = variant === 'card';

  return (
    <div className={className}>
      <div className={isCard ? 'bg-white border border-stone-200 rounded-xl p-4' : ''}>
        {isCard && (
          <p className="text-sm font-bold text-stone-900 mb-1">Ajouter une image par URL</p>
        )}
        {isCard && (
          <p className="text-xs text-stone-500 mb-3 leading-relaxed">
            Collez l&apos;adresse d&apos;une image déjà en ligne. Pratique tant que
            le stockage de fichiers n&apos;est pas configuré.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-stone-400 shrink-0" />
          <input
            type="url"
            inputMode="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="…ou collez l'URL d'une image déjà en ligne (https://…)"
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:border-sage focus:ring-1 focus:ring-sage outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!urlInput.trim() || isAdding}
            className="shrink-0 inline-flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-sage transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ajouter
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2 ml-6">{error}</p>}
      </div>
    </div>
  );
}
