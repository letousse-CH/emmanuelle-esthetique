"use client";

import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Music, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Button, Callout, Card, CardBody, CardFooter, CardHeader, Field, Input, Select } from '../../../components/admin/ui';
import { MOOD_LABEL, MUSIC_MOODS, type MusicMood } from '../../../types/social';
import { api } from './api';
import { loadMusic, type MusicTrack } from './postActions';

/** Réglages des Reels : banque de vidéos Pexels et bibliothèque de musiques. */
export default function ReelSettings() {
  return (
    <>
      <PexelsCard />
      <MusicCard />
    </>
  );
}

function PexelsCard() {
  const [status, setStatus] = useState<{ configured: boolean; hint: string | null } | null>(null);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const load = () =>
    api<{ secrets: Record<string, { configured: boolean; hint: string | null }> }>('/api/admin/secrets')
      .then((r) => setStatus(r.secrets.pexels_api_key ?? { configured: false, hint: null }))
      .catch(() => setStatus({ configured: false, hint: null }));
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api('/api/admin/secrets', { key: 'pexels_api_key', value: key });
      const test = await api<{ videos: unknown[] }>('/api/admin/social/stock?q=spa');
      setMessage({ tone: 'success', text: `Clé enregistrée : Pexels répond (${test.videos.length} vidéos pour « spa »).` });
      setKey('');
      load();
    } catch (err: any) {
      setMessage({ tone: 'danger', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Banque de vidéos (Pexels)"
        description="Des extraits vidéo libres de droits, usage commercial permis, pour les Reels. Gratuit : créez un compte sur pexels.com, puis demandez une clé API."
      />
      <form onSubmit={save} autoComplete="off">
        <CardBody className="space-y-3">
          {status?.configured && (
            <p className="flex items-center gap-2 text-[14px] text-stone-700"><Check size={15} className="text-emerald-700" /> Clé enregistrée ({status.hint}).</p>
          )}
          <Field label={status?.configured ? 'Remplacer la clé' : 'Clé API Pexels'} htmlFor="pexels-key">
            <Input id="pexels-key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" placeholder="563492ad6f9170000100000…" />
          </Field>
          <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
            Obtenir une clé sur pexels.com <ExternalLink size={12} />
          </a>
          {message && <Callout tone={message.tone}>{message.text}</Callout>}
        </CardBody>
        <CardFooter>
          <Button type="submit" variant="primary" loading={saving} disabled={!key.trim()}>Enregistrer et tester</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const MAX_MP3 = 4 * 1024 * 1024;

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null); URL.revokeObjectURL(a.src); };
    a.onerror = () => resolve(null);
    a.src = URL.createObjectURL(file);
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Fichier illisible.'));
    r.readAsDataURL(file);
  });
}

function MusicCard() {
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState<MusicMood>('douce');
  const [credit, setCredit] = useState('Pixabay — licence de contenu Pixabay');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const load = () => loadMusic().then(setTracks);
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    if (file.size > MAX_MP3) return setError('Fichier trop lourd : 4 Mo au plus (un MP3 de 2 à 3 minutes).');
    if (!/audio\/(mpeg|mp3|mp4|aac|x-m4a)/.test(file.type) && !/\.(mp3|m4a)$/i.test(file.name)) return setError('Choisissez un fichier MP3 ou M4A.');
    setBusy(true);
    try {
      const [duration, fileBase64] = await Promise.all([readDuration(file), toBase64(file)]);
      const { url } = await api<{ url: string }>('/api/upload-media', {
        fileName: `musique-${file.name}`,
        contentType: file.type || 'audio/mpeg',
        fileBase64,
      });
      const { error: dbError } = await supabase.from('social_music').insert({
        title: title.trim() || file.name.replace(/\.[a-z0-9]+$/i, ''),
        mood,
        url,
        duration_s: duration,
        credit: credit.trim() || null,
      });
      if (dbError) throw new Error(dbError.message);
      setFile(null);
      setTitle('');
      setFileKey((k) => k + 1); // vide le champ fichier
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: MusicTrack) => {
    if (!window.confirm(`Retirer « ${t.title} » de la bibliothèque ? Les Reels déjà générés gardent leur musique.`)) return;
    await supabase.from('social_music').delete().eq('id', t.id);
    load();
  };

  return (
    <Card>
      <CardHeader
        title="Musiques des Reels"
        description="L’API d’Instagram ne donne pas accès à sa bibliothèque musicale : la musique est intégrée à la vidéo. Gardez ici quelques morceaux libres de droits, classés par ambiance ; l’IA choisit selon le sujet."
      />
      <CardBody className="space-y-4">
        <Callout tone="info">
          Sur <a className="font-semibold underline" href="https://pixabay.com/music/" target="_blank" rel="noreferrer">pixabay.com/music</a>, la licence permet l’usage commercial sans mention. Préférez des morceaux calmes et instrumentaux. Meta peut tout de même couper le son si un ayant droit revendique un morceau : écoutez le Reel une fois publié.
        </Callout>
        {tracks && tracks.length > 0 && (
          <div className="data-frame divide-y divide-stone-100">
            {tracks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 bg-white px-3 py-2.5">
                <Music size={16} className="shrink-0 text-stone-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-stone-900">{t.title}</span>
                  <span className="block truncate text-[12.5px] text-stone-600">
                    {MOOD_LABEL[t.mood] || t.mood}{t.duration_s ? ` · ${Math.floor(t.duration_s / 60)} min ${String(t.duration_s % 60).padStart(2, '0')}` : ''}{t.credit ? ` · ${t.credit}` : ''}
                  </span>
                </span>
                <audio src={t.url} controls preload="none" className="h-8 w-48" />
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(t)} aria-label="Retirer" />
              </div>
            ))}
          </div>
        )}
        {tracks && tracks.length === 0 && <p className="text-[14px] text-stone-600">Aucune musique pour l’instant.</p>}

        <form onSubmit={add} className="space-y-3 rounded-lg bg-white p-4">
          <Field label="Fichier (MP3, 4 Mo au plus)" htmlFor="music-file">
            <input key={fileKey} id="music-file" type="file" accept="audio/mpeg,audio/mp3,.mp3,.m4a,audio/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-[14px]" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Titre" htmlFor="music-title">
              <Input id="music-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Calme marin" />
            </Field>
            <Field label="Ambiance" htmlFor="music-mood">
              <Select id="music-mood" value={mood} onChange={(e) => setMood(e.target.value as MusicMood)}>
                {MUSIC_MOODS.map((m) => <option key={m} value={m}>{MOOD_LABEL[m]}</option>)}
              </Select>
            </Field>
            <Field label="Source et licence" htmlFor="music-credit">
              <Input id="music-credit" value={credit} onChange={(e) => setCredit(e.target.value)} />
            </Field>
          </div>
          {error && <Callout tone="danger">{error}</Callout>}
          <div className="flex justify-end">
            <Button type="submit" icon={Upload} loading={busy} disabled={!file}>Ajouter la musique</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
