/**
 * Envoi des publications sur Instagram et Facebook (serveur uniquement).
 *
 * Chaque réseau a sa ligne `social_publications`, qui avance par petites
 * étapes : Instagram met parfois longtemps à traiter une image, et la base
 * peut ralentir (de 0,1 à 2,5 s par requête mesurés le 2026-10-20). On avance
 * tant que le budget de temps le permet (25 s depuis l'écran, 20 s pour la
 * tâche planifiée ; Netlify coupe à 60 s et 30 s), puis on rend la main ; le
 * navigateur (tant que l'écran est ouvert) et la tâche planifiée (toutes les
 * dix minutes) reprennent là où on s'est arrêté.
 *
 * Ce qui garantit qu'un réseau ne reçoit jamais deux fois le même post :
 *  - UNIQUE (post_id, network) : un seul envoi par réseau ;
 *  - un verrou `locked_until` posé par un UPDATE conditionnel : deux
 *    déclencheurs simultanés ne traitent jamais le même envoi ;
 *  - Instagram publie un conteneur, et un conteneur ne se publie qu'une fois ;
 *  - quand Meta ne répond pas à un envoi Facebook, on ne sait pas s'il est
 *    passé : l'envoi passe en échec avec « vérifiez la Page avant de relancer »,
 *    jamais en nouvel essai automatique ;
 *  - le déclencheur `social_publications_guard` interdit de remettre en file
 *    un envoi publié.
 */
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { SITE_CONFIG } from '../config/site';
import { graphGet, graphPost, MetaError } from './metaGraph';
import { getPublishTarget, type MetaPublishTarget } from './metaConnection';
import {
  aggregateError,
  aggregateStatus,
  captionFor,
  normalizePost,
  publishProblems,
  scheduleProblem,
  type SocialNetwork,
  type SocialPost,
  type SocialPublication,
} from '../types/social';

/**
 * Durée du verrou. Un appel à Meta dure au plus 9 s : si l'on retrouve un envoi
 * « en cours » dont le verrou a expiré, c'est que son traitement a été coupé.
 */
const LOCK_MS = 40_000;
const IG_MAX_CONTAINER_ATTEMPTS = 2;

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('La clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) manque sur le serveur.');
  return admin;
}

/** Adresse publique du site, ou rien en local (on ne publie pas de lien localhost). */
export function publicSiteUrl(): string | null {
  const url = (SITE_CONFIG.url || '').trim();
  return !url || /localhost|127\.0\.0\.1/.test(url) ? null : url.replace(/\/+$/, '');
}

function captionForNetwork(network: SocialNetwork, post: SocialPost): string {
  const site = publicSiteUrl();
  return captionFor(network, site ? post : { ...post, link_path: null }, site || '');
}

export interface PostSnapshot {
  post: SocialPost;
  publications: SocialPublication[];
}

export async function loadSnapshot(postId: string): Promise<PostSnapshot> {
  const [{ data: row, error }, { data: pubs, error: pubsError }] = await Promise.all([
    db().from('social_posts').select('*').eq('id', postId).maybeSingle(),
    db().from('social_publications').select('*').eq('post_id', postId).order('network'),
  ]);
  if (error || pubsError) throw new Error(`Lecture impossible : ${(error || pubsError)!.message}`);
  if (!row) throw new Error('Publication introuvable.');
  return { post: normalizePost(row), publications: (pubs ?? []) as SocialPublication[] };
}

async function connectedNetworks(target: MetaPublishTarget | null) {
  return { facebook: Boolean(target), instagram: Boolean(target?.instagramId) };
}

/** Le visuel est-il bien en ligne, en JPEG ? Meta répond sinon par une erreur obscure. */
async function checkImageOnline(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!res.ok) return `Le visuel n’est pas accessible en ligne (erreur ${res.status}). Enregistrez-le à nouveau.`;
    const type = res.headers.get('content-type') || '';
    if (type && !/image\/jpe?g/i.test(type)) return 'Le visuel en ligne n’est pas un JPEG. Enregistrez-le à nouveau.';
    return null;
  } catch {
    return null; // Contrôle de confort : en cas de doute, Meta tranchera.
  }
}

