/**
 * Montage des Reels dans le navigateur (aucun serveur vidéo).
 *
 * Une scène = une photo (zoom lent), un extrait vidéo (Pexels) ou une diapo de
 * texte sur le fond marine du site ; le texte apparaît en Lora, comme sur les
 * visuels. Fondu entre les scènes, carton final avec le logo. Le même dessin
 * sert à l'aperçu (lecture en temps réel) et à l'encodage MP4 (image par
 * image) : ce qu'on voit est ce qui part.
 *
 * Encodage : Mediabunny (WebCodecs), H.264 + AAC 48 kHz, métadonnées en tête
 * de fichier (« fast start ») et listes d'éditions neutralisées — les
 * exigences d'Instagram pour un Reel. Si le navigateur n'encode pas l'AAC,
 * l'encodeur de secours (@mediabunny/aac-encoder) prend le relais.
 */
import { REEL_END_CARD_SECONDS, reelDuration, type ReelScene, type ReelSpec } from '../types/social';
import {
  drawCover, drawLines, drawMarineBackground, fitText, headingFont, insets, layoutMarine,
  loadBitmap, loadVisualAssets, MARGIN, rgba, VISUAL_SIZE,
  type VisualAssets, type VisualBrand,
} from './socialVisual';
import { neutralizeEditLists } from './mp4Boxes';

export const REEL_FPS = 30;
const { w: W, h: H } = VISUAL_SIZE.story;
const FADE = 0.45;
const TEXT_IN = 0.7;

export interface ReelAssets {
  brand: VisualAssets;
  photos: Map<string, ImageBitmap | null>;
  videos: Map<string, HTMLVideoElement | null>;
}

function loadVideo(url: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; // videos.pexels.com répond avec un CORS ouvert
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok ? v : null); };
    const timer = setTimeout(() => done(false), 20000);
    v.addEventListener('loadeddata', () => done(true), { once: true });
    v.addEventListener('error', () => done(false), { once: true });
    v.src = url;
  });
}

export async function loadReelAssets(reel: ReelSpec, brand: VisualBrand, token: string): Promise<ReelAssets> {
  const photoUrls = [...new Set(reel.scenes.filter((s) => s.type === 'photo' && s.photo_url).map((s) => s.photo_url!))];
  const videoUrls = [...new Set(reel.scenes.filter((s) => s.type === 'video' && s.video_url).map((s) => s.video_url!))];
  const [brandAssets, photos, videos] = await Promise.all([
    loadVisualAssets({ layout: 'marine', format: 'story', eyebrow: '', headline: '', photo_url: null }, brand, token),
    Promise.all(photoUrls.map(async (u) => [u, await loadBitmap(u, token)] as const)),
    Promise.all(videoUrls.map(async (u) => [u, await loadVideo(u)] as const)),
  ]);
  return { brand: brandAssets, photos: new Map(photos), videos: new Map(videos) };
}

/** Ce qui n'a pas pu être chargé, pour le dire avant d'encoder. */
export function missingAssets(reel: ReelSpec, assets: ReelAssets): string[] {
  const out: string[] = [];
  reel.scenes.forEach((s, i) => {
    if (s.type === 'photo' && s.photo_url && !assets.photos.get(s.photo_url)) out.push(`Scène ${i + 1} : la photo n’a pas pu être chargée.`);
    if (s.type === 'video' && s.video_url && !assets.videos.get(s.video_url)) out.push(`Scène ${i + 1} : la vidéo n’a pas pu être chargée.`);
  });
  return out;
}

// ── Chronologie ──────────────────────────────────────────────────────────────

interface Placed { scene: ReelScene; start: number; end: number }

