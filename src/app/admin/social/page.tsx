"use client";

/**
 * Réseaux sociaux — une seule page, trois vues : la liste des publications,
 * l'éditeur d'une publication, les comptes Facebook / Instagram.
 *
 * Une publication = un visuel aux couleurs du site + une légende, publiés tout
 * de suite ou à l'heure choisie (tâche planifiée toutes les dix minutes).
 * Règles : `src/types/social.ts` ; envoi : `src/services/socialPublish.ts`.
 */
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Facebook, Instagram, Plus, Settings2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';
import { Button, Callout, PageHeader } from '../../../components/admin/ui';
import { normalizePost, type SocialPost, type SocialPublication } from '../../../types/social';
import { loadVisualBrand, type VisualBrand } from '../../../utils/socialVisual';
import { api, connectedNetworks, type MetaStatus } from './api';
import PostList from './PostList';
import PostEditor, { type EditorSource } from './PostEditor';
import AccountsPanel from './AccountsPanel';

type View =
  | { kind: 'list' }
  | { kind: 'editor'; post: SocialPost | null; draftFrom?: SocialPost | null; source?: EditorSource | null; autoWrite?: boolean; key: number }
  | { kind: 'accounts' };

function SocialPage() {
  const flags = useModuleFlags();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [pubs, setPubs] = useState<SocialPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [brand, setBrand] = useState<VisualBrand | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [askPageChoice, setAskPageChoice] = useState(false);

  const loadPosts = useCallback(async () => {
    const [{ data, error }, { data: pubRows }] = await Promise.all([
      supabase.from('social_posts').select('*').order('updated_at', { ascending: false }).limit(200),
      supabase.from('social_publications').select('*'),
    ]);
    if (error) setListError(`Les publications n’ont pas pu être lues : ${error.message}`);
    else setListError(null);
    setPosts((data ?? []).map(normalizePost));
    setPubs((pubRows ?? []) as SocialPublication[]);
    setLoading(false);
  }, []);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      setMeta(await api<MetaStatus>('/api/admin/meta/status'));
    } catch (e: any) {
      setNotice({ tone: 'danger', text: e.message });
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadMeta();
    loadVisualBrand(supabase).then(setBrand);
  }, [loadPosts, loadMeta]);

  // Retour de Facebook (?comptes=…) et liens depuis le blog, les offres… (?article=, ?offre=, ?soin=, ?sujet=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const comptes = params.get('comptes');
    let handled = false;
    if (comptes) {
      handled = true;
      setView({ kind: 'accounts' });
      if (comptes === 'ok') setNotice({ tone: 'success', text: 'Facebook et Instagram sont reliés.' });
      else if (comptes === 'choisir') { setAskPageChoice(true); setNotice({ tone: 'info', text: 'Choisissez la Page de l’institut ci-dessous.' }); }
      else setNotice({ tone: 'danger', text: params.get('message') || 'La connexion n’a pas abouti.' });
    } else {
      const source: EditorSource | null =
        params.get('article') ? { kind: 'article', id: params.get('article')! }
        : params.get('offre') ? { kind: 'offre', id: params.get('offre')! }
        : params.get('soin') ? { kind: 'soin', id: params.get('soin')! }
        : params.get('sujet') ? { kind: 'idee', text: params.get('sujet')! }
        : null;
      if (source) {
        handled = true;
        setView({ kind: 'editor', post: null, source, autoWrite: true, key: Date.now() });
      }
    }
    if (handled) window.history.replaceState(null, '', '/admin/social');
  }, []);

  useEffect(() => {
    const onReuse = (e: Event) => {
      const from = (e as CustomEvent<SocialPost>).detail;
      setView({ kind: 'editor', post: null, draftFrom: from, key: Date.now() });
    };
    window.addEventListener('social:reuse', onReuse);
    return () => window.removeEventListener('social:reuse', onReuse);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [view.kind]);

  const connected = connectedNetworks(meta);
  const openNew = () => setView({ kind: 'editor', post: null, key: Date.now() });

  return (
    <div className="space-y-6">
      {!flags.social && <ModuleDisabledBanner moduleLabel="Réseaux sociaux" />}

      {view.kind === 'list' && (
        <>
          <PageHeader
            title="Réseaux sociaux"
            description="Un sujet, un visuel aux couleurs du site, une légende : publiez sur Instagram et Facebook tout de suite ou à l’heure de votre choix."
            actions={<Button variant="primary" icon={Plus} onClick={openNew} disabled={!brand}>Nouvelle publication</Button>}
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-stone-50 px-4 py-3 text-[14px]">
            <span className="inline-flex items-center gap-2 text-stone-800">
              <Instagram size={16} />
              {metaLoading ? 'Vérification…' : connected.instagram ? <strong>@{meta?.instagram?.username}</strong> : <span className="text-stone-600">Instagram non relié</span>}
            </span>
            <span className="inline-flex items-center gap-2 text-stone-800">
              <Facebook size={16} />
              {metaLoading ? 'Vérification…' : connected.facebook ? <strong>{meta?.page?.name}</strong> : <span className="text-stone-600">Facebook non relié</span>}
            </span>
            <Button size="sm" variant={connected.facebook ? 'ghost' : 'primary'} icon={Settings2} className="ml-auto" onClick={() => setView({ kind: 'accounts' })}>
              {connected.facebook ? 'Comptes' : 'Relier les comptes'}
            </Button>
          </div>
          {meta?.health === 'expired' && (
            <Callout tone="danger" title="La connexion à Facebook a expiré">
              Les publications ne partiront pas tant que le compte n’est pas reconnecté.
            </Callout>
          )}
          {listError && <Callout tone="danger">{listError}</Callout>}

          <PostList
            posts={posts}
            pubs={pubs}
            loading={loading}
            onNew={openNew}
            onOpen={(post) => setView({ kind: 'editor', post, key: Date.now() })}
          />
        </>
      )}

      {view.kind === 'editor' && brand && (
        <PostEditor
          key={view.key}
          post={view.post}
          draftFrom={view.draftFrom}
          initialSource={view.source}
          autoWrite={view.autoWrite}
          brand={brand}
          meta={meta}
          onClose={() => { setView({ kind: 'list' }); loadPosts(); }}
          onChanged={loadPosts}
          onOpenAccounts={() => setView({ kind: 'accounts' })}
        />
      )}

      {view.kind === 'accounts' && (
        <AccountsPanel
          status={meta}
          loading={metaLoading}
          notice={notice}
          askPageChoice={askPageChoice}
          onRefresh={loadMeta}
          onBack={() => { setNotice(null); setAskPageChoice(false); setView({ kind: 'list' }); }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-stone-700">Chargement…</div>}>
      <SocialPage />
    </Suspense>
  );
}
