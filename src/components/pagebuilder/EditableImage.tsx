"use client";

import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabase';
import { Image as ImageIcon, Loader2, Check, Move, X } from 'lucide-react';
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

const POSITIONS = [
  { label: 'Haut gauche',  value: 'top left',     icon: '↖' },
  { label: 'Haut',         value: 'top center',    icon: '↑' },
  { label: 'Haut droite',  value: 'top right',     icon: '↗' },
  { label: 'Gauche',       value: 'center left',   icon: '←' },
  { label: 'Centre',       value: 'center',        icon: '⊙' },
  { label: 'Droite',       value: 'center right',  icon: '→' },
  { label: 'Bas gauche',   value: 'bottom left',   icon: '↙' },
  { label: 'Bas',          value: 'bottom center', icon: '↓' },
  { label: 'Bas droite',   value: 'bottom right',  icon: '↘' },
];

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
  const [posOpen, setPosOpen]               = useState(false);
  const [objectPosition, setObjectPosition] = useState(initialPosition ?? 'center');
  const [popupCoords, setPopupCoords]       = useState({ top: 0, left: 0 });
  const [active, setActive]                 = useState(false);
  const [btnCoords, setBtnCoords]           = useState({ bottom: 12, right: 12 });

  const wrapperRef   = useRef<HTMLDivElement>(null);
  const posButtonRef = useRef<HTMLButtonElement>(null);
  const pageEditor   = useContext(PageEditorContext);
  const posKey       = settingKey ? `${settingKey}_pos` : '';

  // ── Auth ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAdmin(!!s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Chargement src + position ─────────────────────────────────────────────────
  useEffect(() => {
    if (settingKey) {
      const cached = settingsCache.get(settingKey);
      if (cached !== undefined) { setCurrentSrc(cached); }
      else fetchAllSettings().then(() => {
        const v = settingsCache.get(settingKey);
        if (v !== undefined) setCurrentSrc(v);
      });
    }
    if (posKey) {
      const cachedPos = settingsCache.get(posKey);
      if (cachedPos !== undefined) { setObjectPosition(cachedPos); }
      else fetchAllSettings().then(() => {
        const v = settingsCache.get(posKey);
        if (v !== undefined) setObjectPosition(v);
      });
    }
  }, [settingKey, posKey]);

  useEffect(() => {
    if (!isUploading) {
      if (settingKey) {
        const cached = settingsCache.get(settingKey);
        if (cached !== undefined) { setCurrentSrc(cached); return; }
      }
      setCurrentSrc(src);
    }
  }, [src, settingKey, isUploading]);

  // ── Ferme tout en cliquant ailleurs ──────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const close = (e: MouseEvent) => {
      const btns  = document.querySelector('[data-img-buttons="true"]');
      const popup = document.querySelector('[data-pos-popup="true"]');
      if (btns?.contains(e.target as Node)) return;
      if (popup?.contains(e.target as Node)) return;
      if (wrapperRef.current?.contains(e.target as Node)) return;
      setActive(false);
      setPosOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [active]);

  // ── Clic sur l'image : toggle les boutons ────────────────────────────────────
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setBtnCoords({
      bottom: window.innerHeight - r.bottom + 12,
      right:  window.innerWidth  - r.right  + 12,
    });
    setActive(v => !v);
    setPosOpen(false);
  };

  const openPosPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!posButtonRef.current) return;
    const r = posButtonRef.current.getBoundingClientRect();
    setPopupCoords({ top: r.top - 8, left: r.left + r.width / 2 });
    setPosOpen(v => !v);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────
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

  const handleSelectPosition = async (pos: string) => {
    setPosOpen(false);
    setObjectPosition(pos);
    if (pageEditor && sectionIndex !== undefined && fieldPath) {
      pageEditor.updateField(sectionIndex, fieldPath + '_pos', pos);
      pageEditor.savePage();
    } else if (posKey) {
      settingsCache.set(posKey, pos);
      await supabase.from('settings').upsert({ key: posKey, value: pos }, { onConflict: 'key' });
    }
  };

  const imgStyle = { objectPosition, ...style };
  const canEdit  = (isAdmin || pageEditor?.isEditing) && (!!settingKey || !!fieldPath);

  // ── Non-admin : simple img ────────────────────────────────────────────────────
  if (!canEdit) {
    return <img src={currentSrc} className={className} style={imgStyle} {...props} />;
  }

  // ── Boutons via portal (fixed) — échappe overflow:hidden et stacking contexts ─
  const adminButtons = typeof document !== 'undefined' ? createPortal(
    <div
      data-img-buttons="true"
      style={{
        position: 'fixed',
        bottom: btnCoords.bottom,
        right:  btnCoords.right,
        zIndex: 2147483647,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        transition: 'opacity 0.15s',
        opacity: active ? 1 : 0,
      }}
    >
      {isUploading ? (
        <div className="flex flex-col items-center gap-1.5 text-white drop-shadow-lg">
          <div className="bg-sage p-3 rounded-full shadow-xl"><Loader2 className="animate-spin" size={20} /></div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Envoi...</span>
        </div>
      ) : showSaved ? (
        <div className="flex flex-col items-center gap-1.5 text-white drop-shadow-lg">
          <div className="bg-sage p-3 rounded-full shadow-xl"><Check size={20} /></div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Sauvegardé</span>
        </div>
      ) : (
        <>
          <button
            onClick={() => setModalOpen(true)}
            className="flex flex-col items-center gap-1.5 text-white hover:scale-110 transition-transform drop-shadow-lg"
          >
            <div className="bg-sage p-3 rounded-full shadow-xl"><ImageIcon size={20} /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Changer</span>
          </button>
          <button
            ref={posButtonRef}
            onClick={openPosPopup}
            className="flex flex-col items-center gap-1.5 text-white hover:scale-110 transition-transform drop-shadow-lg"
          >
            <div className={`p-3 rounded-full shadow-xl transition-colors ${posOpen ? 'bg-white' : 'bg-sage'}`}>
              <Move size={20} className={posOpen ? 'text-sage' : 'text-white'} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Position</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActive(false); setPosOpen(false); }}
            className="flex flex-col items-center gap-1.5 text-white hover:scale-110 transition-transform drop-shadow-lg"
          >
            <div className="bg-stone-700/80 p-3 rounded-full shadow-xl"><X size={20} /></div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Fermer</span>
          </button>
        </>
      )}
    </div>,
    document.body
  ) : null;

  // ── Popup position (portal) ───────────────────────────────────────────────────
  const posPopup = posOpen && typeof document !== 'undefined' ? createPortal(
    <div
      data-pos-popup="true"
      style={{ position: 'fixed', top: popupCoords.top, left: popupCoords.left, transform: 'translate(-50%, -100%)', zIndex: 2147483647 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-100 p-4" style={{ width: 260 }}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 text-center mb-3">Cadrage de l'image</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {POSITIONS.map(({ label, value, icon }) => (
            <button
              key={value}
              title={label}
              onClick={() => handleSelectPosition(value)}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-bold transition-all
                ${objectPosition === value
                  ? 'bg-sage text-white shadow-md ring-2 ring-sage/40'
                  : 'bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl overflow-hidden border border-stone-100 relative" style={{ height: 80 }}>
          <img src={currentSrc} alt="aperçu" className="w-full h-full object-cover transition-all duration-300" style={{ objectPosition }} />
          <span className="absolute bottom-1 right-2 text-[9px] text-white/80 font-bold uppercase tracking-widest drop-shadow">aperçu</span>
        </div>
      </div>
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
      <img src={currentSrc} className={`w-full h-full ${visual}`} style={imgStyle} data-no-edit="true" {...props} />
      {adminButtons}
      {posPopup}
      <MediaPickerModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSelect={handleSelectMedia} />
    </div>
  );
}
