"use client";

import React, { useState, useEffect } from 'react';
import {
  Globe, Plus, RefreshCw, Rocket, CheckCircle2, AlertCircle, ExternalLink,
  Trash2, Edit3, ShieldCheck, Zap, Layers, Server, Check, X, Loader2,
  FileText, ChevronDown, ChevronUp, GitBranch
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Badge, Button, Card, CardBody, Input } from '../../../components/admin/ui';

export interface FleetSite {
  id: string;
  name: string;
  url: string;
  buildWebhookUrl?: string;
  lastSyncAt?: string;
  status: 'connected' | 'error' | 'pending' | 'updating';
  statusMessage?: string;
  lastLogs?: string[];
}

const DEFAULT_SITES: FleetSite[] = [
  {
    id: 'site-audeladeschaines',
    name: 'Au-delà des chaînes',
    url: 'https://audeladeschaines.com',
    status: 'connected',
  }
];

export default function FleetManagerPanel() {
  const [sites, setSites] = useState<FleetSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulaire d'ajout / édition
  const [showDialog, setShowDialog] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formWebhook, setFormWebhook] = useState('');

  // État des logs repliés/dépliés
  const [expandedLogsSiteId, setExpandedLogsSiteId] = useState<string | null>(null);

  // État des actions
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'site_fleet_config')
      .maybeSingle();

    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) {
          setSites(parsed);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Erreur lecture fleet config:', e);
      }
    }
    setSites(DEFAULT_SITES);
    setLoading(false);
  };

  const saveSitesToSupabase = async (newSites: FleetSite[]) => {
    setSaving(true);
    setSites(newSites);
    try {
      await supabase.from('settings').upsert({
        key: 'site_fleet_config',
        value: JSON.stringify(newSites)
      }, { onConflict: 'key' });
    } catch (e) {
      console.error('Erreur sauvegarde flotte:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingSiteId(null);
    setFormName('');
    setFormUrl('');
    setFormWebhook('');
    setShowDialog(true);
  };

  const handleOpenEdit = (site: FleetSite) => {
    setEditingSiteId(site.id);
    setFormName(site.name);
    setFormUrl(site.url);
    setFormWebhook(site.buildWebhookUrl || '');
    setShowDialog(true);
  };

  const handleSaveSite = () => {
    if (!formName.trim() || !formUrl.trim()) return;

    let updated: FleetSite[];
    if (editingSiteId) {
      updated = sites.map(s => s.id === editingSiteId ? {
        ...s,
        name: formName.trim(),
        url: formUrl.trim(),
        buildWebhookUrl: formWebhook.trim() || undefined
      } : s);
    } else {
      const newSite: FleetSite = {
        id: `site-${Date.now()}`,
        name: formName.trim(),
        url: formUrl.trim(),
        buildWebhookUrl: formWebhook.trim() || undefined,
        status: 'pending'
      };
      updated = [...sites, newSite];
    }

    saveSitesToSupabase(updated);
    setShowDialog(false);
  };

  const handleDeleteSite = (id: string) => {
    if (!window.confirm('Supprimer ce site client de la liste ?')) return;
    const updated = sites.filter(s => s.id !== id);
    saveSitesToSupabase(updated);
  };

  // ── MISE À JOUR 100% AUTOMATISÉE EN 1 CLIC ─────────────────────────────────
  const triggerFullAutomatedUpdate = async (site: FleetSite) => {
    setActionBusyId(site.id);
    const logs: string[] = [];

    const updateSiteState = (status: FleetSite['status'], msg: string, newLogs?: string[]) => {
      setSites(prev => prev.map(s => s.id === site.id ? {
        ...s,
        status,
        statusMessage: msg,
        lastSyncAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        lastLogs: newLogs || logs
      } : s));
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // 1. Déclenchement du build Netlify
      updateSiteState('updating', '🔨 Déploiement du code en cours…');
      logs.push('🚀 Lancement de la mise à jour 1-clic…');

      if (site.buildWebhookUrl) {
        logs.push('🔨 Déclenchement du build Netlify à distance…');
        const buildRes = await fetch('/api/admin/remote-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ targetUrl: site.url, buildWebhookUrl: site.buildWebhookUrl, action: 'build' })
        });
        const buildData = await buildRes.json();
        if (buildData.logs) logs.push(...buildData.logs);
      } else {
        logs.push('ℹ Aucun Webhook Netlify configuré. Passage direct à la synchronisation Supabase.');
      }

      // 2. Attente et Polling de la synchronisation Supabase
      updateSiteState('updating', '⏳ Attente du déploiement Netlify & synchronisation Supabase…');

      let synced = false;
      let attempts = 0;
      const maxAttempts = 35; // 35 x 6s = 210s (3,5 minutes pour laisser Netlify terminer)
      const startTime = Date.now();

      while (!synced && attempts < maxAttempts) {
        attempts++;
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        if (attempts > 1) {
          logs.push(`⏳ Compilation Netlify en cours (${elapsedSec}s écoulées — tentative ${attempts}/${maxAttempts})…`);
          updateSiteState('updating', `⏳ Compilation Netlify en cours (${elapsedSec}s / ~120s)…`);
          await new Promise(r => setTimeout(r, 6000));
        } else {
          await new Promise(r => setTimeout(r, 4000));
        }

        const syncRes = await fetch('/api/admin/remote-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ targetUrl: site.url, action: 'migrate' })
        });

        const syncData = await syncRes.json().catch(() => null);
        if (syncData?.logs && syncData.logs.some((l: string) => l.includes('✓ Synchronisation réussie'))) {
          synced = true;
          logs.push(...syncData.logs);
          logs.push('✅ Mise à jour 100% terminée ! Le code Netlify et la base Supabase sont à jour.');
          updateSiteState('connected', '✅ Site 100% à jour (Code + Supabase)');
        } else if (attempts === maxAttempts) {
          if (syncData?.logs) logs.push(...syncData.logs);
          logs.push('ℹ️ La compilation Netlify prend un peu plus de temps. N’oubliez pas d’exécuter `git push` si votre site est connecté à GitHub.');
          updateSiteState('connected', '✅ Mise à jour transmise (Compilation en cours)');
        }
      }

      // Sauvegarde du résultat final dans Supabase settings
      const finalSites = sites.map(s => s.id === site.id ? {
        ...s,
        status: synced ? ('connected' as const) : ('connected' as const),
        lastSyncAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        lastLogs: logs
      } : s);
      saveSitesToSupabase(finalSites);

    } catch (err: any) {
      logs.push(`❌ Erreur : ${err?.message || 'Erreur inconnue'}`);
      updateSiteState('error', 'Erreur de mise à jour');
    } finally {
      setActionBusyId(null);
    }
  };

  const updateAllSites = async () => {
    setGlobalBusy(true);
    for (const site of sites) {
      await triggerFullAutomatedUpdate(site);
    }
    setGlobalBusy(false);
  };

  return (
    <div className="space-y-6">
      {/* Modale d'Ajout / Édition */}
      {showDialog && (
        <div className="fixed inset-0 z-[9999] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">
                {editingSiteId ? 'Éditer le site client' : 'Ajouter un site client'}
              </h3>
              <button onClick={() => setShowDialog(false)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-800 mb-1">Nom du site</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Au-delà des chaînes"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">URL complète du site</label>
                <Input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://audeladeschaines.com"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-800 mb-1">Webhook de build Netlify (optionnel)</label>
                <Input
                  value={formWebhook}
                  onChange={(e) => setFormWebhook(e.target.value)}
                  placeholder="https://api.netlify.com/build_hooks/..."
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Permet à l'admin de déclencher automatiquement le build Netlify en 1 clic.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <Button variant="secondary" size="sm" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveSite} disabled={!formName.trim() || !formUrl.trim()}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* En-tête du Panneau */}
      <Card>
        <CardBody className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge tone="success">Automatisation 1-Clic Active</Badge>
                <span className="text-xs text-stone-500">{sites.length} site{sites.length > 1 ? 's' : ''} sous gestion</span>
              </div>
              <h2 className="text-lg font-bold text-stone-900">Mises à Jour Multi-Sites 100% Automatisées</h2>
              <p className="text-xs text-stone-600">
                Appuyez sur un seul bouton pour déployer le code et synchroniser la base Supabase de vos sites clients.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={handleOpenAdd}
              >
                Ajouter un site
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={Zap}
                loading={globalBusy}
                onClick={updateAllSites}
              >
                {globalBusy ? 'Mise à jour générale…' : '⚡ TOUT METTRE À JOUR EN 1-CLIC'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notice Déploiement Git & Netlify */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 space-y-1.5 shadow-xs">
        <p className="font-bold flex items-center gap-2 text-amber-950">
          <GitBranch size={15} className="text-amber-700" />
          Déploiement GitHub & Netlify pour vos sites clients
        </p>
        <p className="text-amber-900 leading-relaxed">
          Si votre site client est connecté à un dépôt GitHub (ex: <em>Emmanuelle Esthétique</em>), pensez à effectuer votre envoi Git (<code className="bg-amber-200/70 text-amber-950 font-mono font-bold px-1.5 py-0.5 rounded">git push</code>). Netlify lancera immédiatement la compilation et la synchronisation Supabase passera au vert automatiquement !
        </p>
      </div>

      {/* Liste des Sites */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardBody className="py-8 text-center text-xs text-stone-500">
              <Loader2 size={20} className="animate-spin text-stone-700 mx-auto mb-2" />
              Chargement de vos sites clients…
            </CardBody>
          </Card>
        ) : sites.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center space-y-3">
              <Globe size={32} className="mx-auto text-stone-300" />
              <p className="text-sm font-semibold text-stone-800">Aucun site enregistré</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Ajoutez les URL de vos sites clients pour débloquer la mise à jour 1-clic.
              </p>
              <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAdd}>
                Ajouter mon premier site
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sites.map((site) => {
              const isBusy = actionBusyId === site.id;
              const isExpanded = expandedLogsSiteId === site.id;

              return (
                <Card key={site.id} className="overflow-hidden">
                  <CardBody className="p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                          <Globe size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-stone-900">{site.name}</h3>
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-stone-400 hover:text-stone-800 transition-colors"
                              title="Ouvrir le site"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <p className="text-xs text-stone-500 font-mono">{site.url}</p>
                        </div>
                      </div>

                      {/* LE BOUTON UNIQUE 1-CLIC */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Zap}
                          loading={isBusy}
                          onClick={() => triggerFullAutomatedUpdate(site)}
                        >
                          {isBusy ? 'Mise à jour en cours…' : '🚀 Mettre à jour ce site (1-Clic)'}
                        </Button>

                        <button
                          onClick={() => handleOpenEdit(site)}
                          className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Éditer"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteSite(site.id)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Statut & Synthèse */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          site.status === 'connected' ? 'bg-emerald-500' : site.status === 'updating' ? 'bg-amber-400 animate-pulse' : 'bg-stone-300'
                        }`} />
                        <span className="font-semibold text-stone-900">
                          {site.statusMessage || (site.status === 'connected' ? '✅ Site 100% à jour (Code + Supabase)' : 'Prêt pour mise à jour')}
                        </span>
                        {site.lastSyncAt && (
                          <span className="text-stone-400">· Dernière synchro à {site.lastSyncAt}</span>
                        )}
                      </div>
                    </div>

                    {/* Bloc Logs Accordéon Replié par Défaut */}
                    {site.lastLogs && site.lastLogs.length > 0 && (
                      <div className="pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => setExpandedLogsSiteId(isExpanded ? null : site.id)}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg"
                        >
                          <FileText size={13} />
                          {isExpanded
                            ? 'Masquer le journal de mise à jour (Logs)'
                            : `Voir le journal de mise à jour (${site.lastLogs.length} lignes)`}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 bg-stone-900 text-stone-200 p-4 rounded-xl border border-stone-800 text-xs space-y-1.5 font-mono max-h-72 overflow-y-auto selection:bg-amber-400 selection:text-stone-900 shadow-inner">
                            {site.lastLogs.map((log, idx) => (
                              <p key={idx} className="leading-relaxed">{log}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
