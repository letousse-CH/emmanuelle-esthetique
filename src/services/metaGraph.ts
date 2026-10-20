/**
 * Client minimal de l'API Graph de Meta (Facebook Pages + Instagram via
 * Facebook Login), côté serveur uniquement.
 *
 *  - Une seule version d'API pour tout le module : la changer ici suffit.
 *    Meta garde une version deux ans ; v25.0 (février 2026) tient jusqu'en 2028.
 *  - Les paramètres partent dans le corps (`application/x-www-form-urlencoded`)
 *    et jamais dans l'URL : une légende de 2 000 caractères avec emojis dépasse
 *    vite la longueur d'une URL, et un jeton dans une URL finit dans les journaux.
 *  - Chaque appel a son délai : une fonction Netlify s'arrête à dix secondes,
 *    un appel qui pend ne doit pas emporter tout l'envoi.
 */
import { metaErrorMessage, type MetaErrorPayload } from '../types/social';

export const GRAPH_VERSION = 'v25.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DEFAULT_TIMEOUT_MS = 8000;

export class MetaError extends Error {
  readonly payload: MetaErrorPayload | null;
  /** Vrai si Meta n'a pas répondu (délai, réseau) : on ne sait pas si l'action a eu lieu. */
  readonly uncertain: boolean;

  constructor(payload: MetaErrorPayload | null, uncertain = false, message?: string) {
    super(message || metaErrorMessage(payload));
    this.name = 'MetaError';
    this.payload = payload;
    this.uncertain = uncertain;
  }

  get code(): number | undefined {
    return this.payload?.code;
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function toForm(params: Params): URLSearchParams {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    form.set(k, String(v));
  }
  return form;
}

async function request<T>(method: 'GET' | 'POST', path: string, params: Params, timeoutMs: number): Promise<T> {
  const url = `${GRAPH}/${path.replace(/^\/+/, '')}`;
  const form = toForm(params);
  let res: Response;
  try {
    res = method === 'GET'
      ? await fetch(`${url}?${form.toString()}`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
      : await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: AbortSignal.timeout(timeoutMs),
          cache: 'no-store',
        });
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new MetaError(
      null,
      true,
      timedOut ? 'Meta n’a pas répondu à temps.' : `Meta est injoignable (${err?.message || 'réseau'}).`,
    );
  }

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok || data?.error) {
    throw new MetaError((data?.error as MetaErrorPayload) ?? { message: `HTTP ${res.status}` });
  }
  return data as T;
}

export function graphGet<T = any>(path: string, params: Params, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return request<T>('GET', path, params, timeoutMs);
}

export function graphPost<T = any>(path: string, params: Params, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return request<T>('POST', path, params, timeoutMs);
}

/** Adresse du dialogue d'autorisation Facebook. */
export function oauthDialogUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  configId?: string | null;
}): string {
  const p = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: 'code',
    // Redemande les autorisations refusées et laisse rechoisir la Page.
    auth_type: 'rerequest',
  });
  // Application « Facebook Login for Business » : la configuration remplace la liste d'autorisations.
  if (opts.configId) p.set('config_id', opts.configId);
  else p.set('scope', opts.scopes.join(','));
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${p.toString()}`;
}
