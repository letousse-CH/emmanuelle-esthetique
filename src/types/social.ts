/**
 * Réseaux sociaux — règles pures, partagées par l'écran, les routes et la
 * tâche planifiée. Testées par `npx tsx scripts/test-social.ts`.
 *
 * Le modèle tient en une phrase : une publication = un visuel (JPEG rendu aux
 * couleurs du site) + une légende, envoyés sur Instagram et/ou Facebook, tout
 * de suite ou à une heure programmée. Chaque réseau a son envoi
 * (`social_publications`), écrit par le serveur seul.
 */

export type SocialNetwork = 'instagram' | 'facebook';
export const SOCIAL_NETWORKS: SocialNetwork[] = ['instagram', 'facebook'];
export const NETWORK_LABEL: Record<SocialNetwork, string> = { instagram: 'Instagram', facebook: 'Facebook' };

export type SocialPostStatus =
  | 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'archived';

export const POST_STATUS_LABEL: Record<SocialPostStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  publishing: 'Envoi en cours',
  published: 'Publiée',
  partial: 'Publiée en partie',
  failed: 'Échec',
  archived: 'Archivée',
};

export type PublicationStatus = 'pending' | 'processing' | 'published' | 'failed';

export type VisualLayout = 'photo' | 'editorial' | 'marine';
export type VisualFormat = 'portrait' | 'square';

export interface SocialVisual {
  layout: VisualLayout;
  format: VisualFormat;
  /** Surtitre en capitales espacées, comme sur le site (« Soins du visage »). */
  eyebrow: string;
  /** Phrase du visuel, en Lora. */
  headline: string;
  photo_url: string | null;
  /** Empreinte du visuel déposé dans `image_url` : s'il change, on le redessine. */
  hash?: string;
}

export type SocialSourceType = 'idee' | 'soin' | 'offre' | 'article' | 'manual' | 'rss' | 'suggestion';

export interface SocialPost {
  id: string;
  source_type: SocialSourceType;
  source_ref: string;
  title: string;
  caption: string;
  hashtags: string;
  link_path: string | null;
  visual: SocialVisual;
  image_url: string | null;
  cover_image: string | null;
  networks: SocialNetwork[];
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPublication {
  id: string;
  post_id: string;
  network: SocialNetwork;
  status: PublicationStatus;
  container_id: string | null;
  external_id: string | null;
  permalink: string | null;
  error: string | null;
  attempts: number;
  locked_until: string | null;
  published_at: string | null;
  updated_at: string;
}

export const DEFAULT_VISUAL: SocialVisual = {
  layout: 'photo',
  format: 'portrait',
  eyebrow: '',
  headline: '',
  photo_url: null,
};

/** Lecture défensive d'une ligne `social_posts` (anciens posts compris). */
export function normalizePost(row: Record<string, any>): SocialPost {
  const v = (row.visual && typeof row.visual === 'object' ? row.visual : {}) as Partial<SocialVisual>;
  const layout: VisualLayout = v.layout === 'editorial' || v.layout === 'marine' ? v.layout : 'photo';
  const format: VisualFormat = v.format === 'square' ? 'square' : 'portrait';
  const networks = (Array.isArray(row.networks) ? row.networks : SOCIAL_NETWORKS)
    .filter((n: unknown): n is SocialNetwork => n === 'instagram' || n === 'facebook');
  return {
    id: String(row.id),
    source_type: (row.source_type || 'idee') as SocialSourceType,
    source_ref: String(row.source_ref || ''),
    title: String(row.title || ''),
    caption: String(row.caption || ''),
    hashtags: String(row.hashtags || ''),
    link_path: row.link_path ? String(row.link_path) : null,
    visual: {
      layout,
      format,
      eyebrow: String(v.eyebrow || ''),
      headline: String(v.headline || row.title || ''),
      photo_url: v.photo_url ? String(v.photo_url) : row.cover_image ? String(row.cover_image) : null,
      hash: v.hash ? String(v.hash) : undefined,
    },
    image_url: row.image_url ? String(row.image_url) : null,
    cover_image: row.cover_image ? String(row.cover_image) : null,
    networks,
    status: (row.status || 'draft') as SocialPostStatus,
    scheduled_at: row.scheduled_at ?? null,
    published_at: row.published_at ?? null,
    last_error: row.last_error ?? null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
  };
}

/** Une publication qu'on peut encore modifier (texte, visuel, réseaux). */
export function isEditable(status: SocialPostStatus): boolean {
  return status === 'draft' || status === 'scheduled' || status === 'failed';
}

// ── Hashtags & légendes ──────────────────────────────────────────────────────

/** Limites Instagram (au-delà, Meta refuse la publication). */
export const IG_CAPTION_MAX = 2200;
export const IG_HASHTAGS_MAX = 30;
/** Sur Facebook, trois hashtags suffisent : au-delà, le message fait spam. */
export const FB_HASHTAGS_MAX = 3;

/**
 * « #Soin, palézieux #Oron-la-Ville » → ['#Soin', '#palezieux', '#OronlaVille'].
 * Un mot = un hashtag. Sans accents : c'est ainsi qu'on les tape dans la
 * recherche Instagram (#PalezieuxGare, pas #PalézieuxGare). Lettres, chiffres
 * et _ seulement ; doublons retirés sans tenir compte de la casse.
 */
export function parseHashtags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (input || '').split(/[\s,;]+/)) {
    const word = raw
      .replace(/^#+/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (!word) continue;
    const key = word.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`#${word}`);
  }
  return out;
}

