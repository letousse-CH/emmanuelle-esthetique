"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, Search, UserPlus, X, Plus, Minus, Trash2, Check, Download,
  Receipt, AlertCircle, Loader2, Pencil,
} from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import {
  createClient, createTransaction, listClients, listServices, matchClient,
} from '../../../services/caisse';
import { downloadFacture } from '../../../utils/factureDownload';
import {
  CLIENT_DE_PASSAGE, MODES_PAIEMENT, TAUX_TVA_CH, cartTotals, clientFullName, formatCHF,
} from '../../../types/caisse';
import type { CartLine, Client, ModePaiement, Service, Transaction } from '../../../types/caisse';

const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `l${Date.now()}${Math.random()}`);

export default function CaisseClient() {
  const settings = useSettings(['caisse_tva_assujetti', 'caisse_tva_taux_defaut']);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);

  const [clients, setClients]   = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [client, setClient]     = useState<Client | null>(null);
  const [lines, setLines]       = useState<CartLine[]>([]);
  const [mode, setMode]         = useState<ModePaiement>('twint');
  const [note, setNote]         = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setLoadError(null);
    try {
      const [c, s] = await Promise.all([listClients(), listServices(false)]);
      setClients(c); setServices(s);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => cartTotals(lines), [lines]);

  const addService = (s: Service) => {
    setLines(prev => {
      // Deuxième clic sur la même prestation : on incrémente plutôt que
      // d'empiler une ligne identique.
      const existing = prev.findIndex(l => l.service_id === s.id && l.prix_unitaire_ttc === Number(s.prix_chf));
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantite: next[existing].quantite + 1 };
        return next;
      }
      return [...prev, {
        key: newKey(),
        service_id: s.id,
        description: s.nom,
        prix_unitaire_ttc: Number(s.prix_chf),
        quantite: 1,
        taux_tva: Number(s.taux_tva_defaut ?? tauxDefaut),
      }];
    });
  };

  const addCustomLine = (description: string, prix: number) => {
    setLines(prev => [...prev, {
      key: newKey(),
      service_id: null,
      description,
      prix_unitaire_ttc: prix,
      quantite: 1,
      taux_tva: tauxDefaut,
    }]);
  };

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setLines(prev => prev.filter(l => l.key !== key));

  const resetCart = () => {
    setClient(null); setLines([]); setNote(''); setSubmitError(null); setReceipt(null);
  };

  const handleSubmit = async () => {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const tx = await createTransaction({
        clientId: client?.id ?? null,
        clientLabel: client ? clientFullName(client) : CLIENT_DE_PASSAGE,
        modePaiement: mode,
        note,
        lines,
      });
      setReceipt(tx);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "L'encaissement a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return <ReceiptPanel transaction={receipt} onNew={resetCart} />;
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${lines.length > 0 ? 'pb-24 lg:pb-0' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <CreditCard size={20} className="text-sage" /> Encaissement
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/admin/caisse/journal"
          className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300 rounded-lg text-sm transition-all self-start"
        >
          <Receipt size={13} /> Journal des recettes
        </Link>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Chargement impossible</p>
            <p className="text-xs font-mono mt-0.5">{loadError}</p>
            <p className="text-xs mt-1">
              Si l&apos;erreur mentionne une table manquante, applique la migration
              <code className="mx-1 px-1 bg-red-100 rounded">supabase/migrations/20260731_caisse.sql</code>
              sur ton projet Supabase.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* ── Colonne gauche : cliente + catalogue ─────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <ClientPicker
            clients={clients}
            selected={client}
            onSelect={setClient}
            onCreated={(c) => { setClients(prev => [...prev, c]); setClient(c); }}
          />
          <ServiceCatalog
            services={services}
            loading={loading}
            onPick={addService}
            onCustom={addCustomLine}
          />
        </div>

        {/* ── Colonne droite : panier ──────────────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Panier</h2>
              {lines.length > 0 && (
                <button
                  onClick={() => setLines([])}
                  className="text-[11px] text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Vider
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="p-8 text-center text-stone-400 text-sm italic">
                Sélectionne une prestation pour commencer.
              </p>
            ) : (
              <ul className="divide-y divide-stone-50">
                {lines.map(line => (
                  <CartRow
                    key={line.key}
                    line={line}
                    tvaActive={tvaActive}
                    onPatch={patch => patchLine(line.key, patch)}
                    onRemove={() => removeLine(line.key)}
                  />
                ))}
              </ul>
            )}

            <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50 space-y-1.5 text-sm">
              {tvaActive && (
                <>
                  <Row label="Total HT" value={formatCHF(totals.ht)} />
                  <Row label="TVA" value={formatCHF(totals.tva)} />
                </>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-stone-100">
                <span className="text-sm font-medium text-stone-800">Total à encaisser</span>
                <span className="text-xl font-semibold text-stone-900 tabular-nums">{formatCHF(totals.ttc)}</span>
              </div>
              {!tvaActive && (
                <p className="text-[10px] text-stone-400 pt-1">TVA 0 % — activité non assujettie</p>
              )}
            </div>
          </div>

          <div ref={paymentRef} className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5 space-y-4 scroll-mt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2.5">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {MODES_PAIEMENT.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    aria-pressed={mode === m.value}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                      mode === m.value
                        ? 'border-sage bg-sage/8 text-sage'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="caisse-note" className="block text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                Note <span className="normal-case tracking-normal font-normal text-stone-300">(facultatif)</span>
              </label>
              <input
                id="caisse-note"
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Bon cadeau, remarque…"
                className="w-full px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={lines.length === 0 || submitting}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3.5 rounded-xl text-sm font-medium uppercase tracking-widest hover:bg-sage transition-colors disabled:opacity-40 disabled:hover:bg-stone-900 cursor-pointer"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Encaissement…</>
                : <><Check size={15} /> Encaisser {formatCHF(totals.ttc)}</>}
            </button>
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              La facture est numérotée et enregistrée définitivement.
              Une erreur se corrige par une annulation depuis le journal.
            </p>
          </div>
        </div>
      </div>

      {/* Récapitulatif flottant — téléphone uniquement. Il ne valide pas
          l'encaissement : il amène au choix du mode de paiement. Valider d'ici
          enregistrerait le mode par défaut, donc une ligne fausse dans le livre
          de caisse pour un simple pouce mal placé. */}
      {lines.length > 0 && (
        <div
          className="lg:hidden fixed inset-x-0 z-30 px-4 pb-3"
          style={{ bottom: 'calc(var(--caisse-tabbar-h, 0px) + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="w-full flex items-center justify-between gap-3 bg-stone-900 text-white pl-5 pr-4 py-3.5 rounded-xl shadow-lg active:bg-sage transition-colors cursor-pointer"
          >
            <span className="text-xs text-white/60">
              {lines.length} ligne{lines.length !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-semibold tabular-nums">{formatCHF(totals.ttc)}</span>
              <span className="text-xs uppercase tracking-widest text-white/70">Paiement →</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-stone-500">
      <span className="text-xs">{label}</span>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

// ── Sélection de la cliente ──────────────────────────────────────────────────

function ClientPicker({ clients, selected, onSelect, onCreated }: {
  clients: Client[];
  selected: Client | null;
  onSelect: (c: Client | null) => void;
  onCreated: (c: Client) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const results = useMemo(
    () => clients.filter(c => matchClient(c, search)).slice(0, 8),
    [clients, search],
  );

  return (
    <div ref={containerRef} className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Cliente</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-[11px] text-sage hover:text-sage/70 font-semibold transition-colors cursor-pointer"
        >
          <UserPlus size={12} /> Nouvelle fiche
        </button>
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 truncate">{clientFullName(selected)}</p>
            {(selected.telephone || selected.email) && (
              <p className="text-xs text-stone-400 truncate">
                {[selected.telephone, selected.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={() => { onSelect(null); setSearch(''); }}
            aria-label="Retirer la cliente sélectionnée"
            className="shrink-0 p-1.5 text-stone-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Le menu est ancré sur le champ lui-même (`top-full`) : pas de
              décalage codé en dur qui casserait si le libellé change. */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" />
            <label htmlFor="caisse-client-search" className="sr-only">Rechercher une cliente</label>
            <input
              id="caisse-client-search"
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Nom, prénom ou téléphone…"
              autoComplete="off"
              className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
            />

            {open && search.trim() !== '' && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-stone-400 italic">Aucune cliente trouvée.</li>
                ) : results.map(c => (
                  <li key={c.id}>
                    <button
                      onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <span className="block text-sm text-stone-800">{clientFullName(c)}</span>
                      {c.telephone && <span className="block text-xs text-stone-400">{c.telephone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[11px] text-stone-400">
            Laisse vide pour encaisser en <strong className="font-medium text-stone-500">{CLIENT_DE_PASSAGE}</strong>.
          </p>
        </>
      )}

      {creating && (
        <QuickClientDialog
          onClose={() => setCreating(false)}
          onCreated={(c) => { onCreated(c); setCreating(false); setSearch(''); }}
        />
      )}
    </div>
  );
}

function QuickClientDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (c: Client) => void;
}) {
  const [nom, setNom]             = useState('');
  const [prenom, setPrenom]       = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true); setError(null);
    try {
      const c = await createClient({
        nom: nom.trim(), prenom: prenom.trim(),
        telephone: telephone.trim() || null, email: email.trim() || null, notes: null,
      });
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle fiche cliente"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Nouvelle cliente</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" value={prenom} onChange={setPrenom} />
            <Field label="Nom *" value={nom} onChange={setNom} required autoFocus />
          </div>
          <Field label="Téléphone" value={telephone} onChange={setTelephone} type="tel" />
          <Field label="E-mail" value={email} onChange={setEmail} type="email" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !nom.trim()}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-sage transition-colors disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Enregistrement…' : 'Créer et sélectionner'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoFocus?: boolean;
}) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-stone-500 mb-1">{label}</label>
      <input
        id={id} type={type} value={value} required={required} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
      />
    </div>
  );
}

// ── Catalogue ───────────────────────────────────────────────────────────────

function ServiceCatalog({ services, loading, onPick, onCustom }: {
  services: Service[];
  loading: boolean;
  onPick: (s: Service) => void;
  onCustom: (description: string, prix: number) => void;
}) {
  const [search, setSearch] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const filtered = services.filter(s =>
    s.nom.toLowerCase().includes(search.trim().toLowerCase()));

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const prix = Number(customAmount.replace(',', '.'));
    if (!Number.isFinite(prix) || prix <= 0) return;
    onCustom(customLabel.trim() || 'Prestation', prix);
    setCustomLabel(''); setCustomAmount('');
  };

  return (
    <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Prestations</h2>
        {services.length > 6 && (
          <div className="relative sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" />
            <label htmlFor="caisse-service-search" className="sr-only">Filtrer les prestations</label>
            <input
              id="caisse-service-search"
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="w-full pl-8 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-[68px] bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-5 py-6 text-center">
          <p className="text-stone-400 text-sm italic mb-2">Aucune prestation dans le catalogue.</p>
          <Link href="/admin/caisse/prestations" className="text-sage text-sm font-medium hover:underline">
            Créer le catalogue →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="text-left px-3.5 py-3 rounded-xl border border-stone-200 hover:border-sage hover:bg-sage/5 transition-all cursor-pointer group"
            >
              <span className="block text-sm text-stone-800 font-medium leading-snug line-clamp-2 group-hover:text-sage">{s.nom}</span>
              <span className="block text-xs text-stone-400 mt-1 tabular-nums">{formatCHF(s.prix_chf)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Montant libre — bon cadeau, produit revendu, forfait négocié… */}
      <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-stone-50">
        <label htmlFor="caisse-custom-label" className="sr-only">Libellé du montant libre</label>
        <input
          id="caisse-custom-label"
          type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
          placeholder="Montant libre — libellé"
          className="flex-1 px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all"
        />
        <label htmlFor="caisse-custom-amount" className="sr-only">Montant en francs</label>
        <input
          id="caisse-custom-amount"
          type="text" inputMode="decimal" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
          placeholder="CHF"
          className="sm:w-28 px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-300 focus:border-sage focus:ring-1 focus:ring-sage/20 outline-none transition-all tabular-nums"
        />
        <button
          type="submit"
          disabled={!customAmount.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 hover:border-sage hover:text-sage text-sm transition-all disabled:opacity-40 cursor-pointer"
        >
          <Plus size={14} /> Ajouter
        </button>
      </form>
    </div>
  );
}

// ── Ligne de panier ─────────────────────────────────────────────────────────

function CartRow({ line, tvaActive, onPatch, onRemove }: {
  line: CartLine;
  tvaActive: boolean;
  onPatch: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const total = line.prix_unitaire_ttc * line.quantite;

  return (
    <li className="px-5 py-3.5 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-stone-800 leading-snug flex-1 min-w-0">{line.description}</p>
        <span className="text-sm font-medium text-stone-900 tabular-nums shrink-0">{formatCHF(total)}</span>
        <button
          onClick={onRemove}
          aria-label={`Retirer ${line.description}`}
          className="shrink-0 p-1 text-stone-300 hover:text-red-500 rounded hover:bg-red-50 transition-all cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => onPatch({ quantite: Math.max(1, line.quantite - 1) })}
            aria-label="Diminuer la quantité"
            className="px-2 py-1 text-stone-400 hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Minus size={12} />
          </button>
          <span className="px-2.5 text-xs tabular-nums text-stone-700 min-w-[2rem] text-center">{line.quantite}</span>
          <button
            onClick={() => onPatch({ quantite: line.quantite + 1 })}
            aria-label="Augmenter la quantité"
            className="px-2 py-1 text-stone-400 hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Plus size={12} />
          </button>
        </div>

        {editingPrice ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            defaultValue={String(line.prix_unitaire_ttc)}
            aria-label="Prix unitaire en francs"
            onBlur={e => {
              const v = Number(e.target.value.replace(',', '.'));
              if (Number.isFinite(v) && v >= 0) onPatch({ prix_unitaire_ttc: v });
              setEditingPrice(false);
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-24 px-2 py-1 border border-sage rounded-lg text-xs tabular-nums text-stone-700 outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingPrice(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 text-xs text-stone-400 hover:text-stone-700 hover:border-stone-300 transition-all cursor-pointer tabular-nums"
          >
            <Pencil size={10} /> {formatCHF(line.prix_unitaire_ttc)}
          </button>
        )}

        {tvaActive && (
          <>
            <label htmlFor={`tva-${line.key}`} className="sr-only">Taux de TVA</label>
            <select
              id={`tva-${line.key}`}
              value={line.taux_tva}
              onChange={e => onPatch({ taux_tva: Number(e.target.value) })}
              className="px-2 py-1 border border-stone-200 rounded-lg text-xs text-stone-500 focus:border-sage outline-none cursor-pointer"
            >
              {TAUX_TVA_CH.map(t => (
                <option key={t.value} value={t.value}>TVA {t.value} %</option>
              ))}
            </select>
          </>
        )}
      </div>
    </li>
  );
}

// ── Confirmation d'encaissement ─────────────────────────────────────────────

function ReceiptPanel({ transaction, onNew }: { transaction: Transaction; onNew: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    setDownloading(true); setError(null);
    try {
      await downloadFacture(transaction.id, transaction.numero);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible.');
    } finally {
      setDownloading(false);
    }
  }, [transaction]);

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-sage/10 text-sage flex items-center justify-center mx-auto">
          <Check size={26} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Encaissement enregistré</p>
          <p className="text-3xl font-semibold text-stone-900 tabular-nums">{formatCHF(transaction.total_ttc)}</p>
          <p className="text-sm text-stone-400 mt-2">
            Facture <span className="font-medium text-stone-600">{transaction.numero}</span> · {transaction.client_label}
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-2 pt-1">
          <button
            onClick={download}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-sage transition-colors disabled:opacity-50 cursor-pointer"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {downloading ? 'Génération…' : 'Télécharger la quittance PDF'}
          </button>
          <button
            onClick={onNew}
            className="w-full py-3 rounded-xl border border-stone-200 text-stone-600 text-sm hover:border-stone-300 hover:text-stone-900 transition-all cursor-pointer"
          >
            Nouvel encaissement
          </button>
          <Link
            href="/admin/caisse/journal"
            className="block w-full py-2 text-stone-400 text-xs hover:text-stone-700 transition-colors"
          >
            Voir le journal des recettes
          </Link>
        </div>
      </div>
    </div>
  );
}
