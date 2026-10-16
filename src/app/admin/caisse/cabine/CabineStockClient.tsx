"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, FlaskConical, Pencil, Plus, Sparkles } from 'lucide-react';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { AnimatedNumber, Button, Callout, LinkButton, Metric, MetricStrip } from '../../../../components/admin/ui';
import { useSettings } from '../../../../hooks/useSettings';
import { listProducts, listServices, stockMovement, stockInventaire } from '../../../../services/caisse';
import { listFacturesAchat, listServiceSupplies, saveServiceSupplies } from '../../../../services/financeService';
import FactureAchatSelect, { type FactureAchatOption } from '../produits/FactureAchatSelect';
import { Product, Service, coutAchat, formatCHF, isVenteProduct } from '../../../../types/caisse';
import { ServiceSupply, PRODUCT_USAGE_LABELS } from '../../../../types/finance';
import type { ProductUsageType } from '../../../../types/finance';
import { ProductDialog } from '../produits/ProduitsClient';
import ReclassementCallout from '../produits/ReclassementCallout';

type Filtre = 'tous' | 'cabine' | 'consommable' | 'offert';

const FILTRES: { value: Filtre; label: string; usages: ProductUsageType[] }[] = [
  { value: 'tous', label: 'Tous', usages: ['cabine', 'consommable', 'testeur', 'echantillon'] },
  { value: 'cabine', label: 'Cabine', usages: ['cabine'] },
  { value: 'consommable', label: 'Consommables', usages: ['consommable'] },
  { value: 'offert', label: 'Testeurs & échantillons', usages: ['testeur', 'echantillon'] },
];

const num = (v: string) => Number(String(v).replace(',', '.'));
const qte = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * Tout ce qui n'est pas revendu : produits cabine, consommables, testeurs et
 * échantillons. L'usage de la fiche décide (`isVenteProduct`) ; le stock vit,
 * comme pour la boutique, dans le journal des mouvements.
 */
