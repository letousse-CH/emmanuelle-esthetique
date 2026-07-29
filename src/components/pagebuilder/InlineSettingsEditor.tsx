import React, { useState, useEffect } from 'react';
import { Pencil, X, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { SETTINGS_DEFAULTS } from '../../hooks/useSettings';
import type { FieldDef } from '../../data/pageFields';

interface Props {
  fields: FieldDef[];
  pageLabel: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function InlineSettingsEditor({ fields, pageLabel }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, SETTINGS_DEFAULTS[f.key] ?? '']))
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      setIsAdmin(true);
      // Charge les valeurs actuelles depuis la table settings
      const keys = fields.map((f) => f.key);
      supabase.from('settings').select('key, value').in('key', keys).then(({ data: rows }) => {
        if (rows) {
          const map: Record<string, string> = {};
          rows.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
          setValues(prev => ({ ...prev, ...map }));
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, [fields]);

  const save = async () => {
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
      if (rows.length === 0) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); return; }
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur inconnue');
      setSaveStatus('error');
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-bold hover:bg-sage transition-colors duration-300"
        >
          <Pencil size={15} /> Modifier {pageLabel}
        </button>
      )}

      <div className={`fixed top-16 right-0 bg-white border-l border-stone-200 shadow-2xl z-40 flex flex-col w-80 transition-transform duration-300`}
        style={{ bottom: 0, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
          <span className="font-bold text-stone-900 text-sm">{pageLabel}</span>
          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={13} /> Sauvegardé</span>}
            {saveStatus === 'error' && <span className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle size={13} /> {errorMsg}</span>}
            <button
              onClick={save}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 bg-sage text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-wood transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Sauvegarder
            </button>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-900 p-1"><X size={16} /></button>
          </div>
        </div>

        {/* Champs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">
                {field.label}
              </label>
              {field.hint && <p className="text-[10px] text-stone-400 italic mb-1">{field.hint}</p>}
              <textarea
                rows={field.rows ?? 2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sage resize-none"
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
