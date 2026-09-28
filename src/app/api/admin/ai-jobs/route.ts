/**
 * Création d'une tâche IA longue (voir services/aiJobs.ts).
 *
 * POST { kind, input } → { id }. La tâche est enregistrée puis déclenchée
 * (fonction de fond Netlify, ou exécution locale en développement). L'admin
 * suit ensuite son état avec GET /api/admin/ai-jobs/<id>.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getBearerToken, isAdminRequest } from '../../../../utils/apiAuth';
import { isModuleEnabledServer } from '../../../../config/modules';
import { createJob, isAiJobKind, type AiJobKind } from '../../../../services/aiJobs';
import { dispatchJob } from '../../../../services/aiJobDispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Types lançables depuis l'admin (les autres sont réservés au serveur). */
const CLIENT_KINDS = new Set<AiJobKind>([
  'article',
  'blog-post',
  'page',
  'page-modify',
  'page-style',
  'site-structure',
  'import-site',
  'editorial-synthesis',
  'keyword-scan',
  'blocks-ai',
]);

/** Types soumis au module « Génération IA & Rédaction », comme leurs routes synchrones. */
const AI_GENERATION_KINDS = new Set<AiJobKind>(['article', 'blog-post', 'page', 'page-modify', 'site-structure', 'blocks-ai']);

/** Identifiant de l'utilisateur (claim `sub` du jeton, déjà vérifié par isAdminRequest). */
function userIdFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json?.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Votre session a expiré. Reconnectez-vous puis réessayez.' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête JSON invalide.' }, { status: 400 });
  }

  const kind = body?.kind;
  if (!isAiJobKind(kind) || !CLIENT_KINDS.has(kind)) {
    return NextResponse.json({ error: 'Type de génération inconnu.' }, { status: 400 });
  }
  const input = body?.input && typeof body.input === 'object' ? body.input : {};

  if (AI_GENERATION_KINDS.has(kind) && !(await isModuleEnabledServer('ai_generation'))) {
    return NextResponse.json(
      { error: "Le module 'Génération IA & Rédaction' est désactivé dans les paramètres du Studio." },
      { status: 403 },
    );
  }

  try {
    const id = await createJob(kind, input, userIdFromToken(getBearerToken(req)));
    await dispatchJob(id);
    return NextResponse.json({ id });
  } catch (err: any) {
    console.error('[ai-jobs] Création impossible :', err);
    return NextResponse.json({ error: err?.message || 'La génération n’a pas pu être lancée.' }, { status: 500 });
  }
}
