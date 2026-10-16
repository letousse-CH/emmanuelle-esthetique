"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Package, Plus, Pencil, Trash2, X, Check, Loader2, ArrowUp, ArrowDown,
  ArrowDownUp, ClipboardCheck, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { useSettings } from '../../../../hooks/useSettings';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { AnimatedNumber, Button, Callout, Metric, MetricStrip } from '../../../../components/admin/ui';
import {
  createProduct, deleteOrArchiveProduct, listProducts, listStockMovements,
  stockInventaire, stockMovement, updateProduct,
} from '../../../../services/caisse';
import type { ProductInput } from '../../../../services/caisse';
import { PRODUCT_USAGE_LABELS } from '../../../../types/finance';
import { listFacturesAchat } from '../../../../services/financeService';
import FactureAchatSelect, { type FactureAchatOption } from './FactureAchatSelect';
import type { ProductUsageType } from '../../../../types/finance';
import ReclassementCallout from './ReclassementCallout';
import {
  STOCK_MOVEMENTS_MANUELS, STOCK_MOVEMENT_LABELS, TAUX_TVA_CH,
  coutAchat, formatAmount, formatCHF, isVenteProduct, margeCHF, margePct, stockLevel,
} from '../../../../types/caisse';
import type { Product, StockMovement } from '../../../../types/caisse';

const qte = (n: number | string) => {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : formatAmount(v);
};