export function formatHashtags(tags: string[]): string {
  return tags.join(' ');
}

/** Libellé de l'appel à l'action ajouté sous le message Facebook. */
export function linkLabel(path: string): string {
  if (path.startsWith('/reservation')) return 'Réserver en ligne';
  if (path.startsWith('/blog/')) return 'Lire l’article';
  if (path.startsWith('/offre/')) return 'Découvrir l’offre';
  if (path.startsWith('/bon-cadeau')) return 'Offrir un bon cadeau';
  if (path.startsWith('/soins')) return 'Découvrir le soin';
  if (path.startsWith('/contact')) return 'Nous contacter';
  return 'En savoir plus';
}

export function absoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Texte réellement envoyé à chaque réseau.
 *  - Instagram : légende + hashtags (les liens n'y sont pas cliquables).
 *  - Facebook : légende + lien vers la page du site + trois hashtags au plus.
 */
export function captionFor(
  network: SocialNetwork,
  post: Pick<SocialPost, 'caption' | 'hashtags' | 'link_path'>,
  siteUrl: string,
): string {
  const body = (post.caption || '').trim();
  const tags = parseHashtags(post.hashtags);
  if (network === 'instagram') {
    return [body, tags.length ? formatHashtags(tags) : ''].filter(Boolean).join('\n\n');
  }
  const link = post.link_path ? `${linkLabel(post.link_path)} : ${absoluteUrl(siteUrl, post.link_path)}` : '';
  const fbTags = tags.slice(0, FB_HASHTAGS_MAX);
  return [body, link, fbTags.length ? formatHashtags(fbTags) : ''].filter(Boolean).join('\n\n');
}

// ── Contrôles avant envoi ────────────────────────────────────────────────────

export interface ConnectedNetworks {
  instagram: boolean;
  facebook: boolean;
}

/** Instagram ne publie que du JPEG : le visuel rendu l'est toujours. */
export function isJpegUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.jpe?g$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Ce qui empêche l'envoi, en français. Liste vide = prêt. */
export function publishProblems(
  post: Pick<SocialPost, 'caption' | 'hashtags' | 'link_path' | 'image_url' | 'networks'>,
  connected: ConnectedNetworks,
  siteUrl = 'https://example.ch',
): string[] {
  const problems: string[] = [];
  if (!post.caption.trim()) problems.push('Écrivez la légende.');
  if (!post.networks.length) problems.push('Choisissez au moins un réseau.');
  if (!post.image_url) problems.push('Le visuel n’a pas encore été enregistré.');
  else if (!isJpegUrl(post.image_url)) problems.push('Le visuel doit être une image JPEG en ligne (Instagram refuse les autres formats).');
  for (const n of post.networks) {
    if (!connected[n]) problems.push(`${NETWORK_LABEL[n]} n’est pas relié : connectez le compte d’abord.`);
  }
  if (post.networks.includes('instagram')) {
    const tags = parseHashtags(post.hashtags);
    if (tags.length > IG_HASHTAGS_MAX) problems.push(`Instagram accepte ${IG_HASHTAGS_MAX} hashtags au plus (vous en avez ${tags.length}).`);
    const length = [...captionFor('instagram', post, siteUrl)].length;
    if (length > IG_CAPTION_MAX) problems.push(`La légende Instagram dépasse ${IG_CAPTION_MAX} caractères (${length}).`);
  }
  return problems;
}

/** Délai minimal et maximal d'une programmation. */
export const SCHEDULE_MIN_MINUTES = 2;
export const SCHEDULE_MAX_DAYS = 180;

export function scheduleProblem(at: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(at.getTime())) return 'Date ou heure non reconnue.';
  if (at.getTime() < now.getTime() + SCHEDULE_MIN_MINUTES * 60_000) {
    return 'Choisissez une heure à venir (au moins deux minutes après maintenant).';
  }
  if (at.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 86_400_000) {
    return `On ne programme pas à plus de ${SCHEDULE_MAX_DAYS} jours.`;
  }
  return null;
}

// ── Statut d'ensemble ────────────────────────────────────────────────────────

