"use client";

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { compressImage, uploadFileToR2 } from '../../utils/imageUpload';

interface MediaAsset {
  id: string;
  file_name: string;
  url: string;
  alt_text: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function MediaPickerModal({ isOpen, onClose, onSelect }: MediaPickerModalProps) {
  const [medias, setMedias] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMedias();
    }
  }, [isOpen]);

  const fetchMedias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && !error) setMedias(data);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const rawFile = e.target.files[0];

    setIsUploading(true);

    try {
      const { file: compressedFile } = await compressImage(rawFile);
      const { url, error: uploadError } = await uploadFileToR2(compressedFile);
      
      if (uploadError || !url) {
        throw new Error(uploadError || "Erreur d'upload");
      }

      const { data, error: dbError } = await supabase.from('media_assets').insert([{ 
        file_name: compressedFile.name, 
        url: url, 
        alt_text: rawFile.name.split('.')[0] 
      }]).select('*');

      if (!dbError && data && data.length > 0) {
        setMedias([data[0], ...medias]);
        onSelect(url);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'upload de l'image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-10">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-900">Bibliothèque Médias</h2>
            <p className="text-sm text-stone-500 font-light">Sélectionnez une image ou ajoutez-en une nouvelle.</p>
          </div>
          <div className="flex items-center gap-4">
            <label className={`cursor-pointer bg-sage text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-wood transition-colors flex items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {isUploading ? 'Envoi...' : 'Uploader'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={isUploading}
              />
            </label>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-white rounded-full border border-stone-200 shadow-sm transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-100">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-4">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm">Chargement des médias...</p>
            </div>
          ) : medias.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-4">
              <ImageIcon size={48} className="opacity-30" />
              <p className="text-sm">Votre bibliothèque est vide.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {medias.map((asset) => (
                <div 
                  key={asset.id} 
                  className="group relative aspect-square bg-stone-200 rounded-xl overflow-hidden border-2 border-transparent hover:border-sage cursor-pointer transition-all shadow-sm hover:shadow-md"
                  onClick={() => onSelect(asset.url)}
                >
                  <img
                    src={asset.url}
                    alt={asset.alt_text}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-sage text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                      Sélectionner
                    </span>
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
