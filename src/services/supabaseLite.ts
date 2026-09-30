/**
 * Accès Supabase « léger » pour le site public.
 *
 * `@supabase/supabase-js` (auth, realtime, storage…) pèse ~215 Ko de JavaScript
 * décompressé, chargé et évalué sur chaque page par tout visiteur — alors que
 * le site public ne fait que trois choses : lire les réglages, enregistrer une
 * vue de page, inscrire une adresse à la newsletter. Ces trois appels sont de
 * simples requêtes PostgREST avec la clé anonyme ; on les fait donc avec
 * `fetch`, sans le client.
 *
 * Règle : ce module ne doit **jamais** importer `@supabase/supabase-js` ni
 * `services/supabase`. Le vrai client n'est chargé (import dynamique) que
 * lorsqu'une session d'administratrice est détectée (`hasStoredSession`).
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Vrai si le navigateur porte une session Supabase (clé `sb-<projet>-auth-token`
 * dans localStorage). Sert de portillon : sans session, aucun besoin du client
 * complet, donc aucun de ses 215 Ko.
 */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    // localStorage indisponible : pas de session lisible.
  }
  return false;
}

function headers(extra?: Record<string, string>): HeadersInit {
  return { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, ...extra };
}

export interface LiteResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** GET /rest/v1/<table>?<query> — `query` est déjà encodé (ex. `select=key,value`). */
export async function liteSelect<T>(table: string, query: string): Promise<LiteResult<T>> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, { headers: headers() });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try { message = (await res.json())?.message || message; } catch { /* corps non JSON */ }
      return { data: null, error: { message } };
    }
    return { data: (await res.json()) as T, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Réglages publics, via notre route `/api/public-settings` (même origine : pas de
 * préflight CORS, pas de connexion vers supabase.co, réponse cachée par le CDN).
 */
export async function liteSettingsRows(): Promise<LiteResult<{ key: string; value: string | null }[]>> {
  try {
    const res = await fetch('/api/public-settings');
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}` } };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/** POST /rest/v1/<table> sans relecture de la ligne (l'anonyme n'a pas de policy SELECT dessus). */
export async function liteInsert(table: string, row: Record<string, unknown>): Promise<{ error: { message: string; code?: string } | null }> {
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/${table}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
      keepalive: true,
    });
    if (res.ok) return { error: null };
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const j = await res.json();
      message = j?.message || message;
      code = j?.code;
    } catch { /* corps non JSON */ }
    return { error: { message, code } };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
