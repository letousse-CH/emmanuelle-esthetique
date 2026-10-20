"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Film, ImageIcon, Loader2, Play, Plus, Search, Square, Trash2, Type, X } from 'lucide-react';
import { Button, Callout, Field, Input, Select } from '../../../components/admin/ui';
import { MOOD_LABEL, reelDuration, reelProblems, REEL_MAX_SECONDS, type ReelScene, type ReelSpec } from '../../../types/social';
import type { VisualBrand } from '../../../utils/socialVisual';
import { sessionToken } from './api';
import PhotoPicker from './PhotoPicker';
import { loadMusic, searchStock, stockConfigured, trackToMusic, type MusicTrack, type StockVideo } from './postActions';

const DURATIONS = [2, 2.5, 3, 4, 5, 6, 8];
const newId = () => Math.random().toString(36).slice(2, 10);

interface Props {
  reel: ReelSpec;
  onChange: (reel: ReelSpec) => void;
  brand: VisualBrand;
  editable: boolean;
  onOpenSettings: () => void;
}

export default function ReelComposer({ reel, onChange, brand, editable, onOpenSettings }: Props) {
  const [music, setMusic] = useState<MusicTrack[] | null>(null);
  const [stock, setStock] = useState(false);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const [videoFor, setVideoFor] = useState<string | null>(null);

  useEffect(() => {
    loadMusic().then(setMusic);
    stockConfigured().then(setStock);
  }, []);

  const update = (id: string, patch: Partial<ReelScene>) =>
    onChange({ ...reel, scenes: reel.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const scenes = [...reel.scenes];
    const j = i + d;
    if (j < 0 || j >= scenes.length) return;
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    onChange({ ...reel, scenes });
  };
  const remove = (id: string) => onChange({ ...reel, scenes: reel.scenes.filter((s) => s.id !== id) });
  const add = (type: ReelScene['type']) => {
    const scene: ReelScene = { id: newId(), type, text: '', duration: type === 'text' ? 2.5 : 3, photo_url: null, video_url: null };
    onChange({ ...reel, scenes: [...reel.scenes, scene] });
    if (type === 'photo') setPhotoFor(scene.id);
    if (type === 'video') setVideoFor(scene.id);
  };

  const total = reelDuration(reel);
  const problems = reelProblems(reel);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {reel.scenes.map((s, i) => (
          <div key={s.id} className="flex items-start gap-3 rounded-lg bg-white p-2.5">
            <button
              type="button"
              disabled={!editable || s.type === 'text'}
              onClick={() => (s.type === 'photo' ? setPhotoFor(s.id) : setVideoFor(s.id))}
              className="relative h-[72px] w-[41px] shrink-0 overflow-hidden bg-stone-100 cursor-pointer disabled:cursor-default"
              aria-label={s.type === 'text' ? 'Diapo de texte' : 'Changer le média'}
              style={s.type === 'text' ? { background: `linear-gradient(135deg, #2f6d78, ${brand.primary})` } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.type === 'photo' && s.photo_url && <img src={s.photo_url} alt="" className="h-full w-full object-cover" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.type === 'video' && s.video_thumb && <img src={s.video_thumb} alt="" className="h-full w-full object-cover" />}
              {s.type === 'text' && <Type size={16} className="absolute inset-0 m-auto text-white" />}
              {s.type === 'video' && <Film size={13} className="absolute bottom-1 right-1 text-white drop-shadow" />}
              {((s.type === 'photo' && !s.photo_url) || (s.type === 'video' && !s.video_url)) && (
                <ImageIcon size={16} className="absolute inset-0 m-auto text-stone-400" />
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-stone-600">
                <span>Scène {i + 1} · {s.type === 'photo' ? 'Photo' : s.type === 'video' ? 'Vidéo' : 'Texte'}</span>
                {s.credit && <span className="font-normal text-stone-500">— vidéo de {s.credit} (Pexels)</span>}
              </div>
              <Input
                value={s.text}
                disabled={!editable}
                maxLength={90}
                onChange={(e) => update(s.id, { text: e.target.value })}
                placeholder={s.type === 'text' ? 'Le texte de la diapo' : 'Texte posé sur l’image (facultatif)'}
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Select
                value={String(s.duration)}
                disabled={!editable}
                onChange={(e) => update(s.id, { duration: Number(e.target.value) })}
                className="w-24"
                aria-label="Durée"
              >
                {[...new Set([...DURATIONS, s.duration])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{String(d).replace('.', ',')} s</option>)}
              </Select>
              {editable && (
                <div className="flex gap-0.5">
                  <Button size="sm" variant="ghost" icon={ArrowUp} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter" />
                  <Button size="sm" variant="ghost" icon={ArrowDown} onClick={() => move(i, 1)} disabled={i === reel.scenes.length - 1} aria-label="Descendre" />
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(s.id)} aria-label="Supprimer la scène" />
                </div>
              )}
            </div>
          </div>
        ))}
        <p className="rounded-lg bg-white px-3 py-2.5 text-[13px] text-stone-600">
          Puis le carton final : le logo et « Réservez en ligne » (2,5 s).
        </p>
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Plus} onClick={() => add('photo')}>Photo</Button>
          <Button size="sm" icon={Plus} onClick={() => add('text')}>Texte</Button>
          {stock
            ? <Button size="sm" icon={Plus} onClick={() => add('video')}>Vidéo libre de droits</Button>
            : <button type="button" onClick={onOpenSettings} className="text-[13px] text-stone-600 underline cursor-pointer">Brancher la banque de vidéos (Pexels)</button>}
        </div>
      )}

      <Field label="Musique" hint={music && !music.length ? undefined : 'Libre de droits, intégrée à la vidéo (Instagram ne donne pas accès à sa musique par l’API).'}>
        {music && !music.length ? (
          <p className="text-[13.5px] text-stone-700">
            Aucune musique dans la bibliothèque.{' '}
            <button type="button" onClick={onOpenSettings} className="font-semibold text-accent underline cursor-pointer">Ajouter des musiques</button>
            {' '}— sans musique, le Reel est muet.
          </p>
        ) : (
          <Select
            value={reel.music?.url || ''}
            disabled={!editable || !music}
            onChange={(e) => {
              const t = music?.find((m) => m.url === e.target.value);
              onChange({ ...reel, music: t ? trackToMusic(t) : null });
            }}
          >
            <option value="">Sans musique</option>
            {(music ?? []).map((m) => <option key={m.id} value={m.url}>{m.title} — {MOOD_LABEL[m.mood] || m.mood}</option>)}
          </Select>
        )}
      </Field>

      <p className={`text-[13px] ${total > REEL_MAX_SECONDS ? 'font-semibold text-red-700' : 'text-stone-600'}`}>
        Durée : {Math.round(total * 10) / 10} s{total > REEL_MAX_SECONDS ? ` (${REEL_MAX_SECONDS} s au plus)` : ''}.
      </p>
      {problems.length > 0 && reel.scenes.length > 0 && (
        <Callout tone="warning"><ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Callout>
      )}

      {photoFor && (
        <PhotoPicker
          current={reel.scenes.find((s) => s.id === photoFor)?.photo_url ?? null}
          onClose={() => setPhotoFor(null)}
          onPick={(url) => { update(photoFor, { photo_url: url }); setPhotoFor(null); }}
        />
      )}
      {videoFor && (
        <StockPicker
          initial={reel.scenes.find((s) => s.id === videoFor)?.text || ''}
          onClose={() => setVideoFor(null)}
          onPick={(v) => { update(videoFor, { video_url: v.url, video_thumb: v.thumb, credit: v.credit }); setVideoFor(null); }}
        />
      )}
    </div>
  );
}