export default function ProduitsClient() {
  const settings = useSettings(['caisse_tva_assujetti', 'caisse_tva_taux_defaut']);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);

  const [products, setProducts] = useState<Product[]>([]);
  // Tous les produits, cabine compris : le rapprochement avec les factures en a besoin.
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);
  const [editing, setEditing]   = useState<Product | 'new' | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const all = await listProducts(true);
      setAllProducts(all);
      setProducts(all.filter(isVenteProduct));
    } catch (err) {
      setError(`La liste des produits n'a pas pu être chargée${err instanceof Error ? ` (${err.message})` : ''}.`);
    } finally {
      setLoading(false);
    }
  };

  const replace = (p: Product) => setProducts(prev => prev.map(x => (x.id === p.id ? p : x)));

  // Valeur du stock au coût d'achat (TVA non récupérable comprise) — c'est ce
  // chiffre qui figure à l'actif du bilan, jamais la valeur au prix de vente
  // (elle anticiperait une marge non encore réalisée).
  const stats = useMemo(() => {
    const actifs = products.filter(p => p.active);
    const valeurAchat = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * coutAchat(p, tvaActive), 0);
    const caPotentiel = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * Number(p.prix_vente_chf || 0), 0);
    const margePotentielle = Math.max(0, actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0))
      * margeCHF(Number(p.prix_vente_chf), tvaActive ? Number(p.taux_tva_defaut) : 0, coutAchat(p, tvaActive)), 0));
    const totalUnites = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)), 0);

    return {
      references: actifs.length,
      valeur: valeurAchat,
      caPotentiel,
      margePotentielle,
      totalUnites,
      ruptures: actifs.filter(p => stockLevel(p) === 'rupture').length,
      bas: actifs.filter(p => stockLevel(p) === 'bas').length,
    };
  }, [products, tvaActive]);

  const handleDelete = async (p: Product) => {
    if (!confirm(`Retirer « ${p.nom} » du catalogue ?\n\nS'il a déjà bougé en stock, il sera désactivé plutôt que supprimé : son journal de mouvements et les factures qui le citent doivent rester lisibles.`)) return;
    setBusyId(p.id);
    try {
      const outcome = await deleteOrArchiveProduct(p.id);
      if (outcome === 'deleted') {
        setProducts(prev => prev.filter(x => x.id !== p.id));
        setNotice(`« ${p.nom} » a été supprimé.`);
      } else {
        setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: false } : x)));
        setNotice(`« ${p.nom} » a une histoire en stock : il a été désactivé, pas supprimé.`);
      }
    } catch (err) {
      setError(`Le produit n'a pas été retiré${err instanceof Error ? ` (${err.message})` : ''}.`);
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (p: Product) => {
    setBusyId(p.id);
    try {
      replace(await updateProduct(p.id, { active: !p.active }));
    } catch (err) {
      setError(`La modification n'a pas été enregistrée${err instanceof Error ? ` (${err.message})` : ''}.`);
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    [next[index], next[target]] = [next[target], next[index]];
    setBusyId(products[index].id);
    try {
      // Seules les lignes dont le rang change sont réécrites : un échange ne
      // coûte ainsi que deux requêtes au lieu d'une par produit.
      await Promise.all(next
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => p.ordre !== i)
        .map(({ p, i }) => updateProduct(p.id, { ordre: i })));
      setProducts(next.map((p, i) => ({ ...p, ordre: i })));
    } catch (err) {
      setError(`Le nouvel ordre n'a pas été enregistré${err instanceof Error ? ` (${err.message})` : ''}.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="sr-only text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only">Produits vente</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Ce que vous revendez aux clientes. Le stock se décompte à chaque encaissement ; les produits de soin vivent dans le stock cabine.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
          Ajouter un produit
        </Button>
      </header>

      {error && (
        <Callout
          tone="danger"
          actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}
        >
          {error} Vérifiez la connexion puis réessayez.
        </Callout>
      )}

      {notice && (
        <Callout
          tone="info"
          actions={<Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Masquer</Button>}
        >
          {notice}
        </Callout>
      )}

      <ReclassementCallout products={allProducts} onDone={async () => {
        await load();
        setNotice('Classement repris des factures : les produits cabine, testeurs et échantillons ont rejoint le stock cabine.');
      }} />

      {!loading && products.length > 0 && (
        <MetricStrip className="py-2">
          <Metric size="lg" tone="warm" label="En rayon, au prix de vente" value={<AnimatedNumber value={stats.caPotentiel} format={formatCHF} />} hint={`${stats.totalUnites} unités`} />
          <Metric size="lg" label="Marge à réaliser" value={formatCHF(stats.margePotentielle)} />
          <Metric size="lg" label="Valeur d’achat" value={formatCHF(stats.valeur)} hint={`${stats.references} références`} />
          <Metric size="lg" tone={stats.bas > 0 ? 'warm' : 'muted'} label="À recommander" value={stats.bas} hint="sous le seuil d’alerte" />
          <Metric size="lg" tone={stats.ruptures > 0 ? 'negative' : 'muted'} label="En rupture" value={stats.ruptures} />
        </MetricStrip>
      )}

      <div className="data-frame overflow-hidden rounded-xl">
        {!loading && products.length > 0 && (
          <div className="hidden lg:grid grid-cols-[1.5rem_minmax(0,1fr)_12.5rem_6.5rem_5rem_auto] items-center gap-4 border-b border-stone-100 bg-white px-5 py-2.5 text-[12.5px] font-semibold text-stone-500">
            <span /><span>Produit</span><span className="text-right">Coût → vente</span><span className="text-right">Marge</span><span className="text-center">Stock</span><span />
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-600 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-stone-700">Aucun produit au catalogue.</p>
            <p className="text-stone-600 text-[13px] max-w-md mx-auto">
              Ajoutez les articles que vous revendez : ils apparaîtront sous l&apos;onglet « Produits » de l&apos;
              <Link href="/admin/caisse" className="text-accent hover:underline">écran d&apos;encaissement</Link>,
              et leur stock se décomptera à chaque vente.
            </p>
            <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>Ajouter un produit</Button>
          </div>
        ) : (
          <ul className="zebra">
            {products.map((p, i) => {
              const niveau = stockLevel(p);
              // Non assujettie : la vente est facturée à 0 %, tout le prix est une recette.
              const tauxVente = tvaActive ? Number(p.taux_tva_defaut) : 0;
              const cout = coutAchat(p, tvaActive);
              const marge = margeCHF(Number(p.prix_vente_chf), tauxVente, cout);
              const pct = margePct(Number(p.prix_vente_chf), tauxVente, cout);
              return (
                <li key={p.id} className={`px-5 py-3.5 transition-colors hover:bg-row-hover ${!p.active ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:grid lg:grid-cols-[1.5rem_minmax(0,1fr)_12.5rem_6.5rem_5rem_auto]">
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => move(i, -1)} disabled={i === 0 || busyId !== null}
                        aria-label="Monter" title="Monter"
                        className="p-0.5 text-stone-400 hover:text-stone-900 disabled:opacity-20 transition-colors cursor-pointer"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => move(i, 1)} disabled={i === products.length - 1 || busyId !== null}
                        aria-label="Descendre" title="Descendre"
                        className="p-0.5 text-stone-400 hover:text-stone-900 disabled:opacity-20 transition-colors cursor-pointer"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[14.5px] font-semibold text-stone-950">
                        <span className="truncate">{p.nom}</span>
                        {!p.active && <span className="shrink-0 bg-stone-100 px-2 py-0.5 text-[11.5px] font-semibold text-stone-600 rounded">Masqué en caisse</span>}
                      </p>
                      <p className="truncate text-[12.5px] text-stone-500">
                        {[p.marque, p.reference].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>

                    <p className="whitespace-nowrap text-right text-[13.5px] text-stone-600 tabular-nums" title={cout !== Number(p.prix_achat_chf) ? `Prix d'achat ${formatCHF(p.prix_achat_chf)} HT + TVA non récupérable` : undefined}>
                      {formatCHF(cout)} → <span className="font-semibold text-stone-950">{formatCHF(p.prix_vente_chf)}</span>
                    </p>

                    <p className={`text-right text-[13.5px] tabular-nums ${marge >= 0 ? 'text-stone-800' : 'font-semibold text-red-700'}`}>
                      {formatCHF(marge)}{pct !== null && <span className="block text-[12px] text-stone-500">{formatAmount(pct)} %</span>}
                    </p>

                    <div className="flex justify-center"><StockBadge product={p} level={niveau} /></div>

                    <div className="flex items-center justify-end gap-1 shrink-0">
                      {busyId === p.id ? (
                        <Loader2 size={14} className="animate-spin text-stone-500 mx-2" />
                      ) : (
                        <>
                          <button
                            onClick={() => setStockFor(p)}
                            aria-label={`Stock de ${p.nom} : livraison, perte, inventaire`} title="Livraison, perte, inventaire et historique"
                            className="flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-semibold text-stone-900 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
                          >
                            <ArrowDownUp size={13} /> Stock
                          </button>
                          <button
                            onClick={() => toggleActive(p)}
                            aria-label={p.active ? `Masquer ${p.nom} de la caisse` : `Afficher ${p.nom} dans la caisse`}
                            title={p.active ? 'Ne plus proposer ce produit à la caisse' : 'Proposer de nouveau ce produit à la caisse'}
                            className="text-[13px] font-medium px-2 py-1 rounded-lg text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            {p.active ? 'Masquer' : 'Afficher'}
                          </button>
                          <button
                            onClick={() => setEditing(p)}
                            aria-label={`Modifier ${p.nom}`} title="Modifier"
                            className="p-1.5 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            aria-label={`Supprimer ${p.nom}`} title="Supprimer"
                            className="p-1.5 text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <ProductDialog
          product={editing === 'new' ? null : editing}
          nextOrder={products.length}
          tvaActive={tvaActive}
          tauxDefaut={tauxDefaut}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); if (msg) setNotice(msg); load(); }}
        />
      )}

      {stockFor && (
        <StockDialog
          product={stockFor}
          onClose={() => setStockFor(null)}
          onUpdated={p => { replace(p); setStockFor(p); }}
        />
      )}
    </div>
  );
}

