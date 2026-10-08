"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Receipt, Plus, UploadCloud, FileText, CheckCircle2, Clock, Trash2,
  Sparkles, Package, FlaskConical, AlertCircle, ArrowRight, ShieldCheck,
  Building, Megaphone, Smartphone, HelpCircle, Eye, RefreshCw,
  Camera, Paperclip, Download,
} from 'lucide-react';
import TicketScanModal from './TicketScanModal';
import { openJustificatif } from '../../../../services/receipts';
import { downloadExpensesCsv } from '../../../../utils/expensesExport';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { Button, Callout, PageHeader } from '../../../../components/admin/ui';
import {
  applyInvoiceToStock,
  createExpense,
  deleteExpense,
  getInvoiceVentilation,
  listExpenseCategories,
  listExpenses,
  updateExpense,
  matchInvoiceItemsWithStock,
  InvoiceItemStockMatch,
  DEFAULT_SWISS_CATEGORIES,
} from '../../../../services/financeService';
import { listProducts } from '../../../../services/caisse';
import { COSKYN_FACTURE_139079 } from '../../../../services/invoiceParser';
import {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpensePaymentMode,
  ExpenseStatus,
  EXPENSE_PAYMENT_MODE_LABELS,
  EXPENSE_STATUS_LABELS,
  PRODUCT_USAGE_LABELS,
  ProductUsageType,
} from '../../../../types/finance';
import { Product, formatCHF } from '../../../../types/caisse';

