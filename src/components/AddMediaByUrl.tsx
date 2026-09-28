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
      setError("Cette adresse n'est pas reconnue. Copiez l'adresse complète de l'image, qui commence par https://");
      return;
    }
    if (parsed.protocol !== 'https:') {
      setError("L'adresse doit commencer par https:// (adresse sécurisée). Copiez-la à nouveau depuis le site où se trouve l'image.");
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
        throw new Error("L'image a été enregistrée mais ne peut pas être affichée ici (droits de lecture de la médiathèque). Rechargez la page ; si elle n'apparaît toujours pas, contactez la personne qui gère le site.");
      }

      onAdded(data[0]);
      setUrlInput('');
    } catch (err: any) {
      console.error('[AddMediaByUrl]', err);
      setError(err?.message ? `L'image n'a pas pu être ajoutée : ${err.message}` : "L'image n'a pas pu être ajoutée. Réessayez dans un instant.");
    } finally {
      setIsAdding(false);
    }
  };

  const isCard = variant === 'card';

  return (
    <div className={className}>
      <div className={isCard ? 'bg-white border border-stone-200 rounded-xl p-4' : ''}>
        {isCard && (
          <p className="text-sm font-semibold text-stone-900 mb-1">Ajouter une image par URL</p>
        )}
        {isCard && (
          <p className="text-[13px] text-stone-600 mb-3 leading-relaxed">
            Collez l&apos;adresse d&apos;une image déjà en ligne. Pratique tant que
            le stockage de fichiers n&apos;est pas configuré.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-stone-500 shrink-0" />
          <input
            type="url"
            inputMode="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            aria-label="Adresse d'une image déjà en ligne"
            aria-invalid={error ? true : undefined}
            placeholder="…ou collez l'adresse d'une image déjà en ligne (https://…)"
            className="flex-1 min-w-0 h-10 px-3 text-[14px] text-stone-900 placeholder:text-stone-500 border border-stone-300 rounded-lg focus:border-accent focus:ring-3 focus:ring-accent/15 outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!urlInput.trim() || isAdding}
            className="shrink-0 inline-flex items-center gap-1.5 h-10 bg-stone-100 text-stone-900 px-4 rounded-lg text-[14px] font-semibold hover:bg-stone-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-45 disabled:pointer-events-none"
          >
            {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ajouter
          </button>
        </div>
        {error && <p role="alert" className="text-[13px] text-red-700 mt-2 ml-6">{error}</p>}
      </div>
    </div>
  );
}
