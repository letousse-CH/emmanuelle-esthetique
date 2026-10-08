"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FolderOpen, Link2, Share2, X } from 'lucide-react';
import { Button, Callout, Field, Input } from '../../../../components/admin/ui';
import { supabase } from '../../../../services/supabase';
import type { DriveStatus } from '../../../../services/googleDrive';

async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<DriveStatus & { url?: string }> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Erreur Google Drive (HTTP ${res.status}).`);
  return json;
}

/**
 * Archivage des justificatifs dans Google Drive et accès de la fiduciaire.
 * Replié sur une ligne une fois tout en place ; déplié tant qu'il reste une étape.
 */
export default function DrivePanel({ onNotice }: { onNotice: (message: string) => void }) {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [email, setEmail] = useState('');
  const [origin, setOrigin] = useState('');

  const run = useCallback(async (fn: () => Promise<DriveStatus | void>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) setStatus(next);
      if (done) onNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [onNotice]);

  useEffect(() => {
    setOrigin(window.location.origin);
    // Retour de Google après la connexion.
    const params = new URLSearchParams(window.location.search);
    const drive = params.get('drive');
    if (drive) {
      if (drive === 'ok') onNotice('Google Drive est connecté : les prochaines pièces y seront archivées.');
      else setError(params.get('message') || 'Connexion à Google Drive impossible.');
      setOpen(drive !== 'ok');
      window.history.replaceState(null, '', window.location.pathname);
    }
    run(() => call('GET', '/api/admin/google-drive'));
  }, [run, onNotice]);

  if (!status) return null;
  const ready = status.connected && !status.error;
  const expanded = open || !ready;

  return (
    <div className="bg-white rounded-xl border border-stone-200 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={16} className={ready ? 'text-emerald-700' : 'text-stone-500'} />
          <span className="text-stone-800 min-w-0">
            {ready ? (
              <>
                Justificatifs archivés dans Google Drive <span className="text-stone-500">({status.account})</span>
                {' · '}
                {status.sharedWith.length > 0
                  ? `partagé avec ${status.sharedWith.map((s) => s.email).join(', ')}`
                  : <span className="text-amber-700">pas encore partagé avec la fiduciaire</span>}
              </>
            ) : status.configured ? (
              'Google Drive n’est pas connecté : les pièces restent dans le coffre privé de l’admin.'
            ) : (
              'Archiver les justificatifs dans Google Drive, partagé avec la fiduciaire'
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status.folderUrl && (
            <a
              href={status.folderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              <ExternalLink size={13} /> Ouvrir le dossier
            </a>
          )}
          {ready && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
              {open ? 'Fermer' : 'Gérer'}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-100 px-4 py-4 space-y-4">
          {(error || status.error) && <Callout tone="danger">{error || status.error}</Callout>}

          {!status.configured && (
            <div className="space-y-3">
              <ol className="list-decimal pl-5 space-y-1 text-stone-700">
                <li>
                  Sur <a className="underline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a>,
                  créez un projet, puis activez l’<strong>API Google Drive</strong>.
                </li>
                <li>
                  « Google Auth Platform » : nom de l’app, e-mail d’assistance, audience <strong>Externe</strong>, puis
                  <strong> Publier l’application</strong> (en production : sinon Google coupe l’accès au bout de 7 jours).
                </li>
                <li>
                  « Clients » → Créer un client → <strong>Application Web</strong>, avec ces URI de redirection autorisées :
                  <code className="block mt-1 text-[12px] bg-stone-50 border border-stone-200 rounded px-2 py-1 break-all">
                    {origin}/api/admin/google-drive/callback
                  </code>
                  <span className="text-stone-500">(ajoutez aussi celle du site en ligne si vous êtes en local, et inversement)</span>
                </li>
                <li>Copiez ici l’ID client et le code secret client.</li>
              </ol>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="ID client">
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" />
                </Field>
                <Field label="Code secret client">
                  <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" />
                </Field>
              </div>
              <Button
                variant="primary"
                loading={busy}
                disabled={!clientId.trim() || !clientSecret.trim()}
                onClick={() => run(() => call('POST', '/api/admin/google-drive', { clientId, clientSecret }))}
              >
                Enregistrer les identifiants
              </Button>
            </div>
          )}

          {status.configured && !status.connected && (
            <div className="space-y-2">
              <p className="text-stone-700">
                Connectez le compte Google qui recevra le dossier « Justificatifs ». L’app ne verra que les fichiers qu’elle y dépose, jamais le reste du Drive.
              </p>
              <Button
                variant="primary"
                icon={Link2}
                loading={busy}
                onClick={() => run(async () => {
                  const { url } = await call('POST', '/api/admin/google-drive/connect');
                  if (url) window.location.href = url;
                })}
              >
                Connecter Google Drive
              </Button>
            </div>
          )}

          {status.connected && (
            <div className="space-y-3">
              <h4 className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Accès de la fiduciaire</h4>
              {status.sharedWith.length > 0 && (
                <ul className="space-y-1.5">
                  {status.sharedWith.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-1.5">
                      <span className="truncate">{s.name ? `${s.name} · ` : ''}{s.email} <span className="text-stone-500">(lecture)</span></span>
                      <button
                        type="button"
                        onClick={() => run(() => call('DELETE', '/api/admin/google-drive/share', { id: s.id }), `Accès retiré à ${s.email}.`)}
                        className="p-1 rounded text-stone-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label={`Retirer l’accès à ${s.email}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adresse@fiduciaire.ch" className="flex-1" />
                <Button
                  icon={Share2}
                  loading={busy}
                  disabled={!email.trim()}
                  onClick={() => run(async () => {
                    const next = await call('POST', '/api/admin/google-drive/share', { email });
                    setEmail('');
                    return next;
                  }, `Dossier partagé en lecture avec ${email.trim()} : Google lui envoie le lien par e-mail.`)}
                >
                  Partager en lecture
                </Button>
              </div>
              <p className="text-[12px] text-stone-500">
                Elle reçoit un e-mail de Google avec le lien du dossier, rangé par année puis par mois. Elle doit l’ouvrir avec un compte Google à cette adresse.
              </p>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy}
                  onClick={() => {
                    if (confirm('Déconnecter Google Drive ? Les pièces déjà déposées restent dans le dossier ; les suivantes iront dans le coffre privé de l’admin.')) {
                      run(() => call('DELETE', '/api/admin/google-drive'), 'Google Drive déconnecté.');
                    }
                  }}
                >
                  Déconnecter Google Drive
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
