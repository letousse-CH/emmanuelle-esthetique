/**
 * Déclenchement d'une tâche IA enregistrée dans `ai_jobs`.
 *
 * Côté Next uniquement (utilise `after` de `next/server`) : ne pas importer ce
 * module depuis `services/aiJobs.ts` ni depuis `services/aiTasks/`, qui sont
 * empaquetés dans la fonction Netlify.
 *
 *  - En production Netlify, avec INTERNAL_API_SECRET : appel de la fonction
 *    de fond `/.netlify/functions/ai-job-background`, qui répond 202 tout de
 *    suite et exécute la tâche jusqu'à 15 min.
 *  - Sinon (développement local, où `next dev` ne sert pas netlify/functions,
 *    ou secret absent) : exécution dans le processus courant, après l'envoi
 *    de la réponse. En production sans secret, cette exécution reste bornée
 *    par les 60 s de la fonction appelante.
 */
import { after } from 'next/server';
import { runJob } from './aiJobs';

let warnedNoSecret = false;

function isNetlifyRuntime(): boolean {
  return process.env.NETLIFY === 'true' || Boolean((process.env.URL || '').trim());
}

/** Exécute la tâche dans ce processus, sans attendre (après la réponse si possible). */
function runHere(id: string): void {
  const task = () =>
    runJob(id).catch((err) => console.error('[aiJobDispatch] Exécution locale en échec :', id, err));
  try {
    after(task);
  } catch {
    // Hors d'une requête Next (script, test) : on lance simplement la tâche.
    void task();
  }
}

/** Déclenche la tâche. Renvoie le chemin retenu, pour les journaux. */
export async function dispatchJob(id: string): Promise<'background' | 'local'> {
  const secret = (process.env.INTERNAL_API_SECRET || '').trim();
  const base = (process.env.URL || '').trim().replace(/\/+$/, '');

  if (isNetlifyRuntime() && base) {
    if (!secret) {
      if (!warnedNoSecret) {
        warnedNoSecret = true;
        console.warn(
          '[aiJobDispatch] INTERNAL_API_SECRET est vide : les générations longues tournent dans la fonction ' +
            "appelante, coupée à 60 s. Ajoutez cette variable dans Netlify pour activer la fonction de fond.",
        );
      }
    } else {
      try {
        const res = await fetch(`${base}/.netlify/functions/ai-job-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ id }),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return 'background';
        console.error('[aiJobDispatch] La fonction de fond a répondu', res.status, '— exécution locale.');
      } catch (err) {
        console.error('[aiJobDispatch] Fonction de fond injoignable — exécution locale :', err);
      }
    }
  }

  runHere(id);
  return 'local';
}
