"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { KeyRound, Mail, HardDrive, Search, Save, Check, Eye, EyeOff, Sparkles, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import AiKeyPanel from './AiKeyPanel';
import { settingsCache } from '../../../hooks/useSettings';

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

  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Test states
  const [testingR2, setTestingR2] = useState(false);
  const [r2TestResult, setR2TestResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleTestR2 = async () => {
    setTestingR2(true);
    setR2TestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/test-r2-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          r2AccountId,
          r2AccessKeyId,
          r2SecretAccessKey,
          r2BucketName,
          r2PublicUrl,
        })
      });
      const data = await res.json();
      if (data.success) {
        setR2TestResult({ kind: 'ok', text: data.message });
      } else {
        setR2TestResult({ kind: 'error', text: data.error || 'Erreur lors du test R2' });
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/admin/test-resend-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          resendApiKey,
          resendFromEmail,
        })
      });
      const data = await res.json();
      if (data.success) {
        setResendTestResult({ kind: 'ok', text: data.message });
      } else {
        setResendTestResult({ kind: 'error', text: data.error || 'Erreur lors du test Resend' });
      }
    } catch (err: any) {
      setResendTestResult({ kind: 'error', text: err?.message || 'Erreur réseau lors du test Resend' });
    } finally {
      setTestingResend(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const keysToFetch = [
        'resend_api_key',
        'resend_from_email',
        'r2_account_id',
        'r2_access_key_id',
        'r2_secret_access_key',
        'r2_bucket_name',
        'r2_public_url',
        'bing_indexnow_key',
      ];
      const { data } = await supabase.from('settings').select('key, value').in('key', keysToFetch);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));

      setResendApiKey(map.resend_api_key || '');
      setResendFromEmail(map.resend_from_email || '');
      setR2AccountId(map.r2_account_id || '');
      setR2AccessKeyId(map.r2_access_key_id || '');
      setR2SecretAccessKey(map.r2_secret_access_key || '');
      setR2BucketName(map.r2_bucket_name || '');
      setR2PublicUrl(map.r2_public_url || '');
      setBingKey(map.bing_indexnow_key || '');
    } catch (err) {
      console.error('[ApiKeysPanel] Erreur chargement des clés:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const rows = [
        { key: 'resend_api_key', value: resendApiKey.trim() },
        { key: 'resend_from_email', value: resendFromEmail.trim() },
        { key: 'r2_account_id', value: r2AccountId.trim() },
        { key: 'r2_access_key_id', value: r2AccessKeyId.trim() },
        { key: 'r2_secret_access_key', value: r2SecretAccessKey.trim() },
        { key: 'r2_bucket_name', value: r2BucketName.trim() },
        { key: 'r2_public_url', value: r2PublicUrl.trim() },
        { key: 'bing_indexnow_key', value: bingKey.trim() },
      ];

      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(error.message);

      rows.forEach((r) => settingsCache.set(r.key, r.value));
      setNotice({ kind: 'ok', text: 'Toutes les clés d’API et services ont été enregistrées avec succès !' });
    } catch (err: any) {
      setNotice({ kind: 'error', text: err?.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const isResendConfigured = Boolean(resendApiKey);
  const isR2Configured = Boolean(r2AccountId && r2AccessKeyId && r2SecretAccessKey && r2BucketName);
  const isBingConfigured = Boolean(bingKey);

  return (
    <div className="space-y-8 animate-fadein">
      {/* Notice Feedback */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            notice.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {notice.kind === 'ok' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-red-600 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 1. Anthropic Claude Key Panel */}
      <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
        <h2 className="text-[15px] font-semibold text-stone-900 border-b border-stone-200 pb-3 mb-6 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" /> Moteur IA — Clé Anthropic Claude
        </h2>
        <AiKeyPanel />
      </div>

      {/* Formulaire Clés Services (Resend, R2, Bing) */}
      <form onSubmit={handleSaveKeys} className="space-y-8">
        {/* 2. Resend Email Key */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <Mail size={16} className="text-blue-600" /> Service d'E-mails (Resend)
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                isResendConfigured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}>
                {isResendConfigured ? 'Configuré ✓' : 'Non configuré ⚠️'}
              </span>
            </div>
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200 transition-all shrink-0 w-fit"
            >
              <span>Obtenir ma clé Resend</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="resend-api-key" className="block text-[13px] font-medium text-stone-800">
                Clé API Resend (`RESEND_API_KEY`)
              </label>
              <div className="relative flex items-center">
                <input
                  id="resend-api-key"
                  type={showResendKey ? 'text' : 'password'}
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_123456789..."
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 pr-10 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <button
                  type="button"
                  onClick={() => setShowResendKey(!showResendKey)}
                  className="absolute right-3 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  {showResendKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[12px] text-stone-500">Utilisée pour l'envoi des formulaires de contact, e-mails de bienvenue et newsletters.</p>
            </div>

            <div className="space-y-2 pt-2">
              <label htmlFor="resend-from-email" className="block text-[13px] font-medium text-stone-800">
                Adresse Expéditeur (`RESEND_FROM_EMAIL`)
              </label>
              <input
                id="resend-from-email"
                type="email"
                value={resendFromEmail}
                onChange={(e) => setResendFromEmail(e.target.value)}
                placeholder="contact@votre-domaine.ch"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
          </div>

          {resendTestResult && (
            <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              resendTestResult.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {resendTestResult.kind === 'ok' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-red-600 shrink-0" />}
              <span>{resendTestResult.text}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleTestResend}
              disabled={testingResend || !resendApiKey}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {testingResend ? 'Test en cours...' : '🧪 Tester la clé Resend'}
            </button>
          </div>
        </div>

        {/* 3. Cloudflare R2 Storage */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <HardDrive size={16} className="text-orange-600" /> Stockage Médias (Cloudflare R2 / S3)
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                isR2Configured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}>
                {isR2Configured ? 'Configuré ✓' : 'Non configuré ⚠️'}
              </span>
            </div>
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-3.5 py-1.5 rounded-full border border-orange-200 transition-all shrink-0 w-fit"
            >
              <span>Obtenir mes clés Cloudflare R2</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="r2-account-id" className="block text-[13px] font-medium text-stone-800">
                Account ID (`R2_ACCOUNT_ID`)
              </label>
              <input
                id="r2-account-id"
                type="text"
                value={r2AccountId}
                onChange={(e) => setR2AccountId(e.target.value)}
                placeholder="Ex: a1b2c3d4e5f6..."
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-bucket-name" className="block text-[13px] font-medium text-stone-800">
                Bucket Name (`R2_BUCKET_NAME`)
              </label>
              <input
                id="r2-bucket-name"
                type="text"
                value={r2BucketName}
                onChange={(e) => setR2BucketName(e.target.value)}
                placeholder="Ex: mon-studio-bucket"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-access-key-id" className="block text-[13px] font-medium text-stone-800">
                Access Key ID (`R2_ACCESS_KEY_ID`)
              </label>
              <input
                id="r2-access-key-id"
                type="text"
                value={r2AccessKeyId}
                onChange={(e) => setR2AccessKeyId(e.target.value)}
                placeholder="Ex: 9876543210..."
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="r2-secret-access-key" className="block text-[13px] font-medium text-stone-800">
                Secret Access Key (`R2_SECRET_ACCESS_KEY`)
              </label>
              <div className="relative flex items-center">
                <input
                  id="r2-secret-access-key"
                  type={showR2Secret ? 'text' : 'password'}
                  value={r2SecretAccessKey}
                  onChange={(e) => setR2SecretAccessKey(e.target.value)}
                  placeholder="Secret key..."
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 pr-10 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowR2Secret(!showR2Secret)}
                  className="absolute right-3 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  {showR2Secret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="r2-public-url" className="block text-[13px] font-medium text-stone-800">
                URL Publique du domaine/bucket (`NEXT_PUBLIC_R2_PUBLIC_URL`)
              </label>
              <input
                id="r2-public-url"
                type="url"
                value={r2PublicUrl}
                onChange={(e) => setR2PublicUrl(e.target.value)}
                placeholder="https://pub-xxxxxx.r2.dev"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
              />
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-1 font-medium leading-relaxed">
                💡 <strong>Important pour l'affichage des images :</strong> Ne pas mettre l'URL S3 <code>cloudflarestorage.com</code> (qui renvoie du XML). Renseignez l'URL publique de votre bucket (ex: <code>https://pub-xxxxxxxx.r2.dev</code>) que vous obtenez dans Cloudflare R2 &gt; <em>Bucket kinetick &gt; Paramètres &gt; Accès Public (R2.dev)</em>.
              </p>
            </div>
          </div>

          {r2TestResult && (
            <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              r2TestResult.kind === 'ok' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
            }`}>
              {r2TestResult.kind === 'ok' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={15} className="text-red-600 shrink-0" />}
              <span>{r2TestResult.text}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleTestR2}
              disabled={testingR2 || !r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName}
              className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {testingR2 ? 'Test R2 en cours...' : '🧪 Tester la connexion Cloudflare R2'}
            </button>
          </div>
        </div>

        {/* 4. Bing IndexNow */}
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] p-6 md:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-stone-900 flex items-center gap-2">
                <Search size={16} className="text-emerald-600" /> Bing IndexNow (Indexation SEO instantanée)
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                isBingConfigured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}>
                {isBingConfigured ? 'Configuré ✓' : 'Optionnel'}
              </span>
            </div>
            <a
              href="https://www.bing.com/webmasters/indexnow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-200 transition-all shrink-0 w-fit"
            >
              <span>Générer ma clé IndexNow</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="space-y-2">
            <label htmlFor="bing-key" className="block text-[13px] font-medium text-stone-800">
              Clé Bing IndexNow (`BING_INDEXNOW_KEY`)
            </label>
            <input
              id="bing-key"
              type="text"
              value={bingKey}
              onChange={(e) => setBingKey(e.target.value)}
              placeholder="Ex: 1234567890abcdef..."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:border-stone-900 focus:outline-none"
            />
            <p className="text-[12px] text-stone-500">Notifie automatiquement Bing lors de la publication d'un nouvel article de blog.</p>
          </div>
        </div>

        {/* Bouton de sauvegarde globale */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || loading}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 text-white font-extrabold px-8 py-3.5 rounded-full shadow-[0_4px_14px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            <span>{saving ? 'Enregistrement...' : 'Sauvegarder les clés & services'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
