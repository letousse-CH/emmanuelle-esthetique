"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { Upload, Trash2, Copy, CheckCircle, Zap, Image as ImageIcon } from 'lucide-react';
import AddMediaByUrl from '../../../components/AddMediaByUrl';

interface MediaAsset {
  id: string;
  file_name: string;
  url: string;
  alt_text: string;
  created_at: string;
}

type UploadStage = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';

interface UploadState {
  stage: UploadStage;
  originalKB?: number;
  compressedKB?: number;
  savings?: number;
  error?: string;
}

interface BatchState {
  total: number;
  done: number;
  failed: number;
  current: string;
}

// ─── Compression Canvas ───────────────────────────────────────────────────────
async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.82
): Promise<{ file: File; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // Pas de compression pour SVG, GIF, ou petits fichiers < 150 Ko
  if (
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    originalSize < 150_000
  ) {
    return { file, originalSize, compressedSize: originalSize };
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Tout → WebP (gère la transparence, meilleure compression que JPEG/PNG)
      const outputType = 'image/webp';
      const outputQuality = quality;
      const newName = file.name.replace(/\.[^.]+$/, '.webp');

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < originalSize) {
            resolve({
              file: new File([blob], newName, { type: outputType, lastModified: Date.now() }),
              originalSize,
              compressedSize: blob.size,
            });
          } else {
            // WebP non supporté ou compression sans gain → on garde l'original
            resolve({ file, originalSize, compressedSize: originalSize });
          }
        },
        outputType,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file, originalSize, compressedSize: originalSize });
    };

    img.src = objectUrl;
  });
}

