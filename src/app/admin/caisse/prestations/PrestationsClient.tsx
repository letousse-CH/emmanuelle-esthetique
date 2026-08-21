"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Plus, Pencil, Trash2, X, Check, Loader2, AlertCircle, ArrowUp, ArrowDown,
  Layers, FolderCog, GripVertical,
} from 'lucide-react';
import { useSettings } from '../../../../hooks/useSettings';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import {
  createService, createServiceCategory, deleteService, deleteServiceCategory,
  listAllForfaitItems, listServiceCategories, listServices, setForfaitItems,
  updateService, updateServiceCategory,
} from '../../../../services/caisse';
import type { ServiceInput } from '../../../../services/caisse';
import {
  TAUX_TVA_CH, forfaitEconomie, forfaitValeurCumulee, formatCHF,
} from '../../../../types/caisse';
import type { ForfaitItem, Service, ServiceCategory, ServiceType } from '../../../../types/caisse';

/** Groupe affiché : une catégorie, ou le fourre-tout des prestations sans rangement. */
interface Group {
  id: string | null;
  nom: string;
  items: Service[];
}

export default function PrestationsClient() {
  const settings = useSettings(['caisse_tva_assujetti', 'caisse_tva_taux_defaut']);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);

  const [services, setServices]     = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [composition, setComposition] = useState<ForfaitItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [editing, setEditing]   = useState<{ service: Service | null; type: ServiceType } | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [busyId, setBusyId]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      // Le catalogue reste gérable même si la migration des catégories et des
      // forfaits n'a pas encore été appliquée : tout retombe alors dans « Sans
      // catégorie ». Perdre le rangement est acceptable, perdre l'accès aux
      // prestations ne l'est pas.
      const s = await listServices(true);
      setServices(s);

      const [c, f] = await Promise.all([
        listServiceCategories().catch(() => [] as ServiceCategory[]),
        listAllForfaitItems().catch(() => [] as ForfaitItem[]),
      ]);
      setCategories(c); setComposition(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  // Composition de chaque forfait, prestations rattachées. La jointure se fait
  // ici et non côté Postgres : deux clés étrangères de `service_forfait_items`
  // pointent vers `services`, et le catalogue est déjà chargé en entier.
  const compositions = useMemo(() => {
    const byId = new Map(services.map(s => [s.id, s]));
    const map = new Map<string, ForfaitItem[]>();
    for (const it of composition) {
      const arr = map.get(it.forfait_id) ?? [];
      arr.push({ ...it, service: byId.get(it.service_id) ?? null });
      map.set(it.forfait_id, arr);
    }
    return map;
  }, [composition, services]);

  const groups = useMemo<Group[]>(() => {
    const byCat = new Map<string, Service[]>();
    for (const c of categories) byCat.set(c.id, []);
    const orphans: Service[] = [];
    for (const s of services) {
      const bucket = s.category_id ? byCat.get(s.category_id) : undefined;
      (bucket ?? orphans).push(s);
    }
    const list: Group[] = categories.map(c => ({ id: c.id, nom: c.nom, items: byCat.get(c.id)! }));
    if (orphans.length > 0) list.push({ id: null, nom: 'Sans catégorie', items: orphans });
    return list;
  }, [services, categories]);

  const handleDelete = async (s: Service) => {
    const quoi = s.type === 'forfait' ? 'le forfait' : 'la prestation';
    if (!confirm(`Retirer ${quoi} « ${s.nom} » du catalogue ?\n\nLes factures déjà émises ne changent pas : le libellé et le prix y sont recopiés.`)) return;
    setBusyId(s.id);
    try {
      await deleteService(s.id);
      setServices(prev => prev.filter(x => x.id !== s.id));
      setComposition(prev => prev.filter(x => x.forfait_id !== s.id));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Réordonne à l'intérieur d'une catégorie. On renumérote tout le groupe
   * plutôt que d'échanger deux valeurs : deux prestations créées le même jour
   * peuvent partager le même `ordre`, et l'échange serait alors sans effet.
   */
  const move = async (group: Group, index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= group.items.length) return;
    const next = [...group.items];
    [next[index], next[target]] = [next[target], next[index]];

    setBusyId(group.items[index].id);
    try {
      await Promise.all(next.map((s, i) => updateService(s.id, { ordre: i })));
      const renumbered = new Map(next.map((s, i) => [s.id, i]));
      setServices(prev => [...prev]
        .map(s => (renumbered.has(s.id) ? { ...s, ordre: renumbered.get(s.id)! } : s))
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr')));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réordonnancement impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const prestations = useMemo(() => services.filter(s => s.type !== 'forfait'), [services]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <Sparkles size={20} className="text-sage" /> Prestations
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Le catalogue de l&apos;écran d&apos;encaissement. Les prix sont TTC.
          </p>
          <div className="mt-3"><CaisseCatalogNav /></div>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            onClick={() => setShowCategories(true)}
            className="flex items-center gap-2 px-3.5 py-2 border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 rounded-lg text-sm transition-all cursor-pointer"
          >
            <FolderCog size={14} /> Catégories
          </button>
          <button
            onClick={() => setEditing({ service: null, type: 'forfait' })}
            className="flex items-center gap-2 px-3.5 py-2 border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 rounded-lg text-sm transition-all cursor-pointer"
          >
            <Layers size={14} /> Nouveau forfait
          </button>
          <button
            onClick={() => setEditing({ service: null, type: 'prestation' })}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all cursor-pointer shadow-sm"
          >
            <Plus size={14} /> Nouvelle prestation
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Masquer l'erreur" className="shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] flex items-center justify-center gap-2 p-8 text-stone-500 text-sm">
          <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-10 text-center space-y-2">
          <p className="text-sm text-stone-600">Le catalogue est vide.</p>
          <p className="text-stone-500 text-xs">
            Ajoute les soins proposés — ils apparaîtront en un clic sur l&apos;
            <Link href="/admin/caisse" className="text-sage hover:underline">écran d&apos;encaissement</Link>,
            rangés par catégorie.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <section key={group.id ?? 'orphans'} className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <h2 className="text-[13px] font-medium text-stone-800">{group.nom}</h2>
                <span className="text-[12.5px] text-stone-500 tabular-nums">
                  {group.items.length} {group.items.length > 1 ? 'entrées' : 'entrée'}
                </span>
              </div>

              {group.items.length === 0 ? (
                <p className="px-5 py-6 text-center text-stone-500 text-xs italic">
                  Aucune prestation dans cette catégorie.
                </p>
              ) : (
                <ul className="divide-y divide-stone-50">
                  {group.items.map((s, i) => {
                    const items = compositions.get(s.id) ?? [];
                    const economie = s.type === 'forfait' ? forfaitEconomie(Number(s.prix_chf), items) : 0;
                    return (
                      <li
                        key={s.id}
                        className={`flex items-center gap-3 px-5 py-4 hover:bg-stone-50/50 transition-colors ${!s.active ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col shrink-0">
                          <button
                            onClick={() => move(group, i, -1)} disabled={i === 0 || busyId !== null}
                            aria-label="Monter" title="Monter"
                            className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 transition-colors cursor-pointer"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => move(group, i, 1)} disabled={i === group.items.length - 1 || busyId !== null}
                            aria-label="Descendre" title="Descendre"
                            className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 transition-colors cursor-pointer"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{s.nom}</span>
                            {s.type === 'forfait' && (
                              <span className="text-[12px] font-semibold text-sage bg-sage/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Layers size={9} /> Forfait
                              </span>
                            )}
                            {!s.active && <span className="text-[12px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">Masquée</span>}
                          </p>
                          {s.type === 'forfait' ? (
                            <p className="truncate text-[12.5px] text-stone-500">
                              {items.length === 0
                                ? 'Composition à définir'
                                : items.map(it => `${Number(it.quantite) > 1 ? `${Number(it.quantite)}× ` : ''}${it.service?.nom ?? '—'}`).join(' + ')}
                              {economie > 0 && (
                                <span className="text-sage font-medium"> · −{formatCHF(economie)}</span>
                              )}
                            </p>
                          ) : (
                            s.description && <p className="truncate text-[12.5px] text-stone-500">{s.description}</p>
                          )}
                        </div>

                        {tvaActive && (
                          <span className="text-[12.5px] text-stone-500 tabular-nums shrink-0 hidden sm:block">
                            TVA {Number(s.taux_tva_defaut)} %
                          </span>
                        )}
                        <span className="text-sm font-medium text-stone-900 tabular-nums shrink-0">{formatCHF(s.prix_chf)}</span>

                        <div className="flex items-center gap-1 shrink-0">
                          {busyId === s.id ? (
                            <Loader2 size={14} className="animate-spin text-stone-400 mx-2" />
                          ) : (
                            <>
                              <button
                                onClick={() => toggleActive(s)}
                                aria-label={s.active ? `Masquer ${s.nom}` : `Afficher ${s.nom}`}
                                title={s.active ? 'Masquer de la caisse' : 'Afficher dans la caisse'}
                                className={`text-[12px] font-semibold px-2 py-1 rounded transition-all cursor-pointer ${
                                  s.active ? 'text-sage hover:bg-sage/10' : 'text-stone-500 hover:bg-stone-100'
                                }`}
                              >
                                {s.active ? 'Active' : 'Off'}
                              </button>
                              <button
                                onClick={() => setEditing({ service: s, type: s.type })}
                                aria-label={`Modifier ${s.nom}`} title="Modifier"
                                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                aria-label={`Supprimer ${s.nom}`} title="Supprimer"
                                className="p-1.5 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {editing && (
        <ServiceDialog
          service={editing.service}
          type={editing.type}
          categories={categories}
          prestations={prestations}
          initialComposition={editing.service ? (compositions.get(editing.service.id) ?? []) : []}
          nextOrder={services.length}
          tvaActive={tvaActive}
          tauxDefaut={tauxDefaut}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {showCategories && (
        <CategoriesDialog
          categories={categories}
          services={services}
          onClose={() => setShowCategories(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ── Prestation / forfait ────────────────────────────────────────────────────

function ServiceDialog({
  service, type, categories, prestations, initialComposition, nextOrder, tvaActive, tauxDefaut, onClose, onSaved,
}: {
  service: Service | null;
  type: ServiceType;
  categories: ServiceCategory[];
  prestations: Service[];
  initialComposition: ForfaitItem[];
  nextOrder: number;
  tvaActive: boolean;
  tauxDefaut: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isForfait = type === 'forfait';

  const [nom, setNom]                 = useState(service?.nom ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [prix, setPrix]               = useState(service ? String(service.prix_chf) : '');
  const [taux, setTaux]               = useState(service ? Number(service.taux_tva_defaut) : tauxDefaut);
  const [categoryId, setCategoryId]   = useState(service?.category_id ?? '');
  const [active, setActive]           = useState(service?.active ?? true);
  const [parts, setParts]             = useState<{ service_id: string; quantite: number }[]>(
    initialComposition.map(it => ({ service_id: it.service_id, quantite: Number(it.quantite) })),
  );
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Valeur du forfait vendu prestation par prestation, pour afficher l'économie
  // pendant la saisie — c'est l'argument de vente, autant qu'il soit sous les yeux.
  const partsDetail = useMemo<ForfaitItem[]>(() => {
    const byId = new Map(prestations.map(s => [s.id, s]));
    return parts.map((p, i) => ({
      id: `${p.service_id}-${i}`, forfait_id: '', service_id: p.service_id,
      quantite: p.quantite, ordre: i, created_at: '',
      service: byId.get(p.service_id) ?? null,
    }));
  }, [parts, prestations]);

  const valeurCumulee = forfaitValeurCumulee(partsDetail);
  const prixNum = Number(String(prix).replace(',', '.'));
  const economie = Number.isFinite(prixNum) ? valeurCumulee - prixNum : 0;

  const addPart = (id: string) => {
    if (!id || parts.some(p => p.service_id === id)) return;
    setParts(prev => [...prev, { service_id: id, quantite: 1 }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !Number.isFinite(prixNum) || prixNum < 0) {
      setError('Renseigne un nom et un prix valide.');
      return;
    }
    if (isForfait && parts.length === 0) {
      setError('Un forfait doit contenir au moins une prestation.');
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
      category_id: categoryId || null,
      type,
    };
    try {
      const saved = service
        ? await updateService(service.id, payload)
        : await createService(payload);
      if (isForfait) await setForfaitItems(saved.id, parts);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  };

  const titre = service
    ? (isForfait ? 'Modifier le forfait' : 'Modifier la prestation')
    : (isForfait ? 'Nouveau forfait' : 'Nouvelle prestation');

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={titre}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            {isForfait && <Layers size={14} className="text-sage" />} {titre}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="svc-nom" className="block text-[12.5px] font-medium text-stone-700 mb-1">Nom *</label>
            <input
              id="svc-nom" type="text" value={nom} onChange={e => setNom(e.target.value)} required autoFocus
              placeholder={isForfait ? 'Forfait jambes + maillot + aisselles' : 'Soin du visage éclat — 60 min'}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="svc-cat" className="block text-[12.5px] font-medium text-stone-700 mb-1">Catégorie</label>
            <select
              id="svc-cat" value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors cursor-pointer"
            >
              <option value="">Sans catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          {isForfait && (
            <div className="rounded-xl border border-stone-200 p-3.5 space-y-3 bg-stone-50/40">
              <div>
                <p className="text-[11px] font-medium text-stone-500 mb-1">Composition *</p>
                <p className="text-[12px] text-stone-500 leading-relaxed mb-2">
                  Les prestations couvertes par le forfait. Elles servent à afficher l&apos;économie —
                  la facture, elle, portera une seule ligne au prix du forfait.
                </p>
              </div>

              {parts.length > 0 && (
                <ul className="space-y-1.5">
                  {partsDetail.map((it, i) => (
                    <li key={`${it.service_id}-${i}`} className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5">
                      <GripVertical size={12} className="text-stone-200 shrink-0" />
                      <span className="flex-1 min-w-0 text-xs text-stone-700 truncate">{it.service?.nom ?? 'Prestation supprimée'}</span>
                      <label className="sr-only" htmlFor={`part-qte-${i}`}>Quantité</label>
                      <input
                        id={`part-qte-${i}`}
                        type="number" min={1} step={1} value={parts[i].quantite}
                        onChange={e => setParts(prev => prev.map((p, j) =>
                          (j === i ? { ...p, quantite: Math.max(1, Number(e.target.value) || 1) } : p)))}
                        className="w-14 px-2 py-1 border border-stone-200 rounded text-xs text-stone-700 text-center tabular-nums focus:border-stone-900 outline-none"
                      />
                      <span className="text-[12.5px] text-stone-500 tabular-nums shrink-0 w-20 text-right">
                        {formatCHF(Number(it.service?.prix_chf ?? 0) * Number(it.quantite))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setParts(prev => prev.filter((_, j) => j !== i))}
                        aria-label={`Retirer ${it.service?.nom ?? 'la prestation'}`}
                        className="shrink-0 p-1 text-stone-500 hover:text-red-700 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <label htmlFor="svc-part-add" className="sr-only">Ajouter une prestation au forfait</label>
                <select
                  id="svc-part-add" value="" onChange={e => addPart(e.target.value)}
                  className="w-full px-3 py-2 border border-dashed border-stone-300 rounded-lg text-xs text-stone-600 bg-white focus:border-stone-900 outline-none cursor-pointer"
                >
                  <option value="">+ Ajouter une prestation…</option>
                  {prestations
                    .filter(s => s.id !== service?.id && !parts.some(p => p.service_id === s.id))
                    .map(s => <option key={s.id} value={s.id}>{s.nom} — {formatCHF(s.prix_chf)}</option>)}
                </select>
              </div>

              {parts.length > 0 && (
                <dl className="text-xs space-y-1 pt-1 border-t border-stone-200">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Valeur cumulée</dt>
                    <dd className="text-stone-600 tabular-nums">{formatCHF(valeurCumulee)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Économie pour la cliente</dt>
                    <dd className={`tabular-nums font-medium ${economie >= 0 ? 'text-sage' : 'text-amber-600'}`}>
                      {economie >= 0 ? `− ${formatCHF(economie)}` : `+ ${formatCHF(-economie)}`}
                    </dd>
                  </div>
                  {economie < 0 && (
                    <p className="text-[12px] text-amber-600 leading-relaxed pt-0.5">
                      Le forfait coûte plus cher que ses prestations prises séparément.
                    </p>
                  )}
                </dl>
              )}
            </div>
          )}

          <div>
            <label htmlFor="svc-desc" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Description <span className="text-stone-500">(facultatif)</span>
            </label>
            <textarea
              id="svc-desc" rows={2} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="svc-prix" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                {isForfait ? 'Prix du forfait TTC *' : 'Prix TTC (CHF) *'}
              </label>
              <input
                id="svc-prix" type="text" inputMode="decimal" value={prix} onChange={e => setPrix(e.target.value)} required
                placeholder="120.00"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="svc-tva" className="block text-[12.5px] font-medium text-stone-700 mb-1">TVA par défaut</label>
              <select
                id="svc-tva" value={taux} onChange={e => setTaux(Number(e.target.value))}
                disabled={!tvaActive}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors disabled:bg-stone-50 disabled:text-stone-500 cursor-pointer"
              >
                {TAUX_TVA_CH.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {!tvaActive && (
                <p className="text-[12px] text-stone-500 mt-1">
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
              className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-stone-700 transition-colors disabled:opacity-40 cursor-pointer"
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

// ── Catégories ──────────────────────────────────────────────────────────────

function CategoriesDialog({ categories, services, onClose, onChanged }: {
  categories: ServiceCategory[];
  services: Service[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows]   = useState(categories);
  const [nouveau, setNouveau] = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of services) {
      if (s.category_id) map.set(s.category_id, (map.get(s.category_id) ?? 0) + 1);
    }
    return map;
  }, [services]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = nouveau.trim();
    if (!nom) return;
    await run(async () => {
      const created = await createServiceCategory({ nom, ordre: rows.length, active: true });
      setRows(prev => [...prev, created]);
      setNouveau('');
    });
  };

  const rename = async (c: ServiceCategory, nom: string) => {
    if (!nom.trim() || nom.trim() === c.nom) return;
    await run(async () => {
      const updated = await updateServiceCategory(c.id, { nom: nom.trim() });
      setRows(prev => prev.map(x => (x.id === c.id ? updated : x)));
    });
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next.map((c, i) => ({ ...c, ordre: i })));
    await run(() => Promise.all(next.map((c, i) => updateServiceCategory(c.id, { ordre: i }))));
  };

  const remove = async (c: ServiceCategory) => {
    const n = counts.get(c.id) ?? 0;
    const suite = n > 0
      ? `\n\nLes ${n} entrée${n > 1 ? 's' : ''} qu'elle range passeront en « Sans catégorie ». Rien n'est supprimé.`
      : '';
    if (!confirm(`Supprimer la catégorie « ${c.nom} » ?${suite}`)) return;
    await run(async () => {
      await deleteServiceCategory(c.id);
      setRows(prev => prev.filter(x => x.id !== c.id));
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Catégories de prestations"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <FolderCog size={14} className="text-sage" /> Catégories
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <p className="text-[12.5px] text-stone-500 leading-relaxed">
          Elles rangent le catalogue et deviennent les onglets de l&apos;écran d&apos;encaissement.
          Elles ne figurent sur aucune facture.
        </p>

        {rows.length > 0 && (
          <ul className="space-y-1.5">
            {rows.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(i, -1)} disabled={i === 0 || busy}
                    aria-label={`Monter ${c.nom}`}
                    className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy}
                    aria-label={`Descendre ${c.nom}`}
                    className="p-0.5 text-stone-500 hover:text-stone-900 disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
                <label className="sr-only" htmlFor={`cat-${c.id}`}>Nom de la catégorie</label>
                <input
                  id={`cat-${c.id}`}
                  defaultValue={c.nom}
                  onBlur={e => rename(c, e.target.value)}
                  disabled={busy}
                  className="flex-1 min-w-0 px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
                />
                <span className="text-[12px] text-stone-500 tabular-nums w-6 text-right shrink-0">
                  {counts.get(c.id) ?? 0}
                </span>
                <button
                  onClick={() => remove(c)} disabled={busy}
                  aria-label={`Supprimer ${c.nom}`}
                  className="shrink-0 p-1.5 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="cat-new" className="sr-only">Nouvelle catégorie</label>
          <input
            id="cat-new" type="text" value={nouveau} onChange={e => setNouveau(e.target.value)}
            placeholder="Épilation, Maquillage…" disabled={busy}
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
          />
          <button
            type="submit" disabled={busy || !nouveau.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 text-sm transition-all disabled:opacity-40 cursor-pointer"
          >
            <Plus size={14} /> Ajouter
          </button>
        </form>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}
