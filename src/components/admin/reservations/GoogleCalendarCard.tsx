"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, CalendarPlus, ExternalLink, Link2 } from 'lucide-react';
import { Button, Callout, FormMessage } from '../ui';
import { adminFetch, errorMessage } from './lib';
import type { CalendarStatus } from '../../../services/googleCalendar';

/**
 * Connexion du compte Google dont l'agenda reçoit les rendez-vous confirmés
 * (services/googleCalendar.ts). Même client OAuth que Google Drive, connexion à part.
 */

type Msg = { type: 'success' | 'error'; text: string } | null;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default function GoogleCalendarCard({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await adminFetch<CalendarStatus>('/api/admin/google-calendar'));
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    // Retour de Google après la connexion (voir /api/admin/google-drive/callback).
    const params = new URLSearchParams(window.location.search);
    const gcal = params.get('gcal');
    if (gcal) {
      if (gcal === 'ok') {
        const sent = Number(params.get('envoyes')) || 0;
        const failed = Number(params.get('echecs')) || 0;
        setMsg(
          failed
            ? { type: 'error', text: `Google Agenda est connecté, mais ${plural(failed, 'rendez-vous n’a', 'rendez-vous n’ont')} pas pu y être ajouté${failed > 1 ? 's' : ''} (voir ci-dessous).` }
            : { type: 'success', text: `Google Agenda est connecté.${sent ? ` ${plural(sent, 'rendez-vous à venir y a été ajouté', 'rendez-vous à venir y ont été ajoutés')}.` : ''}` },
        );
      } else {
        setMsg({ type: 'error', text: params.get('message') || 'Connexion à Google Agenda impossible.' });
      }
      window.history.replaceState(null, '', `${window.location.pathname}?tab=booking`);
    }
    load();
  }, [load]);

  async function connect() {
    setBusy('connect');
    setMsg(null);
    try {
      const { url } = await adminFetch<{ url: string }>('/api/admin/google-calendar', {
        method: 'POST',
        body: JSON.stringify({ action: 'connect' }),
      });
      window.location.href = url;
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
      setBusy(null);
    }
  }

  async function sync() {
    setBusy('sync');
    setMsg(null);
    try {
      const r = await adminFetch<CalendarStatus & { created: number; failed: number }>('/api/admin/google-calendar', {
        method: 'POST',
        body: JSON.stringify({ action: 'sync' }),
      });
      setStatus(r);
      setMsg(
        r.failed
          ? { type: 'error', text: `${plural(r.failed, 'rendez-vous n’a', 'rendez-vous n’ont')} pas pu être ajouté${r.failed > 1 ? 's' : ''}${r.created ? ` (${r.created} ajouté${r.created > 1 ? 's' : ''})` : ''}.` }
          : { type: 'success', text: r.created ? `${plural(r.created, 'rendez-vous ajouté', 'rendez-vous ajoutés')} à l’agenda.` : 'Tous les rendez-vous à venir sont déjà dans l’agenda.' },
      );
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm('Déconnecter Google Agenda ? Les événements déjà créés restent dans l’agenda ; les prochains rendez-vous n’y seront plus ajoutés.')) return;
    setBusy('disconnect');
    setMsg(null);
    try {
      setStatus(await adminFetch<CalendarStatus>('/api/admin/google-calendar', { method: 'DELETE' }));
      setMsg({ type: 'success', text: 'Google Agenda déconnecté.' });
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!status) return <FormMessage message={msg} />;
  const problem = status.error || status.lastError;

  return (
    <div className="space-y-3 pt-3 border-t border-blue-100">
      {!status.configured && (
        <Callout tone="warning" title="Client Google à configurer d’abord">
          Saisissez l’ID client et le code secret Google dans le panneau Google Drive de la page{' '}
          <Link href="/admin/caisse/depenses" className="underline">Dépenses</Link> : le même client sert à l’agenda.
        </Callout>
      )}

      {status.configured && !status.connected && (
        <div className="space-y-3">
          <ol className="list-decimal pl-5 space-y-1 text-[14px] lg:text-xs text-stone-700">
            <li>
              Dans Google Cloud (le même projet que pour Google Drive), activez l’
              <a
                className="underline inline-flex items-center gap-0.5"
                href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
                target="_blank"
                rel="noreferrer"
              >
                API Google Calendar <ExternalLink size={11} aria-hidden="true" />
              </a>.
            </li>
            <li>
              Connectez le compte Google de l’agenda à remplir (celui du téléphone). Si Google affiche « Cette application n’a
              pas été validée », touchez <strong>Paramètres avancés</strong> puis <strong>Accéder à…</strong> : c’est votre
              propre application.
            </li>
          </ol>
          <Button type="button" variant="primary" icon={Link2} loading={busy === 'connect'} disabled={!!busy} onClick={connect}>
            Connecter Google Agenda
          </Button>
        </div>
      )}

      {status.connected && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-[14px] lg:text-xs">
            <CalendarCheck size={16} className={problem ? 'text-amber-600 shrink-0' : 'text-emerald-700 shrink-0'} />
            <span className="text-stone-800">
              Connecté à <strong>{status.account || 'un compte Google'}</strong>.{' '}
              {enabled
                ? 'Chaque rendez-vous à horaire fixé y est ajouté, déplacé ou retiré automatiquement. Les occupations de cet agenda grisent aussi les créneaux proposés en ligne.'
                : <span className="text-amber-700">Synchronisation en pause : activez l’interrupteur ci-dessus puis enregistrez.</span>}
            </span>
          </div>
          {problem && <Callout tone="danger" title="Google Agenda a refusé la dernière opération">{problem}</Callout>}
          <div className="flex flex-wrap gap-2">
            {enabled && (
              <Button type="button" size="sm" icon={CalendarPlus} loading={busy === 'sync'} disabled={!!busy} onClick={sync}>
                Envoyer les rendez-vous à venir
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" loading={busy === 'disconnect'} disabled={!!busy} onClick={disconnect}>
              Déconnecter
            </Button>
          </div>
        </div>
      )}

      <FormMessage message={msg} />
    </div>
  );
}
