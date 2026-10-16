"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt, Plus, UploadCloud, FileText, CheckCircle2, Clock, Trash2,
  Sparkles, Package, FlaskConical, AlertCircle, ArrowRight, ShieldCheck,
  Building, Megaphone, Smartphone, HelpCircle, Eye, RefreshCw,
  Camera, Paperclip, Download, FilePlus2,
} from 'lucide-react';
import TicketScanModal from './TicketScanModal';
import PaymentsDialog from './PaymentsDialog';
import FactureImportModal from './FactureImportModal';
import DrivePanel from './DrivePanel';
import { attachJustificatif, openJustificatif } from '../../../../services/receipts';
import { downloadExpensesCsv } from '../../../../utils/expensesExport';
import { AnimatedNumber, Button, Callout, Metric, MetricStrip } from '../../../../components/admin/ui';
import {
  createExpense,
  deleteExpense,
  getInvoiceVentilation,
  listExpenseCategories,
  listExpensePayments,
  listExpenses,
  updateExpense,
  DEFAULT_SWISS_CATEGORIES,
} from '../../../../services/financeService';
import { listProducts } from '../../../../services/caisse';
import {
  Expense,
  ExpenseCategory,
  ExpenseItem,
  ExpensePayment,
  ExpensePaymentMode,
  ExpenseStatus,
  EXPENSE_PAYMENT_MODE_LABELS,
  EXPENSE_STATUS_LABELS,
  PRODUCT_USAGE_LABELS,
  ProductUsageType,
  situationPaiement,
} from '../../../../types/finance';
import { Product, formatCHF } from '../../../../types/caisse';
import { zurichDate } from '../../../../components/admin/mobile/home/zurich';

