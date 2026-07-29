import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { X, Upload, Trash2, Image as ImageIcon, Copy, Check } from 'lucide-react';

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
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const copyUrl = async (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(asset.url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
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
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);

    const raw = e.target.files[0];

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

      if (!dbError) await fetchMedias();
    } catch (err: any) {
      alert("Erreur lors de l'upload : " + err.message);
    }

    setUploading(false);
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
        className="bg-white w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden outline-none"
      >
        <div className="flex justify-between items-center p-6 border-b border-stone-200 bg-stone-50">
          <h2 id="media-library-title" className="text-lg uppercase tracking-widest font-bold text-stone-900 flex items-center">
            <ImageIcon className="mr-3" size={20} /> Médiathèque
          </h2>
          <button onClick={onClose} aria-label="Fermer la médiathèque" className="text-stone-500 hover:text-stone-900 transition-colors cursor-pointer">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b border-stone-100 bg-white flex justify-between items-center">
          <p className="text-sm text-stone-500 italic">Cliquez pour insérer · <Copy size={12} className="inline mb-0.5" /> pour copier l'URL.</p>
          <label className={`cursor-pointer bg-stone-900 text-white px-6 py-2 uppercase tracking-widest text-xs hover:bg-sage transition-colors flex items-center ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={14} className="mr-2" />
            {uploading ? 'Envoi...' : 'Uploader une image'}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleUpload} 
              disabled={uploading}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
          {loading ? (
            <div className="text-center py-12 text-stone-400 italic">Chargement de la médiathèque...</div>
          ) : medias.length === 0 ? (
            <div className="text-center py-12 text-stone-400 italic">Aucune image. Commencez par en uploader une !</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {medias.map((asset) => (
                <div key={asset.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Insérer l'image ${asset.alt_text || 'sans titre'}`}
                    className="group relative aspect-square bg-stone-200 overflow-hidden cursor-pointer border-2 border-transparent hover:border-sage transition-all"
                    onClick={() => onSelect(asset.url, asset.alt_text)}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt_text}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-all" />

                    {/* Bouton copier URL */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => copyUrl(e, asset)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyUrl(e as unknown as React.MouseEvent, asset); } }}
                      title="Copier l'URL"
                      aria-label={copiedId === asset.id ? 'URL copiée' : "Copier l'URL de l'image"}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white text-stone-700 rounded-full p-1.5 opacity-0 group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-all shadow cursor-pointer"
                    >
                      {copiedId === asset.id
                        ? <Check size={13} className="text-green-600" />
                        : <Copy size={13} />}
                    </span>

                    <div className="absolute bottom-0 w-full p-2 bg-gradient-to-t from-stone-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs truncate">
                      {asset.alt_text}
                    </div>
                  </button>

                  {/* URL copiable sous la vignette */}
                  <div className="flex items-center gap-1 bg-stone-100 rounded px-2 py-1 min-w-0">
                    <span className="text-stone-400 text-[10px] truncate flex-1 font-mono leading-none" title={asset.url}>
                      {asset.url.replace(/^https?:\/\/[^/]+/, '…')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => copyUrl(e, asset)}
                      title="Copier l'URL complète"
                      aria-label="Copier l'URL complète de l'image"
                      className="shrink-0 text-stone-400 hover:text-sage transition-colors cursor-pointer"
                    >
                      {copiedId === asset.id
                        ? <Check size={11} className="text-green-500" />
                        : <Copy size={11} />}
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
