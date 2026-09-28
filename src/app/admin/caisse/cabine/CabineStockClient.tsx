"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FlaskConical, Plus, Sparkles, TrendingUp, AlertTriangle, ArrowDownUp,
  Check, Loader2, ArrowRight, Layers, Package, Settings2, HelpCircle,
} from 'lucide-react';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { Button, Callout, PageHeader } from '../../../../components/admin/ui';
import { listProducts, listServices, stockMovement, stockInventaire } from '../../../../services/caisse';
import { listServiceSupplies, saveServiceSupplies } from '../../../../services/financeService';
import { Product, Service, formatCHF, stockLevel } from '../../../../types/caisse';
import { ServiceSupply, PRODUCT_USAGE_LABELS } from '../../../../types/finance';

export default function CabineStockClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [supplies, setSupplies] = useState<ServiceSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'flacons' | 'recettes'>('flacons');

  // Ajustement rapide de stock cabine
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'perte' | 'inventaire' | 'reception'>('perte');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustMotif, setAdjustMotif] = useState('');
  const [busy, setBusy] = useState(false);

  // Édition de la recette matière d'une prestation
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedSupplies, setSelectedSupplies] = useState<{ productId: string; quantiteEstimee: number }[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [prods, servs, sups] = await Promise.all([
        listProducts(true),
        listServices(true),
        listServiceSupplies(),
      ]);
      setProducts(prods);
      setServices(servs);
      setSupplies(sups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Produits cabine ou consommables (ou ceux contenant "1 l", "2 l", "2 kg", "cabine" dans le nom ou l'usage)
  const cabineProducts = useMemo(() => {
    return products.filter(p => {
      const anyP = p as any;
      if (anyP.usage_type === 'cabine' || anyP.usage_type === 'consommable') return true;
      const nom = p.nom.toLowerCase();
      return nom.includes('1 l') || nom.includes('2 l') || nom.includes('2 kg') || nom.includes('cabine') || nom.includes('drap');
    });
  }, [products]);

  // Valeur totale du stock cabine
  const statsCabine = useMemo(() => {
    const totalRef = cabineProducts.length;
    const valeurAchat = cabineProducts.reduce((acc, p) => acc + Number(p.stock || 0) * Number(p.prix_achat_chf || 0), 0);
    const ruptures = cabineProducts.filter(p => stockLevel(p) === 'rupture').length;
    return { totalRef, valeurAchat, ruptures };
  }, [cabineProducts]);

  // Validation d'ajustement de stock
  const handleSaveStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const val = parseFloat(adjustQty.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Veuillez saisir une quantité positive');
      return;
    }

    setBusy(true);
    try {
      if (adjustType === 'inventaire') {
        await stockInventaire(adjustingProduct.id, val, adjustMotif || 'Inventaire cabine');
      } else {
        await stockMovement({
          productId: adjustingProduct.id,
          type: adjustType,
          quantite: val,
          motif: adjustMotif || (adjustType === 'perte' ? 'Consommation cabine / fin de flacon' : 'Réception cabine'),
        });
      }
      setNotice(`Stock de « ${adjustingProduct.nom} » mis à jour.`);
      setAdjustingProduct(null);
      setAdjustQty('');
      setAdjustMotif('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  // Sauvegarde d'une dotation soin
  const handleSaveRecipe = async () => {
    if (!editingService) return;
    setBusy(true);
    try {
      await saveServiceSupplies(
        editingService.id,
        selectedSupplies.filter(s => s.quantiteEstimee > 0)
      );
      setNotice(`Recette matière enregistrée pour « ${editingService.nom} ».`);
      setEditingService(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const openRecipeEditor = (s: Service) => {
    setEditingService(s);
    const existing = supplies.filter(sup => sup.service_id === s.id);
    setSelectedSupplies(
      existing.map(e => ({ productId: e.product_id, quantiteEstimee: e.quantite_estimee }))
    );
  };

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      <PageHeader
        title="Stock Cabine & Coût Matière des Soins"
        description="Gérez les flacons professionnels utilisés en cabine (laits 1L, boues 2kg, huiles de modelage) et déterminez le coût matière exact consommé lors de chaque soin pour dégager votre marge nette."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/caisse/depenses">
              <Button variant="secondary" icon={Plus}>
                Réassort fournisseur (Coskyn)
              </Button>
            </Link>
          </div>
        }
      />

      {notice && (
        <Callout tone="info" actions={<Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Masquer</Button>}>
          {notice}
        </Callout>
      )}

      {error && (
        <Callout tone="danger" actions={<Button size="sm" variant="ghost" onClick={() => setError(null)}>Masquer</Button>}>
          {error}
        </Callout>
      )}

      {/* Cartes de synthèse */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Références Cabine actives</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{statsCabine.totalRef}</p>
          <p className="text-[12px] text-stone-500 mt-1">Grands formats professionnels</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Valeur Stock Cabine (Actif)</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{formatCHF(statsCabine.valeurAchat)}</p>
          <p className="text-[12px] text-stone-500 mt-1">Évaluation fiscale au prix d'achat</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Alertes de réassort</p>
          <p className={`text-2xl font-bold mt-1 ${statsCabine.ruptures > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {statsCabine.ruptures} flacon{statsCabine.ruptures > 1 ? 's' : ''} épuisé{statsCabine.ruptures > 1 ? 's' : ''}
          </p>
          <p className="text-[12px] text-stone-500 mt-1">À renouveler chez Coskyn</p>
        </div>
      </div>

      {/* Onglets navigation */}
      <div className="flex border-b border-stone-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('flacons')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'flacons'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <FlaskConical size={16} /> Produits & Flacons Professionnels ({cabineProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('recettes')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'recettes'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles size={16} /> Fiches Techniques & Coût Matière par Soin
        </button>
      </div>

      {/* ── TAB 1 : Produits & Flacons Cabine ─────────────────────────────── */}
      {activeTab === 'flacons' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-stone-500">Chargement du stock cabine…</div>
          ) : cabineProducts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FlaskConical size={32} className="mx-auto text-stone-400" />
              <p className="text-sm font-semibold text-stone-800">Aucun produit cabine identifié pour le moment.</p>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Téléversez une commande Coskyn depuis l'onglet « Factures & Dépenses » : les références professionnelles (PHY.C) apparaîtront automatiquement ici.
              </p>
              <Link href="/admin/caisse/depenses">
                <Button size="sm" icon={Plus}>Aller aux Factures</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Produit Pro</th>
                    <th className="py-3 px-4">Réf. Coskyn</th>
                    <th className="py-3 px-4 text-right">Prix d'Achat</th>
                    <th className="py-3 px-4 text-center">Stock Flacons</th>
                    <th className="py-3 px-4 text-right">Valeur Stock</th>
                    <th className="py-3 px-4 text-right">Ajustement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {cabineProducts.map(p => {
                    const stock = Number(p.stock || 0);
                    const prixAchat = Number(p.prix_achat_chf || 0);
                    const valTot = stock * prixAchat;
                    return (
                      <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-stone-900">
                          {p.nom}
                          {p.marque && <span className="text-[11px] text-stone-500 font-normal ml-2">{p.marque}</span>}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-stone-500">{p.reference || '—'}</td>
                        <td className="py-3.5 px-4 text-right text-stone-700">{formatCHF(prixAchat)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-xs ${
                            stock <= 0
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : stock <= 1
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {stock} flacon{stock > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-stone-900">{formatCHF(valTot)}</td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustType('perte');
                              setAdjustQty('1');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
                          >
                            <ArrowDownUp size={13} /> Ajuster
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2 : Coût Matière par Soin ──────────────────────────────────── */}
      {activeTab === 'recettes' && (
        <div className="space-y-4">
          <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl text-xs text-purple-900">
            <p className="font-semibold text-sm text-purple-950 flex items-center gap-1.5 mb-1">
              <Sparkles size={16} /> Calcul du coût de revient & rentabilité des soins
            </p>
            Renseignez pour chaque prestation les produits cabine utilisés (doses estimées ou forfaits matières). Le système calcule immédiatement votre **coût matière unitaire** et votre **marge brute réelle**.
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Prestation / Soin</th>
                  <th className="py-3 px-4 text-right">Tarif Cliente</th>
                  <th className="py-3 px-4">Dotation Cabine liée</th>
                  <th className="py-3 px-4 text-right">Coût Matière estimé</th>
                  <th className="py-3 px-4 text-right">Marge Brute</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {services.map(s => {
                  const servSupplies = supplies.filter(sup => sup.service_id === s.id);
                  // Calcul estimé du coût matière (si pas de dotation détaillée, forfait estimé par défaut à 8% du tarif)
                  const coutCalcule = servSupplies.length > 0
                    ? servSupplies.reduce((acc, it) => {
                        const prod = products.find(p => p.id === it.product_id);
                        const cost = prod ? (Number(prod.prix_achat_chf) * 0.05 * it.quantite_estimee) : 3.50;
                        return acc + cost;
                      }, 0)
                    : Number(s.prix_chf) * 0.08;

                  const marge = Number(s.prix_chf) - coutCalcule;
                  const margePct = Number(s.prix_chf) > 0 ? (marge / Number(s.prix_chf)) * 100 : 0;

                  return (
                    <tr key={s.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-stone-900">{s.nom}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-stone-900">{formatCHF(s.prix_chf)}</td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {servSupplies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {servSupplies.map((sup, idx) => {
                              const prod = products.find(p => p.id === sup.product_id);
                              return (
                                <span key={idx} className="bg-stone-100 px-1.5 py-0.5 rounded text-[10.5px]">
                                  {prod?.nom || 'Produit'} (×{sup.quantite_estimee})
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Forfait cabine standard (8 %)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-stone-700">{formatCHF(coutCalcule)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-emerald-700">{formatCHF(marge)}</span>
                        <div className="text-[11px] text-stone-400">{Math.round(margePct)} %</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openRecipeEditor(s)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
                        >
                          Configurer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale d'ajustement rapide de stock cabine */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">
              Ajuster le stock : {adjustingProduct.nom}
            </h3>
            <p className="text-xs text-stone-500">
              Stock actuel en institut : <strong>{adjustingProduct.stock} flacons</strong>
            </p>

            <form onSubmit={handleSaveStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Type d'opération *</label>
                <select
                  value={adjustType}
                  onChange={e => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                >
                  <option value="perte">Consommation cabine / Flacon terminé</option>
                  <option value="inventaire">Inventaire (Saisir le stock réel compté)</option>
                  <option value="reception">Livraison ponctuelle supplémentaire</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  {adjustType === 'inventaire' ? 'Nouveau stock réel compté *' : 'Quantité *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : 1"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Motif (facultatif)</label>
                <input
                  type="text"
                  placeholder="Ex : Flacon ouvert en début de mois..."
                  value={adjustMotif}
                  onChange={e => setAdjustMotif(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdjustingProduct(null)}>Annuler</Button>
                <Button type="submit" variant="primary" disabled={busy}>Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale de configuration recette soin */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">
              Dotation matière : {editingService.nom}
            </h3>
            <p className="text-xs text-stone-500">
              Cochez les produits cabine utilisés lors de cette prestation pour calculer automatiquement son coût matière.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-stone-200 p-3 rounded-xl text-xs">
              {cabineProducts.map(p => {
                const found = selectedSupplies.find(s => s.productId === p.id);
                const isChecked = !!found;
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSupplies([...selectedSupplies, { productId: p.id, quantiteEstimee: 1 }]);
                          } else {
                            setSelectedSupplies(selectedSupplies.filter(s => s.productId !== p.id));
                          }
                        }}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="font-medium text-stone-800">{p.nom}</span>
                    </label>
                    {isChecked && (
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <span>Dose :</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={found.quantiteEstimee}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 1;
                            setSelectedSupplies(
                              selectedSupplies.map(s => s.productId === p.id ? { ...s, quantiteEstimee: v } : s)
                            );
                          }}
                          className="w-12 px-1.5 py-0.5 rounded border border-stone-200 text-center font-semibold"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" onClick={() => setEditingService(null)}>Annuler</Button>
              <Button type="button" variant="primary" onClick={handleSaveRecipe} disabled={busy}>
                Enregistrer la recette
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