function StockBadge({ product, level }: { product: Product; level: ReturnType<typeof stockLevel> }) {
  const styles = {
    rupture: 'border-red-200 bg-red-50 text-red-700',
    bas:     'border-warm-muted bg-warm-soft text-warm-ink',
    ok:      'border-stone-200 bg-white text-stone-800',
  }[level];
  return (
    <span
      className={`shrink-0 inline-flex min-w-12 items-center justify-center gap-1.5 border px-2.5 py-1 text-[13px] font-semibold tabular-nums ${styles}`}
      title={level === 'rupture' ? 'En rupture' : level === 'bas' ? `Sous le seuil d'alerte (${qte(product.seuil_alerte)})` : 'En stock'}
    >
      {level !== 'ok' && <AlertTriangle size={11} />}
      {qte(product.stock)}
    </span>
  );
}

// ── Fiche produit ───────────────────────────────────────────────────────────

export function ProductDialog({ product, nextOrder, tvaActive, tauxDefaut, defaultUsage = 'vente', onClose, onSaved }: {
  product: Product | null;
  nextOrder: number;
  tvaActive: boolean;
  tauxDefaut: number;
  /** Usage d'un nouveau produit : « vente » depuis la boutique, « cabine » depuis le stock cabine. */
  defaultUsage?: ProductUsageType;
  onClose: () => void;
  /** `notice` : message à afficher sur la liste (par exemple un stock de départ non enregistré). */
  onSaved: (notice?: string) => void;
}) {
  const [nom, setNom]             = useState(product?.nom ?? '');
  const [marque, setMarque]       = useState(product?.marque ?? '');
  const [reference, setReference] = useState(product?.reference ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [achat, setAchat]         = useState(product ? String(product.prix_achat_chf) : '');
  const [vente, setVente]         = useState(product ? String(product.prix_vente_chf) : '');
  const [taux, setTaux]           = useState(product ? Number(product.taux_tva_defaut) : tauxDefaut);
  const [seuil, setSeuil]         = useState(product ? String(product.seuil_alerte) : '2');
  const [usage, setUsage]         = useState<ProductUsageType>(product?.usage_type ?? defaultUsage);
  const [contenance, setContenance] = useState(product?.contenance ?? '');
  const estVente = usage === 'vente';
  const [active, setActive]       = useState(product?.active ?? true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const num = (v: string) => Number(String(v).replace(',', '.'));
  // Un prix d'achat vide vaut zéro ; un prix illisible (« 12 fr ») est refusé
  // au lieu d'être enregistré silencieusement à zéro.
  const achatRaw = achat.trim() === '' ? 0 : num(achat);
  // Un produit qui n'est pas revendu n'a pas de prix de vente : vide vaut zéro.
  const venteRaw = !estVente && vente.trim() === '' ? 0 : num(vente);
  const achatNum = Number.isFinite(achatRaw) ? achatRaw : 0;
  const venteNum = Number.isFinite(venteRaw) ? venteRaw : 0;
  const coutReel = coutAchat({ prix_achat_chf: achatNum, taux_tva_defaut: taux }, tvaActive);
  const marge = margeCHF(venteNum, tvaActive ? taux : 0, coutReel);
  const pct = margePct(venteNum, tvaActive ? taux : 0, coutReel);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) { setError('Indiquez le nom du produit.'); return; }
    if ((estVente && vente.trim() === '') || !Number.isFinite(venteRaw) || venteRaw < 0) {
      setError('Prix de vente non reconnu : saisissez un nombre, par exemple 45 ou 45.50.');
      return;
    }
    if (!Number.isFinite(achatRaw) || achatRaw < 0) {
      setError('Prix d\'achat non reconnu : saisissez un nombre, ou laissez vide.');
      return;
    }
    setSaving(true); setError(null);
    const payload: ProductInput = {
      nom: nom.trim(),
      marque: marque.trim() || null,
      reference: reference.trim() || null,
      description: description.trim() || null,
      prix_achat_chf: Math.round(achatNum * 100) / 100,
      prix_vente_chf: Math.round(venteNum * 100) / 100,
      taux_tva_defaut: taux,
      seuil_alerte: Math.max(0, num(seuil) || 0),
      active,
      ordre: product?.ordre ?? nextOrder,
      usage_type: usage,
      contenance: contenance.trim() || null,
    };
    try {
      if (product) {
        await updateProduct(product.id, payload);
        onSaved();
        return;
      }
      // Pas de stock saisi à la création : il entre par sa facture d'achat
      // (import ou réception rattachée), ou par un inventaire explicite.
      await createProduct(payload);
      onSaved();
    } catch (err) {
      setError(`Le produit n'a pas été enregistré${err instanceof Error ? ` (${err.message})` : ''}. Vos saisies sont conservées : réessayez.`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog" aria-modal="true" aria-label={product ? 'Modifier le produit' : 'Nouveau produit'}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Package size={14} className="text-accent" /> {product ? 'Modifier le produit' : 'Nouveau produit'}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="prd-nom" className="block text-[12.5px] font-medium text-stone-700 mb-1">Nom *</label>
            <input
              id="prd-nom" type="text" value={nom} onChange={e => setNom(e.target.value)} required autoFocus
              placeholder="Sérum vitamine C — 30 ml"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prd-marque" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Marque <span className="text-stone-600">(facultatif)</span>
              </label>
              <input
                id="prd-marque" type="text" value={marque} onChange={e => setMarque(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="prd-ref" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Référence <span className="text-stone-600">(facultatif)</span>
              </label>
              <input
                id="prd-ref" type="text" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="Code fournisseur"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prd-usage" className="block text-[12.5px] font-medium text-stone-700 mb-1">Usage *</label>
              <select
                id="prd-usage" value={usage} onChange={e => setUsage(e.target.value as ProductUsageType)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors cursor-pointer"
              >
                {(Object.keys(PRODUCT_USAGE_LABELS) as ProductUsageType[]).map(u => (
                  <option key={u} value={u}>{PRODUCT_USAGE_LABELS[u].label}</option>
                ))}
              </select>
              <p className="text-[12px] text-stone-600 mt-1">
                {estVente ? 'Proposé à la vente en caisse.' : 'Hors caisse : suivi dans le stock cabine.'}
              </p>
            </div>
            <div>
              <label htmlFor="prd-contenance" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Contenance <span className="text-stone-600">(facultatif)</span>
              </label>
              <input
                id="prd-contenance" type="text" value={contenance} onChange={e => setContenance(e.target.value)}
                placeholder="250 ml, 1 l, 2 kg…"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prd-achat" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Prix d&apos;achat {!tvaActive && taux > 0 ? 'HT' : ''} (CHF)
              </label>
              <input
                id="prd-achat" type="text" inputMode="decimal" value={achat} onChange={e => setAchat(e.target.value)}
                placeholder="18.00"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="prd-vente" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Prix de vente TTC (CHF) {estVente ? '*' : <span className="text-stone-600">(non vendu)</span>}
              </label>
              <input
                id="prd-vente" type="text" inputMode="decimal" value={vente} onChange={e => setVente(e.target.value)} required={estVente}
                placeholder="45.00"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>
          </div>

          {!tvaActive && taux > 0 && achatNum > 0 && (
            <p className="text-[12px] text-stone-600 -mt-1">
              Coût réel : {formatCHF(coutReel)} — la TVA de {taux} % payée au fournisseur n&apos;est pas récupérable tant que l&apos;activité n&apos;est pas assujettie.
            </p>
          )}

          {/* Marge en direct : c'est le chiffre qui décide du prix de vente. */}
          {estVente && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className={marge >= 0 ? 'text-stone-600' : 'text-red-600'} />
              <span className="text-xs text-stone-600">Marge unitaire</span>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold tabular-nums ${marge >= 0 ? 'text-stone-900' : 'text-red-700'}`}>
                {formatCHF(marge)}
              </p>
              {pct !== null && <p className="text-[12px] text-stone-600 tabular-nums">{formatAmount(pct)} % du prix de vente</p>}
            </div>
          </div>
          )}
          {tvaActive && (
            <p className="text-[12px] text-stone-600 leading-relaxed -mt-1">
              La marge compare la vente <strong>hors taxe</strong> au prix d&apos;achat : saisissez donc
              un prix d&apos;achat HT, l&apos;impôt préalable étant récupérable.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prd-tva" className="block text-[12.5px] font-medium text-stone-700 mb-1">TVA par défaut</label>
              <select
                id="prd-tva" value={taux} onChange={e => setTaux(Number(e.target.value))}
                disabled={!tvaActive}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors disabled:bg-stone-50 disabled:text-stone-600 cursor-pointer"
              >
                {TAUX_TVA_CH.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="prd-seuil" className="block text-[12.5px] font-medium text-stone-700 mb-1">Seuil d&apos;alerte</label>
              <input
                id="prd-seuil" type="text" inputMode="decimal" value={seuil} onChange={e => setSeuil(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
              <p className="text-[12px] text-stone-600 mt-1">Le produit est signalé « stock bas » à partir de cette quantité.</p>
            </div>
          </div>

          {!product && (
            <p className="text-[12px] text-stone-600 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
              Le stock ne se saisit pas ici : il entre avec la facture d&apos;achat (« Facture fournisseur → stock »
              ou bouton Stock › Réception), ou par un inventaire si l&apos;article est déjà en rayon sans facture.
            </p>
          )}

          <div>
            <label htmlFor="prd-desc" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Description <span className="text-stone-600">(facultatif)</span>
            </label>
            <textarea
              id="prd-desc" rows={2} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors resize-y"
            />
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer">
            <button
              type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${active ? 'bg-accent' : 'bg-stone-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-stone-700">Visible sur l&apos;écran d&apos;encaissement</span>
          </label>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-stone-100 text-stone-900 font-semibold text-sm hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
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

// ── Stock : mouvements & inventaire ─────────────────────────────────────────

function StockDialog({ product, onClose, onUpdated }: {
  product: Product;
  onClose: () => void;
  onUpdated: (p: Product) => void;
}) {
  const [tab, setTab] = useState<'mouvement' | 'inventaire'>('mouvement');
  const [type, setType] = useState<'reception' | 'perte'>('reception');
  // Facture d'achat qui justifie la réception (obligatoire, vérifié par Postgres).
  const [factures, setFactures] = useState<FactureAchatOption[] | null>(null);
  const [factureId, setFactureId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [prixAchat, setPrixAchat] = useState(String(product.prix_achat_chf));
  const [majFiche, setMajFiche] = useState(false);
  const [motif, setMotif] = useState('');
  const [compte, setCompte] = useState('');
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFacturesAchat().then(setFactures).catch(() => setFactures([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    listStockMovements(product.id, 50)
      .then(m => { if (!cancelled) setHistory(m); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Journal illisible.'); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [product.id]);

  const num = (v: string) => Number(String(v).replace(',', '.'));

  const refresh = async (updated: Product) => {
    onUpdated(updated);
    setHistory(await listStockMovements(product.id, 50));
  };

  const submitMouvement = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = num(quantite);
    if (!Number.isFinite(q) || q <= 0) { setError('La quantité doit être un nombre positif.'); return; }
    const prix = type === 'reception' ? num(prixAchat) : null;
    if (type === 'reception' && !factureId) { setError('Choisissez la facture d\'achat de cette livraison.'); return; }
    if (type === 'reception' && !(Number.isFinite(prix as number) && (prix as number) >= 0)) {
      setError('Indiquez le prix d\'achat unitaire de la facture (0 pour un article offert).');
      return;
    }
    setSaving(true); setError(null);
    try {
      const updated = await stockMovement({
        productId: product.id, type, quantite: q,
        prixAchatUnitaire: type === 'reception' ? prix : null,
        motif: motif.trim() || null,
        expenseId: type === 'reception' ? factureId : null,
      });
      // La mise à jour du tarif de référence est un geste distinct de la
      // réception : recevoir à un nouveau prix ne redéfinit pas la marge des
      // ventes à venir sans qu'on l'ait décidé.
      if (type === 'reception' && majFiche && Number.isFinite(prix as number) && (prix as number) >= 0) {
        await refresh(await updateProduct(product.id, { prix_achat_chf: Math.round((prix as number) * 100) / 100 }));
      } else {
        await refresh(updated);
      }
      setQuantite('1'); setMotif(''); setMajFiche(false);
    } catch (err) {
      setError(`Le mouvement n'a pas été enregistré${err instanceof Error ? ` (${err.message})` : ''}. Réessayez.`);
    } finally {
      setSaving(false);
    }
  };

  const submitInventaire = async (e: React.FormEvent) => {
    e.preventDefault();
    const reel = num(compte);
    if (compte.trim() === '' || !Number.isFinite(reel) || reel < 0) { setError('Saisissez la quantité comptée (un nombre, 0 compris).'); return; }
    setSaving(true); setError(null);
    try {
      await refresh(await stockInventaire(product.id, reel, motif.trim() || undefined));
      setCompte(''); setMotif('');
    } catch (err) {
      setError(`L'inventaire n'a pas été enregistré${err instanceof Error ? ` (${err.message})` : ''}. Réessayez.`);
    } finally {
      setSaving(false);
    }
  };

  const ecart = compte.trim() === '' ? null : num(compte) - Number(product.stock);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={() => { if (!saving) onClose(); }}>
      <div
        role="dialog" aria-modal="true" aria-label={`Stock de ${product.nom}`}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 truncate">{product.nom}</h3>
            <p className="text-[12.5px] text-stone-600 mt-0.5">
              Stock actuel <span className="tabular-nums font-medium text-stone-700">{qte(product.stock)}</span>
              {' · '}valeur {formatCHF(Number(product.stock) * Number(product.prix_achat_chf))}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="inline-flex gap-1 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Type d'opération">
          {([
            { id: 'mouvement' as const,  label: 'Entrée ou sortie',  icon: ArrowDownUp },
            { id: 'inventaire' as const, label: 'Inventaire', icon: ClipboardCheck },
          ]).map(t => (
            <button
              key={t.id}
              type="button" role="tab"
              onClick={() => { setTab(t.id); setError(null); }}
              aria-selected={tab === t.id}
              className={`flex items-center gap-1.5 rounded-md px-3 h-8 text-[13px] transition-colors cursor-pointer ${
                tab === t.id ? 'bg-stone-900 text-white font-semibold' : 'text-stone-700 font-medium hover:text-stone-950'
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'mouvement' ? (
          <form onSubmit={submitMouvement} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {STOCK_MOVEMENTS_MANUELS.map(m => (
                <button
                  key={m.value} type="button" onClick={() => setType(m.value)}
                  aria-pressed={type === m.value}
                  className={`px-2 py-2 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                    type === m.value ? 'border-accent bg-accent-soft text-accent font-semibold' : 'border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-stone-600 -mt-1">
              {STOCK_MOVEMENTS_MANUELS.find(m => m.value === type)?.help}
              {type === 'perte' && ' — la quantité sortira du stock.'}
            </p>
            <p className="text-[12px] text-stone-500 -mt-1">
              Une cliente rapporte un article ? Corrigez sa facture dans le Journal : l&apos;article revient en stock avec la trace de la vente.
            </p>

            {type === 'reception' && (
              <FactureAchatSelect id="mv-facture" factures={factures} value={factureId} onChange={setFactureId} />
            )}

            <div className={`grid gap-3 ${type === 'reception' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div>
                <label htmlFor="mv-qte" className="block text-[12.5px] font-medium text-stone-700 mb-1">Quantité *</label>
                <input
                  id="mv-qte" type="text" inputMode="decimal" value={quantite} onChange={e => setQuantite(e.target.value)} required
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
                />
              </div>
              {type === 'reception' && (
                <div>
                  <label htmlFor="mv-prix" className="block text-[12.5px] font-medium text-stone-700 mb-1">Prix d&apos;achat unitaire</label>
                  <input
                    id="mv-prix" type="text" inputMode="decimal" value={prixAchat} onChange={e => setPrixAchat(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
                  />
                </div>
              )}
            </div>

            {type === 'reception' && (
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={majFiche} onChange={e => setMajFiche(e.target.checked)}
                  className="mt-0.5 accent-accent cursor-pointer"
                />
                <span className="text-xs text-stone-600 leading-relaxed">
                  Mettre à jour le prix d&apos;achat de la fiche
                  <span className="block text-[12px] text-stone-600">
                    Sans cette case, la réception est archivée à son prix mais la marge de référence ne bouge pas.
                  </span>
                </span>
              </label>
            )}

            <div>
              <label htmlFor="mv-motif" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Motif <span className="text-stone-600">(facultatif)</span>
              </label>
              <input
                id="mv-motif" type="text" value={motif} onChange={e => setMotif(e.target.value)}
                placeholder={type === 'perte' ? 'Flacon cassé, produit périmé…' : 'Livraison du 12 août…'}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
              />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enregistrer le mouvement
            </button>
          </form>
        ) : (
          <form onSubmit={submitInventaire} className="space-y-3">
            <p className="text-[12.5px] text-stone-600 leading-relaxed">
              Saisissez la quantité réellement <strong>comptée</strong> en rayon. L&apos;écart avec le stock
              affiché est enregistré comme un mouvement daté, ce qui permet de l&apos;expliquer plus tard.
            </p>
            <div>
              <label htmlFor="inv-compte" className="block text-[12.5px] font-medium text-stone-700 mb-1">Quantité comptée *</label>
              <input
                id="inv-compte" type="text" inputMode="decimal" value={compte} onChange={e => setCompte(e.target.value)} required autoFocus
                placeholder={qte(product.stock)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>

            {ecart !== null && Number.isFinite(ecart) && (
              <div className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                ecart === 0 ? 'border-stone-200 bg-stone-50 text-stone-600'
                : ecart > 0 ? 'border-accent/30 bg-accent/5 text-stone-700'
                : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                {ecart === 0
                  ? 'Aucun écart : rien ne sera enregistré.'
                  : `Écart de ${ecart > 0 ? '+' : ''}${qte(ecart)} par rapport au stock théorique de ${qte(product.stock)}.`}
              </div>
            )}

            <div>
              <label htmlFor="inv-motif" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Motif <span className="text-stone-600">(facultatif)</span>
              </label>
              <input
                id="inv-motif" type="text" value={motif} onChange={e => setMotif(e.target.value)}
                placeholder="Inventaire de fin de mois…"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
              />
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
              Enregistrer l&apos;inventaire
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-stone-200">
          <p className="text-[12.5px] font-medium text-stone-700 mb-2">Journal des mouvements</p>
          {loadingHistory ? (
            <p className="text-xs text-stone-700 py-2">Chargement…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-stone-700 py-2">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {history.map(m => (
                <li key={m.id} className="flex items-baseline gap-2 text-xs py-1 border-b border-stone-50 last:border-0">
                  <span className="text-stone-600 tabular-nums shrink-0 w-20">
                    {new Date(m.created_at).toLocaleDateString('fr-CH')}
                  </span>
                  <span className="text-stone-700 shrink-0 w-20">{STOCK_MOVEMENT_LABELS[m.type]}</span>
                  <span className={`tabular-nums font-medium shrink-0 w-12 text-right ${
                    Number(m.quantite) > 0 ? 'text-emerald-700' : 'text-stone-700'
                  }`}>
                    {Number(m.quantite) > 0 ? '+' : ''}{qte(m.quantite)}
                  </span>
                  <span className="text-stone-600 truncate flex-1 min-w-0">{m.motif ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
