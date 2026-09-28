"use client";

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { Upload, Trash2, Copy, CheckCircle, Image as ImageIcon, RefreshCw, Loader2 } from 'lucide-react';
import { PageHeader, Button, EmptyState } from '../../../components/admin/ui';
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
  const [repatriating, setRepatriating] = useState(false);
  const [repatriateNotice, setRepatriateNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // État d'enregistrement de la description de chaque image (sauvée à la sortie du champ).
  const [altStatus, setAltStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [listNotice, setListNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRepatriateImages = async () => {
    const ok = window.confirm(
      "Les images venant d'autres sites (dans la médiathèque et dans vos pages) vont être copiées sur votre propre hébergement, " +
      "puis les pages seront mises à jour pour utiliser ces copies.\n\nCette opération modifie toutes vos pages et peut prendre plusieurs minutes. Continuer ?"
    );
    if (!ok) return;
    setRepatriating(true);
    setRepatriateNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/repatriate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({} as { success?: boolean; message?: string; error?: string }));
      if (data.success) {
        setRepatriateNotice({ kind: 'ok', text: data.message });
        await fetchMedias();
      } else {
        setRepatriateNotice({ kind: 'error', text: data.error || "Les images n'ont pas pu être copiées. Réessayez dans un instant." });
      }
    } catch (err: any) {
      setRepatriateNotice({ kind: 'error', text: "La connexion a été interrompue pendant la copie des images. Vérifiez votre connexion puis relancez l'opération." });
    } finally {
      setRepatriating(false);
    }
  };

  useEffect(() => { fetchMedias(); }, []);

  const fetchMedias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && !error) setMedias(data);
    else if (error) setListNotice("Les images n'ont pas pu être chargées. Rechargez la page.");
    setLoading(false);
  };

  const uploadSingleFile = async (rawFile: File): Promise<boolean> => {
    try {
      return await uploadSingleFileUnsafe(rawFile);
    } catch (err) {
      console.error('[MediaManager] envoi', rawFile.name, err);
      return false;
    }
  };

  const uploadSingleFileUnsafe = async (rawFile: File): Promise<boolean> => {
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

    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.url) return false;

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
        setBatch(b => b ? { ...b, done: done + failed, failed } : null);
      }
      await fetchMedias();
      // Un échec reste affiché plus longtemps pour laisser le temps de le lire.
      setTimeout(() => setBatch(null), failed > 0 ? 10000 : 4000);
      return;
    }

    try {
      await uploadOne(files[0]);
    } catch (err) {
      console.error('[MediaManager] envoi', err);
      setUpload({ stage: 'error', error: "L'image n'a pas pu être envoyée. Réessayez, ou collez l'adresse d'une image déjà en ligne." });
      setTimeout(() => setUpload({ stage: 'idle' }), 8000);
    }
  };

  const uploadOne = async (rawFile: File) => {

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

    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.url) {
      setUpload({
        stage: 'error',
        error: uploadData.error
          ? `${uploadData.error} Vous pouvez aussi coller l'adresse d'une image déjà en ligne.`
          : "L'envoi du fichier a échoué. Réessayez, ou collez l'adresse d'une image déjà en ligne.",
      });
      setTimeout(() => setUpload({ stage: 'idle' }), 8000);
      return;
    }

    const { error: dbError } = await supabase
      .from('media_assets')
      .insert([{ file_name: compressedFile.name, url: uploadData.url, alt_text: rawFile.name.split('.')[0] }]);

    if (dbError) {
      setUpload({ stage: 'error', error: `L'image a été envoyée mais n'a pas pu être ajoutée à la médiathèque (${dbError.message}). Réessayez.` });
      setTimeout(() => setUpload({ stage: 'idle' }), 8000);
      return;
    }

    // ── 3. Done ───────────────────────────────────────────
    setUpload({ stage: 'done', originalKB: originalSize, compressedKB: compressedSize, savings });
    await fetchMedias();
    setTimeout(() => setUpload({ stage: 'idle' }), 5000);
  };

  /*
    La description se modifie localement à chaque frappe et ne s'enregistre
    qu'à la sortie du champ : avant, chaque lettre tapée partait en base, sans
    retour en cas d'échec.
  */
  const handleAltChange = (id: string, newAlt: string) => {
    setMedias(prev => prev.map(m => m.id === id ? { ...m, alt_text: newAlt } : m));
    setAltStatus(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const saveAlt = async (id: string, value: string) => {
    setAltStatus(prev => ({ ...prev, [id]: 'saving' }));
    const { error } = await supabase.from('media_assets').update({ alt_text: value }).eq('id', id);
    setAltStatus(prev => ({ ...prev, [id]: error ? 'error' : 'saved' }));
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm("Supprimer définitivement cette image de la médiathèque ? Elle ne sera plus proposée dans la liste des images.")) return;
    setListNotice(null);
    const { error } = await supabase.from('media_assets').delete().eq('id', asset.id);
    if (error) {
      setListNotice("L'image n'a pas pu être supprimée. Vérifiez votre connexion puis réessayez.");
      return;
    }
    setMedias(prev => prev.filter(m => m.id !== asset.id));
  };

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setListNotice("L'adresse n'a pas pu être copiée automatiquement.");
    }
  };

  const isUploading = upload.stage === 'compressing' || upload.stage === 'uploading' || (batch !== null && batch.done < batch.total);

  // ── Upload status banner ───────────────────────────────
  const UploadBanner = () => {
    if (upload.stage === 'idle') return null;

    const banners: Record<UploadStage, { bg: string; icon: React.ReactNode; text: React.ReactNode }> = {
      idle: { bg: '', icon: null, text: null },
      compressing: {
        bg: 'bg-stone-50 border-stone-200 text-stone-800',
        icon: <Loader2 size={16} className="animate-spin shrink-0" />,
        text: <span>Préparation de l'image… <span className="font-medium">{formatKB(upload.originalKB ?? 0)}</span></span>,
      },
      uploading: {
        bg: 'bg-stone-50 border-stone-200 text-stone-800',
        icon: <Loader2 size={16} className="animate-spin shrink-0" />,
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
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <CheckCircle size={16} className="shrink-0" />,
        text: (
          <span>
            Image ajoutée.{' '}
            {upload.savings! > 0 ? (
              <span className="font-medium">
                {formatKB(upload.originalKB ?? 0)} → {formatKB(upload.compressedKB ?? 0)}{' '}
                <span className="ml-1">(−{upload.savings} %)</span>
              </span>
            ) : (
              <span>(déjà légère, laissée telle quelle)</span>
            )}
          </span>
        ),
      },
      error: {
        bg: 'bg-red-50 border-red-200 text-red-700',
        icon: <ImageIcon size={16} className="shrink-0" />,
        text: <span>{upload.error}</span>,
      },
    };

    const b = banners[upload.stage];
    if (!b.text) return null;

    return (
      <div role="status" className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-[14px] mb-6 ${b.bg}`}>
        {b.icon}
        {b.text}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Médiathèque"
        description="Toutes les images du site. Ajoutez-en, décrivez-les pour Google et copiez leur adresse pour les réutiliser."
        actions={
          <label className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent text-accent-fg hover:bg-accent-hover text-[14px] font-semibold transition-colors cursor-pointer shrink-0 focus-within:ring-2 focus-within:ring-accent/40 focus-within:ring-offset-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {upload.stage === 'compressing' ? 'Préparation…' : upload.stage === 'uploading' || (batch && batch.done < batch.total) ? 'Envoi en cours…' : 'Ajouter des images'}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </label>
        }
      />

      {/* Ajout par URL — seul chemin disponible tant que R2 n'est pas
          configuré (l'upload de fichier répond alors 501). */}
      <AddMediaByUrl
        variant="card"
        className="mb-6"
        onAdded={(asset) => setMedias((prev) => [asset, ...prev])}
      />

      <p className="mb-6 text-[13px] text-stone-600">
        Les photos envoyées depuis votre ordinateur sont allégées automatiquement pour que le site reste rapide.
      </p>

      {/* Batch upload banner */}
      {batch && (
        <div role="status" className={`flex items-center gap-3 px-4 py-3 border rounded-lg text-[14px] mb-6 ${
          batch.done < batch.total ? 'bg-stone-50 border-stone-200 text-stone-800'
          : batch.failed > 0 ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {batch.done < batch.total
            ? <Loader2 size={16} className="animate-spin shrink-0" />
            : <CheckCircle size={16} className="shrink-0" />}
          <span>
            {batch.done < batch.total ? (
              <>Envoi des images : <span className="font-medium">{batch.done} sur {batch.total}</span><span className="ml-2 text-stone-600">({batch.current})</span></>
            ) : batch.failed > 0 ? (
              <>{batch.total - batch.failed} image{batch.total - batch.failed > 1 ? 's' : ''} sur {batch.total} ajoutée{batch.total - batch.failed > 1 ? 's' : ''}. {batch.failed} n&apos;{batch.failed > 1 ? 'ont' : 'a'} pas pu être envoyée{batch.failed > 1 ? 's' : ''} : réessayez avec {batch.failed > 1 ? 'ces fichiers' : 'ce fichier'}.</>
            ) : (
              <>{batch.total} images ajoutées.</>
            )}
          </span>
        </div>
      )}

      {/* Upload status banner */}
      {!batch && <UploadBanner />}

      {listNotice && (
        <div role="alert" className="flex items-center justify-between gap-3 p-4 rounded-xl text-[14px] font-medium mb-6 border bg-red-50 text-red-900 border-red-200">
          <span>{listNotice}</span>
          <button type="button" onClick={() => setListNotice(null)} className="text-[13px] font-semibold underline underline-offset-2 cursor-pointer">Fermer</button>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white border border-stone-200 rounded-xl p-6">
        {loading ? (
          <div className="py-12 text-center text-[14px] text-stone-700">Chargement des images…</div>
        ) : medias.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Aucune image pour l'instant"
            description="Ajoutez des photos depuis votre ordinateur avec le bouton « Ajouter des images », ou collez l'adresse d'une image déjà en ligne."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medias.map((asset) => (
              <div key={asset.id} className="border border-stone-200 rounded-xl overflow-hidden flex flex-col bg-white">
                <div className="aspect-[4/3] bg-stone-200 overflow-hidden relative">
                  <img
                    src={asset.url}
                    alt={asset.alt_text}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <label htmlFor={`media-alt-${asset.id}`} className="text-[13px] font-medium text-stone-800">
                      Description de l&apos;image
                    </label>
                    <input
                      id={`media-alt-${asset.id}`}
                      type="text"
                      value={asset.alt_text ?? ''}
                      onChange={(e) => handleAltChange(asset.id, e.target.value)}
                      onBlur={(e) => { const st = altStatus[asset.id]; if (st !== 'saving' && st !== 'saved') void saveAlt(asset.id, e.target.value); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-full h-10 rounded-lg border border-stone-300 bg-white px-3 text-[14px] text-stone-900 placeholder:text-stone-500 focus:border-accent focus:ring-3 focus:ring-accent/15 outline-none transition-colors"
                      placeholder="Ex. : soin du visage dans le cabinet"
                    />
                    <p className="text-[13px] text-stone-600" aria-live="polite">
                      {altStatus[asset.id] === 'saving' ? 'Enregistrement…'
                        : altStatus[asset.id] === 'saved' ? <span className="text-emerald-700">Description enregistrée</span>
                        : altStatus[asset.id] === 'error' ? <span className="text-red-700">Non enregistrée. Cliquez dans le champ puis ailleurs pour réessayer.</span>
                        : 'Lue par Google et par les personnes malvoyantes. Enregistrée quand vous quittez le champ.'}
                    </p>
                  </div>

                  <p className="truncate text-[13px] text-stone-600 pt-3 border-t border-stone-200" title={asset.url}>
                    {asset.url.split('/').pop()}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={copiedId === asset.id ? CheckCircle : Copy}
                      onClick={() => void copyToClipboard(asset.url, asset.id)}
                    >
                      {copiedId === asset.id ? 'Adresse copiée' : "Copier l'adresse"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => handleDelete(asset)}
                      aria-label={`Supprimer l'image ${asset.alt_text || asset.file_name}`}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-8 rounded-xl border border-stone-200 bg-white">
        <summary className="cursor-pointer px-6 py-4 text-[14px] font-semibold text-stone-900">Avancé</summary>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 px-6 py-5">
          <p className="max-w-2xl text-[14px] text-stone-700">
            Copie sur votre hébergement les images qui viennent d&apos;autres sites (par exemple après un import),
            pour qu&apos;elles ne disparaissent pas si ces sites les retirent. Vos pages sont mises à jour automatiquement.
          </p>
          <Button type="button" variant="secondary" icon={RefreshCw} loading={repatriating} onClick={handleRepatriateImages}>
            {repatriating ? 'Copie en cours…' : 'Copier les images externes'}
          </Button>
        </div>
        {repatriateNotice && (
          <div className="px-6 pb-5">
      {(
        <div role="status" className={`p-4 rounded-xl text-[14px] font-medium flex items-center gap-2 border ${
          repatriateNotice.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          {repatriateNotice.kind === 'ok' ? <CheckCircle size={16} className="text-emerald-600 shrink-0" /> : <ImageIcon size={16} className="text-red-600 shrink-0" />}
          <span>{repatriateNotice.text}</span>
        </div>
      )}
          </div>
        )}
      </details>
    </div>
  );
}
