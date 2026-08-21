"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, Search, UserPlus, X, Plus, Minus, Trash2, Check, Download,
  Receipt, AlertCircle, Loader2, Pencil, Gift, Ticket, PenLine, Layers, Package,
  Cake, Mail, MessageCircle,
} from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import {
  createClient, createTransaction, findGiftCardByCode, listClients, listGiftCardsForSale,
  listProducts, listServiceCategories, listServices, matchClient,
} from '../../../services/caisse';
import { downloadBonCadeau, downloadFacture } from '../../../utils/factureDownload';
import { takeCaisseCorrection } from '../../../utils/caissePrefill';
import {
  CLIENT_DE_PASSAGE, MODES_PAIEMENT, TAUX_TVA_CH, cartTotals, clientFullName, formatCHF,
  giftCardStatusLabel, isGiftCardUsable, stockLevel,
} from '../../../types/caisse';
import { toWhatsAppNumber } from '../../../types/promotions';
import { notifyAutomationEvent } from '../../../utils/automationEvent';
import type {
  CartLine, Client, GiftCard, ModePaiement, Product, Service, ServiceCategory, Transaction,
} from '../../../types/caisse';

const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `l${Date.now()}${Math.random()}`);

export default function CaisseClient() {
  const settings = useSettings([
    'caisse_tva_assujetti', 'caisse_tva_taux_defaut', 'caisse_bon_validite_mois',
  ]);
  const tvaActive = settings.caisse_tva_assujetti === 'true';
  const tauxDefaut = Number(settings.caisse_tva_taux_defaut || 0);
  const bonValiditeMois = Number(settings.caisse_bon_validite_mois || 60);

  const [clients, setClients]   = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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

  // Bon présenté en paiement (distinct des bons vendus, qui sont des lignes).
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [showGiftUse, setShowGiftUse] = useState(false);
  const [showGiftSale, setShowGiftSale] = useState(false);

  // Correction d'une facture erronée : elle a déjà été annulée par le journal,
  // il ne reste qu'à ré-encaisser les données rectifiées.
  const [correction, setCorrection] = useState<{ id: string; numero: string } | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const pending = takeCaisseCorrection();
    if (!pending) return;
    setCorrection({ id: pending.corrigeTransactionId, numero: pending.numero });
    setLines(pending.lines.map(l => ({ ...l, key: newKey() })));
    setMode(pending.modePaiement === 'bon_cadeau' ? 'twint' : pending.modePaiement);
    setNote(pending.note ?? '');
    if (pending.clientId) {
      // La fiche est chargée par `load()` : on la retrouve dès qu'elle arrive.
      setPendingClientId(pending.clientId);
    }
  }, []);

  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingClientId || clients.length === 0) return;
    const found = clients.find(c => c.id === pendingClientId);
    if (found) setClient(found);
    setPendingClientId(null);
  }, [pendingClientId, clients]);

  const load = async () => {
    setLoading(true); setLoadError(null);
    try {
      // Clientes et prestations sont vitales : sans elles, pas d'encaissement.
      // Catégories et produits ne le sont pas — ils ne font qu'organiser et
      // enrichir le catalogue. Tant que la migration
      // `20260802_caisse_categories_forfaits_stock.sql` n'est pas appliquée,
      // leurs tables n'existent pas : on encaisse quand même, sans onglets ni
      // marchandise, plutôt que de bloquer la caisse sur un confort d'affichage.
      const [c, s] = await Promise.all([listClients(), listServices(false)]);
      setClients(c); setServices(s);

      const [cats, prod] = await Promise.all([
        listServiceCategories().catch(() => [] as ServiceCategory[]),
        listProducts(false).catch(() => [] as Product[]),
      ]);
      setCategories(cats); setProducts(prod);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => cartTotals(lines), [lines]);

  // Quantité de chaque article déjà dans le panier : le catalogue affiche le
  // stock qu'il RESTERA une fois la vente validée, pas le stock en base. C'est
  // le chiffre utile quand on ajoute le troisième flacon d'affilée.
  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) {
      if (!l.product_id) continue;
      map.set(l.product_id, (map.get(l.product_id) ?? 0) + Number(l.quantite || 0));
    }
    return map;
  }, [lines]);

  // Le bon règle autant qu'il peut, sans jamais dépasser la facture : le solde
  // éventuel reste sur le bon pour une prochaine visite.
  const montantBon = useMemo(() => {
    if (!giftCard) return 0;
    return Math.min(Number(giftCard.montant_restant), totals.ttc);
  }, [giftCard, totals.ttc]);

  const resteAPayer = Math.round((totals.ttc - montantBon) * 100) / 100;
  // Facture soldée par le seul bon : le mode de règlement devient « bon cadeau »
  // et aucune recette n'est encaissée (elle l'a été à la vente du bon).
  const effectiveMode: ModePaiement = montantBon > 0 && resteAPayer === 0 ? 'bon_cadeau' : mode;

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

  /**
   * Ajoute de la marchandise au panier. La ligne porte `product_id` : c'est lui
   * qui déclenchera, à la validation, la sortie de stock et le figeage du coût
   * d'achat sur la facture.
   */
  const addProduct = (p: Product) => {
    setLines(prev => {
      const existing = prev.findIndex(l => l.product_id === p.id && l.prix_unitaire_ttc === Number(p.prix_vente_chf));
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantite: next[existing].quantite + 1 };
        return next;
      }
      return [...prev, {
        key: newKey(),
        service_id: null,
        product_id: p.id,
        description: p.nom,
        prix_unitaire_ttc: Number(p.prix_vente_chf),
        quantite: 1,
        taux_tva: Number(p.taux_tva_defaut ?? tauxDefaut),
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
    setGiftCard(null); setCorrection(null);
  };

  const handleSubmit = async () => {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const tx = await createTransaction({
        clientId: client?.id ?? null,
        clientLabel: client ? clientFullName(client) : CLIENT_DE_PASSAGE,
        modePaiement: effectiveMode,
        note,
        lines,
        giftCardCode: giftCard?.code ?? null,
        montantBon,
        corrigeTransactionId: correction?.id ?? null,
      });
      setReceipt(tx);
      // Une vente encaissée est l'événement `sale.created` du module
      // Automatisations. L'encaissement passe par une fonction Postgres
      // appelée depuis le navigateur : aucun code serveur ne le voit passer,
      // d'où ce signalement explicite.
      void notifyAutomationEvent('sale.created');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "L'encaissement a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  const addGiftCardLine = (montant: number, libelle: string, beneficiaire: string) => {
    setLines(prev => [...prev, {
      key: newKey(),
      service_id: null,
      description: libelle,
      prix_unitaire_ttc: montant,
      quantite: 1,
      // Vendre un bon n'est pas une prestation : en TVA suisse, l'impôt est dû
      // à l'utilisation du bon, pas à sa vente. La ligne reste donc à 0 %, et
      // c'est la facture du soin qui portera la TVA le jour venu.
      taux_tva: 0,
      gift_card: { beneficiaire, validiteMois: bonValiditeMois },
    }]);
    setShowGiftSale(false);
  };

  if (receipt) {
    return <ReceiptPanel transaction={receipt} onNew={resetCart} />;
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${lines.length > 0 ? 'pb-24 lg:pb-0' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Caisse</p>
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2.5">
            <CreditCard size={20} className="text-sage" /> Encaissement
          </h1>
          <p className="mt-1 text-sm text-stone-600">
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

      {correction && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <PenLine size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Correction de la facture {correction.numero}</p>
            <p className="text-xs mt-0.5 leading-relaxed">
              Elle a été annulée et reste au journal avec son numéro. Rectifie ce qu&apos;il faut
              ci-dessous : la nouvelle facture y sera rattachée, pour que la correction reste visible.
            </p>
          </div>
          <button
            onClick={() => setCorrection(null)}
            className="shrink-0 text-[11px] font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Détacher
          </button>
        </div>
      )}

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
            categories={categories}
            products={products}
            cartQtyByProduct={cartQtyByProduct}
            loading={loading}
            onPick={addService}
            onPickProduct={addProduct}
            onCustom={addCustomLine}
            onSellGiftCard={() => setShowGiftSale(true)}
          />
        </div>

        {/* ── Colonne droite : panier ──────────────────────────────────── */}
        <div className="lg:col-span-2 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-stone-800">Panier</h2>
              {lines.length > 0 && (
                <button
                  onClick={() => setLines([])}
                  className="text-[12.5px] text-stone-500 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Vider
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="p-8 text-center text-sm text-stone-600">
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
              {montantBon > 0 && (
                <>
                  <Row label="Total prestations" value={formatCHF(totals.ttc)} />
                  <Row label={`Bon ${giftCard?.code ?? ''}`} value={`− ${formatCHF(montantBon)}`} />
                </>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-stone-100">
                <span className="text-sm font-medium text-stone-800">
                  {montantBon > 0 ? 'Reste à encaisser' : 'Total à encaisser'}
                </span>
                <span className="text-xl font-semibold text-stone-900 tabular-nums">{formatCHF(resteAPayer)}</span>
              </div>
              {!tvaActive && (
                <p className="text-[12px] text-stone-500 pt-1">TVA 0 % — activité non assujettie</p>
              )}
            </div>
          </div>

          {/* ── Bon cadeau présenté en paiement ────────────────────────── */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5">
            {giftCard ? (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 flex items-center gap-2">
                      <Ticket size={14} className="text-sage shrink-0" /> {giftCard.code}
                    </p>
                    <p className="truncate text-[12.5px] text-stone-500">{giftCard.libelle}</p>
                  </div>
                  <button
                    onClick={() => setGiftCard(null)}
                    aria-label="Retirer le bon cadeau"
                    className="shrink-0 p-1.5 text-stone-500 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <dl className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Solde du bon</dt>
                    <dd className="text-stone-600 tabular-nums">{formatCHF(giftCard.montant_restant)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Appliqué à cette vente</dt>
                    <dd className="text-sage font-medium tabular-nums">− {formatCHF(montantBon)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Restera sur le bon</dt>
                    <dd className="text-stone-600 tabular-nums">
                      {formatCHF(Number(giftCard.montant_restant) - montantBon)}
                    </dd>
                  </div>
                </dl>
                <p className="text-[12px] text-stone-500 leading-relaxed pt-1">
                  Cette part n&apos;entre pas dans les recettes : elle a été encaissée
                  le jour où le bon a été vendu.
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowGiftUse(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 text-sm transition-all cursor-pointer"
              >
                <Ticket size={15} /> La cliente a un bon cadeau
              </button>
            )}
          </div>

          <div ref={paymentRef} className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 space-y-4 scroll-mt-4">
            <div>
              <p className="text-[13px] font-medium text-stone-800 mb-2.5">
                {montantBon > 0 ? 'Reste à régler' : 'Mode de paiement'}
              </p>
              {resteAPayer === 0 && montantBon > 0 ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-sage/30 bg-sage/5 px-4 py-3 text-sm text-stone-700">
                  <Ticket size={15} className="text-sage shrink-0" />
                  Intégralement réglé par le bon {giftCard?.code}. Rien à encaisser.
                </div>
              ) : (
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
              )}
            </div>

            <div>
              <label htmlFor="caisse-note" className="block text-[13px] font-medium text-stone-800 mb-2">
                Note <span className="normal-case tracking-normal font-normal text-stone-500">(facultatif)</span>
              </label>
              <input
                id="caisse-note"
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Bon cadeau, remarque…"
                className="w-full px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
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
              className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-stone-900 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-900 cursor-pointer"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Encaissement…</>
                : resteAPayer === 0 && montantBon > 0
                  ? <><Check size={15} /> Valider la prestation</>
                  : <><Check size={15} /> Encaisser {formatCHF(resteAPayer)}</>}
            </button>
            <p className="text-[12px] text-stone-500 text-center leading-relaxed">
              La facture est numérotée et enregistrée définitivement.
              Une erreur se corrige depuis le journal, avec le bouton « Corriger ».
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
              <span className="text-base font-semibold tabular-nums">{formatCHF(resteAPayer)}</span>
              <span className="text-xs text-white/70">Paiement →</span>
            </span>
          </button>
        </div>
      )}

      {showGiftUse && (
        <GiftCardUseDialog
          onClose={() => setShowGiftUse(false)}
          onFound={(card) => { setGiftCard(card); setShowGiftUse(false); }}
        />
      )}

      {showGiftSale && (
        <GiftCardSaleDialog
          services={services}
          validiteMois={bonValiditeMois}
          onClose={() => setShowGiftSale(false)}
          onAdd={addGiftCardLine}
        />
      )}
    </div>
  );
}

// ── Présenter un bon en paiement ────────────────────────────────────────────

function GiftCardUseDialog({ onClose, onFound }: {
  onClose: () => void;
  onFound: (card: GiftCard) => void;
}) {
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true); setError(null);
    try {
      const card = await findGiftCardByCode(code);
      if (!card) {
        setError(`Aucun bon ne porte le code « ${code.trim()} ».`);
      } else if (!isGiftCardUsable(card)) {
        setError(`Ce bon n'est pas utilisable : ${giftCardStatusLabel(card).toLowerCase()}.`);
      } else {
        onFound(card);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Utiliser un bon cadeau"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Ticket size={15} className="text-sage" /> Bon cadeau
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="gift-code" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Code inscrit sur le bon
            </label>
            <input
              id="gift-code" type="text" value={code} autoFocus autoCapitalize="characters"
              onChange={e => setCode(e.target.value)}
              placeholder={`BON-${new Date().getFullYear()}-0001`}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors uppercase tracking-wide"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={searching || !code.trim()}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-stone-700 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {searching ? 'Recherche…' : 'Appliquer le bon'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Vendre un bon cadeau ────────────────────────────────────────────────────

function GiftCardSaleDialog({ services, validiteMois, onClose, onAdd }: {
  services: Service[];
  validiteMois: number;
  onClose: () => void;
  onAdd: (montant: number, libelle: string, beneficiaire: string) => void;
}) {
  const [kind, setKind] = useState<'montant' | 'soins'>('montant');
  const [montant, setMontant] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [beneficiaire, setBeneficiaire] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pickedServices = services.filter(s => picked.includes(s.id));
  const soinsTotal = pickedServices.reduce((acc, s) => acc + Number(s.prix_chf), 0);

  const echeance = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + validiteMois);
    return d;
  }, [validiteMois]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'montant') {
      const value = Number(montant.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        setError('Indique un montant supérieur à zéro.');
        return;
      }
      onAdd(Math.round(value * 100) / 100, 'Bon cadeau', beneficiaire.trim());
    } else {
      if (pickedServices.length === 0) {
        setError('Choisis au moins un soin.');
        return;
      }
      onAdd(
        Math.round(soinsTotal * 100) / 100,
        `Bon cadeau — ${pickedServices.map(s => s.nom).join(' + ')}`,
        beneficiaire.trim(),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Vendre un bon cadeau"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Gift size={15} className="text-sage" /> Vendre un bon cadeau
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            {([['montant', 'Montant au choix'], ['soins', 'Un ou plusieurs soins']] as const).map(([k, label]) => (
              <button
                key={k} type="button" onClick={() => { setKind(k); setError(null); }}
                aria-pressed={kind === k}
                className={`flex-1 px-4 py-2 text-sm transition-colors cursor-pointer ${
                  kind === k ? 'bg-sage/10 text-sage font-medium' : 'text-stone-500 hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === 'montant' ? (
            <div>
              <label htmlFor="gift-montant" className="block text-[12.5px] font-medium text-stone-700 mb-1">
                Montant du bon (CHF) *
              </label>
              <input
                id="gift-montant" type="text" inputMode="decimal" autoFocus
                value={montant} onChange={e => setMontant(e.target.value)}
                placeholder="150.00"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-stone-500">Soins offerts *</p>
              {services.length === 0 ? (
                <p className="text-[12.5px] text-stone-500 italic">Le catalogue est vide.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-50">
                  {services.map(s => {
                    const checked = picked.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50 cursor-pointer">
                        <input
                          type="checkbox" checked={checked}
                          onChange={() => setPicked(p => checked ? p.filter(id => id !== s.id) : [...p, s.id])}
                          className="accent-sage"
                        />
                        <span className="flex-1 text-sm text-stone-700 truncate">{s.nom}</span>
                        <span className="text-[12.5px] text-stone-500 tabular-nums">{formatCHF(s.prix_chf)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {pickedServices.length > 0 && (
                <p className="text-sm text-stone-700 text-right tabular-nums">
                  Valeur du bon : <strong>{formatCHF(soinsTotal)}</strong>
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="gift-benef" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Bénéficiaire <span className="text-stone-500">(facultatif — la personne à qui il est offert)</span>
            </label>
            <input
              id="gift-benef" type="text" value={beneficiaire} onChange={e => setBeneficiaire(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
          </div>

          <div className="rounded-lg bg-stone-50 border border-stone-100 px-4 py-3 text-[11px] text-stone-500 leading-relaxed">
            Valable {validiteMois} mois — jusqu&apos;au{' '}
            <strong className="text-stone-700">{echeance.toLocaleDateString('fr-CH')}</strong>.
            L&apos;échéance est figée à l&apos;émission : changer la durée dans les réglages
            ne raccourcira jamais un bon déjà vendu.
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm hover:border-stone-300 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-stone-700 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Ajouter au panier
            </button>
          </div>
        </form>
      </div>
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
    <div ref={containerRef} className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-medium text-stone-800">Cliente</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-[11px] text-sage hover:text-stone-900/70 font-semibold transition-colors cursor-pointer"
        >
          <UserPlus size={12} /> Nouvelle fiche
        </button>
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sage/30 bg-sage/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-900 truncate">{clientFullName(selected)}</p>
            {(selected.telephone || selected.email) && (
              <p className="truncate text-[12.5px] text-stone-500">
                {[selected.telephone, selected.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={() => { onSelect(null); setSearch(''); }}
            aria-label="Retirer la cliente sélectionnée"
            className="shrink-0 p-1.5 text-stone-500 hover:text-red-500 rounded-md hover:bg-red-50 transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Le menu est ancré sur le champ lui-même (`top-full`) : pas de
              décalage codé en dur qui casserait si le libellé change. */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            <label htmlFor="caisse-client-search" className="sr-only">Rechercher une cliente</label>
            <input
              id="caisse-client-search"
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Nom, prénom ou téléphone…"
              autoComplete="off"
              className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />

            {open && search.trim() !== '' && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-stone-600 italic">Aucune cliente trouvée.</li>
                ) : results.map(c => (
                  <li key={c.id}>
                    <button
                      onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <span className="block text-sm text-stone-800">{clientFullName(c)}</span>
                      {c.telephone && <span className="block text-[12.5px] text-stone-500">{c.telephone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[12.5px] text-stone-500">
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

/**
 * Création d'une fiche depuis l'écran d'encaissement.
 *
 * Mêmes champs que la fiche complète de `/admin/caisse/clients` : une cliente
 * qu'on inscrit pendant qu'elle est devant soi est le seul moment où l'on a
 * vraiment ses informations sous la main — la renvoyer vers un autre écran
 * pour finir la saisie, c'est se garantir qu'elle ne sera jamais finie.
 *
 * Les accords publicitaires ne se cochent que si elle l'a dit : un opt-in
 * accordé par omission n'en est pas un (LCD art. 3 al. 1 let. o).
 */
function QuickClientDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (c: Client) => void;
}) {
  const [nom, setNom]                 = useState('');
  const [prenom, setPrenom]           = useState('');
  const [telephone, setTelephone]     = useState('');
  const [email, setEmail]             = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [notes, setNotes]             = useState('');
  const [consentEmail, setConsentEmail]   = useState(false);
  const [consentWa, setConsentWa]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const waNumber = toWhatsAppNumber(telephone);
  const emailClean = email.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true); setError(null);
    try {
      const c = await createClient({
        nom: nom.trim(),
        prenom: prenom.trim(),
        telephone: telephone.trim() || null,
        email: emailClean || null,
        notes: notes.trim() || null,
        date_naissance: dateNaissance || null,
        // Un accord sans moyen de l'honorer n'a pas de sens : pas d'adresse,
        // pas d'accord e-mail ; numéro inexploitable, pas d'accord WhatsApp.
        consent_email: Boolean(consentEmail && emailClean),
        consent_whatsapp: Boolean(consentWa && waNumber),
        consent_source: (consentEmail || consentWa) ? 'Caisse' : null,
      });
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle fiche cliente"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Nouvelle cliente</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" value={prenom} onChange={setPrenom} />
            <Field label="Nom *" value={nom} onChange={setNom} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone" value={telephone} onChange={setTelephone} type="tel" />
            <Field label="E-mail" value={email} onChange={setEmail} type="email" />
          </div>

          <div>
            <label htmlFor="qc-naissance" className="text-[11px] font-medium text-stone-500 mb-1 flex items-center gap-1.5">
              <Cake size={11} className="text-stone-500" /> Date de naissance
            </label>
            <input
              id="qc-naissance" type="date" value={dateNaissance}
              onChange={e => setDateNaissance(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="qc-notes" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Notes <span className="text-stone-500">(préférences, habitudes…)</span>
            </label>
            <textarea
              id="qc-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors resize-y"
            />
          </div>

          <fieldset className="rounded-xl border border-stone-200 p-3.5 space-y-2.5">
            <legend className="text-[11px] font-medium text-stone-500 px-1">Accords publicitaires</legend>
            <p className="text-[12px] text-stone-500 leading-relaxed">
              À cocher seulement si elle vient de le dire. Sans ces cases, elle ne recevra
              aucune promotion.
            </p>
            <QuickConsent
              id="qc-consent-email" icon={Mail} label="Offres par e-mail"
              detail={emailClean || 'Renseigne une adresse pour l’activer'}
              checked={consentEmail} disabled={!emailClean}
              onToggle={() => setConsentEmail(v => !v)}
            />
            <QuickConsent
              id="qc-consent-wa" icon={MessageCircle} label="Offres par WhatsApp"
              detail={waNumber
                ? `+${waNumber}`
                : telephone.trim() ? 'Numéro non exploitable' : 'Renseigne un numéro pour l’activer'}
              checked={consentWa} disabled={!waNumber}
              onToggle={() => setConsentWa(v => !v)}
            />
          </fieldset>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={saving || !nom.trim()}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-2.5 rounded-lg text-sm hover:bg-stone-700 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Enregistrement…' : 'Créer et sélectionner'}
          </button>
        </form>
      </div>
    </div>
  );
}

function QuickConsent({ id, icon: Icon, label, detail, checked, disabled, onToggle }: {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; detail: string; checked: boolean; disabled: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon size={13} className="text-stone-500 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm text-stone-700 cursor-pointer">{label}</label>
          <p className="text-[12.5px] text-stone-500 truncate">{detail}</p>
        </div>
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={onToggle} disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          checked ? 'bg-sage' : 'bg-stone-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
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
      <label htmlFor={id} className="block text-[12.5px] font-medium text-stone-700 mb-1">{label}</label>
      <input
        id={id} type={type} value={value} required={required} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
      />
    </div>
  );
}

// ── Catalogue ───────────────────────────────────────────────────────────────

/**
 * Catalogue de l'écran d'encaissement.
 *
 * Les catégories deviennent des onglets — c'est tout leur intérêt côté caisse :
 * atteindre « Épilation aisselles » sans faire défiler les soins du visage. Un
 * onglet « Produits » referme la marchandise, dont la vignette affiche le stock
 * qu'il RESTERA après la vente en cours.
 */
function ServiceCatalog({
  services, categories, products, cartQtyByProduct, loading,
  onPick, onPickProduct, onCustom, onSellGiftCard,
}: {
  services: Service[];
  categories: ServiceCategory[];
  products: Product[];
  cartQtyByProduct: Map<string, number>;
  loading: boolean;
  onPick: (s: Service) => void;
  onPickProduct: (p: Product) => void;
  onCustom: (description: string, prix: number) => void;
  onSellGiftCard: () => void;
}) {
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  // Seules les catégories qui ont quelque chose à montrer deviennent un onglet :
  // une rangée d'onglets vides ferait perdre plus de temps qu'elle n'en gagne.
  const tabs = useMemo(() => {
    const list: { id: string; label: string }[] = [{ id: 'all', label: 'Tout' }];
    for (const c of categories) {
      if (services.some(s => s.category_id === c.id)) list.push({ id: c.id, label: c.nom });
    }
    if (services.some(s => !s.category_id || !categories.some(c => c.id === s.category_id))) {
      list.push({ id: 'none', label: 'Divers' });
    }
    if (products.length > 0) list.push({ id: 'produits', label: 'Produits' });
    return list;
  }, [categories, services, products]);

  // L'onglet actif peut disparaître (catégorie vidée pendant la session) :
  // on retombe alors sur « Tout » plutôt que d'afficher une grille vide.
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'all';
  const term = search.trim().toLowerCase();

  const filteredServices = useMemo(() => services.filter(s => {
    if (!s.nom.toLowerCase().includes(term)) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'none') return !s.category_id || !categories.some(c => c.id === s.category_id);
    return s.category_id === activeTab;
  }), [services, categories, activeTab, term]);

  const filteredProducts = useMemo(
    () => products.filter(p => `${p.nom} ${p.marque ?? ''}`.toLowerCase().includes(term)),
    [products, term],
  );

  // « Tout » veut dire tout, marchandise comprise : vendre un flacon seul ne
  // doit pas coûter un changement d'onglet. Les produits gardent leur sous-titre
  // pour rester distincts des soins dans la grille.
  const showProducts = (activeTab === 'produits' || activeTab === 'all') && filteredProducts.length > 0;
  const showServices = activeTab !== 'produits' && filteredServices.length > 0;

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const prix = Number(customAmount.replace(',', '.'));
    if (!Number.isFinite(prix) || prix <= 0) return;
    onCustom(customLabel.trim() || 'Prestation', prix);
    setCustomLabel(''); setCustomAmount('');
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium text-stone-800 flex items-center gap-2">
          Catalogue
          {/* Seul accès au catalogue en mode app : la barre d'onglets n'a que
              quatre places, et la barre latérale de l'admin y est masquée. */}
          <Link href="/admin/caisse/prestations" className="normal-case tracking-normal font-normal text-[11px] text-stone-500 hover:text-stone-900 transition-colors">
            gérer
          </Link>
        </h2>
        <button
          onClick={onSellGiftCard}
          className="flex items-center gap-1.5 text-[11px] text-sage hover:text-stone-900/70 font-semibold transition-colors cursor-pointer self-start sm:order-last"
        >
          <Gift size={12} /> Vendre un bon cadeau
        </button>
        {(services.length + products.length > 6) && (
          <div className="relative sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <label htmlFor="caisse-service-search" className="sr-only">Filtrer le catalogue</label>
            <input
              id="caisse-service-search"
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer…"
              className="w-full pl-8 pr-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900/20 outline-none"
            />
          </div>
        )}
      </div>

      {tabs.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={activeTab === t.id}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'border-sage bg-sage/8 text-sage'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
              }`}
            >
              {t.id === 'produits' && <Package size={11} className="inline mr-1 -mt-0.5" />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-[68px] bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      ) : services.length === 0 && products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-5 py-6 text-center">
          <p className="text-sm text-stone-600 mb-2">Le catalogue est vide.</p>
          <Link href="/admin/caisse/prestations" className="text-sage text-sm font-medium hover:underline">
            Créer le catalogue →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {showServices && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredServices.map(s => (
                <button
                  key={s.id}
                  onClick={() => onPick(s)}
                  className="text-left px-3.5 py-3 rounded-xl border border-stone-200 hover:border-sage hover:bg-sage/5 transition-all cursor-pointer group"
                >
                  <span className="block text-sm text-stone-800 font-medium leading-snug line-clamp-2 group-hover:text-stone-900">{s.nom}</span>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-stone-500 mt-1 tabular-nums">
                    {s.type === 'forfait' && <Layers size={10} className="text-sage shrink-0" />}
                    {formatCHF(s.prix_chf)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {showProducts && (
            <div className="space-y-2">
              {activeTab === 'all' && (
                <p className="text-[12px] font-semibold text-stone-500">Produits</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredProducts.map(p => {
                  // Le stock affiché tient compte du panier en cours. Il peut
                  // devenir négatif : on le signale sans jamais bloquer la
                  // vente — la cliente tient le produit en main, c'est
                  // l'inventaire qui a tort, pas elle.
                  const restant = Number(p.stock) - (cartQtyByProduct.get(p.id) ?? 0);
                  const niveau = stockLevel({ stock: restant, seuil_alerte: p.seuil_alerte });
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickProduct(p)}
                      className="text-left px-3.5 py-3 rounded-xl border border-stone-200 hover:border-sage hover:bg-sage/5 transition-all cursor-pointer group"
                    >
                      <span className="block text-sm text-stone-800 font-medium leading-snug line-clamp-2 group-hover:text-stone-900">{p.nom}</span>
                      <span className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[12.5px] text-stone-500 tabular-nums">{formatCHF(p.prix_vente_chf)}</span>
                        <span
                          className={`text-[12px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${
                            niveau === 'rupture' ? 'bg-red-50 text-red-600'
                            : niveau === 'bas' ? 'bg-amber-50 text-amber-700'
                            : 'bg-stone-100 text-stone-500'
                          }`}
                          title={niveau === 'rupture' ? 'Stock épuisé — la vente reste possible' : 'Stock restant'}
                        >
                          {Math.round(restant * 100) / 100}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!showServices && !showProducts && (
            <p className="rounded-xl border border-dashed border-stone-200 px-5 py-6 text-center text-sm text-stone-600">
              Rien ne correspond{term ? ' à ce filtre' : ' dans cette catégorie'}.
            </p>
          )}
        </div>
      )}

      {/* Montant libre — geste commercial, article hors catalogue, forfait négocié… */}
      <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-stone-50">
        <label htmlFor="caisse-custom-label" className="sr-only">Libellé du montant libre</label>
        <input
          id="caisse-custom-label"
          type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
          placeholder="Montant libre — libellé"
          className="flex-1 px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
        />
        <label htmlFor="caisse-custom-amount" className="sr-only">Montant en francs</label>
        <input
          id="caisse-custom-amount"
          type="text" inputMode="decimal" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
          placeholder="CHF"
          className="sm:w-28 px-3.5 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-400 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
        />
        <button
          type="submit"
          disabled={!customAmount.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 text-sm transition-all disabled:opacity-40 cursor-pointer"
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
          className="shrink-0 p-1 text-stone-500 hover:text-red-700 rounded hover:bg-red-50 transition-all cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
          <button
            onClick={() => onPatch({ quantite: Math.max(1, line.quantite - 1) })}
            aria-label="Diminuer la quantité"
            className="px-2 py-1 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Minus size={12} />
          </button>
          <span className="px-2.5 text-xs tabular-nums text-stone-700 min-w-[2rem] text-center">{line.quantite}</span>
          <button
            onClick={() => onPatch({ quantite: line.quantite + 1 })}
            aria-label="Augmenter la quantité"
            className="px-2 py-1 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
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
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 text-[12.5px] text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-all cursor-pointer tabular-nums"
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
              className="px-2 py-1 border border-stone-200 rounded-lg text-xs text-stone-500 focus:border-stone-900 outline-none cursor-pointer"
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
  const [emitted, setEmitted] = useState<GiftCard[]>([]);
  const [bonBusy, setBonBusy] = useState<string | null>(null);

  // Bons émis par cette vente : leur code doit être recopié sur le bon physique
  // remis à la cliente, sinon il sera introuvable le jour de l'utilisation.
  useEffect(() => {
    listGiftCardsForSale(transaction.id).then(setEmitted).catch(() => setEmitted([]));
  }, [transaction.id]);

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

  const downloadBon = async (card: GiftCard) => {
    setBonBusy(card.id); setError(null);
    try {
      await downloadBonCadeau(card.id, card.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible.');
    } finally {
      setBonBusy(null);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-sage/10 text-sage flex items-center justify-center mx-auto">
          <Check size={26} />
        </div>
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Encaissement enregistré</p>
          <p className="text-3xl font-semibold text-stone-900 tabular-nums">{formatCHF(transaction.total_ttc)}</p>
          <p className="text-sm text-stone-600 mt-2">
            Facture <span className="font-medium text-stone-600">{transaction.numero}</span> · {transaction.client_label}
          </p>
        </div>

        {emitted.length > 0 && (
          <div className="rounded-xl border border-sage/30 bg-sage/5 p-4 space-y-3 text-left">
            <p className="text-[12px] font-semibold text-sage">
              Bon{emitted.length > 1 ? 's' : ''} à remettre
            </p>
            {emitted.map(card => (
              <div key={card.id} className="space-y-1.5">
                <p className="text-lg font-semibold text-stone-900 tracking-wide tabular-nums">{card.code}</p>
                <p className="text-xs text-stone-500">
                  {card.libelle} · {formatCHF(card.montant_initial)} · valable jusqu&apos;au{' '}
                  {new Date(`${card.expire_le}T00:00:00`).toLocaleDateString('fr-CH')}
                </p>
                <button
                  onClick={() => downloadBon(card)}
                  disabled={bonBusy === card.id}
                  className="flex items-center gap-1.5 text-xs text-sage hover:text-stone-900/70 font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {bonBusy === card.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Imprimer le bon
                </button>
              </div>
            ))}
            <p className="text-[12px] text-stone-500 leading-relaxed">
              Recopie ce code sur le bon papier si tu en remets un : c&apos;est lui
              qu&apos;il faudra saisir le jour où la cliente viendra.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-2 pt-1">
          <button
            onClick={download}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 cursor-pointer"
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
            className="block w-full py-2 text-stone-500 text-xs hover:text-stone-700 transition-colors"
          >
            Voir le journal des recettes
          </Link>
        </div>
      </div>
    </div>
  );
}
