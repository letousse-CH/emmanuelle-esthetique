import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { X, Upload, Image as ImageIcon, Copy, Check, Loader2 } from 'lucide-react';
import AddMediaByUrl from './AddMediaByUrl';

interface MediaLibraryProps {
  onClose: () => void;
  onSelect: (url: string, altText: string) => void;
}

interface MediaAsset {
  id: string;
  file_name: string;
  url: string;
  alt_text: string;
  created_at: string;
}

async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 150_000) return file;
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob && blob.size < file.size) {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }));
        } else {
          resolve(file);
        }
      }, 'image/webp', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function MediaLibrary({ onClose, onSelect }: MediaLibraryProps) {
  const [medias, setMedias] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const copyUrl = async (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setMessage({ type: 'error', text: "L'adresse n'a pas pu être copiée. Sélectionnez-la à la main sous l'image." });
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchMedias();
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMedias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setMedias(data);
    } else if (error) {
      setMessage({ type: 'error', text: "Les images n'ont pas pu être chargées. Fermez puis rouvrez la médiathèque." });
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const input = e.target;
    setUploading(true);
    setMessage(null);

    const raw = input.files![0];

    try {
      const file = await compressImage(raw);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileBase64: base64 }),
      });

      if (!res.ok) throw new Error(await res.text());
      const { url, key } = await res.json();

      const { error: dbError } = await supabase
        .from('media_assets')
        .insert([{ file_name: key, url, alt_text: raw.name.split('.')[0] }]);

      if (dbError) throw new Error(dbError.message);
      await fetchMedias();
      setMessage({ type: 'success', text: "Image ajoutée. Cliquez dessus pour l'insérer." });
    } catch (err: any) {
      setMessage({ type: 'error', text: `L'image n'a pas pu être envoyée${err?.message ? ` (${err.message})` : ''}. Réessayez, ou collez l'adresse d'une image déjà en ligne.` });
    } finally {
      setUploading(false);
      // Permet de renvoyer le même fichier après un échec.
      input.value = '';
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-stone-900/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-library-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl rounded-xl overflow-hidden outline-none"
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-stone-200 bg-white">
          <h2 id="media-library-title" className="text-[18px] font-semibold tracking-tight text-stone-950 flex items-center">
            <ImageIcon className="mr-2.5 text-stone-600" size={20} /> Médiathèque
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer la médiathèque" className="p-2 -mr-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-stone-200 bg-white flex flex-wrap gap-3 justify-between items-center">
          <p className="text-[14px] text-stone-700">Cliquez sur une image pour l'insérer.</p>
          <label className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent text-accent-fg text-[14px] font-semibold hover:bg-accent-hover transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-accent/40 focus-within:ring-offset-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Envoi en cours…' : 'Ajouter une image'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {message && (
            <p role="status" className={`w-full text-[13px] font-medium ${message.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
              {message.text}
            </p>
          )}
        </div>

        {/* Ajout par URL — utilisable même sans stockage configuré */}
        <AddMediaByUrl
          className="px-6 py-3 border-b border-stone-200 bg-white shrink-0"
          onAdded={(asset) => setMedias((prev) => [asset, ...prev])}
        />

        <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
          {loading ? (
            <div className="text-center py-12 text-[14px] text-stone-600">Chargement des images…</div>
          ) : medias.length === 0 ? (
            <div className="text-center py-12 text-[14px] text-stone-600">Aucune image pour l'instant. Ajoutez-en une avec le bouton « Ajouter une image » ou collez l'adresse d'une image déjà en ligne.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {medias.map((asset) => (
                <div key={asset.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Insérer l'image ${asset.alt_text || 'sans titre'}`}
                    className="group relative aspect-square bg-stone-200 overflow-hidden rounded-lg cursor-pointer border-2 border-transparent hover:border-accent focus-visible:border-accent focus-visible:outline-none transition-colors"
                    onClick={() => onSelect(asset.url, asset.alt_text)}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt_text}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/20 transition-colors" />

                    <div className="absolute bottom-0 w-full p-2 bg-stone-900/70 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-white text-[13px] truncate text-left">
                      {asset.alt_text}
                    </div>
                  </button>

                  {/* URL copiable sous la vignette */}
                  <div className="flex items-center gap-1 bg-stone-100 rounded-lg px-2 py-1 min-w-0">
                    <span className="text-stone-600 text-[12px] truncate flex-1 font-mono" title={asset.url}>
                      {asset.url.replace(/^https?:\/\/[^/]+/, '…')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => copyUrl(e, asset)}
                      title="Copier l'adresse de l'image"
                      aria-label={copiedId === asset.id ? 'Adresse copiée' : "Copier l'adresse de l'image"}
                      className="shrink-0 p-1 rounded text-stone-600 hover:text-accent transition-colors cursor-pointer"
                    >
                      {copiedId === asset.id
                        ? <Check size={14} className="text-emerald-700" />
                        : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