export function timeline(reel: ReelSpec): { placed: Placed[]; total: number; endStart: number } {
  let t = 0;
  const placed = reel.scenes.map((scene) => {
    const p = { scene, start: t, end: t + scene.duration };
    t = p.end;
    return p;
  });
  return { placed, total: reelDuration(reel), endStart: t };
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** Photo ou vidéo plein cadre, voile marine en bas, texte qui monte. */
function drawMediaScene(ctx: CanvasRenderingContext2D, img: CanvasImageSource | null, scene: ReelScene, local: number, brand: VisualBrand, zoom: boolean) {
  ctx.fillStyle = brand.primary;
  ctx.fillRect(0, 0, W, H);
  if (img) {
    if (zoom) {
      // Zoom lent (« Ken Burns ») : 8 % sur la durée de la scène.
      const k = 1 + 0.08 * clamp(local / scene.duration);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(k, k);
      ctx.translate(-W / 2, -H / 2);
      drawCover(ctx, img, 0, 0, W, H);
      ctx.restore();
    } else {
      drawCover(ctx, img, 0, 0, W, H);
    }
  }
  if (!scene.text.trim()) return;

  const veil = ctx.createLinearGradient(0, H * 0.4, 0, H);
  veil.addColorStop(0, rgba(brand.primary, 0));
  veil.addColorStop(0.55, rgba(brand.primary, 0.7));
  veil.addColorStop(1, rgba(brand.primary, 0.92));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  const appear = ease(local / TEXT_IN);
  const fit = fitText(ctx, scene.text, headingFont(brand), { width: W - 2 * MARGIN, height: H * 0.3, maxLines: 4 }, { max: 84, min: 52, leading: 1.14 });
  const bottom = H - insets(W, H).bottom - 40;
  const top = bottom - fit.lines.length * fit.lineHeight + (1 - appear) * 40;
  ctx.globalAlpha = appear;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = headingFont(brand)(fit.size);
  drawLines(ctx, fit, MARGIN, top, 'left');
  ctx.globalAlpha = 1;
}

/** Diapo de texte sur le fond marine du site. */
function drawTextScene(ctx: CanvasRenderingContext2D, scene: ReelScene, local: number, brand: VisualBrand, assets: VisualAssets) {
  drawMarineBackground(ctx, W, H, brand, assets.algue);
  const appear = ease(local / TEXT_IN);
  const fit = fitText(ctx, scene.text, headingFont(brand), { width: W - 2 * MARGIN - 40, height: H * 0.42, maxLines: 6 }, { max: 104, min: 58, leading: 1.12 });
  const block = fit.lines.length * fit.lineHeight;
  const top = (H - block) / 2 + (1 - appear) * 40;
  ctx.globalAlpha = appear;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = headingFont(brand)(fit.size);
  drawLines(ctx, fit, W / 2, top, 'center');
  ctx.globalAlpha = 1;
}

/** Carton final : le logo, l'adresse du site, l'invitation à réserver. */
function drawEndCard(ctx: CanvasRenderingContext2D, brand: VisualBrand, assets: VisualAssets) {
  layoutMarine(ctx, W, H, { layout: 'marine', format: 'story', eyebrow: brand.signature, headline: 'Réservez en ligne', photo_url: null }, brand, { ...assets, photo: null });
}

function sceneImage(scene: ReelScene, assets: ReelAssets): CanvasImageSource | null {
  if (scene.type === 'photo') return (scene.photo_url && assets.photos.get(scene.photo_url)) || null;
  if (scene.type === 'video') return (scene.video_url && assets.videos.get(scene.video_url)) || null;
  return null;
}

function drawScene(ctx: CanvasRenderingContext2D, p: Placed, t: number, brand: VisualBrand, assets: ReelAssets) {
  const local = Math.max(0, t - p.start);
  if (p.scene.type === 'text') drawTextScene(ctx, p.scene, local, brand, assets.brand);
  else drawMediaScene(ctx, sceneImage(p.scene, assets), p.scene, local, brand, p.scene.type === 'photo');
}

/**
 * Dessine l'image du Reel à l'instant `t` (secondes). Les vidéos doivent être
 * positionnées au bon instant avant l'appel (`syncVideos`).
 */
export function drawReelFrame(ctx: CanvasRenderingContext2D, reel: ReelSpec, t: number, brand: VisualBrand, assets: ReelAssets) {
  const { placed } = timeline(reel);
  ctx.globalAlpha = 1;
  const index = placed.findIndex((p) => t < p.end);
  if (index === -1) {
    drawEndCard(ctx, brand, assets.brand);
    return;
  }
  const current = placed[index];
  drawScene(ctx, current, t, brand, assets);
  // Fondu vers la scène suivante (ou le carton final) sur la fin de la scène.
  const fadeStart = current.end - FADE;
  if (t > fadeStart) {
    ctx.globalAlpha = ease((t - fadeStart) / FADE);
    const next = placed[index + 1];
    if (next) drawScene(ctx, next, next.start, brand, assets);
    else drawEndCard(ctx, brand, assets.brand);
    ctx.globalAlpha = 1;
  }
}

/** Instant de chaque vidéo à `t` (elles tournent en boucle si l'extrait est court). */
function videoTimes(reel: ReelSpec, t: number): Map<string, number> {
  const { placed } = timeline(reel);
  const out = new Map<string, number>();
  for (const p of placed) {
    if (p.scene.type !== 'video' || !p.scene.video_url) continue;
    const local = Math.max(0, Math.min(t, p.end) - p.start);
    if (t >= p.start - FADE && t <= p.end) out.set(p.scene.video_url, local);
  }
  return out;
}

function seek(v: HTMLVideoElement, time: number): Promise<void> {
  const target = v.duration ? time % Math.max(0.1, v.duration - 0.05) : time;
  if (Math.abs(v.currentTime - target) < 0.001) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    v.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
    v.currentTime = target;
  });
}

