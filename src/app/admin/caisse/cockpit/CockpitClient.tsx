"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Target, TrendingUp, Sparkles, Package, AlertTriangle, CheckCircle2,
  Users, ShoppingBag, ArrowRight, Lightbulb, Award, Flame, Sliders,
  HelpCircle, RefreshCw, Layers, Calendar, ChevronRight
} from 'lucide-react';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { Button, PageHeader } from '../../../../components/admin/ui';
import { listProducts, listTransactions } from '../../../../services/caisse';
import { Product, TransactionWithItems, formatCHF, stockLevel, isVenteProduct } from '../../../../types/caisse';
import { computeAvsIndependant } from '../../../../types/finance';

export default function CockpitClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode simulation si aucune transaction réelle n'a encore été enregistrée cette semaine
  const [demoMode, setDemoMode] = useState(false);

  // Paramètres du simulateur interactif
  const [simClientesJour, setSimClientesJour] = useState(2);
  const [simJoursSemaine, setSimJoursSemaine] = useState(5);
  const [simPanierMoyen, setSimPanierMoyen] = useState(350);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Période de la semaine en cours (lundi au samedi)
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);

      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);
      saturday.setHours(23, 59, 59, 999);

      const [prods, txs] = await Promise.all([
        listProducts(true),
        listTransactions(monday.toISOString(), saturday.toISOString()).catch(() => []),
      ]);

      setProducts(prods.filter(isVenteProduct));
      setTransactions(txs);

      // Si pas encore de transactions réelles sur la semaine, activer le mode démonstration
      if (txs.length === 0) {
        setDemoMode(true);
      }
    } catch (e) {
      console.error('Erreur chargement cockpit:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Données Stock Boutique Vente & CA Potentiel ─────────────────────────────
  const stockStats = useMemo(() => {
    const actifs = products.filter(p => p.active);
    const totalUnites = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)), 0);
    const valeurAchat = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * Number(p.prix_achat_chf || 0), 0);
    const caPotentiel = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * Number(p.prix_vente_chf || 0), 0);
    const margePotentielle = Math.max(0, caPotentiel - valeurAchat);

    const ruptures = actifs.filter(p => stockLevel(p) === 'rupture');
    const bas = actifs.filter(p => stockLevel(p) === 'bas');
    const disponibles = actifs.filter(p => Number(p.stock || 0) > 0);

    // Top 5 des produits avec le plus de CA potentiel dormant
    const topPotentiel = [...disponibles]
      .map(p => ({
        product: p,
        ca: Number(p.stock || 0) * Number(p.prix_vente_chf || 0),
        marge: Number(p.stock || 0) * (Number(p.prix_vente_chf || 0) - Number(p.prix_achat_chf || 0)),
      }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);

    return {
      references: actifs.length,
      totalUnites,
      valeurAchat,
      caPotentiel,
      margePotentielle,
      ruptures,
      bas,
      topPotentiel,
    };
  }, [products]);

  // ── Données Semaine en Cours ────────────────────────────────────────────────
  const weekStats = useMemo(() => {
    // Si mode démo actif : chiffres simulés pour 2 clientes / jour sur 4 jours
    if (demoMode) {
      const demoClientes = 8;
      const demoCA = 2740;
      const demoPanier = Math.round(demoCA / demoClientes);
      return {
        clientesCount: demoClientes,
        caTotal: demoCA,
        panierMoyen: demoPanier,
        isDemo: true,
      };
    }

    const validTxs = transactions.filter(t => t.status !== 'annulee');
    const clientesCount = validTxs.length;
    const caTotal = validTxs.reduce((acc, t) => acc + Number(t.total_ttc || 0), 0);
    const panierMoyen = clientesCount > 0 ? Math.round((caTotal / clientesCount) * 10) / 10 : 0;

    return {
      clientesCount,
      caTotal,
      panierMoyen,
      isDemo: false,
    };
  }, [transactions, demoMode]);

  // Cibles Hebdomadaires
  // Environ 2 clientes par jour sur 5 jours = 10 clientes
  const CIBLE_CLIENTES_HEBDO = 10;
  const CIBLE_PANIER_MIN = 250;
  const CIBLE_PANIER_MAX = 450;
  const CIBLE_PANIER_MOYEN = 350;
  const CIBLE_CA_MIN = CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MIN; // 2'500 CHF
  const CIBLE_CA_CONFORT = CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MOYEN; // 3'500 CHF
  const CIBLE_CA_MAX = CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MAX; // 4'500 CHF

  // Pourcentages d'atteinte des objectifs
  const pctClientes = Math.min(100, Math.round((weekStats.clientesCount / CIBLE_CLIENTES_HEBDO) * 100));
  const pctCA = Math.min(100, Math.round((weekStats.caTotal / CIBLE_CA_CONFORT) * 100));

  // ── Simulateur Personnalisé ────────────────────────────────────────────────
  const simResults = useMemo(() => {
    const clientesSemaine = simClientesJour * simJoursSemaine;
    const caSemaine = clientesSemaine * simPanierMoyen;
    const caMois = caSemaine * 4.2;
    const caAn = caSemaine * 48; // 48 semaines actives (4 semaines congés)

    // Coût matières estimé (~15% en institut esthétique spécialisé avec revente)
    const coutMatiereEstime = caAn * 0.16;
    // Charges d'exploitation fixes estimées (loyer Palézieux, assurance, marketing, telecoms ~20'000 CHF/an)
    const chargesFixesEstimees = 20000;
    const beneficeBrutEstime = Math.max(0, caAn - coutMatiereEstime - chargesFixesEstimees);

    // Calcul AVS Vaud
    const avsAnnuel = computeAvsIndependant(beneficeBrutEstime).totalAnnuel;
    const remunerationNetteAnnuelle = Math.max(0, beneficeBrutEstime - avsAnnuel);
    const remunerationNetteMensuelle = Math.round(remunerationNetteAnnuelle / 12);

    return {
      clientesSemaine,
      caSemaine,
      caMois: Math.round(caMois),
      caAn: Math.round(caAn),
      avsAnnuel,
      remunerationNetteMensuelle,
    };
  }, [simClientesJour, simJoursSemaine, simPanierMoyen]);

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      {/* En-tête Cockpit */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-stone-900 via-stone-850 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl shadow-md border border-stone-800">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
              <Sparkles size={12} className="text-emerald-400" /> Cockpit de l&apos;Esthéticienne
            </span>
            <span className="text-xs text-stone-400">
              Palézieux · Objectif : 2 clientes / jour
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Objectifs & Pilotage de la Semaine
          </h1>
          <p className="text-xs text-stone-300 mt-1 max-w-2xl leading-relaxed">
            Cadencez votre activité avec sérénité : visez <strong>2 clientes par jour</strong> avec un <strong>panier moyen de 250 à 450 CHF</strong> (soin cabine + produits conseil), et exploitez tout le potentiel de votre stock boutique.
          </p>
        </div>

        <div className="flex items-center gap-2 md:shrink-0">
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`text-[13px] min-h-11 md:min-h-0 px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
              demoMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
            }`}
            title="Basculer entre les données réelles et la simulation hebdomadaire"
          >
            <RefreshCw size={12} />
            {demoMode ? 'Données démo actives' : 'Voir simulation type'}
          </button>
        </div>
      </div>

      {/* ── 1. OBJECTIFS DE LA SEMAINE (Jauges 2 clientes/jour & Panier 250-450 CHF) ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Target size={16} className="text-emerald-700" />
            Objectifs Hebdomadaires en Cours
          </h2>
          <span className="text-xs text-stone-500">
            Cible : 10 clientes / semaine (2 / jour) · Panier : 250 – 450 CHF
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Jauge Fréquentation (2 clientes par jour) */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <span className="text-xs font-semibold text-stone-600 uppercase">Fréquentation Semaine</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold">
                  Cible : 2 / jour
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold break-words text-stone-950">{weekStats.clientesCount}</span>
                <span className="text-stone-500 text-xs font-medium">/ {CIBLE_CLIENTES_HEBDO} clientes accueillies</span>
              </div>
              <p className="text-[11.5px] text-stone-600 mt-1">
                {weekStats.clientesCount >= CIBLE_CLIENTES_HEBDO ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Objectif de fréquentation atteint !
                  </span>
                ) : (
                  <span>Encore <strong>{Math.max(0, CIBLE_CLIENTES_HEBDO - weekStats.clientesCount)} clientes</strong> pour compléter l&apos;objectif.</span>
                )}
              </p>
            </div>

            <div className="mt-4">
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${pctClientes}%` }}
                />
              </div>
              <div className="flex justify-between gap-2 text-[10.5px] text-stone-600 mt-1.5 font-medium">
                <span>0</span>
                <span>5 (mi-semaine)</span>
                <span className="font-bold text-stone-900">10 clientes (Cible)</span>
              </div>
            </div>
          </div>

          {/* Jauge Panier Moyen (250 à 450 CHF) */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <span className="text-xs font-semibold text-stone-600 uppercase">Panier Moyen Réalisé</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                  Fourchette 250 – 450 CHF
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold break-words text-emerald-800">
                  {formatCHF(weekStats.panierMoyen)}
                </span>
                <span className="text-stone-500 text-xs font-medium">/ cliente</span>
              </div>

              <div className="mt-1 text-[11.5px]">
                {weekStats.panierMoyen >= CIBLE_PANIER_MIN && weekStats.panierMoyen <= CIBLE_PANIER_MAX ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} /> Parfaitement dans la fourchette cible !
                  </span>
                ) : weekStats.panierMoyen > CIBLE_PANIER_MAX ? (
                  <span className="text-purple-700 font-semibold flex items-center gap-1">
                    <Sparkles size={13} /> Performance d&apos;excellence (&gt; 450 CHF)
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Sous la cible (viser 1 produit conseil en plus par soin)
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="relative w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                {/* Zone cible 250 - 450 sur une échelle de 0 à 600 */}
                <div
                  className="absolute bg-emerald-100 h-2.5"
                  style={{ left: `${(250 / 600) * 100}%`, width: `${((450 - 250) / 600) * 100}%` }}
                />
                {/* Valeur actuelle */}
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    weekStats.panierMoyen >= 250 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, (weekStats.panierMoyen / 600) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between gap-2 text-[10.5px] text-stone-600 mt-1.5 font-medium">
                <span>0</span>
                <span className="text-emerald-800 font-bold">250 CHF (Min)</span>
                <span className="text-emerald-900 font-bold">450 CHF (Haut)</span>
              </div>
            </div>
          </div>

          {/* Jauge Chiffre d'Affaires Hebdomadaire */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <span className="text-xs font-semibold text-stone-600 uppercase">Chiffre d&apos;Affaires Semaine</span>
                <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-[11px] font-bold">
                  Objectif 3&apos;500 CHF
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl sm:text-3xl font-extrabold break-words text-stone-950">
                  {formatCHF(weekStats.caTotal)}
                </span>
                <span className="text-stone-500 text-xs font-medium">encaissés</span>
              </div>
              <p className="text-[11.5px] text-stone-600 mt-1">
                Seuil de rentabilité : <strong>{formatCHF(CIBLE_CA_MIN)}</strong> · Confort : <strong>{formatCHF(CIBLE_CA_CONFORT)}</strong>
              </p>
            </div>

            <div className="mt-4">
              <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${pctCA}%` }}
                />
              </div>
              <div className="flex justify-between gap-2 text-[10.5px] text-stone-600 mt-1.5 font-medium">
                <span>0</span>
                <span>2&apos;500 CHF (Seuil)</span>
                <span className="font-bold text-stone-900">3&apos;500 CHF ({pctCA}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. POTENTIEL DE CA DU STOCK VENTE (GISEMENT EN RAYON) ── */}
      <div className="bg-gradient-to-br from-emerald-50/90 via-white to-stone-50 border border-emerald-200/90 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
          <div>
            <div className="flex items-center gap-2">
              <Package className="text-emerald-700" size={20} />
              <h2 className="text-base font-bold text-stone-900">
                Gisement & Potentiel Dormant du Stock Vente Boutique
              </h2>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              Valeur marchande des cosmétiques Phytomer actuellement présents sur vos étagères à l&apos;institut.
            </p>
          </div>
          <Link
            href="/admin/caisse/produits"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Gérer les produits vente <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="bg-white min-w-0 p-4 rounded-xl border border-emerald-200/60 shadow-2xs">
            <span className="text-[11.5px] text-stone-500 font-medium block">CA Potentiel Total en Rayon</span>
            <span className="text-xl sm:text-2xl font-black break-words text-emerald-800 mt-1 block">
              {formatCHF(stockStats.caPotentiel)}
            </span>
            <span className="text-[11px] text-emerald-700 mt-0.5 block">
              Valeur de vente TTC intégrale
            </span>
          </div>

          <div className="bg-white min-w-0 p-4 rounded-xl border border-purple-200/60 shadow-2xs">
            <span className="text-[11.5px] text-stone-500 font-medium block">Marge Brute à Encaisser</span>
            <span className="text-xl sm:text-2xl font-black break-words text-purple-900 mt-1 block">
              {formatCHF(stockStats.margePotentielle)}
            </span>
            <span className="text-[11px] text-purple-700 mt-0.5 block">
              Bénéfice net marchandise
            </span>
          </div>

          <div className="bg-white min-w-0 p-4 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-[11.5px] text-stone-500 font-medium block">Articles Vente Disponibles</span>
            <span className="text-xl sm:text-2xl font-black break-words text-stone-900 mt-1 block">
              {stockStats.totalUnites} flacons
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5 block">
              sur {stockStats.references} références actives
            </span>
          </div>

          <div className="bg-white min-w-0 p-4 rounded-xl border border-blue-200/60 shadow-2xs">
            <span className="text-[11.5px] text-stone-500 font-medium block">Potentiel en Clientes Équipées</span>
            <span className="text-xl sm:text-2xl font-black break-words text-blue-900 mt-1 block">
              ~{Math.max(1, Math.round(stockStats.totalUnites / 2))} clientes
            </span>
            <span className="text-[11px] text-blue-700 mt-0.5 block">
              à 2 produits par routine beauté
            </span>
          </div>
        </div>

        {/* Message d'impact pour l'esthéticienne */}
        <div className="mt-4 p-3.5 bg-white/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="text-amber-500 shrink-0" size={18} />
            <p className="text-stone-700 text-[11.5px] leading-snug">
              <strong>Levier direct sans temps cabine :</strong> En conseillant une routine beauté (1 crème + 1 sérum ou nettoyant) à seulement <strong>1 cliente sur 2</strong> parmi vos 10 clientes hebdomadaires, vous débloquez environ <strong>CHF 600.00 à CHF 900.00 de CA supplémentaire</strong> chaque semaine sans rajouter une seule heure de travail.
            </p>
          </div>
        </div>

        {/* Top 5 Produits à plus fort potentiel */}
        {stockStats.topPotentiel.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Award size={14} className="text-emerald-700" />
              Top 5 des produits à plus fort potentiel en rayon
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {stockStats.topPotentiel.map((item, idx) => (
                <div key={idx} className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col justify-between text-xs">
                  <div>
                    <span className="font-semibold text-stone-900 line-clamp-2 leading-tight">
                      {item.product.nom}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono mt-0.5 block">
                      Réf. {item.product.reference || '—'}
                    </span>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded font-bold text-[11px]">
                      {item.product.stock} en stock
                    </span>
                    <span className="text-emerald-800 font-extrabold text-[12px]">
                      {formatCHF(item.ca)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. MESSAGES CIBLÉS & COACHING ESTHÉTIQUE POUR EMMANUELLE ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3">
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Flame size={16} className="text-accent" />
            Messages Ciblés & Recommandations du Coach
          </h2>
          <span className="text-xs text-stone-500">
            Conseils personnalisés selon votre stock et vos rendez-vous
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Carte 1 : Alertes Stock et Réassort */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <AlertTriangle className="text-amber-500" size={17} />
              <span>Priorités Stock & Ruptures</span>
            </div>

            <div className="space-y-2 text-xs">
              {stockStats.ruptures.length > 0 ? (
                <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 text-red-900">
                  <p className="font-bold flex items-center gap-1 text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                    {stockStats.ruptures.length} produit{stockStats.ruptures.length > 1 ? 's' : ''} en rupture totale :
                  </p>
                  <p className="text-[11px] text-red-800 mt-1 line-clamp-2">
                    {stockStats.ruptures.map(p => p.nom).join(', ')}
                  </p>
                  <p className="text-[10.5px] text-red-700 mt-1 italic">
                    → Prévoyez une commande Coskyn pour ne pas bloquer les ventes conseil post-soin.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11.5px]">
                  ✓ Aucune rupture critique sur vos produits vente.
                </div>
              )}

              {stockStats.bas.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
                  <p className="font-bold flex items-center gap-1 text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
                    {stockStats.bas.length} produit{stockStats.bas.length > 1 ? 's' : ''} sous le seuil d&apos;alerte :
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Proposez-les en priorité aux 2 prochaines clientes !
                  </p>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-[11px]">
                💡 <strong>Conseil réassort :</strong> Vos commandes Coskyn sont généralement livrées sous 48h. Anticipez votre commande dès qu&apos;une référence phare passe à 1 exemplaire.
              </div>
            </div>
          </div>

          {/* Carte 2 : La Méthode "Panier 250 - 450 CHF" */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <ShoppingBag className="text-emerald-700" size={17} />
              <span>La Formule Panier 250 – 450 CHF</span>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-stone-600 text-[11.5px] leading-relaxed">
                Comment atteindre facilement 350 CHF par cliente sans forcer la vente ?
              </p>

              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1 text-[11.5px]">
                <div className="flex justify-between gap-3 font-semibold">
                  <span>1. Soin Expert Cabine</span>
                  <span>140 – 180 CHF</span>
                </div>
                <div className="flex justify-between gap-3 text-stone-700">
                  <span>+ 1 Crème hydratante / anti-âge</span>
                  <span>75 – 110 CHF</span>
                </div>
                <div className="flex justify-between gap-3 text-stone-700">
                  <span>+ 1 Sérum Oligoforce ou Nettoyant</span>
                  <span>45 – 105 CHF</span>
                </div>
                <div className="pt-1 border-t border-emerald-200 flex justify-between gap-3 font-extrabold text-emerald-900 text-xs">
                  <span>= Panier Total Moyen</span>
                  <span>260 – 395 CHF</span>
                </div>
              </div>

              <p className="text-[11px] text-stone-600 leading-snug">
                <strong>Le secret d&apos;Emmanuelle :</strong> Rédigez une ordonnance de soin personnalisée de 2 minutes pendant la tisane de fin de soin. Le taux de transformation dépasse alors 60 %.
              </p>
            </div>
          </div>

          {/* Carte 3 : Les 4 Réflexes en Cabine */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
              <Sparkles className="text-purple-700" size={17} />
              <span>Les 4 Réflexes Post-Soin</span>
            </div>

            <ul className="space-y-2 text-xs text-stone-700">
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                <span className="text-[11.5px]"><strong>Faire tester la texture</strong> sur le dos de la main de la cliente dès la fin du modelage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                <span className="text-[11.5px]"><strong>Nommer les actifs marins</strong> pendant la pose du masque (ex: Oligomer®, eau d&apos;ajonc).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                <span className="text-[11.5px]"><strong>Prescrire, ne pas vendre</strong> : « Pour conserver cet éclat pendant 4 semaines, appliquez ceci matin et soir ».</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                <span className="text-[11.5px]"><strong>Glisser 2 échantillons ciblés</strong> dans son sac pour amorcer le prochain achat.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── 4. SIMULATEUR INTERACTIF DE REVENU & AVS (CANTON DE VAUD) ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="text-emerald-700" size={18} />
              <h2 className="text-base font-bold text-stone-900">
                Simulateur Interactif de Rentabilité & Rémunération
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Ajustez vos hypothèses d&apos;activité pour visualiser votre chiffre d&apos;affaires et votre revenu net d&apos;indépendante (après cotisations AVS Vaud).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold">
            Barème AVS Vaud 2026 inclus
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Curseurs de réglage */}
          <div className="lg:col-span-6 space-y-5">
            {/* Curseur Clientes par jour */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-0.5 mb-1.5">
                <label className="text-xs font-semibold text-stone-800">
                  Clientes par jour : <span className="text-emerald-800 text-sm font-bold">{simClientesJour} cliente{simClientesJour > 1 ? 's' : ''} / jour</span>
                </label>
                <span className="text-[11px] text-stone-500">Cible à terme : 2</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={simClientesJour}
                onChange={e => setSimClientesJour(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
              />
              <div className="flex flex-wrap justify-between gap-x-3 text-[10px] text-stone-400 mt-1">
                <span>1 (démarrage)</span>
                <span className="font-bold text-emerald-800">2 (rythme cible)</span>
                <span>3</span>
                <span>4 (rythme max)</span>
              </div>
            </div>

            {/* Curseur Jours travaillés */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-0.5 mb-1.5">
                <label className="text-xs font-semibold text-stone-800">
                  Jours d&apos;ouverture par semaine : <span className="text-emerald-800 text-sm font-bold">{simJoursSemaine} jours</span>
                </label>
                <span className="text-[11px] text-stone-500">{simClientesJour * simJoursSemaine} clientes / semaine</span>
              </div>
              <input
                type="range"
                min="3"
                max="6"
                step="1"
                value={simJoursSemaine}
                onChange={e => setSimJoursSemaine(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
              />
              <div className="flex flex-wrap justify-between gap-x-3 text-[10px] text-stone-400 mt-1">
                <span>3 jours</span>
                <span>4 jours</span>
                <span className="font-bold text-emerald-800">5 jours (Mar - Sam)</span>
                <span>6 jours</span>
              </div>
            </div>

            {/* Curseur Panier Moyen */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-0.5 mb-1.5">
                <label className="text-xs font-semibold text-stone-800">
                  Panier moyen par cliente : <span className="text-emerald-800 text-sm font-bold">{formatCHF(simPanierMoyen)}</span>
                </label>
                <span className="text-[11px] text-stone-500">Fourchette : 250 à 450 CHF</span>
              </div>
              <input
                type="range"
                min="150"
                max="500"
                step="25"
                value={simPanierMoyen}
                onChange={e => setSimPanierMoyen(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
              />
              <div className="flex flex-wrap justify-between gap-x-3 text-[10px] text-stone-400 mt-1">
                <span>150 CHF (Soin seul)</span>
                <span className="font-semibold text-emerald-700">250 CHF (Soin + 1 produit)</span>
                <span className="font-bold text-emerald-800">350 CHF (Soin + Routine)</span>
                <span>450 CHF (Haute gamme)</span>
              </div>
            </div>
          </div>

          {/* Résultats projetés */}
          <div className="lg:col-span-6 bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider block">
                Projection Financière Réalisable
              </span>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 text-xs">
                <div className="p-3 min-w-0 bg-white rounded-xl border border-stone-200">
                  <span className="text-stone-500 text-[11px]">CA Hebdomadaire</span>
                  <p className="text-base sm:text-lg font-bold text-stone-950 mt-0.5 break-words">{formatCHF(simResults.caSemaine)}</p>
                  <p className="text-[10.5px] text-stone-400">sur {simResults.clientesSemaine} clientes</p>
                </div>

                <div className="p-3 min-w-0 bg-white rounded-xl border border-stone-200">
                  <span className="text-stone-500 text-[11px]">CA Mensuel Estimé</span>
                  <p className="text-base sm:text-lg font-bold text-stone-950 mt-0.5 break-words">{formatCHF(simResults.caMois)}</p>
                  <p className="text-[10.5px] text-stone-400">base 4.2 semaines</p>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/80 min-w-0 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-emerald-950 font-bold">
                  <span>Rémunération Nette Mensuelle Estimée</span>
                  <span className="text-sm font-extrabold text-emerald-800">
                    {formatCHF(simResults.remunerationNetteMensuelle)} / mois
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Après déduction du coût matières (produits cabine + revente), des charges de fonctionnement de l&apos;institut (~20&apos;000 CHF/an) et de la provision pour cotisations AVS ({formatCHF(Math.round(simResults.avsAnnuel / 12))}/mois).
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="text-stone-500 text-[11px]">Chiffre d&apos;affaires annuel projeté :</span>
              <span className="font-bold text-stone-900">{formatCHF(simResults.caAn)} / an</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
