"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Facebook, ImageIcon, Instagram, List, Plus, Smartphone } from 'lucide-react';
import { Badge, Button, EmptyState } from '../../../components/admin/ui';
import { KIND_LABEL, PILLAR_LABEL, POST_STATUS_LABEL, publishProblems, type SocialKind, type SocialPost, type SocialPostStatus, type SocialPublication } from '../../../types/social';

const KIND_ICON: Record<SocialKind, React.ElementType> = { post: ImageIcon, story: Smartphone, reel: Clapperboard };

/** Brouillon du plan : prêt à programmer, ou encore à préparer. */
const planReady = (p: SocialPost) => publishProblems(p, { instagram: true, facebook: true }).length === 0;

export function statusTone(status: SocialPostStatus): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'scheduled': return 'info';
    case 'publishing': return 'info';
    case 'published': return 'success';
    case 'partial': return 'warning';
    case 'failed': return 'danger';
    default: return 'neutral';
  }
}

// ── Dates (toujours en heure suisse) ─────────────────────────────────────────

const TZ = 'Europe/Zurich';
const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('fr-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayTitle = (key: string) => {
  const label = new Date(`${key}T12:00:00Z`).toLocaleDateString('fr-CH', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const shortWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-CH', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/** Date qui place la publication dans l'agenda : programmée, publiée, ou rien (brouillon). */
function agendaDate(p: SocialPost): string | null {
  if (p.status === 'draft') return p.planned_at;
  if (p.status === 'scheduled' || p.status === 'failed') return p.scheduled_at;
  if (p.status === 'published' || p.status === 'partial' || p.status === 'publishing') return p.published_at || p.scheduled_at || p.updated_at;
  return null;
}

interface Props {
  posts: SocialPost[];
  pubs: SocialPublication[];
  loading: boolean;
  onOpen: (post: SocialPost) => void;
  onNew: () => void;
  /** Nouvelle publication à programmer ce jour-là (« AAAA-MM-JJ »). */
  onNewOn: (day: string) => void;
}

type Mode = 'list' | 'agenda';
const MODE_KEY = 'social.vue';

export default function PostList({ posts, pubs, loading, onOpen, onNew, onNewOn }: Props) {
  const [mode, setMode] = useState<Mode>('list');
  useEffect(() => {
    try { if (localStorage.getItem(MODE_KEY) === 'agenda') setMode('agenda'); } catch { /* stockage indisponible */ }
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* stockage indisponible */ }
  };

  if (loading && !posts.length) return <p className="py-10 text-center text-[14px] text-stone-600">Chargement des publications…</p>;

  if (!posts.some((p) => p.status !== 'archived')) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Aucune publication pour l’instant"
        description="Choisissez un sujet (un soin, un article, l’offre du moment ou une idée) : l’IA rédige la légende, le visuel se compose aux couleurs du site, et vous publiez en un clic."
        action={<Button variant="primary" icon={Plus} onClick={onNew}>Nouvelle publication</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg bg-stone-100 p-1 w-fit" role="tablist" aria-label="Affichage">
        {([['list', 'Liste', List], ['agenda', 'Agenda', CalendarDays]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => choose(id)}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13px] font-semibold cursor-pointer ${mode === id ? 'bg-white text-stone-950' : 'text-stone-600 hover:text-stone-900'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {mode === 'list'
        ? <ListView posts={posts} pubs={pubs} onOpen={onOpen} />
        : <AgendaView posts={posts} onOpen={onOpen} onNewOn={onNewOn} />}
    </div>
  );
}

// ── Liste ────────────────────────────────────────────────────────────────────

function ListView({ posts, pubs, onOpen }: { posts: SocialPost[]; pubs: SocialPublication[]; onOpen: (p: SocialPost) => void }) {
  const [showArchived, setShowArchived] = useState(false);

  const urgent = posts.filter((p) => p.status === 'publishing' || p.status === 'failed');
  const scheduled = posts
    .filter((p) => p.status === 'scheduled' && p.scheduled_at)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const byDay = useMemo(() => {
    const groups = new Map<string, SocialPost[]>();
    for (const p of scheduled) {
      const k = dayKey(p.scheduled_at!);
      groups.set(k, [...(groups.get(k) || []), p]);
    }
    return [...groups.entries()];
  }, [scheduled]);
  const planned = posts
    .filter((p) => p.status === 'draft' && p.planned_at)
    .sort((a, b) => a.planned_at!.localeCompare(b.planned_at!));
  const drafts = posts.filter((p) => p.status === 'draft' && !p.planned_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const done = posts
    .filter((p) => p.status === 'published' || p.status === 'partial')
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  const archived = posts.filter((p) => p.status === 'archived');

  return (
    <div className="space-y-8">
      {urgent.length > 0 && (
        <Section title="À regarder">
          {urgent.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} when={p.status === 'failed' ? 'Échec' : 'Envoi en cours'} />)}
        </Section>
      )}

      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-stone-600">
          Programmées {scheduled.length > 0 && <span className="text-stone-500">({scheduled.length})</span>}
        </h2>
        {byDay.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-4 py-4 text-[14px] text-stone-600">
            Rien de programmé. Ouvrez un brouillon et cliquez « Programmer ».
          </p>
        ) : (
          <div className="space-y-4">
            {byDay.map(([day, list]) => (
              <div key={day} className="space-y-1.5">
                <p className="text-[14px] font-semibold text-stone-900">
                  {dayTitle(day)}{day === todayKey() && <span className="ml-2 text-accent">aujourd’hui</span>}
                </p>
                <div className="data-frame divide-y divide-stone-100">
                  {list.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} when={timeOf(p.scheduled_at!)} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {planned.length > 0 && (
        <Section title={`Au plan, pas encore programmées (${planned.length})`}>
          {planned.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} when={shortWhen(p.planned_at)} />)}
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title={`Brouillons (${drafts.length})`}>
          {drafts.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} />)}
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Publiées">
          {done.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} when={shortWhen(p.published_at)} />)}
        </Section>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-[13px] font-semibold text-stone-600 hover:text-stone-900 cursor-pointer">
            {showArchived ? 'Masquer les archives' : `Voir les archives (${archived.length})`}
          </button>
          {showArchived && <div className="data-frame divide-y divide-stone-100">{archived.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} />)}</div>}
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-stone-600">{title}</h2>
      <div className="data-frame divide-y divide-stone-100">{children}</div>
    </section>
  );
}

function Row({ post, pubs, onOpen, when }: { post: SocialPost; pubs: SocialPublication[]; onOpen: (p: SocialPost) => void; when?: string }) {
  const mine = pubs.filter((p) => p.post_id === post.id);
  const thumb = post.image_url || post.visual.photo_url;
  return (
    <div className="flex items-center gap-4 bg-white px-3 py-3 hover:bg-row-hover">
      <button type="button" onClick={() => onOpen(post)} className="flex min-w-0 flex-1 items-center gap-4 text-left cursor-pointer">
        {when && <span className="min-w-14 shrink-0 whitespace-nowrap text-[15px] font-semibold tabular-nums text-stone-900">{when}</span>}
        <span className="h-[70px] w-14 shrink-0 overflow-hidden bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-stone-400"><ImageIcon size={18} /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-stone-900">{post.visual.headline || post.title || 'Sans titre'}</span>
          <span className="block truncate text-[13px] text-stone-600">{post.caption.split('\n')[0] || 'Pas encore de légende'}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-stone-600">
            <span className="inline-flex items-center gap-1 text-stone-700">{React.createElement(KIND_ICON[post.kind], { size: 13 })} {KIND_LABEL[post.kind]}</span>
            {post.status === 'draft' && post.planned_at
              ? <Badge tone={planReady(post) ? 'success' : 'neutral'}>{planReady(post) ? 'Prête à programmer' : 'À préparer'}</Badge>
              : <Badge tone={statusTone(post.status)}>{POST_STATUS_LABEL[post.status]}</Badge>}
            {post.pillar && <span className="text-stone-500">{PILLAR_LABEL[post.pillar]}</span>}
            <span className="inline-flex items-center gap-1 text-stone-500">
              {post.networks.includes('instagram') && <Instagram size={13} aria-label="Instagram" />}
              {post.networks.includes('facebook') && <Facebook size={13} aria-label="Facebook" />}
            </span>
          </span>
        </span>
      </button>
      {mine.filter((p) => p.status === 'published' && p.permalink).map((p) => (
        <a key={p.id} href={p.permalink!} target="_blank" rel="noreferrer" className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold text-accent sm:inline-flex">
          {p.network === 'instagram' ? 'Instagram' : 'Facebook'} <ExternalLink size={12} />
        </a>
      ))}
      <ChevronRight size={16} className="shrink-0 text-stone-400" />
    </div>
  );
}

// ── Agenda (mois) ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function AgendaView({ posts, onOpen, onNewOn }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void; onNewOn: (day: string) => void }) {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7)); // « AAAA-MM »

  const byDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const at = agendaDate(p);
      if (!at) continue;
      const k = dayKey(at);
      map.set(k, [...(map.get(k) || []), p].sort((a, b) => (agendaDate(a) || '').localeCompare(agendaDate(b) || '')));
    }
    return map;
  }, [posts]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // lundi = 0
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const title = first.toLocaleDateString('fr-CH', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const drafts = posts.filter((p) => p.status === 'draft' && !p.planned_at);
  const monthDays = cells.filter((c): c is string => Boolean(c && byDay.get(c)?.length));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Mois précédent" />
        <p className="min-w-40 text-center text-[16px] font-semibold capitalize text-stone-950">{title}</p>
        <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => shift(1)} aria-label="Mois suivant" />
        {month !== today.slice(0, 7) && <Button size="sm" onClick={() => setMonth(today.slice(0, 7))}>Aujourd’hui</Button>}
        <span className="ml-auto text-[13px] text-stone-600">Cliquez un jour libre pour y programmer une publication.</span>
      </div>

      {/* Grille : à partir de la tablette */}
      <div className="hidden data-frame sm:block">
        <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50">
          {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-[12px] font-semibold uppercase tracking-wide text-stone-600">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const list = day ? byDay.get(day) || [] : [];
            const past = Boolean(day && day < today);
            return (
              <div
                key={i}
                className={`min-h-28 border-b border-r border-stone-100 p-1.5 ${!day ? 'bg-stone-50' : ''} ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
              >
                {day && (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`grid size-6 place-items-center rounded-full text-[12px] font-semibold ${day === today ? 'bg-accent text-accent-fg' : past ? 'text-stone-400' : 'text-stone-700'}`}>
                        {Number(day.slice(8))}
                      </span>
                      {!past && (
                        <button type="button" onClick={() => onNewOn(day)} aria-label={`Programmer le ${dayTitle(day)}`} className="grid size-6 place-items-center text-stone-400 hover:text-accent cursor-pointer">
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {list.map((p) => <AgendaChip key={p.id} post={p} onOpen={onOpen} />)}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Téléphone : les jours du mois qui ont une publication */}
      <div className="space-y-3 sm:hidden">
        {monthDays.length === 0 && <p className="rounded-lg bg-stone-50 px-4 py-4 text-[14px] text-stone-600">Aucune publication ce mois-ci.</p>}
        {monthDays.map((day) => (
          <div key={day} className="space-y-1.5">
            <p className="text-[14px] font-semibold text-stone-900">{dayTitle(day)}</p>
            <div className="space-y-1">{(byDay.get(day) || []).map((p) => <AgendaChip key={p.id} post={p} onOpen={onOpen} />)}</div>
          </div>
        ))}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-stone-600">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-accent-soft align-middle" /> Programmée</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-emerald-50 align-middle" /> Publiée</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm border border-dashed border-stone-400 align-middle" /> Au plan, pas encore programmée</span>
        {drafts.length > 0 && <span>{drafts.length} brouillon{drafts.length > 1 ? 's' : ''} sans date (vue Liste)</span>}
      </p>
    </div>
  );
}

const CHIP_TONE: Partial<Record<SocialPostStatus, string>> = {
  scheduled: 'bg-accent-soft text-stone-900',
  publishing: 'bg-accent-soft text-stone-900',
  published: 'bg-emerald-50 text-stone-900',
  partial: 'bg-warm-soft text-stone-900',
  failed: 'bg-red-50 text-red-900',
};

function AgendaChip({ post, onOpen }: { post: SocialPost; onOpen: (p: SocialPost) => void }) {
  const at = agendaDate(post);
  const thumb = post.image_url || post.visual.photo_url;
  const isPlan = post.status === 'draft';
  const Icon = KIND_ICON[post.kind];
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      title={`${isPlan ? (planReady(post) ? 'Au plan, prête à programmer' : 'Au plan, à préparer') : POST_STATUS_LABEL[post.status]} — ${KIND_LABEL[post.kind]} — ${post.visual.headline || post.title}`}
      className={`flex w-full items-center gap-1.5 rounded px-1 py-1 text-left cursor-pointer hover:opacity-80 ${isPlan ? 'border border-dashed border-stone-300 bg-white text-stone-700' : CHIP_TONE[post.status] || 'bg-stone-100'}`}
    >
      <span className="h-7 w-[22px] shrink-0 overflow-hidden bg-white/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[11.5px] font-semibold tabular-nums"><Icon size={11} /> {at ? timeOf(at) : ''}</span>
        <span className="block truncate text-[11.5px] leading-tight">{post.visual.headline || post.title}</span>
      </span>
    </button>
  );
}
