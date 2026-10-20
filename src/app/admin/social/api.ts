/** Appels de l'écran Réseaux sociaux vers ses routes (jeton de session joint). */
import { supabase } from '../../../services/supabase';

export async function sessionToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly problems: string[] = []) {
    super(message);
  }
}

export async function api<T = any>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const token = await sessionToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      ...init,
      headers: {
        ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
        ...(body instanceof Blob ? { 'Content-Type': body.type } : {}),
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
      body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Connexion interrompue. Vérifiez le réseau puis réessayez.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error || `Erreur ${res.status}.`, res.status, Array.isArray(data?.problems) ? data.problems : []);
  }
  return data as T;
}

export interface MetaStatus {
  app: { configured: boolean; appId: string; configId: string; problem: string | null };
  connected: boolean;
  userName: string;
  page: { id: string; name: string } | null;
  instagram: { id: string; username: string } | null;
  health: 'ok' | 'expired' | 'error' | 'disconnected';
  healthMessage: string | null;
  needsPageChoice: boolean;
  redirectUri: string;
}

export function connectedNetworks(status: MetaStatus | null) {
  const usable = Boolean(status?.connected && status.health !== 'expired');
  return { facebook: usable && Boolean(status?.page), instagram: usable && Boolean(status?.instagram) };
}
