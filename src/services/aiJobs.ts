/**
 * Tâches IA longues (table `ai_jobs`).
 *
 * Pourquoi : sur Netlify, une fonction synchrone est coupée à 60 s. Une
 * rédaction d'article ou une génération de page dépasse souvent ce délai.
 * Ces générations sont donc :
 *  1. enregistrées ici (`createJob`) par la route `/api/admin/ai-jobs` ;
 *  2. exécutées par la fonction de fond `netlify/functions/ai-job-background`
 *     (jusqu'à 15 min), ou dans le processus local en développement
 *     (`services/aiJobDispatch`) ;
 *  3. suivies par l'admin, qui interroge `/api/admin/ai-jobs/<id>` toutes
 *     les deux secondes (`hooks/useAiJob`).
 *
 * ⚠️ Ce module et tout ce qu'il importe doivent rester **indépendants de
 * Next.js** (pas de `next/server`, `next/cache`, cookies…) : la fonction
 * Netlify l'empaquette seule avec esbuild. Les générations sont dans
 * `services/aiTasks/`, qui respecte la même règle.
 *
 * Netlify réessaie automatiquement une fonction de fond qui échoue : `runJob`
 * ne prend donc une tâche que si elle attend encore (`pending`), ou si elle
 * est restée « en cours » plus de 15 min (exécution précédente tuée).
 */
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { AiTaskError } from './aiTasks/shared';
import { generateArticleTask, generateAutomationArticle } from './aiTasks/article';
import { generateBlogPost } from './aiTasks/blogPost';
import { generatePage } from './aiTasks/page';
import { modifyPageWithAi } from './aiTasks/pageModify';
import { optimizePageStyle } from './aiTasks/pageStyle';
import { runSiteStructureAction } from './aiTasks/siteStructure';
import { importSite } from './aiTasks/importSite';
import { synthesizeEditorialInterview } from './aiTasks/editorial';
import { runKeywordScan } from './aiTasks/keywordScan';
import { runBlocksAi } from './aiTasks/blocks';

export type AiJobStatus = 'pending' | 'running' | 'done' | 'error';

export interface AiJobRow {
  id: string;
  kind: string;
  status: AiJobStatus;
  input: Record<string, unknown> | null;
  result: unknown;
  error: string | null;
  attempts: number | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
}

type JobHandler = (input: any) => Promise<unknown>;

/**
 * Registre des générations exécutables en tâche de fond. Chaque gestionnaire
 * réutilise la logique de la route synchrone correspondante, en mode `long`
 * (modèle et réflexion des réglages, 13 min de délai).
 */
export const JOB_HANDLERS = {
  /** Écran Blog : rédaction d'un article complet (texte HTML). */
  'article': (input) => generateArticleTask(input),
  /** Article + balises SEO au format JSON (même sortie que generate-blog-post). */
  'blog-post': (input) => generateBlogPost(input, 'long'),
  /** Éditeur de pages : génération d'une page entière. */
  'page': (input) => generatePage(input, 'long'),
  /** Éditeur de pages : modification de la page par instruction. */
  'page-modify': (input) => modifyPageWithAi(input, 'long'),
  /** Éditeur de pages : revue de la mise en forme. */
  'page-style': (input) => optimizePageStyle(input, 'long'),
  /** Création automatique du site (arborescence ou contenu d'une page). */
  'site-structure': (input) => runSiteStructureAction(input, 'long'),
  /** Reconstruction d'une page à partir d'un site existant. */
  'import-site': (input) => importSite(input, 'long'),
  /** Synthèse de l'entretien éditorial. */
  'editorial-synthesis': (input) => synthesizeEditorialInterview(input, 'long'),
  /** Page builder v2 (blocs) : réécriture d'une section ou de la page entière. */
  'blocks-ai': (input) => runBlocksAi(input, 'long'),
  /** Plan d'articles (scan des mots-clés). */
  'keyword-scan': () => runKeywordScan('long'),
  /** Automatisations : brouillon d'article à partir d'une idée en file. */
  'automation-article': (input) => generateAutomationArticle(input),
} satisfies Record<string, JobHandler>;

export type AiJobKind = keyof typeof JOB_HANDLERS;

export function isAiJobKind(kind: unknown): kind is AiJobKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(JOB_HANDLERS, kind);
}

/** Au-delà, une tâche « en cours » est considérée comme interrompue. */
export const STALE_RUNNING_MS = 15 * 60_000;
/** Au-delà, une tâche jamais démarrée est abandonnée. */
export const STALE_PENDING_MS = 10 * 60_000;

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquante : les tâches IA de fond ne peuvent pas être enregistrées.',
    );
  }
  return admin;
}