async function validateForSend(post: SocialPost, target: MetaPublishTarget | null): Promise<string[]> {
  const problems = publishProblems(post, await connectedNetworks(target), publicSiteUrl() || undefined);
  if (!problems.length && post.image_url) {
    const imageProblem = await checkImageOnline(post.image_url);
    if (imageProblem) problems.push(imageProblem);
  }
  return problems;
}

// ── Actions demandées par l'écran ────────────────────────────────────────────

export class PublishRefused extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(' '));
    this.name = 'PublishRefused';
  }
}

/** Programme la publication après contrôle complet. */
export async function schedulePost(postId: string, at: Date): Promise<PostSnapshot> {
  const { post } = await loadSnapshot(postId);
  if (post.status !== 'draft' && post.status !== 'scheduled' && post.status !== 'failed') {
    throw new PublishRefused(['Cette publication est déjà partie.']);
  }
  const problems = await validateForSend(post, await getPublishTarget());
  const timing = scheduleProblem(at);
  if (timing) problems.push(timing);
  if (problems.length) throw new PublishRefused(problems);

  const { error } = await db()
    .from('social_posts')
    .update({ status: 'scheduled', scheduled_at: at.toISOString(), last_error: null, planned_date: zurichDate(at) })
    .eq('id', postId)
    .in('status', ['draft', 'scheduled', 'failed']);
  if (error) throw new Error(error.message);
  return loadSnapshot(postId);
}

export async function unschedulePost(postId: string): Promise<PostSnapshot> {
  const { error } = await db()
    .from('social_posts')
    .update({ status: 'draft', scheduled_at: null })
    .eq('id', postId)
    .eq('status', 'scheduled');
  if (error) throw new Error(error.message);
  return loadSnapshot(postId);
}

/**
 * Lance l'envoi : crée un envoi par réseau choisi (sauf ceux déjà publiés),
 * puis avance tant que le budget de temps le permet.
 */
export async function startPublishing(postId: string, deadline: number): Promise<PostSnapshot> {
  const [{ post, publications }, target] = await Promise.all([loadSnapshot(postId), getPublishTarget()]);
  if (!['draft', 'scheduled', 'failed'].includes(post.status)) {
    if (post.status === 'publishing') return advancePost(postId, deadline, target);
    throw new PublishRefused(['Cette publication est déjà partie.']);
  }
  const problems = await validateForSend(post, target);
  if (problems.length) {
    if (post.status === 'scheduled') {
      // Programmée, mais plus publiable (compte déconnecté, visuel effacé…) : on le dit.
      await db().from('social_posts').update({ status: 'failed', last_error: problems.join(' ') }).eq('id', postId);
    }
    throw new PublishRefused(problems);
  }

  // Passage en « envoi en cours » conditionnel : un seul déclencheur gagne.
  const { data: claimed, error } = await db()
    .from('social_posts')
    .update({ status: 'publishing', last_error: null })
    .eq('id', postId)
    .in('status', ['draft', 'scheduled', 'failed'])
    .select('id');
  if (error) throw new Error(error.message);
  if (!claimed?.length) return advancePost(postId, deadline, target);

  // Un envoi par réseau choisi. Un réseau retiré depuis un échec ne compte plus ;
  // un réseau en échec repart ; un réseau déjà publié n'est pas touché.
  const already = new Map(publications.map((p) => [p.network, p]));
  const dropped = publications.filter((p) => p.status === 'failed' && !post.networks.includes(p.network)).map((p) => p.id);
  const reset = post.networks.map((n) => already.get(n)).filter((p) => p?.status === 'failed').map((p) => p!.id);
  const missing = post.networks.filter((n) => !already.has(n));
  const writes = await Promise.all([
    dropped.length ? db().from('social_publications').delete().in('id', dropped) : null,
    reset.length
      ? db().from('social_publications').update({ status: 'pending', error: null, container_id: null, locked_until: null }).in('id', reset).eq('status', 'failed')
      : null,
    missing.length
      ? db().from('social_publications').upsert(missing.map((network) => ({ post_id: postId, network, status: 'pending' })), { onConflict: 'post_id,network', ignoreDuplicates: true })
      : null,
  ]);
  const writeError = writes.find((w) => w?.error)?.error;
  if (writeError) throw new Error(writeError.message);
  return advancePost(postId, deadline, target);
}

