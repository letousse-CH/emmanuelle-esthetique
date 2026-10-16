"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Package, CheckCircle2, ShoppingBag, ArrowRight,
  Lightbulb, Sliders, ChevronDown, Target, TrendingUp, TrendingDown,
} from 'lucide-react';
import { AnimatedNumber, Button, Callout, LinkButton, Metric, MetricStrip, ProgressBar, SectionHeading } from '../../../../components/admin/ui';
import { listProducts, listTransactions } from '../../../../services/caisse';
import { Product, TransactionWithItems, coutAchat, formatCHF, stockLevel, isVenteProduct, recetteEncaissee } from '../../../../types/caisse';
import { useSettings } from '../../../../hooks/useSettings';
import { computeAvsIndependant } from '../../../../types/finance';

export default function CockpitClient() {
  const settings = useSettings(['caisse_tva_assujetti']);
  // Non assujettie : la TVA payée au fournisseur fait partie du coût.
  const tvaRecuperable = settings.caisse_tva_assujetti === 'true';
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  // Paramètres du simulateur interactif
  const [simClientesJour, setSimClientesJour] = useState(2);
  const [simJoursSemaine, setSimJoursSemaine] = useState(5);
  const [simPanierMoyen, setSimPanierMoyen] = useState(350);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true); setLoadError(null);
    try {
      // Du 1er du mois précédent à la fin du mois en cours : le mois affiché,
      // plus de quoi le comparer au précédent à la même date.
      const now = new Date();
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const [prods, txs] = await Promise.all([
        listProducts(true),
        listTransactions(prevStart.toISOString(), monthEnd.toISOString()),
      ]);

      setProducts(prods.filter(isVenteProduct));
      setTransactions(txs);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  // ── Données Stock Boutique Vente & CA Potentiel ─────────────────────────────
  const stockStats = useMemo(() => {
    const actifs = products.filter(p => p.active);
    const totalUnites = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)), 0);
    const valeurAchat = actifs.reduce((acc, p) => acc + Math.max(0, Number(p.stock || 0)) * coutAchat(p, tvaRecuperable), 0);
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
        marge: Number(p.stock || 0) * (Number(p.prix_vente_chf || 0) - coutAchat(p, tvaRecuperable)),
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
  }, [products, tvaRecuperable]);

  // ── Le mois en cours, jour par jour ─────────────────────────────────────────
  const month = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();
    const inMonth = (d: Date, yy: number, mm: number) => d.getFullYear() === yy && d.getMonth() === mm;

    const daily = Array.from({ length: dim }, () => 0);
    let caTotal = 0;
    let prevToDate = 0;
    const visites: number[] = [];

    for (const t of transactions) {
      if (t.status === 'annulee') continue;
      const d = new Date(t.created_at);
      // CA = recettes encaissées (règle du module) : un soin réglé par bon cadeau
      // a été encaissé à la vente du bon, il ne compte pas une seconde fois.
      const r = recetteEncaissee(t);
      if (inMonth(d, y, m)) {
        daily[d.getDate() - 1] += r;
        caTotal += r;
        // Une cliente accueillie = un passage avec soin ou produit ; acheter
        // seulement un bon cadeau n'est pas une visite. Le panier mesure ce
        // qu'elle a reçu (soins + produits), quelle que soit la façon de payer.
        const items = t.transaction_items.filter(i => !i.gift_card_id);
        if (items.length > 0) visites.push(items.reduce((acc, i) => acc + Number(i.total_ttc || 0), 0));
      } else if (inMonth(d, m === 0 ? y - 1 : y, (m + 11) % 12) && d.getDate() <= Math.min(today, prevDim)) {
        prevToDate += r;
      }
    }

    const clientesCount = visites.length;
    const panierMoyen = clientesCount > 0 ? Math.round((visites.reduce((a, v) => a + v, 0) / clientesCount) * 10) / 10 : 0;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const label = now.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
    const prevLabel = new Date(y, m - 1, 1).toLocaleDateString('fr-CH', { month: 'long' });

    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      prevLabel,
      today,
      dim,
      caTotal: r2(caTotal),
      prevToDate: r2(prevToDate),
      clientesCount,
      panierMoyen,
      days: daily.map((amount, i) => {
        const d = new Date(y, m, i + 1);
        return {
          day: i + 1,
          amount: r2(amount),
          isToday: i + 1 === today,
          isFuture: i + 1 > today,
          long: d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'long' }),
        };
      }),
    };
  }, [transactions]);

  // Cibles : le cap de la semaine (2 clientes par jour, 10 par semaine, panier
  // de 250 à 450 CHF) ramené à la longueur du mois.
  const CIBLE_CLIENTES_HEBDO = 10;
  const CIBLE_PANIER_MIN = 250;
  const CIBLE_PANIER_MAX = 450;
  const CIBLE_PANIER_MOYEN = 350;
  const semainesDuMois = month.dim / 7;
  const CIBLE_CLIENTES_MOIS = Math.round(CIBLE_CLIENTES_HEBDO * semainesDuMois);
  const CIBLE_CA_MOIS = Math.round((CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MOYEN * semainesDuMois) / 100) * 100; // ≈ 15'500 CHF sur 31 jours
  const CIBLE_CA_SEUIL = Math.round((CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MIN * semainesDuMois) / 100) * 100; // ≈ 11'100 CHF

  // Pourcentage d'atteinte de l'objectif de chiffre d'affaires
  const pctCA = Math.min(100, Math.round((month.caTotal / CIBLE_CA_MOIS) * 100));
  // À ce rythme : le CA du mois prolongé jusqu'au dernier jour.
  const projection = month.today > 0 ? Math.round((month.caTotal / month.today) * month.dim) : 0;
  const deltaPrev = month.prevToDate > 0 ? Math.round(((month.caTotal - month.prevToDate) / month.prevToDate) * 100) : null;

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

  // Un seul outil ouvert à la fois : la page reste courte.
  const [panel, setPanel] = useState<ToolId | null>(null);
  const togglePanel = (id: ToolId) => setPanel((p) => (p === id ? null : id));

  const resteCA = Math.max(0, CIBLE_CA_MOIS - month.caTotal);
  const clientesManquantes = Math.max(0, CIBLE_CLIENTES_MOIS - month.clientesCount);
  // Le chemin le plus parlant vers l'objectif : le panier qu'il faudrait aux clientes qui manquent.
  const panierNecessaire = clientesManquantes > 0 ? Math.ceil(resteCA / clientesManquantes) : 0;

  const panier =
    month.clientesCount === 0
      ? { text: 'Pas encore de passage ce mois-ci.', tone: 'muted' as const }
      : month.panierMoyen > CIBLE_PANIER_MAX
        ? { text: 'Au-dessus de la fourchette visée : bravo.', tone: 'good' as const }
        : month.panierMoyen >= CIBLE_PANIER_MIN
          ? { text: 'Dans la fourchette visée.', tone: 'good' as const }
          : { text: `Il manque ${formatCHF(CIBLE_PANIER_MIN - month.panierMoyen)} par cliente : un produit conseil suffit.`, tone: 'warn' as const };

  const tools: { id: ToolId; label: string; summary: string; icon: React.ElementType }[] = [
    { id: 'stock', label: 'Potentiel du stock', summary: `${formatCHF(stockStats.caPotentiel)} de produits en rayon`, icon: Package },
    { id: 'conseils', label: 'Conseils de vente', summary: 'Le panier type et les 4 réflexes après le soin', icon: Lightbulb },
    { id: 'simulateur', label: 'Simulateur de revenu', summary: 'Votre revenu net selon le rythme de travail', icon: Sliders },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
      {/* ── En-tête ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-stone-500">{month.label} · jour {month.today} sur {month.dim}</p>
          <h1 className="sr-only mt-1 text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only lg:block">Cockpit</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Le cap : 2 clientes par jour et un panier de 250 à 450 CHF.
          </p>
        </div>
      </header>

      {loadError && (
        <Callout
          tone="danger"
          title="Les ventes du mois n'ont pas pu être lues"
          actions={<Button size="sm" onClick={loadData}>Réessayer</Button>}
        >
          Les chiffres ci-dessous restent à zéro tant que la lecture échoue. Détail : {loadError}
        </Callout>
      )}

      {/* ── Le mois, en grand ── */}
      <section
        aria-label={`Objectifs du mois de ${month.label}`}
        className="grid gap-10 rounded-xl bg-growth p-6 sm:p-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14"
      >
        {/* Chiffre d'affaires du mois : LE chiffre de la page */}
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white">Chiffre d’affaires du mois</p>
          <p className="mt-3 text-[48px] font-semibold leading-none tracking-tight text-white tabular-nums sm:text-[64px]">
            {loading ? <span className="inline-block h-14 w-72 rounded-xl bg-white/30 animate-pulse" /> : <AnimatedNumber value={month.caTotal} format={formatCHF} />}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-white/90">
            <span>sur <span className="font-semibold text-white">{formatCHF(CIBLE_CA_MOIS)}</span> visés · <span className="font-semibold text-white">{pctCA} %</span></span>
            {deltaPrev !== null && (
              <span className="inline-flex items-center gap-1 font-semibold text-white">
                {deltaPrev >= 0 ? <TrendingUp size={16} aria-hidden="true" /> : <TrendingDown size={16} aria-hidden="true" />}
                {deltaPrev >= 0 ? '+' : '−'}{Math.abs(deltaPrev)} %
                <span className="font-normal text-white/90">vs {month.prevLabel} à la même date</span>
              </span>
            )}
          </p>
          <ProgressBar
            className="mt-6"
            size="lg"
            value={month.caTotal}
            max={CIBLE_CA_MOIS}
            marker={{ at: CIBLE_CA_SEUIL, label: 'seuil de rentabilité' }}
            label="Chiffre d’affaires du mois par rapport à l’objectif"
            onColor
          />

          {/* Jour par jour : la courbe */}
          <div className="mt-12">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[14px] font-medium text-white">Recettes jour par jour</p>
              {!loading && month.caTotal > 0 && (
                <p className="text-[13.5px] text-white/90">
                  À ce rythme : <span className="font-semibold text-white">{formatCHF(projection)}</span> en fin de mois
                </p>
              )}
            </div>
            <DailyCurve days={month.days} loading={loading} />
          </div>
        </div>

        {/* Ce qui fait le chiffre */}
        <div className="flex min-w-0 flex-col gap-10 border-t border-white/25 pt-10 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
          <div>
            <p className="text-[15px] font-medium text-white">Clientes accueillies</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[40px] font-semibold leading-none tracking-tight text-white tabular-nums">{loading ? '–' : <AnimatedNumber value={month.clientesCount} />}</span>
              <span className="text-[16px] text-white/90">sur {CIBLE_CLIENTES_MOIS}</span>
            </p>
            <ProgressBar
              className="mt-5"
              value={month.clientesCount}
              max={CIBLE_CLIENTES_MOIS}
              label={`${month.clientesCount} clientes sur ${CIBLE_CLIENTES_MOIS} visées ce mois-ci`}
              onColor
            />
            <p className="mt-3 text-[14px] text-white/90">
              {clientesManquantes === 0 ? 'Objectif de fréquentation atteint.' : `Encore ${clientesManquantes} pour l’objectif (2 par jour).`}
            </p>
          </div>

          <div>
            <p className="text-[15px] font-medium text-white">Panier moyen</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[40px] font-semibold leading-none tracking-tight text-white tabular-nums">{loading ? '–' : <AnimatedNumber value={month.panierMoyen} format={formatCHF} />}</span>
              <span className="text-[16px] text-white/90">par cliente</span>
            </p>
            <ProgressBar
              className="mt-5 mb-6"
              value={month.panierMoyen}
              max={600}
              zone={[CIBLE_PANIER_MIN, CIBLE_PANIER_MAX]}
              label="Panier moyen, la zone claire marque la fourchette visée de 250 à 450 CHF"
              onColor
            />
            <p className={`flex items-start gap-1.5 text-[14px] ${panier.tone === 'muted' ? 'text-white/90' : 'font-medium text-white'}`}>
              {panier.tone === 'good' && <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
              {panier.text}
            </p>
          </div>

          <p className="flex items-start gap-2 text-[15px] leading-snug text-white">
            {resteCA === 0 ? (
              <><CheckCircle2 size={19} className="mt-0.5 shrink-0" aria-hidden="true" /> Objectif du mois atteint.</>
            ) : (
              <><Target size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Encore <strong className="font-semibold">{formatCHF(resteCA)}</strong>
                  {clientesManquantes > 0
                    ? <> : avec les {clientesManquantes} cliente{clientesManquantes > 1 ? 's' : ''} qui manque{clientesManquantes > 1 ? 'nt' : ''}, un panier de <strong className="font-semibold">{formatCHF(panierNecessaire)}</strong> suffit.</>
                    : <> : un produit conseil de plus à chaque passage.</>}
                </span></>
            )}
          </p>
        </div>
      </section>

      {/* ── À surveiller : seulement s'il y a lieu ── */}
      {!loading && (stockStats.ruptures.length > 0 || stockStats.bas.length > 0) && (
        <section aria-labelledby="cockpit-watch" className="space-y-3">
          <SectionHeading id="cockpit-watch" title="À surveiller" />
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {stockStats.ruptures.length > 0 && (
              <WatchRow
                tone="danger"
                title={`${stockStats.ruptures.length} produit${stockStats.ruptures.length > 1 ? 's' : ''} en rupture`}
                detail={stockStats.ruptures.map((p) => p.nom).join(', ')}
              />
            )}
            {stockStats.bas.length > 0 && (
              <WatchRow
                tone="warn"
                title={`${stockStats.bas.length} produit${stockStats.bas.length > 1 ? 's' : ''} sous le seuil d’alerte`}
                detail="À proposer en priorité aux prochaines clientes, et à recommander."
              />
            )}
          </ul>
        </section>
      )}

      {/* ── Pour aller plus loin : à la demande ── */}
      <section aria-labelledby="cockpit-tools" className="space-y-3">
        <SectionHeading id="cockpit-tools" title="Pour aller plus loin" />
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {tools.map((t) => {
            const open = panel === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`cockpit-panel-${t.id}`}
                  onClick={() => togglePanel(t.id)}
                  className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-lg"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${open ? 'bg-warm text-warm-ink' : 'bg-warm-soft text-warm-ink group-hover:bg-warm-muted'}`}>
                    <t.icon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-stone-950">{t.label}</span>
                    <span className="block text-[14px] text-stone-600">{t.summary}</span>
                  </span>
                  <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-stone-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div id={`cockpit-panel-${t.id}`} className="pb-8 pt-2 sm:pl-15">
                    {t.id === 'stock' && <StockPanel stats={stockStats} />}
                    {t.id === 'conseils' && <ConseilsPanel stats={stockStats} />}
                    {t.id === 'simulateur' && (
                      <SimulateurPanel
                        clientesJour={simClientesJour} onClientesJour={setSimClientesJour}
                        joursSemaine={simJoursSemaine} onJoursSemaine={setSimJoursSemaine}
                        panierMoyen={simPanierMoyen} onPanierMoyen={setSimPanierMoyen}
                        results={simResults}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

type ToolId = 'stock' | 'conseils' | 'simulateur';
type StockStats = {
  references: number;
  totalUnites: number;
  caPotentiel: number;
  margePotentielle: number;
  ruptures: Product[];
  bas: Product[];
  topPotentiel: { product: Product; ca: number }[];
};

function WatchRow({ tone, title, detail }: { tone: 'danger' | 'warn'; title: string; detail: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
      <span className={`size-2.5 shrink-0 rounded-full ${tone === 'danger' ? 'bg-red-600' : 'bg-warm'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-stone-950">{title}</span>
        <span className="block truncate text-[14px] text-stone-600">{detail}</span>
      </span>
      <LinkButton size="sm" href="/admin/caisse/produits" icon={ArrowRight}>Voir les produits</LinkButton>
    </li>
  );
}

function StockPanel({ stats }: { stats: StockStats }) {
  return (
    <div className="space-y-6">
      <MetricStrip>
        <Metric size="lg" tone="warm" label="En rayon, au prix de vente" value={formatCHF(stats.caPotentiel)} />
        <Metric size="lg" label="Marge à réaliser" value={formatCHF(stats.margePotentielle)} />
        <Metric size="lg" label="Articles disponibles" value={stats.totalUnites} hint={`${stats.references} références`} />
      </MetricStrip>
      <p className="max-w-2xl text-[14.5px] leading-relaxed text-stone-700">
        Conseiller une routine (une crème et un sérum ou un nettoyant) à une cliente sur deux représente environ <strong>CHF 600 à 900 de plus par semaine</strong>, sans temps de cabine.
      </p>
      {stats.topPotentiel.length > 0 && (
        <div>
          <h3 className="mb-2 text-[14px] font-semibold text-stone-900">Les produits qui pèsent le plus en rayon</h3>
          <table className="w-full max-w-2xl text-[14px]">
            <tbody className="zebra">
              {stats.topPotentiel.map((item) => (
                <tr key={item.product.id}>
                  <td className="py-2 pr-3 font-medium text-stone-900">{item.product.nom}</td>
                  <td className="py-2 pr-3 text-right text-stone-500 tabular-nums whitespace-nowrap">{item.product.stock} en stock</td>
                  <td className="py-2 text-right font-semibold text-stone-950 tabular-nums whitespace-nowrap">{formatCHF(item.ca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LinkButton href="/admin/caisse/produits" size="sm" icon={ArrowRight}>Gérer les produits</LinkButton>
    </div>
  );
}

function ConseilsPanel({ stats }: { stats: StockStats }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-stone-950">
          <ShoppingBag size={17} className="text-warm-strong" aria-hidden="true" /> Le panier de 250 à 450 CHF
        </h3>
        <dl className="mt-3 divide-y divide-stone-100 text-[14.5px]">
          <div className="flex justify-between gap-3 py-2"><dt className="text-stone-800">Soin expert en cabine</dt><dd className="tabular-nums text-stone-900">140 – 180</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-stone-800">+ une crème hydratante ou anti-âge</dt><dd className="tabular-nums text-stone-900">75 – 110</dd></div>
          <div className="flex justify-between gap-3 py-2"><dt className="text-stone-800">+ un sérum Oligoforce ou un nettoyant</dt><dd className="tabular-nums text-stone-900">45 – 105</dd></div>
          <div className="flex justify-between gap-3 py-2 font-semibold"><dt className="text-stone-950">Panier moyen</dt><dd className="tabular-nums text-warm-ink">260 – 395 CHF</dd></div>
        </dl>
        <p className="mt-3 text-[14px] leading-relaxed text-stone-600">
          Rédiger une ordonnance de soin de deux minutes pendant la tisane de fin de soin.
        </p>
        {(stats.ruptures.length > 0 || stats.bas.length > 0) && (
          <p className="mt-4 text-[14px] leading-relaxed text-stone-600">
            Les commandes Coskyn arrivent en général sous 48 h : commander dès qu’une référence phare tombe à un exemplaire.
          </p>
        )}
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-stone-950">
          <Sparkles size={17} className="text-warm-strong" aria-hidden="true" /> Les 4 réflexes après le soin
        </h3>
        <ol className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-stone-700">
          {[
            ['Faire tester la texture', 'sur le dos de la main, dès la fin du modelage.'],
            ['Nommer les actifs marins', 'pendant la pose du masque (Oligomer®, eau d’ajonc).'],
            ['Prescrire, ne pas vendre', ': « Pour garder cet éclat quatre semaines, appliquez ceci matin et soir. »'],
            ['Glisser deux échantillons ciblés', 'dans son sac pour amorcer le prochain achat.'],
          ].map(([strong, rest], i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-warm-soft text-[12.5px] font-bold text-warm-ink">{i + 1}</span>
              <span><strong className="font-semibold text-stone-900">{strong}</strong> {rest}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function SimulateurPanel({
  clientesJour, onClientesJour, joursSemaine, onJoursSemaine, panierMoyen, onPanierMoyen, results,
}: {
  clientesJour: number; onClientesJour: (v: number) => void;
  joursSemaine: number; onJoursSemaine: (v: number) => void;
  panierMoyen: number; onPanierMoyen: (v: number) => void;
  results: { clientesSemaine: number; caSemaine: number; caMois: number; caAn: number; avsAnnuel: number; remunerationNetteMensuelle: number };
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-6">
        <SimSlider label="Clientes par jour" shown={`${clientesJour}`} hint="Cible : 2" min={1} max={4} step={1} value={clientesJour} onChange={onClientesJour} />
        <SimSlider label="Jours d’ouverture par semaine" shown={`${joursSemaine}`} hint={`${clientesJour * joursSemaine} clientes par semaine`} min={3} max={6} step={1} value={joursSemaine} onChange={onJoursSemaine} />
        <SimSlider label="Panier moyen" shown={formatCHF(panierMoyen)} hint="Cible : 250 à 450 CHF" min={150} max={500} step={25} value={panierMoyen} onChange={onPanierMoyen} />
      </div>
      <div>
        <p className="text-[14px] font-medium text-stone-600">Revenu net estimé</p>
        <p className="mt-1.5 text-[40px] font-semibold leading-none tracking-tight text-warm-ink tabular-nums">
          {formatCHF(results.remunerationNetteMensuelle)}<span className="ml-1 text-[18px] font-medium text-stone-500">/ mois</span>
        </p>
        <p className="mt-2 text-[13.5px] leading-snug text-stone-600">
          Après coût matières, charges de l’institut (~20&apos;000 CHF par an) et AVS ({formatCHF(Math.round(results.avsAnnuel / 12))} par mois, barème Vaud 2026).
        </p>
        <MetricStrip className="mt-8">
          <Metric size="md" label="Par semaine" value={formatCHF(results.caSemaine)} hint={`${results.clientesSemaine} clientes`} />
          <Metric size="md" label="Par mois" value={formatCHF(results.caMois)} hint="4.2 semaines" />
          <Metric size="md" label="Par an" value={formatCHF(results.caAn)} hint="48 semaines" />
        </MetricStrip>
      </div>
    </div>
  );
}

function SimSlider({
  label,
  shown,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  shown: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor={id} className="text-[14.5px] font-medium text-stone-800">{label}</label>
        <span className="text-[18px] font-semibold text-stone-950 tabular-nums">{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 cursor-pointer appearance-none rounded-lg bg-stone-200 accent-warm-strong"
      />
      <p className="mt-1.5 text-[12.5px] text-stone-500">{hint}</p>
    </div>
  );
}

/**
 * Courbe des recettes jour par jour sur l'aplat vert : une ligne blanche
 * lissée et son aire translucide, jusqu'à aujourd'hui ; les jours à venir en
 * pointillé. Le survol (ou le clavier) affiche la recette du jour.
 */
function DailyCurve({
  days,
  loading,
}: {
  days: { day: number; amount: number; isToday: boolean; isFuture: boolean; long: string }[];
  loading: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 100;
  const H = 40;
  const n = days.length;
  const past = days.filter((d) => !d.isFuture);
  const max = Math.max(...past.map((d) => d.amount), 1);
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : 0);
  const y = (v: number) => H - 1 - (v / max) * (H - 6);
  const pts = past.map((d, i) => [x(i), y(d.amount)] as const);

  // Catmull-Rom → Bézier : une ligne douce qui passe par chaque jour, sans
  // descendre sous la ligne de base.
  let line = '';
  pts.forEach(([px, py], i) => {
    if (i === 0) { line = `M ${px} ${py}`; return; }
    const [x0, y0] = pts[Math.max(0, i - 2)];
    const [x1, y1] = pts[i - 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 1)];
    const c1x = x1 + (px - x0) / 6, c1y = Math.min(H - 1, y1 + (py - y0) / 6);
    const c2x = px - (x3 - x1) / 6, c2y = Math.min(H - 1, py - (y3 - y1) / 6);
    line += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${px} ${py}`;
  });
  const last = pts[pts.length - 1];
  const area = last ? `${line} L ${last[0]} ${H} L 0 ${H} Z` : '';
  const empty = past.every((d) => d.amount === 0);
  // Repères : le 1er, tous les cinq jours, et le dernier s'il ne colle pas au précédent.
  const ticks = days.filter((d) => d.day === 1 || d.day % 5 === 0 || (d.day === n && n % 5 >= 3));
  const shown = hover !== null ? days[hover] : null;

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-white/15" />;

  return (
    <div className="relative">
      <div className="relative h-32">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="admin-reveal-x absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <line x1="0" x2={W} y1={H - 1} y2={H - 1} stroke="white" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />
          {last && last[0] < W && (
            <line x1={last[0]} x2={W} y1={H - 1} y2={H - 1} stroke="white" strokeOpacity="0.55" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          )}
          {!empty && area && <path d={area} fill="white" fillOpacity="0.16" />}
          {!empty && line && (
            <path d={line} fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* Point du jour et point survolé (en HTML : l'SVG étiré déformerait un cercle) */}
        {past.map((d, i) =>
          d.isToday || hover === i ? (
            <span
              key={d.day}
              className={`pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${hover === i ? 'bg-white' : 'bg-growth'}`}
              style={{ left: `${x(i)}%`, top: `${(y(d.amount) / H) * 100}%` }}
              aria-hidden="true"
            />
          ) : null,
        )}

        {/* Bulle de la recette survolée */}
        {shown && !shown.isFuture && (
          <span
            className={`pointer-events-none absolute z-10 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded bg-white px-2 py-1 text-[12.5px] font-semibold text-stone-950 shadow-md ${
              x(hover!) < 15 ? '-translate-x-3' : x(hover!) > 85 ? '-translate-x-[calc(100%-12px)]' : '-translate-x-1/2'
            }`}
            style={{ left: `${x(hover!)}%`, top: `${(y(shown.amount) / H) * 100}%` }}
          >
            {shown.long} · {formatCHF(shown.amount)}
          </span>
        )}

        {/* Zones de survol, une par jour écoulé */}
        <ol className="absolute inset-0 flex" aria-label="Recettes jour par jour">
          {days.map((d, i) => (
            <li key={d.day} className="h-full flex-1">
              {!d.isFuture && (
                <button
                  type="button"
                  className="h-full w-full cursor-default focus-visible:outline-none focus-visible:bg-white/10"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.long} : ${formatCHF(d.amount)}`}
                />
              )}
            </li>
          ))}
        </ol>

        {empty && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[14px] text-white/90">Pas encore de recette ce mois-ci.</p>
        )}
      </div>

      {/* Repères des jours */}
      <div className="relative mt-2 h-4 text-[12px] text-white/90" aria-hidden="true">
        {ticks.map((d) => (
          <span
            key={d.day}
            className={`absolute -translate-x-1/2 tabular-nums ${d.isToday ? 'font-semibold text-white' : ''}`}
            style={{ left: `${x(d.day - 1)}%` }}
          >
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}
