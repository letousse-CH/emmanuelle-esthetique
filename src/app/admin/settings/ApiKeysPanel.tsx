"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import { Mail, HardDrive, Search, Save, Eye, EyeOff, Sparkles, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Badge, Button, Callout } from '../../../components/admin/ui';
import AiKeyPanel from './AiKeyPanel';
import { settingsCache } from '../../../hooks/useSettings';

/**
 * Clés des services (Resend, Cloudflare R2, Bing IndexNow).
 *
 * Les clés secrètes passent par /api/admin/secrets et sont rangées dans
 * `app_secrets`, que le navigateur ne peut pas lire. Elles ne redescendent
 * jamais en clair : l'écran affiche « Configurée …ABCD ». Un champ laissé
 * vide conserve la clé en place.
 *
 * Seuls les réglages publics restent dans `settings` : adresse d'expédition,
 * adresse publique des images et clé IndexNow (publique par principe, Bing la
 * lit dans un fichier servi par le site).
 */

type SecretKey = 'resend_api_key' | 'r2_account_id' | 'r2_access_key_id' | 'r2_secret_access_key' | 'r2_bucket_name';

interface SecretStatus {
  configured: boolean;
  source: 'admin' | 'environment' | null;
  hint: string | null;
  value?: string | null;
}

type StatusMap = Partial<Record<SecretKey, SecretStatus>>;

// Réglages publics, toujours dans `settings`.
const PUBLIC_KEYS = ['resend_from_email', 'r2_public_url', 'bing_indexnow_key'];

// Anciennes clés secrètes de `settings`. On ne lit que leur nom, jamais leur
// valeur, pour signaler qu'il reste à appliquer la migration.
const LEGACY_SECRET_KEYS = ['resend_api_key', 'r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name'];

const SECRET_LABELS: Record<SecretKey, string> = {
  resend_api_key: 'la clé Resend',
  r2_account_id: "l'identifiant du compte Cloudflare",
  r2_access_key_id: "l'identifiant de clé R2",
  r2_secret_access_key: 'la clé secrète R2',
  r2_bucket_name: 'le nom du bucket',
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  };
}

function StatusLine({ status }: { status?: SecretStatus }) {
  if (!status) return null;
  if (!status.configured) {
    return <p className="text-[13px] text-stone-700">Non configurée.</p>;
  }
  return (
    <p className="text-[13px] text-stone-700">
      Configurée <span className="font-mono">{status.hint}</span>
      {status.source === 'environment' ? ', fournie par une variable du serveur.' : ', enregistrée ici.'}
    </p>
  );
}