/** Enregistre une tâche en attente et renvoie son identifiant. */
export async function createJob(
  kind: AiJobKind,
  input: Record<string, unknown>,
  userId?: string | null,
): Promise<string> {
  const { data, error } = await db()
    .from('ai_jobs')
    .insert({ kind, input: input ?? {}, created_by: userId || null, status: 'pending' })
    .select('id')
    .single();
  if (error || !data) {
    const hint = /ai_jobs/i.test(error?.message ?? '')
      ? " La table ai_jobs n'existe pas encore : appliquez la migration 20260927_ai_jobs.sql."
      : '';
    throw new Error(`Impossible d'enregistrer la tâche IA (${error?.message ?? 'réponse vide'}).${hint}`);
  }
  return data.id as string;
}

export async function getJob(id: string): Promise<AiJobRow | null> {
  const { data, error } = await db().from('ai_jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AiJobRow | null) ?? null;
}

/** Met à jour `updated_at` (sert à espacer les relances d'une tâche en attente). */
export async function touchJob(id: string): Promise<void> {
  await db().from('ai_jobs').update({ updated_at: new Date().toISOString() }).eq('id', id);
}

/**
 * Marque en erreur une tâche bloquée (jamais démarrée, ou interrompue en
 * cours d'exécution). Renvoie la ligne à jour, ou la ligne telle quelle.
 */
export async function expireIfStale(job: AiJobRow): Promise<AiJobRow> {
  const now = Date.now();
  let message = '';
  if (job.status === 'running' && job.started_at && now - Date.parse(job.started_at) > STALE_RUNNING_MS + 60_000) {
    message = "La génération a été interrompue avant la fin (plus de 15 minutes). Relancez-la.";
  } else if (job.status === 'pending' && now - Date.parse(job.created_at) > STALE_PENDING_MS) {
    message = "La génération n'a jamais démarré. Relancez-la ; si le problème persiste, vérifiez la variable INTERNAL_API_SECRET dans Netlify.";
  }
  if (!message) return job;

  const finishedAt = new Date().toISOString();
  const { data } = await db()
    .from('ai_jobs')
    .update({ status: 'error', error: message, finished_at: finishedAt, updated_at: finishedAt })
    .eq('id', job.id)
    .eq('status', job.status)
    .select('*')
    .maybeSingle();
  return (data as AiJobRow | null) ?? { ...job, status: 'error', error: message, finished_at: finishedAt };
}

/** Prend la tâche si elle est libre. Renvoie `null` si une autre exécution la tient. */
async function claimJob(id: string): Promise<AiJobRow | null> {
  const nowIso = new Date().toISOString();
  const claim = { status: 'running', started_at: nowIso, updated_at: nowIso, error: null };

  const { data: fresh } = await db()
    .from('ai_jobs')
    .update(claim)
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (fresh) return fresh as AiJobRow;

  // Exécution précédente tuée (délai de 15 min dépassé, plantage) : reprise.
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const { data: stale } = await db()
    .from('ai_jobs')
    .update(claim)
    .eq('id', id)
    .eq('status', 'running')
    .lt('started_at', staleBefore)
    .select('*')
    .maybeSingle();
  return (stale as AiJobRow | null) ?? null;
}

/** Message lisible dans l'admin pour une erreur de génération. */
function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'not_configured') {
    return "La clé de l'assistant IA n'est pas configurée. Renseignez-la dans Réglages, onglet « Clés des services ».";
  }
  return msg || 'La génération a échoué.';
}

/**
 * Exécute une tâche : la passe en « en cours » (si elle est libre), appelle
 * son gestionnaire, puis enregistre le résultat ou l'erreur. Ne lève jamais
 * pour une erreur de génération (elle est enregistrée sur la tâche).
 */
export async function runJob(id: string): Promise<AiJobStatus | 'skipped'> {
  const job = await claimJob(id);
  if (!job) return 'skipped';

  await db()
    .from('ai_jobs')
    .update({ attempts: (job.attempts ?? 0) + 1 })
    .eq('id', id);

  const finish = async (patch: Record<string, unknown>) => {
    const at = new Date().toISOString();
    const { error } = await db()
      .from('ai_jobs')
      .update({ ...patch, finished_at: at, updated_at: at })
      .eq('id', id);
    if (error) console.error('[aiJobs] Écriture du résultat impossible :', id, error.message);
  };

  if (!isAiJobKind(job.kind)) {
    await finish({ status: 'error', error: `Type de tâche inconnu : ${job.kind}` });
    return 'error';
  }

  try {
    const handler: JobHandler = JOB_HANDLERS[job.kind];
    const result = await handler(job.input ?? {});
    // Passage par JSON : on n'enregistre que des données sérialisables.
    await finish({ status: 'done', result: JSON.parse(JSON.stringify(result ?? null)), error: null });
    return 'done';
  } catch (err) {
    if (!(err instanceof AiTaskError)) console.error(`[aiJobs] ${job.kind} ${id} :`, err);
    await finish({ status: 'error', error: errorMessage(err) });
    return 'error';
  }
}