export default function CabineStockClient() {
  const settings = useSettings(['caisse_tva_assujetti', 'caisse_tva_taux_defaut']);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);

  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [supplies, setSupplies] = useState<ServiceSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'flacons' | 'recettes'>('flacons');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  // Mouvement de stock d'un produit cabine
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'perte' | 'inventaire' | 'reception'>('perte');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustPrix, setAdjustPrix] = useState('');
  const [adjustMotif, setAdjustMotif] = useState('');
  const [adjustFacture, setAdjustFacture] = useState('');
  const [factures, setFactures] = useState<FactureAchatOption[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Fiche technique d'un soin : produit → nombre de soins par flacon
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedSupplies, setSelectedSupplies] = useState<{ productId: string; soins: string }[]>([]);

  useEffect(() => {
    loadAll();
    listFacturesAchat().then(setFactures).catch(() => setFactures([]));
  }, []);

  const loadAll = async () => {
    setLoading(true); setError(null);
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

  const nonVendus = useMemo(() => products.filter(p => !isVenteProduct(p)), [products]);
  const affiches = useMemo(() => {
    const usages = FILTRES.find(f => f.value === filtre)!.usages;
    return nonVendus.filter(p => usages.includes((p.usage_type ?? 'vente') as ProductUsageType));
  }, [nonVendus, filtre]);
  // Produits utilisables dans une fiche technique de soin.
  const matieres = useMemo(
    () => nonVendus.filter(p => p.active && (p.usage_type === 'cabine' || p.usage_type === 'consommable')),
    [nonVendus],
  );

  const statsCabine = useMemo(() => {
    const actifs = nonVendus.filter(p => p.active);
    return {
      totalRef: actifs.length,
      // Un stock négatif (erreur de saisie) ne retranche rien : il vaut zéro.
      valeurAchat: actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * coutAchat(p, tvaActive), 0),
      ruptures: actifs.filter(p => Number(p.stock || 0) <= 0).length,
    };
  }, [nonVendus, tvaActive]);

  const openAdjust = (p: Product) => {
    setAdjusting(p);
    setAdjustType('perte');
    setAdjustQty('1');
    setAdjustPrix(String(p.prix_achat_chf ?? ''));
    setAdjustMotif('');
    setAdjustFacture('');
  };

  const handleSaveStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting) return;
    const val = num(adjustQty);
    // Un inventaire peut constater un stock vide ; un mouvement porte au moins une unité.
    if (adjustQty.trim() === '' || !Number.isFinite(val) || val < 0 || (adjustType !== 'inventaire' && val === 0)) {
      setError(adjustType === 'inventaire'
        ? 'Saisissez la quantité comptée (un nombre, 0 compris).'
        : 'Saisissez une quantité positive.');
      return;
    }
    const prix = num(adjustPrix);
    if (adjustType === 'reception' && !adjustFacture) {
      setError('Choisissez la facture d\'achat de cette livraison.');
      return;
    }
    if (adjustType === 'reception' && (adjustPrix.trim() === '' || !Number.isFinite(prix) || prix < 0)) {
      setError('Indiquez le prix d\'achat unitaire de la facture (0 pour un article offert).');
      return;
    }

    setBusy(true); setError(null);
    try {
      if (adjustType === 'inventaire') {
        await stockInventaire(adjusting.id, val, adjustMotif.trim() || 'Inventaire cabine');
      } else {
        await stockMovement({
          productId: adjusting.id,
          type: adjustType,
          quantite: val,
          prixAchatUnitaire: adjustType === 'reception' ? Math.round(prix * 100) / 100 : null,
          motif: adjustMotif.trim() || (adjustType === 'perte' ? 'Consommation cabine / fin de flacon' : 'Réception cabine'),
          expenseId: adjustType === 'reception' ? adjustFacture : null,
        });
      }
      setNotice(`Stock de « ${adjusting.nom} » mis à jour.`);
      setAdjusting(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  /** Coût matière d'un soin : coût du flacon ÷ nombre de soins qu'il permet. */
  const coutSoin = (sups: ServiceSupply[]) => sups.reduce((acc, it) => {
    const prod = products.find(p => p.id === it.product_id);
    const soins = Number(it.quantite_estimee || 0);
    return acc + (prod && soins > 0 ? coutAchat(prod, tvaActive) / soins : 0);
  }, 0);

  const openRecipeEditor = (s: Service) => {
    setEditingService(s);
    setSelectedSupplies(
      supplies.filter(sup => sup.service_id === s.id)
        .map(e => ({ productId: e.product_id, soins: String(Number(e.quantite_estimee)) })),
    );
  };

  const handleSaveRecipe = async () => {
    if (!editingService) return;
    const lignes = selectedSupplies.map(s => ({ productId: s.productId, soinsParUnite: num(s.soins) }));
    if (lignes.some(l => !Number.isFinite(l.soinsParUnite) || l.soinsParUnite < 1)) {
      setError('Pour chaque produit coché, indiquez combien de soins permet un flacon (au moins 1).');
      return;
    }
    setBusy(true); setError(null);
    try {
      await saveServiceSupplies(editingService.id, lignes);
      setNotice(`Fiche technique enregistrée pour « ${editingService.nom} ».`);
      setEditingService(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="sr-only text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only">Stock cabine</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Ce qui sert en cabine sans être revendu : flacons professionnels, consommables, testeurs, échantillons — et ce que chaque soin coûte en produits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/admin/caisse/depenses" variant="ghost">Factures fournisseur</LinkButton>
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Ajouter un produit</Button>
        </div>
      </header>

      <ReclassementCallout products={products} onDone={async () => {
        await loadAll();
        setNotice('Classement repris des factures : les produits cabine, testeurs et échantillons sont maintenant ici.');
      }} />

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

      {/* Synthèse */}
      <MetricStrip className="py-2">
        <Metric size="lg" tone="warm" label="Valeur du stock" value={<AnimatedNumber value={statsCabine.valeurAchat} format={formatCHF} />} hint={`Au coût d’achat${tvaActive ? ' HT' : ', TVA non récupérable comprise'}`} />
        <Metric size="lg" label="Références" value={statsCabine.totalRef} hint="cabine, consommables, testeurs, échantillons" />
        <Metric size="lg" tone={statsCabine.ruptures > 0 ? 'negative' : 'muted'} label="Épuisés" value={statsCabine.ruptures} hint="à renouveler ou à inventorier" />
      </MetricStrip>

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
          <FlaskConical size={16} /> Produits ({nonVendus.length})
        </button>
        <button
          onClick={() => setActiveTab('recettes')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'recettes'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles size={16} /> Fiches techniques & coût matière par soin
        </button>
      </div>

      {/* ── Onglet 1 : produits hors vente ───────────────────────────────── */}
      {activeTab === 'flacons' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map(f => (
              <button
                key={f.value} onClick={() => setFiltre(f.value)} aria-pressed={filtre === f.value}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                  filtre === f.value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-stone-50 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-stone-500">Chargement du stock cabine…</div>
            ) : affiches.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FlaskConical size={32} className="mx-auto text-stone-400" />
                <p className="text-sm font-semibold text-stone-800">Aucun produit dans cette catégorie.</p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  L&apos;usage se choisit sur la fiche du produit (Modifier → Usage). Une facture fournisseur importée
                  depuis « Factures & Dépenses » crée les fiches avec l&apos;usage de chaque ligne.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Produit</th>
                      <th className="py-3 px-4">Réf.</th>
                      <th className="py-3 px-4 text-right">Coût d&apos;achat</th>
                      <th className="py-3 px-4 text-center">Stock</th>
                      <th className="py-3 px-4 text-right">Valeur</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="zebra">
                    {affiches.map(p => {
                      const stock = Number(p.stock || 0);
                      const cout = coutAchat(p, tvaActive);
                      const u = PRODUCT_USAGE_LABELS[(p.usage_type ?? 'cabine') as ProductUsageType];
                      return (
                        <tr key={p.id} className={`transition-colors hover:bg-row-hover ${!p.active ? 'opacity-60' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-900">{p.nom}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10.5px] px-1.5 py-0.5 rounded border ${u.color}`}>{u.badge}</span>
                              {p.contenance && <span className="text-[11px] text-stone-500">{p.contenance}</span>}
                              {!p.active && <span className="text-[11px] text-stone-500">· masqué</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-stone-500">{p.reference || '—'}</td>
                          <td className="py-3.5 px-4 text-right text-stone-700">{formatCHF(cout)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 font-bold text-xs ${
                              stock <= 0
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : stock <= Number(p.seuil_alerte || 0)
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {qte(stock)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-stone-900">{formatCHF(Math.max(0, stock) * cout)}</td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openAdjust(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
                              >
                                <ArrowDownUp size={13} /> Stock
                              </button>
                              <button
                                onClick={() => setEditing(p)} title="Modifier la fiche (usage, prix, contenance)"
                                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                              >
                                <Pencil size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet 2 : coût matière par soin ─────────────────────────────── */}
      {activeTab === 'recettes' && (
        <div className="space-y-4">
          <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl text-xs text-purple-900">
            <p className="font-semibold text-sm text-purple-950 flex items-center gap-1.5 mb-1">
              <Sparkles size={16} /> Coût matière d&apos;un soin
            </p>
            Pour chaque soin, cochez les produits cabine utilisés et indiquez combien de soins permet <strong>un</strong> flacon
            (ex. un litre de lait démaquillant = 40 soins). Coût par soin = coût d&apos;achat du flacon ÷ ce nombre.
            Un soin sans fiche n&apos;a pas de coût affiché : aucun chiffre n&apos;est inventé.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Soin</th>
                  <th className="py-3 px-4 text-right">Tarif</th>
                  <th className="py-3 px-4">Produits utilisés</th>
                  <th className="py-3 px-4 text-right">Coût matière</th>
                  <th className="py-3 px-4 text-right">Marge</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="zebra">
                {services.map(s => {
                  const servSupplies = supplies.filter(sup => sup.service_id === s.id);
                  const renseigne = servSupplies.length > 0;
                  const cout = coutSoin(servSupplies);
                  const marge = Number(s.prix_chf) - cout;
                  const margePct = Number(s.prix_chf) > 0 ? (marge / Number(s.prix_chf)) * 100 : 0;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-row-hover">
                      <td className="py-3.5 px-4 font-semibold text-stone-900">{s.nom}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-stone-900">{formatCHF(s.prix_chf)}</td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {renseigne ? (
                          <div className="flex flex-wrap gap-1">
                            {servSupplies.map(sup => {
                              const prod = products.find(p => p.id === sup.product_id);
                              return (
                                <span key={sup.id} className="bg-stone-100 px-1.5 py-0.5 rounded text-[10.5px]">
                                  {prod?.nom ?? 'Produit retiré'} (1 flacon = {qte(Number(sup.quantite_estimee))} soins)
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Fiche non renseignée</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-stone-700">{renseigne ? formatCHF(cout) : '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        {renseigne ? (
                          <>
                            <span className="font-bold text-emerald-700">{formatCHF(marge)}</span>
                            <div className="text-[11px] text-stone-400">{Math.round(margePct)} %</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openRecipeEditor(s)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
                        >
                          {renseigne ? 'Modifier' : 'Renseigner'}
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

      {/* Mouvement de stock */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Stock : {adjusting.nom}</h3>
            <p className="text-xs text-stone-500">
              Stock enregistré : <strong>{qte(Number(adjusting.stock))}</strong>
            </p>

            <form onSubmit={handleSaveStockAdjust} className="space-y-4 text-xs">
              <div>
                <label htmlFor="cab-type" className="block font-medium text-stone-700 mb-1">Opération *</label>
                <select
                  id="cab-type" value={adjustType}
                  onChange={e => setAdjustType(e.target.value as 'perte' | 'inventaire' | 'reception')}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                >
                  <option value="perte">Consommation cabine / flacon terminé</option>
                  <option value="inventaire">Inventaire (saisir le stock compté)</option>
                  <option value="reception">Réception d&apos;une livraison</option>
                </select>
              </div>

              <div>
                <label htmlFor="cab-qte" className="block font-medium text-stone-700 mb-1">
                  {adjustType === 'inventaire' ? 'Stock réel compté (0 si vide) *' : 'Quantité *'}
                </label>
                <input
                  id="cab-qte" type="text" inputMode="decimal" required
                  value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent font-semibold"
                />
              </div>

              {adjustType === 'reception' && (
                <>
                  <FactureAchatSelect id="cab-facture" factures={factures} value={adjustFacture} onChange={setAdjustFacture} />
                  <div>
                    <label htmlFor="cab-prix" className="block font-medium text-stone-700 mb-1">Prix d&apos;achat unitaire de la facture (CHF) *</label>
                    <input
                      id="cab-prix" type="text" inputMode="decimal"
                      value={adjustPrix} onChange={e => setAdjustPrix(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="cab-motif" className="block font-medium text-stone-700 mb-1">Motif (facultatif)</label>
                <input
                  id="cab-motif" type="text"
                  placeholder="Ex : flacon ouvert en début de mois…"
                  value={adjustMotif} onChange={e => setAdjustMotif(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAdjusting(null)}>Annuler</Button>
                <Button type="submit" variant="primary" loading={busy}>Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiche technique d'un soin */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Fiche technique : {editingService.nom}</h3>
            <p className="text-xs text-stone-500">
              Cochez les produits utilisés et indiquez combien de soins permet un flacon (ou pot, rouleau).
            </p>

            <div className="max-h-72 overflow-y-auto space-y-1 border border-stone-200 p-2 rounded-xl text-xs">
              {matieres.length === 0 && (
                <p className="p-2 text-stone-500 italic">Aucun produit cabine ou consommable : classez d&apos;abord vos produits.</p>
              )}
              {matieres.map(p => {
                const found = selectedSupplies.find(s => s.productId === p.id);
                const soins = found ? num(found.soins) : 0;
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 hover:bg-stone-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox" checked={!!found}
                        onChange={e => setSelectedSupplies(e.target.checked
                          ? [...selectedSupplies, { productId: p.id, soins: '' }]
                          : selectedSupplies.filter(s => s.productId !== p.id))}
                        className="rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span className="font-medium text-stone-800 truncate">{p.nom}</span>
                    </label>
                    {found && (
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 shrink-0">
                        <span>1 flacon =</span>
                        <input
                          type="text" inputMode="decimal" value={found.soins} aria-label={`Soins par flacon de ${p.nom}`}
                          onChange={e => setSelectedSupplies(selectedSupplies.map(s => s.productId === p.id ? { ...s, soins: e.target.value } : s))}
                          className="w-14 px-1.5 py-0.5 rounded border border-stone-200 text-center font-semibold"
                        />
                        <span>soins</span>
                        {soins >= 1 && <span className="text-stone-700 font-medium">· {formatCHF(coutAchat(p, tvaActive) / soins)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <Button type="button" variant="ghost" onClick={() => setEditingService(null)}>Annuler</Button>
              <Button type="button" variant="primary" onClick={handleSaveRecipe} loading={busy}>Enregistrer la fiche</Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ProductDialog
          product={editing === 'new' ? null : editing}
          nextOrder={products.length}
          tvaActive={tvaActive}
          tauxDefaut={tauxDefaut}
          defaultUsage="cabine"
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message ?? 'Fiche enregistrée.');
            loadAll();
          }}
        />
      )}
    </div>
  );
}
