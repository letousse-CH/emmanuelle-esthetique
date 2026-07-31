"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Plus, Pencil, Trash2, X, Check, Loader2, AlertCircle, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useSettings } from '../../../../hooks/useSettings';
import {
  createService, deleteService, listServices, updateService,
} from '../../../../services/caisse';
import type { ServiceInput } from '../../../../services/caisse';
import { TAUX_TVA_CH, formatCHF } from '../../../../types/caisse';
import type { Service } from '../../../../types/caisse';

export default function PrestationsClient() {
  const settings = useSettings(['caisse_tva_assujetti', 'caisse_tva_taux_defaut']);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [editing, setEditing]   = useState<Service | 'new' | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setServices(await listServices(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (s: Service) => {
    if (!confirm(`Retirer « ${s.nom} » du catalogue ?\n\nLes factures déjà émises ne changent pas : le libellé et le prix y sont recopiés.`)) return;
    setBusyId(s.id);
    try {
      await deleteService(s.id);
      setServices(prev => prev.filter(x => x.id !== s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (s: Service) => {
    setBusyId(s.id);
    try {
      const updated = await updateService(s.id, { active: !s.active });
      setServices(prev => prev.map(x => (x.id === s.id ? updated : x)));
    } finally {
      setBusyId(null);
    }
  };

  /** Échange l'ordre avec le voisin — le catalogue de la caisse suit cet ordre. */
  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= services.length) return;
    const a = services[index];
    const b = services[target];
    setBusyId(a.id);
    try {
      await Promise.all([
        updateService(a.id, { ordre: target }),
        updateService(b.id, { ordre: index }),
      ]);
      const next = [...services];
      next[index] = { ...b, ordre: index };
      next[target] = { ...a, ordre: target };
      setServices(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réordonnancement impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <Sparkles size={20} className="text-sage" /> Prestations
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Le catalogue de l&apos;écran d&apos;encaissement. Les prix sont TTC.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all cursor-pointer shadow-sm self-start"
        >
          <Plus size={14} /> Nouvelle prestation
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : services.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-stone-400 text-sm italic">Le catalogue est vide.</p>
            <p className="text-stone-400 text-xs">
              Ajoute les soins proposés — ils apparaîtront en un clic sur l&apos;
              <Link href="/admin/caisse" className="text-sage hover:underline">écran d&apos;encaissement</Link>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-50">
            {services.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-3 px-5 py-4 hover:bg-stone-50/50 transition-colors group ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(i, -1)} disabled={i === 0 || busyId !== null}
                    aria-label="Monter" title="Monter"
                    className="p-0.5 text-stone-300 hover:text-stone-700 disabled:opacity-20 transition-colors cursor-pointer"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => move(i, 1)} disabled={i === services.length - 1 || busyId !== null}
                    aria-label="Descendre" title="Descendre"
                    className="p-0.5 text-stone-300 hover:text-stone-700 disabled:opacity-20 transition-colors cursor-pointer"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {s.nom}
                    {!s.active && <span className="ml-2 text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Masquée</span>}
                  </p>
                  {s.description && <p className="text-xs text-stone-400 truncate">{s.description}</p>}
                </div>

                {tvaActive && (
                  <span className="text-[11px] text-stone-400 tabular-nums shrink-0 hidden sm:block">
                    TVA {Number(s.taux_tva_defaut)} %
                  </span>
                )}
                <span className="text-sm font-medium text-stone-900 tabular-nums shrink-0">{formatCHF(s.prix_chf)}</span>

                <div className="flex items-center gap-1 shrink-0">
                  {busyId === s.id ? (
                    <Loader2 size={14} className="animate-spin text-stone-300 mx-2" />
                  ) : (
                    <>
                      <button
                        onClick={() => toggleActive(s)}
                        aria-label={s.active ? `Masquer ${s.nom}` : `Afficher ${s.nom}`}
                        title={s.active ? 'Masquer de la caisse' : 'Afficher dans la caisse'}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded transition-all cursor-pointer ${
                          s.active ? 'text-sage hover:bg-sage/10' : 'text-stone-400 hover:bg-stone-100'
                        }`}
                      >
                        {s.active ? 'Active' : 'Off'}
                      </button>
                      <button
                        onClick={() => setEditing(s)}
                        aria-label={`Modifier ${s.nom}`} title="Modifier"
                        className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-all cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        aria-label={`Supprimer ${s.nom}`} title="Supprimer"
                        className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <ServiceDialog
          service={editing === 'new' ? null : editing}
          nextOrder={services.length}
          tvaActive={tvaActive}
          tauxDefaut={tauxDefaut}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ServiceDialog({ service, nextOrder, tvaActive, tauxDefaut, onClose, onSaved }: {
  service: Service | null;
  nextOrder: number;
  tvaActive: boolean;
  tauxDefaut: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom]                 = useState(service?.nom ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [prix, setPrix]               = useState(service ? String(service.prix_chf) : '');
  const [taux, setTaux]               = useState(service ? Number(service.taux_tva_defaut) : tauxDefaut);
  const [active, setActive]           = useState(service?.active ?? true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prixNum = Number(prix.replace(',', '.'));
    if (!nom.trim() || !Number.isFinite(prixNum) || prixNum < 0) {
      setError('Renseigne un nom et un prix valide.');
      return;
    }
    setSaving(true); setError(null);
    const payload: ServiceInput = {
      nom: nom.trim(),
      description: description.trim() || null,
      prix_chf: Math.round(prixNum * 100) / 100,
      taux_tva_defaut: taux,
      active,
      ordre: service?.ordre ?? nextOrder,
    };
    try {
      if (service) await updateService(service.id, payload);
      else await createService(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={service ? 'Modifier la prestation' : 'Nouvelle prestation'}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">{service ? 'Modifier la prestation' : 'Nouvelle prestation'}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="svc-nom" className="block text-[11px] font-medium text-stone-500 mb-1">Nom *</label>
            <input
              id="svc-nom" type="text" value={nom} onChange={e => setNom(e.target.value)} required autoFocus
              placeholder="Soin du visage éclat — 60 min"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="svc-desc" className="block text-[11px] font-medium text-stone-500 mb-1">
              Description <span className="text-stone-300">(facultatif)</span>
            </label>
            <textarea
              id="svc-desc" rows={2} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="svc-prix" className="block text-[11px] font-medium text-stone-500 mb-1">Prix TTC (CHF) *</label>
              <input
                id="svc-prix" type="text" inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} required
                placeholder="120.00"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="svc-tva" className="block text-[11px] font-medium text-stone-500 mb-1">TVA par défaut</label>
              <select
                id="svc-tva" value={taux} onChange={e => setTaux(Number(e.target.value))}
                disabled={!tvaActive}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all disabled:bg-stone-50 disabled:text-stone-400 cursor-pointer"
              >
                {TAUX_TVA_CH.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {!tvaActive && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Active la TVA dans <Link href="/admin/settings" className="text-sage hover:underline">Paramètres → Caisse</Link>.
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <button
              type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${active ? 'bg-sage' : 'bg-stone-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-stone-600">Visible sur l&apos;écran d&apos;encaissement</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm hover:border-stone-300 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-sage transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