/** Statut de la publication, déduit des envois réseau par réseau. */
export function aggregateStatus(pubs: Array<Pick<SocialPublication, 'status'>>): SocialPostStatus {
  if (pubs.length === 0) return 'draft';
  if (pubs.some((p) => p.status === 'pending' || p.status === 'processing')) return 'publishing';
  const published = pubs.filter((p) => p.status === 'published').length;
  if (published === pubs.length) return 'published';
  if (published > 0) return 'partial';
  return 'failed';
}

export function aggregateError(pubs: Array<Pick<SocialPublication, 'status' | 'error' | 'network'>>): string | null {
  const failed = pubs.filter((p) => p.status === 'failed');
  if (!failed.length) return null;
  return failed.map((p) => `${NETWORK_LABEL[p.network]} : ${p.error || 'échec sans détail'}`).join(' · ');
}

// ── Erreurs Meta ─────────────────────────────────────────────────────────────

export interface MetaErrorPayload {
  code?: number;
  error_subcode?: number;
  message?: string;
  error_user_msg?: string;
  type?: string;
}

/** Le jeton ne vaut plus rien : il faut reconnecter le compte. */
export function isMetaAuthError(err: MetaErrorPayload | null | undefined): boolean {
  return Boolean(err && (err.code === 190 || err.code === 102));
}

/**
 * Erreur Graph API → phrase utile. Le détail technique de Meta suit entre
 * parenthèses, pour pouvoir chercher si la phrase ne suffit pas.
 */
export function metaErrorMessage(err: MetaErrorPayload | null | undefined): string {
  if (!err) return 'Meta n’a pas répondu.';
  const code = Number(err.code);
  const sub = Number(err.error_subcode);
  const detail = (err.error_user_msg || err.message || '').trim();
  const withDetail = (s: string) => (detail ? `${s} (Meta : ${detail})` : s);

  if (code === 190 || code === 102) {
    return withDetail('La connexion à Facebook a expiré ou a été retirée. Reconnectez le compte depuis « Comptes ».');
  }
  if (code === 1 && /client secret/i.test(detail)) {
    return 'L’App Secret enregistré ne correspond pas à l’application Meta. Recopiez-le depuis developers.facebook.com › Paramètres › Général.';
  }
  if (code === 10 || (code >= 200 && code < 300)) {
    return withDetail('Meta refuse cette action faute d’autorisation. Reconnectez le compte en acceptant toutes les autorisations et en cochant la Page et le compte Instagram.');
  }
  if ([4, 17, 32, 613].includes(code) || sub === 2207042) {
    return withDetail('Meta limite temporairement les envois de ce compte. Réessayez dans une heure.');
  }
  if (code === 368) {
    return withDetail('Meta a bloqué cette publication (compte restreint ou contenu signalé).');
  }
  if (code === 506) {
    return 'Facebook refuse un message identique à une publication récente.';
  }
  if (code === 9004 || sub === 2207052 || sub === 2207003) {
    return withDetail('Instagram n’a pas pu télécharger le visuel. Enregistrez-le à nouveau puis relancez.');
  }
  if (code === 36003 || sub === 2207009) {
    return withDetail('Instagram refuse les proportions de ce visuel. Choisissez le format portrait ou carré.');
  }
  if (sub === 2207026 || sub === 2207004 || sub === 2207005) {
    return withDetail('Instagram refuse ce fichier image.');
  }
  if (code === 1 || code === 2) {
    return withDetail('Meta est momentanément indisponible. Réessayez dans quelques minutes.');
  }
  return detail ? `Meta : ${detail}` : 'Meta a refusé la demande sans explication.';
}

// ── Contenu rédigé par l'IA ──────────────────────────────────────────────────

export interface SocialWriting {
  eyebrow: string;
  headline: string;
  caption: string;
  hashtags: string;
}

const clip = (s: unknown, max: number) => {
  const t = String(s ?? '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Normalise la réponse de l'IA : rien d'absurde n'arrive dans l'éditeur. */
export function normalizeWriting(raw: any): SocialWriting | null {
  if (!raw || typeof raw !== 'object') return null;
  const caption = clip(raw.caption, 1800);
  const headline = clip(String(raw.headline ?? '').replace(/[#\n]+/g, ' ').replace(/\s+/g, ' ').replace(/\.$/, ''), 110);
  if (!caption || !headline) return null;
  const tagsInput = Array.isArray(raw.hashtags) ? raw.hashtags.join(' ') : String(raw.hashtags ?? '');
  return {
    eyebrow: clip(String(raw.eyebrow ?? '').replace(/\s+/g, ' '), 40),
    headline,
    // Les hashtags vivent à part : on les retire du corps s'ils s'y sont glissés.
    caption: caption.replace(/(\s#[\p{L}\p{N}_]+)+\s*$/u, '').trim(),
    hashtags: formatHashtags(parseHashtags(tagsInput).slice(0, 12)),
  };
}
