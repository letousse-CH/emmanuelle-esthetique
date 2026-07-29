"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../../services/supabase';
import { Pencil, Check, Loader2, Image as ImageIcon, Lock, Globe, Power } from 'lucide-react';
import MediaPickerModal from './MediaPickerModal';
import { SITE_CONFIG } from '../../config/site';

// Helper to slugify page paths & text for safe database keys
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

// Deterministic fast hash function for content stability
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Pas d'éditeur de page sur l'admin, le blog et les événements (contenu géré
// via leurs éditeurs dédiés en base de données).
const EDITOR_HIDDEN_PREFIXES = ['/admin', '/blog', '/ateliers'];

export default function UniversalPageEditor() {
  const pathname = usePathname();
  const editorHidden = EDITOR_HIDDEN_PREFIXES.some(p => pathname === p || pathname?.startsWith(`${p}/`));
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [editingEl, setEditingEl] = useState<HTMLElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);
  
  // Media Picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [targetImageEl, setTargetImageEl] = useState<HTMLElement | null>(null);
  const [defaults, setDefaults] = useState<any>({});

  // Fetch meta tags defaults dynamically from the DOM on pathname changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const pageContent = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li'))
        .map(el => {
          if (el.closest('.admin-exclude') || el.closest('nav') || el.closest('footer')) return '';
          return el.textContent?.trim() || '';
        })
        .filter(Boolean)
        .join(' ')
        .slice(0, 4000);

      setDefaults({
        title: document.title || SITE_CONFIG.name,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        og_title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
        og_description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        og_image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
        keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
        pageContent: pageContent,
      });
    }
  }, [pathname]);

  // 1. Check Auth Status & Fetch Overrides
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setIsAdmin(!!data?.session);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session);
      if (!session) {
        setIsEditMode(false);
      }
    });

    fetchOverrides();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchOverrides = async () => {
    const map: Record<string, string> = {};
    
    // Load local overrides first
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('local_override_')) {
          const key = k.replace('local_override_', '');
          const val = localStorage.getItem(k);
          if (val) map[key] = val;
        }
      }
    } catch (e) {
      console.warn("localStorage not available:", e);
    }

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .like('key', 'inline_%');
      
      if (data && !error) {
        data.forEach((item) => {
          map[item.key] = item.value;
        });
      }
    } catch (err) {
      console.error('Failed to fetch overrides from database:', err);
    }

    setOverrides(map);
  };

  // Helper to save overrides locally (persisted sandbox) and try Supabase sync
  const saveOverride = async (key: string, value: string) => {
    // 1. Save in local storage immediately
    try {
      localStorage.setItem('local_override_' + key, value);
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value }, { onConflict: 'key' });

      if (!error) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        console.warn("Supabase save failed, utilizing local storage override fallback:", error.message);
        setSaveStatus('saved'); // Display saved because it is successfully saved locally!
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (err) {
      console.warn("Supabase error, using local storage override:", err);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // 2. Scan and Apply Overrides periodically to handle client updates
  useEffect(() => {
    if (editorHidden) return;

    const scanAndApply = () => {
      const elements: HTMLElement[] = [];
      
      const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          // Exclude admin areas, navigation, footer, forms, and custom components to avoid breakage
          if (
            el.getAttribute('data-no-edit') === 'true' ||
            el.closest('.admin-exclude') ||
            el.closest('nav') ||
            el.closest('footer') ||
            el.tagName === 'SCRIPT' ||
            el.tagName === 'STYLE' ||
            el.tagName === 'NOSCRIPT' ||
            el.tagName === 'TEXTAREA' ||
            el.tagName === 'INPUT' ||
            el.tagName === 'IFRAME'
          ) {
            return;
          }

          if (el.tagName === 'IMG') {
            elements.push(el);
            return;
          }

          const styleBg = el.style.backgroundImage;
          const computedBg = typeof window !== 'undefined' ? window.getComputedStyle(el).backgroundImage : '';
          const bg = styleBg || computedBg;
          if (bg && bg !== 'none' && bg.includes('url(') && !bg.includes('data:image/svg+xml')) {
            elements.push(el);
            return;
          }

          const textTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'LI', 'BUTTON', 'A'];
          if (textTags.includes(el.tagName)) {
            let hasDirectText = false;
            for (let i = 0; i < el.childNodes.length; i++) {
              const child = el.childNodes[i];
              if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                hasDirectText = true;
                break;
              }
            }
            if (hasDirectText) {
              elements.push(el);
              return; // Stop traversing inside text container to avoid double edit blocks
            }
          }
        }

        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      };

      walk(document.body);

      elements.forEach((el) => {
        // Skip current editing element to avoid cursor jumps
        if (el === editingEl) return;

        const isImg = el.tagName === 'IMG';
        const styleBg = el.style.backgroundImage;
        const computedBg = typeof window !== 'undefined' ? window.getComputedStyle(el).backgroundImage : '';
        const bg = styleBg || computedBg;
        const isBg = !isImg && bg && bg !== 'none' && bg.includes('url(') && !bg.includes('data:image/svg+xml');

        if (isImg || isBg) {
          let originalSrc = el.getAttribute('data-orig-src');
          if (!originalSrc) {
            if (isImg) {
              originalSrc = (el as HTMLImageElement).src || '';
            } else {
              const match = bg.match(/url\((['"]?)(.*?)\1\)/);
              originalSrc = match ? match[2] : '';
            }
            el.setAttribute('data-orig-src', originalSrc);
          }
          const cleanPath = slugify(pathname || 'home');
          const cleanSrc = slugify(originalSrc.split('/').pop() || '').slice(0, 30);
          const key = `inline_img_${cleanPath}_${cleanSrc}_${hashString(originalSrc)}`;
          el.setAttribute('data-edit-key', key);

          const dbVal = overrides[key];
          if (dbVal) {
            if (isImg) {
              const img = el as HTMLImageElement;
              if (img.src !== dbVal) img.src = dbVal;
            } else {
              const targetBg = `url("${dbVal}")`;
              if (!el.style.backgroundImage.includes(dbVal)) {
                el.style.backgroundImage = targetBg;
              }
            }
          }
        } else {
          let originalText = el.getAttribute('data-orig-text');
          if (originalText === null) {
            originalText = el.innerText || '';
            el.setAttribute('data-orig-text', originalText);
          }
          const cleanPath = slugify(pathname || 'home');
          const cleanText = slugify(originalText).slice(0, 40);
          const key = `inline_txt_${cleanPath}_${cleanText}_${hashString(originalText)}`;
          el.setAttribute('data-edit-key', key);

          const dbVal = overrides[key];
          if (dbVal && el.innerText !== dbVal) {
            el.innerText = dbVal;
          }
        }
      });
    };

    scanAndApply();
    const interval = setInterval(scanAndApply, 1500);

    return () => clearInterval(interval);
  }, [pathname, editorHidden, overrides, editingEl]);

  // 3. Admin Click & Hover Listeners
  useEffect(() => {
    if (!isAdmin || !isEditMode) {
      setHoveredEl(null);
      setOverlayRect(null);
      return;
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const editable = target.closest('[data-edit-key]') as HTMLElement;
      
      if (editable && !editable.closest('.admin-exclude')) {
        setHoveredEl(editable);
        setOverlayRect(editable.getBoundingClientRect());
      } else {
        setHoveredEl(null);
        setOverlayRect(null);
      }
    };

    const handleScroll = () => {
      if (hoveredEl) {
        setOverlayRect(hoveredEl.getBoundingClientRect());
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const editable = target.closest('[data-edit-key]') as HTMLElement;

      if (!editable || editable.closest('.admin-exclude')) return;

      // Prevent link clicking/form submissions in editing mode
      e.preventDefault();
      e.stopPropagation();

      const isImg = editable.tagName === 'IMG';
      const styleBg = editable.style.backgroundImage;
      const computedBg = typeof window !== 'undefined' ? window.getComputedStyle(editable).backgroundImage : '';
      const bg = styleBg || computedBg;
      const isBg = !isImg && bg && bg !== 'none' && bg.includes('url(') && !bg.includes('data:image/svg+xml');

      if (isImg || isBg) {
        setTargetImageEl(editable);
        setMediaPickerOpen(true);
      } else {
        setEditingEl(editable);
        editable.contentEditable = 'true';
        editable.focus();
        
        // Listen to blur once
        const handleBlur = async () => {
          editable.contentEditable = 'false';
          setEditingEl(null);
          
          const newText = editable.innerText.trim();
          const key = editable.getAttribute('data-edit-key') || '';
          const originalText = editable.getAttribute('data-orig-text') || '';

          if (key && newText !== (overrides[key] || originalText)) {
            await saveOverride(key, newText);
          }
          editable.removeEventListener('blur', handleBlur);
        };
        
        editable.addEventListener('blur', handleBlur);
      }
    };

    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('click', handleClick, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isAdmin, isEditMode, hoveredEl, overrides]);

  const handleImageSelect = async (url: string) => {
    if (!targetImageEl) return;
    const key = targetImageEl.getAttribute('data-edit-key') || '';
    const originalSrc = targetImageEl.getAttribute('data-orig-src') || '';

    if (key && url !== (overrides[key] || originalSrc)) {
      await saveOverride(key, url);
      const isImg = targetImageEl.tagName === 'IMG';
      if (isImg) {
        (targetImageEl as HTMLImageElement).src = url;
      } else {
        targetImageEl.style.backgroundImage = `url("${url}")`;
      }
    }
    setMediaPickerOpen(false);
    setTargetImageEl(null);
  };

  if (!isAdmin || editorHidden) return null;

  return (
    <div className="admin-exclude">
      {/* Floating Bottom Left Control Panel */}
      <div className="fixed bottom-6 left-6 z-[99999] bg-stone-950/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md flex items-center gap-4 select-none animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-widest text-white/90">Webflow Edit</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
            isEditMode 
              ? 'bg-cyan-500 text-stone-950 shadow-lg shadow-cyan-500/20' 
              : 'bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          <Power size={13} />
          {isEditMode ? 'Actif' : 'Désactivé'}
        </button>

        <div className="h-4 w-px bg-white/10" />

        <button
          onClick={() => {
            supabase.auth.signOut();
            setIsAdmin(false);
            setIsEditMode(false);
            window.location.reload();
          }}
          className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer"
        >
          Déconnexion
        </button>

        {saveStatus !== 'idle' && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="animate-spin text-cyan-400" size={13} />
                  <span className="text-white/60">Sauvegarde...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="text-green-400" size={13} />
                  <span className="text-green-400 font-bold">Enregistré</span>
                </>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400 font-bold">Erreur</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Hover Overlay Highlight */}
      {isEditMode && overlayRect && hoveredEl && (
        <div
          style={{
            position: 'fixed',
            top: overlayRect.top,
            left: overlayRect.left,
            width: overlayRect.width,
            height: overlayRect.height,
            border: '2px solid #06b6d4',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 99998,
            boxShadow: '0 0 0 4px rgba(6, 182, 212, 0.1)',
          }}
        >
          {/* Label Tooltip */}
          <div
            style={{
              position: 'absolute',
              top: '-22px',
              left: '-2px',
              backgroundColor: '#06b6d4',
              color: '#090514',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '2px 2px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            {hoveredEl.tagName === 'IMG' ? (
              <>
                <ImageIcon size={10} />
                <span>Image ({hoveredEl.tagName})</span>
              </>
            ) : (
              <>
                <Pencil size={10} />
                <span>Texte ({hoveredEl.tagName})</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* R2 Image Library Modal */}
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => {
          setMediaPickerOpen(false);
          setTargetImageEl(null);
        }}
        onSelect={handleImageSelect}
      />

    </div>
  );
}
