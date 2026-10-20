"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Archive, CalendarClock, Check, Clapperboard, Copy, ExternalLink, Facebook, ImageIcon, Instagram, Loader2,
  RefreshCw, Send, Smartphone, Sparkles, Trash2, X,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { SITE_CONFIG } from '../../../config/site';
import { CARTE } from '../../../constants/carteSoins';
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from '../../../components/admin/ui';
import {
  captionFor, DEFAULT_VISUAL, IG_CAPTION_MAX, isEditable, KIND_LABEL, NETWORK_LABEL, normalizePost, parseHashtags,
  PILLAR_LABEL, POST_STATUS_LABEL, publishProblems, reelProblems, SOCIAL_NETWORKS,
  type ReelSpec, type SocialKind, type SocialNetwork, type SocialPost, type SocialPublication, type SocialSourceType, type SocialVisual,
} from '../../../types/social';
import { FORMATS, LAYOUTS, visualHash, type VisualBrand } from '../../../utils/socialVisual';
import { api, ApiError, connectedNetworks, type MetaStatus } from './api';
import VisualCanvas from './VisualCanvas';
import PhotoPicker from './PhotoPicker';
import ReelComposer, { ReelPreview } from './ReelComposer';
import { statusTone } from './PostList';
import {
  composeReel, pickPhoto, produceReel, reelHash, requestWriting, savePostRow, sourceOf, uploadVisual,
  type EditorSource,
} from './postActions';

export type { EditorSource };

interface Props {
  post: SocialPost | null;
  /** Copie d'une publication existante (bouton « Réutiliser »). */
  draftFrom?: SocialPost | null;
  initialSource?: EditorSource | null;
  autoWrite?: boolean;
  /** Jour choisi dans l'agenda (« AAAA-MM-JJ ») : la programmation s'ouvre sur ce jour, à 18 h. */
  initialDay?: string | null;
  brand: VisualBrand;
  meta: MetaStatus | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenAccounts: () => void;
}

interface Form {
  kind: SocialKind;
  reel: ReelSpec;
  title: string;
  caption: string;
  hashtags: string;
  link_path: string | null;
  visual: SocialVisual;
  networks: SocialNetwork[];
}

const LINK_CHOICES: { value: string; label: string }[] = [
  { value: '/reservation', label: 'Réservation en ligne' },
  { value: '/soins', label: 'La carte des soins' },
  { value: '/bon-cadeau', label: 'Bon cadeau' },
];

const EMPTY_REEL: ReelSpec = { scenes: [], music: null };

function formFrom(post: SocialPost | null | undefined, networks: SocialNetwork[]): Form {
  return {
    kind: post?.kind || 'post',
    reel: post?.reel ? { ...post.reel, scenes: [...post.reel.scenes] } : { ...EMPTY_REEL },
    title: post?.title || '',
    caption: post?.caption || '',
    hashtags: post?.hashtags || '',
    link_path: post ? post.link_path : '/reservation',
    visual: post ? { ...post.visual } : { ...DEFAULT_VISUAL },
    networks: post?.networks?.length ? [...post.networks] : networks,
  };
}

const sameForm = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultSchedule(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toLocalInput(d);
}

export const formatWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';

/** Le lien n'est ajouté qu'en ligne : en local, l'adresse serait « localhost ». */
const previewSiteUrl = /localhost|127\.0\.0\.1/.test(SITE_CONFIG.url) ? null : SITE_CONFIG.url;

