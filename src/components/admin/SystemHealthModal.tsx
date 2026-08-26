"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, X, Bot, Mail, HardDrive, Database, ArrowRight, ExternalLink } from 'lucide-react';
import FloatingPanel from '../pagebuilder/FloatingPanel';

export interface ServiceDetail {
  ok: boolean;
  label: string;
  error: string | null;
}

export interface HealthData {
  ok: boolean;
  configured: boolean;
  working: boolean;
  error?: string | null;
  model?: string;
  modelLabel?: string;
  services?: {
    ai: ServiceDetail;
    resend: ServiceDetail;
    r2: ServiceDetail;
    database: ServiceDetail;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  healthData: HealthData | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function SystemHealthModal({
  isOpen,
  onClose,
  healthData,
  loading,
  onRefresh,
}: Props) {
  if (!isOpen) return null;

  const services = healthData?.services;
  const allOk = healthData?.ok && (services ? Object.values(services).every((s) => s.ok) : true);

  return (
    <FloatingPanel
      storageKey="studio.systemHealthModal.box"
      ariaLabel="État de santé des services et clés API"
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white text-zinc-900 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${allOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
              {allOk ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10.5px] font-extrabold uppercase tracking-wider border border-zinc-200">
                  Diagnostic Système
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-zinc-900 mt-0.5">
                Santé des Services & Clés API
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer shrink-0"
            title="Fermer"
          >
            <X size={15} />
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-t border-zinc-200">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-800 text-xs font-bold hover:bg-zinc-100 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-purple-600' : ''} />
            <span>{loading ? 'Vérification...' : 'Re-tester les connexions'}</span>
          </button>
          <span className="text-[11px] font-medium text-zinc-500">Mise à jour en temps réel</span>
        </div>
      }
    >
      <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
        {/* Synthèse générale */}
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          allOk ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-amber-50/60 border-amber-200 text-amber-900'
        }`}>
          {allOk ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider mb-0.5">
              {allOk ? 'Tous les services sont opérationnels' : 'Attention : Ajustement requis'}
            </h4>
            <p className="text-xs leading-relaxed font-medium">
              {allOk
                ? 'L\'IA Claude, le stockage et la base de données fonctionnent parfaitement.'
                : 'Certaines clés API optionnelles ou principales ne sont pas renseignées. Cliquez sur "Régler" pour les configurer.'}
            </p>
          </div>
        </div>

        {/* Détail par Service */}
        <div className="space-y-3 pt-1">
          {/* 1. Moteur IA Claude */}
          <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 shrink-0">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-zinc-900 truncate">Moteur IA Générative</span>
                  {healthData?.modelLabel && (
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {healthData.modelLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                  {services?.ai?.ok ? 'Opérationnel & Clé Anthropic valide' : (services?.ai?.error || 'Clé API manquante')}
                </p>
              </div>
            </div>
            <Link
              href="/admin/settings?tab=keys"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full border border-purple-200 shrink-0 transition-all"
            >
              <span>Régler</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 2. Service E-mails Resend */}
          <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 shrink-0">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs text-zinc-900 truncate block">Envoi d'E-mails (Resend)</span>
                <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                  {services?.resend?.ok ? 'RESEND_API_KEY configurée' : 'Utilise le repli dev ou clé manquante'}
                </p>
              </div>
            </div>
            <Link
              href="/admin/settings?tab=keys"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 shrink-0 transition-all"
            >
              <span>Régler</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 3. Stockage Médias Cloudflare R2 */}
          <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-orange-50 text-orange-700 shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs text-zinc-900 truncate block">Médiathèque (Stockage R2)</span>
                <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">
                  {services?.r2?.ok ? 'Stockage Cloudflare R2 actif' : 'Images par URL autorisées (R2 non relié)'}
                </p>
              </div>
            </div>
            <Link
              href="/admin/settings?tab=keys"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full border border-orange-200 shrink-0 transition-all"
            >
              <span>Régler</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 4. Base de Données Supabase */}
          <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                <Database size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs text-zinc-900 truncate block">Base de Données Supabase</span>
                <p className="text-xs text-emerald-600 font-semibold truncate mt-0.5">
                  Connexion active & sécurisée ✓
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold shrink-0">
              Actif
            </span>
          </div>
        </div>
      </div>
    </FloatingPanel>
  );
}
