/**
 * Aides partagées par les routes de réservation (publiques et admin).
 * Ce fichier n'est pas une route : Next.js n'expose que les `route.ts`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { BookingError } from '../../../services/booking';
import { getBearerToken, validateSupabaseToken } from '../../../utils/apiAuth';

/** Réponse 401 si l'appelant n'est pas administrateur, sinon `null`. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const ok = await validateSupabaseToken(getBearerToken(req));
  return ok ? null : NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
}

/** Traduit une erreur du service en réponse JSON `{ error, conflicts? }`. */
export function errorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof BookingError) {
    return NextResponse.json(
      { error: err.message, ...(err.code ? { code: err.code } : {}), ...(err.conflicts ? { conflicts: err.conflicts } : {}) },
      { status: err.status },
    );
  }
  console.error(`[${context}] Erreur inattendue:`, err);
  return NextResponse.json({ error: 'Erreur interne. Merci de réessayer.' }, { status: 500 });
}

/** Corps JSON, ou `null` s'il est invalide (la route répond alors 400). */
export async function readJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export const BAD_JSON = () => NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });

/** IP de l'appelant : l'en-tête Netlify est posé par la plateforme, donc plus fiable que X-Forwarded-For. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}
