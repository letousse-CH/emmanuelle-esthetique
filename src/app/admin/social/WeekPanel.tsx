"use client";

/**
 * La semaine à préparer — le seul moment de travail de l'exploitante.
 *
 *  1. Le plan : les sujets proposés pour la semaine (le mercredi, la tâche
 *     planifiée les a posés). On corrige, on retire, puis « Valider le plan ».
 *  2. Dans la foulée, tout se prépare : textes (IA, côté serveur, en
 *     parallèle), puis visuels et Reels (dans ce navigateur, un par un).
 *  3. La relecture : « Valider » programme la publication à son heure ;
 *     « Modifier », « Refaire », « Écarter » sinon.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarCheck, Check, ChevronLeft, ChevronRight, Clapperboard, ImageIcon, Pencil, Plus,
  RefreshCw, Smartphone, Sparkles, Trash2, Undo2, Wand2,
} from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, Field, Input, Select, Textarea, Toggle } from '../../../components/admin/ui';
import {
  DEFAULT_RHYTHM, DEFAULT_WEEKLY_DAY, KIND_LABEL, nextWeekStart, parseRhythm, parseWeeklyDay, PILLAR_LABEL, PILLARS,
  shiftWeek, shouldPrepareNextWeek, WEEK_STATE_LABEL, weekLabel, weekRange, weekStart, weekState, WEEKDAY_LABEL, zurichDayKey,
  type PillarId, type Rhythm, type RhythmSlot, type SocialKind, type SocialPost,
} from '../../../types/social';
import type { VisualBrand } from '../../../utils/socialVisual';
import { api, connectedNetworks, type MetaStatus } from './api';
import { prepareDraft, requestWriting, sourceOf, type WriteResult } from './postActions';

interface Props {
  posts: SocialPost[];
  brand: VisualBrand;
  meta: MetaStatus | null;
  initialWeek?: string | null;
  onWeekChange?: (week: string) => void;
  onBack: () => void;
  onChanged: () => Promise<void> | void;
  onOpen: (post: SocialPost) => void;
}

const KIND_ICON: Record<SocialKind, React.ElementType> = { post: ImageIcon, story: Smartphone, reel: Clapperboard };
const TZ = 'Europe/Zurich';
const when = (iso: string) => new Date(iso).toLocaleString('fr-CH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const dateOf = (p: SocialPost) => p.scheduled_at || p.planned_at || p.published_at;

interface Progress { done: number; total: number; label: string; step: string }

export default function WeekPanel({ posts, brand, meta, initialWeek, onWeekChange, onBack, onChanged, onOpen }: Props) {
  const today = zurichDayKey(new Date());
  const [weeklyDay, setWeeklyDay] = useState(DEFAULT_WEEKLY_DAY);
  const [autopilot, setAutopilot] = useState(true);
  const [rhythm, setRhythm] = useState<Rhythm>(DEFAULT_RHYTHM);
  const [week, setWeek] = useState(() => initialWeek ? weekStart(initialWeek) : null as string | null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('settings').select('key, value').in('key', ['social_rhythm', 'social_weekly_day', 'social_autopilot']).then(({ data }) => {
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      const day = parseWeeklyDay(map.social_weekly_day);
      setWeeklyDay(day);
      setAutopilot(map.social_autopilot !== 'off');
      setRhythm(parseRhythm(map.social_rhythm));
      // Semaine affichée par défaut : la suivante dès le jour de préparation, sinon la semaine en cours.
      setWeek((w) => w ?? (shouldPrepareNextWeek(today, day) ? nextWeekStart(today) : weekStart(today)));
    });
  }, [today]);

  useEffect(() => { if (week) onWeekChange?.(week); }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    if (!week) return [];
    const { from, to } = weekRange(week);
    // En instants, pas en texte : la base écrit `+00:00`, weekRange `.000Z`.
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    return posts
      .filter((p) => p.status !== 'archived' && (p.planned_at || p.scheduled_at || p.published_at))
      .filter((p) => { const at = Date.parse(dateOf(p)!); return at >= fromMs && at < toMs; })
      .sort((a, b) => Date.parse(dateOf(a)!) - Date.parse(dateOf(b)!));
  }, [posts, week]);

  const subjects = items.filter((p) => weekState(p) === 'sujet');
  const toReview = items.filter((p) => weekState(p) === 'a_relire');
  const validated = items.filter((p) => weekState(p) === 'programmee');
  const finished = items.filter((p) => ['publiee', 'echec'].includes(weekState(p)));
  const connected = connectedNetworks(meta);
  const past = week ? week < weekStart(today) : false;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e: any) {
      setMessage({ tone: 'danger', text: e?.message || 'Action impossible.' });
    } finally {
      setBusy(null);
    }
  };

  // ── 1. Plan ──
  const propose = (replace: boolean) => run(replace ? 'replace' : 'propose', async () => {
    const r = await api<{ created: number }>('/api/admin/social/week', { week, action: replace ? 'replace' : 'propose' });
    await onChanged();
    setMessage(r.created
      ? { tone: 'success', text: `${r.created} sujet${r.created > 1 ? 's' : ''} proposé${r.created > 1 ? 's' : ''}. Relisez-les, puis validez le plan.` }
      : { tone: 'info', text: 'Aucun créneau libre cette semaine : tout est déjà prévu (ou le rythme est vide).' });
  });

  const saveSubject = async (p: SocialPost, patch: Partial<Pick<SocialPost, 'title' | 'plan_note' | 'pillar'>>) => {
    const row: Record<string, unknown> = { ...patch };
    if (patch.title !== undefined) row.visual = { ...p.visual, headline: patch.title };
    if (patch.pillar) row.visual = { ...p.visual, ...(row.visual as object), eyebrow: PILLAR_LABEL[patch.pillar] };
    const { error } = await supabase.from('social_posts').update(row).eq('id', p.id);
    if (error) setMessage({ tone: 'danger', text: error.message });
    else await onChanged();
  };

  const discard = (p: SocialPost) => run(`discard-${p.id}`, async () => {
    if (!window.confirm(`Écarter « ${p.title} » ?`)) return;
    const { error } = await supabase.from('social_posts').delete().eq('id', p.id);
    if (error) throw new Error(error.message);
    await onChanged();
  });

  /** Valider le plan : rédaction de tout en parallèle (serveur), puis visuels et Reels un par un (ici). */
  const preparePosts = (list: SocialPost[]) => run('prepare', async () => {
    setErrors([]);
    const failures: string[] = [];
    setProgress({ done: 0, total: list.length, label: 'Rédaction de la semaine', step: 'L’IA écrit les textes et les scènes' });
    const written = await Promise.allSettled(list.map((p) => requestWriting(sourceOf(p), p.plan_note || '', p.kind, p.planned_at)));
    for (const [i, p] of list.entries()) {
      const w = written[i];
      if (w.status === 'rejected') {
        failures.push(`${p.title} : ${w.reason?.message || 'rédaction impossible'}`);
        continue;
      }
      setProgress({ done: i, total: list.length, label: p.title, step: p.kind === 'reel' ? 'Montage du Reel' : 'Visuel' });
      try {
        await prepareDraft(p, brand, (step, pr) => setProgress({ done: i, total: list.length, label: p.title, step: `${step} — ${Math.round(pr * 100)} %` }), w.value as WriteResult);
      } catch (e: any) {
        failures.push(`${p.title} : ${e?.message || 'préparation impossible'}`);
      }
    }
    setProgress(null);
    setErrors(failures);
    await onChanged();
    const ok = list.length - failures.length;
    setMessage({ tone: failures.length ? 'warning' : 'success', text: `${ok} publication${ok > 1 ? 's' : ''} prête${ok > 1 ? 's' : ''} à relire ci-dessous.` });
  });

  // ── 3. Relecture ──
  const validate = (p: SocialPost) =>
    api('/api/admin/social/publish', { postId: p.id, action: 'schedule', scheduledAt: p.planned_at || p.scheduled_at });

  const validateOne = (p: SocialPost) => run(`validate-${p.id}`, async () => { await validate(p); await onChanged(); });
  const validateAll = () => run('validate-all', async () => {
    const failures: string[] = [];
    for (const p of toReview) {
      try { await validate(p); } catch (e: any) { failures.push(`${p.title} : ${e.message}`); }
    }
    setErrors(failures);
    await onChanged();
    const ok = toReview.length - failures.length;
    setMessage({ tone: failures.length ? 'warning' : 'success', text: `${ok} publication${ok > 1 ? 's' : ''} validée${ok > 1 ? 's' : ''} : elles partiront seules aux heures prévues.` });
  });
  const unvalidate = (p: SocialPost) => run(`undo-${p.id}`, async () => {
    await api('/api/admin/social/publish', { postId: p.id, action: 'unschedule' });
    await onChanged();
  });

  // ── Réglages ──
  const saveSettings = (patch: Record<string, string>) =>
    supabase.from('settings').upsert(Object.entries(patch).map(([key, value]) => ({ key, value })), { onConflict: 'key' })
      .then(({ error }) => error && setMessage({ tone: 'danger', text: error.message }));

  if (!week) return <p className="py-10 text-center text-[14px] text-stone-600">Chargement…</p>;

  const step = subjects.length ? 1 : toReview.length ? 3 : items.length ? 4 : 0;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-stone-700 hover:text-stone-950 cursor-pointer">
        <ArrowLeft size={15} /> Retour aux publications
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Semaine précédente" />
        <h2 className="text-[20px] font-semibold tracking-tight text-stone-950">Semaine {weekLabel(week)}</h2>
        <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => setWeek(shiftWeek(week, 1))} aria-label="Semaine suivante" />
        {week === weekStart(today) && <Badge tone="info">Cette semaine</Badge>}
        {week === nextWeekStart(today) && <Badge tone="info">Semaine prochaine</Badge>}
      </div>

      <ol className="grid grid-cols-3 gap-2 text-[13px]" aria-label="Étapes">
        {['Valider le plan', 'Préparation automatique', 'Relire et valider'].map((label, i) => {
          const n = i + 1;
          const active = (n === 1 && step <= 1) || (n === 2 && Boolean(progress)) || (n === 3 && step === 3 && !progress);
          const done = (n === 1 && step >= 3) || (n === 2 && step >= 3 && !progress) || (n === 3 && step === 4);
          return (
            <li key={label} className={`rounded-lg px-3 py-2 ${active ? 'bg-accent text-accent-fg' : done ? 'bg-emerald-50 text-stone-900' : 'bg-stone-50 text-stone-600'}`}>
              <span className="font-semibold">{done ? <Check size={13} className="mr-1 inline" /> : `${n}. `}</span>{label}
            </li>
          );
        })}
      </ol>

      {message && <Callout tone={message.tone}>{message.text}</Callout>}
      {errors.length > 0 && <Callout tone="warning" title="Pas abouti"><ul className="list-disc pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Callout>}
      {!connected.facebook && <Callout tone="warning">Les comptes ne sont pas reliés : la semaine peut se préparer, mais rien ne partira tant que Facebook et Instagram ne sont pas connectés.</Callout>}

      {progress && (
        <div className="rounded-lg bg-stone-50 px-4 py-3" role="status">
          <p className="text-[14px] font-semibold text-stone-900">{Math.min(progress.done + 1, progress.total)} / {progress.total} — {progress.label}</p>
          <p className="text-[13px] text-stone-600">{progress.step}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div>
          <p className="mt-2 text-[12.5px] text-stone-600">Gardez cette page ouverte : les visuels et les vidéos se fabriquent dans ce navigateur.</p>
        </div>
      )}

      {/* ── Aucun sujet encore ── */}
      {!past && items.length === 0 && (
        <Card>
          <CardHeader
            title="Pas encore de plan pour cette semaine"
            description={`Le ${WEEKDAY_LABEL[weeklyDay].toLowerCase()}, le plan de la semaine suivante se prépare tout seul${autopilot ? '' : ' (pilote en pause)'}. Vous pouvez le demander dès maintenant.`}
          />
          <CardFooter>
            <Button variant="primary" icon={Sparkles} onClick={() => propose(false)} loading={busy === 'propose'}>Proposer le plan de la semaine</Button>
          </CardFooter>
        </Card>
      )}

      {/* ── 1. Plan ── */}
      {subjects.length > 0 && (
        <Card>
          <CardHeader
            title="1. Le plan de la semaine"
            description="Un sujet par créneau. Corrigez un sujet ou son angle si besoin, retirez ce qui ne vous convient pas, puis validez : tout se prépare dans la foulée."
          />
          <CardBody className="space-y-2">
            {subjects.map((p) => <SubjectRow key={p.id} post={p} onSave={saveSubject} onDiscard={discard} busy={busy} />)}
          </CardBody>
          <CardFooter hint="Compter environ une minute par Reel, quelques secondes par publication.">
            <Button icon={RefreshCw} onClick={() => propose(true)} loading={busy === 'replace'} disabled={Boolean(busy)}>Proposer d’autres sujets</Button>
            <Button variant="primary" icon={Wand2} onClick={() => preparePosts(subjects)} loading={busy === 'prepare'} disabled={Boolean(busy)}>
              Valider le plan et préparer ({subjects.length})
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── 3. Relecture ── */}
      {toReview.length > 0 && (
        <Card>
          <CardHeader
            title="2. À relire"
            description="Exactement ce qui sera publié. « Valider » la programme à son heure ; « Modifier » ouvre l’éditeur ; « Refaire » propose un autre texte et un autre visuel."
          />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {toReview.map((p) => (
                <ReviewCard key={p.id} post={p} busy={busy}
                  onValidate={() => validateOne(p)}
                  onEdit={() => onOpen(p)}
                  onRedo={() => preparePosts([p])}
                  onDiscard={() => discard(p)}
                />
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <Button variant="primary" icon={CalendarCheck} onClick={validateAll} loading={busy === 'validate-all'} disabled={Boolean(busy) || !connected.facebook}>
              Tout valider ({toReview.length})
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Validées ── */}
      {(validated.length > 0 || finished.length > 0) && (
        <Card>
          <CardHeader title="Validées" description="Elles partent seules à leur heure. Vous pouvez encore les reprendre." />
          <CardBody>
            <div className="data-frame divide-y divide-stone-100">
              {[...validated, ...finished].map((p) => {
                const Icon = KIND_ICON[p.kind];
                const state = weekState(p);
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-white px-3 py-2.5">
                    <Icon size={16} className="shrink-0 text-stone-500" />
                    <button type="button" onClick={() => onOpen(p)} className="min-w-0 flex-1 text-left cursor-pointer">
                      <span className="block truncate text-[14px] font-semibold text-stone-900">{p.visual.headline || p.title}</span>
                      <span className="block truncate text-[12.5px] text-stone-600">{when(dateOf(p)!)} · {KIND_LABEL[p.kind]}</span>
                    </button>
                    <Badge tone={state === 'publiee' ? 'success' : state === 'echec' ? 'danger' : 'info'}>{WEEK_STATE_LABEL[state]}</Badge>
                    {state === 'programmee' && p.status === 'scheduled' && (
                      <Button size="sm" variant="ghost" icon={Undo2} onClick={() => unvalidate(p)} loading={busy === `undo-${p.id}`}>Reprendre</Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <AutopilotSettings
        autopilot={autopilot}
        weeklyDay={weeklyDay}
        rhythm={rhythm}
        onAutopilot={(on) => { setAutopilot(on); saveSettings({ social_autopilot: on ? 'on' : 'off' }); }}
        onWeeklyDay={(d) => { setWeeklyDay(d); saveSettings({ social_weekly_day: String(d) }); }}
        onRhythm={(r) => { setRhythm(r); saveSettings({ social_rhythm: JSON.stringify(r) }); setMessage({ tone: 'success', text: 'Rythme enregistré : il vaut pour les prochains plans.' }); }}
      />
    </div>
  );
}

function SubjectRow({ post, onSave, onDiscard, busy }: {
  post: SocialPost;
  onSave: (p: SocialPost, patch: Partial<Pick<SocialPost, 'title' | 'plan_note' | 'pillar'>>) => void;
  onDiscard: (p: SocialPost) => void;
  busy: string | null;
}) {
  const [title, setTitle] = useState(post.title);
  const [note, setNote] = useState(post.plan_note || '');
  const Icon = KIND_ICON[post.kind];
  return (
    <div className="space-y-2 rounded-lg bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={15} className="text-stone-500" />
        <span className="text-[13.5px] font-semibold text-stone-900">{when(post.planned_at!)}</span>
        <Badge>{KIND_LABEL[post.kind]}</Badge>
        <Select value={post.pillar || 'conseil'} onChange={(e) => onSave(post, { pillar: e.target.value as PillarId })} className="ml-auto w-44" aria-label="Thème">
          {PILLARS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </Select>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDiscard(post)} loading={busy === `discard-${post.id}`} aria-label="Écarter ce sujet" />
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== post.title && onSave(post, { title: title.trim() })} aria-label="Sujet" />
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (post.plan_note || '') && onSave(post, { plan_note: note.trim() })} aria-label="Angle" />
    </div>
  );
}

function ReviewCard({ post, busy, onValidate, onEdit, onRedo, onDiscard }: {
  post: SocialPost;
  busy: string | null;
  onValidate: () => void;
  onEdit: () => void;
  onRedo: () => void;
  onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[post.kind];
  const ratio = post.kind === 'post' ? (post.visual.format === 'square' ? '1 / 1' : '4 / 5') : '9 / 16';
  return (
    <div className="flex flex-col overflow-hidden rounded-lg bg-white" style={{ boxShadow: '0 0 0 1px #e7e5e4' }}>
      <div className="px-3 py-2 text-[13px]">
        <p className="flex items-center gap-1.5 font-semibold text-stone-900"><Icon size={14} /> {KIND_LABEL[post.kind]} · {when(post.planned_at!)}</p>
      </div>
      <div className="bg-stone-100" style={{ aspectRatio: ratio }}>
        {post.kind === 'reel' && post.video_url ? (
          <video src={post.video_url} poster={post.image_url || undefined} controls playsInline preload="none" className="h-full w-full bg-black object-contain" />
        ) : post.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_url} alt={post.visual.headline} className="h-full w-full object-cover" />
        ) : null}
      </div>
      {post.kind !== 'story' && (
        <div className="px-3 py-2.5 text-[13px] leading-relaxed text-stone-800" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
          <p className={`whitespace-pre-line ${open ? '' : 'line-clamp-4'}`}>{post.caption}</p>
          {post.caption.length > 180 && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[12.5px] text-stone-500 cursor-pointer">{open ? 'réduire' : 'lire tout'}</button>
          )}
          {post.hashtags && <p className="mt-1 text-[12.5px] text-stone-500">{post.hashtags}</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-1.5 border-t border-stone-100 p-2.5">
        <Button size="sm" variant="primary" icon={Check} onClick={onValidate} loading={busy === `validate-${post.id}`} disabled={Boolean(busy)}>Valider</Button>
        <Button size="sm" icon={Pencil} onClick={onEdit} disabled={Boolean(busy)}>Modifier</Button>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRedo} disabled={Boolean(busy)}>Refaire</Button>
        <Button size="sm" variant="ghost" icon={Trash2} onClick={onDiscard} disabled={Boolean(busy)} aria-label="Écarter" />
      </div>
    </div>
  );
}

function AutopilotSettings({ autopilot, weeklyDay, rhythm, onAutopilot, onWeeklyDay, onRhythm }: {
  autopilot: boolean;
  weeklyDay: number;
  rhythm: Rhythm;
  onAutopilot: (on: boolean) => void;
  onWeeklyDay: (d: number) => void;
  onRhythm: (r: Rhythm) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Rhythm>(rhythm);
  const [slot, setSlot] = useState<RhythmSlot>({ day: 3, time: '12:15', kind: 'story' });
  useEffect(() => setDraft(rhythm), [rhythm]);
  const changed = JSON.stringify(draft) !== JSON.stringify(rhythm);
  return (
    <Card>
      <CardHeader
        title="Pilote automatique"
        description={autopilot
          ? `Chaque ${WEEKDAY_LABEL[weeklyDay].toLowerCase()}, le plan de la semaine suivante est proposé sur ${rhythm.slots.length} créneau${rhythm.slots.length > 1 ? 'x' : ''}, et une notification vous prévient.`
          : 'En pause : aucun plan ne se prépare tout seul.'}
        actions={<Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? 'Masquer' : 'Régler'}</Button>}
      />
      {open && (
        <>
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-3 text-[14px] font-semibold text-stone-900">
                <Toggle checked={autopilot} onChange={onAutopilot} label="Pilote automatique" /> Préparer le plan tout seul
              </label>
              <Field label="Jour de préparation" htmlFor="weekly-day">
                <Select id="weekly-day" value={String(weeklyDay)} onChange={(e) => onWeeklyDay(Number(e.target.value))} className="w-40">
                  {WEEKDAY_LABEL.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </Select>
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-stone-900">Créneaux de la semaine</p>
              <p className="text-[13px] text-stone-600">Meta ne donne les heures de connexion de vos abonnées qu’à partir de 100 abonnées ; en attendant, ces horaires visent un public local (soirs de semaine, samedi matin).</p>
              <div className="flex flex-wrap gap-2">
                {draft.slots.map((s, i) => {
                  const Icon = KIND_ICON[s.kind];
                  return (
                    <span key={`${s.day}-${s.time}-${i}`} className="inline-flex items-center gap-2 rounded-lg bg-white py-1.5 pl-3 pr-1.5 text-[14px] text-stone-900">
                      <Icon size={14} className="text-stone-500" /> {WEEKDAY_LABEL[s.day]} {s.time} · {KIND_LABEL[s.kind]}
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label="Retirer ce créneau" onClick={() => setDraft({ slots: draft.slots.filter((_, j) => j !== i) })} />
                    </span>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Jour" htmlFor="slot-day">
                  <Select id="slot-day" value={String(slot.day)} onChange={(e) => setSlot({ ...slot, day: Number(e.target.value) })} className="w-36">
                    {WEEKDAY_LABEL.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Heure" htmlFor="slot-time">
                  <Input id="slot-time" type="time" value={slot.time} onChange={(e) => setSlot({ ...slot, time: e.target.value })} className="w-28" />
                </Field>
                <Field label="Sorte" htmlFor="slot-kind">
                  <Select id="slot-kind" value={slot.kind} onChange={(e) => setSlot({ ...slot, kind: e.target.value as SocialKind })} className="w-36">
                    {(['post', 'story', 'reel'] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </Select>
                </Field>
                <Button icon={Plus} onClick={() => setDraft(parseRhythm(JSON.stringify({ slots: [...draft.slots, slot] })))}>Ajouter</Button>
              </div>
            </div>
          </CardBody>
          <CardFooter hint={changed ? 'Créneaux modifiés, pas encore enregistrés.' : undefined}>
            <Button variant="primary" disabled={!changed} onClick={() => onRhythm(draft)}>Enregistrer les créneaux</Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