/** Encodage : place chaque vidéo exactement à l'instant de l'image. */
async function syncVideos(reel: ReelSpec, t: number, assets: ReelAssets) {
  await Promise.all([...videoTimes(reel, t)].map(([url, local]) => {
    const v = assets.videos.get(url);
    return v ? seek(v, local) : null;
  }));
}

// ── Aperçu en temps réel ─────────────────────────────────────────────────────

export interface ReelPlayer {
  stop: () => void;
}

/** Lit le Reel dans le canvas, musique comprise. */
export function playReel(
  canvas: HTMLCanvasElement,
  reel: ReelSpec,
  brand: VisualBrand,
  assets: ReelAssets,
  music: AudioBuffer | null,
  onEnd: () => void,
): ReelPlayer {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const { total } = timeline(reel);
  let audioCtx: AudioContext | null = null;
  if (music) {
    audioCtx = new AudioContext();
    const src = audioCtx.createBufferSource();
    src.buffer = music;
    src.connect(audioCtx.destination);
    src.start();
  }
  const started = performance.now();
  let raf = 0;
  let stopped = false;
  const playing = new Set<HTMLVideoElement>();

  const tick = () => {
    if (stopped) return;
    const t = (performance.now() - started) / 1000;
    if (t >= total) {
      stop();
      onEnd();
      return;
    }
    const times = videoTimes(reel, t);
    for (const [url, local] of times) {
      const v = assets.videos.get(url);
      if (!v) continue;
      if (!playing.has(v)) {
        v.currentTime = local % Math.max(0.1, v.duration || local + 1);
        v.loop = true;
        v.play().catch(() => {});
        playing.add(v);
      }
    }
    for (const v of playing) {
      if (![...times.keys()].some((u) => assets.videos.get(u) === v)) {
        v.pause();
        playing.delete(v);
      }
    }
    drawReelFrame(ctx, reel, t, brand, assets);
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    for (const v of playing) v.pause();
    playing.clear();
    audioCtx?.close().catch(() => {});
  };
  raf = requestAnimationFrame(tick);
  return { stop };
}

/** Image fixe du Reel à l'instant `t` (aperçu à l'arrêt, couverture). */
export async function drawReelStill(canvas: HTMLCanvasElement, reel: ReelSpec, t: number, brand: VisualBrand, assets: ReelAssets) {
  canvas.width = W;
  canvas.height = H;
  await syncVideos(reel, t, assets);
  drawReelFrame(canvas.getContext('2d')!, reel, t, brand, assets);
}

// ── Musique ──────────────────────────────────────────────────────────────────

const decoded = new Map<string, Promise<AudioBuffer>>();

