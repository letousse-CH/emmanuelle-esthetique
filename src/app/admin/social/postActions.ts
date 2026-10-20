/**
 * Actions de préparation d'une publication, côté navigateur : rédiger,
 * choisir les photos, composer un Reel, dessiner et déposer les fichiers,
 * enregistrer. Partagées par l'éditeur et par « Préparer la semaine » du plan.
 */
import { supabase } from '../../../services/supabase';
import { CARTE } from '../../../constants/carteSoins';
import {
  normalizePost, PILLAR_LABEL, reelProblems,
  type MusicMood, type PillarId, type ReelDraftScene, type ReelMusic, type ReelScene, type ReelSpec,
  type SocialKind, type SocialNetwork, type SocialPost, type SocialSourceType, type SocialVisual,
} from '../../../types/social';
import { renderToJpeg, visualHash, type VisualBrand } from '../../../utils/socialVisual';
import { api, sessionToken } from './api';
import { loadLibrary, suggestPhoto, type LibraryPhoto } from './PhotoPicker';

export type EditorSource =
  | { kind: 'idee'; text: string }
  | { kind: 'soin'; id: string }
  | { kind: 'article'; id: string }
  | { kind: 'offre'; id: string };

export interface WriteResult {
  eyebrow: string;
  headline: string;
  caption: string;
  hashtags: string;
  scenes?: ReelDraftScene[];
  mood?: MusicMood;
  source: { kind: SocialSourceType; ref: string; title: string; linkPath: string; photoUrl: string | null };
}

export function requestWriting(source: EditorSource, instruction: string, kind: SocialKind, plannedFor?: string | null): Promise<WriteResult> {
  return api<WriteResult>('/api/admin/social/write', { source, instruction, kind, plannedFor: plannedFor || undefined });
}

/** La source d'un brouillon du plan, telle que l'éditeur la reprend. */
export function sourceOf(post: Pick<SocialPost, 'source_type' | 'source_ref' | 'title'>): EditorSource {
  if ((post.source_type === 'soin' || post.source_type === 'offre' || post.source_type === 'article') && post.source_ref && post.source_ref !== post.source_type) {
    return { kind: post.source_type, id: post.source_ref };
  }
  return { kind: 'idee', text: post.title };
}

const PHOTO_WORDS: Record<string, string[]> = {
  visage: ['visage', 'phytomer', 'soin'],
  corps: ['massage', 'corps', 'dos'],
  'mains-pieds': ['main', 'pied', 'ongle', 'manucure'],
  regard: ['regard', 'cil', 'sourcil'],
  epilation: ['epilation', 'cire', 'sucre'],
};

/** Photo du sujet : celle de l'article ou de l'offre, sinon la médiathèque d'après le thème. */
export async function pickPhoto(source: EditorSource, writing: Pick<WriteResult, 'headline' | 'eyebrow' | 'source'>): Promise<string | null> {
  if (writing.source.photoUrl) return writing.source.photoUrl;
  const library = await loadLibrary();
  const soin = source.kind === 'soin' ? CARTE.find((c) => c.groups.some((g) => g.items.some((i) => i.id === source.id))) : null;
  const words = soin ? PHOTO_WORDS[soin.id] : `${writing.headline} ${writing.eyebrow}`.split(/\s+/).filter((w) => w.length > 4);
  return suggestPhoto(library, words);
}

// ── Musique ──────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  title: string;
  mood: MusicMood;
  url: string;
  duration_s: number | null;
  credit: string | null;
}

export async function loadMusic(): Promise<MusicTrack[]> {
  const { data } = await supabase.from('social_music').select('*').order('created_at', { ascending: false });
  return (data ?? []) as MusicTrack[];
}

export function trackToMusic(t: MusicTrack): ReelMusic {
  return { url: t.url, title: t.title, credit: t.credit };
}

// ── Banque de vidéos ─────────────────────────────────────────────────────────

export interface StockVideo {
  id: number;
  duration: number;
  thumb: string;
  url: string;
  credit: string;
  page: string;
}

export async function stockConfigured(): Promise<boolean> {
  try {
    return Boolean((await api<{ configured: boolean }>('/api/admin/social/stock')).configured);
  } catch {
    return false;
  }
}

