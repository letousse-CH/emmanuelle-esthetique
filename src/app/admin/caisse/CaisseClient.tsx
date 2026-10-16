"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, UserPlus, X, Plus, Minus, Trash2, Check, Download,
  Receipt, AlertCircle, Loader2, Pencil, Gift, Ticket, PenLine, Layers, Package,
  Cake, Mail, MessageCircle, CalendarCheck, ChevronRight, ChevronLeft, User, Percent,
} from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import { AnimatedNumber, Button, Callout, Kbd, LinkButton, ProgressBar } from '../../../components/admin/ui';
import {
  createClient, createTransaction, findGiftCardByCode, listClients, listGiftCardsForSale,
  listProducts, listServiceCategories, listServices, matchClient,
} from '../../../services/caisse';
import { downloadBonCadeau, downloadFacture } from '../../../utils/factureDownload';
import {
  clearCaisseDraft, loadCaisseDraft, saveCaisseDraft, takeCaisseCorrection,
} from '../../../utils/caissePrefill';
import { supabase } from '../../../services/supabase';
import { BottomSheet, SegmentedControl } from '../../../components/admin/mobile/ui';
import { CategoryTile, pickPhoto, useMediaAssets } from '../../../components/admin/mobile/CategoryTile';
import { PERIODE_LABEL } from '../../../types/booking';
import type { Booking, BookingDetail } from '../../../types/booking';
import {
  CLIENT_DE_PASSAGE, MODES_PAIEMENT, TAUX_TVA_CH, cartTotals, clientFullName, formatCHF, remisePatch,
  giftCardStatusLabel, isGiftCardUsable, isVenteProduct, recetteEncaissee, stockLevel,
} from '../../../types/caisse';
import { toWhatsAppNumber } from '../../../types/promotions';
import { listCurrentOffers } from '../../../services/offers';
import { offerLineLabel } from '../../../types/offers';
import type { Offer, OfferStats } from '../../../types/offers';
import { todayZurich } from '../../(public)/reservation/dates';
import OfferStrip from './OfferStrip';
import { PRODUCT_COLOR, categoryColor } from '../../../components/admin/categoryColors';
import { notifyAutomationEvent } from '../../../utils/automationEvent';
import type {
  CartLine, Client, GiftCard, ModePaiement, Product, Service, ServiceCategory, Transaction,
} from '../../../types/caisse';

const newKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `l${Date.now()}${Math.random()}`);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lignes de panier d'un rendez-vous : le soin, puis chaque option. Une ligne
 * est rattachée au catalogue quand son identifiant est un UUID de `services`
 * (un forfait reste UNE ligne) ; sinon c'est une ligne libre au nom et au prix
 * du rendez-vous. Aucun montant n'est calculé ici : ce sont les prix convenus
 * avec la cliente, modifiables dans le panier, et la facture est recalculée par
 * Postgres.
 */
function linesFromBooking(b: Booking, services: Service[], tauxDefaut: number): CartLine[] {
  const out: CartLine[] = [];
  const push = (id: string | null | undefined, nom: string, prix: number, offerId: string | null = null) => {
    const svc = id && UUID_RE.test(id) ? services.find(s => s.id === id) : undefined;
    out.push({
      key: newKey(),
      service_id: svc?.id ?? null,
      offer_id: offerId,
      description: nom || svc?.nom || 'Prestation',
      prix_unitaire_ttc: Number.isFinite(prix) && prix >= 0 ? prix : Number(svc?.prix_chf ?? 0),
      quantite: 1,
      taux_tva: Number(svc?.taux_tva_defaut ?? tauxDefaut),
    });
  };
  // Rendez-vous pris sur l'offre du moment : la facture occupera sa place,
  // et le rendez-vous, marqué « terminé », cessera de la compter.
  push(b.service_id, b.service_nom, Number(b.service_prix_chf), b.offer_of_month_id ?? null);
  for (const o of b.options ?? []) push(o.id, o.nom, Number(o.prix_chf));
  return out;
}

/** « Camille — 14h30 » (horaire arrêté) ou « Camille — après-midi » (créneau souple). */
function rdvLabel(b: Booking): string {
  const quand = b.horaire_fixe && b.heure_rdv
    ? b.heure_rdv.slice(0, 5).replace(':', 'h')
    : (PERIODE_LABEL[(b.periode ?? b.periode_demandee) as keyof typeof PERIODE_LABEL] ?? '').toLowerCase();
  const nom = (b.prenom || b.nom || '').trim() || 'la cliente';
  return quand ? `${nom} — ${quand}` : nom;
}