export default function ApiKeysPanel() {
  // Resend
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);

  // R2 Storage
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');
  const [r2BucketName, setR2BucketName] = useState('');
  const [r2PublicUrl, setR2PublicUrl] = useState('');
  const [showR2Secret, setShowR2Secret] = useState(false);

  // Bing IndexNow
  const [bingKey, setBingKey] = useState('');

  // État des clés secrètes (jamais leur valeur, sauf compte et bucket).
  const [status, setStatus] = useState<StatusMap>({});
  // Valeurs non secrètes telles que chargées, pour n'envoyer que ce qui change.
  const [loadedPlain, setLoadedPlain] = useState<{ r2_account_id: string; r2_bucket_name: string }>({ r2_account_id: '', r2_bucket_name: '' });
  const [legacyKeys, setLegacyKeys] = useState<string[]>([]);

  // States
  const [loading, setLoading] = useState(true);
  // Si la lecture échoue, les champs restent vides : enregistrer effacerait
  // alors les réglages existants. On bloque l'enregistrement dans ce cas.
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<SecretKey | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Test states
  const [testingR2, setTestingR2] = useState(false);
  const [r2TestResult, setR2TestResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadStatus = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/admin/secrets', { headers: await authHeaders() });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (!data?.secrets) return false;
    const next = data.secrets as StatusMap;
    setStatus(next);
    const accountId = next.r2_account_id?.value || '';
    const bucket = next.r2_bucket_name?.value || '';
    setR2AccountId(accountId);
    setR2BucketName(bucket);
    setLoadedPlain({ r2_account_id: accountId, r2_bucket_name: bucket });
    return true;
  }, []);

  const handleTestR2 = async () => {
    setTestingR2(true);
    setR2TestResult(null);
    try {
      // Champs vides : le serveur teste la configuration enregistrée.
      const res = await fetch('/api/admin/test-r2-connection', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          r2AccountId,
          r2AccessKeyId,
          r2SecretAccessKey,
          r2BucketName,
          r2PublicUrl,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setR2TestResult({ kind: 'ok', text: data.message || 'Connexion au stockage réussie.' });
      } else {
        setR2TestResult({ kind: 'error', text: data.error || `Le test a échoué (erreur ${res.status}). Vérifiez les quatre champs puis réessayez.` });
      }
    } catch (err: any) {
      setR2TestResult({ kind: 'error', text: err?.message || 'Erreur réseau lors du test R2' });
    } finally {
      setTestingR2(false);
    }
  };

  const handleTestResend = async () => {
    setTestingResend(true);
    setResendTestResult(null);
    try {
      // Champ vide : le serveur teste la clé enregistrée.
      const res = await fetch('/api/admin/test-resend-connection', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          resendApiKey,
          resendFromEmail,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResendTestResult({ kind: 'ok', text: data.message || 'Clé Resend valide.' });
      } else {
        setResendTestResult({ kind: 'error', text: data.error || `Le test a échoué (erreur ${res.status}). Vérifiez la clé puis réessayez.` });
      }
    } catch (err: any) {
      setResendTestResult({ kind: 'error', text: err?.message || 'Erreur réseau lors du test Resend' });
    } finally {
      setTestingResend(false);
    }
  };

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('key, value').in('key', PUBLIC_KEYS);
      if (error) throw error;
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
      setResendFromEmail(map.resend_from_email || '');
      setR2PublicUrl(map.r2_public_url || '');
      setBingKey(map.bing_indexnow_key || '');

      if (!(await loadStatus())) throw new Error('secrets');

      // Nom des anciennes clés encore présentes dans `settings` (sans valeur).
      const { data: legacy } = await supabase
        .from('settings')
        .select('key')
        .in('key', LEGACY_SECRET_KEYS)
        .neq('value', '');
      setLegacyKeys((legacy ?? []).map((r: any) => r.key));

      setLoadFailed(false);
    } catch (err) {
      console.error('[ApiKeysPanel] Erreur chargement des clés:', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  async function postSecret(key: SecretKey, value: string): Promise<string | null> {
    try {
      const res = await fetch('/api/admin/secrets', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) return null;
      const data = await res.json().catch(() => ({}));
      return data.error || `erreur ${res.status}`;
    } catch {
      return 'connexion impossible';
    }
  }

  const handleRemove = async (key: SecretKey) => {
    const fromEnv = 'Le serveur reprendra la valeur de sa variable d\'environnement, si elle existe.';
    if (!confirm(`Retirer ${SECRET_LABELS[key]} enregistrée ici ? ${fromEnv}`)) return;
    setRemoving(key);
    setNotice(null);
    const error = await postSecret(key, '');
    if (error) {
      setNotice({ kind: 'error', text: `Le retrait a échoué : ${error}.` });
    } else {
      await loadStatus().catch(() => false);
      setNotice({ kind: 'ok', text: 'Clé retirée.' });
    }
    setRemoving(null);
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadFailed) return;
    setSaving(true);
    setNotice(null);
    const errors: string[] = [];
    try {
      // 1. Réglages publics.
      const rows = [
        { key: 'resend_from_email', value: resendFromEmail.trim() },
        { key: 'r2_public_url', value: r2PublicUrl.trim() },
        { key: 'bing_indexnow_key', value: bingKey.trim() },
      ];
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) errors.push(`réglages : ${error.message}`);
      else rows.forEach((r) => settingsCache.set(r.key, r.value));

      // 2. Clés secrètes : seulement celles qui ont été saisies. Un champ vide
      // conserve la clé en place (le retrait passe par « Retirer »).
      const secrets: [SecretKey, string][] = [
        ['resend_api_key', resendApiKey.trim()],
        ['r2_access_key_id', r2AccessKeyId.trim()],
        ['r2_secret_access_key', r2SecretAccessKey.trim()],
      ];
      for (const [key, value] of secrets) {
        if (!value) continue;
        const err = await postSecret(key, value);
        if (err) errors.push(`${SECRET_LABELS[key]} : ${err}`);
      }

      // 3. Identifiant du compte et bucket : envoyés s'ils ont changé.
      const plain: [SecretKey & keyof typeof loadedPlain, string][] = [
        ['r2_account_id', r2AccountId.trim()],
        ['r2_bucket_name', r2BucketName.trim()],
      ];
      for (const [key, value] of plain) {
        if (value === loadedPlain[key]) continue;
        const err = await postSecret(key, value);
        if (err) errors.push(`${SECRET_LABELS[key]} : ${err}`);
      }

      if (errors.length === 0) {
        setResendApiKey('');
        setR2AccessKeyId('');
        setR2SecretAccessKey('');
      }
      await loadStatus().catch(() => false);

      setNotice(errors.length === 0
        ? { kind: 'ok', text: 'Clés enregistrées.' }
        : { kind: 'error', text: `Une partie n'a pas été enregistrée (${errors.join(' ; ')}). Réessayez.` });
    } catch (err: any) {
      setNotice({ kind: 'error', text: "Les clés n'ont pas été enregistrées : " + (err?.message || 'erreur inconnue') + '. Réessayez.' });
    } finally {
      setSaving(false);
    }
  };

  const has = (key: SecretKey, typed: string) => Boolean(typed.trim()) || Boolean(status[key]?.configured);
  const isResendConfigured = has('resend_api_key', resendApiKey);
  const isR2Configured =
    has('r2_account_id', r2AccountId) &&
    has('r2_access_key_id', r2AccessKeyId) &&
    has('r2_secret_access_key', r2SecretAccessKey) &&
    has('r2_bucket_name', r2BucketName);
  const isBingConfigured = Boolean(bingKey);

  const secretPlaceholder = (key: SecretKey, fallback: string) =>
    status[key]?.configured ? 'Laissez vide pour conserver la clé actuelle' : fallback;

  const removeButton = (key: SecretKey) =>
    status[key]?.source === 'admin' ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(key)} loading={removing === key} disabled={saving}>
        Retirer
      </Button>
    ) : null;

  return (
    <div className="space-y-8 animate-fadein">
      {loadFailed && (
        <Callout tone="danger" title="Clés non chargées">
          L&apos;état des clés n&apos;a pas pu être lu. Rechargez la page avant de modifier quoi que ce soit. Si le
          problème persiste, votre session a peut-être expiré : reconnectez-vous.
        </Callout>
      )}

      {legacyKeys.length > 0 && (
        <Callout tone="warning" title="Des clés sont encore rangées dans l'ancien emplacement">
          Des clés Resend ou Cloudflare sont encore stockées dans les réglages publics du site, que n&apos;importe
          quel visiteur peut lire. Appliquez le fichier <code className="font-mono">supabase/a-appliquer/2026-09-27b_a-appliquer.sql</code> dans
          Supabase (SQL Editor) : il les déplace vers l&apos;espace protégé. Ensuite, régénérez ces clés chez Cloudflare
          et chez Resend, puis saisissez les nouvelles ici. Tant que le fichier n&apos;est pas appliqué, l&apos;envoi de
          fichiers et d&apos;e-mails utilise uniquement les variables du serveur.
        </Callout>
      )}

      {/* 1. Anthropic Claude Key Panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-7">
        <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
          <Sparkles size={16} /> Rédaction par l&apos;IA (Anthropic)
        </h2>
        <AiKeyPanel />
      </div>

      {/* Formulaire Clés Services (Resend, R2, Bing) */}
      <form onSubmit={handleSaveKeys} className="space-y-8">
        {/* 2. Resend Email Key */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <Mail size={16} /> Envoi des e-mails (Resend)
              </h2>
              <Badge tone={isResendConfigured ? 'success' : 'warning'}>
                {isResendConfigured ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-lg:min-h-11 items-center gap-1.5 text-[14px] font-medium text-stone-700 underline-offset-4 hover:text-stone-900 hover:underline shrink-0 w-fit"
            >
              <span>Obtenir une clé Resend</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="resend-api-key" className="block text-[13px] font-medium text-stone-800">
                Clé Resend
              </label>
              <div className="relative flex items-center">
                <input
                  id="resend-api-key"
                  type={showResendKey ? 'text' : 'password'}
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder={secretPlaceholder('resend_api_key', 're_123456789...')}
                  autoComplete="off"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 pr-10 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey(!showResendKey)}
                  aria-label={showResendKey ? 'Masquer la clé' : 'Afficher la clé'}
                  className="absolute right-3 max-lg:right-0 max-lg:inline-flex max-lg:size-11 max-lg:items-center max-lg:justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusLine status={status.resend_api_key} />
                {removeButton('resend_api_key')}
              </div>
              <p className="text-[13px] text-stone-700">Sert à envoyer les messages du formulaire de contact, les e-mails de bienvenue et la newsletter.</p>
            </div>

            <div className="space-y-2 pt-2">
              <label htmlFor="resend-from-email" className="block text-[13px] font-medium text-stone-800">
                Adresse d&apos;expédition
              </label>
              <input
                id="resend-from-email"
                type="email"
                value={resendFromEmail}
                onChange={(e) => setResendFromEmail(e.target.value)}
                placeholder="contact@votre-domaine.ch"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {resendTestResult && (
            <div role="status" className={`mt-4 p-3 rounded-lg text-[14px] font-medium flex items-center gap-2 border ${
              resendTestResult.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {resendTestResult.kind === 'ok' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-red-600 shrink-0" />}
              <span>{resendTestResult.text}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={handleTestResend} loading={testingResend} disabled={!isResendConfigured}>
              {testingResend ? 'Test en cours…' : 'Tester la clé'}
            </Button>
          </div>
        </div>

        {/* 3. Cloudflare R2 Storage */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <HardDrive size={16} /> Stockage des images (Cloudflare R2)
              </h2>
              <Badge tone={isR2Configured ? 'success' : 'warning'}>
                {isR2Configured ? 'Configuré' : 'Non configuré'}
              </Badge>
            </div>
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-lg:min-h-11 items-center gap-1.5 text-[14px] font-medium text-stone-700 underline-offset-4 hover:text-stone-900 hover:underline shrink-0 w-fit"
            >
              <span>Obtenir les clés Cloudflare</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="r2-account-id" className="block text-[13px] font-medium text-stone-800">
                Identifiant du compte (Account ID)
              </label>
              <input
                id="r2-account-id"
                type="text"
                value={r2AccountId}
                onChange={(e) => setR2AccountId(e.target.value)}
                placeholder="Ex: a1b2c3d4e5f6..."
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none"
              />
              {status.r2_account_id?.source === 'environment' && (
                <p className="text-[13px] text-stone-700">Fourni par une variable du serveur.</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-bucket-name" className="block text-[13px] font-medium text-stone-800">
                Nom du bucket
              </label>
              <input
                id="r2-bucket-name"
                type="text"
                value={r2BucketName}
                onChange={(e) => setR2BucketName(e.target.value)}
                placeholder="Ex: mon-studio-bucket"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none"
              />
              {status.r2_bucket_name?.source === 'environment' && (
                <p className="text-[13px] text-stone-700">Fourni par une variable du serveur.</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-access-key-id" className="block text-[13px] font-medium text-stone-800">
                Identifiant de clé (Access Key ID)
              </label>
              <input
                id="r2-access-key-id"
                type="text"
                value={r2AccessKeyId}
                onChange={(e) => setR2AccessKeyId(e.target.value)}
                placeholder={secretPlaceholder('r2_access_key_id', 'Ex: 9876543210...')}
                autoComplete="off"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusLine status={status.r2_access_key_id} />
                {removeButton('r2_access_key_id')}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-secret-access-key" className="block text-[13px] font-medium text-stone-800">
                Clé secrète (Secret Access Key)
              </label>
              <div className="relative flex items-center">
                <input
                  id="r2-secret-access-key"
                  type={showR2Secret ? 'text' : 'password'}
                  value={r2SecretAccessKey}
                  onChange={(e) => setR2SecretAccessKey(e.target.value)}
                  placeholder={secretPlaceholder('r2_secret_access_key', 'Clé secrète…')}
                  autoComplete="off"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 pr-10 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowR2Secret(!showR2Secret)}
                  aria-label={showR2Secret ? 'Masquer la clé secrète' : 'Afficher la clé secrète'}
                  className="absolute right-3 max-lg:right-0 max-lg:inline-flex max-lg:size-11 max-lg:items-center max-lg:justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  {showR2Secret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusLine status={status.r2_secret_access_key} />
                {removeButton('r2_secret_access_key')}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="r2-public-url" className="block text-[13px] font-medium text-stone-800">
                Adresse publique des images
              </label>
              <input
                id="r2-public-url"
                type="url"
                value={r2PublicUrl}
                onChange={(e) => setR2PublicUrl(e.target.value)}
                placeholder="https://pub-xxxxxx.r2.dev"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 focus:border-stone-900 focus:outline-none"
              />
              <p className="text-[13px] text-stone-700 leading-relaxed mt-1">
                Indiquez l&apos;adresse publique du bucket (du type <code className="font-mono">https://pub-xxxxxxxx.r2.dev</code>), visible dans
                Cloudflare R2 &gt; votre bucket &gt; Paramètres &gt; Accès public. L&apos;adresse en <code className="font-mono">cloudflarestorage.com</code> ne convient
                pas : les images ne s&apos;afficheraient pas.
              </p>
            </div>
          </div>

          {r2TestResult && (
            <div role="status" className={`mt-4 p-3 rounded-lg text-[14px] font-medium flex items-center gap-2 border ${
              r2TestResult.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {r2TestResult.kind === 'ok' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-red-600 shrink-0" />}
              <span>{r2TestResult.text}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={handleTestR2} loading={testingR2} disabled={!isR2Configured}>
              {testingR2 ? 'Test en cours…' : 'Tester la connexion'}
            </Button>
          </div>
        </div>

        {/* 4. Bing IndexNow */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <Search size={16} /> Signalement des nouveaux articles à Bing (IndexNow)
              </h2>
              <Badge tone={isBingConfigured ? 'success' : 'neutral'}>
                {isBingConfigured ? 'Configuré' : 'Facultatif'}
              </Badge>
            </div>
            <a
              href="https://www.bing.com/webmasters/indexnow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-lg:min-h-11 items-center gap-1.5 text-[14px] font-medium text-stone-700 underline-offset-4 hover:text-stone-900 hover:underline shrink-0 w-fit"
            >
              <span>Créer une clé IndexNow</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="space-y-2">
            <label htmlFor="bing-key" className="block text-[13px] font-medium text-stone-800">
              Clé IndexNow
            </label>
            <input
              id="bing-key"
              type="text"
              value={bingKey}
              onChange={(e) => setBingKey(e.target.value)}
              placeholder="Ex: 1234567890abcdef..."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 font-mono focus:border-stone-900 focus:outline-none"
            />
            <p className="text-[13px] text-stone-700">Prévient Bing à chaque nouvel article publié, pour qu&apos;il l&apos;indexe plus vite.</p>
          </div>
        </div>

        {/* Bouton de sauvegarde globale */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {notice && (
            <span role="status" className={`text-[13px] font-medium ${notice.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
              {notice.text}
            </span>
          )}
          <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={loading || loadFailed}>
            Enregistrer les clés
          </Button>
        </div>
      </form>
    </div>
  );
}
