/**
 * Exécution des tâches IA longues — fonction de fond Netlify.
 *
 * Le suffixe « -background » du nom de fichier en fait une Background
 * Function : Netlify répond 202 immédiatement à l'appelant, puis la laisse
 * tourner jusqu'à 15 minutes (contre 60 s pour une fonction ordinaire). En cas
 * d'échec, Netlify la relance automatiquement : `runJob` est idempotent et
 * ignore une tâche déjà prise ou terminée.
 *
 * Appelée uniquement par le serveur (`src/services/aiJobDispatch.ts`) avec
 * l'en-tête x-internal-secret égal à INTERNAL_API_SECRET. Sans cette
 * variable, la fonction refuse tout appel (401).
 *
 * Importe `src/services/aiJobs.ts` par chemin relatif : Netlify empaquette ce
 * fichier avec esbuild, en dehors de Next. Toute la chaîne importée doit
 * rester indépendante de Next (voir l'en-tête de aiJobs.ts).
 */
import { runJob } from '../../src/services/aiJobs';

/** Comparaison à temps constant. */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export default async (req: Request): Promise<Response> => {
  const expected = (process.env.INTERNAL_API_SECRET || '').trim();
  const provided = (req.headers.get('x-internal-secret') || '').trim();
  if (!expected || !provided || !safeEqual(provided, expected)) {
    console.error('[ai-job-background] Appel refusé : secret interne absent ou invalide.');
    return new Response('Unauthorized', { status: 401 });
  }

  let id = '';
  try {
    const body = (await req.json()) as { id?: unknown };
    id = typeof body?.id === 'string' ? body.id : '';
  } catch {
    // corps illisible : traité ci-dessous
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Identifiant de tâche invalide', { status: 400 });
  }

  const outcome = await runJob(id);
  console.log(`[ai-job-background] ${id} : ${outcome}`);
  return new Response(outcome, { status: 200 });
};
