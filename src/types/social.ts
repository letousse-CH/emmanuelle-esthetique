/**
 * Réseaux sociaux — règles pures, partagées par l'écran, les routes et la
 * tâche planifiée. Testées par `npx tsx scripts/test-social.ts`.
 *
 * Le modèle tient en une phrase : une publication = un visuel (JPEG rendu aux
 * couleurs du site) ou une vidéo (Reel), + une légende, envoyés sur Instagram
 * et/ou Facebook, tout de suite ou à une heure programmée. Chaque réseau a son
 * envoi (`social_publications`), écrit par le serveur seul.
 *
 * Trois sortes : `post` (fil, 4:5 ou carré), `story` (9:16, sans légende),
 * `reel` (vidéo MP4 9:16 montée dans le navigateur, avec musique).
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

export type SocialKind = 'post' | 'story' | 'reel';
export const KIND_LABEL: Record<SocialKind, string> = { post: 'Publication', story: 'Story', reel: 'Reel' };

export type VisualLayout = 'photo' | 'editorial' | 'marine';
/** `story` : 9:16 (1080 × 1920), le format des stories et des Reels. */
export type VisualFormat = 'portrait' | 'square' | 'story';

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

/** Une scène de Reel : photo (avec texte éventuel), diapo de texte, ou extrait vidéo. */
export interface ReelScene {
  id: string;
  type: 'photo' | 'text' | 'video';
  /** Photo de la médiathèque (type photo). */
  photo_url?: string | null;
  /** Fichier vidéo MP4 (type video, banque Pexels). */
  video_url?: string | null;
  /** Vignette de l'extrait vidéo, pour l'éditeur. */
  video_thumb?: string | null;
  /** Crédit de l'auteur de la vidéo (Pexels le demande poliment). */
  credit?: string | null;
  text: string;
  /** Secondes. */
  duration: number;
}

export interface ReelMusic {
  url: string;
  title: string;
  credit?: string | null;
}

export interface ReelSpec {
  scenes: ReelScene[];
  music: ReelMusic | null;
  /** Empreinte de la vidéo déposée dans `video_url`. */
  hash?: string;
}

export interface SocialPost {
  id: string;
  kind: SocialKind;
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
  /** Date prévue par le plan éditorial (brouillon pas encore programmé). */
  planned_at: string | null;
  pillar: PillarId | null;
  /** Angle proposé par le plan, repris comme consigne à la rédaction. */
  plan_note: string | null;
  reel: ReelSpec | null;
  /** Vidéo MP4 rendue et déposée sur R2 (Reels). */
  video_url: string | null;
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
  const kind: SocialKind = row.kind === 'story' || row.kind === 'reel' ? row.kind : 'post';
  const format: VisualFormat = kind !== 'post' ? 'story' : v.format === 'square' ? 'square' : 'portrait';
  const networks = (Array.isArray(row.networks) ? row.networks : SOCIAL_NETWORKS)
    .filter((n: unknown): n is SocialNetwork => n === 'instagram' || n === 'facebook');
  return {
    id: String(row.id),
    kind,
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
    planned_at: row.planned_at ?? null,
    pillar: isPillar(row.pillar) ? row.pillar : null,
    plan_note: row.plan_note ? String(row.plan_note) : null,
    reel: normalizeReel(row.reel),
    video_url: row.video_url ? String(row.video_url) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || ''),
  };
}

export const REEL_SCENE_MIN = 1.5;
export const REEL_SCENE_MAX = 12;
/** Instagram accepte 15 min ; au-delà d'une minute, un Reel d'institut perd son public. */
export const REEL_MAX_SECONDS = 60;

export function normalizeReel(raw: any): ReelSpec | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.scenes)) return null;
  const scenes: ReelScene[] = raw.scenes
    .filter((sc: any) => sc && (sc.type === 'photo' || sc.type === 'text' || sc.type === 'video'))
    .map((sc: any, i: number) => ({
      id: String(sc.id || `s${i}`),
      type: sc.type,
      photo_url: sc.photo_url ? String(sc.photo_url) : null,
      video_url: sc.video_url ? String(sc.video_url) : null,
      video_thumb: sc.video_thumb ? String(sc.video_thumb) : null,
      credit: sc.credit ? String(sc.credit) : null,
      text: String(sc.text || ''),
      duration: Math.min(REEL_SCENE_MAX, Math.max(REEL_SCENE_MIN, Number(sc.duration) || 3)),
    }));
  const music = raw.music && typeof raw.music.url === 'string'
    ? { url: String(raw.music.url), title: String(raw.music.title || 'Musique'), credit: raw.music.credit ? String(raw.music.credit) : null }
    : null;
  return { scenes, music, hash: raw.hash ? String(raw.hash) : undefined };
}

