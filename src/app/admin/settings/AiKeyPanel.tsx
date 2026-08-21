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

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/ai-key', { headers: await authHeaders() });
    if (response.ok) setStatus(await response.json());
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: string) {
    setBusy(true);
    setNotice(null);
    const response = await fetch('/api/admin/ai-key', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ value: next }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setNotice({ kind: 'error', text: payload?.error ?? 'Enregistrement impossible.' });
      return;
    }
    setValue('');
    setNotice({
      kind: 'ok',
      text: next ? 'Clé vérifiée et enregistrée.' : 'Clé retirée.',
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <KeyRound size={15} className="text-stone-500" />
          Clé d&apos;API Anthropic
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-500">
          Elle alimente toutes les fonctions de génération : rédaction
          d&apos;articles, suggestions de mots-clés, posts réseaux, agents et
          import de site. Sans elle, ces fonctions restent inactives ; le reste
          du site fonctionne normalement.
        </p>
      </div>

      {status && (
        <div
          className={`flex items-start gap-3 border p-3 ${
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
                Clé active <span className="font-mono text-stone-500">{status.hint}</span>
                {status.source === 'environment' && (
                  <span className="text-stone-500">
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
        <label htmlFor="anthropic-key" className="mb-1.5 block text-xs font-medium text-stone-600">
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
              className="w-full border border-stone-200 py-2.5 pr-10 pl-3 font-mono text-sm focus:border-stone-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer la clé' : 'Afficher la clé'}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-stone-500 transition-colors hover:text-stone-700 cursor-pointer"
            >
              {visible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void save(value)}
            disabled={busy || !value.trim()}
            className="flex items-center gap-2 bg-stone-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-stone-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Vérifier et enregistrer
          </button>
        </div>
      </div>

      {notice && (
        <p
          className={`border p-3 text-sm leading-relaxed ${
            notice.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <a
          href="https://platform.claude.com/"
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-1.5 text-sm text-stone-600 underline-offset-4 transition-colors hover:text-stone-900 hover:underline"
        >
          Obtenir une clé sur platform.claude.com
          <ExternalLink size={13} className="transition-transform group-hover:-translate-y-0.5" />
        </a>

        {status?.source === 'admin' && (
          <button
            type="button"
            onClick={() => void save('')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 transition-colors hover:text-red-600 cursor-pointer"
          >
            <Trash2 size={13} />
            Retirer la clé
          </button>
        )}
      </div>

      <p className="border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
        La clé est stockée dans une table à part, inaccessible aux visiteurs du
        site. Elle ne redescend jamais dans le navigateur : cet écran n&apos;en
        affiche que les quatre derniers caractères.
      </p>
    </div>
  );
}
