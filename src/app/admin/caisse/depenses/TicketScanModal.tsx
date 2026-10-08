"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ExternalLink, FileText, Plus, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Callout, Field, Input, Select, Spinner, Textarea } from '../../../../components/admin/ui';
import { prepareReceiptFile, saveTicket, scanReceipt, type PreparedReceipt } from '../../../../services/receipts';
import {
  EXPENSE_PAYMENT_MODE_LABELS,
  type ExpenseCategory,
  type ExpenseDocumentType,
  type ExpensePaymentMode,
} from '../../../../types/finance';
import {
  normalizeSupplierUid,
  parseAmount,
  round2,
  validateTicketDraft,
  type ReceiptExtraction,
  type TicketDraft,
} from '../../../../types/receipts';
import { formatCHF } from '../../../../types/caisse';
import { todayKey } from '../../../../utils/dateKey';

interface PartForm {
  compte: string;
  libelle: string;
  montant: string;
  taux: string;
}

interface TicketForm {
  type_piece: ExpenseDocumentType;
  fournisseur: string;
  fournisseur_adresse: string;
  fournisseur_ide: string;
  numero_piece: string;
  date: string;
  mode_paiement: ExpensePaymentMode | '';
  montant_ttc: string;
  parts: PartForm[];
  notes: string;
}

const PAYMENT_MODES: ExpensePaymentMode[] = ['carte', 'twint', 'especes', 'virement'];
const CURRENT_RATES = [8.1, 2.6, 3.8];

const emptyForm = (): TicketForm => ({
  type_piece: 'ticket',
  fournisseur: '',
  fournisseur_adresse: '',
  fournisseur_ide: '',
  numero_piece: '',
  date: todayKey(),
  mode_paiement: 'carte',
  montant_ttc: '',
  parts: [{ compte: '6990', libelle: '', montant: '', taux: '0' }],
  notes: '',
});

function formFromExtraction(x: ReceiptExtraction): TicketForm {
  const parts = x.ventilation.map((v) => ({
    compte: v.compte,
    libelle: v.libelle,
    montant: v.montant_ttc.toFixed(2),
    taux: String(v.taux_tva),
  }));
  return {
    type_piece: x.type_piece,
    fournisseur: x.fournisseur,
    fournisseur_adresse: x.fournisseur_adresse ?? '',
    fournisseur_ide: x.fournisseur_ide ?? '',
    numero_piece: x.numero_piece ?? '',
    date: x.date ?? todayKey(),
    mode_paiement: x.mode_paiement ?? '',
    montant_ttc: x.montant_ttc > 0 ? x.montant_ttc.toFixed(2) : '',
    parts: parts.length > 0
      ? parts
      : [{ compte: x.compte_principal, libelle: '', montant: x.montant_ttc > 0 ? x.montant_ttc.toFixed(2) : '', taux: '0' }],
    notes: '',
  };
}

