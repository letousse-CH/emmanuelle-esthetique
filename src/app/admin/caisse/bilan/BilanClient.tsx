"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PieChart, TrendingUp, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Printer, HelpCircle, FileCheck, CheckCircle2, Building, RefreshCw,
  Coins, Sparkles, AlertCircle, Landmark, Receipt,
} from 'lucide-react';
import CaisseCatalogNav from '../../../../components/admin/CaisseCatalogNav';
import { Button, Callout, PageHeader } from '../../../../components/admin/ui';
import { computeFinancialStats } from '../../../../services/financeService';
import { FinancialDashboardStats } from '../../../../types/finance';
import { formatCHF } from '../../../../types/caisse';

export default function BilanClient() {
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<FinancialDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compte_resultat' | 'tresorerie' | 'avs' | 'impots_vaud'>('compte_resultat');

  useEffect(() => {
    loadStats();
  }, [annee]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await computeFinancialStats(annee);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <CaisseCatalogNav />
        <div className="p-12 text-center text-sm text-stone-500">
          Calcul des agrégats comptables et fiscaux en cours…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CaisseCatalogNav />

      <PageHeader
        title="Bilan, Trésorerie & Fiscalité Vaud"
        description="Vision à 360° de votre activité : compte de résultat, rentabilité des soins, simulation des cotisations AVS de l'indépendante et données prêtes pour le formulaire fiscal de l'État de Vaud."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={annee}
              onChange={e => setAnnee(Number(e.target.value))}
              aria-label="Sélectionner l'exercice fiscal"
              className="h-9 px-3 text-xs font-semibold rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="2026">Exercice 2026</option>
              <option value="2025">Exercice 2025</option>
              <option value="2024">Exercice 2024</option>
            </select>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Imprimer le bilan
            </Button>
            <Button variant="ghost" icon={RefreshCw} onClick={loadStats}>
              Actualiser
            </Button>
          </div>
        }
      />

      {/* Cartes KPI majeures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Chiffre d'Affaires Brut</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{formatCHF(stats.chiffreAffairesTotal)}</p>
          <p className="text-[12px] text-stone-500 mt-1">
            Prestations : {formatCHF(stats.caPrestations)} · Boutique : {formatCHF(stats.caProduitsVente)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Marge Brute Globale</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCHF(stats.margeBruteTotale)}</p>
          <p className="text-[12px] text-stone-500 mt-1">
            Taux de marge : {stats.margeBrutePct} %
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Bénéfice Net Fiscal (ACI)</p>
          <p className="text-2xl font-bold text-stone-900 mt-1">{formatCHF(stats.beneficeNetFiscal)}</p>
          <p className="text-[12px] text-stone-500 mt-1">
            Revenu d'indépendante imposable
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Trésorerie Nette Disponible</p>
          <p className={`text-2xl font-bold mt-1 ${stats.soldeTresoreriePeriode >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCHF(stats.soldeTresoreriePeriode)}
          </p>
          <p className="text-[12px] text-stone-500 mt-1">
            Encaissements − Décaissements réels
          </p>
        </div>
      </div>

      {/* Onglets navigation */}
      <div className="flex border-b border-stone-200 gap-x-6 flex-wrap text-sm font-medium pb-1">
        <button
          onClick={() => setActiveTab('compte_resultat')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'compte_resultat'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <PieChart size={16} /> Compte de Résultat (P&L)
        </button>
        <button
          onClick={() => setActiveTab('tresorerie')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tresorerie'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Wallet size={16} /> Trésorerie & Prélèvements Privés
        </button>
        <button
          onClick={() => setActiveTab('avs')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'avs'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Coins size={16} /> Cotisations AVS Vaud ({stats.estimationAvs.tauxPct} %)
        </button>
        <button
          onClick={() => setActiveTab('impots_vaud')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'impots_vaud'
              ? 'border-b-2 border-stone-900 text-stone-900 font-semibold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Landmark size={16} /> Déclaration Impôt État de Vaud
        </button>
      </div>

      {/* ── 1. COMPTE DE RÉSULTAT (P&L) ────────────────────────────────────── */}
      {activeTab === 'compte_resultat' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden text-xs">
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
          <div className="bg-white p-6 rounded-xl border border-stone-200 space-y-4 text-xs">
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
                <p className="text-[11.5px] text-red-700 mt-1">Factures payées (fournisseurs & charges)</p>
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
        </div>
      )}

      {/* ── 3. COTISATIONS AVS VAUD ───────────────────────────────────────── */}
      {activeTab === 'avs' && (
        <div className="bg-white p-6 rounded-xl border border-stone-200 space-y-6 text-xs">
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
                {stats.resultatExploitationAvantAvs >= 58800
                  ? 'Taux plein (dès CHF 58\'800)'
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

          <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 space-y-2">
            <h4 className="font-semibold text-stone-800">💡 Conseil de l'équipe stratégique :</h4>
            <p className="text-stone-600 leading-relaxed">
              Pour éviter les mauvaises surprises lors de la taxation définitive de la Caisse de compensation vaudoise (qui intervient souvent 1 à 2 ans plus tard), provisionnez chaque mois <strong>{formatCHF(stats.estimationAvs.provisionMensuelle)}</strong>. Si vos acomptes versés sont inférieurs, vous aurez la trésorerie prête sans impact sur votre sérénité.
            </p>
          </div>
        </div>
      )}

      {/* ── 4. DÉCLARATION IMPÔT ÉTAT DE VAUD ─────────────────────────────── */}
      {activeTab === 'impots_vaud' && (
        <div className="bg-white p-6 rounded-xl border border-stone-200 space-y-6 text-xs">
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
                <tr className="hover:bg-stone-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 1.1</td>
                  <td className="py-3 px-4 font-medium text-stone-900">Chiffre d'affaires brut (ventes + honoraires soins)</td>
                  <td className="py-3 px-4 text-right font-bold text-stone-900">{formatCHF(stats.chiffreAffairesTotal)}</td>
                </tr>
                <tr className="hover:bg-stone-50/50">
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
                  <td className="py-3 px-4 text-right font-medium text-stone-900">{formatCHF(stats.coutMatiereTotal)}</td>
                </tr>
                <tr className="hover:bg-stone-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 2.2</td>
                  <td className="py-3 px-4 text-stone-700">Variation des stocks au 31 décembre (inventaire physique)</td>
                  <td className="py-3 px-4 text-right text-stone-500">CHF 0.00 (ou selon inventaire)</td>
                </tr>
                <tr className="hover:bg-stone-50/50">
                  <td className="py-3 px-4 font-mono font-bold text-stone-700">Rubrique 3.1</td>
                  <td className="py-3 px-4 text-stone-700">Cotisations sociales de l'exploitant (AVS / AI / APG)</td>
                  <td className="py-3 px-4 text-right font-medium text-stone-900">
                    {formatCHF(stats.cotisationsAvsPayees > 0 ? stats.cotisationsAvsPayees : stats.estimationAvs.totalAnnuel)}
                  </td>
                </tr>
                <tr className="hover:bg-stone-50/50">
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
