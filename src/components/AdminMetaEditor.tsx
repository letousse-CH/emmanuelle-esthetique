"use client";

import React, { useState, useEffect } from 'react';
import { Tag, X, Save, Loader2, CheckCircle2, ChevronDown, ChevronUp, Sparkles, ImageIcon } from 'lucide-react';
import { supabase } from '../services/supabase';
import { settingsCache } from '../hooks/useSettings';
import MediaPickerModal from './pagebuilder/MediaPickerModal';

interface MetaFields {
  title: string;
  description: string;
  og_title: string;
  og_description: string;
  og_image: string;
  keywords: string;
  pageContent?: string;
}

interface Props {
  pageSlug: string;
  defaults: Partial<MetaFields>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type GenStatus = 'idle' | 'loading' | 'error';

export default function AdminMetaEditor({ pageSlug, defaults }: Props) {
  const [isAdmin, setIsAdmin]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const [genStatus, setGenStatus]     = useState<GenStatus>('idle');
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [fields, setFields]         = useState<MetaFields>({
    title:          defaults.title          ?? '',
    description:    defaults.description    ?? '',
    og_title:       defaults.og_title       ?? '',
    og_description: defaults.og_description ?? '',
    og_image:       defaults.og_image       ?? '',
    keywords:       defaults.keywords       ?? '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setIsAdmin(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setIsAdmin(!!s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Charge les valeurs sauvegardées depuis le cache / Supabase
  useEffect(() => {
    if (!isAdmin) return;
    const loadField = async (field: keyof MetaFields) => {
      const key = `seo_${pageSlug}_${field}`;
      const cached = settingsCache.get(key);
      if (cached !== undefined) {
        setFields(prev => ({ ...prev, [field]: cached }));
        return;
      }
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (data?.value) {
        settingsCache.set(key, data.value);
        setFields(prev => ({ ...prev, [field]: data.value }));
      }
    };
    (Object.keys(fields) as (keyof MetaFields)[]).forEach(loadField);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pageSlug]);

  const generate = async () => {
    setGenStatus('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'page',
          title: fields.title || defaults.title || '',
          content: defaults.pageContent || fields.description || defaults.description || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setFields(prev => ({
        ...prev,
        title:          data.title          || prev.title,
        description:    data.description    || prev.description,
        og_title:       data.og_title       || prev.og_title,
        og_description: data.og_description || prev.og_description,
        keywords:       data.keywords       || prev.keywords,
      }));
      setGenStatus('idle');
    } catch {
      setGenStatus('error');
      setTimeout(() => setGenStatus('idle'), 3000);
    }
  };

  const save = async () => {
    setSaveStatus('saving');
    try {
      const upserts = (Object.entries(fields) as [keyof MetaFields, string][])
        .filter(([, v]) => v.trim())
        .map(([field, value]) => ({ key: `seo_${pageSlug}_${field}`, value }));
      if (upserts.length) {
        const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
        if (error) throw error;
        upserts.forEach(({ key, value }) => settingsCache.set(key, value));
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-20 left-6 z-[9000] font-sans">
      {/* Bouton toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold hover:bg-sage transition-colors duration-200"
      >
        <Tag size={13} />
        SEO
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* Panneau */}
      {open && (
        <div className="absolute bottom-12 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
            <span className="text-xs font-bold uppercase tracking-widest text-stone-600">Méta-balises SEO</span>
            <button onClick={() => setOpen(false)} aria-label="Fermer le panneau SEO" className="text-stone-400 hover:text-stone-900 p-0.5">
              <X size={14} />
            </button>
          </div>

          <div className="px-4 pt-3 pb-0">
            <button
              onClick={generate}
              disabled={genStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sage to-wood text-white px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {genStatus === 'loading'
                ? <><Loader2 size={12} className="animate-spin" /> Génération en cours…</>
                : genStatus === 'error'
                ? <><Sparkles size={12} /> Erreur — réessayer</>
                : <><Sparkles size={12} /> Générer avec l'IA</>
              }
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <Field id="seo-meta-title" label="Title" value={fields.title} charLimit={60}
              onChange={v => setFields(p => ({ ...p, title: v }))} />
            <Field id="seo-meta-description" label="Meta description" value={fields.description} charLimit={160} multiline
              onChange={v => setFields(p => ({ ...p, description: v }))} />
            <Field id="seo-meta-og-title" label="OG Title" value={fields.og_title} charLimit={60}
              onChange={v => setFields(p => ({ ...p, og_title: v }))} />
            <Field id="seo-meta-og-description" label="OG Description" value={fields.og_description} charLimit={160} multiline
              onChange={v => setFields(p => ({ ...p, og_description: v }))} />
            <OgImageField
              id="seo-meta-og-image"
              value={fields.og_image}
              onChange={v => setFields(p => ({ ...p, og_image: v }))}
              onPickFromLibrary={() => setMediaPickerOpen(true)}
            />
            <Field id="seo-meta-keywords" label="Keywords" value={fields.keywords}
              onChange={v => setFields(p => ({ ...p, keywords: v }))} />
          </div>

          <MediaPickerModal
            isOpen={mediaPickerOpen}
            onClose={() => setMediaPickerOpen(false)}
            onSelect={url => { setFields(p => ({ ...p, og_image: url })); setMediaPickerOpen(false); }}
          />

          <div className="px-4 pb-4 pt-2 border-t border-stone-100 flex items-center justify-between">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={12} /> Sauvegardé</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500 text-xs">Erreur</span>
            )}
            {(saveStatus === 'idle' || saveStatus === 'saving') && <span />}
            <button
              onClick={save}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 bg-sage text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-wood transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OgImageField({ id, value, onChange, onPickFromLibrary }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onPickFromLibrary: () => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-widest text-stone-500">OG Image</label>
      </div>
      {value && (
        <div className="mb-1.5 rounded-lg overflow-hidden border border-stone-200 h-16 bg-stone-100">
          <img src={value} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          id={id}
          className="flex-1 text-xs border border-stone-200 bg-stone-50 rounded-lg px-2.5 py-2 outline-none focus:border-sage transition-colors"
          type="text"
          value={value}
          placeholder="https://…"
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={onPickFromLibrary}
          title="Choisir depuis la bibliothèque"
          aria-label="Choisir l'image OG depuis la bibliothèque"
          className="shrink-0 flex items-center gap-1 bg-stone-100 hover:bg-sage hover:text-white text-stone-600 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors"
        >
          <ImageIcon size={12} />
        </button>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, charLimit, multiline }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  charLimit?: number;
  multiline?: boolean;
}) {
  const over = charLimit && value.length > charLimit;
  const cls = `w-full text-xs border rounded-lg px-2.5 py-2 outline-none resize-none transition-colors ${
    over ? 'border-orange-400 bg-orange-50 focus:border-orange-500' : 'border-stone-200 bg-stone-50 focus:border-sage'
  }`;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
        {charLimit && (
          <span className={`text-[9px] font-mono ${over ? 'text-orange-500' : 'text-stone-400'}`}>
            {value.length}/{charLimit}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea id={id} className={cls} rows={3} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input id={id} className={cls} type="text" value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}
