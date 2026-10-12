"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Send, Trash2 } from 'lucide-react';
import { Button, Callout, FormMessage } from '../ui';
import { adminFetch, errorMessage } from './lib';

/**
 * Notification sur le téléphone à chaque nouvelle demande de rendez-vous.
 *
 * Web Push : l'appareil s'abonne ici, le serveur (services/pushNotifications.ts)
 * lui écrit à chaque demande en ligne, le service worker `/admin/sw.js` l'affiche.
 */

interface Device {
  endpoint: string;
  label: string;
  created_at: string;
  last_ok_at: string | null;
}

type Msg = { type: 'success' | 'error'; text: string } | null;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Téléphone Android'
    : /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Macintosh/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'PC Windows'
    : 'Appareil';
  const browser = /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Edg\//i.test(ua) ? 'Edge'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : '';
  return browser ? `${os} — ${browser}` : os;
}

function formatDay(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
}

async function adminRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin' });
  return navigator.serviceWorker.ready;
}

export default function PushNotificationsCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [publicKey, setPublicKey] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [hereEndpoint, setHereEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
    try {
      const r = await adminFetch<{ publicKey: string; devices: Device[] }>('/api/admin/push');
      setPublicKey(r.publicKey);
      setDevices(r.devices);
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
    if (ok) {
      const reg = await navigator.serviceWorker.getRegistration('/admin').catch(() => undefined);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      setHereEndpoint(sub?.endpoint ?? null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeHere = !!hereEndpoint && devices.some((d) => d.endpoint === hereEndpoint);

  async function enable() {
    setBusy('enable');
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setMsg({ type: 'error', text: 'Les notifications n\'ont pas été autorisées sur cet appareil.' });
        return;
      }
      if (!publicKey) throw new Error('Clé de notification indisponible. Rechargez la page.');
      const reg = await adminRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      const r = await adminFetch<{ devices: Device[] }>('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON(), label: deviceLabel() }),
      });
      setDevices(r.devices);
      setHereEndpoint(sub.endpoint);
      setMsg({ type: 'success', text: 'Activé. Envoyez un essai pour vérifier.' });
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function remove(endpoint: string) {
    setBusy(endpoint === hereEndpoint ? 'disable' : endpoint);
    setMsg(null);
    try {
      if (endpoint === hereEndpoint) {
        const reg = await navigator.serviceWorker.getRegistration('/admin');
        const sub = await reg?.pushManager.getSubscription();
        await sub?.unsubscribe().catch(() => false);
        setHereEndpoint(null);
      }
      const r = await adminFetch<{ devices: Device[] }>('/api/admin/push', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint }),
      });
      setDevices(r.devices);
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    setMsg(null);
    try {
      const r = await adminFetch<{ sent: number; failed: number; devices: Device[] }>('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify({ action: 'test' }),
      });
      setDevices(r.devices);
      setMsg(
        r.sent > 0
          ? { type: 'success', text: `Notification d'essai envoyée sur ${r.sent} appareil${r.sent > 1 ? 's' : ''}.` }
          : { type: 'error', text: 'Aucun appareil n\'a pu être joint. Désactivez puis réactivez sur ce téléphone.' },
      );
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-stone-100 pt-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-accent" />
        <h3 className="text-sm font-bold text-stone-900">Notification sur le téléphone</h3>
      </div>
      <p className="text-[14px] lg:text-xs text-stone-600 font-light">
        Une notification arrive sur le téléphone dès qu&apos;une cliente dépose une demande de rendez-vous.
        En la touchant, la demande s&apos;ouvre. Activez-la depuis le téléphone qui doit la recevoir.
      </p>

      {loadError && <Callout tone="danger">{loadError}</Callout>}

      {supported === false && (
        <Callout tone="warning" title="Notifications non disponibles dans ce navigateur">
          Sur Android, ouvrez l&apos;administration dans Chrome. Sur iPhone, ajoutez-la d&apos;abord à l&apos;écran d&apos;accueil
          (Partager › Sur l&apos;écran d&apos;accueil), puis ouvrez-la depuis l&apos;icône.
        </Callout>
      )}

      {supported && permission === 'denied' && (
        <Callout tone="warning" title="Notifications bloquées sur cet appareil">
          Dans Chrome : touchez le cadenas à gauche de l&apos;adresse › Autorisations › Notifications › Autoriser,
          puis rechargez la page.
        </Callout>
      )}

      {supported && permission !== 'denied' && (
        <div className="flex flex-wrap items-center gap-2">
          {activeHere ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[14px] lg:text-xs font-semibold text-emerald-700">
                <Bell size={14} /> Activées sur cet appareil
              </span>
              <Button size="sm" icon={Send} loading={busy === 'test'} disabled={!!busy} onClick={test}>
                Envoyer un essai
              </Button>
              <Button size="sm" variant="ghost" icon={BellOff} loading={busy === 'disable'} disabled={!!busy} onClick={() => hereEndpoint && remove(hereEndpoint)}>
                Désactiver ici
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={Bell} loading={busy === 'enable'} disabled={!!busy || !publicKey} onClick={enable}>
              Activer sur cet appareil
            </Button>
          )}
        </div>
      )}

      <FormMessage message={msg} />

      {devices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[13px] lg:text-[11px] font-semibold text-stone-600">
            Appareils prévenus ({devices.length})
          </p>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {devices.map((d) => (
              <li key={d.endpoint} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[14px] lg:text-xs font-medium text-stone-800 truncate">
                    {d.label}
                    {d.endpoint === hereEndpoint && <span className="text-stone-500 font-normal"> · cet appareil</span>}
                  </div>
                  <div className="text-[13px] lg:text-[11px] text-stone-500">
                    Depuis le {formatDay(d.created_at)}
                    {d.last_ok_at ? ` · dernière notification le ${formatDay(d.last_ok_at)}` : ''}
                  </div>
                </div>
                {d.endpoint !== hereEndpoint && (
                  <Button size="sm" variant="ghost" icon={Trash2} loading={busy === d.endpoint} disabled={!!busy} onClick={() => remove(d.endpoint)} aria-label={`Retirer ${d.label}`}>
                    Retirer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
