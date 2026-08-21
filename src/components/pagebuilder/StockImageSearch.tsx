'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface StockImage {
  id: string;
  url: string;
  thumb: string;
  title: string;
  photographer: string;
  source: string;
}

interface StockImageSearchProps {
  onSelectUrl: (url: string) => void;
}

const PRESET_TAGS = [
  { label: '💆 Massage & relaxation', query: 'massage' },
  { label: '✨ Soins du visage', query: 'facial' },
  { label: '🌿 Spa & bien-être', query: 'spa' },
  { label: '🌸 Nature & huiles', query: 'nature' },
  { label: '👩‍⚕️ Praticienne & salon', query: 'salon' },
];

export default function StockImageSearch({ onSelectUrl }: StockImageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('spa');
  const [images, setImages] = useState<StockImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isInserting, setIsInserting] = useState(false);

  const fetchStockImages = async (queryToSearch: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stock-images?q=${encodeURIComponent(queryToSearch)}`);
      const data = await res.json();
      setImages(data.images || []);
    } catch (err) {
      console.error('Erreur stock images :', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockImages('spa');
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchStockImages(searchQuery.trim());
    }
  };

  const handleChooseImage = async (img: StockImage) => {
    setSelectedUrl(img.url);
    setIsInserting(true);

    try {
      // Save asset in Supabase media_assets table
      const { data } = await supabase
        .from('media_assets')
        .insert([{ file_name: img.title, url: img.url, alt_text: img.title }])
        .select('*');

      onSelectUrl(img.url);
    } catch (err) {
      console.error('Erreur lors de l’ajout du média :', err);
      onSelectUrl(img.url);
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher des photos HD (ex: massage visage, spa, huiles, nature)..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Rechercher
        </button>
      </form>

      {/* Preset Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_TAGS.map((tag) => (
          <button
            key={tag.query}
            type="button"
            onClick={() => {
              setSearchQuery(tag.query);
              fetchStockImages(tag.query);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              searchQuery === tag.query
                ? 'bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Images Grid */}
      <div className="min-h-[220px]">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2 text-stone-500">
            <Loader2 size={28} className="animate-spin text-amber-600" />
            <p className="text-xs">Recherche d'images Unsplash & Stock HD…</p>
          </div>
        ) : images.length === 0 ? (
          <div className="py-12 text-center text-stone-500 space-y-2">
            <ImageIcon size={36} className="mx-auto opacity-30" />
            <p className="text-xs">Aucune image trouvée pour cette recherche.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {images.map((img) => (
              <div
                key={img.id}
                onClick={() => handleChooseImage(img)}
                className={`group relative rounded-xl overflow-hidden border cursor-pointer aspect-video bg-stone-100 transition-all ${
                  selectedUrl === img.url
                    ? 'ring-2 ring-amber-600 border-amber-600'
                    : 'border-stone-200 hover:border-stone-400 hover:scale-[1.02]'
                }`}
              >
                <img
                  src={img.thumb || img.url}
                  alt={img.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                  <span className="text-[11px] font-semibold text-white bg-stone-900/80 px-2 py-1 rounded-md flex items-center gap-1">
                    {isInserting && selectedUrl === img.url ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    Utiliser cette photo
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
