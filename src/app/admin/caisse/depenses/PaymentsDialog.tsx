"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Plus, Trash2, Undo2, X } from 'lucide-react';
import { Button, Callout } from '../../../../components/admin/ui';
import {
  annulerVersement, enregistrerVersement, payerEcheance, planifierEcheances, supprimerEcheance,
} from '../../../../services/financeService';
import type { VersementInput } from '../../../../services/financeService';
import {
  VERSEMENT_MODES, addMonthsISO, situationPaiement, splitEcheances,
} from '../../../../types/finance';
import type { Expense, ExpensePayment, ExpenseVersementMode } from '../../../../types/finance';
import { formatCHF } from '../../../../types/caisse';
import { zurichDate } from '../../../../components/admin/mobile/home/zurich';

const dateCH = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-CH') : '—';

const MODE_LABEL = Object.fromEntries(VERSEMENT_MODES.map(m => [m.value, m.label])) as Record<ExpenseVersementMode, string>;

const parseMontant = (v: string) => Number(v.replace(/'/g, '').replace(',', '.'));

const field = 'w-full h-10 px-3 border border-stone-200 rounded-lg text-sm text-stone-800 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none';

/**
 * Paiement d'une facture d'achat : échéancier convenu avec le fournisseur et
 * versements effectués.
 *
 * Trois règles, appliquées par Postgres (`20261015_depenses_versements.sql`) :
 * la facture garde son montant total (c'est la charge de l'exercice) ; chaque
 * versement est une écriture de trésorerie à sa propre date ; un versement
 * effectué ne se modifie ni ne s'efface — une erreur s'annule avec un motif.
 */
export default function PaymentsDialog({ expense, payments, onClose, onChanged }: {
  expense: Expense;
  /** Lignes de CETTE facture. */
  payments: ExpensePayment[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const today = zurichDate();
  const sit = situationPaiement(expense, payments);
  const annulee = expense.statut === 'annulee';
  const libre = Math.max(0, Math.round((sit.reste - sit.prevu) * 100) / 100);
  const modeDefaut: ExpenseVersementMode =
    expense.mode_paiement && expense.mode_paiement !== 'echelonne' ? expense.mode_paiement : 'virement';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Échelonner ce qui n'est ni payé ni planifié.
  const [nb, setNb] = useState(3);
  const [premiere, setPremiere] = useState(expense.date_echeance && expense.date_echeance >= expense.date_facture
    ? expense.date_echeance : today);
  const apercu = useMemo(
    () => splitEcheances(libre, nb).map((m, i) => ({ montant: m, date: addMonthsISO(premiere, i) })),
    [libre, nb, premiere],
  );

  // Versement libre.
  const [montantLibre, setMontantLibre] = useState(libre > 0 ? libre.toFixed(2) : '');
  useEffect(() => { setMontantLibre(libre > 0 ? libre.toFixed(2) : ''); }, [libre]);
  const [versement, setVersement] = useState<VersementInput>({ date: today, mode: modeDefaut });

  // Échéance en cours de paiement / versement en cours d'annulation.
  const [paying, setPaying] = useState<{ id: string; montant: string; v: VersementInput } | null>(null);
  const [cancelling, setCancelling] = useState<{ id: string; motif: string } | null>(null);

  const lignes = [...payments].sort((a, b) =>
    (a.date_paiement ?? a.date_prevue ?? '').localeCompare(b.date_paiement ?? b.date_prevue ?? '') || a.rang - b.rang);
  // « 2/3 » : rang parmi les lignes non annulées (une ligne annulée garde la trace, pas la place).
  const actives = lignes.filter(l => !l.annule);
  const position = new Map(actives.map((l, i) => [l.id, `${i + 1}/${actives.length}`]));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try {
      await fn();
      setPaying(null); setCancelling(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div
        role="dialog" aria-modal="true" aria-label={`Paiements de la facture ${expense.fournisseur}`}
        className="bg-white w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl border border-stone-200 shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-stone-900 text-base truncate">
              Paiements — {expense.fournisseur}{expense.numero_facture ? ` n° ${expense.numero_facture}` : ''}
            </h3>
            <p className="text-[12.5px] text-stone-600 mt-0.5">
              Facture du {dateCH(expense.date_facture)} · {formatCHF(expense.montant_ttc)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-200 hover:text-stone-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Synthèse */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Payé', value: sit.paye, tone: 'text-emerald-800' },
              { label: 'Planifié', value: sit.prevu, tone: 'text-stone-800' },
              { label: 'Reste dû', value: sit.reste, tone: sit.reste > 0 ? 'text-amber-800' : 'text-stone-800' },
            ].map(k => (
              <div key={k.label} className="rounded-xl border border-stone-200 p-3">
                <p className="text-[11.5px] font-medium text-stone-500 uppercase tracking-wide">{k.label}</p>
                <p className={`text-lg font-bold tabular-nums ${k.tone}`}>{formatCHF(k.value)}</p>
              </div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, (sit.paye / Math.max(0.01, Number(expense.montant_ttc))) * 100)}%` }} />
          </div>

          {annulee && (
            <Callout tone="warning">Facture annulée : ses versements sont annulés et elle ne compte plus nulle part.</Callout>
          )}
          {error && <Callout tone="danger">{error}</Callout>}

          {/* Échéancier et versements */}
          <section className="space-y-2">
            <h4 className="text-[12.5px] font-semibold text-stone-700 uppercase tracking-wide">Échéancier et versements</h4>
            {lignes.length === 0 ? (
              <p className="text-[13px] text-stone-500 italic">Aucun versement ni échéance enregistré.</p>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {lignes.map(l => {
                  const rang = position.get(l.id) ?? '';
                  if (l.annule) {
                    return (
                      <li key={l.id} className="px-3 py-2.5 text-stone-500">
                        <div className="flex justify-between gap-3 line-through">
                          <span>Versement {dateCH(l.date_paiement)}</span>
                          <span className="tabular-nums">{formatCHF(l.montant)}</span>
                        </div>
                        <p className="text-[12px]">Annulé{l.motif_annulation ? ` : ${l.motif_annulation}` : ''}</p>
                      </li>
                    );
                  }
                  if (l.date_paiement) {
                    return (
                      <li key={l.id} className="px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900 flex items-center gap-1.5">
                              <Check size={14} className="text-emerald-600 shrink-0" /> Payé le {dateCH(l.date_paiement)}
                              <span className="text-[12px] font-normal text-stone-500">· {rang}</span>
                            </p>
                            <p className="text-[12px] text-stone-500 truncate">
                              {l.mode_paiement ? MODE_LABEL[l.mode_paiement] : 'Mode non précisé'}
                              {l.reference ? ` · réf. ${l.reference}` : ''}
                              {l.justificatif_url && (
                                <> · <a href={l.justificatif_url} target="_blank" rel="noreferrer" className="underline">preuve</a></>
                              )}
                            </p>
                          </div>
                          <span className="tabular-nums font-semibold text-stone-900 shrink-0">{formatCHF(l.montant)}</span>
                          {!annulee && (
                            <button
                              onClick={() => setCancelling({ id: l.id, motif: '' })}
                              title="Annuler ce versement (erreur de saisie)"
                              className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Undo2 size={15} />
                            </button>
                          )}
                        </div>
                        {cancelling?.id === l.id && (
                          <form
                            onSubmit={e => { e.preventDefault(); if (cancelling.motif.trim()) run(() => annulerVersement(l.id, cancelling.motif)); }}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              autoFocus value={cancelling.motif} onChange={e => setCancelling({ id: l.id, motif: e.target.value })}
                              placeholder="Motif : doublon, mauvais montant…" aria-label="Motif de l'annulation"
                              className={`${field} flex-1 min-w-48`}
                            />
                            <Button size="sm" variant="danger" type="submit" loading={busy} disabled={!cancelling.motif.trim()}>Annuler le versement</Button>
                            <Button size="sm" variant="ghost" type="button" onClick={() => setCancelling(null)}>Garder</Button>
                          </form>
                        )}
                      </li>
                    );
                  }
                  // Échéance à venir
                  const enRetard = (l.date_prevue ?? '') < today;
                  return (
                    <li key={l.id} className="px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900 flex items-center gap-1.5">
                            <CalendarClock size={14} className={enRetard ? 'text-red-600' : 'text-amber-600'} />
                            Échéance du {dateCH(l.date_prevue)}
                            <span className="text-[12px] font-normal text-stone-500">· {rang}</span>
                          </p>
                          {enRetard && <p className="text-[12px] text-red-700">Date dépassée : réglée ? enregistrez le versement.</p>}
                        </div>
                        <span className="tabular-nums font-semibold text-stone-900 shrink-0">{formatCHF(l.montant)}</span>
                        {!annulee && paying?.id !== l.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm" variant="primary" icon={Check}
                              onClick={() => setPaying({ id: l.id, montant: Number(l.montant).toFixed(2), v: { date: today, mode: modeDefaut } })}
                            >
                              Payée
                            </Button>
                            <button
                              onClick={() => run(() => supprimerEcheance(l.id))}
                              title="Retirer cette échéance"
                              className="grid size-8 place-items-center rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      {paying?.id === l.id && (
                        <VersementForm
                          montant={paying.montant}
                          onMontant={m => setPaying({ ...paying, montant: m })}
                          v={paying.v} onV={v => setPaying({ ...paying, v })}
                          today={today} busy={busy}
                          submitLabel="Enregistrer le versement"
                          onCancel={() => setPaying(null)}
                          onSubmit={() => {
                            const m = parseMontant(paying.montant);
                            if (!(m > 0)) { setError('Montant du versement invalide.'); return; }
                            run(() => payerEcheance(l.id, m, paying.v));
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!annulee && libre > 0 && (
            <>
              {/* Échelonner */}
              <section className="rounded-xl border border-stone-200 p-4 space-y-3">
                <h4 className="font-semibold text-stone-900">Échelonner {sit.prevu > 0 || sit.paye > 0 ? 'le solde' : 'le paiement'} ({formatCHF(libre)})</h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="block text-[12.5px] font-medium text-stone-700">Nombre de versements</span>
                    <select value={nb} onChange={e => setNb(Number(e.target.value))} className={field}>
                      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} fois</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[12.5px] font-medium text-stone-700">Première échéance</span>
                    <input type="date" value={premiere} onChange={e => setPremiere(e.target.value)} className={field} />
                  </label>
                </div>
                <ul className="text-[13px] text-stone-700 space-y-0.5">
                  {apercu.map((a, i) => (
                    <li key={i} className="flex justify-between tabular-nums">
                      <span>{i + 1}. le {dateCH(a.date)}</span><span>{formatCHF(a.montant)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-stone-500">Une échéance par mois ; les dates restent modifiables en retirant une échéance. L&apos;arrondi au centime va sur la dernière.</p>
                <Button
                  variant="primary" icon={CalendarClock} loading={busy} disabled={!premiere}
                  onClick={() => run(() => planifierEcheances(expense, payments, nb, premiere))}
                >
                  Créer l&apos;échéancier
                </Button>
              </section>

              {/* Versement libre */}
              <section className="rounded-xl border border-stone-200 p-4 space-y-3">
                <h4 className="font-semibold text-stone-900">Enregistrer un versement</h4>
                <VersementForm
                  montant={montantLibre} onMontant={setMontantLibre}
                  v={versement} onV={setVersement}
                  today={today} busy={busy}
                  submitLabel="Enregistrer"
                  onSubmit={() => {
                    const m = parseMontant(montantLibre);
                    if (!(m > 0)) { setError('Montant du versement invalide.'); return; }
                    run(() => enregistrerVersement(expense.id, payments, m, versement));
                  }}
                />
              </section>
            </>
          )}

          <p className="text-[12px] text-stone-500 leading-relaxed">
            La facture compte en entier dans les charges de l&apos;exercice de sa date. Chaque versement sort de la
            trésorerie à sa propre date, et ce qui reste dû au 31 décembre figure au bilan comme dette fournisseur.
            Un versement enregistré ne se modifie plus : en cas d&apos;erreur, annulez-le (la trace reste) et saisissez le bon.
          </p>
        </div>
      </div>
    </div>
  );
}

function VersementForm({ montant, onMontant, v, onV, today, busy, submitLabel, onSubmit, onCancel }: {
  montant: string;
  onMontant: (m: string) => void;
  v: VersementInput;
  onV: (v: VersementInput) => void;
  today: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="space-y-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <label className="space-y-1">
          <span className="block text-[12.5px] font-medium text-stone-700">Montant (CHF)</span>
          <input inputMode="decimal" value={montant} onChange={e => onMontant(e.target.value)} className={`${field} tabular-nums`} />
        </label>
        <label className="space-y-1">
          <span className="block text-[12.5px] font-medium text-stone-700">Payé le</span>
          <input type="date" value={v.date} max={today} onChange={e => onV({ ...v, date: e.target.value })} className={field} />
        </label>
        <label className="space-y-1 col-span-2 sm:col-span-1">
          <span className="block text-[12.5px] font-medium text-stone-700">Moyen</span>
          <select value={v.mode ?? ''} onChange={e => onV({ ...v, mode: (e.target.value || null) as ExpenseVersementMode | null })} className={field}>
            {VERSEMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="space-y-1">
          <span className="block text-[12.5px] font-medium text-stone-700">Référence <span className="font-normal text-stone-500">(relevé, n° de transaction)</span></span>
          <input value={v.reference ?? ''} onChange={e => onV({ ...v, reference: e.target.value })} className={field} />
        </label>
        <label className="space-y-1">
          <span className="block text-[12.5px] font-medium text-stone-700">Lien vers la preuve <span className="font-normal text-stone-500">(facultatif)</span></span>
          <input type="url" value={v.justificatif_url ?? ''} onChange={e => onV({ ...v, justificatif_url: e.target.value })} placeholder="https://drive.google.com/…" className={field} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" type="submit" icon={Plus} loading={busy} disabled={!v.date}>{submitLabel}</Button>
        {onCancel && <Button size="sm" variant="ghost" type="button" onClick={onCancel}>Annuler</Button>}
      </div>
    </form>
  );
}
