"use client";

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, X, Bot, Mail, HardDrive, Database, ArrowRight } from 'lucide-react';
import FloatingPanel from '../pagebuilder/FloatingPanel';
import { BottomSheet } from './mobile/ui';

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
  /** Message quand le diagnostic lui-même n'a pas pu être lu. */
  fetchError?: string | null;
}

/**
 * Une ligne par service : son nom, son état en clair, et un lien vers le
 * réglage quand il y en a un. L'état est toujours dit par le texte et la
 * pastille — jamais par la seule couleur de fond.
 */
function ServiceRow({
  icon: Icon,
  title,
  detail,
  state,
  href,
  onNavigate,
}: {
  icon: React.ElementType;
  title: React.ReactNode;
  detail: string;
  state: 'ok' | 'warning' | 'unknown';
  href?: string;
  onNavigate?: () => void;
}) {
  const stateLabel = state === 'ok' ? 'Opérationnel' : state === 'warning' ? 'À régler' : 'Inconnu';
  const dot = state === 'ok' ? 'bg-emerald-500' : state === 'warning' ? 'bg-amber-500' : 'bg-stone-400';
  return (
    <div className="p-4 rounded-xl bg-white border border-stone-200 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-stone-100 text-stone-700 shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-[14px] text-stone-900">{title}</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-stone-700">
              <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
              {stateLabel}
            </span>
          </div>
          <p className="text-[13px] text-stone-600 mt-0.5 break-words">{detail}</p>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 h-11 lg:h-8 rounded-lg shrink-0 transition-colors"
        >
          <span>Régler</span>
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

export default function SystemHealthModal({
  isOpen,
  onClose,
  healthData,
  loading,
  onRefresh,
  fetchError,
}: Props) {
  // Téléphone : feuille qui monte du bas (la fenêtre flottante est faite pour la souris).
  const isPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023.98px)').matches;
  if (!isOpen && !isPhone) return null;

  const services = healthData?.services;
  const known = !!healthData;
  const allOk = !!healthData?.ok && (services ? Object.values(services).every((s) => s.ok) : true);
  const stateOf = (ok: boolean | undefined): 'ok' | 'warning' | 'unknown' =>
    !known ? 'unknown' : ok ? 'ok' : 'warning';

  const body = (
      <div className="space-y-4 lg:p-5 lg:overflow-y-auto lg:max-h-[75vh]">
        {/* Synthèse générale */}
        {!known ? (
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 flex items-start gap-3">
            <AlertTriangle size={18} className="text-stone-600 shrink-0 mt-0.5" />
            <p className="text-[14px] leading-relaxed">
              {loading
                ? 'Vérification des services en cours…'
                : fetchError || "L'état des services n'a pas pu être vérifié. Cliquez sur « Vérifier à nouveau »."}
            </p>
          </div>
        ) : (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            allOk ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-amber-50/60 border-amber-200 text-amber-900'
          }`}>
            {allOk ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />}
            <div>
              <p className="text-[14px] font-semibold mb-0.5">
                {allOk ? 'Tout fonctionne' : 'Un réglage est à compléter'}
              </p>
              <p className="text-[13px] leading-relaxed">
                {allOk
                  ? "La rédaction par l'IA, l'envoi d'e-mails, le stockage des images et la base de données répondent."
                  : 'Le site reste en ligne. Seules les fonctions marquées « À régler » sont indisponibles ; le bouton « Régler » mène au bon endroit.'}
              </p>
            </div>
          </div>
        )}

        {/* Détail par service */}
        <div className="space-y-3 pt-1">
          <ServiceRow
            icon={Bot}
            title={<>Rédaction par l&apos;IA{healthData?.modelLabel ? <span className="font-normal text-stone-600"> · {healthData.modelLabel}</span> : null}</>}
            state={stateOf(services?.ai?.ok ?? healthData?.ok)}
            detail={!known ? '—' : (services?.ai?.ok ?? healthData?.ok) ? 'Clé Anthropic valide.' : (services?.ai?.error || healthData?.error || 'Aucune clé Anthropic enregistrée.')}
            href="/admin/settings?tab=keys"
            onNavigate={onClose}
          />
          <ServiceRow
            icon={Mail}
            title="Envoi des e-mails (Resend)"
            state={stateOf(services?.resend?.ok)}
            detail={!known ? '—' : services?.resend?.ok ? 'Clé Resend configurée.' : 'Clé Resend absente : les e-mails automatiques ne partent pas.'}
            href="/admin/settings?tab=keys"
            onNavigate={onClose}
          />
          <ServiceRow
            icon={HardDrive}
            title="Stockage des images (R2)"
            state={stateOf(services?.r2?.ok)}
            detail={!known ? '—' : services?.r2?.ok ? 'Envoi de fichiers activé.' : "Envoi de fichiers désactivé ; les images s'ajoutent par leur adresse."}
            href="/admin/settings?tab=keys"
            onNavigate={onClose}
          />
          <ServiceRow
            icon={Database}
            title="Base de données"
            state={stateOf(services?.database?.ok)}
            detail={!known ? '—' : services?.database?.ok ? 'Connexion active.' : (services?.database?.error || 'Connexion impossible pour le moment.')}
          />
        </div>
      </div>
  );

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-stone-100 px-4 text-[15px] font-semibold text-stone-900 transition-colors cursor-pointer disabled:opacity-45 hover:bg-stone-200"
    >
      <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      <span>{loading ? 'Vérification…' : 'Vérifier à nouveau'}</span>
    </button>
  );

  if (isPhone) {
    return (
      <BottomSheet
        open={isOpen}
        onClose={onClose}
        title="État des services"
        footer={
          <div className="flex items-center justify-between gap-3">
            {refreshButton}
            <span className="text-[13px] text-stone-600">Gardé quelques minutes</span>
          </div>
        }
      >
        {body}
      </BottomSheet>
    );
  }

  return (
    <FloatingPanel
      storageKey="studio.systemHealthModal.box"
      ariaLabel="État des services du site"
      onClose={onClose}
      header={
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white text-stone-900 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-stone-100 text-stone-700">
              {allOk ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </div>
            <h3 className="text-[15px] font-semibold text-stone-950">
              État des services
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-700 hover:bg-stone-100 hover:text-stone-950 transition-colors cursor-pointer shrink-0"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-stone-50 border-t border-stone-200">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-45 hover:bg-stone-200"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Vérification…' : 'Vérifier à nouveau'}</span>
          </button>
          <span className="text-[13px] text-stone-600">Résultat gardé quelques minutes</span>
        </div>
      }
    >
      {body}
    </FloatingPanel>
  );
}
