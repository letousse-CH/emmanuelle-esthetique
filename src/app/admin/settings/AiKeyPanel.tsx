'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Trash2 } from 'lucide-react';

import { supabase } from '../../../services/supabase';

/**
 * Saisie de la clé d'API Anthropic.
 *
 * La valeur n'est jamais renvoyée au navigateur : l'écran affiche seulement
 * son état et ses quatre derniers caractères. C'est suffisant pour vérifier
 * qu'on a collé la bonne clé, et cela évite qu'elle traîne dans une page,
 * un cache ou une capture d'écran.
 *
 * Elle est aussi validée auprès d'Anthropic avant enregistrement — découvrir
 * qu'elle est invalide au premier article généré serait une perte de temps.
 */

interface KeyStatus {
  configured: boolean;
  source: 'admin' | 'environment' | null;
  hint: string | null;
  storage?: 'ok' | 'missing_table' | 'no_service_key';
}

export default function AiKeyPanel() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    };
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/ai-key', { headers: await authHeaders() });
      if (!response.ok) {
        setLoadError(response.status === 401
          ? "Votre session a expiré : reconnectez-vous pour voir l'état de la clé."
          : `L'état de la clé n'a pas pu être lu (erreur ${response.status}).`);
        return;
      }
      setLoadError(null);
      setStatus(await response.json());
    } catch {
      setLoadError("L'état de la clé n'a pas pu être lu. Vérifiez votre connexion puis rechargez la page.");
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: string) {
    if (!next && !confirm("Retirer la clé Anthropic ? Les fonctions de rédaction par l'IA s'arrêteront jusqu'à ce qu'une nouvelle clé soit saisie.")) return;
    setBusy(true);
    setNotice(null);
    let response: Response;
    let payload: any = {};
    try {
      response = await fetch('/api/admin/ai-key', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ value: next }),
      });
      payload = await response.json().catch(() => ({}));
    } catch {
      setBusy(false);
      setNotice({ kind: 'error', text: "La clé n'a pas été enregistrée : connexion impossible. Vérifiez votre réseau puis réessayez." });
      return;
    }
    setBusy(false);

    if (!response.ok) {
      setNotice({ kind: 'error', text: payload?.error ?? `La clé n'a pas été enregistrée (erreur ${response.status}). Réessayez.` });
      return;
    }
    setValue('');
    setNotice({
      kind: payload?.warning ? 'error' : 'ok',
      text: payload?.warning ?? (next ? 'Clé vérifiée et enregistrée. Les fonctions IA sont prêtes.' : 'Clé retirée.'),
    });
    await load();
    // Le bandeau d'état de l'admin se remet à jour sans recharger la page.
    window.dispatchEvent(new Event('admin:ai-key-changed'));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <KeyRound size={15} className="text-stone-600" />
          Clé d&apos;API Anthropic
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Elle alimente toutes les fonctions de génération : rédaction
          d&apos;articles, suggestions de mots-clés, posts réseaux, agents et
          import de site. Sans elle, ces fonctions restent inactives ; le reste
          du site fonctionne normalement.
        </p>
      </div>

      {status?.storage === 'missing_table' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          La base de données n&apos;a pas encore la table qui range les clés. Tant qu&apos;elle manque,
          aucune clé ne peut être enregistrée ici. Appliquez le fichier
          <span className="font-mono"> supabase/a-appliquer/2026-09-27_tables-manquantes.sql</span> dans
          Supabase (SQL Editor), puis rechargez cette page.
        </p>
      )}
      {status?.storage === 'no_service_key' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
          Le serveur n&apos;a pas sa clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) : il ne peut pas
          enregistrer de clé. Ajoutez-la dans les variables d&apos;environnement de Netlify.
        </p>
      )}

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>
      )}

      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-3 ${
            status.configured ? 'border-stone-200 bg-stone-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          {status.configured ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-600" />
          )}
          <p className="text-sm leading-relaxed text-stone-700">
            {status.configured ? (
              <>
                Clé active <span className="font-mono text-stone-600">{status.hint}</span>
                {status.source === 'environment' && (
                  <span className="text-stone-600">
                    {' '}
                    — fournie par la configuration du serveur. En saisir une ici la remplacera.
                  </span>
                )}
              </>
            ) : (
              'Aucune clé configurée. Les fonctions IA sont désactivées.'
            )}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="anthropic-key" className="mb-1.5 block text-[13px] font-medium text-stone-800">
          {status?.configured ? 'Remplacer la clé' : 'Coller la clé'}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="anthropic-key"
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-stone-300 py-2.5 pr-10 pl-3 font-mono text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer la clé' : 'Afficher la clé'}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-stone-600 transition-colors hover:text-stone-700 cursor-pointer"
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void save(value)}
            disabled={busy || !value.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 h-10 text-[14px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-45 cursor-pointer disabled:cursor-default whitespace-nowrap"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Vérifier et enregistrer
          </button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className={`rounded-lg border p-3 text-sm leading-relaxed ${
            notice.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <a
          href="https://platform.claude.com/"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 text-sm text-stone-700 underline-offset-4 transition-colors hover:text-stone-900 hover:underline"
        >
          Obtenir une clé sur platform.claude.com
          <ExternalLink size={13} className="transition-transform " />
        </a>

        {status?.source === 'admin' && (
          <button
            type="button"
            onClick={() => void save('')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm text-red-700 transition-colors hover:text-red-800 cursor-pointer disabled:opacity-45"
          >
            <Trash2 size={13} />
            Retirer la clé
          </button>
        )}
      </div>

      <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-[13px] leading-relaxed text-stone-700">
        La clé est stockée dans une table à part, inaccessible aux visiteurs du
        site. Elle ne redescend jamais dans le navigateur : cet écran n&apos;en
        affiche que les quatre derniers caractères.
      </p>
    </div>
  );
}
