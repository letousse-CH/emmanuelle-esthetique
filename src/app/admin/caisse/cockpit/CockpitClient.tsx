"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Package, CheckCircle2, ShoppingBag, ArrowRight,
  Lightbulb, Sliders, RefreshCw, ChevronDown, Target,
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

  // Simulation affichée à la demande seulement : un lundi matin sans vente doit
  // montrer 0, jamais des chiffres inventés à la place des vrais.
  const [demoMode, setDemoMode] = useState(false);
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
      // Semaine en cours, du lundi 00:00 au dimanche 23:59 : une vente faite
      // un dimanche compte aussi.
      const monday = new Date();
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const [prods, txs] = await Promise.all([
        listProducts(true),
        listTransactions(monday.toISOString(), sunday.toISOString()),
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
    // CA = recettes encaissées (règle du module) : un soin réglé par bon cadeau
    // a été encaissé à la vente du bon, il ne compte pas une seconde fois.
    const caTotal = Math.round(validTxs.reduce((acc, t) => acc + recetteEncaissee(t), 0) * 100) / 100;
    // Une cliente accueillie = un passage avec soin ou produit ; acheter
    // seulement un bon cadeau n'est pas une visite. Le panier mesure ce qu'elle
    // a reçu (soins + produits), quelle que soit la façon dont elle a payé.
    const visites = validTxs
      .map(t => t.transaction_items.filter(i => !i.gift_card_id))
      .filter(items => items.length > 0)
      .map(items => items.reduce((acc, i) => acc + Number(i.total_ttc || 0), 0));
    const clientesCount = visites.length;
    const panierMoyen = clientesCount > 0
      ? Math.round((visites.reduce((a, v) => a + v, 0) / clientesCount) * 10) / 10
      : 0;

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
  const CIBLE_CA_CONFORT = CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MOYEN; // 3'500 CHF
  const CIBLE_CA_SEUIL = CIBLE_CLIENTES_HEBDO * CIBLE_PANIER_MIN; // 2'500 CHF

  // Pourcentage d'atteinte de l'objectif de chiffre d'affaires
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

  // ── Semaine jour par jour (lundi → dimanche, heure locale) ──────────────────
  const week = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const totals = new Map<string, number>();
    if (demoMode) {
      [540, 620, 0, 760, 820, 0, 0].forEach((v, i) => totals.set(key(days[i]), v));
    } else {
      for (const t of transactions) {
        if (t.status === 'annulee') continue;
        const k = key(new Date(t.created_at));
        totals.set(k, (totals.get(k) ?? 0) + recetteEncaissee(t));
      }
    }
    const todayKey = key(new Date());
    return {
      // « 12 au 18 octobre », ou « 28 septembre au 4 octobre » à cheval sur deux mois.
      label: days[0].getMonth() === days[6].getMonth()
        ? `${days[0].getDate()} au ${days[6].toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}`
        : `${days[0].toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} au ${days[6].toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })}`,
      days: days.map((d) => ({
        key: key(d),
        short: d.toLocaleDateString('fr-CH', { weekday: 'short' }).replace('.', ''),
        long: d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }),
        amount: Math.round((totals.get(key(d)) ?? 0) * 100) / 100,
        isToday: key(d) === todayKey,
        isPast: d.getTime() < new Date().setHours(0, 0, 0, 0),
      })),
    };
  }, [transactions, demoMode]);

  // Un seul outil ouvert à la fois : la page reste courte.
  const [panel, setPanel] = useState<ToolId | null>(null);
  const togglePanel = (id: ToolId) => setPanel((p) => (p === id ? null : id));

  const resteCA = Math.max(0, CIBLE_CA_CONFORT - weekStats.caTotal);
  const clientesManquantes = Math.max(0, CIBLE_CLIENTES_HEBDO - weekStats.clientesCount);
  // Le chemin le plus parlant vers l'objectif : le panier qu'il faudrait aux clientes qui manquent.
  const panierNecessaire = clientesManquantes > 0 ? Math.ceil(resteCA / clientesManquantes) : 0;

  const panier =
    weekStats.clientesCount === 0
      ? { text: 'Pas encore de passage cette semaine.', tone: 'muted' as const }
      : weekStats.panierMoyen > CIBLE_PANIER_MAX
        ? { text: 'Au-dessus de la fourchette visée : bravo.', tone: 'good' as const }
        : weekStats.panierMoyen >= CIBLE_PANIER_MIN
          ? { text: 'Dans la fourchette visée.', tone: 'good' as const }
          : { text: `Il manque ${formatCHF(CIBLE_PANIER_MIN - weekStats.panierMoyen)} par cliente : un produit conseil suffit.`, tone: 'warn' as const };

  const tools: { id: ToolId; label: string; summary: string; icon: React.ElementType }[] = [
    { id: 'stock', label: 'Potentiel du stock', summary: `${formatCHF(stockStats.caPotentiel)} de produits en rayon`, icon: Package },
    { id: 'conseils', label: 'Conseils de vente', summary: 'Le panier type et les 4 réflexes après le soin', icon: Lightbulb },
    { id: 'simulateur', label: 'Simulateur de revenu', summary: 'Votre revenu net selon le rythme de travail', icon: Sliders },
  ];

  const maxDay = Math.max(...week.days.map((d) => d.amount), 1);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
      {/* ── En-tête ── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-stone-500">Semaine du {week.label}</p>
          <h1 className="sr-only mt-1 text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only lg:block">Cockpit</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Le cap : 2 clientes par jour et un panier de 250 à 450 CHF.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => setDemoMode(!demoMode)}>
          {demoMode ? 'Revenir à mes chiffres' : 'Voir un exemple'}
        </Button>
      </header>

      {loadError && (
        <Callout
          tone="danger"
          title="Les ventes de la semaine n'ont pas pu être lues"
          actions={<Button size="sm" onClick={loadData}>Réessayer</Button>}
        >
          Les chiffres ci-dessous restent à zéro tant que la lecture échoue. Détail : {loadError}
        </Callout>
      )}
      {demoMode && (
        <Callout tone="warning">
          Chiffres d’exemple : ce ne sont pas vos ventes. « Revenir à mes chiffres » les rétablit.
        </Callout>
      )}

      {/* ── La semaine, en grand ── */}
      <section
        aria-label="Objectifs de la semaine"
        className="grid gap-10 rounded-xl bg-growth p-6 sm:p-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14"
      >
        {/* Chiffre d'affaires : LE chiffre de la page */}
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white">Chiffre d’affaires de la semaine</p>
          <p className="mt-3 text-[48px] font-semibold leading-none tracking-tight text-white tabular-nums sm:text-[64px]">
            {loading ? <span className="inline-block h-14 w-72 rounded-xl bg-white/30 animate-pulse" /> : <AnimatedNumber value={weekStats.caTotal} format={formatCHF} />}
          </p>
          <p className="mt-3 text-[15px] text-white/90">
            sur <span className="font-semibold text-white">{formatCHF(CIBLE_CA_CONFORT)}</span> visés · <span className="font-semibold text-white">{pctCA} %</span>
          </p>
          <ProgressBar
            className="mt-6"
            size="lg"
            value={weekStats.caTotal}
            max={CIBLE_CA_CONFORT}
            marker={{ at: CIBLE_CA_SEUIL, label: 'seuil de rentabilité' }}
            label="Chiffre d’affaires de la semaine par rapport à l’objectif"
            onColor
          />
          <p className="mt-10 flex items-start gap-2 text-[16px] leading-snug text-white">
            {resteCA === 0 ? (
              <><CheckCircle2 size={20} className="mt-0.5 shrink-0 text-white" aria-hidden="true" /> Objectif de la semaine atteint.</>
            ) : (
              <><Target size={20} className="mt-0.5 shrink-0 text-white" aria-hidden="true" />
                <span>
                  Encore <strong className="font-semibold">{formatCHF(resteCA)}</strong>
                  {clientesManquantes > 0
                    ? <> : avec les {clientesManquantes} cliente{clientesManquantes > 1 ? 's' : ''} qui manque{clientesManquantes > 1 ? 'nt' : ''}, un panier de <strong className="font-semibold">{formatCHF(panierNecessaire)}</strong> suffit.</>
                    : <> pour l’objectif : un produit conseil de plus à chaque passage.</>}
                </span></>
            )}
          </p>

          {/* Jour par jour */}
          <ol className="mt-8 grid grid-cols-7 items-end gap-2 sm:gap-3" aria-label="Recettes jour par jour">
            {week.days.map((d, i) => (
              <li key={d.key} className="flex flex-col items-center gap-1.5" title={`${d.long} : ${formatCHF(d.amount)}`}>
                <span className={`text-[11.5px] tabular-nums ${d.amount > 0 ? 'font-medium text-white' : 'text-transparent'}`}>
                  {Math.round(d.amount)}
                </span>
                <span className="flex h-16 w-full items-end justify-center">
                  <span
                    className={`admin-grow-y w-full max-w-10 rounded-md ${d.amount > 0 ? (d.isToday ? 'bg-white' : 'bg-white/60') : 'bg-white/20'}`}
                    style={{ height: d.amount > 0 ? `${Math.max(8, (d.amount / maxDay) * 100)}%` : '3px', animationDelay: `${120 + i * 40}ms` }}
                  />
                </span>
                <span className={`text-[12.5px] capitalize ${d.isToday ? 'font-semibold text-white' : 'text-white/90'}`}>{d.short}</span>
                <span className="sr-only">{d.long} : {formatCHF(d.amount)}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Les deux leviers */}
        <div className="flex min-w-0 flex-col gap-10 border-t border-white/25 pt-10 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
          <div>
            <p className="text-[15px] font-medium text-white">Clientes accueillies</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[40px] font-semibold leading-none tracking-tight text-white tabular-nums">{loading ? '–' : <AnimatedNumber value={weekStats.clientesCount} />}</span>
              <span className="text-[16px] text-white/90">sur {CIBLE_CLIENTES_HEBDO}</span>
            </p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${weekStats.clientesCount} clientes sur ${CIBLE_CLIENTES_HEBDO}`}>
              {Array.from({ length: Math.max(CIBLE_CLIENTES_HEBDO, weekStats.clientesCount) }, (_, i) => (
                <li
                  key={i}
                  aria-hidden="true"
                  className={`size-5 rounded-full ${i < weekStats.clientesCount ? 'admin-pop bg-white' : 'border-2 border-dashed border-white/45'}`}
                  style={i < weekStats.clientesCount ? { animationDelay: `${200 + i * 60}ms` } : undefined}
                />
              ))}
            </ul>
            <p className="mt-3 text-[14px] text-white/90">
              {clientesManquantes === 0 ? 'Objectif de fréquentation atteint.' : `Encore ${clientesManquantes} pour l’objectif.`}
            </p>
          </div>

          <div>
            <p className="text-[15px] font-medium text-white">Panier moyen</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[40px] font-semibold leading-none tracking-tight text-white tabular-nums">{loading ? '–' : <AnimatedNumber value={weekStats.panierMoyen} format={formatCHF} />}</span>
              <span className="text-[16px] text-white/90">par cliente</span>
            </p>
            <ProgressBar
              className="mt-5 mb-6"
              value={weekStats.panierMoyen}
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