/** Durée totale d'un Reel, carton de fin compris. */
export function reelDuration(reel: Pick<ReelSpec, 'scenes'>, endCard = REEL_END_CARD_SECONDS): number {
  return reel.scenes.reduce((sum, sc) => sum + sc.duration, 0) + endCard;
}
export const REEL_END_CARD_SECONDS = 2.5;

/** Ce qui empêche de générer la vidéo d'un Reel. */
export function reelProblems(reel: ReelSpec | null): string[] {
  if (!reel || reel.scenes.length === 0) return ['Ajoutez au moins une scène.'];
  const problems: string[] = [];
  reel.scenes.forEach((sc, i) => {
    if (sc.type === 'photo' && !sc.photo_url) problems.push(`Scène ${i + 1} : choisissez une photo.`);
    if (sc.type === 'video' && !sc.video_url) problems.push(`Scène ${i + 1} : choisissez une vidéo.`);
    if (sc.type === 'text' && !sc.text.trim()) problems.push(`Scène ${i + 1} : écrivez le texte de la diapo.`);
  });
  const total = reelDuration(reel);
  if (total > REEL_MAX_SECONDS) problems.push(`Le Reel dure ${Math.round(total)} s : ${REEL_MAX_SECONDS} s au plus.`);
  return problems;
}