/** Relance un réseau en échec (publication « en partie » ou « échec »). */
export async function retryNetwork(postId: string, network: SocialNetwork, deadline: number): Promise<PostSnapshot> {
  const [{ post, publications }, target] = await Promise.all([loadSnapshot(postId), getPublishTarget()]);
  const pub = publications.find((p) => p.network === network);
  if (!pub || pub.status !== 'failed') throw new PublishRefused(['Rien à relancer sur ce réseau.']);
  const problems = await validateForSend({ ...post, networks: [network] }, target);
  if (problems.length) throw new PublishRefused(problems);

  await Promise.all([
    db().from('social_publications')
      .update({ status: 'pending', error: null, container_id: null, locked_until: null })
      .eq('id', pub.id)
      .eq('status', 'failed'),
    db().from('social_posts').update({ status: 'publishing', last_error: null }).eq('id', postId),
  ]);
  return advancePost(postId, deadline, target);
}

// ── Avancement ───────────────────────────────────────────────────────────────

/**
 * Prend le verrou d'un envoi, à condition qu'il soit toujours dans l'état lu
 * (`pub.status`) : si un autre déclencheur l'a fait avancer entre-temps, on
 * n'y touche pas. `patch` part dans la même écriture (un seul aller-retour).
 */
async function lock(pub: SocialPublication, patch: Partial<SocialPublication> = {}): Promise<SocialPublication | null> {
  const now = new Date();
  const { data, error } = await db()
    .from('social_publications')
    .update({ ...patch, locked_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq('id', pub.id)
    .eq('status', pub.status)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select('*');
  if (error) throw new Error(error.message);
  return (data?.[0] as SocialPublication) ?? null;
}

/** Enregistre un envoi ; libère le verrou sauf pour une étape intermédiaire. */
async function save(pubId: string, patch: Partial<SocialPublication>, keepLock = false): Promise<void> {
  const { error } = await db()
    .from('social_publications')
    .update(keepLock ? patch : { ...patch, locked_until: null })
    .eq('id', pubId);
  if (error) throw new Error(error.message);
}

/** Délai d'un appel à Meta : jamais au-delà de ce qui reste du budget. */
function callTimeout(deadline: number, max = 9000): number {
  return Math.max(2500, Math.min(max, deadline - Date.now() - 500));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `wasProcessing` : l'envoi était déjà « en cours » quand on a pris le verrou,
 * donc son traitement a été coupé pendant l'appel à Facebook — impossible de
 * savoir s'il est passé. Sinon le verrou vient de le passer « en cours ».
 */
async function stepFacebook(
  pub: SocialPublication,
  wasProcessing: boolean,
  post: SocialPost,
  target: MetaPublishTarget,
  deadline: number,
): Promise<void> {
  if (wasProcessing) {
    await save(pub.id, {
      status: 'failed',
      error: 'L’envoi a été interrompu sans réponse de Facebook. Vérifiez la Page avant de relancer, pour ne pas publier deux fois.',
    });
    return;
  }

  try {
    const res = await graphPost<{ id: string; post_id?: string }>(`${target.pageId}/photos`, {
      url: post.image_url!,
      caption: captionForNetwork('facebook', post),
      published: true,
      access_token: target.pageToken,
    }, callTimeout(deadline));
    const postRef = res.post_id || res.id;
    let permalink: string | null = null;
    try {
      const info = await graphGet<{ permalink_url?: string }>(postRef, { fields: 'permalink_url', access_token: target.pageToken }, 3000);
      permalink = info.permalink_url || null;
    } catch {
      permalink = `https://www.facebook.com/${postRef}`;
    }
    await save(pub.id, { status: 'published', external_id: postRef, permalink, error: null, published_at: new Date().toISOString() });
  } catch (err) {
    const uncertain = err instanceof MetaError && err.uncertain;
    await save(pub.id, {
      status: 'failed',
      error: uncertain
        ? 'Facebook n’a pas répondu à temps. Vérifiez la Page avant de relancer : la photo est peut-être déjà publiée.'
        : err instanceof Error ? err.message : String(err),
    });
  }
}

async function stepInstagram(
  pub: SocialPublication,
  post: SocialPost,
  target: MetaPublishTarget,
  deadline: number,
): Promise<void> {
  if (!target.instagramId) {
    await save(pub.id, { status: 'failed', error: 'Aucun compte Instagram professionnel n’est relié à la Page.' });
    return;
  }

  let containerId = pub.container_id;
  let attempts = pub.attempts;

  // 1. Conteneur : Instagram télécharge le visuel depuis R2.
  if (!containerId) {
    if (attempts >= IG_MAX_CONTAINER_ATTEMPTS) {
      await save(pub.id, { status: 'failed', error: 'Instagram n’a pas pu préparer le visuel après deux essais. Enregistrez le visuel à nouveau puis relancez.' });
      return;
    }
    attempts += 1;
    try {
      const res = await graphPost<{ id: string }>(`${target.instagramId}/media`, {
        image_url: post.image_url!,
        caption: captionForNetwork('instagram', post),
        access_token: target.pageToken,
      }, callTimeout(deadline));
      containerId = res.id;
      await save(pub.id, { status: 'processing', container_id: containerId, attempts }, true);
    } catch (err) {
      // Pas de conteneur créé (ou inconnu) : rien n'est publié, on peut réessayer sans risque.
      const uncertain = err instanceof MetaError && err.uncertain;
      await save(pub.id, uncertain
        ? { status: 'pending', attempts }
        : { status: 'failed', attempts, error: err instanceof Error ? err.message : String(err) });
      return;
    }
  }

  // 2. Attente du traitement, puis publication du conteneur.
  while (Date.now() < deadline - 2500) {
    let statusCode = '';
    let statusDetail = '';
    try {
      const st = await graphGet<{ status_code?: string; status?: string }>(containerId!, {
        fields: 'status_code,status',
        access_token: target.pageToken,
      }, 3000);
      statusCode = st.status_code || '';
      statusDetail = st.status || '';
    } catch (err) {
      if (err instanceof MetaError && !err.uncertain) {
        await save(pub.id, { status: 'failed', error: err.message });
        return;
      }
      break; // Meta lent : on reprendra au prochain passage.
    }

    if (statusCode === 'FINISHED') {
      try {
        const res = await graphPost<{ id: string }>(`${target.instagramId}/media_publish`, {
          creation_id: containerId!,
          access_token: target.pageToken,
        }, callTimeout(deadline));
        let permalink: string | null = null;
        try {
          const info = await graphGet<{ permalink?: string }>(res.id, { fields: 'permalink', access_token: target.pageToken }, 3000);
          permalink = info.permalink || null;
        } catch { /* le lien viendra du profil */ }
        await save(pub.id, { status: 'published', external_id: res.id, permalink, error: null, published_at: new Date().toISOString() });
      } catch (err) {
        // Sans réponse, le prochain passage relira l'état du conteneur (PUBLISHED ou non).
        if (err instanceof MetaError && !err.uncertain) {
          await save(pub.id, { status: 'failed', error: err.message });
        } else {
          await save(pub.id, {});
        }
      }
      return;
    }
    if (statusCode === 'PUBLISHED') {
      // Publié lors d'un passage précédent dont la réponse s'est perdue.
      await save(pub.id, { status: 'published', error: null, published_at: new Date().toISOString() });
      return;
    }
    if (statusCode === 'EXPIRED') {
      await save(pub.id, { status: 'pending', container_id: null });
      return;
    }
    if (statusCode === 'ERROR') {
      await save(pub.id, {
        status: 'failed',
        container_id: null,
        error: `Instagram n’a pas pu traiter le visuel${statusDetail ? ` (${statusDetail})` : ''}. Enregistrez-le à nouveau puis relancez.`,
      });
      return;
    }
    await sleep(1500); // IN_PROGRESS
  }
  await save(pub.id, {});
}

/** Recalcule le statut de la publication à partir de ses envois, et rend l'état à jour. */
async function refreshPostStatus(post: SocialPost): Promise<PostSnapshot> {
  const { data: pubs, error } = await db().from('social_publications').select('*').eq('post_id', post.id).order('network');
  if (error) throw new Error(error.message);
  const publications = (pubs ?? []) as SocialPublication[];
  if (!publications.length) return { post, publications };
  const status = aggregateStatus(publications);
  const publishedAt = publications.map((p) => p.published_at).filter(Boolean).sort().pop() || null;
  const { data: updated } = await db()
    .from('social_posts')
    .update({ status, last_error: aggregateError(publications), published_at: publishedAt })
    .eq('id', post.id)
    .eq('status', 'publishing')
    .select('*');
  if (updated?.[0]) return { post: normalizePost(updated[0]), publications };
  return loadSnapshot(post.id);
}

async function advanceOne(pub: SocialPublication, post: SocialPost, target: MetaPublishTarget | null, deadline: number): Promise<void> {
  const wasProcessing = pub.status === 'processing';
  // Facebook : « en cours » est écrit AVANT l'appel, dans la même écriture que le verrou.
  const patch = pub.network === 'facebook' && !wasProcessing ? { status: 'processing' as const, attempts: pub.attempts + 1 } : {};
  const locked = await lock(pub, patch);
  if (!locked) return; // un autre déclencheur s'en occupe
  if (!target) {
    await save(locked.id, { status: 'failed', error: 'Le compte Facebook a été déconnecté pendant l’envoi.' });
    return;
  }
  try {
    if (locked.network === 'facebook') await stepFacebook(locked, wasProcessing, post, target, deadline);
    else await stepInstagram(locked, post, target, deadline);
  } catch (err) {
    // Erreur de base : le verrou expirera de lui-même, et l'état « en cours » de
    // Facebook interdira tout renvoi automatique.
    console.error(`[socialPublish] ${locked.network} ${post.id}:`, err);
  }
}

/**
 * Fait avancer les envois en cours d'une publication. Facebook et Instagram
 * avancent en parallèle, chacun sous son propre verrou.
 */
export async function advancePost(postId: string, deadline: number, knownTarget?: MetaPublishTarget | null): Promise<PostSnapshot> {
  const [{ post, publications }, target] = await Promise.all([
    loadSnapshot(postId),
    knownTarget !== undefined ? Promise.resolve(knownTarget) : getPublishTarget(),
  ]);
  if (post.status !== 'publishing') return { post, publications };

  const active = publications.filter((p) => p.status === 'pending' || p.status === 'processing');
  if (Date.now() < deadline - 2000) {
    await Promise.all(active.map((pub) => advanceOne(pub, post, target, deadline)));
  }
  return refreshPostStatus(post);
}

// ── Tâche planifiée ──────────────────────────────────────────────────────────

export interface CronSummary {
  started: string[];
  advanced: string[];
  refused: Array<{ id: string; reason: string }>;
}

/** Publie ce qui est arrivé à l'heure et fait avancer ce qui est en cours. */
export async function runSocialPublishCron(deadline: number): Promise<CronSummary> {
  const summary: CronSummary = { started: [], advanced: [], refused: [] };

  const { data: inFlight } = await db().from('social_posts').select('id').eq('status', 'publishing').limit(10);
  for (const row of inFlight ?? []) {
    if (Date.now() > deadline - 3000) return summary;
    await advancePost(row.id, deadline);
    summary.advanced.push(row.id);
  }

  const { data: due } = await db()
    .from('social_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5);
  for (const row of due ?? []) {
    if (Date.now() > deadline - 3000) return summary;
    try {
      await startPublishing(row.id, deadline);
      summary.started.push(row.id);
    } catch (err) {
      summary.refused.push({ id: row.id, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return summary;
}

function zurichDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
