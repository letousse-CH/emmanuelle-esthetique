"use client";

/**
 * Suivi côté admin d'une tâche IA longue (voir services/aiJobs.ts).
 *
 * `start(kind, input)` crée la tâche (POST /api/admin/ai-jobs), puis interroge
 * son état toutes les 2 s jusqu'au résultat ou à l'erreur (12 min au plus).
 * Avec une clé de stockage, l'identifiant de la tâche est gardé dans
 * sessionStorage : après un rechargement de la page, le suivi reprend et le
 * résultat s'affiche quand même.
 *
 * `runAiJob` fait la même chose sous forme de promesse, pour les écrans qui
 * attendent un résultat unique (fenêtre d'assistant, bouton ponctuel).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

export type AiJobKind =
  | 'article'
  | 'blog-post'
  | 'page'
  | 'page-modify'
  | 'page-style'
  | 'site-structure'
  | 'import-site'
  | 'editorial-synthesis'
  | 'keyword-scan'
  | 'blocks-ai';

export type AiJobUiStatus = 'idle' | 'pending' | 'running' | 'done' | 'error';

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 12 * 60_000;
/** Erreurs réseau consécutives tolérées pendant le suivi (Wi-Fi qui décroche…). */
const MAX_POLL_FAILURES = 5;
const STORAGE_PREFIX = 'aiJob:';

interface StoredJob {
  id: string;
  kind: AiJobKind;
  startedAt: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  if (!token) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');
  return { Authorization: `Bearer ${token}` };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Crée la tâche et renvoie son identifiant. */
export async function createAiJob(kind: AiJobKind, input: Record<string, unknown>): Promise<string> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch('/api/admin/ai-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ kind, input }),
    });
  } catch {
    throw new Error('Le serveur ne répond pas. Vérifiez votre connexion internet puis réessayez.');
  }
  const data: any = await res.json().catch(() => null);
  if (res.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');
  if (!res.ok || !data?.id) {
    throw new Error(data?.error || `La génération n'a pas pu être lancée (erreur ${res.status}).`);
  }
  return data.id as string;
}

export interface AiJobSnapshot {
  status: 'pending' | 'running' | 'done' | 'error';
  result: unknown;
  error: string | null;
  created_at?: string;
}

/**
 * Interroge la tâche jusqu'à la fin. Résout avec le résultat, rejette avec
 * le message d'erreur de la tâche.
 */
export async function waitForAiJob<T = unknown>(
  id: string,
  opts: { signal?: AbortSignal; onUpdate?: (snap: AiJobSnapshot) => void; startedAt?: number } = {},
): Promise<T> {
  const startedAt = opts.startedAt ?? Date.now();
  let failures = 0;

  while (true) {
    if (Date.now() - startedAt > MAX_WAIT_MS) {
      throw new Error("La génération n'a pas abouti dans le délai prévu (12 minutes). Relancez-la dans un instant.");
    }
    try {
      const res = await fetch(`/api/admin/ai-jobs/${encodeURIComponent(id)}`, {
        headers: await authHeaders(),
        cache: 'no-store',
        signal: opts.signal,
      });
      const data: any = await res.json().catch(() => null);
      if (res.status === 401) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');
      if (res.status === 404) throw new Error('Cette génération est introuvable. Relancez-la.');
      if (!res.ok || !data) throw new Error(data?.error || `Erreur ${res.status}`);

      failures = 0;
      opts.onUpdate?.(data as AiJobSnapshot);
      if (data.status === 'done') return data.result as T;
      if (data.status === 'error') {
        const err = new Error(data.error || 'La génération a échoué.');
        (err as any).fromJob = true;
        throw err;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      // Erreur de la tâche elle-même, ou session expirée : on s'arrête.
      if (err?.fromJob || /session|introuvable/i.test(err?.message ?? '')) throw err;
      failures += 1;
      if (failures >= MAX_POLL_FAILURES) {
        throw new Error('Le suivi de la génération a été interrompu (connexion instable). Rechargez la page pour le reprendre.');
      }
    }
    await wait(POLL_INTERVAL_MS, opts.signal);
  }
}

/** Crée la tâche puis attend son résultat. */
export async function runAiJob<T = unknown>(
  kind: AiJobKind,
  input: Record<string, unknown>,
  opts: { signal?: AbortSignal; onUpdate?: (snap: AiJobSnapshot) => void } = {},
): Promise<T> {
  const id = await createAiJob(kind, input);
  return waitForAiJob<T>(id, opts);
}

function readStored(key?: string): StoredJob | null {
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredJob;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(key: string | undefined, job: StoredJob | null) {
  if (!key) return;
  try {
    if (job) window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(job));
    else window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Navigation privée, stockage bloqué : le suivi fonctionne sans reprise.
  }
}

export interface UseAiJob<T> {
  status: AiJobUiStatus;
  result: T | null;
  error: string;
  elapsedSeconds: number;
  /** Vrai pendant l'attente (tâche créée, en attente ou en cours). */
  isBusy: boolean;
  start: (kind: AiJobKind, input: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
}

/**
 * @param storageKey identifiant de l'écran (ex. `article:<id>`) ; active la
 *   reprise après rechargement. Sans clé, pas de reprise.
 */
export function useAiJob<T = unknown>(storageKey?: string): UseAiJob<T> {
  const [status, setStatus] = useState<AiJobUiStatus>('idle');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  const follow = useCallback(async (job: StoredJob): Promise<T | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStartedAt(job.startedAt);
    setStatus((s) => (s === 'running' ? s : 'pending'));
    try {
      const value = await waitForAiJob<T>(job.id, {
        signal: controller.signal,
        startedAt: job.startedAt,
        onUpdate: (snap) => {
          if (snap.status === 'running' || snap.status === 'pending') setStatus(snap.status);
        },
      });
      if (controller.signal.aborted) return null;
      setResult(value);
      setStatus('done');
      return value;
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) return null;
      setError(err?.message || 'La génération a échoué.');
      setStatus('error');
      writeStored(storageKey, null);
      return null;
    }
  }, [storageKey]);

  // Reprise d'une tâche lancée avant un rechargement.
  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored) void follow(stored);
  }, [storageKey, follow]);

  // Arrêt du suivi quand l'écran disparaît (la tâche, elle, continue).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Chronomètre, une fois par seconde pendant l'attente.
  const isBusy = status === 'pending' || status === 'running';
  useEffect(() => {
    if (!isBusy) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isBusy]);

  const start = useCallback(async (kind: AiJobKind, input: Record<string, unknown>) => {
    abortRef.current?.abort();
    setResult(null);
    setError('');
    setStatus('pending');
    const begin = Date.now();
    setStartedAt(begin);
    let id: string;
    try {
      id = await createAiJob(kind, input);
    } catch (err: any) {
      setError(err?.message || "La génération n'a pas pu être lancée.");
      setStatus('error');
      return null;
    }
    const job: StoredJob = { id, kind, startedAt: begin };
    writeStored(storageKey, job);
    return follow(job);
  }, [follow, storageKey]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    writeStored(storageKey, null);
    setStatus('idle');
    setResult(null);
    setError('');
    setStartedAt(null);
  }, [storageKey]);

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  return { status, result, error, elapsedSeconds, isBusy, start, reset };
}

/** « 0:42 », « 3:05 ». */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
