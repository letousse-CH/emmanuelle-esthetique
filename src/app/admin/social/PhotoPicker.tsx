"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ImageOff } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Button, Input } from '../../../components/admin/ui';

export interface LibraryPhoto {
  url: string;
  label: string;
  file: string;
}

let libraryCache: Promise<LibraryPhoto[]> | null = null;

/** Photos de la médiathèque (`media_assets`), les plus récentes d'abord. */
export function loadLibrary(): Promise<LibraryPhoto[]> {
  if (libraryCache) return libraryCache;
  libraryCache = Promise.resolve(
    supabase.from('media_assets').select('url, file_name, alt_text').order('created_at', { ascending: false }).limit(300),
  ).then(({ data, error }) => {
    if (error) {
      libraryCache = null;
      return [];
    }
    const seen = new Set<string>();
    return ((data ?? []) as { url: string; file_name: string | null; alt_text: string | null }[])
      .filter((r) => r.url && /^https:/.test(r.url) && !/\.(pdf|mp4|webm|mov|svg)$/i.test(r.url) && !seen.has(r.url) && seen.add(r.url))
      .map((r) => ({
        url: r.url,
        file: (r.file_name || '').toLowerCase(),
        label: (r.alt_text || r.file_name || '').replace(/^\d{10,}-/, '').replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim(),
      }));
  });
  return libraryCache;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Première photo dont le nom ou le texte alternatif contient un des mots donnés. */
export function suggestPhoto(photos: LibraryPhoto[], words: string[]): string | null {
  const keys = words.map(norm).filter(Boolean);
  const hit = photos.find((p) => keys.some((k) => norm(`${p.file} ${p.label}`).includes(k)));
  return (hit || photos[0])?.url ?? null;
}

export default function PhotoPicker({ current, onPick, onClose }: { current: string | null; onPick: (url: string | null) => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => { loadLibrary().then(setPhotos); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return (photos ?? []).filter((p) => !q || norm(`${p.file} ${p.label}`).includes(q));
  }, [photos, query]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une photo"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl bg-white sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
          <Search size={16} className="text-stone-500" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher : visage, massage, cabine…" className="flex-1 border-0 focus:ring-0" />
          <Button size="sm" variant="ghost" icon={X} onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="overflow-y-auto p-4">
          {!photos && <p className="py-10 text-center text-[14px] text-stone-600">Chargement de la médiathèque…</p>}
          {photos && shown.length === 0 && <p className="py-10 text-center text-[14px] text-stone-600">Aucune photo ne correspond.</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => onPick(null)}
              className={`grid aspect-square place-items-center bg-stone-50 text-[12.5px] text-stone-600 cursor-pointer ${current === null ? 'ring-2 ring-accent ring-offset-2' : ''}`}
            >
              <span className="flex flex-col items-center gap-1"><ImageOff size={18} /> Sans photo</span>
            </button>
            {shown.map((p) => (
              <button
                key={p.url}
                type="button"
                onClick={() => onPick(p.url)}
                title={p.label}
                className={`relative aspect-square overflow-hidden bg-stone-100 cursor-pointer ${current === p.url ? 'ring-2 ring-accent ring-offset-2' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.label} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