/** Marque le rendez-vous « terminé », sans prévenir la cliente. `false` si la requête échoue. */
async function markBookingDone(id: string): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ statut: 'termine', notify_client: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerStats, setOfferStats] = useState<Map<string, OfferStats>>(new Map());
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

  // Rendez-vous en cours d'encaissement (panier pré-rempli depuis l'agenda).
  // Une fois la facture émise, il est marqué « terminé » — jamais avant.
  const [rdv, setRdv] = useState<{ id: string; label: string; sansFiche?: boolean } | null>(null);
  const [rdvToLoad, setRdvToLoad] = useState<string | null>(null);
  const [rdvLoading, setRdvLoading] = useState(false);
  const [rdvError, setRdvError] = useState<string | null>(null);
  const [rdvOutcome, setRdvOutcome] = useState<'pending' | 'ok' | 'failed' | null>(null);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const [pendingGiftCode, setPendingGiftCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState<{ initial: string } | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => { load(); }, []);

  // Lien « Vendre un bon » de l'écran Bons cadeaux : ouvre directement la vente.
  useEffect(() => {
    if (searchParams.get('vendre') !== 'bon') return;
    setShowGiftSale(true);
    // On retire le paramètre : recharger la page ne doit pas rouvrir la vente.
    router.replace('/admin/caisse', { scroll: false });
  }, [searchParams, router]);

  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [pendingClientLabel, setPendingClientLabel] = useState<string | null>(null);
  // Cliente de la facture corrigée introuvable (fiche archivée entre-temps) :
  // sans avertissement, la facture rectifiée partirait en « client de passage ».
  const [missingClientLabel, setMissingClientLabel] = useState<string | null>(null);

  // Démarrage, une seule fois (le garde-fou évite le double passage du mode
  // strict). Par ordre de priorité : correction du journal, rendez-vous de
  // l'agenda (`?rdv=`), puis brouillon du panier laissé en changeant d'onglet.
  // Les paramètres d'URL sont consommés : recharger ne doit pas remplir deux fois.
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const pending = takeCaisseCorrection();
    const rdvId = searchParams.get('rdv');
    const clientParam = searchParams.get('client');

    if (pending) {
      setCorrection({ id: pending.corrigeTransactionId, numero: pending.numero });
      setLines(pending.lines.map(l => ({ ...l, key: newKey() })));
      setMode(pending.modePaiement === 'bon_cadeau' ? 'twint' : pending.modePaiement);
      setNote(pending.note ?? '');
      if (pending.clientId) {
        // La fiche est chargée par `load()` : on la retrouve dès qu'elle arrive.
        setPendingClientId(pending.clientId);
        setPendingClientLabel(pending.clientLabel);
      }
    } else if (rdvId) {
      // Le panier du rendez-vous remplace un éventuel brouillon : deux
      // clientes ne se mélangent pas dans une même facture.
      clearCaisseDraft();
      setRdvToLoad(rdvId);
    } else {
      const d = loadCaisseDraft();
      if (d) {
        setLines(d.lines);
        setMode(d.mode === 'bon_cadeau' ? 'twint' : d.mode);
        setNote(d.note);
        if (d.correction) setCorrection(d.correction);
        if (d.rdv) setRdv(d.rdv);
        if (d.clientId) {
          setPendingClientId(d.clientId);
          setPendingClientLabel(d.clientLabel);
        }
        if (d.giftCode) {
          // Le bon a pu être utilisé ailleurs entre-temps : on le revérifie
          // en base plutôt que de croire le brouillon.
          setPendingGiftCode(d.giftCode);
          findGiftCardByCode(d.giftCode)
            .then(card => {
              if (card && isGiftCardUsable(card)) setGiftCard(card);
              else setRestoreNote(`Le bon ${d.giftCode} n'est plus utilisable : il a été retiré de l'encaissement.`);
            })
            .catch(() => setRestoreNote(`Le bon ${d.giftCode} n'a pas pu être revérifié : présentez-le à nouveau.`))
            .finally(() => setPendingGiftCode(null));
        }
      }
    }

    // `?client=<id>` : « Encaisser » depuis la fiche cliente.
    if (clientParam && !pending && !rdvId) {
      setPendingClientId(clientParam);
      setPendingClientLabel(null);
    }
    if (rdvId || clientParam) router.replace('/admin/caisse', { scroll: false });
    setReady(true);
  }, [searchParams, router]);

  useEffect(() => {
    // Pas de verdict tant que la liste n'est pas là (chargement ou échec :
    // « Réessayer » relancera la recherche).
    if (!pendingClientId || loading || loadError) return;
    const found = clients.find(c => c.id === pendingClientId);
    if (found) setClient(found);
    else if (pendingClientLabel) setMissingClientLabel(pendingClientLabel);
    setPendingClientId(null);
  }, [pendingClientId, clients, loading, loadError, pendingClientLabel]);

  const load = async () => {
    setLoading(true); setLoadError(null);
    try {
      // Clientes et prestations sont indispensables : sans elles, on affiche
      // l'erreur plutôt qu'un catalogue fictif qui produirait de fausses
      // factures. Catégories et produits sont un confort : leur absence
      // (migration pas encore appliquée) ne bloque pas l'encaissement.
      const [c, s] = await Promise.all([listClients(), listServices(false)]);
      setClients(c); setServices(s);

      const [cats, prod, current] = await Promise.all([
        listServiceCategories().catch(() => [] as ServiceCategory[]),
        listProducts(false).catch(() => [] as Product[]),
        listCurrentOffers(todayZurich()).catch(() => ({ offers: [] as Offer[], stats: new Map<string, OfferStats>() })),
      ]);
      setCategories(cats); setProducts(prod.filter(isVenteProduct));
      setOffers(current.offers); setOfferStats(current.stats);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pré-remplissage depuis un rendez-vous ───────────────────────────────────
  // Lit le rendez-vous, retrouve ses lignes dans le catalogue et ne fait QUE
  // remplir le panier : les montants et la facture passent toujours par
  // `caisse_create_transaction`. Attend le catalogue pour pouvoir rattacher
  // chaque ligne à sa prestation.
  useEffect(() => {
    if (!rdvToLoad || loading || loadError) return;
    const id = rdvToLoad;
    setRdvToLoad(null);
    let cancelled = false;
    (async () => {
      setRdvLoading(true); setRdvError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(res.status === 404 ? 'Rendez-vous introuvable.' : `Erreur ${res.status}`);
        const detail = (await res.json()) as BookingDetail;
        if (cancelled) return;
        const b = detail.booking;
        setLines(linesFromBooking(b, services, tauxDefaut));
        const fullName = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim();
        setRdv({ id: b.id, label: rdvLabel(b), sansFiche: !b.client_id });
        if (b.client_id) {
          setPendingClientId(b.client_id);
          setPendingClientLabel(fullName);
        }
      } catch (err) {
        if (!cancelled) {
          setRdvError(
            `Le rendez-vous n'a pas pu être chargé${err instanceof Error ? ` (${err.message})` : ''}. `
            + 'Choisissez les prestations à la main : rien n\'a été encaissé.',
          );
        }
      } finally {
        if (!cancelled) setRdvLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdvToLoad, loading, loadError]);

  // Brouillon : le panier survit au changement d'onglet (Agenda, Clientes…).
  useEffect(() => {
    if (!ready || receipt) return;
    const giftCode = giftCard?.code ?? pendingGiftCode;
    if (lines.length === 0 && !client && !rdv && !correction && !giftCode && !note.trim()) {
      clearCaisseDraft();
      return;
    }
    saveCaisseDraft({
      lines,
      clientId: client?.id ?? pendingClientId,
      clientLabel: client ? clientFullName(client) : (pendingClientLabel ?? ''),
      mode, note, giftCode, correction,
      rdv: rdv ? { id: rdv.id, label: rdv.label } : null,
    });
  }, [ready, receipt, lines, client, pendingClientId, pendingClientLabel, mode, note, giftCard, pendingGiftCode, correction, rdv]);

  // Activité non assujettie : toutes les lignes partent à 0 %, quel que soit le
  // taux par défaut d'un produit (prévu pour le jour de l'assujettissement).
  // Une TVA écrite sur une quittance serait due (LTVA art. 27 al. 2). C'est
  // Postgres qui l'impose (`caisse_create_transaction` lit le réglage) ; on la
  // reproduit ici pour que l'aperçu corresponde à la facture émise.
  const linesTva = useMemo(
    () => (tvaActive ? lines : lines.map(l => (Number(l.taux_tva) === 0 ? l : { ...l, taux_tva: 0 }))),
    [lines, tvaActive],
  );
  const totals = useMemo(() => cartTotals(linesTva), [linesTva]);

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

  // Même chose pour les soins : la tuile affiche combien sont déjà au ticket.
  const cartQtyByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) {
      if (!l.service_id) continue;
      map.set(l.service_id, (map.get(l.service_id) ?? 0) + Number(l.quantite || 0));
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

  /**
   * Ajoute l'offre du moment. La ligne porte `offer_id` : c'est ce qui la fera
   * compter dans les places de l'offre. Libellé et prix sont figés comme ceux
   * de n'importe quelle prestation.
   */
  const addOffer = (o: Offer) => {
    setLines(prev => {
      const existing = prev.findIndex(l => l.offer_id === o.id && l.prix_unitaire_ttc === Number(o.prix_chf));
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantite: next[existing].quantite + 1 };
        return next;
      }
      return [...prev, {
        key: newKey(),
        service_id: null,
        offer_id: o.id,
        description: offerLineLabel(o),
        prix_unitaire_ttc: Number(o.prix_chf),
        quantite: 1,
        taux_tva: tauxDefaut,
      }];
    });
  };

  const cartQtyByOffer = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) if (l.offer_id) map.set(l.offer_id, (map.get(l.offer_id) ?? 0) + Number(l.quantite || 0));
    return map;
  }, [lines]);

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
    setGiftCard(null); setCorrection(null); setMissingClientLabel(null);
    setRdv(null); setRdvOutcome(null); setRdvError(null); setRestoreNote(null);
    clearCaisseDraft();
  };

  // Verrou synchrone : l'état `submitting` n'est visible qu'au rendu suivant,
  // un double appui rapide pourrait sinon émettre deux factures.
  const submitLock = useRef(false);
  const handleSubmit = async () => {
    if (lines.length === 0 || submitting || submitLock.current) return;
    submitLock.current = true;
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
      clearCaisseDraft();
      // Le rendez-vous n'est marqué « terminé » qu'APRÈS une facture émise.
      // Si ce PATCH échoue, la facture reste valable : on le signale sur la
      // quittance au lieu de l'annuler.
      if (rdv) {
        setRdvOutcome('pending');
        void markBookingDone(rdv.id).then(ok => setRdvOutcome(ok ? 'ok' : 'failed'));
      }
      // Une vente encaissée est l'événement `sale.created` du module
      // Automatisations. L'encaissement passe par une fonction Postgres
      // appelée depuis le navigateur : aucun code serveur ne le voit passer,
      // d'où ce signalement explicite.
      void notifyAutomationEvent('sale.created');
    } catch (err) {
      setSubmitError(
        `L'encaissement n'a pas été enregistré${err instanceof Error ? ` (${err.message})` : ''}. `
        + 'Aucune facture n\'a été créée : vérifiez la connexion puis réessayez.',
      );
    } finally {
      submitLock.current = false;
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
    return <ReceiptPanel transaction={receipt} onNew={resetCart} rdvId={rdv?.id ?? null} rdvOutcome={rdvOutcome} />;
  }

  const banners = (
    <>
      {correction && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <PenLine size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Correction de la facture {correction.numero}</p>
            <p className="text-[13px] mt-0.5 leading-relaxed">
              Elle a été annulée et reste au journal avec son numéro. Rectifiez ce qu&apos;il faut
              ci-dessous : la nouvelle facture y sera rattachée, pour que la correction reste visible.
              Si un bon cadeau avait servi au paiement, il a été recrédité : présentez-le à nouveau.
            </p>
            {missingClientLabel && !client && (
              <p className="text-[13px] mt-1.5 font-semibold">
                La fiche de {missingClientLabel} n&apos;a pas été retrouvée (peut-être archivée) :
                choisissez la cliente ci-dessous avant d&apos;encaisser.
              </p>
            )}
          </div>
          <button
            onClick={() => setCorrection(null)}
            title="La nouvelle facture ne sera pas liée à l'ancienne"
            className="shrink-0 text-[13px] font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Ne pas rattacher
          </button>
        </div>
      )}

      {loadError && (
        <Callout
          tone="danger"
          title="Les clientes et le catalogue n'ont pas pu être chargés"
          actions={<Button size="sm" onClick={load} loading={loading}>Réessayer</Button>}
        >
          <p>Vérifiez la connexion internet puis réessayez. N&apos;encaissez pas tant que ce message est affiché.</p>
          <p className="mt-1 text-[13px] text-red-800/80 break-words">Détail technique : {loadError}</p>
        </Callout>
      )}

      {rdv && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-stone-900">
          <CalendarCheck size={16} className="shrink-0 mt-0.5 text-accent" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Encaissement du rdv de {rdv.label}</p>
            <p className="text-[13px] mt-0.5 leading-relaxed text-stone-700">
              Le panier est pré-rempli avec les soins du rendez-vous : vérifiez-le avant d&apos;encaisser.
              Le rendez-vous sera marqué terminé une fois la facture émise.
            </p>
            {rdv.sansFiche && !client && (
              <p className="text-[13px] mt-1.5 font-semibold">
                Ce rendez-vous n&apos;est pas rattaché à une fiche : choisissez la cliente avant d&apos;encaisser.
              </p>
            )}
          </div>
          <button
            onClick={() => setRdv(null)}
            title="Le rendez-vous ne sera pas marqué terminé"
            className="shrink-0 min-h-11 px-1 text-[13px] font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Détacher
          </button>
        </div>
      )}

      {rdvLoading && (
        <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <Loader2 size={15} className="animate-spin" /> Chargement du rendez-vous…
        </div>
      )}
      {rdvError && <Callout tone="warning">{rdvError}</Callout>}

      {missingClientLabel && !client && !correction && (
        <Callout tone="warning">
          La fiche de {missingClientLabel} n&apos;a pas été retrouvée (peut-être archivée) : choisissez la cliente avant d&apos;encaisser.
        </Callout>
      )}
      {restoreNote && <Callout tone="warning">{restoreNote}</Callout>}
    </>
  );

  return (
    <>
    <div className="hidden lg:block space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-stone-500 first-letter:uppercase">
            {new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-0.5 text-[30px] font-semibold leading-tight tracking-tight text-stone-950">Encaissement</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={Gift} onClick={() => setShowGiftSale(true)}>Vendre un bon cadeau</Button>
          <LinkButton href="/admin/caisse/journal" icon={Receipt} variant="ghost">Journal des ventes</LinkButton>
        </div>
      </header>

      {banners}

      <div className="grid grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_27rem] items-start gap-8 xl:gap-10">
        {/* ── Gauche : qui, puis quoi ─────────────────────────────────── */}
        <div className="min-w-0 space-y-8">
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
            cartQtyByService={cartQtyByService}
            offers={offers} offerStats={offerStats} cartQtyByOffer={cartQtyByOffer} onPickOffer={addOffer}
            loading={loading}
            onPick={addService}
            onPickProduct={addProduct}
            onCustom={addCustomLine}
          />
        </div>

        {/* ── Droite : le ticket, un seul objet du début à la fin ─────── */}
        <aside aria-label="Ticket en cours" className="sticky top-20">
          <div className="overflow-hidden rounded-xl bg-stone-50">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-stone-500">Ticket</p>
                <p className="truncate text-[17px] font-semibold text-stone-950">
                  {client ? clientFullName(client) : CLIENT_DE_PASSAGE}
                </p>
              </div>
              {lines.length > 0 && (
                <button
                  onClick={() => {
                    if (lines.length > 1 && !confirm(`Retirer les ${lines.length} lignes du ticket ?`)) return;
                    setLines([]);
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-[13px] font-medium text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  Vider
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="mx-5 mb-5 rounded-xl border border-dashed border-stone-300 px-5 py-8 text-center">
                <p className="text-[15px] font-medium text-stone-800">Le ticket est vide</p>
                <p className="mt-1 text-[13.5px] text-stone-500">Touchez un soin ou un produit pour l’ajouter.</p>
              </div>
            ) : (
              <ul className="max-h-[38vh] overflow-y-auto overscroll-contain divide-y divide-stone-100 border-y border-stone-100">
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

            {/* Totaux */}
            <div className="space-y-1.5 px-5 pt-4 pb-5 text-[14px]">
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
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="text-[15px] font-medium text-stone-700">
                  {montantBon > 0 ? 'Reste à encaisser' : 'Total'}
                </span>
                <span className="text-[34px] font-semibold leading-none tracking-tight text-stone-950 tabular-nums"><AnimatedNumber value={resteAPayer} format={formatCHF} duration={350} /></span>
              </div>
              {!tvaActive && <p className="text-right text-[12px] text-stone-500">TVA 0 % — activité non assujettie</p>}
              {lines.length > 0 && resteAPayer > 0 && <PanierGauge amount={resteAPayer} />}
            </div>

            {/* Bon cadeau présenté en paiement */}
            <div className="border-t border-stone-100 px-5 py-3">
              {giftCard ? (
                <div className="space-y-2 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-stone-900">
                      <Ticket size={15} className="shrink-0 text-warm-strong" /> {giftCard.code}
                      <span className="truncate font-normal text-stone-500">{giftCard.libelle}</span>
                    </p>
                    <button
                      onClick={() => setGiftCard(null)}
                      aria-label="Retirer le bon cadeau"
                      className="shrink-0 rounded-md p-1.5 text-stone-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-[12.5px]">
                    <div><dt className="text-stone-500">Solde</dt><dd className="font-medium text-stone-800 tabular-nums">{formatCHF(giftCard.montant_restant)}</dd></div>
                    <div><dt className="text-stone-500">Appliqué</dt><dd className="font-semibold text-warm-ink tabular-nums">− {formatCHF(montantBon)}</dd></div>
                    <div><dt className="text-stone-500">Restera</dt><dd className="font-medium text-stone-800 tabular-nums">{formatCHF(Number(giftCard.montant_restant) - montantBon)}</dd></div>
                  </dl>
                  <p className="text-[12px] leading-relaxed text-stone-500">
                    Cette part n&apos;entre pas dans les recettes : elle a été encaissée à la vente du bon.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowGiftUse(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-[14px] font-medium text-stone-700 transition-colors hover:text-stone-950 cursor-pointer"
                >
                  <Ticket size={16} className="text-stone-500" /> Payer avec un bon cadeau
                  <ChevronRight size={16} className="ml-auto text-stone-400" />
                </button>
              )}
            </div>

            {/* Paiement */}
            <div ref={paymentRef} className="space-y-4 border-t border-stone-100 bg-stone-50 px-5 py-5 scroll-mt-4">
              {resteAPayer === 0 && montantBon > 0 ? (
                <p className="flex items-center gap-2.5 rounded-lg bg-warm-soft px-4 py-3 text-[14px] text-warm-ink">
                  <Ticket size={15} className="shrink-0" />
                  Intégralement réglé par le bon {giftCard?.code}.
                </p>
              ) : (
                <div role="radiogroup" aria-label={montantBon > 0 ? 'Mode de règlement du reste' : 'Mode de paiement'} className="grid grid-cols-4 gap-1 rounded-xl bg-stone-100 p-1">
                  {MODES_PAIEMENT.map(m => (
                    <button
                      key={m.value}
                      role="radio"
                      aria-checked={mode === m.value}
                      onClick={() => setMode(m.value)}
                      className={`h-10 rounded-lg text-[13.5px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        mode === m.value ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="caisse-note" className="sr-only">Note (facultatif)</label>
                <input
                  id="caisse-note"
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Note sur la facture (facultatif)"
                  className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3.5 text-[14px] text-stone-800 placeholder:text-stone-500 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              {submitError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={lines.length === 0 || submitting}
                className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[16px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
              >
                {submitting
                  ? <><Loader2 size={17} className="animate-spin" /> Encaissement…</>
                  : resteAPayer === 0 && montantBon > 0
                    ? <><Check size={17} /> Valider la prestation</>
                    : <><Check size={17} /> Encaisser {formatCHF(resteAPayer)}</>}
              </button>
              <p className="text-center text-[12px] leading-relaxed text-stone-500">
                La facture est numérotée et enregistrée définitivement. Une erreur se corrige depuis le journal (« Corriger »).
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>

    {/* ── Téléphone : parcours d'encaissement à une main ─────────────────── */}
    <div className="lg:hidden">
      <MobileCheckout
        banners={banners}
        services={services} categories={categories} products={products} loading={loading}
        offers={offers} offerStats={offerStats} onPickOffer={addOffer}
        lines={lines} tvaActive={tvaActive}
        totals={totals} montantBon={montantBon} resteAPayer={resteAPayer}
        giftCard={giftCard}
        mode={mode} onMode={setMode}
        note={note} onNote={setNote}
        client={client} clients={clients}
        onSelectClient={setClient}
        onNewClient={(initial) => setShowQuickClient({ initial })}
        onPickService={addService} onPickProduct={addProduct} onCustom={addCustomLine}
        onSellGift={() => setShowGiftSale(true)}
        onUseGift={() => setShowGiftUse(true)}
        onRemoveGift={() => setGiftCard(null)}
        onPatchLine={patchLine} onRemoveLine={removeLine} onClearCart={() => setLines([])}
        submitting={submitting} submitError={submitError} onSubmit={handleSubmit}
      />
    </div>

    {showGiftUse && (
      <GiftCardUseDialog
        onClose={() => setShowGiftUse(false)}
        onFound={(card) => { setGiftCard(card); setShowGiftUse(false); }}
      />
    )}

    {showGiftSale && !loading && (
      <GiftCardSaleDialog
        services={services}
        clients={clients}
        buyer={client}
        onBuyer={setClient}
        onNewClient={(initial) => setShowQuickClient({ initial })}
        validiteMois={bonValiditeMois}
        onClose={() => setShowGiftSale(false)}
        onAdd={addGiftCardLine}
      />
    )}

    {showQuickClient && (
      <QuickClientDialog
        initial={showQuickClient.initial}
        onClose={() => setShowQuickClient(null)}
        onCreated={(c) => { setClients(prev => [...prev, c]); setClient(c); setShowQuickClient(null); }}
      />
    )}
    </>
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
        setError(`Aucun bon ne porte le code « ${code.trim()} ». Vérifiez l'orthographe, ou retrouvez-le dans l'écran Bons cadeaux.`);
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
    <div className="fixed inset-0 z-[120] bg-stone-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="Utiliser un bon cadeau"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Ticket size={15} className="text-accent" /> Bon cadeau
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
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
              className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors uppercase tracking-wide"
            />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit" disabled={searching || !code.trim()}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
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

/**
 * Clientes inscrites qui correspondent à la saisie (nom, prénom, e-mail ou
 * téléphone), pour ne pas retaper un nom déjà connu — et ne pas l'écrire
 * autrement que sur sa fiche.
 */
function ClientSuggestions({ clients, term, onPick }: {
  clients: Client[];
  term: string;
  onPick: (c: Client) => void;
}) {
  const results = useMemo(
    () => (term.trim() ? clients.filter(c => matchClient(c, term)).slice(0, 6) : []),
    [clients, term],
  );
  if (results.length === 0) return null;
  return (
    <ul aria-label="Clientes inscrites" className="mt-1 rounded-lg bg-stone-50 divide-y divide-stone-100 max-h-48 overflow-y-auto">
      {results.map(c => (
        <li key={c.id}>
          <button
            type="button" onClick={() => onPick(c)}
            className="w-full min-h-11 text-left px-3 py-2 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <span className="block text-sm text-stone-800">{clientFullName(c)}</span>
            {c.telephone && <span className="block text-[12.5px] text-stone-600">{c.telephone}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function GiftCardSaleDialog({ services, clients, buyer, onBuyer, onNewClient, validiteMois, onClose, onAdd }: {
  services: Service[];
  clients: Client[];
  /** Cliente du panier : c'est elle qui achète le bon et figure sur la facture. */
  buyer: Client | null;
  onBuyer: (c: Client | null) => void;
  onNewClient: (initial: string) => void;
  validiteMois: number;
  onClose: () => void;
  onAdd: (montant: number, libelle: string, beneficiaire: string) => void;
}) {
  const [kind, setKind] = useState<'montant' | 'soins'>('montant');
  const [montant, setMontant] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [beneficiaire, setBeneficiaire] = useState('');
  // Les suggestions se ferment dès qu'un nom est choisi, et rouvrent à la frappe.
  const [benefSuggest, setBenefSuggest] = useState(false);
  const [acheteuse, setAcheteuse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const acheteuseConnue = acheteuse.trim() !== '' && clients.some(c => matchClient(c, acheteuse));

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
        setError('Indiquez un montant supérieur à zéro.');
        return;
      }
      onAdd(Math.round(value * 100) / 100, 'Bon cadeau', beneficiaire.trim());
    } else {
      if (pickedServices.length === 0) {
        setError('Choisissez au moins un soin.');
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
    <div className="fixed inset-0 z-[120] bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog" aria-modal="true" aria-label="Vendre un bon cadeau"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Gift size={15} className="text-accent" /> Vendre un bon cadeau
          </h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
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
                  kind === k ? 'bg-accent-soft text-accent font-semibold' : 'text-stone-700 hover:bg-stone-50'
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
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors tabular-nums"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-stone-700">Soins offerts *</p>
              {services.length === 0 ? (
                <p className="text-[12.5px] text-stone-600 italic">Le catalogue est vide.</p>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-50">
                  {services.map(s => {
                    const checked = picked.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50 cursor-pointer">
                        <input
                          type="checkbox" checked={checked}
                          onChange={() => setPicked(p => checked ? p.filter(id => id !== s.id) : [...p, s.id])}
                          className="accent-accent"
                        />
                        <span className="flex-1 text-sm text-stone-700 truncate">{s.nom}</span>
                        <span className="text-[12.5px] text-stone-600 tabular-nums">{formatCHF(s.prix_chf)}</span>
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
            <label htmlFor="gift-acheteuse" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Offert par <span className="text-stone-600">(l&apos;acheteuse, au nom de qui la facture est établie)</span>
            </label>
            {buyer ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                <span className="text-sm font-medium text-stone-900 truncate">{clientFullName(buyer)}</span>
                <button
                  type="button" onClick={() => onBuyer(null)}
                  aria-label="Retirer l'acheteuse"
                  className="shrink-0 grid size-9 place-items-center text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <input
                  id="gift-acheteuse" type="text" value={acheteuse} autoComplete="off"
                  onChange={e => setAcheteuse(e.target.value)}
                  placeholder="Nom, prénom ou téléphone…"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
                />
                <ClientSuggestions
                  clients={clients} term={acheteuse}
                  onPick={c => { onBuyer(c); setAcheteuse(''); }}
                />
                {acheteuse.trim() !== '' && !acheteuseConnue && (
                  <button
                    type="button" onClick={() => onNewClient(acheteuse.trim())}
                    className="mt-1.5 flex items-center gap-1.5 text-[13px] text-accent hover:underline font-semibold cursor-pointer"
                  >
                    <UserPlus size={14} /> Créer la fiche « {acheteuse.trim()} »
                  </button>
                )}
                <p className="mt-1 text-[12.5px] text-stone-600">
                  Sans acheteuse choisie, le bon est vendu à « {CLIENT_DE_PASSAGE} ».
                </p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="gift-benef" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Bénéficiaire <span className="text-stone-600">(facultatif — la personne à qui il est offert)</span>
            </label>
            <input
              id="gift-benef" type="text" value={beneficiaire} autoComplete="off"
              onChange={e => { setBeneficiaire(e.target.value); setBenefSuggest(true); }}
              placeholder="Nom, ou cliente déjà inscrite…"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 placeholder:text-stone-500 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
            {benefSuggest && (
              <ClientSuggestions
                clients={clients} term={beneficiaire}
                onPick={c => { setBeneficiaire(clientFullName(c)); setBenefSuggest(false); }}
              />
            )}
          </div>

          <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3 text-[13px] text-stone-600 leading-relaxed">
            Valable {validiteMois} mois — jusqu&apos;au{' '}
            <strong className="text-stone-700">{echeance.toLocaleDateString('fr-CH')}</strong>.
            L&apos;échéance est figée à l&apos;émission : changer la durée dans les réglages
            ne raccourcira jamais un bon déjà vendu.
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-stone-100 text-stone-900 font-semibold text-sm hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors cursor-pointer"
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
    <div className="flex items-center justify-between text-stone-600">
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

  const initials = (c: Client) => clientFullName(c).split(/\s+/).map(w => w.charAt(0)).join('').slice(0, 2).toUpperCase();

  return (
    <section ref={containerRef} aria-labelledby="caisse-client-title" className="relative space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="caisse-client-title" className="text-[17px] font-semibold tracking-tight text-stone-950">Cliente</h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent hover:underline underline-offset-4 cursor-pointer"
        >
          <UserPlus size={15} /> Nouvelle cliente
        </button>
      </div>

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-3.5 py-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warm-soft text-[14px] font-semibold text-warm-ink" aria-hidden="true">
            {initials(selected)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-semibold text-stone-950">{clientFullName(selected)}</p>
            {(selected.telephone || selected.email) && (
              <p className="truncate text-[13px] text-stone-500">
                {[selected.telephone, selected.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={() => { onSelect(null); setSearch(''); }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
          >
            Changer
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
          <label htmlFor="caisse-client-search" className="sr-only">Rechercher une cliente</label>
          <input
            id="caisse-client-search"
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={`Nom, prénom ou téléphone… (sinon : ${CLIENT_DE_PASSAGE.toLowerCase()})`}
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-[15px] text-stone-900 placeholder:text-stone-500 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
          />

          {/* Le menu est ancré sur le champ lui-même (`top-full`). */}
          {open && search.trim() !== '' && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
              {results.length === 0 ? (
                <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-[14px] text-stone-600">
                  Aucune cliente trouvée.
                  <button onClick={() => setCreating(true)} className="font-semibold text-accent hover:underline cursor-pointer">Créer la fiche</button>
                </li>
              ) : results.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-stone-100 cursor-pointer"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-[12px] font-semibold text-stone-600" aria-hidden="true">{initials(c)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-medium text-stone-900">{clientFullName(c)}</span>
                      {c.telephone && <span className="block text-[12.5px] text-stone-500">{c.telephone}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {creating && (
        <QuickClientDialog
          initial={search}
          onClose={() => setCreating(false)}
          onCreated={(c) => { onCreated(c); setCreating(false); setSearch(''); }}
        />
      )}
    </section>
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
function QuickClientDialog({ onClose, onCreated, initial = '' }: {
  onClose: () => void;
  onCreated: (c: Client) => void;
  /** Texte tapé dans la recherche : un numéro préremplit le téléphone, un nom le nom. */
  initial?: string;
}) {
  const initialIsPhone = /^[\d\s+.\-/()]{4,}$/.test(initial.trim());
  const [nom, setNom]                 = useState(initialIsPhone ? '' : initial.trim());
  const [prenom, setPrenom]           = useState('');
  const [telephone, setTelephone]     = useState(initialIsPhone ? initial.trim() : '');
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
    <div className="fixed inset-0 z-[120] bg-stone-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nouvelle fiche cliente"
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 my-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Nouvelle cliente</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer">
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
            <label htmlFor="qc-naissance" className="text-[12.5px] font-medium text-stone-700 mb-1 flex items-center gap-1.5">
              <Cake size={13} className="text-stone-600" /> Date de naissance
            </label>
            <input
              id="qc-naissance" type="date" value={dateNaissance}
              onChange={e => setDateNaissance(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="qc-notes" className="block text-[12.5px] font-medium text-stone-700 mb-1">
              Notes <span className="text-stone-600">(préférences, habitudes…)</span>
            </label>
            <textarea
              id="qc-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 outline-none transition-colors resize-y"
            />
          </div>

          <fieldset className="rounded-xl border border-stone-200 p-3.5 space-y-2.5">
            <legend className="text-[13px] font-medium text-stone-700 px-1">Accords publicitaires</legend>
            <p className="text-[12px] text-stone-600 leading-relaxed">
              À cocher seulement si elle vient de le dire. Sans ces cases, elle ne recevra
              aucune promotion.
            </p>
            <QuickConsent
              id="qc-consent-email" icon={Mail} label="Offres par e-mail"
              detail={emailClean || 'Saisissez une adresse pour l’activer'}
              checked={consentEmail} disabled={!emailClean}
              onToggle={() => setConsentEmail(v => !v)}
            />
            <QuickConsent
              id="qc-consent-wa" icon={MessageCircle} label="Offres par WhatsApp"
              detail={waNumber
                ? `+${waNumber}`
                : telephone.trim() ? 'Numéro non reconnu : vérifiez l’indicatif' : 'Saisissez un numéro pour l’activer'}
              checked={consentWa} disabled={!waNumber}
              onToggle={() => setConsentWa(v => !v)}
            />
          </fieldset>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={saving || !nom.trim()}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Enregistrement…' : 'Créer la fiche et la choisir'}
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
        <Icon size={13} className="text-stone-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm text-stone-700 cursor-pointer">{label}</label>
          <p className="text-[12.5px] text-stone-600 truncate">{detail}</p>
        </div>
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={onToggle} disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
          checked ? 'bg-accent' : 'bg-stone-200'
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

/** Pastille de quantité déjà au ticket, ou « + » au survol. */
function TileCorner({ qty }: { qty: number }) {
  return qty > 0 ? (
    // `key` : la pastille rebondit à chaque ajout, pas seulement au premier.
    <span key={qty} className="admin-pop absolute right-2.5 top-2.5 grid min-w-6 h-6 place-items-center bg-warm px-1.5 text-[12.5px] font-bold text-warm-ink tabular-nums rounded" aria-label={`${qty} au ticket`}>
      {qty}
    </span>
  ) : (
    <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-stone-100 text-stone-500 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
      <Plus size={14} />
    </span>
  );
}

const TILE =
  'group relative flex min-h-[96px] flex-col rounded-xl bg-stone-50 py-3 pl-4 pr-3 text-left transition-all cursor-pointer ' +
  'hover:border-stone-400 hover:bg-stone-50 active:scale-[0.985] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';

function ServiceTile({ service, color, qty, onPick }: { service: Service; color: string; qty: number; onPick: () => void }) {
  const detail = service.description?.trim();
  return (
    <button onClick={onPick} className={`${TILE} ${qty > 0 ? 'border-warm-muted bg-warm-soft/40' : 'border-stone-200'}`}>
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: color }} aria-hidden="true" />
      <span className="pr-7 text-[14.5px] font-semibold leading-snug text-stone-900 line-clamp-3">{service.nom}</span>
      {detail && <span className="mt-0.5 truncate pr-2 text-[12.5px] text-stone-500">{detail}</span>}
      <span className="mt-auto flex items-center gap-2 pt-2">
        <span className="text-[15.5px] font-semibold text-stone-950 tabular-nums">{formatCHF(service.prix_chf)}</span>
        {service.type === 'forfait' && (
          <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 text-[11.5px] font-medium text-stone-600 rounded">
            <Layers size={11} aria-hidden="true" /> Forfait
          </span>
        )}
      </span>
      <TileCorner qty={qty} />
    </button>
  );
}

function ProductTile({ product, qty, onPick }: { product: Product; qty: number; onPick: () => void }) {
  // Le stock affiché tient compte du ticket en cours. Il peut devenir négatif :
  // on le signale sans jamais bloquer la vente — la cliente tient le produit en
  // main, c'est l'inventaire qui a tort, pas elle.
  const restant = Math.round((Number(product.stock) - qty) * 100) / 100;
  const niveau = stockLevel({ stock: restant, seuil_alerte: product.seuil_alerte });
  return (
    <button onClick={onPick} className={`${TILE} ${qty > 0 ? 'border-warm-muted bg-warm-soft/40' : 'border-stone-200'}`}>
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: PRODUCT_COLOR }} aria-hidden="true" />
      {product.marque && <span className="pr-7 text-[11.5px] font-medium uppercase tracking-wide text-stone-500">{product.marque}</span>}
      <span className="pr-7 text-[14.5px] font-semibold leading-snug text-stone-900 line-clamp-3">{product.nom}</span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span className="text-[15.5px] font-semibold text-stone-950 tabular-nums">{formatCHF(product.prix_vente_chf)}</span>
        <span
          className={`px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ${
            niveau === 'rupture' ? 'bg-red-50 text-red-700' : niveau === 'bas' ? 'bg-warm-soft text-warm-ink' : 'bg-stone-100 text-stone-600'
          }`}
          title={niveau === 'rupture' ? 'Stock épuisé — la vente reste possible' : 'Stock restant après ce ticket'}
        >
          {niveau === 'rupture' ? 'Rupture' : `${restant} en stock`}
        </span>
      </span>
      <TileCorner qty={qty} />
    </button>
  );
}

const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3';

/**
 * Catalogue de l'écran d'encaissement.
 *
 * « Tout » range les soins par catégorie, sous un titre : on cherche
 * « Aisselles » dans « Épilation », pas dans une grille de quarante tuiles.
 * Une catégorie précise, ou une recherche, donne une grille simple. Les
 * produits affichent le stock qu'il RESTERA après la vente en cours.
 */
function ServiceCatalog({
  services, categories, products, cartQtyByProduct, cartQtyByService, loading,
  offers, offerStats, cartQtyByOffer, onPickOffer,
  onPick, onPickProduct, onCustom,
}: {
  services: Service[];
  categories: ServiceCategory[];
  products: Product[];
  cartQtyByProduct: Map<string, number>;
  cartQtyByService: Map<string, number>;
  offers: Offer[];
  offerStats: Map<string, OfferStats>;
  cartQtyByOffer: Map<string, number>;
  onPickOffer: (o: Offer) => void;
  loading: boolean;
  onPick: (s: Service) => void;
  onPickProduct: (p: Product) => void;
  onCustom: (description: string, prix: number) => void;
}) {
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [customOpen, setCustomOpen] = useState(false);

  // « / » place le curseur dans la recherche, depuis n'importe où sur l'écran
  // (sauf pendant une saisie, ou quand une fenêtre est ouverte).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.closest('[role="dialog"]'))) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const isOrphan = useCallback(
    (s: Service) => !s.category_id || !categories.some(c => c.id === s.category_id),
    [categories],
  );

  // Seules les catégories qui ont quelque chose à montrer deviennent un onglet.
  const tabs = useMemo(() => {
    const list: { id: string; label: string; color?: string; count: number }[] = [
      { id: 'all', label: 'Tout', count: services.length + products.length },
    ];
    for (const c of categories) {
      const n = services.filter(s => s.category_id === c.id).length;
      if (n > 0) list.push({ id: c.id, label: c.nom, color: categoryColor(categories, c.id), count: n });
    }
    const orphans = services.filter(isOrphan).length;
    if (orphans > 0) list.push({ id: 'none', label: 'Divers', color: categoryColor(categories, null), count: orphans });
    if (products.length > 0) list.push({ id: 'produits', label: 'Produits', color: PRODUCT_COLOR, count: products.length });
    return list;
  }, [categories, services, products, isOrphan]);

  const term = search.trim().toLowerCase();
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'all';

  const filteredServices = useMemo(() => services.filter(s => {
    if (!s.nom.toLowerCase().includes(term)) return false;
    if (activeTab === 'all') return true;
    if (activeTab === 'none') return isOrphan(s);
    return s.category_id === activeTab;
  }), [services, activeTab, term, isOrphan]);

  const filteredProducts = useMemo(
    () => products.filter(p => `${p.nom} ${p.marque ?? ''}`.toLowerCase().includes(term)),
    [products, term],
  );

  // « Tout » veut dire tout, marchandise comprise : vendre un flacon seul ne
  // doit pas coûter un changement d'onglet.
  const showProducts = (activeTab === 'produits' || activeTab === 'all') && filteredProducts.length > 0;
  const showServices = activeTab !== 'produits' && filteredServices.length > 0;
  const grouped = activeTab === 'all' && !term;

  const groups = useMemo(() => {
    if (!grouped) return [];
    const out: { id: string; label: string; color: string; items: Service[] }[] = [];
    for (const c of categories) {
      const items = services.filter(s => s.category_id === c.id);
      if (items.length) out.push({ id: c.id, label: c.nom, color: categoryColor(categories, c.id), items });
    }
    const orphans = services.filter(isOrphan);
    if (orphans.length) out.push({ id: 'none', label: 'Divers', color: categoryColor(categories, null), items: orphans });
    return out;
  }, [grouped, categories, services, isOrphan]);

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const prix = Number(customAmount.replace(',', '.'));
    if (!Number.isFinite(prix) || prix <= 0) {
      setCustomError('Montant non reconnu : saisissez un nombre, par exemple 45 ou 45.50.');
      return;
    }
    setCustomError(null);
    onCustom(customLabel.trim() || 'Prestation', Math.round(prix * 100) / 100);
    setCustomLabel(''); setCustomAmount('');
  };

  const serviceTile = (s: Service) => (
    <ServiceTile key={s.id} service={s} color={categoryColor(categories, s.category_id)} qty={cartQtyByService.get(s.id) ?? 0} onPick={() => onPick(s)} />
  );

  return (
    <section aria-labelledby="caisse-catalog-title" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="caisse-catalog-title" className="text-[17px] font-semibold tracking-tight text-stone-950">Soins et produits</h2>
        {/* Seul accès au catalogue en mode app : la barre latérale y est masquée. */}
        <Link href="/admin/caisse/prestations" className="text-[13.5px] font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline">
          Gérer le catalogue
        </Link>
      </div>

      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
        <label htmlFor="caisse-service-search" className="sr-only">Rechercher un soin ou un produit</label>
        <input
          ref={searchRef}
          id="caisse-service-search"
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            // Entrée : ajoute le premier résultat et vide le champ, prêt pour l'article suivant.
            if (e.key === 'Enter' && term) {
              e.preventDefault();
              const s0 = activeTab !== 'produits' ? filteredServices[0] : undefined;
              const p0 = filteredProducts[0];
              if (s0) onPick(s0); else if (p0) onPickProduct(p0); else return;
              setSearch('');
            }
            if (e.key === 'Escape') setSearch('');
          }}
          placeholder="Rechercher un soin ou un produit…"
          autoComplete="off"
          aria-describedby="caisse-search-hint"
          className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-10 text-[15px] text-stone-900 placeholder:text-stone-500 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        <span id="caisse-search-hint" className="sr-only">Touche barre oblique pour rechercher, Entrée pour ajouter le premier résultat.</span>
        {!search && (
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 text-[12px] text-stone-400 lg:flex" aria-hidden="true">
            <Kbd>/</Kbd>
          </span>
        )}
        {search && (
          <span className="pointer-events-none absolute right-12 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 text-[12px] text-stone-400 lg:flex" aria-hidden="true">
            <Kbd>Entrée</Kbd> ajoute
          </span>
        )}
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Effacer la recherche" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer">
            <X size={16} />
          </button>
        )}
      </div>

      {!loading && !term && (
        <OfferStrip offers={offers} stats={offerStats} inCart={cartQtyByOffer} today={todayZurich()} onPick={onPickOffer} />
      )}

      {tabs.length > 2 && !term && (
        <div role="tablist" aria-label="Catégories" className="flex flex-wrap gap-1.5">
          {tabs.map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex h-9 items-center gap-2 border px-3.5 text-[13.5px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  active ? 'border-stone-900 bg-accent text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                {t.color && <span className="size-2 rounded-full" style={{ background: t.color }} aria-hidden="true" />}
                {t.label}
                <span className={`tabular-nums ${active ? 'text-white/70' : 'text-stone-400'}`}>{t.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className={TILE_GRID}>
          {[...Array(9)].map((_, i) => <div key={i} className="h-[96px] rounded-xl bg-stone-100 animate-pulse" />)}
        </div>
      ) : services.length === 0 && products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 px-5 py-8 text-center">
          <p className="mb-2 text-[15px] text-stone-700">Le catalogue est vide.</p>
          <Link href="/admin/caisse/prestations" className="text-[14px] font-semibold text-accent hover:underline">Créer le catalogue →</Link>
        </div>
      ) : (
        <div className="space-y-7">
          {grouped ? (
            groups.map(g => (
              <div key={g.id}>
                <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-stone-700">
                  <span className="size-2 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                  {g.label}
                </h3>
                <div className={TILE_GRID}>{g.items.map(serviceTile)}</div>
              </div>
            ))
          ) : (
            showServices && <div className={TILE_GRID}>{filteredServices.map(serviceTile)}</div>
          )}

          {showProducts && (
            <div>
              {(grouped || (activeTab === 'all' && showServices)) && (
                <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-stone-700">
                  <span className="size-2 rounded-full" style={{ background: PRODUCT_COLOR }} aria-hidden="true" />
                  Produits
                </h3>
              )}
              <div className={TILE_GRID}>
                {filteredProducts.map(p => (
                  <ProductTile key={p.id} product={p} qty={cartQtyByProduct.get(p.id) ?? 0} onPick={() => onPickProduct(p)} />
                ))}
              </div>
            </div>
          )}

          {!showServices && !showProducts && (
            <p className="rounded-xl border border-dashed border-stone-300 px-5 py-8 text-center text-[14.5px] text-stone-700">
              Rien ne correspond{term ? ` à « ${search.trim()} »` : ' dans cette catégorie'}.
            </p>
          )}
        </div>
      )}

      {/* Montant libre — geste commercial, article hors catalogue, forfait négocié… */}
      <div className="border-t border-stone-200 pt-4">
        {!customOpen ? (
          <button type="button" onClick={() => setCustomOpen(true)} className="inline-flex items-center gap-2 text-[14px] font-medium text-stone-600 hover:text-stone-950 cursor-pointer">
            <Plus size={16} /> Ajouter un montant libre
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="caisse-custom-label" className="sr-only">Libellé du montant libre</label>
            <input
              id="caisse-custom-label"
              type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
              placeholder="Libellé (geste commercial, article hors catalogue…)"
              autoFocus
              className="h-11 flex-1 rounded-lg border border-stone-200 px-3.5 text-[14px] text-stone-800 placeholder:text-stone-500 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            <label htmlFor="caisse-custom-amount" className="sr-only">Montant en francs</label>
            <input
              id="caisse-custom-amount"
              type="text" inputMode="decimal" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setCustomError(null); }}
              placeholder="CHF"
              className="h-11 rounded-lg border border-stone-200 px-3.5 text-[14px] text-stone-800 placeholder:text-stone-500 tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 sm:w-28"
            />
            <Button type="submit" disabled={!customAmount.trim()} icon={Plus} className="!h-11">Ajouter</Button>
            <Button type="button" variant="ghost" className="!h-11" onClick={() => { setCustomOpen(false); setCustomError(null); }}>Fermer</Button>
          </form>
        )}
        {customError && <p role="alert" className="mt-2 text-[13px] text-red-700">{customError}</p>}
      </div>
    </section>
  );
}

/** Repère du panier visé (250–450 CHF), discret : une barre et une phrase. */
function PanierGauge({ amount }: { amount: number }) {
  const inRange = amount >= 250 && amount <= 450;
  return (
    <div className="pt-3">
      <ProgressBar size="sm" value={amount} max={600} zone={[250, 450]} label="Montant du ticket par rapport à la fourchette visée de 250 à 450 CHF" />
      <p className={`mt-2 text-[12.5px] ${inRange || amount > 450 ? 'text-emerald-700' : 'text-stone-600'}`}>
        {inRange
          ? 'Dans la fourchette visée (250 – 450 CHF).'
          : amount > 450
            ? 'Au-dessus de la fourchette visée : belle vente conseil.'
            : `Encore ${formatCHF(250 - amount)} pour la fourchette visée : un produit conseil ?`}
      </p>
    </div>
  );
}

// ── Ligne de ticket ─────────────────────────────────────────────────────────

function CartRow({ line, tvaActive, onPatch, onRemove }: {
  line: CartLine;
  tvaActive: boolean;
  onPatch: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const total = line.prix_unitaire_ttc * line.quantite;

  return (
    <li className="group space-y-2 px-5 py-3.5 [animation:admin-enter_0.25s_ease-out_both]">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[14.5px] font-medium leading-snug text-stone-900">{line.description}</p>
        <span className="shrink-0 text-[14.5px] font-semibold text-stone-950 tabular-nums">{formatCHF(total)}</span>
        <button
          onClick={onRemove}
          aria-label={`Retirer ${line.description}`}
          className="-mr-1.5 -mt-0.5 shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Un bon = une ligne : pour en vendre deux, on ajoute un second bon. */}
        {!line.gift_card && (
          <div className="flex items-center rounded-lg bg-stone-50">
            <button
              onClick={() => onPatch({ quantite: Math.max(1, line.quantite - 1) })}
              aria-label="Diminuer la quantité"
              className="grid size-7 place-items-center text-stone-500 transition-colors hover:text-stone-900 cursor-pointer"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[1.5rem] text-center text-[13px] font-medium tabular-nums text-stone-800">{line.quantite}</span>
            <button
              onClick={() => onPatch({ quantite: line.quantite + 1 })}
              aria-label="Augmenter la quantité"
              className="grid size-7 place-items-center text-stone-500 transition-colors hover:text-stone-900 cursor-pointer"
            >
              <Plus size={13} />
            </button>
          </div>
        )}

        {editingPrice ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            defaultValue={String(line.prix_unitaire_ttc)}
            aria-label="Prix unitaire en francs"
            onBlur={e => {
              const v = Number(e.target.value.replace(',', '.'));
              if (Number.isFinite(v) && v >= 0) onPatch({ prix_unitaire_ttc: v, prix_base: undefined, remise_pct: undefined });
              setEditingPrice(false);
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-7 w-24 rounded-lg border border-accent px-2 text-[13px] tabular-nums text-stone-800 outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingPrice(true)}
            title="Modifier le prix unitaire"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12.5px] text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 cursor-pointer tabular-nums"
          >
            {line.quantite > 1 ? `${line.quantite} × ` : ''}{formatCHF(line.prix_unitaire_ttc)} <Pencil size={11} />
          </button>
        )}

        {tvaActive && !line.gift_card && (
          <>
            <label htmlFor={`tva-${line.key}`} className="sr-only">Taux de TVA</label>
            <select
              id={`tva-${line.key}`}
              value={line.taux_tva}
              onChange={e => onPatch({ taux_tva: Number(e.target.value) })}
              className="h-7 rounded-lg border border-stone-200 px-2 text-[12.5px] text-stone-600 outline-none focus:border-accent cursor-pointer"
            >
              {TAUX_TVA_CH.map(t => (
                <option key={t.value} value={t.value}>TVA {t.value} %</option>
              ))}
            </select>
          </>
        )}
      </div>
      {!line.gift_card && <RemiseControl line={line} onPatch={onPatch} />}
    </li>
  );
}

// Remise en % sur une ligne : puces rapides + saisie libre ; le total se met à jour.
function RemiseControl({ line, onPatch, large = false }: {
  line: CartLine;
  onPatch: (patch: Partial<CartLine>) => void;
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const pct = line.remise_pct ?? 0;
  const base = line.prix_base ?? line.prix_unitaire_ttc;
  const btn = large ? 'min-h-11 px-4 text-[15px]' : 'px-2.5 py-1 text-xs';
  const apply = (v: number) => { onPatch(remisePatch(line, v)); };
  return (
    <div className="w-full">
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-medium cursor-pointer ${btn} ${
          pct > 0 ? 'border-accent bg-accent/10 text-accent' : 'border-stone-200 text-stone-600 hover:border-stone-300'
        }`}
      >
        <Percent size={large ? 16 : 12} aria-hidden="true" />
        {pct > 0 ? `Remise ${pct} % · ${formatCHF(base)} → ${formatCHF(line.prix_unitaire_ttc)}` : 'Remise'}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[5, 10, 15, 20, 30, 50].map(v => (
            <button
              key={v} type="button" onClick={() => apply(v)} aria-pressed={pct === v}
              className={`rounded-lg border font-semibold tabular-nums cursor-pointer ${btn} ${
                pct === v ? 'border-transparent bg-accent text-accent-fg' : 'border-stone-200 bg-white text-stone-800'
              }`}
            >
              {v} %
            </button>
          ))}
          <label className="sr-only" htmlFor={`rem-${line.key}`}>Autre remise en pourcentage</label>
          <input
            id={`rem-${line.key}`} type="text" inputMode="decimal" value={custom} placeholder="Autre %"
            onChange={e => {
              setCustom(e.target.value);
              const v = Number(e.target.value.replace(',', '.'));
              if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 100) apply(v);
            }}
            className={`w-24 rounded-lg border border-stone-300 text-right tabular-nums outline-none focus:border-accent ${large ? 'min-h-11 px-3 text-[16px]' : 'px-2 py-1 text-xs'}`}
          />
          {pct > 0 && (
            <button type="button" onClick={() => { apply(0); setCustom(''); }}
              className={`rounded-lg font-medium text-stone-600 underline underline-offset-2 cursor-pointer ${btn}`}>
              Retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirmation d'encaissement ─────────────────────────────────────────────

export function ReceiptPanel({ transaction, onNew, rdvId = null, rdvOutcome = null }: {
  transaction: Transaction;
  onNew: () => void;
  /** Rendez-vous encaissé, et sort de son passage à « terminé ». */
  rdvId?: string | null;
  rdvOutcome?: 'pending' | 'ok' | 'failed' | null;
}) {
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
    <div className="max-w-md mx-auto py-2 lg:py-8">
      <div className="bg-stone-50 rounded-xl lg:rounded-xl p-6 lg:p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
          <Check size={26} />
        </div>
        <div>
          <p className="text-[14px] font-medium text-stone-700 mb-1">Encaissement enregistré</p>
          <p className="text-3xl font-semibold text-stone-900 tabular-nums">{formatCHF(transaction.total_ttc)}</p>
          {Number(transaction.montant_bon) > 0 && (
            <p className="text-[13px] text-stone-700 mt-1 tabular-nums">
              dont {formatCHF(transaction.montant_bon)} réglés par bon cadeau · encaissé : {formatCHF(recetteEncaissee(transaction))}
            </p>
          )}
          <p className="text-sm text-stone-700 mt-2">
            Facture <span className="font-medium text-stone-700">{transaction.numero}</span> · {transaction.client_label}
          </p>
        </div>

        {emitted.length > 0 && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3 text-left">
            <p className="text-[12px] font-semibold text-accent">
              Bon{emitted.length > 1 ? 's' : ''} à remettre
            </p>
            {emitted.map(card => (
              <div key={card.id} className="space-y-1.5">
                <p className="text-lg font-semibold text-stone-900 tracking-wide tabular-nums">{card.code}</p>
                <p className="text-xs text-stone-600">
                  {card.libelle} · {formatCHF(card.montant_initial)} · valable jusqu&apos;au{' '}
                  {new Date(`${card.expire_le}T00:00:00`).toLocaleDateString('fr-CH')}
                </p>
                <button
                  onClick={() => downloadBon(card)}
                  disabled={bonBusy === card.id}
                  className="flex items-center gap-1.5 text-[13px] text-accent hover:underline font-semibold disabled:opacity-40 cursor-pointer"
                >
                  {bonBusy === card.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Imprimer le bon
                </button>
              </div>
            ))}
            <p className="text-[12px] text-stone-600 leading-relaxed">
              Si vous remettez un bon papier, recopiez-y ce code : c&apos;est lui
              qu&apos;il faudra saisir le jour où la cliente viendra.
            </p>
          </div>
        )}

        {rdvOutcome === 'ok' && (
          <p role="status" className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Le rendez-vous est marqué comme terminé.
          </p>
        )}
        {rdvOutcome === 'failed' && (
          <p role="status" className="text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            La facture est bien enregistrée, mais le rendez-vous n&apos;a pas pu être marqué comme terminé.{' '}
            <Link href={`/admin/reservations${rdvId ? `?id=${rdvId}` : ''}`} className="font-semibold underline underline-offset-2">
              Le terminer depuis l&apos;agenda
            </Link>
          </p>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-2 pt-1">
          <button
            onClick={download}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-fg min-h-12 lg:min-h-0 py-3 rounded-xl lg:rounded-lg text-[15px] lg:text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {downloading ? 'Génération…' : 'Télécharger la quittance PDF'}
          </button>
          <button
            onClick={onNew}
            className="w-full min-h-12 lg:min-h-0 py-3 rounded-xl lg:rounded-lg bg-stone-100 text-stone-900 text-[15px] lg:text-sm font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Nouvel encaissement
          </button>
          <Link
            href="/admin/caisse/journal"
            className="block w-full py-3 lg:py-2 text-stone-600 text-[14px] lg:text-[13px] hover:text-stone-900 underline-offset-2 hover:underline transition-colors"
          >
            Voir le journal des recettes
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Téléphone : encaissement à une main ─────────────────────────────────────
//
// Trois gestes : (1) toucher les soins et produits, (2) ouvrir le panier d'un
// tap sur la barre du bas, (3) régler (mode, bon, cliente) et valider au pouce.
// Ce composant n'écrit rien et ne calcule aucun montant : il reçoit l'état et
// les totaux de `CaisseClient`, qui reste seul à passer par `createTransaction`.

export interface MobileCheckoutProps {
  banners: React.ReactNode;
  services: Service[];
  categories: ServiceCategory[];
  products: Product[];
  offers: Offer[];
  offerStats: Map<string, OfferStats>;
  onPickOffer: (o: Offer) => void;
  loading: boolean;
  lines: CartLine[];
  tvaActive: boolean;
  totals: { ttc: number; ht: number; tva: number };
  montantBon: number;
  resteAPayer: number;
  giftCard: GiftCard | null;
  mode: ModePaiement;
  onMode: (m: ModePaiement) => void;
  note: string;
  onNote: (v: string) => void;
  client: Client | null;
  clients: Client[];
  onSelectClient: (c: Client | null) => void;
  /** Ouvre la création express ; `initial` est le texte déjà tapé dans la recherche. */
  onNewClient: (initial: string) => void;
  onPickService: (s: Service) => void;
  onPickProduct: (p: Product) => void;
  onCustom: (description: string, prix: number) => void;
  onSellGift: () => void;
  onUseGift: () => void;
  onRemoveGift: () => void;
  onPatchLine: (key: string, patch: Partial<CartLine>) => void;
  onRemoveLine: (key: string) => void;
  onClearCart: () => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}

const M_INPUT =
  'w-full min-h-12 rounded-xl border border-stone-300 bg-white px-4 text-[16px] text-stone-900 placeholder:text-stone-500 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25';

export function MobileCheckout(p: MobileCheckoutProps) {
  const [sheet, setSheet] = useState<null | 'cart' | 'pay'>(null);
  const [clientSheet, setClientSheet] = useState(false);
  const [customSheet, setCustomSheet] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const itemCount = useMemo(() => p.lines.reduce((n, l) => n + Number(l.quantite || 0), 0), [p.lines]);
  const soldeParBon = p.resteAPayer === 0 && p.montantBon > 0;

  // Panier vidé pendant que la feuille est ouverte : on la ferme.
  useEffect(() => {
    if (p.lines.length === 0 && sheet) setSheet(null);
    if (p.lines.length < 2) setConfirmClear(false);
  }, [p.lines.length, sheet]);

  const closeSheet = () => { setSheet(null); setConfirmClear(false); };

  const cartFooter = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          if (p.lines.length <= 1 || confirmClear) { p.onClearCart(); setConfirmClear(false); }
          else setConfirmClear(true);
        }}
        className={`min-h-12 shrink-0 rounded-xl px-4 text-[15px] font-semibold cursor-pointer ${
          confirmClear ? 'bg-red-600 text-white' : 'bg-stone-50 text-stone-700'
        }`}
      >
        {confirmClear ? 'Confirmer ?' : 'Vider'}
      </button>
      <button
        type="button"
        onClick={() => { setConfirmClear(false); setSheet('pay'); }}
        className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-xl bg-accent px-5 text-accent-fg text-[16px] font-semibold cursor-pointer"
      >
        <span>Paiement</span>
        <span className="flex items-center gap-1 tabular-nums">{formatCHF(p.resteAPayer)} <ChevronRight size={18} aria-hidden="true" /></span>
      </button>
    </div>
  );

  const payFooter = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setSheet('cart')}
        className="min-h-12 shrink-0 rounded-xl bg-stone-50 px-4 text-[15px] font-semibold text-stone-700 cursor-pointer"
      >
        Retour
      </button>
      <button
        type="button"
        onClick={p.onSubmit}
        disabled={p.lines.length === 0 || p.submitting}
        className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-accent-fg text-[16px] font-semibold disabled:opacity-50 cursor-pointer"
      >
        {p.submitting
          ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Encaissement…</>
          : soldeParBon
            ? <><Check size={18} aria-hidden="true" /> Valider la prestation</>
            : <><Check size={18} aria-hidden="true" /> Encaisser {formatCHF(p.resteAPayer)}</>}
      </button>
    </div>
  );

  return (
    <div className={`space-y-4 ${p.lines.length > 0 ? 'pb-24' : ''}`}>
      {p.banners && <div className="space-y-3 empty:hidden">{p.banners}</div>}

      {/* Cliente : un tap pour la choisir ou en créer une */}
      <button
        type="button"
        onClick={() => setClientSheet(true)}
        className="flex min-h-[60px] w-full items-center gap-3 rounded-xl bg-stone-50 px-4 text-left cursor-pointer active:bg-stone-50"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <User size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-stone-600">Cliente</span>
          <span className="block truncate text-[16px] font-medium text-stone-950">
            {p.client ? clientFullName(p.client) : CLIENT_DE_PASSAGE}
          </span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-accent">{p.client ? 'Changer' : 'Choisir'}</span>
      </button>

      <MobileCatalog
        services={p.services} categories={p.categories} products={p.products} loading={p.loading}
        offers={p.offers} offerStats={p.offerStats} onPickOffer={p.onPickOffer}
        lines={p.lines}
        onPickService={p.onPickService} onPickProduct={p.onPickProduct}
        onCustom={() => setCustomSheet(true)} onSellGift={p.onSellGift}
      />

      {/* Barre d'encaissement : posée au-dessus de la barre d'onglets, ouvre le panier */}
      {p.lines.length > 0 && (
        <div
          className="fixed inset-x-0 z-30 px-4 pb-3"
          style={{ bottom: 'calc(var(--caisse-tabbar-h, 0px) + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => setSheet('cart')}
            className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl bg-accent pl-4 pr-5 text-accent-fg shadow-[0_8px_24px_rgba(28,25,23,0.25)] cursor-pointer active:bg-accent-hover"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-8 min-w-8 place-items-center bg-white/25 px-2 text-[15px] font-bold tabular-nums">{itemCount}</span>
              <span className="text-left leading-tight">
                <span className="block text-[13px] text-accent-fg/80">{itemCount > 1 ? 'articles' : 'article'}</span>
                <span className="block text-[15px] font-semibold">Voir le panier</span>
              </span>
            </span>
            <span className="text-right leading-tight">
              <span className="block text-[13px] text-accent-fg/80">{p.montantBon > 0 ? 'Reste à régler' : 'Total'}</span>
              <span className="block text-[22px] font-bold tabular-nums">{formatCHF(p.resteAPayer)}</span>
            </span>
          </button>
        </div>
      )}

      {/* Panier puis paiement : une seule feuille, deux étapes */}
      <BottomSheet
        open={sheet !== null}
        onClose={closeSheet}
        title={sheet === 'pay' ? 'Paiement' : 'Panier'}
        size="full"
        footer={sheet === 'pay' ? payFooter : cartFooter}
      >
        {sheet === 'pay' ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-center">
              <p className="text-[14px] text-stone-600">{p.montantBon > 0 ? 'Reste à encaisser' : 'Total à encaisser'}</p>
              <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-stone-950 tabular-nums">{formatCHF(p.resteAPayer)}</p>
              <p className="mt-2 text-[13px] text-stone-600">
                {itemCount} article{itemCount > 1 ? 's' : ''}
                {p.montantBon > 0 && <> · bon {p.giftCard?.code} : − {formatCHF(p.montantBon)}</>}
                {!p.tvaActive && ' · TVA 0 %'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[15px] font-semibold text-stone-900">{p.montantBon > 0 ? 'Reste à régler' : 'Mode de paiement'}</p>
              {soldeParBon ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[15px] text-stone-800">
                  <Ticket size={18} className="shrink-0 text-accent" aria-hidden="true" />
                  Intégralement réglé par le bon {p.giftCard?.code}. Rien à encaisser.
                </div>
              ) : (
                <SegmentedControl
                  label="Mode de paiement"
                  value={p.mode}
                  onChange={p.onMode}
                  options={MODES_PAIEMENT.map(m => ({ value: m.value, label: m.label }))}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setClientSheet(true)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-stone-50 px-4 text-left cursor-pointer active:bg-stone-50"
            >
              <User size={20} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-stone-600">Facture au nom de</span>
                <span className="block truncate text-[16px] font-medium text-stone-950">{p.client ? clientFullName(p.client) : CLIENT_DE_PASSAGE}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />
            </button>

            {/* Bon cadeau présenté en paiement */}
            {p.giftCard ? (
              <div className="rounded-xl bg-stone-50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[16px] font-semibold text-stone-950"><Ticket size={16} className="text-accent shrink-0" aria-hidden="true" /> {p.giftCard.code}</p>
                    <p className="truncate text-[14px] text-stone-600">{p.giftCard.libelle}</p>
                  </div>
                  <button
                    type="button" onClick={p.onRemoveGift} aria-label="Retirer le bon cadeau"
                    className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-stone-600 active:bg-red-50 active:text-red-700 cursor-pointer"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <dl className="space-y-1 text-[14px]">
                  <div className="flex justify-between"><dt className="text-stone-600">Solde du bon</dt><dd className="tabular-nums text-stone-800">{formatCHF(p.giftCard.montant_restant)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-600">Appliqué à cette vente</dt><dd className="font-semibold tabular-nums text-accent">− {formatCHF(p.montantBon)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-600">Restera sur le bon</dt><dd className="tabular-nums text-stone-800">{formatCHF(Number(p.giftCard.montant_restant) - p.montantBon)}</dd></div>
                </dl>
                <p className="text-[13px] leading-relaxed text-stone-600">
                  Cette part n&apos;entre pas dans les recettes : elle a été encaissée le jour où le bon a été vendu.
                </p>
              </div>
            ) : (
              <button
                type="button" onClick={p.onUseGift}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-50 text-[15px] font-semibold text-stone-800 cursor-pointer active:bg-stone-50"
              >
                <Ticket size={18} aria-hidden="true" /> Utiliser un bon cadeau
              </button>
            )}

            <div>
              <label htmlFor="m-caisse-note" className="mb-2 block text-[15px] font-semibold text-stone-900">
                Note <span className="font-normal text-stone-600">(facultatif)</span>
              </label>
              <input
                id="m-caisse-note" type="text" value={p.note} onChange={e => p.onNote(e.target.value)}
                placeholder="Remarque…" className={M_INPUT}
              />
            </div>

            {p.lines.length > 0 && p.resteAPayer > 0 && <BasketTarget reste={p.resteAPayer} />}

            {p.submitError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{p.submitError}</span>
              </div>
            )}

            <p className="text-center text-[13px] leading-relaxed text-stone-600">
              La facture est numérotée et enregistrée définitivement. Une erreur se corrige depuis le journal, avec le bouton « Corriger ».
            </p>
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-stone-100">
              {p.lines.map(line => (
                <MobileCartLine
                  key={line.key} line={line} tvaActive={p.tvaActive}
                  onPatch={patch => p.onPatchLine(line.key, patch)}
                  onRemove={() => p.onRemoveLine(line.key)}
                />
              ))}
            </ul>
            <div className="mt-2 space-y-1.5 rounded-xl bg-stone-50 border border-stone-200 p-4 text-[15px]">
              {p.tvaActive && (
                <>
                  <MRow label="Total HT" value={formatCHF(p.totals.ht)} />
                  <MRow label="TVA" value={formatCHF(p.totals.tva)} />
                </>
              )}
              {p.montantBon > 0 && (
                <>
                  <MRow label="Total prestations" value={formatCHF(p.totals.ttc)} />
                  <MRow label={`Bon ${p.giftCard?.code ?? ''}`} value={`− ${formatCHF(p.montantBon)}`} />
                </>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-medium text-stone-800">{p.montantBon > 0 ? 'Reste à encaisser' : 'Total'}</span>
                <span className="text-[26px] font-bold tabular-nums text-stone-950">{formatCHF(p.resteAPayer)}</span>
              </div>
              {!p.tvaActive && <p className="text-[13px] text-stone-600">TVA 0 % — activité non assujettie</p>}
            </div>
          </div>
        )}
      </BottomSheet>

      <MobileClientSheet
        open={clientSheet}
        onClose={() => setClientSheet(false)}
        clients={p.clients}
        selected={p.client}
        onSelect={(c) => { p.onSelectClient(c); setClientSheet(false); }}
        onNew={(initial) => { setClientSheet(false); p.onNewClient(initial); }}
      />

      <MobileCustomSheet
        open={customSheet}
        onClose={() => setCustomSheet(false)}
        onAdd={(label, prix) => { p.onCustom(label, prix); setCustomSheet(false); }}
      />
    </div>
  );
}

function MRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-stone-700">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Rappel du panier cible du Cockpit Hebdo (250–450 CHF), version compacte. */
function BasketTarget({ reste }: { reste: number }) {
  // Même repère que le ticket du bureau (`PanierGauge`) : une barre, une phrase.
  return (
    <div className="rounded-xl bg-stone-50 px-3.5 py-3">
      <PanierGauge amount={reste} />
    </div>
  );
}

// Catalogue : pastilles de catégories défilantes, grosses tuiles avec prix.
function MobileCatalog({ services, categories, products, offers, offerStats, onPickOffer, loading, lines, onPickService, onPickProduct, onCustom, onSellGift }: {
  services: Service[];
  categories: ServiceCategory[];
  products: Product[];
  offers: Offer[];
  offerStats: Map<string, OfferStats>;
  onPickOffer: (o: Offer) => void;
  loading: boolean;
  lines: CartLine[];
  onPickService: (s: Service) => void;
  onPickProduct: (p: Product) => void;
  onCustom: () => void;
  onSellGift: () => void;
}) {
  // 'menu' = écran intermédiaire des catégories (grosses tuiles), 'all' = tout le catalogue.
  const [tab, setTab] = useState('menu');
  const [search, setSearch] = useState('');
  const [announce, setAnnounce] = useState('');
  const assets = useMediaAssets();

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

  const hasMenu = tabs.length > 2;
  const term = search.trim().toLowerCase();
  const activeTab = tab === 'menu' && hasMenu && !term ? 'menu'
    : tabs.some(t => t.id === tab) ? tab : 'all';
  const countOf = (id: string) => id === 'produits' ? products.length
    : id === 'all' ? services.length
    : services.filter(s => id === 'none'
      ? (!s.category_id || !categories.some(c => c.id === s.category_id))
      : s.category_id === id).length;

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
  const showProducts = (activeTab === 'produits' || activeTab === 'all') && filteredProducts.length > 0;
  const showServices = activeTab !== 'produits' && filteredServices.length > 0;

  const qtyService = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) if (l.service_id) m.set(l.service_id, (m.get(l.service_id) ?? 0) + Number(l.quantite || 0));
    return m;
  }, [lines]);
  const qtyProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) if (l.product_id) m.set(l.product_id, (m.get(l.product_id) ?? 0) + Number(l.quantite || 0));
    return m;
  }, [lines]);
  const qtyOffer = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) if (l.offer_id) m.set(l.offer_id, (m.get(l.offer_id) ?? 0) + Number(l.quantite || 0));
    return m;
  }, [lines]);

  const tileCls = 'relative flex min-h-[96px] w-full flex-col justify-between gap-2 rounded-xl bg-stone-50 py-3.5 pl-4 pr-3.5 text-left cursor-pointer transition-transform duration-150 active:scale-[0.97] active:bg-warm-soft/60';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
        <label htmlFor="m-caisse-search" className="sr-only">Chercher une prestation ou un produit</label>
        <input
          id="m-caisse-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Chercher un soin ou un produit…" autoComplete="off"
          className={`${M_INPUT} pl-11`}
        />
      </div>

      {hasMenu && activeTab !== 'menu' && !term && (
        <button
          type="button" onClick={() => setTab('menu')}
          className="flex min-h-11 items-center gap-2 rounded-xl text-[15px] font-semibold text-accent cursor-pointer"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Catégories
          <span className="font-normal text-stone-600">· {tabs.find(t => t.id === activeTab)?.label}</span>
        </button>
      )}

      <p role="status" className="sr-only">{announce}</p>

      {!loading && !term && (activeTab === 'menu' || activeTab === 'all') && (
        <OfferStrip
          mobile offers={offers} stats={offerStats} inCart={qtyOffer} today={todayZurich()}
          onPick={(o) => { onPickOffer(o); setAnnounce(`${o.titre} ajouté`); }}
        />
      )}

      {!loading && activeTab === 'menu' ? (
        <div className="grid grid-cols-2 gap-3">
          {tabs.filter(t => t.id !== 'all').map(t => (
            <CategoryTile
              key={t.id} label={t.label} photo={pickPhoto(t.label, assets)}
              sub={`${countOf(t.id)} ${t.id === 'produits' ? 'produit' : 'soin'}${countOf(t.id) > 1 ? 's' : ''}`}
              icon={t.id === 'produits' ? <Package size={22} aria-hidden="true" /> : undefined}
              onClick={() => setTab(t.id)}
            />
          ))}
          <button
            type="button" onClick={() => setTab('all')}
            className="col-span-2 flex min-h-12 items-center justify-center rounded-xl bg-stone-50 text-[15px] font-semibold text-stone-800 cursor-pointer active:bg-stone-50"
          >
            Voir tout le catalogue
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-[92px] animate-pulse rounded-xl bg-stone-100" />)}
        </div>
      ) : services.length === 0 && products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-8 text-center">
          <p className="mb-2 text-[16px] text-stone-800">Le catalogue est vide.</p>
          <Link href="/admin/caisse/prestations" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-accent">Créer le catalogue →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {showServices && (
            <div className="grid grid-cols-2 gap-3">
              {filteredServices.map(s => {
                const q = qtyService.get(s.id) ?? 0;
                return (
                  <button
                    key={s.id} type="button"
                    onClick={() => { onPickService(s); setAnnounce(`${s.nom} ajouté`); }}
                    className={`${tileCls} ${q > 0 ? 'border-warm-muted bg-warm-soft/50' : ''}`}
                  >
                    <span className="absolute inset-y-3.5 left-0 w-[3px] rounded-r-full" style={{ background: categoryColor(categories, s.category_id) }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block pr-6 text-[15px] font-semibold leading-snug text-stone-950 line-clamp-3">{s.nom}</span>
                      {s.description?.trim() && <span className="mt-0.5 block truncate text-[13px] text-stone-500">{s.description}</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-[16px] font-semibold tabular-nums text-stone-950">
                      {s.type === 'forfait' && <Layers size={14} className="shrink-0 text-stone-500" aria-label="Forfait" />}
                      {formatCHF(s.prix_chf)}
                    </span>
                    {q > 0 && (
                      <span aria-label={`${q} dans le panier`} className="absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center bg-warm px-1.5 text-[13px] font-bold text-warm-ink rounded">{q}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {showProducts && (
            <div className="space-y-2">
              {activeTab === 'all' && <p className="text-[15px] font-semibold text-stone-800">Produits</p>}
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(pr => {
                  const q = qtyProduct.get(pr.id) ?? 0;
                  // Stock restant APRÈS la vente en cours ; il peut passer sous zéro
                  // sans bloquer la vente (l'inventaire rattrape l'écart).
                  const restant = Number(pr.stock) - q;
                  const niveau = stockLevel({ stock: restant, seuil_alerte: pr.seuil_alerte });
                  return (
                    <button
                      key={pr.id} type="button"
                      onClick={() => { onPickProduct(pr); setAnnounce(`${pr.nom} ajouté`); }}
                      className={`${tileCls} ${q > 0 ? 'border-warm-muted bg-warm-soft/50' : ''}`}
                    >
                      <span className="absolute inset-y-3.5 left-0 w-[3px] rounded-r-full" style={{ background: PRODUCT_COLOR }} aria-hidden="true" />
                      <span className="block pr-6 text-[15px] font-semibold leading-snug text-stone-950 line-clamp-3">{pr.nom}</span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[16px] font-semibold tabular-nums text-stone-800">{formatCHF(pr.prix_vente_chf)}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${
                          niveau === 'rupture' ? 'bg-red-50 text-red-700' : niveau === 'bas' ? 'bg-warm-soft text-warm-ink' : 'bg-stone-100 text-stone-700'
                        }`}>
                          <span className="sr-only">Stock restant : </span>{Math.round(restant * 100) / 100}
                        </span>
                      </span>
                      {q > 0 && (
                        <span aria-label={`${q} dans le panier`} className="absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center bg-warm px-1.5 text-[13px] font-bold text-warm-ink rounded">{q}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!showServices && !showProducts && (
            <p className="rounded-xl border border-dashed border-stone-300 bg-white px-5 py-8 text-center text-[15px] text-stone-700">
              Rien ne correspond{term ? ' à cette recherche' : ' dans cette catégorie'}.
            </p>
          )}
        </div>
      )}

      {/* Hors catalogue : montant libre, bon cadeau */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button" onClick={onCustom}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-50 text-[15px] font-semibold text-stone-800 cursor-pointer active:bg-stone-50"
        >
          <PenLine size={17} aria-hidden="true" /> Montant libre
        </button>
        <button
          type="button" onClick={onSellGift}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-50 text-[15px] font-semibold text-stone-800 cursor-pointer active:bg-stone-50"
        >
          <Gift size={17} aria-hidden="true" /> Vendre un bon
        </button>
      </div>
      <p className="text-center">
        <Link href="/admin/caisse/prestations" className="inline-flex min-h-11 items-center text-[14px] text-stone-600 underline underline-offset-2">
          Gérer le catalogue
        </Link>
      </p>
    </div>
  );
}

function MobileCartLine({ line, tvaActive, onPatch, onRemove }: {
  line: CartLine;
  tvaActive: boolean;
  onPatch: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const total = line.prix_unitaire_ttc * line.quantite;
  return (
    <li className="space-y-3 py-4">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[16px] font-medium leading-snug text-stone-950">{line.description}</p>
        <button
          type="button" onClick={onRemove} aria-label={`Retirer ${line.description}`}
          className="-mr-2 -mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-stone-500 active:bg-red-50 active:text-red-700 cursor-pointer"
        >
          <Trash2 size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        {line.gift_card ? <span /> : (
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1" role="group" aria-label={`Quantité de ${line.description}`}>
          <button
            type="button" aria-label="Diminuer la quantité" disabled={line.quantite <= 1}
            onClick={() => onPatch({ quantite: Math.max(1, line.quantite - 1) })}
            className="grid size-11 place-items-center rounded-xl bg-white text-stone-800 disabled:opacity-35 cursor-pointer"
          >
            <Minus size={20} aria-hidden="true" />
          </button>
          <span className="min-w-10 text-center text-[18px] font-semibold tabular-nums text-stone-950" aria-live="polite">{line.quantite}</span>
          <button
            type="button" aria-label="Augmenter la quantité"
            onClick={() => onPatch({ quantite: line.quantite + 1 })}
            className="grid size-11 place-items-center rounded-xl bg-white text-stone-800 cursor-pointer"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        )}

        <div className="text-right">
          <p className="text-[19px] font-semibold tabular-nums text-stone-950">{formatCHF(total)}</p>
          {editingPrice ? (
            <input
              type="text" inputMode="decimal" autoFocus defaultValue={String(line.prix_unitaire_ttc)}
              aria-label="Prix unitaire en francs"
              onBlur={e => {
                const v = Number(e.target.value.replace(',', '.'));
                if (Number.isFinite(v) && v >= 0) onPatch({ prix_unitaire_ttc: v, prix_base: undefined, remise_pct: undefined });
                setEditingPrice(false);
              }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="mt-1 h-11 w-28 rounded-xl border border-accent px-3 text-right text-[16px] tabular-nums text-stone-900 outline-none"
            />
          ) : (
            <button
              type="button" onClick={() => setEditingPrice(true)}
              className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-[14px] text-stone-600 tabular-nums cursor-pointer"
            >
              {line.quantite > 1 ? `${formatCHF(line.prix_unitaire_ttc)} pièce` : 'Modifier le prix'} <Pencil size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {tvaActive && !line.gift_card && (
        <div>
          <label htmlFor={`m-tva-${line.key}`} className="sr-only">Taux de TVA</label>
          <select
            id={`m-tva-${line.key}`} value={line.taux_tva}
            onChange={e => onPatch({ taux_tva: Number(e.target.value) })}
            className="min-h-11 rounded-xl bg-stone-50 px-3 text-[16px] text-stone-800"
          >
            {TAUX_TVA_CH.map(t => <option key={t.value} value={t.value}>TVA {t.value} %</option>)}
          </select>
        </div>
      )}
      {!line.gift_card && <RemiseControl line={line} onPatch={onPatch} large />}
    </li>
  );
}

function MobileClientSheet({ open, onClose, clients, selected, onSelect, onNew }: {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  selected: Client | null;
  onSelect: (c: Client | null) => void;
  onNew: (initial: string) => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (!open) setSearch(''); }, [open]);
  const results = useMemo(() => clients.filter(c => matchClient(c, search)).slice(0, 40), [clients, search]);
  const term = search.trim();

  return (
    <BottomSheet
      open={open} onClose={onClose} title="Cliente" size="full" zIndex={110}
      description="Cherchez par nom, téléphone ou e-mail, ou créez une fiche."
    >
      <div className="space-y-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <label htmlFor="m-client-search" className="sr-only">Rechercher une cliente</label>
          <input
            id="m-client-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, téléphone…" autoComplete="off" className={`${M_INPUT} pl-11`}
          />
        </div>

        <button
          type="button" onClick={() => onNew(term)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 text-left text-[16px] font-semibold text-accent cursor-pointer active:bg-accent/10"
        >
          <UserPlus size={20} aria-hidden="true" />
          {term ? `Créer « ${term} »` : 'Nouvelle cliente'}
        </button>

        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl bg-stone-50">
          <li>
            <button
              type="button" onClick={() => onSelect(null)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left cursor-pointer active:bg-stone-50"
            >
              <span>
                <span className="block text-[16px] font-medium text-stone-950">{CLIENT_DE_PASSAGE}</span>
                <span className="block text-[14px] text-stone-600">Sans fiche cliente</span>
              </span>
              {!selected && <Check size={20} className="text-accent" aria-label="Choisie" />}
            </button>
          </li>
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button" onClick={() => onSelect(c)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left cursor-pointer active:bg-stone-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-medium text-stone-950">{clientFullName(c)}</span>
                  {c.telephone && <span className="block truncate text-[14px] text-stone-600">{c.telephone}</span>}
                </span>
                {selected?.id === c.id && <Check size={20} className="shrink-0 text-accent" aria-label="Choisie" />}
              </button>
            </li>
          ))}
        </ul>
        {term && results.length === 0 && (
          <p className="text-center text-[15px] text-stone-700">Aucune cliente trouvée pour « {term} ».</p>
        )}
      </div>
    </BottomSheet>
  );
}

function MobileCustomSheet({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (label: string, prix: number) => void;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!open) { setLabel(''); setAmount(''); setError(null); } }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const prix = Number(amount.replace(',', '.'));
    if (!Number.isFinite(prix) || prix <= 0) {
      setError('Montant non reconnu : saisissez un nombre, par exemple 45 ou 45.50.');
      return;
    }
    onAdd(label.trim() || 'Prestation', Math.round(prix * 100) / 100);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Montant libre" description="Geste commercial, article hors catalogue, forfait négocié…">
      <form onSubmit={submit} className="space-y-4 pb-2">
        <div>
          <label htmlFor="m-custom-label" className="mb-1.5 block text-[15px] font-semibold text-stone-900">Libellé</label>
          <input id="m-custom-label" type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Prestation" className={M_INPUT} />
        </div>
        <div>
          <label htmlFor="m-custom-amount" className="mb-1.5 block text-[15px] font-semibold text-stone-900">Montant (CHF)</label>
          <input
            id="m-custom-amount" type="text" inputMode="decimal" data-autofocus value={amount}
            onChange={e => { setAmount(e.target.value); setError(null); }}
            placeholder="45.00" className={`${M_INPUT} tabular-nums`}
          />
        </div>
        {error && <p role="alert" className="text-[14px] text-red-700">{error}</p>}
        <button
          type="submit" disabled={!amount.trim()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[16px] font-semibold text-accent-fg disabled:opacity-40 cursor-pointer"
        >
          <Plus size={18} aria-hidden="true" /> Ajouter au panier
        </button>
      </form>
    </BottomSheet>
  );
}
