"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, X } from 'lucide-react';
import { Button, Callout } from '../../../../components/admin/ui';
import { lireFactureAchat, prepareReceiptFile, storeJustificatif, type PreparedReceipt } from '../../../../services/receipts';
import { importerFactureStock } from '../../../../services/financeService';
import {
  USAGES, controlerFactureAchat, totalLigneHT, trouverFiche,
  type FactureAchatLue, type LigneFactureAchat,
} from '../../../../types/factureAchat';
import { PRODUCT_USAGE_LABELS, type Expense, type ExpenseCategory, type ExpensePaymentMode } from '../../../../types/finance';
import { formatCHF, type Product } from '../../../../types/caisse';
import { zurichDate } from '../../../../components/admin/mobile/home/zurich';

const num = (v: string) => Number(v.replace(/'/g, '').replace(',', '.'));
const champ = 'w-full h-9 px-2 border border-stone-200 rounded-lg text-[13px] text-stone-800 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none';
const cellule = 'w-full h-8 px-1.5 border border-stone-200 rounded-md text-[12.5px] bg-white focus:border-stone-900 outline-none';

/** Compte proposé : tout en revente → 4000, tout en consommables → 4400, sinon 4200. */
function compteParDefaut(lignes: LigneFactureAchat[]): string {
  if (lignes.length > 0 && lignes.every(l => l.usage_type === 'vente')) return '4000';
  if (lignes.length > 0 && lignes.every(l => l.usage_type === 'consommable')) return '4400';
  return '4200';
}

/**
 * Import d'une facture fournisseur qui fait entrer du stock.
 *
 * L'IA lit, l'exploitante relit, `controlerFactureAchat` vérifie (total des
 * lignes = HT, doublon, prix de vente des nouveautés…) et l'import se fait en
 * une seule transaction Postgres qui rejoue les mêmes contrôles. La pièce est
 * archivée (Drive ou coffre privé) avant l'import : sans elle, rien ne part.
 */
export default function FactureImportModal({ file, categories, products, expenses, onClose, onDone }: {
  file: File;
  categories: ExpenseCategory[];
  products: Product[];
  expenses: Expense[];
  onClose: () => void;
  onDone: (message: string, expenseId: string) => void;
}) {
  const today = zurichDate();
  const [phase, setPhase] = useState<'lecture' | 'relecture' | 'import'>('lecture');
  const [prepared, setPrepared] = useState<PreparedReceipt | null>(null);
  const [facture, setFacture] = useState<FactureAchatLue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [statut, setStatut] = useState<'a_payer' | 'payee'>('a_payer');
  const [datePaiement, setDatePaiement] = useState(today);
  const [mode, setMode] = useState<ExpensePaymentMode>('virement');
  const [ecartJustifie, setEcartJustifie] = useState(false);

  const comptes = useMemo(() => categories.filter(c => c.code.startsWith('4')), [categories]);
  const fiches = useMemo(() => [...products].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [products]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ready = await prepareReceiptFile(file);
        if (cancelled) return;
        setPrepared(ready);
        const lue = await lireFactureAchat(ready);
        if (cancelled) return;
        // Chaque ligne reprend la fiche existante de même référence (ou de même nom).
        const lignes = lue.lignes.map(l => {
          const fiche = trouverFiche(l, products);
          return fiche ? { ...l, product_id: fiche.id, usage_type: (fiche.usage_type ?? l.usage_type) } : l;
        });
        setFacture({ ...lue, lignes });
        const code = compteParDefaut(lignes);
        setCategoryId(comptes.find(c => c.code === code)?.id ?? comptes[0]?.id ?? '');
        if (lue.echeances.length > 1) setMode('echelonne');
        setPhase('relecture');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lecture impossible.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const controle = useMemo(() => facture && controlerFactureAchat(facture, {
    today,
    ecartJustifie,
    categorieCode: comptes.find(c => c.id === categoryId)?.code ?? null,
    existantes: expenses,
  }), [facture, today, ecartJustifie, categoryId, comptes, expenses]);

  const setEntete = (patch: Partial<FactureAchatLue>) => setFacture(f => (f ? { ...f, ...patch } : f));
  const setLigne = (i: number, patch: Partial<LigneFactureAchat>) =>
    setFacture(f => (f ? { ...f, lignes: f.lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : f));
  const retirerLigne = (i: number) => setFacture(f => (f ? { ...f, lignes: f.lignes.filter((_, j) => j !== i) } : f));

  const importer = async () => {
    if (!facture || !prepared || !controle || controle.bloquants.length > 0) return;
    setPhase('import'); setError(null);
    try {
      // La pièce d'abord : une facture importée sans son justificatif n'est pas permise.
      const justificatif = await storeJustificatif(prepared.file, {
        date: facture.date_facture,
        fournisseur: facture.fournisseur,
        montant: facture.montant_ttc,
        description: `Facture n° ${facture.numero_facture}`,
      });
      const res = await importerFactureStock(facture, {
        categoryId,
        statut,
        datePaiement: statut === 'payee' ? datePaiement : null,
        modePaiement: mode,
        notes: facture.echeances.length > 0
          ? `Échéancier imprimé : ${facture.echeances.map(e => `${e.date.split('-').reverse().join('.')} CHF ${e.montant.toFixed(2)}`).join(' · ')}`
          : null,
        justificatif,
        ecartJustifie,
      });
      onDone(
        `Facture ${facture.fournisseur} n° ${facture.numero_facture} importée : ${Number(res.unites)} article(s) en stock, `
        + `${res.crees} fiche(s) créée(s), ${res.mis_a_jour} mise(s) à jour.`
        + (statut === 'a_payer' ? ' Saisissez son paiement ou son échéancier dans « Paiements ».' : ''),
        res.expense_id,
      );
    } catch (err) {
      setError(`Rien n'a été importé : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      setPhase('relecture');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label="Importer une facture d'achat"
        className="bg-white rounded-xl w-full max-w-6xl max-h-[94vh] flex flex-col border border-stone-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
              <PackageCheck size={18} className="text-accent" /> Facture d&apos;achat → stock
            </h3>
            <p className="text-[12.5px] text-stone-600">{file.name}</p>
          </div>
          <button onClick={onClose} disabled={phase === 'import'} aria-label="Fermer"
            className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-200 cursor-pointer disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {phase === 'lecture' && !error && (
            <div className="flex items-center gap-2 p-8 justify-center text-stone-600">
              <Loader2 size={16} className="animate-spin" /> Lecture de la facture, ligne par ligne…
            </div>
          )}
          {error && <Callout tone="danger">{error}</Callout>}

          {facture && controle && (
            <>
              {/* En-tête */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="space-y-1 col-span-2"><span className="text-[12px] font-medium text-stone-600">Fournisseur</span>
                  <input className={champ} value={facture.fournisseur} onChange={e => setEntete({ fournisseur: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">N° de facture</span>
                  <input className={champ} value={facture.numero_facture} onChange={e => setEntete({ numero_facture: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Date</span>
                  <input type="date" max={today} className={champ} value={facture.date_facture} onChange={e => setEntete({ date_facture: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Total HT</span>
                  <input inputMode="decimal" className={`${champ} tabular-nums`} defaultValue={facture.montant_ht.toFixed(2)} onBlur={e => setEntete({ montant_ht: num(e.target.value) || 0 })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">TVA</span>
                  <input inputMode="decimal" className={`${champ} tabular-nums`} defaultValue={facture.montant_tva.toFixed(2)} onBlur={e => setEntete({ montant_tva: num(e.target.value) || 0 })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Total TTC</span>
                  <input inputMode="decimal" className={`${champ} tabular-nums`} defaultValue={facture.montant_ttc.toFixed(2)} onBlur={e => setEntete({ montant_ttc: num(e.target.value) || 0 })} /></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Compte</span>
                  <select className={champ} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    {comptes.map(c => <option key={c.id} value={c.id}>{c.code} — {c.nom}</option>)}
                  </select></label>
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Paiement</span>
                  <select className={champ} value={statut} onChange={e => setStatut(e.target.value as 'a_payer' | 'payee')}>
                    <option value="a_payer">À payer (ou en plusieurs fois)</option>
                    <option value="payee">Déjà payée en entier</option>
                  </select></label>
                {statut === 'payee' && (
                  <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Payée le</span>
                    <input type="date" max={today} className={champ} value={datePaiement} onChange={e => setDatePaiement(e.target.value)} /></label>
                )}
                <label className="space-y-1"><span className="text-[12px] font-medium text-stone-600">Mode</span>
                  <select className={champ} value={mode ?? 'virement'} onChange={e => setMode(e.target.value as ExpensePaymentMode)}>
                    <option value="virement">Virement</option>
                    <option value="echelonne">Paiement échelonné</option>
                    <option value="prelevement_auto">Prélèvement</option>
                    <option value="carte">Carte</option>
                    <option value="twint">TWINT</option>
                    <option value="especes">Espèces</option>
                  </select></label>
              </div>

              {facture.echeances.length > 0 && (
                <p className="text-[12.5px] text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                  Échéancier imprimé : {facture.echeances.map(e => `${e.date.split('-').reverse().join('.')} · ${formatCHF(e.montant)}`).join(' — ')}.
                  Après l&apos;import, saisissez-le dans « Paiements ».
                </p>
              )}

              {/* Contrôles */}
              {controle.bloquants.length > 0 ? (
                <Callout tone="danger" title={`${controle.bloquants.length} point(s) à corriger avant l'import`}>
                  <ul className="list-disc pl-5 space-y-0.5">{controle.bloquants.map((b, i) => <li key={i}>{b}</li>)}</ul>
                </Callout>
              ) : (
                <Callout tone="success">
                  Contrôles passés : {facture.lignes.length} lignes, total des lignes {formatCHF(controle.sommeLignes)} HT
                  {Math.abs(controle.ecart) > 0.05 ? ` (écart justifié de ${formatCHF(controle.ecart)})` : ' = HT de la facture'}.
                </Callout>
              )}
              {Math.abs(controle.ecart) > 0.05 && (
                <label className="flex items-start gap-2 text-[13px] text-stone-700">
                  <input type="checkbox" checked={ecartJustifie} onChange={e => setEcartJustifie(e.target.checked)} className="mt-0.5" />
                  <span>
                    Écart justifié : les lignes font {formatCHF(controle.sommeLignes)} HT pour {formatCHF(facture.montant_ht)} HT facturés
                    (frais de port, rabais global…). Ne cochez que si vous l&apos;avez vérifié sur la facture.
                  </span>
                </label>
              )}
              {controle.avertissements.length > 0 && (
                <Callout tone="warning" title="À vérifier">
                  <ul className="list-disc pl-5 space-y-0.5">{controle.avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </Callout>
              )}

              {/* Lignes */}
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left text-[12.5px] min-w-[980px]">
                  <thead className="bg-stone-50 text-stone-500 uppercase text-[11px]">
                    <tr>
                      <th className="px-2 py-2">Réf.</th>
                      <th className="px-2 py-2">Désignation</th>
                      <th className="px-2 py-2 w-16">Qté</th>
                      <th className="px-2 py-2 w-20">PU HT</th>
                      <th className="px-2 py-2 w-16">Rabais %</th>
                      <th className="px-2 py-2 w-20 text-right">Total HT</th>
                      <th className="px-2 py-2 w-28">Usage</th>
                      <th className="px-2 py-2 w-56">Fiche produit</th>
                      <th className="px-2 py-2 w-24">Prix vente TTC</th>
                      <th className="px-1 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {facture.lignes.map((l, i) => {
                      const nouveau = !l.product_id;
                      const fiche = l.product_id ? products.find(p => p.id === l.product_id) : null;
                      return (
                        <tr key={i} className={nouveau ? 'bg-amber-50/40' : ''}>
                          <td className="px-2 py-1.5"><input className={`${cellule} font-mono`} value={l.reference ?? ''} onChange={e => setLigne(i, { reference: e.target.value || null })} /></td>
                          <td className="px-2 py-1.5"><input className={cellule} value={l.designation} onChange={e => setLigne(i, { designation: e.target.value })} /></td>
                          <td className="px-2 py-1.5"><input inputMode="decimal" className={`${cellule} tabular-nums`} defaultValue={String(l.quantite)} onBlur={e => setLigne(i, { quantite: num(e.target.value) || 0 })} /></td>
                          <td className="px-2 py-1.5"><input inputMode="decimal" className={`${cellule} tabular-nums`} defaultValue={l.prix_unitaire.toFixed(2)} onBlur={e => setLigne(i, { prix_unitaire: num(e.target.value) || 0 })} /></td>
                          <td className="px-2 py-1.5"><input inputMode="decimal" className={`${cellule} tabular-nums`} defaultValue={String(l.rabais_pct)} onBlur={e => setLigne(i, { rabais_pct: Math.min(100, Math.max(0, num(e.target.value) || 0)) })} /></td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatCHF(totalLigneHT(l))}</td>
                          <td className="px-2 py-1.5">
                            <select className={cellule} value={l.usage_type} disabled={!nouveau}
                              title={nouveau ? undefined : 'Usage de la fiche existante (modifiable dans la fiche produit)'}
                              onChange={e => setLigne(i, { usage_type: e.target.value as LigneFactureAchat['usage_type'] })}>
                              {USAGES.map(u => <option key={u} value={u}>{PRODUCT_USAGE_LABELS[u].badge}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select className={cellule} value={l.product_id ?? ''}
                              onChange={e => {
                                const p = products.find(x => x.id === e.target.value);
                                setLigne(i, { product_id: p?.id ?? null, ...(p ? { usage_type: p.usage_type ?? 'vente' } : {}) });
                              }}>
                              <option value="">➕ Nouveau produit</option>
                              {fiches.map(p => <option key={p.id} value={p.id}>{p.nom}{p.reference ? ` · ${p.reference}` : ''}</option>)}
                            </select>
                            {fiche && <div className="text-[11px] text-stone-500 mt-0.5">Stock {Number(fiche.stock)} → {Number(fiche.stock) + Number(l.quantite || 0)}</div>}
                          </td>
                          <td className="px-2 py-1.5">
                            {nouveau && l.usage_type === 'vente' ? (
                              <input inputMode="decimal" placeholder="obligatoire" className={`${cellule} tabular-nums ${Number(l.prix_vente) > 0 ? '' : 'border-red-300'}`}
                                defaultValue={l.prix_vente ? l.prix_vente.toFixed(2) : ''}
                                onBlur={e => setLigne(i, { prix_vente: num(e.target.value) || null })} />
                            ) : <span className="text-stone-400">—</span>}
                          </td>
                          <td className="px-1 py-1.5">
                            <button onClick={() => retirerLigne(i)} title="Retirer cette ligne (frais de port lus comme un article…)"
                              className="text-stone-400 hover:text-red-700 cursor-pointer"><X size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-stone-500">
                Lignes surlignées : nouveaux produits, créés à l&apos;import avec l&apos;usage choisi. Les autres complètent le stock de leur fiche,
                dont le prix d&apos;achat devient celui de cette facture. Une facture ne s&apos;importe qu&apos;une fois ; en cas d&apos;erreur, annulez-la :
                son stock repart.
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <p className="text-[12px] text-stone-600 flex items-center gap-1.5">
            {controle && controle.bloquants.length > 0
              ? <><AlertTriangle size={14} className="text-red-600" /> Import bloqué tant qu&apos;un point reste à corriger.</>
              : facture ? <><CheckCircle2 size={14} className="text-emerald-600" /> Tout est enregistré d&apos;un coup, ou rien.</> : null}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={phase === 'import'}>Annuler</Button>
            <Button variant="primary" icon={PackageCheck} loading={phase === 'import'}
              disabled={!facture || !controle || controle.bloquants.length > 0 || !prepared}
              onClick={importer}>
              Importer la facture
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