/** Aperçu du Reel : la vidéo générée si elle est à jour, sinon le montage lu en direct. */
export function ReelPreview({ reel, brand, videoUrl, upToDate }: { reel: ReelSpec; brand: VisualBrand; videoUrl: string | null; upToDate: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<{ stop: () => void } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([reel.scenes, reel.music?.url]);

  // Image fixe à 1 s dès que la composition change.
  useEffect(() => {
    if (upToDate && videoUrl) return;
    let alive = true;
    player.current?.stop();
    setState('idle');
    (async () => {
      if (!canvas.current || !reel.scenes.length) return;
      const { loadReelAssets, drawReelStill } = await import('../../../utils/reelRender');
      const assets = await loadReelAssets(reel, brand, await sessionToken());
      if (alive && canvas.current) await drawReelStill(canvas.current, reel, Math.min(1, reel.scenes[0].duration / 2), brand, assets);
    })().catch(() => {});
    return () => { alive = false; };
  }, [key, upToDate, videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => player.current?.stop(), []);

  const play = async () => {
    if (!canvas.current) return;
    setError(null);
    setState('loading');
    try {
      const { loadReelAssets, playReel, buildSoundtrack } = await import('../../../utils/reelRender');
      const token = await sessionToken();
      const [assets, sound] = await Promise.all([loadReelAssets(reel, brand, token), reel.music ? buildSoundtrack(reel, token) : Promise.resolve(null)]);
      setState('playing');
      player.current = playReel(canvas.current, reel, brand, assets, sound, () => setState('idle'));
    } catch (e: any) {
      setError(e?.message || 'Lecture impossible.');
      setState('idle');
    }
  };
  const stop = () => { player.current?.stop(); setState('idle'); };

  if (upToDate && videoUrl) {
    return (
      <video src={videoUrl} controls playsInline className="block aspect-[9/16] w-full bg-black" aria-label="Vidéo du Reel" />
    );
  }
  return (
    <div className="relative aspect-[9/16] w-full bg-stone-900">
      <canvas ref={canvas} width={1080} height={1920} className="absolute inset-0 h-full w-full" aria-label="Aperçu du Reel" />
      {!reel.scenes.length && <p className="absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-white/80">Ajoutez des scènes, ou faites rédiger le Reel.</p>}
      {reel.scenes.length > 0 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <Button size="sm" variant="secondary" icon={state === 'loading' ? Loader2 : state === 'playing' ? Square : Play} onClick={state === 'playing' ? stop : play} disabled={state === 'loading'}>
            {state === 'playing' ? 'Arrêter' : 'Lire l’aperçu'}
          </Button>
        </div>
      )}
      {error && <p className="absolute inset-x-3 top-3 rounded bg-white/90 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
    </div>
  );
}

function StockPicker({ initial, onPick, onClose }: { initial: string; onPick: (v: StockVideo) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial ? '' : 'spa');
  const [results, setResults] = useState<StockVideo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await searchStock(q.trim()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Choisir une vidéo" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl bg-white sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={search} className="flex items-center gap-3 border-b border-stone-200 px-4 py-3">
          <Search size={16} className="text-stone-500" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="En anglais : facial massage, spa candles, ocean waves…" className="flex-1" />
          <Button type="submit" size="sm" loading={busy}>Chercher</Button>
          <Button type="button" size="sm" variant="ghost" icon={X} onClick={onClose} aria-label="Fermer" />
        </form>
        <div className="overflow-y-auto p-4">
          <p className="mb-3 text-[12.5px] text-stone-600">Vidéos verticales de Pexels, libres de droits (usage commercial permis). Évitez les visages présentés comme des clientes.</p>
          {error && <Callout tone="danger">{error}</Callout>}
          {results && results.length === 0 && <p className="py-8 text-center text-[14px] text-stone-600">Aucune vidéo verticale pour cette recherche.</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(results ?? []).map((v) => (
              <button key={v.id} type="button" onClick={() => onPick(v)} className="group relative aspect-[9/16] overflow-hidden bg-stone-100 cursor-pointer" title={`${v.credit} — ${v.duration} s`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[11px] text-white">{v.duration} s</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

