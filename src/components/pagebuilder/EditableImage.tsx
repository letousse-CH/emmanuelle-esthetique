"use client";

import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import { Image as ImageIcon, Loader2, Check, Pencil, X, Settings2 } from 'lucide-react';
import { PageEditorContext } from '../../contexts/PageEditorContext';
import MediaPickerModal from './MediaPickerModal';
import { fetchAllSettings, settingsCache } from '../../hooks/useSettings';

interface EditableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  settingKey?: string;
  src: string;
  className?: string;
  sectionIndex?: number;
  fieldPath?: string;
  initialPosition?: string;
}

const LAYOUT_RE = /^(w-|h-|max-w-|max-h-|min-w-|min-h-|aspect-|absolute|fixed|sticky|inset|top-|left-|right-|bottom-)/;
const LAYOUT_EXACT = new Set(['block', 'inline-block', 'flex', 'grid']);

function splitClasses(cls: string) {
  const all = cls.split(/\s+/).filter(Boolean);
  const layout = all.filter(c => LAYOUT_RE.test(c) || LAYOUT_EXACT.has(c));
  const visual  = all.filter(c => !LAYOUT_RE.test(c) && !LAYOUT_EXACT.has(c));
  return { layout: layout.join(' '), visual: visual.join(' ') };
}

export default function EditableImage({
  settingKey = '', src, className = '', sectionIndex, fieldPath, style, initialPosition, ...props
}: EditableImageProps) {
  const [isAdmin, setIsAdmin]               = useState(false);
  const [isUploading, setIsUploading]       = useState(false);
  const [currentSrc, setCurrentSrc]         = useState(src);
  const [showSaved, setShowSaved]           = useState(false);
  const [modalOpen, setModalOpen]           = useState(false);
  const [objectPosition]                    = useState(initialPosition ?? 'center');
  const [active, setActive]                 = useState(false);
  const [btnCoords, setBtnCoords]           = useState<{ top: number; right: number }>({ top: 16, right: 16 });

  const wrapperRef   = useRef<HTMLDivElement>(null);
  const pageEditor   = useContext(PageEditorContext);
  const posKey       = settingKey ? `${settingKey}_pos` : '';

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAdmin(!!s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (settingKey) {
      const cached = settingsCache.get(settingKey);
      if (cached !== undefined) { setCurrentSrc(cached); }
      else fetchAllSettings().then(() => {
        const v = settingsCache.get(settingKey);
        if (v !== undefined) setCurrentSrc(v);
      });
    }
  }, [settingKey]);

  useEffect(() => {
    if (!isUploading) {
      if (settingKey) {
        const cached = settingsCache.get(settingKey);
        if (cached !== undefined) { setCurrentSrc(cached); return; }
      }
      setCurrentSrc(src);
    }
  }, [src, settingKey, isUploading]);

  useEffect(() => {
    if (!active) return;
    const close = (e: MouseEvent) => {
      const btns = document.querySelector('[data-img-buttons="true"]');
      if (btns?.contains(e.target as Node)) return;
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setActive(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [active]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sectionIndex !== undefined && pageEditor?.openSectionEditor) {
      pageEditor.openSectionEditor(sectionIndex);
    }
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setBtnCoords({
      top:   Math.max(r.top + 12, 16),
      right: Math.max(window.innerWidth - r.right + 12, 16),
    });
    setActive(v => !v);
  };

  const handleSelectMedia = async (url: string) => {
    setModalOpen(false);
    setIsUploading(true);
    try {
      if (pageEditor && sectionIndex !== undefined && fieldPath) {
        pageEditor.updateField(sectionIndex, fieldPath, url);
        pageEditor.savePage();
      } else {
        const { error } = await supabase.from('settings').upsert({ key: settingKey, value: url }, { onConflict: 'key' });
        if (error) throw error;
        if (settingKey) settingsCache.set(settingKey, url);
      }
      setCurrentSrc(url);
      setShowSaved(true);
      setTimeout(() => { setShowSaved(false); setActive(false); }, 3000);
      window.dispatchEvent(new CustomEvent('sde:imageChanged', { detail: { key: settingKey, url } }));
    } catch (err) {
      console.error(err);
      alert("Erreur lors du changement de l'image.");
    } finally {
      setIsUploading(false);
    }
  };

  const imgStyle = { objectPosition, ...style };
  const canEdit  = (isAdmin && !!settingKey) || (!!fieldPath && !!pageEditor?.isEditing);

  if (!canEdit) {
    if (!currentSrc) return null;
    return <img src={currentSrc} className={className} style={imgStyle} {...props} />;
  }

  const adminButtons = typeof document !== 'undefined' ? createPortal(
    <div
      data-img-buttons="true"
      style={{
        position: 'fixed',
        top:   btnCoords.top,
        right: btnCoords.right,
        zIndex: 2147483647,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        pointerEvents: 'auto',
        transition: 'opacity 0.15s',
        opacity: active ? 1 : 0,
      }}
    >
      {isUploading ? (
        <div className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full shadow-2xl text-xs font-semibold">
          <Loader2 className="animate-spin" size={14} /> Envoi…
        </div>
      ) : showSaved ? (
        <div className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full shadow-2xl text-xs font-semibold">
          <Check size={14} /> Sauvegardé
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-stone-900/95 backdrop-blur-md text-white p-1.5 rounded-full shadow-2xl border border-stone-700">
          {sectionIndex !== undefined && pageEditor?.openSectionEditor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActive(false);
                pageEditor.openSectionEditor!(sectionIndex);
              }}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Ouvrir la modale complète d'édition de section (Variante, Fond, Style, Textes)"
            >
              <Settings2 size={13} />
              <span>Modifier la section</span>
            </button>
          )}

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 hover:bg-stone-800 text-stone-200 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
            title="Changer l'image uniquement"
          >
            <ImageIcon size={13} />
            <span>Changer d'image</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setActive(false); }}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition-all cursor-pointer"
            title="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  // ── Wrapper ───────────────────────────────────────────────────────────────────
  const { layout, visual } = splitClasses(className);
  return (
    <div
      ref={wrapperRef}
      className={`relative cursor-pointer ${layout}`}
      onClick={handleClick}
      title="Cliquer pour modifier l'image"
      data-no-edit="true"
    >
      {/* Indicateur visuel discret en mode édition */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-200"
        style={{ zIndex: 1, outline: active ? '2px solid #7c9a8a' : '2px dashed transparent', outlineOffset: '-2px' }}
        data-no-edit="true"
      />
      {currentSrc ? (
        <>
          <img src={currentSrc} className={`w-full h-full ${visual}`} style={imgStyle} data-no-edit="true" {...props} />
          {currentSrc.includes('unsplash.com') && (
            <span className="absolute bottom-1 right-2 z-10 text-[10px] text-white/90 font-sans italic bg-stone-900/60 px-1.5 py-0.5 rounded backdrop-blur-xs select-none pointer-events-none">
              Photo : Unsplash
            </span>
          )}
        </>
      ) : (
        // Emplacement vide en mode édition : cliquable, sans requête réseau.
        <div
          className={`grid h-full w-full min-h-24 place-items-center bg-stone-100 text-[12px] text-stone-500 ${visual}`}
          data-no-edit="true"
        >
          Ajouter une image
        </div>
      )}
      {adminButtons}
      <MediaPickerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSelect={handleSelectMedia} />
    </div>
  );
}