/** Vidéo MP4 en ligne (Reel). */
export function isMp4Url(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.mp4$/i.test(u.pathname);
  } catch {
    return false;
  }
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
  post: Pick<SocialPost, 'caption' | 'hashtags' | 'link_path' | 'image_url' | 'networks'> & Partial<Pick<SocialPost, 'kind' | 'video_url'>>,
  connected: ConnectedNetworks,
  siteUrl = 'https://example.ch',
): string[] {
  const kind = post.kind ?? 'post';
  const problems: string[] = [];
  // Une story n'a pas de légende : ni Instagram ni Facebook n'en affichent.
  if (kind !== 'story' && !post.caption.trim()) problems.push('Écrivez la légende.');
  if (!post.networks.length) problems.push('Choisissez au moins un réseau.');
  if (kind === 'reel') {
    if (!post.video_url) problems.push('La vidéo du Reel n’a pas encore été générée.');
    else if (!isMp4Url(post.video_url)) problems.push('La vidéo du Reel doit être un fichier MP4 en ligne.');
  }
  if (!post.image_url) problems.push(kind === 'reel' ? 'La couverture du Reel n’a pas encore été enregistrée.' : 'Le visuel n’a pas encore été enregistré.');
  else if (!isJpegUrl(post.image_url)) problems.push('Le visuel doit être une image JPEG en ligne (Instagram refuse les autres formats).');
  for (const n of post.networks) {
    if (!connected[n]) problems.push(`${NETWORK_LABEL[n]} n’est pas relié : connectez le compte d’abord.`);
  }
  if (post.networks.includes('instagram') && kind !== 'story') {
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

export const MUSIC_MOODS = ['douce', 'lumineuse', 'zen', 'rythmee'] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];
export const MOOD_LABEL: Record<MusicMood, string> = { douce: 'Douce', lumineuse: 'Lumineuse', zen: 'Zen', rythmee: 'Rythmée' };

/** Scène de Reel proposée par l'IA, avant le choix des photos et vidéos. */
export interface ReelDraftScene {
  type: 'photo' | 'text' | 'video';
  text: string;
  /** Mots (français) pour trouver la photo dans la médiathèque. */
  photo_hint: string;
  /** Recherche (anglais) dans la banque de vidéos. */
  video_query: string;
  duration: number;
}

export interface SocialWriting {
  eyebrow: string;
  headline: string;
  caption: string;
  hashtags: string;
  /** Reels seulement. */
  scenes?: ReelDraftScene[];
  mood?: MusicMood;
}

/** Scènes d'un Reel rédigé par l'IA : 3 à 6, durées raisonnables, vidéo seulement si la banque est branchée. */
export function normalizeReelDraft(raw: any, videoAvailable: boolean): { scenes: ReelDraftScene[]; mood: MusicMood } {
  const list: any[] = Array.isArray(raw?.scenes) ? raw.scenes : [];
  const scenes = list
    .map((sc): ReelDraftScene | null => {
      let type: ReelDraftScene['type'] = sc?.type === 'text' ? 'text' : sc?.type === 'video' ? 'video' : 'photo';
      if (type === 'video' && (!videoAvailable || !String(sc?.video_query || '').trim())) type = 'photo';
      const text = clip(String(sc?.text ?? '').replace(/[#\n]+/g, ' ').replace(/\s+/g, ' '), 90);
      if (type === 'text' && !text) return null;
      return {
        type,
        text,
        photo_hint: clip(String(sc?.photo_hint ?? ''), 80),
        video_query: clip(String(sc?.video_query ?? ''), 60),
        duration: type === 'text' ? 2.5 : type === 'video' ? 3.5 : 3,
      };
    })
    .filter((x): x is ReelDraftScene => Boolean(x))
    .slice(0, 6);
  const mood: MusicMood = (MUSIC_MOODS as readonly string[]).includes(raw?.mood) ? raw.mood : 'douce';
  return { scenes, mood };
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
    // Un hashtag daté (#Noel2024) vieillit mal, et l'IA se trompe d'année : on les écarte.
    hashtags: formatHashtags(parseHashtags(tagsInput).filter((t) => !/\d{4}/.test(t)).slice(0, 12)),
  };
}

// ── Plan éditorial ───────────────────────────────────────────────────────────

/** Thèmes du plan : les catégories de la carte, plus ce qui fait vivre un compte d'institut. */
export const PILLARS = [
  { id: 'visage', label: 'Soins du visage' },
  { id: 'corps', label: 'Soins du corps' },
  { id: 'mains-pieds', label: 'Mains & pieds' },
  { id: 'regard', label: 'Beauté du regard' },
  { id: 'epilation', label: 'Épilation' },
  { id: 'conseil', label: 'Conseil beauté' },
  { id: 'institut', label: 'L’institut' },
  { id: 'offre', label: 'Offre du moment' },
  { id: 'cadeau', label: 'Bon cadeau' },
] as const;
export type PillarId = (typeof PILLARS)[number]['id'];
export const PILLAR_LABEL = Object.fromEntries(PILLARS.map((p) => [p.id, p.label])) as Record<PillarId, string>;

export function isPillar(v: unknown): v is PillarId {
  return typeof v === 'string' && PILLARS.some((p) => p.id === v);
}

/** Créneau du rythme de publication. `day` : 1 = lundi … 7 = dimanche. */
export interface RhythmSlot {
  day: number;
  time: string;
  kind: SocialKind;
}

export interface Rhythm {
  slots: RhythmSlot[];
}

/**
 * Rythme par défaut, en attendant de connaître l'audience réelle : Meta ne
 * donne les heures de connexion des abonnées qu'à partir de 100 abonnées.
 * Deux soirs de semaine (retour du travail) et un samedi matin.
 */
export const DEFAULT_RHYTHM: Rhythm = {
  slots: [
    { day: 2, time: '18:30', kind: 'post' },
    { day: 4, time: '18:30', kind: 'reel' },
    { day: 6, time: '09:30', kind: 'post' },
  ],
};

export const WEEKDAY_LABEL = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function parseRhythm(raw: unknown): Rhythm {
  let value: any = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { value = null; }
  }
  const slots: RhythmSlot[] = (Array.isArray(value?.slots) ? value.slots : [])
    .map((s: any) => ({
      day: Number(s?.day),
      time: String(s?.time || ''),
      kind: s?.kind === 'story' || s?.kind === 'reel' ? s.kind : 'post',
    }))
    .filter((s: RhythmSlot) => Number.isInteger(s.day) && s.day >= 1 && s.day <= 7 && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time));
  slots.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  return slots.length ? { slots } : DEFAULT_RHYTHM;
}

const TZ = 'Europe/Zurich';

/** Décalage de Zurich par rapport à UTC, en minutes, à cet instant. */
function zurichOffsetMinutes(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** « 2026-10-27 » + « 18:30 » à Zurich → instant UTC (heure d'été comprise). */
export function zurichToUtc(dayKey: string, time: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let at = new Date(guess - zurichOffsetMinutes(new Date(guess)) * 60000);
  at = new Date(guess - zurichOffsetMinutes(at) * 60000);
  return at;
}

export function zurichDayKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(at);
}

function addDays(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Jour de la semaine (1 = lundi) d'une date « AAAA-MM-JJ ». */
function isoWeekday(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export interface PlanSlot {
  at: string;
  dayKey: string;
  kind: SocialKind;
}

/**
 * Créneaux du rythme sur `days` jours à partir de `fromDayKey` (inclus),
 * en sautant ceux déjà passés et les jours qui ont déjà une publication.
 */
export function rhythmSlots(rhythm: Rhythm, fromDayKey: string, days: number, takenDays: Set<string>, now: Date = new Date()): PlanSlot[] {
  const out: PlanSlot[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDayKey, i);
    if (takenDays.has(day)) continue;
    for (const slot of rhythm.slots.filter((s) => s.day === isoWeekday(day))) {
      const at = zurichToUtc(day, slot.time);
      if (at.getTime() <= now.getTime() + 30 * 60_000) continue;
      out.push({ at: at.toISOString(), dayKey: day, kind: slot.kind });
    }
  }
  return out;
}

/** Moments de l'année qui donnent un sujet (Suisse romande). */
export function seasonalMoments(fromDayKey: string, toDayKey: string): { day: string; label: string }[] {
  const years = [...new Set([fromDayKey.slice(0, 4), toDayKey.slice(0, 4)])].map(Number);
  const moments: { day: string; label: string }[] = [];
  const secondSundayOfMay = (y: number) => {
    const first = new Date(Date.UTC(y, 4, 1)).getUTCDay();
    return `${y}-05-${String(1 + ((7 - first) % 7) + 7).padStart(2, '0')}`;
  };
  for (const y of years) {
    moments.push(
      { day: `${y}-02-14`, label: 'Saint-Valentin (un bon cadeau à offrir)' },
      { day: `${y}-03-20`, label: 'Printemps : peau qui se réveille, éclat' },
      { day: secondSundayOfMay(y), label: 'Fête des mères (bons cadeaux)' },
      { day: `${y}-06-01`, label: 'Avant l’été : épilation, jambes, pieds' },
      { day: `${y}-08-25`, label: 'Rentrée : reprendre soin de soi' },
      { day: `${y}-10-15`, label: 'Automne : peau qui tiraille, chauffage' },
      { day: `${y}-11-20`, label: 'Bons cadeaux de Noël (à offrir dès maintenant)' },
      { day: `${y}-12-20`, label: 'Dernier moment pour les bons cadeaux de Noël' },
      { day: `${y}-01-10`, label: 'Janvier : peau fatiguée par le froid, bonnes résolutions' },
    );
  }
  return moments.filter((m) => m.day >= fromDayKey && m.day <= toDayKey).sort((a, b) => a.day.localeCompare(b.day));
}

export interface PlanProposal {
  at: string;
  kind: SocialKind;
  pillar: PillarId;
  source: { kind: 'soin' | 'offre' | 'article'; id: string } | { kind: 'idee' };
  subject: string;
  angle: string;
}

/**
 * Normalise le plan rendu par l'IA : un sujet par créneau connu, sources
 * existantes, offre seulement pendant sa période. Ce qui ne colle pas devient
 * une idée libre (sans source) plutôt que d'être perdu.
 */
export function normalizePlan(
  raw: any,
  ctx: {
    slots: PlanSlot[];
    soinIds: Set<string>;
    articleIds: Set<string>;
    offers: { id: string; date_debut: string; date_fin: string }[];
  },
): PlanProposal[] {
  const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  const used = new Set<number>();
  const out: PlanProposal[] = [];
  for (const it of items) {
    const index = Number(it?.slot);
    if (!Number.isInteger(index) || index < 0 || index >= ctx.slots.length || used.has(index)) continue;
    const subject = String(it?.subject || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (subject.length < 4) continue;
    const slot = ctx.slots[index];
    const ref = String(it?.ref || '');
    let source: PlanProposal['source'] = { kind: 'idee' };
    if (it?.source === 'soin' && ctx.soinIds.has(ref)) source = { kind: 'soin', id: ref };
    else if (it?.source === 'article' && ctx.articleIds.has(ref)) source = { kind: 'article', id: ref };
    else if (it?.source === 'offre') {
      const offer = ctx.offers.find((o) => o.id === ref);
      if (offer && slot.dayKey >= offer.date_debut && slot.dayKey <= offer.date_fin) source = { kind: 'offre', id: ref };
    }
    const pillar: PillarId = isPillar(it?.pillar) ? it.pillar : source.kind === 'offre' ? 'offre' : 'conseil';
    used.add(index);
    out.push({
      at: slot.at,
      kind: slot.kind,
      pillar,
      source,
      subject,
      angle: String(it?.angle || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// ── Semaine à préparer ───────────────────────────────────────────────────────

/** Lundi (« AAAA-MM-JJ ») de la semaine qui contient `dayKey`. */
export function weekStart(dayKey: string): string {
  return addDays(dayKey, 1 - isoWeekday(dayKey));
}

/** Lundi de la semaine suivante. */
export function nextWeekStart(dayKey: string): string {
  return addDays(weekStart(dayKey), 7);
}

export function weekEnd(weekStartKey: string): string {
  return addDays(weekStartKey, 6);
}

export function shiftWeek(weekStartKey: string, weeks: number): string {
  return addDays(weekStartKey, weeks * 7);
}

/** « du 26 octobre au 1er novembre » */
export function weekLabel(weekStartKey: string): string {
  const fmt = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    const day = d === 1 ? '1er' : String(d);
    return `${day} ${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-CH', { timeZone: 'UTC', month: 'long' })}`;
  };
  return `du ${fmt(weekStartKey)} au ${fmt(weekEnd(weekStartKey))}`;
}

/** Jour de préparation de la semaine suivante (1 = lundi … 7 = dimanche). */
export const DEFAULT_WEEKLY_DAY = 3;

export function parseWeeklyDay(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : DEFAULT_WEEKLY_DAY;
}

/**
 * La tâche planifiée prépare-t-elle aujourd'hui le plan de la semaine
 * suivante ? Le jour réglé, ou plus tard dans la semaine si elle l'a manqué.
 */
export function shouldPrepareNextWeek(todayKey: string, weeklyDay: number): boolean {
  return isoWeekday(todayKey) >= weeklyDay;
}

/** Où en est une publication du cycle hebdomadaire. */
export type WeekState = 'sujet' | 'a_relire' | 'programmee' | 'publiee' | 'echec';

export function weekState(p: Pick<SocialPost, 'status' | 'kind' | 'caption' | 'hashtags' | 'link_path' | 'image_url' | 'networks' | 'video_url'>): WeekState {
  if (p.status === 'scheduled' || p.status === 'publishing') return 'programmee';
  if (p.status === 'published' || p.status === 'partial') return 'publiee';
  if (p.status === 'failed') return 'echec';
  // Brouillon : sujet tant que rien n'est rédigé ni mis en image.
  const ready = publishProblems(p, { instagram: true, facebook: true }).length === 0;
  return ready ? 'a_relire' : 'sujet';
}

export const WEEK_STATE_LABEL: Record<WeekState, string> = {
  sujet: 'Sujet à valider',
  a_relire: 'À relire',
  programmee: 'Validée, programmée',
  publiee: 'Publiée',
  echec: 'Échec',
};

/** Instant UTC du début et de la fin d'une semaine (lundi 00:00 → lundi suivant 00:00, Zurich). */
export function weekRange(weekStartKey: string): { from: string; to: string } {
  return {
    from: zurichToUtc(weekStartKey, '00:00').toISOString(),
    to: zurichToUtc(addDays(weekStartKey, 7), '00:00').toISOString(),
  };
}
