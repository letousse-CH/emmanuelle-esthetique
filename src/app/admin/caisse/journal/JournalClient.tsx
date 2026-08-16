"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpenCheck, Download, RefreshCw, AlertCircle, Loader2, FileText, Ban,
  ChevronDown, ChevronRight, TrendingUp, X, Check, PenLine, Ticket, Package,
} from 'lucide-react';
import { cancelTransaction, listTransactions } from '../../../../services/caisse';
import { downloadFacture } from '../../../../utils/factureDownload';
import { setCaisseCorrection } from '../../../../utils/caissePrefill';
import {
  MODES_PAIEMENT, MODE_PAIEMENT_LABELS, formatAmount, formatCHF, ligneMarge, recetteEncaissee,
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

/** Quantités d'articles : entières la plupart du temps, donc sans centimes forcés. */
function qteLabel(n: number): string {
  return Number.isInteger(n) ? String(n) : formatAmount(n);
}

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
  const [dialog, setDialog] = useState<{ tx: TransactionWithItems; intent: 'cancel' | 'correct' } | null>(null);
  const router = useRouter();

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
  // Tous les cumuls passent par `recetteEncaissee` : la part réglée en bon
  // cadeau a déjà été encaissée à la vente du bon, la recompter doublerait le CA.
  const kpis = useMemo(() => {
    const paid = yearRows.filter(t => t.status === 'payee');
    const today = startOfDay(new Date()).getTime();
    const week = startOfWeek(new Date()).getTime();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const sum = (since: number) => paid
      .filter(t => new Date(t.created_at).getTime() >= since)
      .reduce((acc, t) => acc + recetteEncaissee(t), 0);
    return {
      jour: sum(today),
      semaine: sum(week),
      mois: sum(monthStart),
      annee: paid.reduce((acc, t) => acc + recetteEncaissee(t), 0),
    };
  }, [yearRows]);

  const paidRows = useMemo(() => rows.filter(t => t.status === 'payee'), [rows]);

  const totals = useMemo(() => paidRows.reduce(
    (acc, t) => {
      const recette = recetteEncaissee(t);
      const part = Number(t.total_ttc) > 0 ? recette / Number(t.total_ttc) : 0;
      return {
        // HT et TVA sont ramenés au prorata de la part réellement encaissée :
        // sans ça, une prestation réglée par bon gonflerait la base TVA d'une
        // période où rien n'est entré en caisse.
        ht: acc.ht + Number(t.total_ht) * part,
        tva: acc.tva + Number(t.total_tva) * part,
        ttc: acc.ttc + recette,
        bons: acc.bons + Number(t.montant_bon ?? 0),
      };
    },
    { ht: 0, tva: 0, ttc: 0, bons: 0 },
  ), [paidRows]);

  /**
   * Marge commerciale sur la marchandise sortie du stock pendant la période.
   *
   * Volontairement calculée sur les articles VENDUS, sans la proratisation
   * appliquée au CA : un produit remis contre un bon cadeau a bien quitté le
   * rayon ce mois-ci, même si l'argent était entré le jour de la vente du bon.
   * Ce n'est donc pas un chiffre d'affaires et il ne s'additionne pas au CA —
   * c'est ce que les articles ont rapporté au-delà de ce qu'ils ont coûté.
   *
   * Le coût vient de `prix_achat_unitaire`, figé sur la ligne à la vente :
   * renégocier un tarif fournisseur ne réécrit jamais une marge passée.
   */
  const margeProduits = useMemo(() => {
    let marge = 0;
    let ventes = 0;
    let articles = 0;
    let sansCout = 0;
    for (const t of paidRows) {
      for (const item of t.transaction_items) {
        if (!item.product_id) continue;
        articles += Number(item.quantite);
        ventes += Number(item.total_ttc);
        const m = ligneMarge(item);
        if (m === null) sansCout += 1; else marge += m;
      }
    }
    return { marge, ventes, articles, sansCout };
  }, [paidRows]);

  // ── Ventilation par mode de paiement ──────────────────────────────────────
  const byPayment = useMemo(() => {
    const map = new Map<ModePaiement, { total: number; count: number }>();
    for (const m of MODES_PAIEMENT) map.set(m.value, { total: 0, count: 0 });
    for (const t of paidRows) {
      const recette = recetteEncaissee(t);
      if (recette <= 0) continue; // soldé par bon : aucun encaissement
      const entry = map.get(t.mode_paiement) ?? { total: 0, count: 0 };
      entry.total += recette;
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
      for (const t of paidRows) buckets[new Date(t.created_at).getDate() - 1].value += recetteEncaissee(t);
      return buckets;
    }
    const buckets = MONTH_NAMES.map(m => ({ label: m.slice(0, 3), value: 0 }));
    for (const t of paidRows) buckets[new Date(t.created_at).getMonth()].value += recetteEncaissee(t);
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
      'Montant encaissé TTC (CHF)', 'Dont bon cadeau (CHF)', 'Valeur prestation (CHF)',
      'Nature', 'Prix d\'achat unitaire (CHF)', 'Marge (CHF)',
      'Statut', 'Note',
    ];

    const ordered = [...rows].sort((a, b) =>
      a.annee - b.annee || a.number_seq - b.number_seq);

    const lines: string[][] = [];
    for (const t of ordered) {
      const d = new Date(t.created_at);
      const cancelled = t.status === 'annulee';
      const total = Number(t.total_ttc);
      // Part encaissée de la facture : 1 si tout est payé en argent, 0 si tout
      // est réglé par bon. Chaque ligne est ventilée dans la même proportion,
      // pour que la colonne « encaissé » se somme exactement au CA de la période.
      const partEncaissee = cancelled || total <= 0 ? 0 : recetteEncaissee(t) / total;

      const statut = cancelled
        ? `Annulée le ${t.cancelled_at ? new Date(t.cancelled_at).toLocaleDateString('fr-CH') : '—'}${t.cancel_reason ? ` — ${t.cancel_reason}` : ''}`
        : Number(t.montant_bon) > 0
          ? (partEncaissee === 0 ? 'Réglée par bon cadeau' : 'Payée — bon cadeau partiel')
          : 'Payée';

      const note = [
        t.note ?? '',
        t.corrige_transaction_id ? 'Rectifie une facture annulée' : '',
      ].filter(Boolean).join(' — ');

      for (const item of t.transaction_items) {
        const valeur = Number(item.total_ttc);
        const encaisse = Math.round(valeur * partEncaissee * 100) / 100;
        const ht = Math.round((encaisse / (1 + Number(item.taux_tva) / 100)) * 100) / 100;
        // La marchandise se distingue de la prestation : elle a un coût d'achat,
        // donc une marge, et elle entre dans la valeur du stock au bilan.
        const marge = cancelled ? null : ligneMarge(item);
        lines.push([
          d.toLocaleDateString('fr-CH'),
          d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
          t.numero,
          t.client_label,
          item.description,
          String(Number(item.quantite)),
          MODE_PAIEMENT_LABELS[t.mode_paiement],
          String(Number(item.taux_tva)),
          ht.toFixed(2),
          (encaisse - ht).toFixed(2),
          encaisse.toFixed(2),
          (Math.round((valeur - encaisse) * 100) / 100).toFixed(2),
          valeur.toFixed(2),
          item.product_id ? 'Marchandise' : 'Prestation',
          item.prix_achat_unitaire === null || item.prix_achat_unitaire === undefined
            ? ''
            : Number(item.prix_achat_unitaire).toFixed(2),
          marge === null ? '' : marge.toFixed(2),
          statut,
          note,
        ]);
      }
    }

    lines.push([]);
    lines.push([
      `Total encaissé ${periodLabel}`, '', '', '', '', '', '', '',
      totals.ht.toFixed(2), totals.tva.toFixed(2), totals.ttc.toFixed(2),
      totals.bons.toFixed(2), '', '', '', margeProduits.marge.toFixed(2), '', '',
    ]);
    lines.push([
      'Note pour la fiducie', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      "La colonne « Montant encaissé TTC » est la recette de la période : elle exclut les prestations réglées par un bon cadeau, dont l'encaissement a eu lieu le jour de la vente du bon. La colonne « Dont bon cadeau » est donnée pour information et ne doit pas être ajoutée au chiffre d'affaires. La colonne « Marge » ne concerne que les lignes de nature « Marchandise » : c'est la vente hors taxe diminuée du prix d'achat figé au moment de la vente. Elle n'entre pas dans le chiffre d'affaires.",
      '',
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

      {/* Marge sur marchandises — délibérément séparée du CA, qu'elle ne
          complète pas : c'est un indicateur de rentabilité, pas de recette. */}
      {margeProduits.articles > 0 && (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-sage/10 flex items-center justify-center shrink-0">
                <Package size={16} className="text-sage" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  Marge sur produits — {periodLabel}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {qteLabel(margeProduits.articles)} article{margeProduits.articles > 1 ? 's' : ''} vendu
                  {margeProduits.articles > 1 ? 's' : ''} pour {formatCHF(margeProduits.ventes)}
                </p>
              </div>
            </div>
            <p className={`text-2xl font-semibold tabular-nums ${margeProduits.marge >= 0 ? 'text-stone-900' : 'text-red-600'}`}>
              {formatCHF(margeProduits.marge)}
            </p>
          </div>
          <p className="text-[10px] text-stone-400 leading-relaxed mt-3 pt-3 border-t border-stone-50">
            Vente hors taxe moins le prix d&apos;achat figé au moment de chaque vente. Ce montant
            n&apos;est pas une recette et ne s&apos;ajoute pas au chiffre d&apos;affaires : il dit ce
            que la marchandise a rapporté au-delà de ce qu&apos;elle a coûté.
            {margeProduits.sansCout > 0 && (
              <span className="text-amber-600">
                {' '}{margeProduits.sansCout} ligne{margeProduits.sansCout > 1 ? 's' : ''} sans prix
                d&apos;achat enregistré {margeProduits.sansCout > 1 ? 'sont exclues' : 'est exclue'} du calcul.
              </span>
            )}
          </p>
        </div>
      )}

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
            <div className="flex justify-between text-sm pt-1.5 border-t border-stone-50"><dt className="text-stone-700 font-medium">Recettes encaissées</dt><dd className="text-stone-900 font-semibold tabular-nums">{formatCHF(totals.ttc)}</dd></div>
          </dl>

          {totals.bons > 0 && (
            <div className="mt-3 rounded-lg bg-sage/5 border border-sage/20 px-3.5 py-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Ticket size={11} className="text-sage" /> Prestations réglées par bon
                </span>
                <span className="text-stone-600 tabular-nums">{formatCHF(totals.bons)}</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-1.5 leading-relaxed">
                Hors recettes : cet argent est entré en caisse le jour où les bons
                ont été vendus. L&apos;ajouter ici doublerait le chiffre d&apos;affaires.
              </p>
            </div>
          )}
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
                onCancel={() => setDialog({ tx: t, intent: 'cancel' })}
                onCorrect={() => setDialog({ tx: t, intent: 'correct' })}
              />
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <CancelDialog
          tx={dialog.tx}
          intent={dialog.intent}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); load(); }}
          onCorrected={(tx) => {
            // La facture fautive vient d'être annulée : on repart sur la caisse
            // avec son contenu pré-rempli, et le lien vers l'ancienne.
            setCaisseCorrection({
              corrigeTransactionId: tx.id,
              numero: tx.numero,
              clientId: tx.client_id,
              clientLabel: tx.client_label,
              modePaiement: tx.mode_paiement,
              note: tx.note ?? '',
              lines: tx.transaction_items.map(item => ({
                key: item.id,
                service_id: item.service_id,
                // Sans lui, la facture rectifiée ne ressortirait pas la
                // marchandise du stock que l'annulation vient d'y remettre.
                product_id: item.product_id,
                description: item.description,
                prix_unitaire_ttc: Number(item.prix_unitaire_ttc),
                quantite: Number(item.quantite),
                taux_tva: Number(item.taux_tva),
              })),
            });
            router.push('/admin/caisse');
          }}
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

function JournalRow({ tx, open, downloading, onToggle, onDownload, onCancel, onCorrect }: {
  tx: TransactionWithItems;
  open: boolean;
  downloading: boolean;
  onToggle: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onCorrect: () => void;
}) {
  const d = new Date(tx.created_at);
  const cancelled = tx.status === 'annulee';
  const bon = Number(tx.montant_bon ?? 0);
  const recette = recetteEncaissee(tx);

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
          <p className="text-[11px] text-stone-400 tabular-nums flex items-center gap-1.5 flex-wrap">
            <span>{tx.numero} · {MODE_PAIEMENT_LABELS[tx.mode_paiement]}</span>
            {bon > 0 && (
              <span className="inline-flex items-center gap-1 text-sage">
                <Ticket size={10} /> {formatCHF(bon)}
              </span>
            )}
            {tx.corrige_transaction_id && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <PenLine size={10} /> rectificative
              </span>
            )}
            <span className="sm:hidden">· {d.toLocaleDateString('fr-CH')}</span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span className={`block text-sm font-medium tabular-nums ${cancelled ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
            {formatCHF(recette)}
          </span>
          {bon > 0 && !cancelled && (
            <span className="block text-[10px] text-stone-400 tabular-nums">
              sur {formatCHF(tx.total_ttc)}
            </span>
          )}
        </div>

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
            <>
              <button
                onClick={onCorrect}
                aria-label={`Corriger la facture ${tx.numero}`} title="Corriger cette écriture"
                className="p-1.5 text-stone-300 hover:text-amber-600 rounded-md hover:bg-amber-50 transition-all cursor-pointer"
              >
                <PenLine size={14} />
              </button>
              <button
                onClick={onCancel}
                aria-label={`Annuler la facture ${tx.numero}`} title="Annuler cette écriture"
                className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
              >
                <Ban size={14} />
              </button>
            </>
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
          {bon > 0 && (
            <div className="flex items-center justify-between text-xs text-sage">
              <span className="flex items-center gap-1.5"><Ticket size={11} /> Réglé par bon cadeau</span>
              <span className="tabular-nums">− {formatCHF(bon)}</span>
            </div>
          )}
          {tx.corrige_transaction_id && (
            <p className="text-xs text-amber-600 pt-1">
              Cette facture rectifie une écriture annulée.
            </p>
          )}
          {tx.note && <p className="text-xs text-stone-400 italic pt-1">Note : {tx.note}</p>}
          {tx.cancel_reason && <p className="text-xs text-red-500 pt-1">Motif d&apos;annulation : {tx.cancel_reason}</p>}
        </div>
      )}
    </li>
  );
}

/**
 * Annulation, et correction d'erreur de caisse.
 *
 * Les deux passent par la même mécanique, parce que c'est la seule légale : on
 * n'efface ni ne réécrit jamais une écriture (CO art. 957a). Corriger, c'est
 * annuler la facture fautive — qui reste au journal avec son numéro — puis en
 * émettre une nouvelle, rattachée à l'ancienne. Le contrôleur voit l'erreur ET
 * sa correction, ce qui est exactement le but de la règle.
 */
function CancelDialog({ tx, intent, onClose, onDone, onCorrected }: {
  tx: TransactionWithItems;
  intent: 'cancel' | 'correct';
  onClose: () => void;
  onDone: () => void;
  onCorrected: (tx: TransactionWithItems) => void;
}) {
  const isCorrection = intent === 'correct';
  const [reason, setReason] = useState(isCorrection ? 'Erreur de saisie' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true); setError(null);
    try {
      await cancelTransaction(tx.id, reason.trim());
      if (isCorrection) onCorrected(tx);
      else onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opération impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true"
        aria-label={`${isCorrection ? 'Corriger' : 'Annuler'} la facture ${tx.numero}`}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            {isCorrection
              ? <><PenLine size={15} className="text-amber-600" /> Corriger {tx.numero}</>
              : <><Ban size={15} className="text-red-500" /> Annuler {tx.numero}</>}
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {isCorrection ? (
          <div className="space-y-2 text-sm text-stone-500 leading-relaxed">
            <p>
              Mauvais mode de paiement, mauvais soin, mauvais montant : tu vas repartir
              de cette facture sur l&apos;écran de caisse, avec le panier déjà rempli.
            </p>
            <p className="text-xs bg-stone-50 border border-stone-100 rounded-lg px-3.5 py-2.5">
              La facture <strong className="text-stone-700">{tx.numero}</strong> ne disparaît pas :
              elle reste au journal, annulée, et la nouvelle y sera rattachée. C&apos;est ce qu&apos;exige
              le Code des obligations — une écriture ne se réécrit pas, elle se corrige au vu de tous.
            </p>
          </div>
        ) : (
          <p className="text-sm text-stone-500 leading-relaxed">
            L&apos;écriture de <strong className="text-stone-700">{formatCHF(tx.total_ttc)}</strong> restera dans le
            journal avec son numéro — c&apos;est ce qu&apos;exige la traçabilité comptable. Elle sera simplement
            exclue du chiffre d&apos;affaires.
          </p>
        )}

        {Number(tx.montant_bon ?? 0) > 0 && (
          <p className="text-xs text-sage bg-sage/5 border border-sage/20 rounded-lg px-3.5 py-2.5">
            Les {formatCHF(tx.montant_bon)} réglés par bon cadeau seront recrédités sur le bon.
          </p>
        )}

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
              className={`flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 cursor-pointer ${
                isCorrection ? 'bg-stone-900 hover:bg-sage' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving
                ? 'En cours…'
                : isCorrection ? 'Corriger sur la caisse' : "Confirmer l'annulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