/** Décode la musique (passée par le relais du site : R2 n'envoie pas de CORS). */
function decodeMusic(url: string, token: string): Promise<AudioBuffer> {
  const hit = decoded.get(url);
  if (hit) return hit;
  const p = fetch(`/api/admin/social/photo?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (res) => {
      if (!res.ok) throw new Error('La musique n’a pas pu être chargée.');
      const data = await res.arrayBuffer();
      const ctx = new OfflineAudioContext(2, 48000, 48000);
      return ctx.decodeAudioData(data);
    });
  p.catch(() => decoded.delete(url));
  decoded.set(url, p);
  return p;
}

/**
 * Piste son du Reel, à la durée exacte : musique (bouclée si trop courte),
 * fondu d'entrée et de sortie ; silence s'il n'y a pas de musique (Instagram
 * attend une piste audio).
 */
export async function buildSoundtrack(reel: ReelSpec, token: string): Promise<AudioBuffer> {
  const total = reelDuration(reel);
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  if (reel.music?.url) {
    const music = await decodeMusic(reel.music.url, token);
    const src = ctx.createBufferSource();
    src.buffer = music;
    src.loop = music.duration < total;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(0.85, 0.4);
    gain.gain.setValueAtTime(0.85, Math.max(0.5, total - 1.8));
    gain.gain.linearRampToValueAtTime(0, total);
    src.connect(gain).connect(ctx.destination);
    src.start(0);
  }
  return ctx.startRendering();
}

// ── Encodage MP4 ─────────────────────────────────────────────────────────────

export async function reelEncodingSupport(): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') {
    return 'Ce navigateur ne sait pas fabriquer de vidéo. Utilisez Chrome ou Edge (ou Safari à jour) sur ordinateur.';
  }
  const { canEncodeVideo } = await import('mediabunny');
  if (!(await canEncodeVideo('avc', { width: W, height: H, frameRate: REEL_FPS }))) {
    return 'Ce navigateur ne sait pas encoder la vidéo en H.264. Utilisez Chrome ou Edge sur ordinateur.';
  }
  return null;
}

export interface RenderedReel {
  mp4: Blob;
  cover: Blob;
  seconds: number;
}

/** Monte et encode le Reel. `onProgress` reçoit une valeur entre 0 et 1. */
export async function renderReelMp4(
  reel: ReelSpec,
  brand: VisualBrand,
  assets: ReelAssets,
  token: string,
  onProgress: (p: number) => void,
): Promise<RenderedReel> {
  const unsupported = await reelEncodingSupport();
  if (unsupported) throw new Error(unsupported);
  const mb = await import('mediabunny');
  if (!(await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48000 }))) {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
  }

  const soundtrack = await buildSoundtrack(reel, token);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const video = new mb.CanvasSource(canvas, { codec: 'avc', quality: new mb.Quality({ bitrate: 6_000_000 }), keyFrameInterval: 2 });
  const audio = new mb.AudioBufferSource({ codec: 'aac', quality: new mb.Quality({ bitrate: 128_000 }) });
  output.addVideoTrack(video, { frameRate: REEL_FPS });
  output.addAudioTrack(audio);
  await output.start();

  const { total } = timeline(reel);
  const frames = Math.round(total * REEL_FPS);
  try {
    for (let i = 0; i < frames; i++) {
      const t = i / REEL_FPS;
      await syncVideos(reel, t, assets);
      drawReelFrame(ctx, reel, t, brand, assets);
      await video.add(t, 1 / REEL_FPS);
      if (i % 10 === 0) onProgress((i / frames) * 0.92);
    }
    video.close();
    await audio.add(soundtrack);
    audio.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }

  const bytes = new Uint8Array(output.target.buffer!);
  neutralizeEditLists(bytes);
  onProgress(0.96);

  // Couverture : l'image à 1 s (ou au milieu d'un Reel très court), en JPEG.
  await drawReelStill(canvas, reel, Math.min(1, total / 2), brand, assets);
  const cover = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couverture impossible.'))), 'image/jpeg', 0.9),
  );
  onProgress(1);
  return { mp4: new Blob([bytes], { type: 'video/mp4' }), cover, seconds: total };
}

export { REEL_END_CARD_SECONDS };