export default function PostEditor({ post: initialPost, draftFrom, initialSource, autoWrite, initialDay, brand, meta, onClose, onChanged, onOpenAccounts }: Props) {
  const connected = connectedNetworks(meta);
  const defaultNetworks = SOCIAL_NETWORKS.filter((n) => connected[n]);

  const [post, setPost] = useState<SocialPost | null>(initialPost);
  const [form, setForm] = useState<Form>(() => {
    const f = formFrom(initialPost ?? draftFrom, defaultNetworks.length ? defaultNetworks : [...SOCIAL_NETWORKS]);
    return draftFrom ? { ...f, visual: { ...f.visual, hash: undefined } } : f;
  });
  const saved = useRef<Form>(initialPost ? form : formFrom(null, form.networks));
  const [sourceType, setSourceType] = useState<SocialSourceType>(initialPost?.source_type || draftFrom?.source_type || initialSource?.kind || 'idee');
  const [sourceRef, setSourceRef] = useState(initialPost?.source_ref || draftFrom?.source_ref || '');
  // Un brouillon du plan arrive avec son sujet et son angle : il ne reste qu'à « Rédiger ».
  const planned = Boolean(initialPost?.planned_at && !initialPost.caption);
  const [source, setSource] = useState<EditorSource>(initialSource || (planned ? sourceOf(initialPost!) : { kind: 'idee', text: '' }));
  const [instruction, setInstruction] = useState(planned ? initialPost!.plan_note || '' : '');
  const [progress, setProgress] = useState<{ label: string; p: number } | null>(null);
  const [pubs, setPubs] = useState<SocialPublication[]>([]);
  const [busy, setBusy] = useState<null | 'write' | 'save' | 'schedule' | 'publish' | 'unschedule' | 'archive' | 'delete' | SocialNetwork>(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(initialDay));
  const [scheduleAt, setScheduleAt] = useState(() =>
    initialPost?.scheduled_at ? toLocalInput(new Date(initialPost.scheduled_at))
    : initialPost?.planned_at ? toLocalInput(new Date(initialPost.planned_at))
    : initialDay ? `${initialDay}T18:00`
    : defaultSchedule());
  const [previewNetwork, setPreviewNetwork] = useState<SocialNetwork>('instagram');
  const [articles, setArticles] = useState<{ id: string; title: string }[]>([]);
  const [offers, setOffers] = useState<{ id: string; titre: string }[]>([]);

  const status = post?.status ?? 'draft';
  const editable = isEditable(status);
  const dirty = !sameForm(form, saved.current) || !post;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // ── Listes des sources ──
  useEffect(() => {
    supabase.from('articles').select('id, title').eq('published', true).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setArticles((data ?? []) as any));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
    supabase.from('monthly_offers').select('id, titre').eq('active', true).is('archived_at', null).gte('date_fin', today).order('date_debut')
      .then(({ data }) => setOffers((data ?? []) as any));
  }, []);

  // ── Suivi d'un envoi en cours ──
  const loadPubs = useCallback(async (id: string) => {
    const { data } = await supabase.from('social_publications').select('*').eq('post_id', id).order('network');
    if (mounted.current) setPubs((data ?? []) as SocialPublication[]);
  }, []);
  useEffect(() => { if (initialPost) loadPubs(initialPost.id); }, [initialPost, loadPubs]);

  const applySnapshot = (snap: { post: any; publications: SocialPublication[] }) => {
    const p = normalizePost(snap.post);
    setPost(p);
    setPubs(snap.publications);
    return p;
  };

  const follow = useCallback(async (id: string, long = false) => {
    // Une vidéo met plusieurs minutes à être traitée par Instagram.
    for (let i = 0; i < (long ? 80 : 40) && mounted.current; i++) {
      await new Promise((r) => setTimeout(r, long ? 3000 : 2500));
      try {
        const snap = await api('/api/admin/social/publish', { postId: id, action: 'advance' });
        const p = applySnapshot(snap);
        if (p.status !== 'publishing') {
          onChanged();
          return;
        }
      } catch {
        // Réseau capricieux : la tâche planifiée terminera l'envoi.
      }
    }
  }, [onChanged]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialPost?.status === 'publishing') follow(initialPost.id, initialPost.kind === 'reel');
  }, [initialPost, follow]);

  // ── Rédaction ──
  const write = useCallback(async (src: EditorSource) => {
    setBusy('write');
    setError(null);
    try {
      const r = await requestWriting(src, instruction, form.kind, post?.planned_at || post?.scheduled_at);
      const photo = await pickPhoto(src, r);
      const reel = form.kind === 'reel' && r.scenes?.length ? await composeReel(r.scenes, r.mood, photo) : null;
      setSourceType(r.source.kind);
      setSourceRef(r.source.ref);
      setForm((f) => ({
        ...f,
        title: r.source.title || r.headline,
        caption: r.caption,
        hashtags: r.hashtags,
        link_path: r.source.linkPath || '/reservation',
        visual: {
          ...f.visual,
          eyebrow: r.eyebrow,
          headline: r.headline,
          // Une photo déjà choisie à la main reste en place.
          photo_url: f.visual.photo_url ?? photo,
        },
        reel: reel ?? f.reel,
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }, [instruction, form.kind]);

  const autoWritten = useRef(false);
  useEffect(() => {
    if (autoWrite && initialSource && !autoWritten.current) {
      autoWritten.current = true;
      write(initialSource);
    }
  }, [autoWrite, initialSource, write]);

  // ── Enregistrement ──
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVisual = (patch: Partial<SocialVisual>) => setForm((f) => ({ ...f, visual: { ...f.visual, ...patch } }));

  const currentReelHash = form.kind === 'reel' ? reelHash(form.reel, brand) : '';
  const reelUpToDate = form.kind === 'reel' && Boolean(post?.video_url && post.reel?.hash === currentReelHash);

  /**
   * Enregistre ; dessine et dépose d'abord le visuel (ou monte le Reel) s'il a
   * changé depuis le dernier dépôt.
   */
  const persist = async (): Promise<SocialPost> => {
    let imageUrl = post?.image_url ?? null;
    let videoUrl = post?.video_url ?? null;
    let visual: SocialVisual = form.visual;
    let reel: ReelSpec | null = null;
    if (form.kind === 'reel') {
      reel = { ...form.reel, hash: currentReelHash };
      if (!reelUpToDate) {
        const out = await produceReel(form.reel, brand, (label, p) => mounted.current && setProgress({ label, p }));
        imageUrl = out.coverUrl;
        videoUrl = out.videoUrl;
      }
      setProgress(null);
    } else {
      const hash = visualHash(form.visual, brand);
      visual = { ...form.visual, hash };
      if (!imageUrl || post?.visual.hash !== hash || post?.kind !== form.kind) imageUrl = await uploadVisual(form.visual, brand);
      videoUrl = null;
    }
    const p = await savePostRow(post, {
      kind: form.kind,
      title: (form.title || form.visual.headline || form.reel.scenes[0]?.text || KIND_LABEL[form.kind]).slice(0, 200),
      caption: form.caption.trim(),
      hashtags: form.hashtags.trim(),
      link_path: form.link_path,
      visual,
      image_url: imageUrl,
      cover_image: form.visual.photo_url,
      networks: form.networks,
      reel,
      video_url: videoUrl,
    }, { type: sourceType, ref: sourceRef });
    setPost(p);
    saved.current = { ...form, visual, reel: reel ? { ...reel } : form.reel };
    setForm(saved.current);
    onChanged();
    return p;
  };

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setProblems([]);
    setFlash(null);
    try {
      await fn();
    } catch (e: any) {
      if (e instanceof ApiError && e.problems.length) setProblems(e.problems);
      else setError(e?.message || 'Action impossible.');
    } finally {
      if (mounted.current) {
        setBusy(null);
        setProgress(null);
      }
    }
  };

  const localProblems = useMemo(
    () => [
      ...(form.kind === 'reel' ? reelProblems(form.reel) : []),
      ...publishProblems(
        { ...form, image_url: 'https://x/visuel.jpg', video_url: 'https://x/video.mp4' },
        connected,
        previewSiteUrl || undefined,
      ),
    ],
    [form, connected],
  );
  const hasContent = form.kind === 'reel' ? form.reel.scenes.length > 0 : Boolean(form.visual.headline.trim());
  const canSend = editable && localProblems.length === 0 && hasContent;

  const save = () => run('save', async () => { await persist(); setFlash('Brouillon enregistré.'); });

  const schedule = () => run('schedule', async () => {
    const p = await persist();
    const snap = await api('/api/admin/social/publish', { postId: p.id, action: 'schedule', scheduledAt: new Date(scheduleAt).toISOString() });
    applySnapshot(snap);
    setScheduleOpen(false);
    setFlash(`Programmée pour ${formatWhen(snap.post.scheduled_at)}.`);
    onChanged();
  });

  const unschedule = () => run('unschedule', async () => {
    if (!post) return;
    applySnapshot(await api('/api/admin/social/publish', { postId: post.id, action: 'unschedule' }));
    setFlash('Programmation annulée : la publication est revenue en brouillon.');
    onChanged();
  });

  const publishNow = () => {
    const where = form.networks.map((n) => NETWORK_LABEL[n]).join(' et ');
    if (!window.confirm(`Publier maintenant sur ${where} ? La publication sera visible tout de suite.`)) return;
    return run('publish', async () => {
      const p = await persist();
      const snap = await api('/api/admin/social/publish', { postId: p.id, action: 'now' });
      const next = applySnapshot(snap);
      onChanged();
      if (next.status === 'publishing') follow(next.id, next.kind === 'reel');
    });
  };

  const retry = (network: SocialNetwork) => run(network, async () => {
    if (!post) return;
    const next = applySnapshot(await api('/api/admin/social/publish', { postId: post.id, action: 'retry', network }));
    onChanged();
    if (next.status === 'publishing') follow(next.id, next.kind === 'reel');
  });

  const archive = () => run('archive', async () => {
    if (!post) return;
    const { data, error: e } = await supabase.from('social_posts').update({ status: 'archived' }).eq('id', post.id).select('*').single();
    if (e) throw new Error(e.message);
    setPost(normalizePost(data));
    onChanged();
    onClose();
  });

  const remove = () => {
    if (!post) return onClose();
    if (!window.confirm('Supprimer ce brouillon ?')) return;
    return run('delete', async () => {
      const { error: e } = await supabase.from('social_posts').delete().eq('id', post.id);
      if (e) throw new Error(e.message);
      onChanged();
      onClose();
    });
  };

  const back = () => {
    if (editable && dirty && (form.caption || form.visual.headline || form.reel.scenes.length) && !window.confirm('Quitter sans enregistrer les modifications ?')) return;
    onClose();
  };

  /** Changer de sorte : le format du visuel suit (story et Reel en 9:16). */
  const setKind = (kind: SocialKind) =>
    setForm((f) => ({
      ...f,
      kind,
      visual: { ...f.visual, format: kind === 'post' ? (f.visual.format === 'square' ? 'square' : 'portrait') : 'story', hash: undefined },
    }));

  const toggleNetwork = (n: SocialNetwork) =>
    set('networks', form.networks.includes(n) ? form.networks.filter((x) => x !== n) : SOCIAL_NETWORKS.filter((x) => x === n || form.networks.includes(x)));

  const caption = captionFor(previewNetwork, { ...form, link_path: previewSiteUrl ? form.link_path : null }, previewSiteUrl || '');
  const igLength = [...captionFor('instagram', form, '')].length;
  const tagCount = parseHashtags(form.hashtags).length;
  const sourceLinkChoices = useMemo(() => {
    const choices = [...LINK_CHOICES];
    if (form.link_path && !choices.some((c) => c.value === form.link_path)) choices.unshift({ value: form.link_path, label: `Page du sujet (${form.link_path})` });
    return choices;
  }, [form.link_path]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-stone-700 hover:text-stone-950 cursor-pointer">
          <ArrowLeft size={15} /> Retour aux publications
        </button>
        {post && <Badge tone={statusTone(status)}>{POST_STATUS_LABEL[status]}{status === 'scheduled' && post.scheduled_at ? ` · ${formatWhen(post.scheduled_at)}` : ''}</Badge>}
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {problems.length > 0 && (
        <Callout tone="warning" title="Avant de publier">
          <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Callout>
      )}
      {flash && <Callout tone="success">{flash}</Callout>}
      {post?.last_error && (status === 'failed' || status === 'partial' || status === 'draft') && !problems.length && (
        <Callout tone={status === 'draft' ? 'info' : 'danger'}>{post.last_error}</Callout>
      )}

      {post?.planned_at && status === 'draft' && (
        <Callout tone="info" title={`Au plan : ${formatWhen(post.planned_at)}`}>
          {post.pillar ? `${PILLAR_LABEL[post.pillar]} — ` : ''}{post.plan_note || post.title}
          {!post.caption && ' Cliquez « Rédiger avec l’IA », relisez, puis « Programmer » (l’heure du plan est déjà proposée).'}
        </Callout>
      )}
      {progress && (
        <div className="rounded-lg bg-stone-50 px-4 py-3" role="status">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-stone-900"><Loader2 size={15} className="animate-spin" /> {progress.label}…</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
        </div>
      )}

      <PublicationProgress pubs={pubs} status={status} busy={busy} onRetry={retry} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="space-y-6">
          {editable && (
            <Card>
              <CardHeader title="1. De quoi parle-t-on ?" description="L’IA rédige à partir de la carte des soins et du ton de l’institut. Vous relisez et corrigez ensuite." />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sorte de publication">
                  {([['post', 'Publication', 'Dans le fil, 4:5 ou carré', ImageIcon], ['story', 'Story', '24 h, plein écran 9:16', Smartphone], ['reel', 'Reel', 'Vidéo 9:16 avec musique', Clapperboard]] as const).map(([k, label, hint, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={form.kind === k}
                      disabled={Boolean(post && post.status !== 'draft')}
                      onClick={() => setKind(k)}
                      className={`rounded-lg px-3 py-2.5 text-left cursor-pointer disabled:cursor-default ${form.kind === k ? 'bg-accent text-accent-fg' : 'bg-white text-stone-800 hover:bg-stone-100'}`}
                    >
                      <span className="flex items-center gap-1.5 text-[14px] font-semibold"><Icon size={15} /> {label}</span>
                      <span className={`block text-[12px] leading-snug ${form.kind === k ? 'opacity-85' : 'text-stone-600'}`}>{hint}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sujet">
                  {([['idee', 'Une idée'], ['soin', 'Un soin'], ['article', 'Un article'], ['offre', 'L’offre du moment']] as const).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={source.kind === kind}
                      onClick={() => setSource(kind === 'idee' ? { kind, text: '' } : { kind, id: '' } as EditorSource)}
                      className={`h-10 rounded-lg px-4 text-[14px] font-semibold cursor-pointer transition-colors ${source.kind === kind ? 'bg-accent text-accent-fg' : 'bg-white text-stone-800 hover:bg-stone-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {source.kind === 'idee' && (
                  <Textarea rows={3} value={source.text} onChange={(e) => setSource({ kind: 'idee', text: e.target.value })} placeholder="Ex. : la peau qui tiraille quand le chauffage se rallume, et le soin qui la réconforte." />
                )}
                {source.kind === 'soin' && (
                  <Select value={source.id} onChange={(e) => setSource({ kind: 'soin', id: e.target.value })}>
                    <option value="">Choisir un soin de la carte…</option>
                    {CARTE.map((c) => (
                      <optgroup key={c.id} label={c.label}>
                        {c.groups.flatMap((g) => g.items).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                )}
                {source.kind === 'article' && (
                  <Select value={source.id} onChange={(e) => setSource({ kind: 'article', id: e.target.value })}>
                    <option value="">{articles.length ? 'Choisir un article publié…' : 'Aucun article publié'}</option>
                    {articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </Select>
                )}
                {source.kind === 'offre' && (
                  <Select value={source.id} onChange={(e) => setSource({ kind: 'offre', id: e.target.value })}>
                    <option value="">{offers.length ? 'Choisir une offre…' : 'Aucune offre en cours ou à venir'}</option>
                    {offers.map((o) => <option key={o.id} value={o.id}>{o.titre}</option>)}
                  </Select>
                )}
                <Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Consigne facultative : plus court, pour Noël, insister sur la détente…" />
                <div className="flex justify-end">
                  <Button
                    variant={form.caption ? 'secondary' : 'primary'}
                    icon={Sparkles}
                    loading={busy === 'write'}
                    disabled={source.kind === 'idee' ? source.text.trim().length < 3 : !source.id}
                    onClick={() => write(source)}
                  >
                    {form.caption ? 'Proposer un autre texte' : form.kind === 'reel' ? 'Rédiger le Reel avec l’IA' : 'Rédiger avec l’IA'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {form.kind === 'reel' ? (
            <Card>
              <CardHeader title={editable ? '2. Le Reel' : 'Le Reel'} description="Une suite de scènes (photos, diapos de texte, extraits vidéo), aux couleurs du site, puis le carton final avec le logo. La vidéo est montée dans le navigateur au moment d’enregistrer." />
              <CardBody>
                <ReelComposer reel={form.reel} onChange={(reel) => set('reel', reel)} brand={brand} editable={editable} onOpenSettings={onOpenAccounts} />
              </CardBody>
            </Card>
          ) : (
          <Card>
            <CardHeader title={editable ? '2. Le visuel' : 'Le visuel'} description="Aux couleurs et aux polices du site. Ce que vous voyez à droite est exactement l’image publiée." />
            <CardBody className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="size-20 shrink-0 overflow-hidden bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {form.visual.photo_url ? <img src={form.visual.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-stone-500"><ImageIcon size={20} /></span>}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-stone-900">{form.visual.photo_url ? 'Photo de la médiathèque' : 'Sans photo'}</p>
                  {editable && <Button size="sm" className="mt-1.5" onClick={() => setPicker(true)}>Changer de photo</Button>}
                </div>
              </div>

              <Field label="Mise en page">
                <div className="grid grid-cols-3 gap-2">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!editable}
                      onClick={() => setVisual({ layout: l.id })}
                      title={l.hint}
                      className={`rounded-lg px-3 py-2.5 text-left cursor-pointer disabled:cursor-default ${form.visual.layout === l.id ? 'bg-accent text-accent-fg' : 'bg-white text-stone-800 hover:bg-stone-100'}`}
                    >
                      <span className="block text-[14px] font-semibold">{l.label}</span>
                      <span className={`block text-[12px] leading-snug ${form.visual.layout === l.id ? 'opacity-85' : 'text-stone-600'}`}>{l.hint}</span>
                    </button>
                  ))}
                </div>
              </Field>

              {form.kind === 'post' && <Field label="Format">
                <div className="flex gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!editable}
                      onClick={() => setVisual({ format: f.id })}
                      className={`h-10 rounded-lg px-4 text-[14px] font-semibold cursor-pointer disabled:cursor-default ${form.visual.format === f.id ? 'bg-accent text-accent-fg' : 'bg-white text-stone-800 hover:bg-stone-100'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </Field>}

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Field label="Surtitre" htmlFor="sv-eyebrow" hint="Quelques mots, en capitales sur le visuel.">
                  <Input id="sv-eyebrow" value={form.visual.eyebrow} maxLength={40} disabled={!editable} onChange={(e) => setVisual({ eyebrow: e.target.value })} placeholder="Soins du visage" />
                </Field>
                <Field label="Phrase du visuel" htmlFor="sv-headline" hint="Courte : 4 à 10 mots se lisent d’un coup d’œil.">
                  <Textarea id="sv-headline" rows={2} value={form.visual.headline} maxLength={110} disabled={!editable} onChange={(e) => setVisual({ headline: e.target.value })} />
                </Field>
              </div>
            </CardBody>
          </Card>
          )}

          {form.kind === 'story' ? (
            <p className="rounded-lg bg-stone-50 px-4 py-3 text-[13.5px] text-stone-700">
              Une story n’a pas de légende : tout passe par le visuel. Elle reste visible 24 heures.
            </p>
          ) : (
          <Card>
            <CardHeader title={editable ? '3. La légende' : 'La légende'} description="Le même texte part sur Instagram et Facebook. Facebook reçoit en plus le lien vers le site." />
            <CardBody className="space-y-4">
              <Field hint={<span className={igLength > IG_CAPTION_MAX ? 'font-semibold text-red-700' : ''}>{igLength} / {IG_CAPTION_MAX} caractères sur Instagram (hashtags compris). La première ligne est celle qu’on voit avant « plus ».</span>}>
                <Textarea rows={11} value={form.caption} disabled={!editable} onChange={(e) => set('caption', e.target.value)} placeholder="Écrivez ou faites rédiger la légende…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hashtags" htmlFor="sv-tags" hint={`${tagCount} hashtag${tagCount > 1 ? 's' : ''} · Facebook n’en garde que trois.`}>
                  <Input id="sv-tags" value={form.hashtags} disabled={!editable} onChange={(e) => set('hashtags', e.target.value)} placeholder="#Palezieux #SoinVisage" />
                </Field>
                <Field label="Lien sous le message Facebook" htmlFor="sv-link">
                  <Select id="sv-link" value={form.link_path || ''} disabled={!editable} onChange={(e) => set('link_path', e.target.value || null)}>
                    {sourceLinkChoices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    <option value="">Aucun lien</option>
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>
          )}

          <Card>
            <CardHeader title={editable ? '4. Où publier' : 'Réseaux'} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_NETWORKS.map((n) => {
                  const Icon = n === 'instagram' ? Instagram : Facebook;
                  const on = form.networks.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={!editable}
                      onClick={() => toggleNetwork(n)}
                      className={`inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold cursor-pointer disabled:cursor-default ${on ? 'bg-accent text-accent-fg' : 'bg-white text-stone-800 hover:bg-stone-100'}`}
                    >
                      <Icon size={16} /> {NETWORK_LABEL[n]} {on && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
              {editable && (!connected.instagram || !connected.facebook) && (
                <p className="text-[13px] text-stone-600">
                  {!connected.facebook ? 'Facebook et Instagram ne sont pas encore reliés.' : 'Instagram n’est pas relié à la Page.'}{' '}
                  <button type="button" onClick={onOpenAccounts} className="font-semibold text-accent underline cursor-pointer">Relier les comptes</button>{' '}
                  — vous pouvez quand même préparer et enregistrer.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Aperçu ── */}
        <div className="space-y-3 lg:sticky lg:top-6">
          <div className="flex gap-1 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Aperçu">
            {SOCIAL_NETWORKS.map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={previewNetwork === n}
                onClick={() => setPreviewNetwork(n)}
                className={`h-9 flex-1 rounded-md text-[13px] font-semibold cursor-pointer ${previewNetwork === n ? 'bg-white text-stone-950' : 'text-stone-600 hover:text-stone-900'}`}
              >
                Aperçu {NETWORK_LABEL[n]}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg bg-white" style={{ boxShadow: '0 0 0 1px #e7e5e4' }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[#eef7f8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/algue.svg" alt="" className="size-5" />
              </span>
              <span className="text-[13px] font-semibold text-stone-900">
                {previewNetwork === 'instagram' ? meta?.instagram?.username || 'votre compte' : meta?.page?.name || 'Votre Page'}
              </span>
            </div>
            {form.kind === 'reel'
              ? <ReelPreview reel={form.reel} brand={brand} videoUrl={post?.video_url ?? null} upToDate={reelUpToDate} />
              : <VisualCanvas visual={form.visual} brand={brand} />}
            {form.kind !== 'story' && <CaptionPreview text={caption} name={previewNetwork === 'instagram' ? meta?.instagram?.username || '' : ''} />}
          </div>
          {previewNetwork === 'facebook' && !previewSiteUrl && form.link_path && (
            <p className="text-[12.5px] text-stone-600">Le lien vers le site s’ajoute une fois le site en ligne (pas depuis l’ordinateur de développement).</p>
          )}
        </div>
      </div>

      {picker && (
        <PhotoPicker current={form.visual.photo_url} onClose={() => setPicker(false)} onPick={(url) => { setVisual({ photo_url: url }); setPicker(false); }} />
      )}

      {/* ── Actions ── */}
      <div className="sticky bottom-0 z-30 -mx-4 bg-white/95 backdrop-blur sm:-mx-6" style={{ boxShadow: '0 -1px 0 #e7e5e4' }}>
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
          {editable ? (
            <>
              {(status === 'draft' || status === 'failed') && (
                <Button variant="ghost" icon={Trash2} onClick={remove} loading={busy === 'delete'} className="mr-auto">Supprimer</Button>
              )}
              {status === 'scheduled' && (
                <Button variant="ghost" icon={X} onClick={unschedule} loading={busy === 'unschedule'} className="mr-auto">Annuler la programmation</Button>
              )}
              <Button onClick={save} loading={busy === 'save'} disabled={!hasContent || Boolean(busy)}>
                {form.kind === 'reel' && !reelUpToDate ? 'Monter la vidéo et enregistrer' : dirty ? 'Enregistrer' : 'Enregistré'}
              </Button>
              {scheduleOpen ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Input type="datetime-local" value={scheduleAt} min={toLocalInput(new Date())} onChange={(e) => setScheduleAt(e.target.value)} className="w-auto" aria-label="Date et heure de publication" />
                  <Button icon={CalendarClock} onClick={schedule} loading={busy === 'schedule'} disabled={!canSend || Boolean(busy)}>Confirmer</Button>
                  <Button variant="ghost" icon={X} onClick={() => setScheduleOpen(false)} aria-label="Fermer" />
                </span>
              ) : (
                <Button icon={CalendarClock} onClick={() => setScheduleOpen(true)} disabled={!canSend || Boolean(busy)}>
                  {status === 'scheduled' ? 'Changer l’heure' : 'Programmer'}
                </Button>
              )}
              <Button variant="primary" icon={Send} onClick={publishNow} loading={busy === 'publish'} disabled={!canSend || Boolean(busy)}>
                Publier maintenant
              </Button>
            </>
          ) : (
            <>
              {status !== 'publishing' && status !== 'archived' && (
                <Button variant="ghost" icon={Archive} onClick={archive} loading={busy === 'archive'} className="mr-auto">Archiver</Button>
              )}
              {status === 'archived' && post && !pubs.some((p) => p.status === 'published') && (
                <Button variant="ghost" icon={RefreshCw} className="mr-auto" onClick={() => run('archive', async () => {
                  const { data, error: e } = await supabase.from('social_posts').update({ status: 'draft' }).eq('id', post.id).select('*').single();
                  if (e) throw new Error(e.message);
                  setPost(normalizePost(data));
                  onChanged();
                })}>Ressortir en brouillon</Button>
              )}
              {post && <ReuseButton post={post} />}
            </>
          )}
        </div>
        {editable && !canSend && localProblems.length > 0 && (form.caption || form.visual.headline) && (
          <p className="px-4 pb-2 text-right text-[12.5px] text-stone-600 sm:px-6">{localProblems[0]}</p>
        )}
      </div>
    </div>
  );
}

/** « Réutiliser » ouvre un nouveau brouillon copié de celui-ci (voir page.tsx). */
function ReuseButton({ post }: { post: SocialPost }) {
  return (
    <Button icon={Copy} onClick={() => window.dispatchEvent(new CustomEvent('social:reuse', { detail: post }))}>
      Réutiliser
    </Button>
  );
}

function CaptionPreview({ text, name }: { text: string; name: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [text]);
  const firstBreak = text.indexOf('\n');
  const cut = Math.min(firstBreak > 0 ? firstBreak : 125, 125);
  const short = text.length > cut + 1 && !open;
  return (
    <div className="px-3 py-3 text-[13.5px] leading-relaxed text-stone-900" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <p className="whitespace-pre-line break-words">
        {name && <strong className="mr-1">{name}</strong>}
        {short ? `${text.slice(0, cut).trimEnd()}… ` : text}
        {short && <button type="button" onClick={() => setOpen(true)} className="text-stone-500 cursor-pointer">plus</button>}
      </p>
      {!text && <p className="text-stone-500">La légende apparaîtra ici.</p>}
    </div>
  );
}

const PUB_LABEL: Record<SocialPublication['status'], string> = {
  pending: 'En attente',
  processing: 'En cours',
  published: 'Publié',
  failed: 'Échec',
};

function PublicationProgress({ pubs, status, busy, onRetry }: {
  pubs: SocialPublication[];
  status: SocialPost['status'];
  busy: string | null;
  onRetry: (n: SocialNetwork) => void;
}) {
  if (!pubs.length || status === 'draft' || status === 'scheduled') return null;
  return (
    <Card>
      <CardBody className="space-y-2">
        {pubs.map((p) => {
          const Icon = p.network === 'instagram' ? Instagram : Facebook;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-4 py-3">
              <Icon size={18} className="shrink-0 text-stone-700" />
              <span className="w-24 shrink-0 text-[14px] font-semibold text-stone-900">{NETWORK_LABEL[p.network]}</span>
              <span className="min-w-0 flex-1 text-[14px] text-stone-700">
                {p.status === 'processing' || p.status === 'pending' ? (
                  <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />
                    {p.network === 'instagram' && p.container_id ? 'Instagram prépare l’image…' : PUB_LABEL[p.status]}
                  </span>
                ) : p.status === 'published' ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><Check size={14} /> Publié{p.published_at ? ` · ${formatWhen(p.published_at)}` : ''}</span>
                ) : (
                  <span className="text-red-700">{p.error || 'Échec'}</span>
                )}
              </span>
              {p.status === 'published' && p.permalink && (
                <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
                  Voir <ExternalLink size={13} />
                </a>
              )}
              {p.status === 'failed' && (
                <Button size="sm" icon={RefreshCw} onClick={() => onRetry(p.network)} loading={busy === p.network}>Relancer</Button>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
