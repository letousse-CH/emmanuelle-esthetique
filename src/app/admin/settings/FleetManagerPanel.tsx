"use client";

import React, { useState, useEffect } from 'react';
import {
  Globe, Plus, RefreshCw, Rocket, CheckCircle2, AlertCircle, ExternalLink,
  Trash2, Edit3, ShieldCheck, Zap, Layers, Server, Check, X, Loader2,
  FileText, ChevronDown, ChevronUp, GitBranch
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Button, Callout, Card, CardBody, FormMessage, Input } from '../../../components/admin/ui';

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
  // Copie toujours à jour de la liste : la mise à jour d'un site dure plusieurs
  // minutes, et relire `sites` à la fin rendait l'état d'avant le lancement.
  const sitesRef = React.useRef<FleetSite[]>([]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Lecture ratée : la liste par défaut s'afficherait et le moindre
  // enregistrement écraserait la vraie liste. On bloque donc l'enregistrement.
  const loadFailedRef = React.useRef(false);

  const loadSites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'site_fleet_config')
      .maybeSingle();
    if (error) {
      loadFailedRef.current = true;
      setSaveMessage({ type: 'error', text: "La liste des sites n'a pas pu être lue. Rechargez la page avant toute modification." });
    }

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
    if (loadFailedRef.current) {
      setSaveMessage({ type: 'error', text: "La liste des sites n'a pas pu être lue au chargement : rechargez la page, sinon la liste enregistrée serait remplacée." });
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    setSites(newSites);
    sitesRef.current = newSites;
    try {
      const { error } = await supabase.from('settings').upsert({
        key: 'site_fleet_config',
        value: JSON.stringify(newSites)
      }, { onConflict: 'key' });
      if (error) throw error;
    } catch (e: any) {
      console.error('Erreur sauvegarde flotte:', e);
      setSaveMessage({ type: 'error', text: "La liste des sites n'a pas été enregistrée : " + (e?.message || 'erreur inconnue') + '. Réessayez.' });
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
    const site = sites.find((s) => s.id === id);
    if (!window.confirm(`Retirer « ${site?.name ?? 'ce site'} » de la liste ? Le site lui-même n'est pas touché.`)) return;
    const updated = sites.filter(s => s.id !== id);
    saveSitesToSupabase(updated);
  };

  // ── MISE À JOUR 100% AUTOMATISÉE EN 1 CLIC ─────────────────────────────────
  const triggerFullAutomatedUpdate = async (site: FleetSite, confirmed = false) => {
    if (!confirmed && !window.confirm(`Mettre à jour « ${site.name} » ? Le site sera reconstruit et sa base de données complétée. L'opération prend quelques minutes.`)) return;
    setActionBusyId(site.id);
    const logs: string[] = [];
    // Dernier message affiché, repris dans l'enregistrement final : sans lui,
    // la liste relue gardait le message « en cours » après la réussite.
    let lastMessage = '';

    const updateSiteState = (status: FleetSite['status'], msg: string, newLogs?: string[]) => {
      lastMessage = msg;
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
      updateSiteState('updating', 'Mise en ligne du code en cours…');
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
      updateSiteState('updating', 'Attente de la mise en ligne, puis mise à jour de la base…');

      let synced = false;
      let attempts = 0;
      const maxAttempts = 35; // 35 x 6s = 210s (3,5 minutes pour laisser Netlify terminer)
      const startTime = Date.now();

      while (!synced && attempts < maxAttempts) {
        attempts++;
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        if (attempts > 1) {
          logs.push(`⏳ Compilation Netlify en cours (${elapsedSec}s écoulées — tentative ${attempts}/${maxAttempts})…`);
          updateSiteState('updating', `Mise en ligne en cours (${elapsedSec} s, environ 2 min au total)…`);
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
          updateSiteState('connected', 'Site à jour (code et base de données)');
        } else if (attempts === maxAttempts) {
          if (syncData?.logs) logs.push(...syncData.logs);
          logs.push('ℹ️ La compilation Netlify prend un peu plus de temps. N’oubliez pas d’exécuter `git push` si votre site est connecté à GitHub.');
          updateSiteState('updating', 'Mise à jour envoyée ; la mise en ligne prend plus de temps que prévu. Revenez vérifier dans quelques minutes.');
        }
      }

      // Sauvegarde du résultat final dans Supabase settings
      const finalSites = sitesRef.current.map(s => s.id === site.id ? {
        ...s,
        status: synced ? ('connected' as const) : ('pending' as const),
        ...(lastMessage ? { statusMessage: lastMessage } : {}),
        lastSyncAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        lastLogs: logs
      } : s);
      await saveSitesToSupabase(finalSites);

    } catch (err: any) {
      logs.push(`❌ Erreur : ${err?.message || 'Erreur inconnue'}`);
      updateSiteState('error', `La mise à jour a échoué : ${err?.message || 'erreur inconnue'}. Consultez le journal, puis réessayez.`);
    } finally {
      setActionBusyId(null);
    }
  };

  const updateAllSites = async () => {
    if (!window.confirm(`Mettre à jour les ${sites.length} site(s) l'un après l'autre ? Chacun sera reconstruit ; comptez quelques minutes par site.`)) return;
    setGlobalBusy(true);
    for (const site of sites) {
      await triggerFullAutomatedUpdate(site, true);
    }
    setGlobalBusy(false);
  };

  return (
    <div className="space-y-6">
      {/* Modale d'Ajout / Édition */}
      {showDialog && (
        <div className="fixed inset-0 z-[9999] bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowDialog(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="fleet-dialog-title" onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 id="fleet-dialog-title" className="text-base font-semibold text-stone-900">
                {editingSiteId ? 'Modifier le site' : 'Ajouter un site'}
              </h3>
              <button type="button" onClick={() => setShowDialog(false)} aria-label="Fermer" className="text-stone-600 hover:text-stone-900 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label htmlFor="fleet-name" className="block font-medium text-stone-800 mb-1">Nom du site</label>
                <Input
                  id="fleet-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Au-delà des chaînes"
                />
              </div>

              <div>
                <label htmlFor="fleet-url" className="block font-medium text-stone-800 mb-1">Adresse complète du site</label>
                <Input
                  id="fleet-url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://audeladeschaines.com"
                />
              </div>

              <div>
                <label htmlFor="fleet-webhook" className="block font-medium text-stone-800 mb-1">Lien de reconstruction Netlify (build hook, facultatif)</label>
                <Input
                  id="fleet-webhook"
                  value={formWebhook}
                  onChange={(e) => setFormWebhook(e.target.value)}
                  placeholder="https://api.netlify.com/build_hooks/..."
                />
                <p className="text-[13px] text-stone-600 mt-1">
                  Sans ce lien, seule la base de données est mise à jour ; le code reste celui déjà en ligne.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
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
              <h2 className="text-lg font-semibold text-stone-900">Autres sites</h2>
              <p className="text-[14px] text-stone-700">
                {sites.length} site{sites.length > 1 ? 's' : ''} suivi{sites.length > 1 ? 's' : ''}. La mise à jour reconstruit le site puis complète sa base de données.
              </p>
              <FormMessage message={saveMessage} />
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
                {globalBusy ? 'Mise à jour en cours…' : 'Tout mettre à jour'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Notice Déploiement Git & Netlify */}
      <Callout tone="info" title="Sites reliés à GitHub">
        Pour un site relié à un dépôt GitHub, le nouveau code n&apos;est mis en ligne qu&apos;après
        l&apos;envoi des modifications (<code className="font-mono">git push</code>). Netlify reconstruit
        alors le site ; la mise à jour de la base se fait ensuite ici.
      </Callout>

      {/* Liste des Sites */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardBody className="py-8 text-center text-sm text-stone-700">
              <Loader2 size={20} className="animate-spin text-stone-700 mx-auto mb-2" />
              Chargement de vos sites clients…
            </CardBody>
          </Card>
        ) : sites.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center space-y-3">
              <Globe size={32} className="mx-auto text-stone-400" />
              <p className="text-sm font-semibold text-stone-800">Aucun site enregistré</p>
              <p className="text-[13px] text-stone-600 max-w-sm mx-auto">
                Ajoutez l&apos;adresse d&apos;un autre site installé avec cet outil pour pouvoir le mettre à jour d&apos;ici.
              </p>
              <Button variant="secondary" size="sm" icon={Plus} onClick={handleOpenAdd}>
                Ajouter un site
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-stone-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                          <Globe size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-stone-900">{site.name}</h3>
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-stone-600 hover:text-stone-900 transition-colors"
                              title="Ouvrir le site"
                              aria-label={`Ouvrir ${site.name} dans un nouvel onglet`}
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          <p className="text-xs text-stone-600 font-mono">{site.url}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Zap}
                          loading={isBusy}
                          disabled={globalBusy || (actionBusyId !== null && !isBusy)}
                          onClick={() => triggerFullAutomatedUpdate(site)}
                        >
                          {isBusy ? 'Mise à jour en cours…' : 'Mettre à jour ce site'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(site)}
                          className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                          title="Modifier"
                          aria-label={`Modifier ${site.name}`}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSite(site.id)}
                          disabled={isBusy}
                          className="p-2 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-45"
                          title="Retirer de la liste"
                          aria-label={`Retirer ${site.name} de la liste`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Statut & Synthèse */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          site.status === 'connected' ? 'bg-emerald-500' : site.status === 'updating' ? 'bg-amber-500' : site.status === 'error' ? 'bg-red-500' : 'bg-stone-300'
                        }`} />
                        <span className="font-semibold text-stone-900">
                          {site.statusMessage || (site.status === 'connected' ? 'Site à jour' : 'Pas encore mis à jour')}
                        </span>
                        {site.lastSyncAt && (
                          <span className="text-stone-600">· Dernière mise à jour à {site.lastSyncAt}</span>
                        )}
                      </div>
                    </div>

                    {/* Bloc Logs Accordéon Replié par Défaut */}
                    {site.lastLogs && site.lastLogs.length > 0 && (
                      <div className="pt-2 border-t border-stone-200">
                        <button
                          type="button"
                          onClick={() => setExpandedLogsSiteId(isExpanded ? null : site.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg"
                        >
                          <FileText size={13} />
                          {isExpanded
                            ? 'Masquer le journal'
                            : `Voir le journal (${site.lastLogs.length} lignes)`}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 bg-stone-900 text-stone-200 p-4 rounded-xl border border-stone-800 text-xs space-y-1.5 font-mono max-h-72 overflow-y-auto ">
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