function formatKB(bytes: number) {
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / 1_048_576).toFixed(1)} Mo`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MediaManager() {
  const [medias, setMedias]     = useState<MediaAsset[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [upload, setUpload]     = useState<UploadState>({ stage: 'idle' });
  const [batch, setBatch]       = useState<BatchState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchMedias(); }, []);

  const fetchMedias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && !error) setMedias(data);
    setLoading(false);
  };

  const uploadSingleFile = async (rawFile: File): Promise<boolean> => {
    let compressedFile = rawFile;
    let originalSize   = rawFile.size;
    let compressedSize = rawFile.size;

    try {
      const result = await compressImage(rawFile);
      compressedFile = result.file;
      originalSize   = result.originalSize;
      compressedSize = result.compressedSize;
    } catch { /* fallback to original */ }

    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const uploadRes = await fetch('/api/upload-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: compressedFile.name, contentType: compressedFile.type, fileBase64 }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) return false;

    const { error: dbError } = await supabase
      .from('media_assets')
      .insert([{ file_name: compressedFile.name, url: uploadData.url, alt_text: rawFile.name.split('.')[0] }]);

    return !dbError;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];
    if (inputRef.current) inputRef.current.value = '';

    // Lot de plusieurs fichiers
    if (files.length > 1) {
      setBatch({ total: files.length, done: 0, failed: 0, current: files[0].name });
      let done = 0, failed = 0;
      for (const file of files) {
        setBatch(b => b ? { ...b, current: file.name } : null);
        const ok = await uploadSingleFile(file);
        if (ok) done++; else failed++;
        setBatch(b => b ? { ...b, done: done + failed } : null);
      }
      await fetchMedias();
      setTimeout(() => setBatch(null), 4000);
      return;
    }

    const rawFile = files[0];

    // ── 1. Compression ────────────────────────────────────
    setUpload({ stage: 'compressing', originalKB: rawFile.size });

    let compressedFile = rawFile;
    let originalSize   = rawFile.size;
    let compressedSize = rawFile.size;

    try {
      const result = await compressImage(rawFile);
      compressedFile = result.file;
      originalSize   = result.originalSize;
      compressedSize = result.compressedSize;
    } catch { /* fallback */ }

    const savings = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;

    // ── 2. Upload → R2 ───────────────────────────────────
    setUpload({ stage: 'uploading', originalKB: originalSize, compressedKB: compressedSize, savings });

    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });

    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const uploadRes = await fetch('/api/upload-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({ fileName: compressedFile.name, contentType: compressedFile.type, fileBase64 }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      setUpload({ stage: 'error', error: uploadData.error || 'Erreur upload R2' });
      setTimeout(() => setUpload({ stage: 'idle' }), 4000);
      return;
    }

    const { error: dbError } = await supabase
      .from('media_assets')
      .insert([{ file_name: compressedFile.name, url: uploadData.url, alt_text: rawFile.name.split('.')[0] }]);

    if (dbError) {
      setUpload({ stage: 'error', error: dbError.message });
      setTimeout(() => setUpload({ stage: 'idle' }), 4000);
      return;
    }

    // ── 3. Done ───────────────────────────────────────────
    setUpload({ stage: 'done', originalKB: originalSize, compressedKB: compressedSize, savings });
    await fetchMedias();
    setTimeout(() => setUpload({ stage: 'idle' }), 5000);
  };

  const handleAltChange = async (id: string, newAlt: string) => {
    setMedias(medias.map(m => m.id === id ? { ...m, alt_text: newAlt } : m));
    await supabase.from('media_assets').update({ alt_text: newAlt }).eq('id', id);
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement cette image ?')) return;
    await supabase.from('media_assets').delete().eq('id', asset.id);
    setMedias(medias.filter(m => m.id !== asset.id));
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isUploading = upload.stage === 'compressing' || upload.stage === 'uploading' || batch !== null;

  // ── Upload status banner ───────────────────────────────
  const UploadBanner = () => {
    if (upload.stage === 'idle') return null;

    const banners: Record<UploadStage, { bg: string; icon: React.ReactNode; text: React.ReactNode }> = {
      idle: { bg: '', icon: null, text: null },
      compressing: {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: <Zap size={16} className="animate-pulse shrink-0" />,
        text: <span>Compression en cours… <span className="font-medium">{formatKB(upload.originalKB ?? 0)}</span></span>,
      },
      uploading: {
        bg: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: <Upload size={16} className="animate-bounce shrink-0" />,
        text: (
          <span>
            Envoi en cours…{' '}
            {upload.savings! > 0 && (
              <span className="font-medium">
                {formatKB(upload.originalKB ?? 0)} → {formatKB(upload.compressedKB ?? 0)}
              </span>
            )}
          </span>
        ),
      },
      done: {
        bg: 'bg-green-50 border-green-200 text-green-800',
        icon: <CheckCircle size={16} className="shrink-0" />,
        text: (
          <span>
            Image ajoutée avec succès !{' '}
            {upload.savings! > 0 ? (
              <span className="font-medium">
                {formatKB(upload.originalKB ?? 0)} → {formatKB(upload.compressedKB ?? 0)}{' '}
                <span className="bg-green-200 text-green-800 px-1.5 py-0.5 rounded text-[11px] font-bold ml-1">
                  −{upload.savings}%
                </span>
              </span>
            ) : (
              <span className="text-green-600 text-xs">(déjà optimisée)</span>
            )}
          </span>
        ),
      },
      error: {
        bg: 'bg-red-50 border-red-200 text-red-700',
        icon: <ImageIcon size={16} className="shrink-0" />,
        text: <span>Erreur : {upload.error}</span>,
      },
    };

    const b = banners[upload.stage];
    if (!b.text) return null;

    return (
      <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-sm mb-6 ${b.bg}`}>
        {b.icon}
        {b.text}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900">Médiathèque</h1>
          <p className="text-stone-500 mt-2">Gérez vos images et optimisez leur référencement (SEO).</p>
        </div>
        <label className={`cursor-pointer bg-stone-900 text-white px-6 py-3 text-sm hover:bg-stone-700 transition-colors flex items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={16} />
          {upload.stage === 'compressing' ? 'Compression…' : upload.stage === 'uploading' ? 'Envoi…' : 'Ajouter une image'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Ajout par URL — seul chemin disponible tant que R2 n'est pas
          configuré (l'upload de fichier répond alors 501). */}
      <AddMediaByUrl
        variant="card"
        className="mb-6"
        onAdded={(asset) => setMedias((prev) => [asset, ...prev])}
      />

      {/* Compression info capsule */}
      <div className="flex items-center gap-2 mb-6 text-[12.5px] text-stone-500 font-bold">
        <Zap size={12} className="text-amber-400" />
        Compression automatique activée — WebP · max 1920 px · qualité 82%
      </div>

      {/* Batch upload banner */}
      {batch && (
        <div className="flex items-center gap-3 px-4 py-3 border rounded-lg text-sm mb-6 bg-blue-50 border-blue-200 text-blue-800">
          <Upload size={16} className="animate-bounce shrink-0" />
          <span>
            Envoi en lot — <span className="font-medium">{batch.done}/{batch.total}</span> fichiers
            {batch.done < batch.total && <span className="text-blue-600 ml-2">· {batch.current}</span>}
            {batch.done === batch.total && <span className="ml-2 font-bold text-green-700">· Terminé {batch.failed > 0 ? `(${batch.failed} erreur(s))` : '✓'}</span>}
          </span>
        </div>
      )}

      {/* Upload status banner */}
      {!batch && <UploadBanner />}

      {/* Grid */}
      <div className="bg-white border border-stone-100 shadow-sm p-6">
        {loading ? (
          <div className="py-12 text-center text-stone-600">Chargement...</div>
        ) : medias.length === 0 ? (
          <div className="py-12 text-center text-stone-600">Aucune image. Commencez par en ajouter une.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medias.map((asset) => (
              <div key={asset.id} className="border border-stone-100 flex flex-col bg-stone-50 group">
                <div className="aspect-[4/3] bg-stone-200 overflow-hidden relative">
                  <img
                    src={asset.url}
                    alt={asset.alt_text}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <button
                    onClick={() => handleDelete(asset)}
                    className="absolute top-2 right-2 bg-white/90 text-red-500 p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity hover:bg-white shadow-sm"
                    title="Supprimer"
                    aria-label={`Supprimer l'image ${asset.file_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <label htmlFor={`media-alt-${asset.id}`} className="text-[13px] font-medium text-stone-800">
                      Texte Alternatif (Alt)
                    </label>
                    <input
                      id={`media-alt-${asset.id}`}
                      type="text"
                      value={asset.alt_text}
                      onChange={(e) => handleAltChange(asset.id, e.target.value)}
                      className="w-full border-b border-stone-300 bg-transparent py-1 focus:border-stone-900 outline-none transition-colors text-sm"
                      placeholder="Décrivez l'image pour Google..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                    <span className="truncate text-[12.5px] text-stone-500 w-3/4" title={asset.url}>
                      {asset.url.split('/').pop()}
                    </span>
                    <button
                      onClick={() => copyToClipboard(asset.url, asset.id)}
                      className="text-stone-500 hover:text-stone-900 transition-colors"
                      title="Copier l'URL"
                      aria-label={copiedId === asset.id ? 'URL copiée' : "Copier l'URL de l'image"}
                    >
                      {copiedId === asset.id
                        ? <CheckCircle size={16} className="text-sage" />
                        : <Copy size={16} />
                      }
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
