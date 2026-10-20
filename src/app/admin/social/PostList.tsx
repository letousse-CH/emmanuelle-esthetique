"use client";

import React, { useState } from 'react';
import { ChevronRight, ExternalLink, Facebook, ImageIcon, Instagram, Plus } from 'lucide-react';
import { Badge, Button, EmptyState } from '../../../components/admin/ui';
import { POST_STATUS_LABEL, type SocialPost, type SocialPostStatus, type SocialPublication } from '../../../types/social';

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

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

function dateLine(p: SocialPost): string {
  if (p.status === 'scheduled') return `Programmée le ${when(p.scheduled_at)}`;
  if (p.status === 'published' || p.status === 'partial') return `Publiée le ${when(p.published_at)}`;
  return `Modifiée le ${when(p.updated_at)}`;
}

interface Props {
  posts: SocialPost[];
  pubs: SocialPublication[];
  loading: boolean;
  onOpen: (post: SocialPost) => void;
  onNew: () => void;
}

export default function PostList({ posts, pubs, loading, onOpen, onNew }: Props) {
  const [showArchived, setShowArchived] = useState(false);

  const todo = posts
    .filter((p) => ['publishing', 'failed', 'scheduled', 'draft'].includes(p.status))
    .sort((a, b) => {
      const rank: Record<string, number> = { publishing: 0, failed: 1, scheduled: 2, draft: 3 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.status === 'scheduled') return (a.scheduled_at || '').localeCompare(b.scheduled_at || '');
      return b.updated_at.localeCompare(a.updated_at);
    });
  const done = posts
    .filter((p) => p.status === 'published' || p.status === 'partial')
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  const archived = posts.filter((p) => p.status === 'archived');

  if (loading && !posts.length) return <p className="py-10 text-center text-[14px] text-stone-600">Chargement des publications…</p>;

  if (!todo.length && !done.length) {
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
    <div className="space-y-8">
      {todo.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-stone-600">À publier</h2>
          <div className="data-frame divide-y divide-stone-100">{todo.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} />)}</div>
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-stone-600">Publiées</h2>
          <div className="data-frame divide-y divide-stone-100">{done.map((p) => <Row key={p.id} post={p} pubs={pubs} onOpen={onOpen} />)}</div>
        </section>
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

function Row({ post, pubs, onOpen }: { post: SocialPost; pubs: SocialPublication[]; onOpen: (p: SocialPost) => void }) {
  const mine = pubs.filter((p) => p.post_id === post.id);
  const thumb = post.image_url || post.visual.photo_url;
  return (
    <div className="flex items-center gap-4 bg-white px-3 py-3 hover:bg-row-hover">
      <button type="button" onClick={() => onOpen(post)} className="flex min-w-0 flex-1 items-center gap-4 text-left cursor-pointer">
        <span className="h-[70px] w-14 shrink-0 overflow-hidden bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-stone-400"><ImageIcon size={18} /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-stone-900">{post.visual.headline || post.title || 'Sans titre'}</span>
          <span className="block truncate text-[13px] text-stone-600">{post.caption.split('\n')[0] || 'Pas encore de légende'}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-stone-600">
            <Badge tone={statusTone(post.status)}>{POST_STATUS_LABEL[post.status]}</Badge>
            {dateLine(post)}
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
