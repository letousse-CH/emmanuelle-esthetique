"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, CheckCircle2, AlertCircle, ArrowLeft, FolderOpen, Link2, FolderPlus } from 'lucide-react';
import { supabase } from '../../../services/supabase';

interface MenuItem { name: string; path?: string; type?: 'link' | 'dropdown'; children?: { name: string; path: string }[]; }

export default function MenuClient() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [status, setStatus]       = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('settings').select('key, value').eq('key', 'navigation_menu').single();
        if (error) { if (error.code === 'PGRST116') loadDefaults(); else throw error; }
        else if (data?.value) setMenuItems(JSON.parse(data.value));
      } catch (err) { console.error(err); setErrorMsg('Impossible de charger le menu.'); setStatus('error'); loadDefaults(); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadDefaults = () => setMenuItems([
    { name: "Accueil", path: "/" }, { name: "Ateliers", path: "/ateliers" }, { name: "Blog", path: "/blog" }, { name: "À Propos", path: "/about" },
    { name: "Livres", type: "dropdown", children: [{ name: "Paroles & Silences", path: "/paroles-et-silences" }, { name: "Si les arbres pouvaient parler…", path: "/si-les-arbres-pouvaient-parler" }] },
    { name: "Services", type: "dropdown", children: [{ name: "Séance Individuelle", path: "/seance-individuelle" }, { name: "Programme Complet", path: "/programme-complet" }, { name: "Rêve Éveillé Libre", path: "/reve-eveille-libre" }] },
    { name: "Contact", path: "/contact" }
  ]);

  const moveItem = (i: number, d: -1 | 1) => { const n = [...menuItems]; if (i + d < 0 || i + d >= n.length) return; [n[i], n[i + d]] = [n[i + d], n[i]]; setMenuItems(n); };
  const deleteItem = (i: number) => { if (!confirm('Supprimer ce lien ?')) return; setMenuItems(prev => prev.filter((_, j) => j !== i)); };
  const addLink = () => setMenuItems(prev => [...prev, { name: "Nouveau lien", path: "/nouveau-slug" }]);
  const addDropdown = () => setMenuItems(prev => [...prev, { name: "Nouveau Menu", type: "dropdown", children: [] }]);
  const updateItem = (i: number, k: keyof MenuItem, v: any) => setMenuItems(prev => { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; });
  const moveSubItem = (ii: number, si: number, d: -1 | 1) => { const ch = [...(menuItems[ii].children || [])]; if (si + d < 0 || si + d >= ch.length) return; [ch[si], ch[si + d]] = [ch[si + d], ch[si]]; updateItem(ii, 'children', ch); };
  const addSubItem = (ii: number) => updateItem(ii, 'children', [...(menuItems[ii].children || []), { name: "Sous-lien", path: "/" }]);
  const deleteSubItem = (ii: number, si: number) => updateItem(ii, 'children', menuItems[ii].children?.filter((_, j) => j !== si));
  const updateSubItem = (ii: number, si: number, k: 'name' | 'path', v: string) => { const ch = [...(menuItems[ii].children || [])]; ch[si] = { ...ch[si], [k]: v }; updateItem(ii, 'children', ch); };

  const save = async () => {
    setSaving(true); setStatus('idle'); setErrorMsg('');
    try {
      const { error } = await supabase.from('settings').upsert({ key: 'navigation_menu', value: JSON.stringify(menuItems) }, { onConflict: 'key' });
      if (error) throw error;
      setStatus('success'); setTimeout(() => setStatus('idle'), 3000);
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau.'); setStatus('error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-stone-400 hover:text-stone-700 text-xs font-medium mb-2 cursor-pointer transition-colors">
            <ArrowLeft size={13} /> Retour
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Site</p>
          <h1 className="text-2xl font-semibold text-stone-900">Menu de navigation</h1>
          <p className="text-stone-400 text-sm mt-1">Gérez l'ordre, les noms et les liens du menu principal.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {status === 'success' && <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 size={14} /> Enregistré</span>}
          {status === 'error' && <span className="flex items-center gap-1.5 text-red-500 text-sm font-medium"><AlertCircle size={14} /> {errorMsg}</span>}
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-2 bg-sage hover:bg-sage/80 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer shadow-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Sauvegarder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-sage animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {menuItems.length === 0 ? (
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm text-center py-16">
              <p className="text-stone-400 text-lg mb-1">Menu vide</p>
              <p className="text-stone-400 text-sm">Ajoutez des liens ci-dessous.</p>
            </div>
          ) : menuItems.map((item, idx) => {
            const isDropdown = item.type === 'dropdown';
            return (
              <div key={idx} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${isDropdown ? 'border-sage/20' : 'border-stone-100'}`}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${isDropdown ? 'bg-sage/10 text-sage' : 'bg-stone-100 text-stone-400'}`}>
                      {isDropdown ? <FolderOpen size={15} /> : <Link2 size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`menu-name-${idx}`} className="block text-[9px] font-semibold uppercase tracking-widest text-stone-400 mb-0.5">Nom</label>
                      <input id={`menu-name-${idx}`} type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                        className="text-stone-900 font-medium text-base bg-transparent focus:outline-none border-b border-transparent focus:border-sage/40 w-full max-w-[200px] transition-colors" />
                    </div>
                  </div>
                  {!isDropdown ? (
                    <div className="flex-1 min-w-0 max-w-md sm:mx-4">
                      <label htmlFor={`menu-path-${idx}`} className="block text-[9px] font-semibold uppercase tracking-widest text-stone-400 mb-0.5">URL</label>
                      <input id={`menu-path-${idx}`} type="text" value={item.path} onChange={e => updateItem(idx, 'path', e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm font-mono text-stone-600 focus:outline-none focus:ring-1 focus:ring-sage/30 transition-colors" />
                    </div>
                  ) : (
                    <div className="flex-1 sm:mx-4 flex items-center justify-end">
                      <button onClick={() => addSubItem(idx)}
                        className="flex items-center gap-1.5 bg-sage/10 hover:bg-sage/20 text-sage px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer">
                        <Plus size={11} /> Ajouter un sous-lien
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label={`Monter « ${item.name} »`} title="Monter" className="p-1.5 hover:bg-stone-100 text-stone-300 hover:text-stone-700 rounded-lg disabled:opacity-20 transition-colors cursor-pointer"><ChevronUp size={14} /></button>
                    <button onClick={() => moveItem(idx, 1)} disabled={idx === menuItems.length - 1} aria-label={`Descendre « ${item.name} »`} title="Descendre" className="p-1.5 hover:bg-stone-100 text-stone-300 hover:text-stone-700 rounded-lg disabled:opacity-20 transition-colors cursor-pointer"><ChevronDown size={14} /></button>
                    <button onClick={() => deleteItem(idx)} aria-label={`Supprimer « ${item.name} »`} title="Supprimer" className="p-1.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-lg transition-colors cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isDropdown && (
                  <div className="mt-4 pl-4 border-l-2 border-stone-100 space-y-2">
                    {(!item.children || item.children.length === 0) ? (
                      <p className="text-xs italic text-stone-400 py-1">Aucun sous-lien.</p>
                    ) : item.children.map((child, subIdx) => (
                      <div key={subIdx} className="bg-stone-50 rounded-xl border border-stone-100 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="min-w-0 sm:w-1/3">
                          <label htmlFor={`menu-sub-name-${idx}-${subIdx}`} className="block text-[8px] font-semibold uppercase tracking-widest text-stone-400 mb-0.5">Titre</label>
                          <input id={`menu-sub-name-${idx}-${subIdx}`} type="text" value={child.name} onChange={e => updateSubItem(idx, subIdx, 'name', e.target.value)}
                            className="w-full bg-transparent font-medium text-stone-800 text-sm focus:outline-none border-b border-transparent focus:border-sage/40 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label htmlFor={`menu-sub-path-${idx}-${subIdx}`} className="block text-[8px] font-semibold uppercase tracking-widest text-stone-400 mb-0.5">URL</label>
                          <input id={`menu-sub-path-${idx}-${subIdx}`} type="text" value={child.path} onChange={e => updateSubItem(idx, subIdx, 'path', e.target.value)}
                            className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-mono text-stone-600 focus:outline-none focus:ring-1 focus:ring-sage/30 transition-colors" />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => moveSubItem(idx, subIdx, -1)} disabled={subIdx === 0} aria-label={`Monter « ${child.name} »`} title="Monter" className="p-1 hover:bg-stone-200 text-stone-300 hover:text-stone-700 rounded disabled:opacity-20 cursor-pointer transition-colors"><ChevronUp size={12} /></button>
                          <button onClick={() => moveSubItem(idx, subIdx, 1)} disabled={subIdx === (item.children?.length || 0) - 1} aria-label={`Descendre « ${child.name} »`} title="Descendre" className="p-1 hover:bg-stone-200 text-stone-300 hover:text-stone-700 rounded disabled:opacity-20 cursor-pointer transition-colors"><ChevronDown size={12} /></button>
                          <button onClick={() => deleteSubItem(idx, subIdx)} aria-label={`Supprimer « ${child.name} »`} title="Supprimer" className="p-1 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded cursor-pointer transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={addLink} className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 hover:border-sage hover:text-sage text-stone-400 rounded-2xl py-4 text-sm transition-all cursor-pointer bg-white">
              <Plus size={14} /> Ajouter un lien de menu
            </button>
            <button onClick={addDropdown} className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 hover:border-sage hover:text-sage text-stone-400 rounded-2xl py-4 text-sm transition-all cursor-pointer bg-white">
              <FolderPlus size={14} /> Créer un menu déroulant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
