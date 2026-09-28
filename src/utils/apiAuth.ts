/**
 * Contrôle d'accès des routes API.
 *
 * Deux portes d'entrée pour une route d'administration :
 *  - une session Supabase dont l'e-mail figure dans ADMIN_EMAILS ;
 *  - un appel serveur-à-serveur (cron, autopilote) qui présente l'en-tête
 *    `x-internal-secret` égal à INTERNAL_API_SECRET.
 *
 * Tant qu'ADMIN_EMAILS n'est pas renseignée, tout utilisateur authentifié est
 * accepté (comportement d'avant) avec un avertissement dans les journaux :
 * les inscriptions Supabase doivent alors être fermées.
 */

let warnedNoAdminList = false;

/** Liste des e-mails administrateurs (ADMIN_EMAILS, séparés par des virgules). */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Vrai si l'e-mail est administrateur (ou si aucune liste n'est configurée). */
export function isAdminEmail(email: string | null | undefined): boolean {
  const admins = getAdminEmails();
  if (admins.length === 0) {
    if (!warnedNoAdminList) {
      warnedNoAdminList = true;
      console.warn(
        '[apiAuth] ADMIN_EMAILS est vide : tout compte connecté est traité comme administrateur. ' +
          'Renseignez ADMIN_EMAILS et fermez les inscriptions dans Supabase.',
      );
    }
    return true;
  }
  return Boolean(email) && admins.includes(String(email).trim().toLowerCase());
}

/** Extrait le jeton « Bearer » de l'en-tête Authorization. */
export function getBearerToken(req: { headers: Headers }): string {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

/**
 * Vérifie qu'un jeton Supabase est valide ET appartient à un administrateur.
 * Nom conservé pour compatibilité avec les routes existantes.
 */
export async function validateSupabaseToken(token: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !token) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return false;
    const user = (await res.json().catch(() => null)) as { id?: string; email?: string } | null;
    if (!user?.id) return false;
    return isAdminEmail(user.email);
  } catch { return false; }
}

/** Comparaison de chaînes à temps constant (pas de dépendance à `crypto`). */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Secret des appels internes. INTERNAL_API_SECRET en priorité ; à défaut
 * CRON_SECRET, pour que l'autopilote continue de fonctionner tant que la
 * nouvelle variable n'est pas posée.
 */
function internalSecret(): string {
  return (process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '').trim();
}

/** Vrai si la requête vient du serveur lui-même (en-tête x-internal-secret). */
export function isInternalRequest(req: { headers: Headers }): boolean {
  const expected = internalSecret();
  if (!expected) return false;
  const provided = (req.headers.get('x-internal-secret') || '').trim();
  if (!provided) return false;
  return safeEqual(provided, expected);
}

/** En-têtes à joindre à un appel serveur-à-serveur vers une route protégée. */
export function internalHeaders(): Record<string, string> {
  const secret = internalSecret();
  return secret ? { 'x-internal-secret': secret } : {};
}

/** Vrai si la requête vient d'un administrateur connecté ou d'un appel interne. */
export async function isAdminRequest(req: { headers: Headers }): Promise<boolean> {
  if (isInternalRequest(req)) return true;
  return validateSupabaseToken(getBearerToken(req));
}

/** Vrai si le secret de tâche planifiée (CRON_SECRET) est présenté. */
export function hasCronSecret(provided: string | null | undefined): boolean {
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected || !provided) return false;
  return safeEqual(provided.trim(), expected);
}