export default function DepensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filtre et recherche
  const [activeGroup, setActiveGroup] = useState<string>('tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'existing' | 'new' | 'vente' | 'cabine' | 'consommable'>('all');

  // Modales
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [importProcessing, setImportProcessing] = useState(false);
  // Ticket photographié en cours de lecture / relecture.
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear());

  // Formulaire importation facture
  const [parsedPreview, setParsedPreview] = useState<{
    fournisseur: string;
    numero_facture: string;
    date_facture: string;
    date_echeance?: string;
    montant_ht: number;
    taux_tva: number;
    montant_tva: number;
    montant_ttc: number;
    category_code: string;
    notes?: string;
    items: ExpenseItem[];
    updateStock: boolean;
  } | null>(null);

  // Formulaire dépense manuelle
  const [manualForm, setManualForm] = useState({
    fournisseur: '',
    numero_facture: '',
    date_facture: new Date().toISOString().split('T')[0],
    date_echeance: '',
    montant_ttc: '',
    taux_tva: '0',
    category_id: 'cat-6200',
    statut: 'a_payer' as ExpenseStatus,
    mode_paiement: 'virement' as ExpensePaymentMode,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, exps, prods] = await Promise.all([
        listExpenseCategories(),
        listExpenses(),
        listProducts(true),
      ]);
      setCategories(cats);
      setExpenses(exps);
      setExistingProducts(prods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Chargement direct du bon Coskyn Phytomer 139079
  const handleLoadCoskynDemo = () => {
    setParsedPreview({
      fournisseur: COSKYN_FACTURE_139079.fournisseur,
      numero_facture: COSKYN_FACTURE_139079.numero_facture,
      date_facture: COSKYN_FACTURE_139079.date_facture,
      date_echeance: COSKYN_FACTURE_139079.date_echeance,
      montant_ht: COSKYN_FACTURE_139079.montant_ht,
      taux_tva: COSKYN_FACTURE_139079.taux_tva,
      montant_tva: COSKYN_FACTURE_139079.montant_tva,
      montant_ttc: COSKYN_FACTURE_139079.montant_ttc,
      category_code: '4200',
      notes: COSKYN_FACTURE_139079.notes,
      items: COSKYN_FACTURE_139079.items,
      updateStock: true,
    });
    setImportModalOpen(true);
  };

  // Traitement d'un fichier uploadé
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/expenses/parse', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setParsedPreview({
          ...data.data,
          updateStock: data.data.is_stock_invoice ?? true,
        });
        setImportModalOpen(true);
      } else {
        alert(data.error || 'Erreur lors de la lecture du document');
      }
    } catch {
      alert('Impossible d’analyser le fichier');
    } finally {
      setImportProcessing(false);
    }
  };

  // Validation de l'import de facture
  const handleConfirmImport = async () => {
    if (!parsedPreview) return;
    setImportProcessing(true);

    try {
      const cat = categories.find(c => c.code === parsedPreview.category_code) || categories[0];

      // 1. Création de la dépense
      const created = await createExpense(
        {
          fournisseur: parsedPreview.fournisseur,
          numero_facture: parsedPreview.numero_facture,
          date_facture: parsedPreview.date_facture,
          date_echeance: parsedPreview.date_echeance || null,
          date_paiement: null,
          montant_ht: parsedPreview.montant_ht,
          taux_tva: parsedPreview.taux_tva,
          montant_tva: parsedPreview.montant_tva,
          montant_ttc: parsedPreview.montant_ttc,
          category_id: cat ? cat.id : null,
          statut: 'a_payer',
          mode_paiement: 'virement',
          notes: parsedPreview.notes || null,
          document_url: null,
          is_stock_invoice: parsedPreview.updateStock,
        },
        parsedPreview.items
      );

      // 2. Déversement direct dans le stock si demandé
      let stockMsg = '';
      if (parsedPreview.updateStock && parsedPreview.items.length > 0) {
        const stockRes = await applyInvoiceToStock(created.id, parsedPreview.items);
        stockMsg = ` Stock actualisé : +${stockRes.totalQuantityAdded} unités (+${stockRes.updatedCount} stocks existants ajustés avec le bon, +${stockRes.createdCount} nouvelles fiches créées).`;
      }

      setNotice(`Facture « ${parsedPreview.fournisseur} » n° ${parsedPreview.numero_facture} enregistrée avec succès.${stockMsg}`);
      setImportModalOpen(false);
      setParsedPreview(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    } finally {
      setImportProcessing(false);
    }
  };

  // Enregistrement manuel d'une dépense d'exploitation
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = parseFloat(manualForm.montant_ttc.replace(',', '.'));
    if (isNaN(montant) || montant <= 0) {
      alert('Montant invalide');
      return;
    }

    try {
      const tva = parseFloat(manualForm.taux_tva) || 0;
      const ht = tva > 0 ? montant / (1 + tva / 100) : montant;
      const mtTva = montant - ht;

      await createExpense({
        fournisseur: manualForm.fournisseur,
        numero_facture: manualForm.numero_facture || null,
        date_facture: manualForm.date_facture,
        date_echeance: manualForm.date_echeance || null,
        date_paiement: manualForm.statut === 'payee' ? manualForm.date_facture : null,
        montant_ht: Math.round(ht * 100) / 100,
        taux_tva: tva,
        montant_tva: Math.round(mtTva * 100) / 100,
        montant_ttc: montant,
        category_id: manualForm.category_id,
        statut: manualForm.statut,
        mode_paiement: manualForm.mode_paiement,
        notes: manualForm.notes || null,
        document_url: null,
        is_stock_invoice: false,
      });

      setNotice(`Dépense « ${manualForm.fournisseur} » enregistrée avec succès.`);
      setManualModalOpen(false);
      setManualForm({
        fournisseur: '',
        numero_facture: '',
        date_facture: new Date().toISOString().split('T')[0],
        date_echeance: '',
        montant_ttc: '',
        taux_tva: '0',
        category_id: categories[0]?.id || 'cat-6200',
        statut: 'a_payer',
        mode_paiement: 'virement',
        notes: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleTicketPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Remis à zéro pour pouvoir reprendre la même photo après une annulation.
    e.target.value = '';
    if (file) setTicketFile(file);
  };

  const handleOpenJustificatif = async (path: string) => {
    try {
      await openJustificatif(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportYears = useMemo(() => {
    const years = new Set(expenses.map(e => Number(e.date_facture.slice(0, 4))).filter(Boolean));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [expenses]);

  const handleTogglePaid = async (exp: Expense) => {
    const nextStatus = exp.statut === 'payee' ? 'a_payer' : 'payee';
    await updateExpense(exp.id, {
      statut: nextStatus,
      date_paiement: nextStatus === 'payee' ? new Date().toISOString().split('T')[0] : null,
    });
    setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, statut: nextStatus } : e));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la dépense « ${name} » ?`)) return;
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    setNotice(`Facture « ${name} » supprimée.`);
  };

  // Filtrage
  const filteredExpenses = expenses.filter(exp => {
    if (activeGroup === 'a_payer' && exp.statut !== 'a_payer') return false;
    if (activeGroup === 'marchandises' && exp.category?.groupe !== 'marchandises_matieres') return false;
    if (activeGroup === 'exploitation' && exp.category?.groupe !== 'charges_exploitation') return false;
    if (activeGroup === 'avs' && exp.category?.code !== '5000') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchFourn = exp.fournisseur.toLowerCase().includes(q);
      const matchNum = (exp.numero_facture || '').toLowerCase().includes(q);
      const matchCat = (exp.category?.nom || '').toLowerCase().includes(q);
      return matchFourn || matchNum || matchCat;
    }
    return true;
  });

  // Calculs statistiques
  const totalTTC = expenses.reduce((acc, e) => acc + (e.statut !== 'annulee' ? Number(e.montant_ttc || 0) : 0), 0);
  const totalAPayer = expenses.filter(e => e.statut === 'a_payer').reduce((acc, e) => acc + Number(e.montant_ttc || 0), 0);
  const countAPayer = expenses.filter(e => e.statut === 'a_payer').length;

  const ventilationTotals = expenses.reduce((acc, e) => {
    if (e.statut === 'annulee') return acc;
    const v = getInvoiceVentilation(e);
    acc.vente += v.partVenteTTC;
    acc.cabine += v.partCabineTTC;
    acc.conso += v.partConsommablesTTC;
    return acc;
  }, { vente: 0, cabine: 0, conso: 0 });

  // Rapprochement automatique du bon de commande avec les stocks existants
  const stockMatches: InvoiceItemStockMatch[] = useMemo(() => {
    if (!parsedPreview?.items) return [];
    return matchInvoiceItemsWithStock(parsedPreview.items, existingProducts);
  }, [parsedPreview?.items, existingProducts]);

  const countExisting = stockMatches.filter(m => m.isExisting).length;
  const countNew = stockMatches.filter(m => !m.isExisting).length;
  const qtyExisting = stockMatches.filter(m => m.isExisting).reduce((acc, m) => acc + m.quantiteBon, 0);
  const qtyNew = stockMatches.filter(m => !m.isExisting).reduce((acc, m) => acc + m.quantiteBon, 0);
  const totalUnits = stockMatches.reduce((acc, m) => acc + m.quantiteBon, 0);

  const displayedMatches = useMemo(() => {
    return stockMatches.filter(m => {
      if (previewFilter === 'existing') return m.isExisting;
      if (previewFilter === 'new') return !m.isExisting;
      if (previewFilter === 'vente') return m.item.usage_type === 'vente';
      if (previewFilter === 'cabine') return m.item.usage_type === 'cabine';
      if (previewFilter === 'consommable') return m.item.usage_type === 'consommable';
      return true;
    });
  }, [stockMatches, previewFilter]);

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      <PageHeader
        title="Factures & Dépenses"
        description="Photographiez un ticket de caisse : l'IA lit le fournisseur, le montant et la TVA, propose le compte, et la photo est archivée avec la dépense. Les bons de commande Coskyn se ventilent dans le stock boutique ou cabine."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleTicketPicked}
              />
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-accent-fg text-[13.5px] font-medium hover:bg-accent-hover transition-colors shadow-xs">
                <Camera size={16} /> Photographier un ticket
              </span>
            </label>
            <Button
              variant="secondary"
              icon={Sparkles}
              onClick={handleLoadCoskynDemo}
              title="Précharger la facture Coskyn n° 139079 (Phytomer)"
            >
              Facture Coskyn (Démo)
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileUpload}
                disabled={importProcessing}
              />
              <span className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-stone-900 text-white text-[13.5px] font-medium hover:bg-stone-800 transition-colors shadow-xs">
                <UploadCloud size={16} /> Importer un bon / PDF
              </span>
            </label>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => setManualModalOpen(true)}
            >
              Autre dépense
            </Button>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Dépenses</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{formatCHF(totalTTC)}</p>
          <p className="text-[12px] text-stone-500 mt-1">{expenses.length} factures enregistrées</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Factures à payer</p>
          <p className={`text-2xl font-bold mt-1 ${countAPayer > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {formatCHF(totalAPayer)}
          </p>
          <p className="text-[12px] text-stone-500 mt-1">{countAPayer} facture{countAPayer > 1 ? 's' : ''} en attente</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide font-semibold">Ventilation Vente (4000)</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCHF(ventilationTotals.vente)}</p>
          <p className="text-[12px] text-stone-500 mt-1">Cosmétiques revente cliente</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-purple-800 uppercase tracking-wide font-semibold">Ventilation Cabine (4200)</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{formatCHF(ventilationTotals.cabine)}</p>
          <p className="text-[12px] text-stone-500 mt-1">Produits pro & matières soins</p>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200">
        <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
          {[
            { id: 'tous', label: 'Toutes' },
            { id: 'a_payer', label: `À payer (${countAPayer})` },
            { id: 'marchandises', label: 'Achats & Stocks (4000/4200)' },
            { id: 'exploitation', label: 'Charges d’exploitation (6000+)' },
            { id: 'avs', label: 'Cotisations AVS (5000)' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveGroup(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeGroup === f.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="search"
            placeholder="Rechercher fournisseur, n°..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 sm:w-56 px-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={exportYear}
            onChange={e => setExportYear(Number(e.target.value))}
            aria-label="Année à exporter"
            className="px-2 py-1.5 text-xs rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {exportYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={() => downloadExpensesCsv(expenses, exportYear)}
            title="Export CSV pour la fiduciaire : fournisseur, adresse, n° IDE, compte, TVA par taux, justificatif"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 whitespace-nowrap cursor-pointer"
          >
            <Download size={13} /> Export fiduciaire
          </button>
        </div>
      </div>

      {/* Liste des factures */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-stone-500">Chargement des dépenses…</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <Receipt size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Aucune facture enregistrée pour le moment</p>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                Commencez par importer votre première facture fournisseur (ex. Coskyn SA) pour réassortir automatiquement vos produits cabine et vente.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button size="sm" icon={Sparkles} onClick={handleLoadCoskynDemo}>
                Tester avec la facture Coskyn (Démo)
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Fournisseur & Libellé</th>
                  <th className="py-3 px-4">Catégorie Comptable</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Montant TTC</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredExpenses.map(exp => {
                  const stat = EXPENSE_STATUS_LABELS[exp.statut] || { label: exp.statut, color: 'bg-stone-100 text-stone-600' };
                  return (
                    <tr key={exp.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                          {exp.fournisseur}
                          {exp.is_stock_invoice && (
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-sm font-normal bg-purple-100 text-purple-800">
                              Stock lié
                            </span>
                          )}
                          {exp.type_piece === 'ticket' && (
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded-sm font-normal bg-stone-100 text-stone-700">
                              Ticket
                            </span>
                          )}
                        </div>
                        {exp.fournisseur_adresse && (
                          <div className="text-[11.5px] text-stone-500 truncate max-w-[260px]">{exp.fournisseur_adresse}</div>
                        )}
                        <div className="text-[11.5px] text-stone-500">
                          {exp.numero_facture ? `Facture n° ${exp.numero_facture}` : 'Sans n°'}
                          {exp.items && exp.items.length > 0 && ` · ${exp.items.length} références`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const vent = getInvoiceVentilation(exp);
                          return (
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[11px] bg-stone-100 px-2 py-0.5 rounded text-stone-700 font-semibold">
                                  {vent.hasVentilation ? '4000 / 4200' : (exp.category?.code || '6990')}
                                </span>
                                <span className="text-[11px] text-stone-700 font-medium truncate max-w-[200px]">
                                  {vent.hasVentilation ? 'Facture mixte (Vente & Cabine)' : (exp.category?.nom || 'Dépense courante')}
                                </span>
                              </div>
                              {vent.hasVentilation && (
                                <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                    Vente: {formatCHF(vent.partVenteTTC)}
                                  </span>
                                  <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                                    Cabine: {formatCHF(vent.partCabineTTC)}
                                  </span>
                                  {vent.partConsommablesTTC > 0 && (
                                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                      Matériel: {formatCHF(vent.partConsommablesTTC)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-stone-700">
                        {new Date(exp.date_facture).toLocaleDateString('fr-CH')}
                        {exp.date_echeance && (
                          <div className="text-[11px] text-stone-400">Échéance : {new Date(exp.date_echeance).toLocaleDateString('fr-CH')}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${stat.color}`}>
                          {stat.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-stone-900">
                        {formatCHF(exp.montant_ttc)}
                        {exp.taux_tva > 0 && (
                          <div className="text-[11px] text-stone-400">TVA {exp.taux_tva}% incluse</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {exp.justificatif_path && (
                            <button
                              onClick={() => handleOpenJustificatif(exp.justificatif_path!)}
                              title="Voir le justificatif archivé"
                              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            >
                              <Paperclip size={15} />
                            </button>
                          )}
                          {exp.items && exp.items.length > 0 && (
                            <button
                              onClick={() => setViewExpense(exp)}
                              title="Voir les articles de la facture"
                              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleTogglePaid(exp)}
                            title={exp.statut === 'payee' ? 'Marquer comme à payer' : 'Marquer comme payée'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              exp.statut === 'payee'
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id, exp.fournisseur)}
                            title="Supprimer"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 size={15} />
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

      {/* Modale d'aperçu et ventilation de la facture Coskyn / importée */}
      {importModalOpen && parsedPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-stone-200 shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  Ventilation automatique : {parsedPreview.fournisseur}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  Facture n° {parsedPreview.numero_facture} du {new Date(parsedPreview.date_facture).toLocaleDateString('fr-CH')} · Total {formatCHF(parsedPreview.montant_ttc)}
                </p>
              </div>
              <button
                onClick={() => setImportModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Synthèse comptable */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <div>
                  <span className="text-stone-500 font-medium">Montant Net HT :</span>
                  <p className="font-semibold text-stone-900 text-sm">{formatCHF(parsedPreview.montant_ht)}</p>
                </div>
                <div>
                  <span className="text-stone-500 font-medium">TVA ({parsedPreview.taux_tva}%) :</span>
                  <p className="font-semibold text-stone-900 text-sm">{formatCHF(parsedPreview.montant_tva)}</p>
                </div>
                <div>
                  <span className="text-stone-500 font-medium">Total TTC :</span>
                  <p className="font-bold text-emerald-700 text-sm">{formatCHF(parsedPreview.montant_ttc)}</p>
                </div>
                <div>
                  <span className="text-stone-500 font-medium">Échéance 1er tiers :</span>
                  <p className="font-semibold text-stone-900 text-sm">CHF 700.00 (29.09.2026)</p>
                </div>
              </div>

              {/* Ventilation comptable détaillée */}
              {(() => {
                const previewVent = getInvoiceVentilation({
                  ...parsedPreview,
                  id: 'preview',
                  category_id: null,
                  statut: 'a_payer',
                  mode_paiement: 'virement',
                  created_at: '',
                  updated_at: '',
                  is_stock_invoice: true,
                } as any);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-emerald-900 block uppercase">
                        Part Vente Boutique (4000)
                      </span>
                      <p className="text-base font-bold text-emerald-950 mt-0.5">
                        {formatCHF(previewVent.partVenteTTC)} TTC
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Base HT : {formatCHF(previewVent.partVenteHT)} (17 réf. cosmétiques)
                      </p>
                    </div>

                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-purple-900 block uppercase">
                        Part Cabine Soins Pro (4200)
                      </span>
                      <p className="text-base font-bold text-purple-950 mt-0.5">
                        {formatCHF(previewVent.partCabineTTC)} TTC
                      </p>
                      <p className="text-[11px] text-purple-800 mt-0.5">
                        Base HT : {formatCHF(previewVent.partCabineHT)} (16 réf. grands formats)
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-amber-900 block uppercase">
                        Consommables & Matériel (4400)
                      </span>
                      <p className="text-base font-bold text-amber-950 mt-0.5">
                        {formatCHF(previewVent.partConsommablesTTC)} TTC
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Base HT : {formatCHF(previewVent.partConsommablesHT)} (Draps, parathermique)
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Option de déversement stock */}
              <label className="flex items-start gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={parsedPreview.updateStock}
                  onChange={e => setParsedPreview({ ...parsedPreview, updateStock: e.target.checked })}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="font-semibold text-emerald-950">
                    Déverser automatiquement les articles dans le stock de l'institut
                  </p>
                  <p className="text-emerald-800 text-[11.5px] mt-0.5">
                    Met à jour les quantités des produits existants et crée instantanément les nouvelles références (Vente et Cabine).
                  </p>
                </div>
              </label>

              {/* Tableau des articles détectés & Rapprochement Stock */}
              <div className="space-y-3">
                {/* Bandeau didactique d'ajustement de stock */}
                {parsedPreview.updateStock && (
                  <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="text-emerald-700" size={17} />
                        <span className="font-semibold text-emerald-950 text-xs">
                          Rapprochement et ajustement des stocks en direct
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                        +{totalUnits} unités à intégrer
                      </span>
                    </div>
                    <p className="text-[11.5px] text-emerald-900 leading-relaxed">
                      Pour chaque référence du bon de commande, le logiciel vérifie si le produit existe déjà en institut. Si la référence existe déjà, la quantité livrée est <strong>additionnée au stock actuel</strong>. Sinon, une nouvelle fiche produit est créée avec la quantité initiale.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/90 text-blue-900 border border-blue-200 font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                        <strong>{countExisting}</strong> références déjà en stock (+{qtyExisting} unités ajoutées)
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-900 border border-amber-200 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                        <strong>{countNew}</strong> nouvelles références (+{qtyNew} unités initiales)
                      </span>
                    </div>
                  </div>
                )}

                {/* Filtres d'affichage du tableau */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        previewFilter === 'all'
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Tous ({stockMatches.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('existing')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        previewFilter === 'existing'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      Déjà en stock ({countExisting})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('new')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        previewFilter === 'new'
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      Nouvelles références ({countNew})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('vente')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        previewFilter === 'vente'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      Vente Boutique
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('cabine')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        previewFilter === 'cabine'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                      }`}
                    >
                      Cabine Soins Pro
                    </button>
                  </div>
                  <span className="text-[11px] text-stone-500 font-normal">
                    {displayedMatches.length} ligne{displayedMatches.length > 1 ? 's' : ''} affichée{displayedMatches.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden max-h-84 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11.5px]">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 sticky top-0 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Réf</th>
                        <th className="py-2.5 px-3">Désignation</th>
                        <th className="py-2.5 px-3">Usage</th>
                        <th className="py-2.5 px-3 text-center">Stock actuel</th>
                        <th className="py-2.5 px-3 text-center">Qté sur bon</th>
                        <th className="py-2.5 px-3 text-center">Nouveau stock ajusté</th>
                        <th className="py-2.5 px-3 text-right">P.U.</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {displayedMatches.map((m, idx) => {
                        const badgeInfo = PRODUCT_USAGE_LABELS[m.item.usage_type] || PRODUCT_USAGE_LABELS.vente;
                        return (
                          <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-stone-500 whitespace-nowrap">
                              {m.item.reference || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-stone-900 leading-snug">{m.item.designation}</div>
                              {m.isExisting ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-medium mt-0.5">
                                  <CheckCircle2 size={11} className="text-blue-600" /> Produit déjà en stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium mt-0.5">
                                  <Plus size={11} className="text-amber-600" /> Nouvelle référence catalogue
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border ${badgeInfo.color}`}>
                                {badgeInfo.badge}
                              </span>
                            </td>
                            {/* Stock Actuel */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {m.isExisting ? (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-800 font-semibold text-xs">
                                  {m.stockActuel}
                                </span>
                              ) : (
                                <span className="text-stone-400 italic text-[11px]">0</span>
                              )}
                            </td>
                            {/* Quantité sur Bon de commande */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs">
                                +{m.quantiteBon}
                              </span>
                            </td>
                            {/* Nouveau Stock Ajusté (Actuel + Bon) */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {parsedPreview.updateStock ? (
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-800 text-xs">
                                  <span className="text-stone-500 font-normal text-[11px]">
                                    {m.stockActuel} + {m.quantiteBon} =
                                  </span>
                                  <span className="text-emerald-700 font-extrabold text-xs">
                                    {m.nouveauStock}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-stone-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-stone-600 whitespace-nowrap">
                              {m.item.rabais_pct === 100 ? (
                                <span className="line-through text-stone-400">{formatCHF(m.item.prix_unitaire)}</span>
                              ) : (
                                formatCHF(m.item.prix_unitaire)
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-stone-900 whitespace-nowrap">
                              {m.item.rabais_pct === 100 ? (
                                <span className="text-emerald-700 font-semibold">Gratuit (100%)</span>
                              ) : (
                                formatCHF(m.item.total_ttc)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={handleConfirmImport}
                disabled={importProcessing}
              >
                {importProcessing ? 'Enregistrement en cours…' : 'Valider et intégrer au stock'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de consultation des articles d'une facture existante */}
      {viewExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-stone-200 shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-stone-900 text-base">
                  Détail facture : {viewExpense.fournisseur}
                </h3>
                <p className="text-xs text-stone-500">
                  {viewExpense.numero_facture ? `N° ${viewExpense.numero_facture} · ` : ''}
                  Date : {new Date(viewExpense.date_facture).toLocaleDateString('fr-CH')} · Total : {formatCHF(viewExpense.montant_ttc)}
                </p>
              </div>
              <button onClick={() => setViewExpense(null)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {viewExpense.items && viewExpense.items.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                    <tr>
                      <th className="py-2 px-3">Réf</th>
                      <th className="py-2 px-3">Article</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-center">Qté</th>
                      <th className="py-2 px-3 text-right">P.U.</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {viewExpense.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono text-stone-400">{it.reference || '—'}</td>
                        <td className="py-2 px-3 font-medium text-stone-800">{it.designation}</td>
                        <td className="py-2 px-3">
                          <span className="capitalize text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                            {it.usage_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-stone-900">{it.quantite}</td>
                        <td className="py-2 px-3 text-right">{formatCHF(it.prix_unitaire)}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCHF(it.total_ttc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-stone-500 text-center py-4">Aucun détail article enregistré pour cette dépense.</p>
              )}
            </div>
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setViewExpense(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {ticketFile && (
        <TicketScanModal
          file={ticketFile}
          categories={categories}
          onClose={() => setTicketFile(null)}
          onSaved={async (message) => {
            setTicketFile(null);
            setNotice(message);
            await loadData();
          }}
        />
      )}

      {/* Modale de saisie manuelle d'une charge d'exploitation */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-base">Enregistrer une facture de dépense</h3>
              <button onClick={() => setManualModalOpen(false)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>

            <form onSubmit={handleSaveManual} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Fournisseur / Bénéficiaire *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Vaudoise Assurances, Meta Platforms, Loyer..."
                  value={manualForm.fournisseur}
                  onChange={e => setManualForm({ ...manualForm, fournisseur: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">N° de facture</label>
                  <input
                    type="text"
                    placeholder="Ex : POL-2026-981"
                    value={manualForm.numero_facture}
                    onChange={e => setManualForm({ ...manualForm, numero_facture: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Catégorie comptable *</label>
                  <select
                    value={manualForm.category_id}
                    onChange={e => setManualForm({ ...manualForm, category_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Date facture *</label>
                  <input
                    type="date"
                    required
                    value={manualForm.date_facture}
                    onChange={e => setManualForm({ ...manualForm, date_facture: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Date d'échéance</label>
                  <input
                    type="date"
                    value={manualForm.date_echeance}
                    onChange={e => setManualForm({ ...manualForm, date_echeance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Montant Total TTC (CHF) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : 450.00"
                    value={manualForm.montant_ttc}
                    onChange={e => setManualForm({ ...manualForm, montant_ttc: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Taux TVA suisse</label>
                  <select
                    value={manualForm.taux_tva}
                    onChange={e => setManualForm({ ...manualForm, taux_tva: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                  >
                    <option value="0">0 % (non assujettie / exonérée)</option>
                    <option value="8.1">8.1 % (taux normal)</option>
                    <option value="2.6">2.6 % (taux réduit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Statut *</label>
                  <select
                    value={manualForm.statut}
                    onChange={e => setManualForm({ ...manualForm, statut: e.target.value as ExpenseStatus })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                  >
                    <option value="a_payer">À payer</option>
                    <option value="payee">Déjà payée</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Mode de règlement</label>
                  <select
                    value={manualForm.mode_paiement}
                    onChange={e => setManualForm({ ...manualForm, mode_paiement: e.target.value as ExpensePaymentMode })}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent bg-white"
                  >
                    <option value="virement">Virement (BVR / QR)</option>
                    <option value="carte">Carte bancaire</option>
                    <option value="twint">TWINT</option>
                    <option value="especes">Espèces</option>
                    <option value="prelevement_auto">Prélèvement automatique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Notes / Référence complémentaire</label>
                <textarea
                  rows={2}
                  placeholder="Notes facultatives..."
                  value={manualForm.notes}
                  onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setManualModalOpen(false)}>Annuler</Button>
                <Button type="submit" variant="primary">Enregistrer la facture</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