export async function searchStock(q: string): Promise<StockVideo[]> {
  return (await api<{ videos: StockVideo[] }>(`/api/admin/social/stock?q=${encodeURIComponent(q)}`)).videos;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Transforme les scènes proposées par l'IA en Reel : une photo différente par
 * scène, un extrait vidéo pour les scènes vidéo (repli sur une photo si la
 * banque ne trouve rien), une musique de l'ambiance demandée.
 */
export async function composeReel(draft: ReelDraftScene[], mood: MusicMood | undefined, firstPhoto: string | null): Promise<ReelSpec> {
  const [library, music] = await Promise.all([loadLibrary(), loadMusic()]);
  const used = new Set<string>();
  const pick = (hint: string): string | null => {
    const words = hint.split(/[\s,]+/).filter((w) => w.length > 2);
    const fresh = library.filter((p: LibraryPhoto) => !used.has(p.url));
    const url = suggestPhoto(fresh.length ? fresh : library, words);
    if (url) used.add(url);
    return url;
  };
  const scenes: ReelScene[] = [];
  for (const [i, d] of draft.entries()) {
    if (d.type === 'video' && d.video_query) {
      const found = await searchStock(d.video_query).catch(() => [] as StockVideo[]);
      const v = found.find((x) => x.duration >= d.duration) || found[0];
      if (v) {
        scenes.push({ id: newId(), type: 'video', video_url: v.url, video_thumb: v.thumb, credit: v.credit, text: d.text, duration: d.duration });
        continue;
      }
    }
    if (d.type === 'text') {
      scenes.push({ id: newId(), type: 'text', text: d.text, duration: d.duration });
      continue;
    }
    const photo = i === 0 && firstPhoto ? firstPhoto : pick(d.photo_hint || d.text);
    if (photo) used.add(photo);
    scenes.push({ id: newId(), type: 'photo', photo_url: photo, text: d.text, duration: d.type === 'video' ? 3 : d.duration });
  }
  const track = music.find((m) => m.mood === mood) || music[0];
  return { scenes, music: track ? trackToMusic(track) : null };
}

export function reelHash(reel: ReelSpec, brand: VisualBrand): string {
  const input = JSON.stringify([1, reel.scenes.map((s) => [s.type, s.photo_url, s.video_url, s.text.trim(), s.duration]), reel.music?.url, brand]);
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// ── Dépôt des fichiers ───────────────────────────────────────────────────────

export async function uploadVisual(visual: SocialVisual, brand: VisualBrand): Promise<string> {
  const blob = await renderToJpeg(visual, brand, await sessionToken());
  return (await api<{ url: string }>('/api/admin/social/visual', blob)).url;
}

const PART = 5 * 1024 * 1024; // le minimum de S3/R2 pour un morceau (sauf le dernier)

/** Dépose un MP4 sur R2 par morceaux (Netlify refuse les requêtes de plus de 6 Mo). */
export async function uploadMp4(mp4: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { key, uploadId } = await api<{ key: string; uploadId: string }>('/api/admin/social/video?action=start', {});
  const parts: { n: number; etag: string }[] = [];
  try {
    for (let n = 1, offset = 0; offset < mp4.size; n++, offset += PART) {
      const chunk = new Blob([mp4.slice(offset, offset + PART)], { type: 'application/octet-stream' });
      const { etag } = await api<{ etag: string }>(
        `/api/admin/social/video?action=part&key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&n=${n}`,
        chunk,
      );
      parts.push({ n, etag });
      onProgress?.(Math.min(1, (offset + PART) / mp4.size));
    }
    return (await api<{ url: string }>('/api/admin/social/video?action=complete', { key, uploadId, parts })).url;
  } catch (err) {
    await api('/api/admin/social/video?action=abort', { key, uploadId }).catch(() => {});
    throw err;
  }
}

/** Monte, encode et dépose un Reel. Renvoie la vidéo et sa couverture. */
export async function produceReel(
  reel: ReelSpec,
  brand: VisualBrand,
  onProgress: (label: string, p: number) => void,
): Promise<{ videoUrl: string; coverUrl: string }> {
  const problems = reelProblems(reel);
  if (problems.length) throw new Error(problems.join(' '));
  const { loadReelAssets, missingAssets, renderReelMp4 } = await import('../../../utils/reelRender');
  const token = await sessionToken();
  onProgress('Chargement des images', 0);
  const assets = await loadReelAssets(reel, brand, token);
  const missing = missingAssets(reel, assets);
  if (missing.length) throw new Error(missing.join(' '));
  const out = await renderReelMp4(reel, brand, assets, token, (p) => onProgress('Montage de la vidéo', p));
  onProgress('Envoi de la vidéo', 0);
  const videoUrl = await uploadMp4(out.mp4, (p) => onProgress('Envoi de la vidéo', p));
  const coverUrl = (await api<{ url: string }>('/api/admin/social/visual', out.cover)).url;
  return { videoUrl, coverUrl };
}

// ── Enregistrement ───────────────────────────────────────────────────────────

export interface PostRow {
  kind: SocialKind;
  title: string;
  caption: string;
  hashtags: string;
  link_path: string | null;
  visual: SocialVisual;
  image_url: string | null;
  cover_image: string | null;
  networks: SocialNetwork[];
  reel?: ReelSpec | null;
  video_url?: string | null;
  pillar?: PillarId | null;
  plan_note?: string | null;
  planned_at?: string | null;
}

export async function savePostRow(
  post: SocialPost | null,
  row: PostRow,
  source: { type: SocialSourceType; ref: string },
): Promise<SocialPost> {
  const query = post
    ? supabase.from('social_posts').update(row).eq('id', post.id).select('*').single()
    : supabase.from('social_posts').insert({ ...row, source_type: source.type, source_ref: source.ref || source.type, content: {}, status: 'draft' }).select('*').single();
  const { data, error } = await query;
  if (error || !data) throw new Error(error?.message || 'Enregistrement impossible.');
  return normalizePost(data);
}

/**
 * Prépare entièrement un brouillon du plan : rédaction, photo, visuel (ou
 * Reel monté), enregistrement. Utilisé par « Préparer la semaine ».
 */
export async function prepareDraft(
  post: SocialPost,
  brand: VisualBrand,
  onProgress: (label: string, p: number) => void,
  /** Texte déjà rédigé (rédactions lancées en parallèle par la semaine). */
  written?: WriteResult,
): Promise<SocialPost> {
  const source = sourceOf(post);
  onProgress('Rédaction', 0);
  const w = written ?? await requestWriting(source, post.plan_note || '', post.kind, post.planned_at);
  const photo = await pickPhoto(source, w);
  const visual: SocialVisual = {
    ...post.visual,
    layout: post.kind === 'story' ? 'marine' : post.visual.layout,
    format: post.kind === 'post' ? (post.visual.format === 'square' ? 'square' : 'portrait') : 'story',
    eyebrow: w.eyebrow || (post.pillar ? PILLAR_LABEL[post.pillar] : ''),
    headline: w.headline,
    photo_url: photo,
  };
  let imageUrl: string;
  let reel: ReelSpec | null = null;
  let videoUrl: string | null = null;
  if (post.kind === 'reel') {
    reel = await composeReel(w.scenes || [], w.mood, photo);
    const produced = await produceReel(reel, brand, onProgress);
    reel = { ...reel, hash: reelHash(reel, brand) };
    imageUrl = produced.coverUrl;
    videoUrl = produced.videoUrl;
  } else {
    onProgress('Visuel', 0.5);
    imageUrl = await uploadVisual(visual, brand);
  }
  return savePostRow(post, {
    kind: post.kind,
    title: w.source.title || w.headline,
    caption: w.caption,
    hashtags: w.hashtags,
    link_path: w.source.linkPath || '/reservation',
    visual: { ...visual, hash: post.kind === 'reel' ? undefined : visualHash(visual, brand) },
    image_url: imageUrl,
    cover_image: photo,
    networks: post.networks,
    reel,
    video_url: videoUrl,
  }, { type: w.source.kind, ref: w.source.ref });
}