export default function TicketScanModal({
  file,
  categories,
  onClose,
  onSaved,
}: {
  file: File;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [phase, setPhase] = useState<'reading' | 'review'>('reading');
  const [prepared, setPrepared] = useState<PreparedReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtraction | null>(null);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [readError, setReadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categoriesRef = useRef(categories);

  // Comptes imputables : le compte privé n'en est pas un, la part privée reste hors comptabilité.
  const accounts = useMemo(
    () => [...categories].filter((c) => c.groupe !== 'prelevements_prives').sort((a, b) => a.ordre - b.ordre),
    [categories],
  );
  const codes = useMemo(() => accounts.map((c) => c.code), [accounts]);

  // Préparation de la photo puis lecture IA, une seule fois par fichier.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      let ready: PreparedReceipt;
      try {
        ready = await prepareReceiptFile(file);
      } catch (err) {
        if (!cancelled) { setReadError(err instanceof Error ? err.message : String(err)); setPhase('review'); }
        return;
      }
      if (cancelled) return;
      url = URL.createObjectURL(ready.file);
      setPrepared(ready);
      setPreviewUrl(url);
      try {
        const data = await scanReceipt(ready, categoriesRef.current);
        if (cancelled) return;
        setExtraction(data);
        setForm(formFromExtraction(data));
      } catch (err) {
        if (!cancelled) setReadError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setPhase('review');
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const set = <K extends keyof TicketForm>(key: K, value: TicketForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const setPart = (i: number, patch: Partial<PartForm>) =>
    setForm((f) => ({ ...f, parts: f.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  // Un ticket imputé à un seul compte suit le total quand on le corrige.
  const setTotal = (value: string) =>
    setForm((f) => {
      const single = f.parts.length === 1 && parseAmount(f.parts[0].montant) === parseAmount(f.montant_ttc);
      return { ...f, montant_ttc: value, parts: single ? [{ ...f.parts[0], montant: value }] : f.parts };
    });

  const total = parseAmount(form.montant_ttc);
  const sumParts = round2(form.parts.reduce((s, p) => s + parseAmount(p.montant), 0));
  const privee = round2(total - sumParts);

  const addPart = () =>
    setForm((f) => ({
      ...f,
      parts: [...f.parts, { compte: f.parts[0]?.compte ?? '6990', libelle: '', montant: privee > 0 ? privee.toFixed(2) : '', taux: f.parts[0]?.taux ?? '0' }],
    }));

  const uid = normalizeSupplierUid(form.fournisseur_ide);

  const handleSave = async () => {
    if (!prepared) return;
    const draft: TicketDraft = {
      type_piece: form.type_piece,
      fournisseur: form.fournisseur,
      fournisseur_adresse: form.fournisseur_adresse,
      fournisseur_ide: uid.ide ?? '',
      numero_piece: form.numero_piece,
      date: form.date,
      mode_paiement: form.mode_paiement,
      montant_ttc: total,
      // La TVA imprimée ne vaut que tant que le total lu n'a pas été corrigé.
      tva: extraction && Math.abs(extraction.montant_ttc - total) < 0.005 ? extraction.tva : [],
      ventilation: form.parts.map((p) => ({
        compte: p.compte,
        libelle: p.libelle,
        montant_ttc: parseAmount(p.montant),
        taux_tva: parseAmount(p.taux),
      })),
      notes: form.notes,
    };
    const invalid = validateTicketDraft(draft, codes);
    if (invalid) { setSaveError(invalid); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const n = await saveTicket({ draft, file: prepared.file, categories, extraction });
      onSaved(
        `Ticket « ${draft.fournisseur.trim()} » du ${new Date(`${draft.date}T12:00:00`).toLocaleDateString('fr-CH')} enregistré${
          n > 1 ? ` en ${n} parts` : ''
        } (${formatCHF(sumParts)}), justificatif archivé.`,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const isPdf = prepared?.mediaType === 'application/pdf';
  const rateOptions = (current: string) => {
    const n = parseAmount(current);
    const list: number[] = [0, ...CURRENT_RATES];
    if (n > 0 && !list.includes(n)) list.push(n);
    return list;
  };
  const accountLabel = (code: string) => accounts.find((c) => c.code === code)?.nom ?? code;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white w-full sm:max-w-5xl sm:rounded-2xl rounded-t-2xl border border-stone-200 shadow-xl overflow-hidden max-h-[94vh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
              <Camera size={18} className="text-accent shrink-0" /> Ticket de caisse
            </h3>
            <p className="text-[12.5px] text-stone-600 truncate">
              {phase === 'reading'
                ? 'Lecture en cours : fournisseur, montant, TVA et compte…'
                : 'Relisez la lecture, corrigez au besoin, puis enregistrez : la photo est archivée avec la dépense.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 p-5">
            {/* Pièce */}
            <div className="lg:sticky lg:top-0 self-start">
              <div className="rounded-xl border border-stone-200 bg-stone-100 overflow-hidden flex items-center justify-center min-h-32">
                {previewUrl && !isPdf && (
                  <a href={previewUrl} target="_blank" rel="noreferrer" title="Agrandir la photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Ticket photographié" className="max-h-56 lg:max-h-[68vh] w-auto object-contain" />
                  </a>
                )}
                {previewUrl && isPdf && (
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 py-8 text-stone-700 text-sm">
                    <FileText size={32} /> Ouvrir le PDF
                  </a>
                )}
                {!previewUrl && phase === 'reading' && <Spinner label="Préparation de la photo" />}
              </div>
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-stone-600 hover:text-stone-900">
                  <ExternalLink size={12} /> Agrandir
                </a>
              )}
            </div>

            {/* Formulaire */}
            <div className="space-y-5 min-w-0">
              {phase === 'reading' ? (
                <div className="py-16 flex flex-col items-center gap-3 text-sm text-stone-600">
                  <Spinner label="Lecture du ticket" />
                  <p>L’IA lit le ticket — quelques secondes.</p>
                </div>
              ) : (
                <>
                  {readError && (
                    <Callout tone="warning" title="Lecture automatique indisponible">
                      {readError} {prepared && 'Vous pouvez saisir le ticket à la main : la photo sera archivée.'}
                    </Callout>
                  )}
                  {extraction && extraction.alertes.length > 0 && (
                    <Callout tone="warning" title="À vérifier">
                      <ul className="list-disc pl-4 space-y-0.5">
                        {extraction.alertes.map((a) => <li key={a}>{a}</li>)}
                      </ul>
                    </Callout>
                  )}
                  {extraction && (extraction.raison || extraction.remarques.length > 0) && (
                    <Callout tone="info" title={`Proposition de l’IA${extraction.confiance === 'haute' ? '' : ` (lecture ${extraction.confiance})`}`}>
                      {extraction.raison && <p>{extraction.raison}</p>}
                      {extraction.remarques.map((r) => <p key={r} className="text-[13px]">{r}</p>)}
                    </Callout>
                  )}

                  {/* Fournisseur */}
                  <section className="space-y-3">
                    <h4 className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Fournisseur</h4>
                    <Field label="Raison sociale" required>
                      <Input value={form.fournisseur} onChange={(e) => set('fournisseur', e.target.value)} placeholder="Ex. Coop Genossenschaft, Pharmacie d’Oron…" />
                    </Field>
                    <Field label="Adresse" hint="Telle qu’imprimée sur la pièce : la fiduciaire l’exige pour justifier la charge.">
                      <Input value={form.fournisseur_adresse} onChange={(e) => set('fournisseur_adresse', e.target.value)} placeholder="Rue, NPA Localité" />
                    </Field>
                    <Field
                      label="N° IDE / TVA"
                      hint={
                        uid.valide === true ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck size={13} /> Numéro suisse valide ({uid.ide}).</span>
                        ) : uid.valide === false ? (
                          <span className="text-amber-700">Ce numéro ne passe pas le contrôle : comparez-le à la photo.</span>
                        ) : (
                          'Nécessaire plus tard pour récupérer la TVA payée (impôt préalable).'
                        )
                      }
                    >
                      <Input value={form.fournisseur_ide} onChange={(e) => set('fournisseur_ide', e.target.value)} placeholder="CHE-123.456.789 TVA" />
                    </Field>
                  </section>

                  {/* Pièce */}
                  <section className="space-y-3">
                    <h4 className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Pièce</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date" required>
                        <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
                      </Field>
                      <Field label="N° de ticket / facture">
                        <Input value={form.numero_piece} onChange={(e) => set('numero_piece', e.target.value)} />
                      </Field>
                      <Field label="Total payé (CHF)" required>
                        <Input inputMode="decimal" value={form.montant_ttc} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" className="font-semibold" />
                      </Field>
                      <Field label="Payé par">
                        <Select value={form.mode_paiement} onChange={(e) => set('mode_paiement', e.target.value as ExpensePaymentMode | '')}>
                          <option value="">—</option>
                          {PAYMENT_MODES.map((m) => <option key={m} value={m}>{EXPENSE_PAYMENT_MODE_LABELS[m]}</option>)}
                        </Select>
                      </Field>
                      <Field label="Type de pièce" className="col-span-2 sm:col-span-1">
                        <Select value={form.type_piece} onChange={(e) => set('type_piece', e.target.value as ExpenseDocumentType)}>
                          <option value="ticket">Ticket de caisse</option>
                          <option value="facture">Facture / quittance</option>
                          <option value="autre">Autre justificatif</option>
                        </Select>
                      </Field>
                    </div>

                    {extraction && extraction.tva.length > 0 && (
                      <div className="rounded-lg border border-stone-200 overflow-hidden">
                        <table className="w-full text-[12.5px]">
                          <thead className="bg-stone-50 text-stone-500">
                            <tr>
                              <th className="text-left font-medium py-1.5 px-3">TVA lue</th>
                              <th className="text-right font-medium py-1.5 px-3">HT</th>
                              <th className="text-right font-medium py-1.5 px-3">TVA</th>
                              <th className="text-right font-medium py-1.5 px-3">TTC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {extraction.tva.map((l) => (
                              <tr key={l.taux}>
                                <td className="py-1.5 px-3">{l.taux} %</td>
                                <td className="py-1.5 px-3 text-right">{formatCHF(l.montant_ht)}</td>
                                <td className="py-1.5 px-3 text-right">{formatCHF(l.montant_tva)}</td>
                                <td className="py-1.5 px-3 text-right">{formatCHF(l.montant_ttc)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-3 py-1.5 bg-stone-50 text-[11.5px] text-stone-500">
                          Conservée taux par taux pour l’impôt préalable, le jour où l’activité sera assujettie.
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Ventilation */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Ventilation par compte</h4>
                      <Button size="sm" variant="ghost" icon={Plus} onClick={addPart}>Ajouter une part</Button>
                    </div>
                    <div className="space-y-2.5">
                      {form.parts.map((p, i) => {
                        const amount = parseAmount(p.montant);
                        return (
                          <div key={i} className="rounded-xl border border-stone-200 p-3 space-y-2.5 bg-white">
                            <div className="flex items-start gap-2">
                              <Select value={p.compte} onChange={(e) => setPart(i, { compte: e.target.value })} className="flex-1 min-w-0">
                                {!codes.includes(p.compte) && <option value={p.compte}>{p.compte} · compte à choisir</option>}
                                {accounts.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.nom}</option>)}
                              </Select>
                              {form.parts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setForm((f) => ({ ...f, parts: f.parts.filter((_, j) => j !== i) }))}
                                  className="h-11 lg:h-10 px-2 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                  aria-label="Retirer cette part"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-2">
                              <Input value={p.libelle} onChange={(e) => setPart(i, { libelle: e.target.value })} placeholder="Libellé (ex. coton, lingettes)" />
                              <Input inputMode="decimal" value={p.montant} onChange={(e) => setPart(i, { montant: e.target.value })} placeholder="CHF" className="text-right" />
                              <Select value={String(parseAmount(p.taux))} onChange={(e) => setPart(i, { taux: e.target.value })} aria-label="Taux de TVA">
                                {rateOptions(p.taux).map((r) => <option key={r} value={String(r)}>{r === 0 ? 'Sans TVA' : `${r} %`}</option>)}
                              </Select>
                            </div>
                            {p.compte === '6640' && (
                              <p className="text-[12px] text-amber-800">
                                Frais de représentation : notez le motif et les personnes concernées dans la remarque — le fisc le demande.
                              </p>
                            )}
                            {p.compte === '6100' && amount > 1000 && (
                              <p className="text-[12px] text-amber-800">
                                Plus de CHF 1’000 : un appareil durable s’amortit souvent sur plusieurs années, à voir avec la fiduciaire.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] px-1">
                      <span className="text-stone-600">
                        Imputé : <strong className="text-stone-900">{formatCHF(sumParts)}</strong>
                        {form.parts.length > 1 && ` sur ${form.parts.length} comptes`}
                      </span>
                      {privee > 0.005 && (
                        <span className="text-stone-600">
                          Part privée, non comptabilisée : <strong className="text-stone-900">{formatCHF(privee)}</strong>
                        </span>
                      )}
                      {privee < -0.005 && (
                        <span className="text-red-700 font-medium">Les parts dépassent le total de {formatCHF(-privee)}</span>
                      )}
                      {Math.abs(privee) <= 0.005 && total > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Le ticket est entièrement imputé</span>
                      )}
                    </div>
                  </section>

                  {extraction && extraction.lignes.length > 0 && (
                    <details className="rounded-xl border border-stone-200 text-[12.5px]">
                      <summary className="px-3 py-2 cursor-pointer text-stone-700 font-medium flex items-center gap-1.5">
                        <Sparkles size={13} className="text-accent" /> Articles lus ({extraction.lignes.length})
                      </summary>
                      <ul className="divide-y divide-stone-100 border-t border-stone-100">
                        {extraction.lignes.map((l, i) => (
                          <li key={i} className="px-3 py-1.5 flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-stone-800">
                              {l.quantite !== 1 && `${l.quantite} × `}{l.designation}
                            </span>
                            <span className="shrink-0 flex items-center gap-2">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600" title={l.compte === 'prive' ? 'Achat privé' : accountLabel(l.compte)}>
                                {l.compte === 'prive' ? 'privé' : l.compte}
                              </span>
                              <span className="tabular-nums text-stone-900">{formatCHF(l.montant_ttc)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <Field label="Remarque" hint="Motif de l’achat, personnes invitées, ce que la fiduciaire doit savoir.">
                    <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                  </Field>

                  {saveError && <Callout tone="danger">{saveError}</Callout>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="primary" icon={CheckCircle2} onClick={handleSave} loading={saving} disabled={phase !== 'review' || !prepared}>
            Enregistrer la dépense
          </Button>
        </div>
      </div>
    </div>
  );
}
