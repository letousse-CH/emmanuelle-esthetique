"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { Palette, Check, X, Loader2, Sun, Moon } from 'lucide-react';
import { settingsCache } from '../../hooks/useSettings';

interface SectionStyleEditorProps {
  sectionId: string;
  sectionName: string;
  bgKey: string;
  themeKey: string;
  currentBg: string;
  currentTheme: 'dark' | 'light';
  onSave: (bg: string, theme: 'dark' | 'light', opacity?: number) => void;
  opacityKey?: string;
  currentOpacity?: number;
}

const PRESETS = [
  { name: 'Sombre Profond', value: '#0A0A0A' },
  { name: 'Gris Foncé', value: '#0F0F0F' },
  { name: 'Papier Clair', value: '#fcfbf7' },
  { name: 'Blanc Pur', value: '#ffffff' },
  { name: 'Vert Sauge', value: '#5b7e5a' },
  { name: 'Cuivre', value: '#B87333' },
];

export default function SectionStyleEditor({
  sectionId,
  sectionName,
  bgKey,
  themeKey,
  currentBg,
  currentTheme,
  onSave,
  opacityKey,
  currentOpacity,
}: SectionStyleEditorProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedBg, setSelectedBg] = useState(currentBg);
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>(currentTheme);
  const [selectedOpacity, setSelectedOpacity] = useState(currentOpacity ?? 70);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Auth Check ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync with prop updates
  useEffect(() => {
    setSelectedBg(currentBg);
    setSelectedTheme(currentTheme);
    if (currentOpacity !== undefined) {
      setSelectedOpacity(currentOpacity);
    }
  }, [currentBg, currentTheme, currentOpacity]);

  // ── Click outside handler to close panel ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const clickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [isOpen]);

  if (!isAdmin) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update local settingsCache
      settingsCache.set(bgKey, selectedBg);
      settingsCache.set(themeKey, selectedTheme);
      if (opacityKey) {
        settingsCache.set(opacityKey, String(selectedOpacity));
      }

      // Save to Supabase settings table
      const rows = [
        { key: bgKey, value: selectedBg },
        { key: themeKey, value: selectedTheme }
      ];
      if (opacityKey) {
        rows.push({ key: opacityKey, value: String(selectedOpacity) });
      }

      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });

      if (error) throw error;

      // Update parent component dynamically
      onSave(selectedBg, selectedTheme, opacityKey ? selectedOpacity : undefined);
      setIsOpen(false);
    } catch (err) {
      console.error('[SectionStyleEditor] error saving style:', err);
      alert("Erreur lors de la sauvegarde du style.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="absolute top-4 right-4 z-50 pointer-events-auto">
      {/* Floating Gear/Palette button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-stone-900/90 hover:bg-copper text-white rounded-full shadow-2xl transition-all duration-300 backdrop-blur-sm hover:scale-105 border border-white/10 flex items-center justify-center cursor-pointer"
        title={`Modifier le style de : ${sectionName}`}
      >
        <Palette size={16} className={isOpen ? 'rotate-45' : ''} />
      </button>

      {/* Floating Config Box */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-stone-200 shadow-2xl p-5 text-stone-850 animate-fadein z-50">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Style : {sectionName}
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-stone-900 p-1 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* BACKGROUND COLOR PICKER */}
          <div className="space-y-3 mb-5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">
              Couleur de fond
            </label>

            {/* Presets Grid */}
            <div className="grid grid-cols-6 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setSelectedBg(p.value)}
                  style={{ backgroundColor: p.value }}
                  title={p.name}
                  className={`w-8 h-8 rounded-full border transition-all cursor-pointer ${
                    selectedBg.toLowerCase() === p.value.toLowerCase()
                      ? 'border-copper ring-2 ring-copper/30 scale-110 shadow-md'
                      : 'border-stone-200 hover:scale-105'
                  }`}
                />
              ))}
            </div>

            {/* Custom hex input & color picker */}
            <div className="flex items-center gap-2 pt-1.5">
              <div className="relative w-7 h-7 rounded-lg border border-stone-200 overflow-hidden shrink-0 shadow-inner">
                <input
                  type="color"
                  value={selectedBg.startsWith('#') ? selectedBg : '#0a0a0a'}
                  onChange={(e) => setSelectedBg(e.target.value)}
                  className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none p-0"
                />
              </div>
              <input
                type="text"
                value={selectedBg}
                onChange={(e) => setSelectedBg(e.target.value)}
                placeholder="#0A0A0A"
                className="w-full px-3 py-1.5 border border-stone-200 text-xs font-mono rounded bg-stone-50 focus:bg-white focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all text-stone-900"
              />
            </div>
          </div>

          {/* LIGHT / DARK TEXT CONTRAST */}
          <div className="space-y-3 mb-5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">
              Contraste du texte
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedTheme('dark')}
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedTheme === 'dark'
                    ? 'border-copper bg-stone-50 font-bold text-stone-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 text-stone-500'
                }`}
              >
                <Moon size={16} className={selectedTheme === 'dark' ? 'text-copper' : ''} />
                <span className="text-[10px] uppercase tracking-wider mt-1.5 font-bold">Sombre</span>
                <span className="text-[8px] text-stone-400 mt-0.5 font-normal">Texte blanc</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTheme('light')}
                className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedTheme === 'light'
                    ? 'border-copper bg-stone-50 font-bold text-stone-900 shadow-sm'
                    : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 text-stone-500'
                }`}
              >
                <Sun size={16} className={selectedTheme === 'light' ? 'text-copper' : ''} />
                <span className="text-[10px] uppercase tracking-wider mt-1.5 font-bold">Clair</span>
                <span className="text-[8px] text-stone-400 mt-0.5 font-normal">Texte sombre</span>
              </button>
            </div>
          </div>

          {/* OPACITY SLIDER */}
          {opacityKey && (
            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400">
                  Opacité de l'overlay
                </label>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                  {selectedOpacity}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedOpacity}
                onChange={(e) => setSelectedOpacity(parseInt(e.target.value))}
                className="w-full cursor-pointer accent-stone-900"
              />
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-2.5 pt-2 border-t border-stone-100">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2 border border-stone-200 text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:bg-stone-50 transition-all cursor-pointer text-center"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-copper text-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
