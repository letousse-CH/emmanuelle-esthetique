"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpenCheck, Download, RefreshCw, AlertCircle, Loader2, FileText, Ban,
  ChevronDown, ChevronRight, TrendingUp, X, Check,
} from 'lucide-react';
import { cancelTransaction, listTransactions } from '../../../../services/caisse';
import { downloadFacture } from '../../../../utils/factureDownload';
import {
  MODES_PAIEMENT, MODE_PAIEMENT_LABELS, formatAmount, formatCHF,
} from '../../../../types/caisse';
import type { ModePaiement, TransactionWithItems } from '../../../../types/caisse';

type PeriodMode = 'mois' | 'annee';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Bornes locales (heure suisse dans le navigateur de l'institut) → ISO. */
function periodBounds(mode: PeriodMode, year: number, month: number) {
  const start = mode === 'mois' ? new Date(year, month, 1) : new Date(year, 0, 1);
  const end = mode === 'mois'
    ? new Date(year, month + 1, 0, 23, 59, 59, 999)
    : new Date(year, 11, 31, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/** Lundi de la semaine en cours — convention suisse. */
function startOfWeek(d: Date) {
  const s = startOfDay(d);
  const offset = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - offset);
  return s;
}

export default function JournalClient() {
  const now = new Date();
  const [mode, setMode]   = useState<PeriodMode>('mois');
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [rows, setRows]       = useState<TransactionWithItems[]>([]);
  const [yearRows, setYearRows] = useState<TransactionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionWithItems | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { from, to } = periodBounds(mode, year, month);
    // Année civile en cours, relue à chaque chargement : les indicateurs du
    // haut suivent le calendrier réel, même si l'onglet reste ouvert la nuit
    // du 31 décembre.
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1).toISOString();
    const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();
    try {
      const [period, currentYear] = await Promise.all([
        listTransactions(from, to),
        listTransactions(yearStart, yearEnd),
      ]);
      setRows(period);
      setYearRows(currentYear);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [mode, year, month]);

  useEffect(() => { load(); }, [load]);

  // ── Indicateurs « à l'instant T », indépendants de la période affichée ─────
  const kpis = useMemo(() => {
    const paid = yearRows.filter(t => t.status === 'payee');
    const today = startOfDay(new Date()).getTime();
    const week = startOfWeek(new Date()).getTime();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const sum = (since: number) => paid
      .filter(t => new Date(t.created_at).getTime() >= since)
      .reduce((acc, t) => acc + Number(t.total_ttc), 0);
    return {
      jour: sum(today),
      semaine: sum(week),
      mois: sum(monthStart),
      annee: paid.reduce((acc, t) => acc + Number(t.total_ttc), 0),
    };
  }, [yearRows]);

  const paidRows = useMemo(() => rows.filter(t => t.status === 'payee'), [rows]);

  const totals = useMemo(() => paidRows.reduce(
    (acc, t) => ({
      ht: acc.ht + Number(t.total_ht),
      tva: acc.tva + Number(t.total_tva),
      ttc: acc.ttc + Number(t.total_ttc),
    }),
    { ht: 0, tva: 0, ttc: 0 },
  ), [paidRows]);

  // ── Ventilation par mode de paiement ──────────────────────────────────────
  const byPayment = useMemo(() => {
    const map = new Map<ModePaiement, { total: number; count: number }>();
    for (const m of MODES_PAIEMENT) map.set(m.value, { total: 0, count: 0 });
    for (const t of paidRows) {
      const entry = map.get(t.mode_paiement) ?? { total: 0, count: 0 };
      entry.total += Number(t.total_ttc);
      entry.count += 1;
      map.set(t.mode_paiement, entry);
    }
    return MODES_PAIEMENT.map(m => ({ ...m, ...map.get(m.value)! }));
  }, [paidRows]);

  // ── Évolution : par jour sur un mois, par mois sur une année ──────────────
  const series = useMemo(() => {
    if (mode === 'mois') {
      const days = new Date(year, month + 1, 0).getDate();
      const buckets = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), value: 0 }));
      for (const t of paidRows) buckets[new Date(t.created_at).getDate() - 1].value += Number(t.total_ttc);
      return buckets;
    }
    const buckets = MONTH_NAMES.map(m => ({ label: m.slice(0, 3), value: 0 }));
    for (const t of paidRows) buckets[new Date(t.created_at).getMonth()].value += Number(t.total_ttc);
    return buckets;
  }, [paidRows, mode, year, month]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i);
  }, []);

  const periodLabel = mode === 'mois' ? `${MONTH_NAMES[month]} ${year}` : String(year);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleDownload = async (t: TransactionWithItems) => {
    setDownloading(t.id);
    try {
      await downloadFacture(t.id, t.numero);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible.');
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Export « livre de caisse » pour la fiducie : une ligne par prestation, avec
   * les montants HT / TVA / TTC de la ligne — la somme de la colonne TTC redonne
   * exactement le CA de la période. Séparateur `;` et BOM UTF-8 : le fichier
   * s'ouvre d'un double-clic dans Excel en Suisse romande.
   *
   * Les factures annulées figurent avec des montants à 0.00 : elles ne
   * gonflent pas le CA, mais la numérotation reste continue sous les yeux du
   * comptable, ce qu'exige le contrôle d'intégralité (CO art. 957a).
   */
  const exportCSV = () => {
    const header = [
      'Date', 'Heure', 'N° Facture', 'Client', 'Prestation', 'Quantité',
      'Mode de paiement', 'Taux TVA (%)', 'Montant HT (CHF)', 'Montant TVA (CHF)',
      'Montant TTC (CHF)', 'Statut', 'Note',
    ];

    const ordered = [...rows].sort((a, b) =>
      a.annee - b.annee || a.number_seq - b.number_seq);

    const lines: string[][] = [];
    for (const t of ordered) {
      const d = new Date(t.created_at);
      const cancelled = t.status === 'annulee';
      const statut = cancelled
        ? `Annulée le ${t.cancelled_at ? new Date(t.cancelled_at).toLocaleDateString('fr-CH') : '—'}${t.cancel_reason ? ` — ${t.cancel_reason}` : ''}`
        : 'Payée';

      for (const item of t.transaction_items) {
        const ttc = Number(item.total_ttc);
        const ht = Math.round((ttc / (1 + Number(item.taux_tva) / 100)) * 100) / 100;
        lines.push([
          d.toLocaleDateString('fr-CH'),
          d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
          t.numero,
          t.client_label,
          item.description,
          String(Number(item.quantite)),
          MODE_PAIEMENT_LABELS[t.mode_paiement],
          String(Number(item.taux_tva)),
          (cancelled ? 0 : ht).toFixed(2),
          (cancelled ? 0 : ttc - ht).toFixed(2),
          (cancelled ? 0 : ttc).toFixed(2),
          statut,
          t.note ?? '',
        ]);
      }
    }

    lines.push([]);
    lines.push([
      `Total ${periodLabel}`, '', '', '', '', '', '', '',
      totals.ht.toFixed(2), totals.tva.toFixed(2), totals.ttc.toFixed(2), '', '',
    ]);

    const csv = [header, ...lines]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const slug = mode === 'mois'
      ? `${year}-${String(month + 1).padStart(2, '0')}`
      : String(year);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livre-de-caisse-${slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <BookOpenCheck size={20} className="text-sage" /> Journal &amp; chiffre d&apos;affaires
          </h1>
          <p className="text-stone-400 text-sm mt-1">Livre de caisse — {periodLabel}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300 rounded-lg text-sm transition-all cursor-pointer"
          >
            <RefreshCw size={13} /> Actualiser
          </button>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white hover:bg-sage rounded-lg text-sm transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Download size={13} /> Export fiducie
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-mono text-xs">{error}</span>
            <p className="text-xs mt-1">
              Si l&apos;erreur mentionne une table manquante, applique
              <code className="mx-1 px-1 bg-red-100 rounded">supabase/migrations/20260731_caisse.sql</code>
              sur ton projet Supabase.
            </p>
          </div>
        </div>
      )}

      {/* KPIs — toujours « à maintenant », quelle que soit la période affichée */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Aujourd'hui"    value={formatCHF(kpis.jour)}    loading={loading} />
        <Kpi label="Cette semaine"  value={formatCHF(kpis.semaine)} loading={loading} />
        <Kpi label="Ce mois"        value={formatCHF(kpis.mois)}    loading={loading} />
        <Kpi label={`Année ${new Date().getFullYear()}`} value={formatCHF(kpis.annee)} loading={loading} accent />
      </div>

      {/* Sélecteur de période */}
      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          {(['mois', 'annee'] as PeriodMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-4 py-2 text-sm transition-colors cursor-pointer ${
                mode === m ? 'bg-sage/10 text-sage font-medium' : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              {m === 'mois' ? 'Par mois' : 'Par année'}
            </button>
          ))}
        </div>

        {mode === 'mois' && (
          <>
            <label htmlFor="journal-month" className="sr-only">Mois</label>
            <select
              id="journal-month" value={month} onChange={e => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </>
        )}

        <label htmlFor="journal-year" className="sr-only">Année</label>
        <select
          id="journal-year" value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage outline-none cursor-pointer"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-xs text-stone-400">CA {periodLabel}</span>
          <span className="text-lg font-semibold text-stone-900 tabular-nums">{formatCHF(totals.ttc)}</span>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-stone-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">
              {mode === 'mois' ? 'Recettes par jour' : 'Recettes par mois'}
            </h2>
            <span className="text-xs text-stone-400 font-medium">{paidRows.length} encaissement{paidRows.length !== 1 ? 's' : ''}</span>
          </div>
          <SeriesChart data={series} loading={loading} />
        </div>

        <div className="lg:col-span-2 bg-white border border-stone-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-6">Par mode de paiement</h2>
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-stone-100 rounded animate-pulse" />)}
            </div>
          ) : totals.ttc === 0 ? (
            <p className="text-stone-400 text-sm italic">Aucune recette sur la période.</p>
          ) : (
            <ul className="space-y-4">
              {byPayment.map(m => {
                const pct = totals.ttc > 0 ? (m.total / totals.ttc) * 100 : 0;
                return (
                  <li key={m.value}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-stone-700 font-medium">{m.label}</span>
                      <span className="text-xs text-stone-400 tabular-nums">
                        {formatCHF(m.total)} <span className="text-stone-300">· {Math.round(pct)} %</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sage/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="mt-6 pt-4 border-t border-stone-100 space-y-1.5">
            <div className="flex justify-between text-xs"><dt className="text-stone-400">Total HT</dt><dd className="text-stone-600 tabular-nums">{formatCHF(totals.ht)}</dd></div>
            <div className="flex justify-between text-xs"><dt className="text-stone-400">TVA</dt><dd className="text-stone-600 tabular-nums">{formatCHF(totals.tva)}</dd></div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-stone-50"><dt className="text-stone-700 font-medium">Total TTC</dt><dd className="text-stone-900 font-semibold tabular-nums">{formatCHF(totals.ttc)}</dd></div>
          </dl>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Journal des recettes</h2>
          <span className="text-xs text-stone-400">{rows.length} écriture{rows.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-stone-400 text-sm">
            <div className="w-4 h-4 rounded-full border border-stone-200 border-t-sage animate-spin" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-stone-400 text-sm italic">Aucun encaissement sur cette période.</p>
            <Link href="/admin/caisse" className="text-sage text-sm font-medium hover:underline">Encaisser un soin →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-stone-50">
            {rows.map(t => (
              <JournalRow
                key={t.id}
                tx={t}
                open={expanded.has(t.id)}
                downloading={downloading === t.id}
                onToggle={() => toggle(t.id)}
                onDownload={() => handleDownload(t)}
                onCancel={() => setCancelTarget(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {cancelTarget && (
        <CancelDialog
          tx={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => { setCancelTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, loading, accent }: {
  label: string; value: string; loading?: boolean; accent?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-2xl shadow-sm p-5 space-y-2 ${accent ? 'border-sage/30' : 'border-stone-100'}`}>
      <p className="text-[11px] text-stone-400 font-medium flex items-center gap-1.5">
        {accent && <TrendingUp size={12} className="text-sage" />}{label}
      </p>
      {loading
        ? <div className="h-7 w-24 bg-stone-100 rounded animate-pulse" />
        : <p className="text-xl font-semibold text-stone-900 tabular-nums">{value}</p>}
    </div>
  );
}

function SeriesChart({ data, loading }: { data: { label: string; value: number }[]; loading: boolean }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((a, d) => a + d.value, 0);

  if (loading) {
    return (
      <div className="h-44 flex items-end gap-1">
        {data.map((_, i) => (
          <div key={i} className="flex-1 bg-stone-100 rounded-t animate-pulse" style={{ height: `${25 + (i % 5) * 12}%` }} />
        ))}
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="h-44 flex items-center justify-center">
        <p className="text-stone-400 text-sm italic">Aucune recette sur la période</p>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-44">
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group min-w-0">
            <span className="text-[9px] font-semibold text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums">
              {formatAmount(d.value)}
            </span>
            <div
              className="w-full rounded-t bg-sage/25 group-hover:bg-sage/50 transition-colors duration-150"
              style={{ height: `${h}%` }}
              title={`${d.label} — ${formatCHF(d.value)}`}
            />
            <span className="text-[9px] text-stone-400 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function JournalRow({ tx, open, downloading, onToggle, onDownload, onCancel }: {
  tx: TransactionWithItems;
  open: boolean;
  downloading: boolean;
  onToggle: () => void;
  onDownload: () => void;
  onCancel: () => void;
}) {
  const d = new Date(tx.created_at);
  const cancelled = tx.status === 'annulee';

  return (
    <li className={cancelled ? 'opacity-55' : ''}>
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50/50 transition-colors">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Masquer' : 'Afficher'} le détail de la facture ${tx.numero}`}
          className="shrink-0 p-1 text-stone-300 hover:text-stone-700 transition-colors cursor-pointer"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <div className="w-28 shrink-0 hidden sm:block">
          <p className="text-xs text-stone-500 tabular-nums">{d.toLocaleDateString('fr-CH')}</p>
          <p className="text-[10px] text-stone-300 tabular-nums">{d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-900 font-medium truncate">
            {tx.client_label}
            {cancelled && <span className="ml-2 text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Annulée</span>}
          </p>
          <p className="text-[11px] text-stone-400 tabular-nums">
            {tx.numero} · {MODE_PAIEMENT_LABELS[tx.mode_paiement]}
            <span className="sm:hidden"> · {d.toLocaleDateString('fr-CH')}</span>
          </p>
        </div>

        <span className={`text-sm font-medium tabular-nums shrink-0 ${cancelled ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
          {formatCHF(tx.total_ttc)}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDownload}
            disabled={downloading}
            aria-label={`Télécharger la facture ${tx.numero}`} title="Quittance PDF"
            className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-all disabled:opacity-40 cursor-pointer"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          </button>
          {!cancelled && (
            <button
              onClick={onCancel}
              aria-label={`Annuler la facture ${tx.numero}`} title="Annuler cette écriture"
              className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
            >
              <Ban size={14} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-5 pb-4 pl-14 space-y-1.5 bg-stone-50/40">
          {tx.transaction_items.map(item => (
            <div key={item.id} className="flex items-center justify-between text-xs text-stone-500 gap-3">
              <span className="truncate">
                {Number(item.quantite) !== 1 && <span className="text-stone-400">{Number(item.quantite)} × </span>}
                {item.description}
                {Number(item.taux_tva) > 0 && <span className="text-stone-300"> (TVA {Number(item.taux_tva)} %)</span>}
              </span>
              <span className="tabular-nums shrink-0">{formatCHF(item.total_ttc)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-stone-200/60">
            <span className="text-stone-400">HT {formatCHF(tx.total_ht)} · TVA {formatCHF(tx.total_tva)}</span>
            <span className="text-stone-700 font-medium tabular-nums">{formatCHF(tx.total_ttc)}</span>
          </div>
          {tx.note && <p className="text-xs text-stone-400 italic pt-1">Note : {tx.note}</p>}
          {tx.cancel_reason && <p className="text-xs text-red-500 pt-1">Motif d&apos;annulation : {tx.cancel_reason}</p>}
        </div>
      )}
    </li>
  );
}

function CancelDialog({ tx, onClose, onDone }: {
  tx: TransactionWithItems; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true); setError(null);
    try {
      await cancelTransaction(tx.id, reason.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annulation impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={`Annuler la facture ${tx.numero}`}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Annuler {tx.numero}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-stone-500 leading-relaxed">
          L&apos;écriture de <strong className="text-stone-700">{formatCHF(tx.total_ttc)}</strong> restera dans le
          journal avec son numéro — c&apos;est ce qu&apos;exige la traçabilité comptable. Elle sera simplement
          exclue du chiffre d&apos;affaires.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="cancel-reason" className="block text-[11px] font-medium text-stone-500 mb-1">Motif *</label>
            <input
              id="cancel-reason" type="text" value={reason} onChange={e => setReason(e.target.value)}
              required autoFocus placeholder="Erreur de saisie, soin non réalisé…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm hover:border-stone-300 transition-all cursor-pointer"
            >
              Revenir
            </button>
            <button
              type="submit" disabled={saving || !reason.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2.5 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Annulation…' : "Confirmer l'annulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
