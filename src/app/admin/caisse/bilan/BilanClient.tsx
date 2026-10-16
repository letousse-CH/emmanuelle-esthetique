"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PieChart, TrendingUp, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Printer, HelpCircle, FileCheck, CheckCircle2, Building, RefreshCw,
  Coins, Sparkles, AlertCircle, Landmark, Receipt,
} from 'lucide-react';
import { AnimatedNumber, Button, Callout, Metric } from '../../../../components/admin/ui';
import { computeFinancialStats } from '../../../../services/financeService';
import { AVS_BORNE_HAUTE, FinancialDashboardStats } from '../../../../types/finance';
import { formatCHF } from '../../../../types/caisse';

export default function BilanClient() {
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<FinancialDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'compte_resultat' | 'tresorerie' | 'avs' | 'impots_vaud'>('compte_resultat');

  useEffect(() => {
    loadStats();
  }, [annee]);

  // Exercices proposés : de l'année en cours jusqu'à 2026, premier exercice de la caisse.
  const annees = Array.from({ length: Math.max(1, new Date().getFullYear() - 2026 + 1) }, (_, i) => new Date().getFullYear() - i);

  const loadStats = async () => {
    setLoading(true); setError(null);
    try {
      const data = await computeFinancialStats(annee);
      setStats(data);
    } catch (err) {
      // Jamais de bilan à zéro faute de lecture : on le dit.
      setStats(null);
      setError(err instanceof Error ? err.message : 'Calcul impossible.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Callout
          tone="danger"
          title="Le bilan n'a pas pu être calculé"
          actions={<Button size="sm" onClick={loadStats}>Réessayer</Button>}
        >
          <p>Vérifiez la connexion internet puis réessayez. Aucun chiffre n&apos;est affiché plutôt qu&apos;un chiffre faux.</p>
          <p className="mt-1 text-[13px] text-red-800/80 break-words">Détail technique : {error}</p>
        </Callout>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="p-12 text-center text-sm text-stone-500">
          Calcul des agrégats comptables et fiscaux en cours…
        </div>
      </div>
    );
  }

  const arreteLabel = stats.stockFinAujourdhui
    ? `à ce jour (${new Date().toLocaleDateString('fr-CH')})`
    : `au 31.12.${annee}`;

  return (
    <div className="space-y-6">

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[14px] font-medium text-stone-500">Exercice {annee}</p>
          <h1 className="sr-only mt-0.5 text-[30px] font-semibold leading-tight tracking-tight text-stone-950 lg:not-sr-only lg:block">Bilan et fiscalité</h1>
          <p className="mt-1 text-[15px] text-stone-600">
            Compte de résultat, trésorerie, cotisations AVS et chiffres prêts pour la déclaration vaudoise.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            aria-label="Exercice"
            className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-[14px] font-semibold text-stone-900 outline-none focus:border-accent cursor-pointer"
          >
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button variant="ghost" icon={RefreshCw} onClick={loadStats} aria-label="Actualiser" title="Actualiser" />
          <Button icon={Printer} onClick={() => window.print()}>Imprimer</Button>
        </div>
      </header>

      {/* Ce qui reste, en grand ; d'où ça vient, à côté */}
      <section
        aria-label={`Synthèse de l'exercice ${annee}`}
        className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-12"
      >
        {/* Vert quand l'exercice est bénéficiaire, brique quand il est en perte. */}
        <div className={`rounded-xl p-6 lg:p-8 ${stats.beneficeNetFiscal >= 0 ? 'bg-growth' : 'bg-red-600'}`}>
          <p className="text-[15px] font-medium text-white">Bénéfice net</p>
          <p className={`mt-2 text-[44px] font-semibold leading-none tracking-tight tabular-nums lg:text-[52px] text-white`}>
            <AnimatedNumber value={stats.beneficeNetFiscal} format={formatCHF} />
          </p>
          <p className="mt-3 text-[14px] text-white">Revenu d’indépendante imposable (ACI)</p>
        </div>
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Metric
            size="md"
            label="Chiffre d’affaires"
            value={formatCHF(stats.chiffreAffairesTotal)}
            hint={<>Soins {formatCHF(stats.caPrestations)} · boutique {formatCHF(stats.caProduitsVente)}{stats.caBonsCadeaux > 0 && <> · bons {formatCHF(stats.caBonsCadeaux)}</>}</>}
          />
          <Metric size="md" label="Marge brute" value={formatCHF(stats.margeBruteTotale)} hint={`${stats.margeBrutePct} % du chiffre d’affaires`} />
          <Metric
            size="md"
            tone={stats.soldeTresoreriePeriode >= 0 ? 'default' : 'negative'}
            label="Trésorerie"
            value={formatCHF(stats.soldeTresoreriePeriode)}
            hint="encaissé − décaissé"
          />
        </dl>
      </section>

      {/* Onglets */}
      <div role="tablist" aria-label="Rubriques du bilan" className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-stone-100 p-1 print:hidden">
        {([
          { id: 'compte_resultat', label: 'Compte de résultat', icon: PieChart },
          { id: 'tresorerie', label: 'Trésorerie et prélèvements', icon: Wallet },
          { id: 'avs', label: `AVS (${stats.estimationAvs.tauxPct} %)`, icon: Coins },
          { id: 'impots_vaud', label: 'Impôts Vaud', icon: Landmark },
        ] as const).map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[14px] transition-colors cursor-pointer ${
              activeTab === t.id ? 'bg-stone-900 font-semibold text-white' : 'font-medium text-stone-600 hover:text-stone-950'
            }`}
          >
            <t.icon size={16} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── 1. COMPTE DE RÉSULTAT (P&L) ────────────────────────────────────── */}
      {activeTab === 'compte_resultat' && (
        <div className="bg-stone-50 rounded-xl overflow-hidden text-xs">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">
              Compte de Résultat Synthétique — Année {annee} (Plan Comptable Suisse)
            </h3>
            <span className="text-stone-500 text-[11px]">En Francs Suisses (CHF)</span>
          </div>

          <div className="divide-y divide-stone-100">
            {/* Chiffre d'affaires */}
            <div className="p-4 bg-emerald-50/40">
              <div className="flex justify-between font-bold text-stone-900 text-sm">
                <span>1. CHIFFRE D'AFFAIRES BRUT (REVENUS D'EXPLOITATION)</span>
                <span className="text-emerald-800">{formatCHF(stats.chiffreAffairesTotal)}</span>
              </div>
              <div className="mt-2 space-y-1 pl-4 text-stone-600">
                <div className="flex justify-between">
                  <span>· Prestations de soins & esthétique en cabine</span>
                  <span>{formatCHF(stats.caPrestations)}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Ventes de produits boutique (cosmétiques revente)</span>
                  <span>{formatCHF(stats.caProduitsVente)}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Bons cadeaux vendus (encaissés à la vente, soins à venir)</span>
                  <span>{formatCHF(stats.caBonsCadeaux)}</span>
                </div>
                <p className="text-[11px] text-stone-500 pt-1">
                  Recettes réellement encaissées : un soin réglé par bon cadeau n&apos;y figure pas une seconde fois.
                </p>
              </div>
            </div>

            {/* Coût matières */}
            <div className="p-4">
              <div className="flex justify-between font-bold text-stone-900 text-sm">
                <span>2. COÛTS DES MATIÈRES & MARCHANDISES</span>
                <span className="text-red-700">− {formatCHF(stats.coutMatiereTotal)}</span>
              </div>
              <div className="mt-2 space-y-1 pl-4 text-stone-600">
                <div className="flex justify-between">
                  <span>· Achats de marchandises destinées à la vente (compte 4000)</span>
                  <span>{formatCHF(stats.achatsMarchandisesBoutique)}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Achats de produits cabine & matières premières (compte 4200 - Coskyn Phytomer)</span>
                  <span>{formatCHF(stats.achatsCabineMatieres)}</span>
                </div>
                <div className="flex justify-between">
                  <span>· Consommables & matériel de soin (compte 4400 - draps, parathermique)</span>
                  <span>{formatCHF(stats.consommablesMatériel)}</span>
                </div>
                <div className="flex justify-between font-semibold text-stone-800 pt-1">
                  <span>Achats de l&apos;exercice (date de la facture, payée ou non)</span>
                  <span>{formatCHF(stats.achatsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    · Variation des stocks : stock {arreteLabel} {formatCHF(stats.stockFin.total)} − stock au 01.01.{annee} {formatCHF(stats.stockDebut.total)}
                  </span>
                  <span>{stats.variationStockEstimee >= 0 ? '− ' : '+ '}{formatCHF(Math.abs(stats.variationStockEstimee))}</span>
                </div>
                <p className="text-[11px] text-stone-500 pt-1 leading-relaxed">
                  Ce qui reste en rayon n&apos;est pas une charge de l&apos;exercice : c&apos;est un stock, valorisé au prix
                  d&apos;achat, TVA non récupérable comprise (CO art. 960a). Le chiffre vient du
                  stock enregistré : faites l&apos;inventaire au 31 décembre (Produits › Stock › Inventaire) pour qu&apos;il soit juste.
                  La fiduciaire peut y appliquer la réserve fiscale d&apos;un tiers admise sur les marchandises.
                </p>
                {stats.stockNegatifs.length > 0 && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                    Stock négatif (compté pour zéro, à inventorier) : {stats.stockNegatifs.join(', ')}.
                  </p>
                )}
              </div>
            </div>

            {/* Marge brute */}
            <div className="p-4 bg-stone-50 font-bold flex justify-between text-sm text-stone-900">
              <span>= MARGE BRUTE D'EXPLOITATION</span>
              <span className="text-emerald-800">{formatCHF(stats.margeBruteTotale)} ({stats.margeBrutePct} %)</span>
            </div>

            {/* Charges d'exploitation */}
            <div className="p-4">
              <div className="flex justify-between font-bold text-stone-900 text-sm">
                <span>3. AUTRES CHARGES D'EXPLOITATION (GROUPE 6)</span>
                <span className="text-red-700">− {formatCHF(stats.chargesExploitationTotal)}</span>
              </div>
              <div className="mt-2 space-y-1 pl-4 text-stone-600">
                {Object.entries(stats.detailsCharges).length > 0 ? (
                  Object.entries(stats.detailsCharges).map(([label, montant], idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>· {label}</span>
                      <span>{formatCHF(montant)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 italic">Aucune charge d'exploitation enregistrée pour cet exercice.</p>
                )}
              </div>
            </div>

            {/* Résultat d'exploitation avant AVS */}
            <div className="p-4 bg-stone-50 font-bold flex justify-between text-sm text-stone-900">
              <span>= RÉSULTAT D'EXPLOITATION AVANT COTISATIONS SOCIALES</span>
              <span>{formatCHF(stats.resultatExploitationAvantAvs)}</span>
            </div>

            {/* Cotisations AVS */}
            <div className="p-4">
              <div className="flex justify-between font-bold text-stone-900 text-sm">
                <span>4. COTISATIONS SOCIALES AVS / AI / APG (DÉDUCTIBLES)</span>
                <span className="text-stone-700">
                  − {formatCHF(stats.cotisationsAvsPayees > 0 ? stats.cotisationsAvsPayees : stats.estimationAvs.totalAnnuel)}
                </span>
              </div>
              <div className="mt-2 space-y-1 pl-4 text-stone-600">
                <div className="flex justify-between">
                  <span>· Cotisations effectives payées (compte 5000)</span>
                  <span>{formatCHF(stats.cotisationsAvsPayees)}</span>
                </div>
                {stats.cotisationsAvsPayees === 0 && (
                  <div className="flex justify-between text-stone-500 italic">
                    <span>· Estimation selon barème dégressif vaudois ({stats.estimationAvs.tauxPct} %)</span>
                    <span>{formatCHF(stats.estimationAvs.totalAnnuel)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bénéfice net fiscal */}
            <div className="p-5 bg-emerald-50/70 border-t-2 border-emerald-600 font-extrabold flex justify-between text-base text-emerald-950">
              <span>= BÉNÉFICE NET DE L'EXERCICE (REVENU D'INDÉPENDANTE FISCAL)</span>
              <span>{formatCHF(stats.beneficeNetFiscal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. TRÉSORERIE & RÉMUNÉRATION ──────────────────────────────────── */}
      {activeTab === 'tresorerie' && (
        <div className="space-y-4">
          <div className="bg-stone-50 p-6 rounded-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Wallet size={18} className="text-accent" />
              Pilotage des Flux Réels de Trésorerie (Banque & Caisse)
            </h3>
            <p className="text-stone-600 text-xs">
              La trésorerie mesure l'argent réellement disponible sur votre compte bancaire et dans la caisse physique, après encaissement des clientes et paiement effectif de vos factures et prélèvements.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-medium text-emerald-800 text-xs uppercase tracking-wider">Encaissements Réels</p>
                <p className="text-2xl font-bold text-emerald-950 mt-1">{formatCHF(stats.totalEncaissementsReels)}</p>
                <p className="text-[11.5px] text-emerald-700 mt-1">Recettes espèces, cartes & TWINT</p>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="font-medium text-red-800 text-xs uppercase tracking-wider">Décaissements Réels</p>
                <p className="text-2xl font-bold text-red-950 mt-1">− {formatCHF(stats.totalDecaissementsReels)}</p>
                <p className="text-[11.5px] text-red-700 mt-1">Versements aux fournisseurs, à la date de chaque versement</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <p className="font-medium text-purple-800 text-xs uppercase tracking-wider">Prélèvements Exploitante</p>
                <p className="text-2xl font-bold text-purple-950 mt-1">{formatCHF(stats.prelevementsExploitant)}</p>
                <p className="text-[11.5px] text-purple-700 mt-1">Rémunération nette prélevée</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between font-bold text-sm">
              <span className="text-stone-800">Solde net de trésorerie sur la période :</span>
              <span className={stats.soldeTresoreriePeriode >= 0 ? 'text-emerald-700 text-base' : 'text-red-700 text-base'}>
                {formatCHF(stats.soldeTresoreriePeriode)}
              </span>
            </div>
          </div>

          <div className="bg-stone-50 p-6 rounded-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Building size={18} className="text-accent" />
              Situation {arreteLabel} : stock et dettes fournisseurs
            </h3>
            <p className="text-stone-600 text-xs">
              Ce que l&apos;institut possède et doit à la date d&apos;arrêté, hors liquidités. Une facture d&apos;achat payée en
              plusieurs fois compte en entier dans les charges ; ce qui n&apos;est pas encore versé est une dette envers le fournisseur.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-medium text-emerald-800 text-xs uppercase tracking-wider">Stock marchandises</p>
                <p className="text-2xl font-bold text-emerald-950 mt-1">{formatCHF(stats.stockFin.marchandises)}</p>
                <p className="text-[11.5px] text-emerald-700 mt-1">Produits destinés à la revente, au coût d&apos;achat</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <p className="font-medium text-stone-700 text-xs uppercase tracking-wider">Stock matières & cabine</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">{formatCHF(stats.stockFin.matieres)}</p>
                <p className="text-[11.5px] text-stone-600 mt-1">Produits cabine, consommables, testeurs</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-800 text-xs uppercase tracking-wider">Dettes fournisseurs</p>
                <p className="text-2xl font-bold text-amber-950 mt-1">{formatCHF(stats.dettesFournisseurs)}</p>
                <p className="text-[11.5px] text-amber-800 mt-1">Factures reçues, pas encore entièrement payées</p>
              </div>
            </div>
            {stats.dettesDetail.length > 0 && (
              <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
                {stats.dettesDetail.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3 px-4 py-2">
                    <span className="text-stone-700">
                      {d.fournisseur}{d.numero ? ` n° ${d.numero}` : ''} · facture du {new Date(`${d.date_facture}T12:00:00`).toLocaleDateString('fr-CH')}
                    </span>
                    <span className="font-semibold text-stone-900 tabular-nums">{formatCHF(d.reste)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── 3. COTISATIONS AVS VAUD ───────────────────────────────────────── */}
      {activeTab === 'avs' && (
        <div className="bg-stone-50 p-6 rounded-xl space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Coins size={18} className="text-amber-600" />
              Barème AVS/AI/APG des Indépendants — Canton de Vaud ({annee})
            </h3>
            <p className="text-stone-600 text-xs mt-1">
              En raison individuelle dans le canton de Vaud, vos cotisations sociales sont calculées sur votre bénéfice net d'exploitation selon un barème dégressif légal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
              <p className="font-medium text-stone-500 uppercase tracking-wide text-[11px]">Taux AVS/AI/APG applicable</p>
              <p className="text-3xl font-extrabold text-stone-900 mt-1">{stats.estimationAvs.tauxPct} %</p>
              <p className="text-[11.5px] text-stone-500 mt-1">
                {stats.resultatExploitationAvantAvs >= AVS_BORNE_HAUTE
                  ? 'Taux plein (dès CHF 60\'500)'
                  : stats.resultatExploitationAvantAvs <= 10100
                  ? 'Cotisation minimale (sous CHF 10\'100)'
                  : 'Barème dégressif progressif'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
              <p className="font-medium text-stone-500 uppercase tracking-wide text-[11px]">Cotisation annuelle estimée</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{formatCHF(stats.estimationAvs.totalAnnuel)}</p>
              <p className="text-[11.5px] text-stone-500 mt-1">Dont CHF {stats.estimationAvs.fraisAdmin} de frais d'administration caisse</p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
              <p className="font-bold text-amber-900 uppercase tracking-wide text-[11px]">Provision mensuelle conseillée</p>
              <p className="text-2xl font-extrabold text-amber-950 mt-1">{formatCHF(stats.estimationAvs.provisionMensuelle)} / mois</p>
              <p className="text-[11.5px] text-amber-800 mt-1">À mettre de côté sur un compte réserve</p>
            </div>
          </div>

          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-2">
            <h4 className="font-semibold text-stone-800">💡 Conseil de l'équipe stratégique :</h4>
            <p className="text-stone-600 leading-relaxed">
              Pour éviter les mauvaises surprises lors de la taxation définitive de la Caisse de compensation vaudoise (qui intervient souvent 1 à 2 ans plus tard), provisionnez chaque mois <strong>{formatCHF(stats.estimationAvs.provisionMensuelle)}</strong>. Si vos acomptes versés sont inférieurs, vous aurez la trésorerie prête sans impact sur votre sérénité.
            </p>
          </div>
        </div>
      )}

      {/* ── 4. DÉCLARATION IMPÔT ÉTAT DE VAUD ─────────────────────────────── */}
      {activeTab === 'impots_vaud' && (
        <div className="bg-stone-50 p-6 rounded-xl space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <Landmark size={18} className="text-stone-800" />
              Aide au Remplissage — Formulaire Fiscal Indépendant (État de Vaud)
            </h3>
            <p className="text-stone-600 text-xs mt-1">
              Reportez directement ces valeurs certifiées dans votre déclaration d'impôt personnes physiques vaudoise (Annexe pour activité lucrative indépendante).
            </p>
          </div>

          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Rubrique fiscale vaudoise</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4 text-right">Montant à déclarer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 1.1</td>
                  <td className="py-3 px-4 font-medium text-stone-900">Chiffre d'affaires brut (ventes + honoraires soins)</td>
                  <td className="py-3 px-4 text-right font-bold text-stone-900">{formatCHF(stats.chiffreAffairesTotal)}</td>
                </tr>
                <tr className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 2.1</td>
                  <td className="py-3 px-4 text-stone-700">
                    <div className="font-medium text-stone-900">Achats de marchandises et de matières premières</div>
                    <div className="text-[11px] text-stone-500 mt-0.5 space-y-0.5">
                      <div>· Revente boutique (compte 4000) : {formatCHF(stats.achatsMarchandisesBoutique)}</div>
                      <div>· Cabine & soins pro (compte 4200) : {formatCHF(stats.achatsCabineMatieres)}</div>
                      {stats.consommablesMatériel > 0 && (
                        <div>· Consommables & matériel (compte 4400) : {formatCHF(stats.consommablesMatériel)}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-stone-900">{formatCHF(stats.achatsTotal)}</td>
                </tr>
                <tr className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 2.2</td>
                  <td className="py-3 px-4 text-stone-700">
                    <div>Variation des stocks {arreteLabel} (stock de fin − stock de début)</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {formatCHF(stats.stockFin.total)} − {formatCHF(stats.stockDebut.total)} · à confirmer par l&apos;inventaire physique
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-stone-900">
                    {stats.variationStockEstimee >= 0 ? '− ' : '+ '}{formatCHF(Math.abs(stats.variationStockEstimee))}
                  </td>
                </tr>
                <tr className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 3.1</td>
                  <td className="py-3 px-4 text-stone-700">Cotisations sociales de l'exploitant (AVS / AI / APG)</td>
                  <td className="py-3 px-4 text-right font-medium text-stone-900">
                    {formatCHF(stats.cotisationsAvsPayees > 0 ? stats.cotisationsAvsPayees : stats.estimationAvs.totalAnnuel)}
                  </td>
                </tr>
                <tr className="hover:bg-stone-50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 4.1</td>
                  <td className="py-3 px-4 text-stone-700">Autres charges d'exploitation justifiées par l'usage commercial</td>
                  <td className="py-3 px-4 text-right font-medium text-stone-900">{formatCHF(stats.chargesExploitationTotal)}</td>
                </tr>
                <tr className="bg-emerald-50/70 border-t-2 border-emerald-600 font-bold">
                  <td className="py-3.5 px-4 font-mono text-emerald-950">Rubrique 5.0</td>
                  <td className="py-3.5 px-4 text-emerald-950 font-bold">RÉSULTAT NET DE L'ACTIVITÉ INDÉPENDANTE</td>
                  <td className="py-3.5 px-4 text-right text-emerald-950 text-sm font-extrabold">{formatCHF(stats.beneficeNetFiscal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" icon={Printer} onClick={() => window.print()}>
              Imprimer cette annexe fiscale
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