export default function DepensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Versements et échéances de toutes les factures (`expense_payments`).
  const [payments, setPayments] = useState<ExpensePayment[]>([]);
  // Facture dont on gère le paiement (échéancier, versements).
  const [paymentsFor, setPaymentsFor] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filtre et recherche
  const [activeGroup, setActiveGroup] = useState<string>('tous');
  const [searchQuery, setSearchQuery] = useState('');

  // Modales
  // Facture fournisseur en cours d'import (lecture IA, relecture, import atomique).
  const [factureFile, setFactureFile] = useState<File | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  // Ticket photographié en cours de lecture / relecture.
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
  // Pièce à joindre à une dépense saisie sans justificatif.
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<Expense | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);

  // Formulaire dépense manuelle
  const [manualForm, setManualForm] = useState({
    fournisseur: '',
    numero_facture: '',
    date_facture: zurichDate(),
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
      const [cats, exps, prods, pays] = await Promise.all([
        listExpenseCategories(),
        listExpenses(),
        listProducts(true),
        listExpensePayments().catch(err => {
          setError(`Les versements n'ont pas pu être lus (${err instanceof Error ? err.message : err}) : les montants « à payer » sont incomplets.`);
          return [] as ExpensePayment[];
        }),
      ]);
      setCategories(cats);
      setExpenses(exps);
      setExistingProducts(prods);
      setPayments(pays);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleFacturePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setFactureFile(file);
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

      const created = await createExpense({
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
        date_facture: zurichDate(),
        date_echeance: '',
        montant_ttc: '',
        taux_tva: '0',
        category_id: categories[0]?.id || 'cat-6200',
        statut: 'a_payer',
        mode_paiement: 'virement',
        notes: '',
      });
      await loadData();
      if (created.statut === 'a_payer' && created.mode_paiement === 'echelonne') setPaymentsFor(created.id);
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

  const handleOpenJustificatif = async (exp: Expense) => {
    try {
      await openJustificatif(exp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAttachPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = attachTarget;
    if (!file || !target) return;
    setAttaching(target.id);
    try {
      await attachJustificatif(target, file);
      setNotice(`Pièce jointe à « ${target.fournisseur} »${target.numero_facture ? ` n° ${target.numero_facture}` : ''}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAttaching(null);
      setAttachTarget(null);
    }
  };

  const exportYears = useMemo(() => {
    const years = new Set(expenses.map(e => Number(e.date_facture.slice(0, 4))).filter(Boolean));
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [expenses]);

  /**
   * Une dépense qui a reçu un versement ne se supprime pas (CO art. 957a) :
   * elle s'annule — ses versements aussi, la trace reste. Sans versement, une
   * erreur de saisie peut encore être supprimée.
   */
  const handleDelete = async (exp: Expense) => {
    const name = exp.fournisseur;
    const aDesVersements = payments.some(p => p.expense_id === exp.id && p.date_paiement);
    try {
      if (exp.is_stock_invoice) {
        if (!confirm(`« ${name} » a fait entrer des articles en stock : elle ne peut pas être supprimée.\n\nL'annuler ? Ses articles sortiront du stock (la trace reste), ses versements seront annulés, et elle ne comptera plus nulle part. Une facture de stock annulée peut être importée à nouveau, mais ne se rétablit pas.`)) return;
        await updateExpense(exp.id, { statut: 'annulee' });
        setNotice(`Facture « ${name} » annulée : ses articles sont sortis du stock.`);
      } else if (aDesVersements) {
        if (!confirm(`« ${name} » a des versements enregistrés : elle ne peut pas être supprimée.\n\nL'annuler ? Elle restera dans la liste, barrée, et ne comptera plus ni dans les charges ni dans la trésorerie (ses versements seront annulés).`)) return;
        await updateExpense(exp.id, { statut: 'annulee' });
        setNotice(`Dépense « ${name} » annulée. Ses versements sont annulés, la trace reste.`);
      } else {
        if (!confirm(`Supprimer la dépense « ${name} » ?`)) return;
        await deleteExpense(exp.id);
        setNotice(`Dépense « ${name} » supprimée.`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Filtrage
  const filteredExpenses = expenses.filter(exp => {
    if (activeGroup === 'a_payer' && situationPaiement(exp, payments).reste <= 0) return false;
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
  // Ce qui reste dû, versements déjà faits déduits (une facture payée en partie compte pour son solde).
  const restes = expenses.map(e => situationPaiement(e, payments).reste);
  const totalAPayer = restes.reduce((acc, r) => acc + r, 0);
  const countAPayer = restes.filter(r => r > 0).length;

  const ventilationTotals = expenses.reduce((acc, e) => {
    if (e.statut === 'annulee') return acc;
    const v = getInvoiceVentilation(e);
    acc.vente += v.partVenteTTC;
    acc.cabine += v.partCabineTTC;
    acc.conso += v.partConsommablesTTC;
    return acc;
  }, { vente: 0, cabine: 0, conso: 0 });

  return (
    <div className="space-y-6">

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="sr-only text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only">Factures et dépenses</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Photographiez un ticket ou importez une facture : l’IA lit la pièce, vous relisez, elle est archivée avec la dépense.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" icon={Plus} onClick={() => setManualModalOpen(true)}>Autre dépense</Button>
          <label className="cursor-pointer" title="Facture fournisseur détaillée (PDF ou photo) : ses articles entrent en stock">
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={handleFacturePicked} />
            <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-stone-100 px-4 text-[15px] font-semibold text-stone-900 transition-colors hover:bg-stone-200 lg:h-10 lg:text-[14px]">
              <UploadCloud size={16} /> Facture fournisseur → stock
            </span>
          </label>
          <label className="cursor-pointer">
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={handleTicketPicked} />
            <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-[15px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover lg:h-10 lg:text-[14px]">
              <Camera size={16} /> Photographier un ticket
            </span>
          </label>
        </div>
      </header>

      <DrivePanel onNotice={setNotice} />
      <input ref={attachInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleAttachPicked} />

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
        <Metric
          size="lg"
          tone={countAPayer > 0 ? 'warm' : 'muted'}
          label="À payer"
          value={<AnimatedNumber value={totalAPayer} format={formatCHF} />}
          hint={countAPayer > 0 ? `${countAPayer} facture${countAPayer > 1 ? 's' : ''} en attente` : 'Tout est réglé'}
        />
        <Metric size="lg" label="Total des dépenses" value={formatCHF(totalTTC)} hint={`${expenses.length} pièce${expenses.length > 1 ? 's' : ''}`} />
        <Metric size="lg" label="Achats revente" value={formatCHF(ventilationTotals.vente)} hint="compte 4000" />
        <Metric size="lg" label="Achats cabine" value={formatCHF(ventilationTotals.cabine)} hint="compte 4200" />
      </MetricStrip>

      {/* Barre de filtres */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
          {[
            { id: 'tous', label: 'Toutes' },
            { id: 'a_payer', label: `À payer (${countAPayer})` },
            { id: 'marchandises', label: 'Achats et stock' },
            { id: 'exploitation', label: 'Charges' },
            { id: 'avs', label: 'AVS' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveGroup(f.id)}
              aria-pressed={activeGroup === f.id}
              className={`inline-flex h-9 items-center whitespace-nowrap border px-3.5 text-[13.5px] font-medium transition-colors cursor-pointer ${
                activeGroup === f.id
                  ? 'border-stone-900 bg-accent text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
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
            className="h-9 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 sm:w-56"
          />
          <select
            value={exportYear}
            onChange={e => setExportYear(Number(e.target.value))}
            aria-label="Année à exporter"
            className="h-9 rounded-lg border border-stone-200 bg-white px-2 text-[13.5px] outline-none focus:border-accent"
          >
            {exportYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            type="button"
            onClick={() => downloadExpensesCsv(expenses, exportYear, payments)}
            title="Export CSV pour la fiduciaire : fournisseur, adresse, n° IDE, compte, TVA par taux, justificatif"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-stone-100 px-3 text-[13.5px] font-medium text-stone-800 hover:bg-stone-200 cursor-pointer"
          >
            <Download size={13} /> Export fiduciaire
          </button>
        </div>
      </div>

      {/* Liste des factures */}
      <div className="data-frame overflow-hidden rounded-xl">
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
                Importez une facture fournisseur (« Facture fournisseur → stock ») pour faire entrer ses articles en stock, ou photographiez un ticket.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[12.5px] font-semibold text-stone-500">
                  <th className="py-2.5 px-4">Fournisseur</th>
                  <th className="py-2.5 px-4">Compte</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Paiement</th>
                  <th className="py-2.5 px-4 text-right">Montant TTC</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="zebra">
                {filteredExpenses.map(exp => {
                  const stat = EXPENSE_STATUS_LABELS[exp.statut] || { label: exp.statut, color: 'bg-stone-100 text-stone-600' };
                  const sit = situationPaiement(exp, payments);
                  return (
                    <tr key={exp.id} className="transition-colors hover:bg-row-hover">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-[14px] font-semibold text-stone-950">
                          {exp.fournisseur}
                          {exp.is_stock_invoice && (
                            <span className="bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 rounded">
                              Stock lié
                            </span>
                          )}
                          {exp.type_piece === 'ticket' && (
                            <span className="bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 rounded">
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
                                <p className="mt-1 text-[12px] text-stone-500 tabular-nums">
                                  Vente {formatCHF(vent.partVenteTTC)} · Cabine {formatCHF(vent.partCabineTTC)}
                                  {vent.partConsommablesTTC > 0 && <> · Matériel {formatCHF(vent.partConsommablesTTC)}</>}
                                </p>
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
                        {sit.etat === 'partielle' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 border bg-sky-50 text-sky-800 border-sky-200 rounded">
                            Payée {sit.nbPayes}/{sit.nbEcheances}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 border ${stat.color}`}>
                            {stat.label}
                          </span>
                        )}
                        {sit.reste > 0 && sit.paye > 0 && (
                          <div className="text-[11px] text-stone-600 mt-0.5 tabular-nums">Reste {formatCHF(sit.reste)}</div>
                        )}
                        {sit.prochaine && (
                          <div className={`text-[11px] mt-0.5 tabular-nums ${(sit.prochaine.date_prevue ?? '') < zurichDate() ? 'text-red-700' : 'text-stone-500'}`}>
                            Prochaine : {new Date(`${sit.prochaine.date_prevue}T12:00:00`).toLocaleDateString('fr-CH')} · {formatCHF(sit.prochaine.montant)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-stone-900">
                        {formatCHF(exp.montant_ttc)}
                        {exp.taux_tva > 0 && (
                          <div className="text-[11px] text-stone-400">TVA {exp.taux_tva}% incluse</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {exp.justificatif_path || exp.document_url?.startsWith('http') ? (
                            <button
                              onClick={() => handleOpenJustificatif(exp)}
                              title="Voir le justificatif archivé"
                              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            >
                              <Paperclip size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => { setAttachTarget(exp); attachInput.current?.click(); }}
                              disabled={attaching === exp.id}
                              title="Joindre la pièce (photo ou PDF)"
                              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 cursor-pointer disabled:opacity-50"
                            >
                              <FilePlus2 size={15} className={attaching === exp.id ? 'animate-pulse' : ''} />
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
                            onClick={() => setPaymentsFor(exp.id)}
                            title="Paiements : versements et échéancier (payer en plusieurs fois)"
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              sit.etat === 'payee'
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                : sit.etat === 'partielle'
                                  ? 'text-sky-700 bg-sky-50 hover:bg-sky-100'
                                  : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                          {exp.statut !== 'annulee' && (
                            <button
                              onClick={() => handleDelete(exp)}
                              title={exp.is_stock_invoice || payments.some(p => p.expense_id === exp.id && p.date_paiement) ? 'Annuler la dépense' : 'Supprimer'}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
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

      {factureFile && (
        <FactureImportModal
          file={factureFile}
          categories={categories}
          products={existingProducts}
          expenses={expenses}
          onClose={() => setFactureFile(null)}
          onDone={async (message, expenseId) => {
            setFactureFile(null);
            setNotice(message);
            await loadData();
            // Son paiement (ou son échéancier) se saisit tout de suite.
            setPaymentsFor(expenseId);
          }}
        />
      )}

      {/* Modale de consultation des articles d'une facture existante */}
      {viewExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-3xl w-full border border-stone-200 shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
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
                  <tbody className="zebra">
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

      {paymentsFor && (() => {
        const exp = expenses.find(e => e.id === paymentsFor);
        return exp ? (
          <PaymentsDialog
            expense={exp}
            payments={payments.filter(p => p.expense_id === exp.id)}
            onClose={() => setPaymentsFor(null)}
            onChanged={loadData}
          />
        ) : null;
      })()}

      {/* Modale de saisie manuelle d'une charge d'exploitation */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden">
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
