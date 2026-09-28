"use client";

import React, { useEffect, useState } from 'react';
import { SITE_CONFIG } from '../../../config/site';
import Link from 'next/link';
import { fetchAllArticles, deleteArticle, updateArticleContent } from '../../../services/articles';
import { supabase } from '../../../services/supabase';
import { Article } from '../../../types/blog';
import { Plus, Edit, Trash2, Eye, FileText, Link2 } from 'lucide-react';
import { Badge, Button, EmptyState, FormMessage, LinkButton, PageHeader, Spinner } from '../../../components/admin/ui';
import { injectInternalLinks } from '../../../utils/internalLinks';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';

export default function BlogList() {
  const moduleFlags = useModuleFlags();
  const [articlesState, setArticlesState] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [meshingProgress, setMeshingProgress] = useState<{ done: number; total: number } | null>(null);
  const [seoScores, setSeoScores] = useState<Record<string, number>>({});
  const [meshingMessage, setMeshingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    setLoading(true);
    const [articles, scoresRes] = await Promise.all([
      fetchAllArticles(),
      supabase.from('article_seo_scores').select('article_id, score'),
    ]);
    setArticlesState(articles);
    if (!scoresRes.error && scoresRes.data) {
      const map: Record<string, number> = {};
      for (const s of scoresRes.data) map[s.article_id] = s.score;
      setSeoScores(map);
    }
    setLoading(false);
  };

  const pingIndexNow = async (url: string) => {
    try { await fetch(`https://www.bing.com/indexnow?url=${encodeURIComponent(url)}&key=${SITE_CONFIG.bingIndexNowKey}`); } catch {}
  };

  const handleApplyMeshing = async () => {
    const published = articlesState.filter(a => a.published);
    if (!published.length) return;
    const ok = window.confirm(
      `Ajouter automatiquement des liens vers vos autres articles dans les ${published.length} articles publiés ?\n\nLe texte des articles sera modifié. Les liens déjà présents sont conservés.`
    );
    if (!ok) return;
    setMeshingMessage(null);
    setMeshingProgress({ done: 0, total: published.length });
    const lookup = published.map(a => ({ title: a.title, slug: a.slug }));
    let failed = 0;
    for (let i = 0; i < published.length; i++) {
      const article = published[i];
      const linked = injectInternalLinks(article.content || '', lookup, article.slug);
      const saved = await updateArticleContent(article.id, linked);
      if (!saved) failed++;
      setMeshingProgress({ done: i + 1, total: published.length });
    }
    setMeshingProgress(null);
    setMeshingMessage(
      failed
        ? { type: 'error', text: `${failed} article${failed > 1 ? 's' : ''} n'${failed > 1 ? 'ont' : 'a'} pas pu être mis à jour. Vérifiez votre connexion et relancez.` }
        : { type: 'success', text: 'Les liens entre articles ont été ajoutés.' }
    );
    fetchArticles();
  };

  const handleDelete = async (id: string) => {
    const article = articlesState.find(a => a.id === id);
    const label = article ? `« ${article.title} »` : 'cet article';
    if (window.confirm(`Supprimer définitivement l'article ${label} ? Cette action est irréversible.`)) {
      const result = await deleteArticle(id);
      if (!result.success) { alert(result.error ?? "La suppression a échoué. Réessayez dans un instant."); return; }
      setArticlesState(prev => prev.filter(a => a.id !== id));
      if (article) pingIndexNow(`${SITE_CONFIG.url}/blog/${article.slug}`);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      {!moduleFlags.blog && <ModuleDisabledBanner moduleLabel="Blog" />}
      <PageHeader
        title="Articles du blog"
        description="Rédigez, programmez et publiez vos articles."
        actions={
          <>
            <Button
              variant="secondary"
              icon={Link2}
              onClick={handleApplyMeshing}
              disabled={!!meshingProgress || loading || !articlesState.some(a => a.published)}
              loading={!!meshingProgress}
              title="Ajoute dans chaque article publié des liens vers vos autres articles"
            >
              {meshingProgress ? `Liens en cours… ${meshingProgress.done}/${meshingProgress.total}` : 'Relier les articles'}
            </Button>
            <LinkButton href="/admin/blog/new" variant="primary" icon={Plus}>
              Nouvel article
            </LinkButton>
          </>
        }
      />
      <FormMessage message={meshingMessage} />

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-12">
          <Spinner label="Chargement des articles" />
        </div>
      ) : articlesState.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun article pour l'instant"
          description="Votre premier article apparaîtra ici dès qu'il sera enregistré."
          action={<LinkButton href="/admin/blog/new" variant="secondary" icon={Plus}>Écrire un article</LinkButton>}
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700">Titre</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700">Date</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700 text-center">Statut</th>
                  <th scope="col" className="px-6 py-3 text-[13px] font-semibold text-stone-700 text-center" title="Score de référencement calculé lors du dernier enregistrement">Référencement</th>
                  <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {articlesState.map((article) => (
                  <tr key={article.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/admin/blog/edit/${article.id}`} className="font-medium text-stone-900 hover:text-accent">
                        {article.title}
                      </Link>
                      <p className="text-[13px] text-stone-600 mt-0.5">/{article.slug}</p>
                    </td>
                    <td className="px-6 py-4 text-stone-700 text-[13px] whitespace-nowrap">
                      {formatDate(article.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge article={article} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <SeoBadge score={seoScores[article.id]} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer"
                          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors" title="Voir sur le site" aria-label={`Voir l'article « ${article.title} » sur le site`}>
                          <Eye size={16} />
                        </a>
                        <Link href={`/admin/blog/edit/${article.id}`}
                          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors" title="Modifier" aria-label={`Modifier l'article « ${article.title} »`}>
                          <Edit size={16} />
                        </Link>
                        <button type="button" onClick={() => handleDelete(article.id)}
                          className="p-2 text-stone-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer l'article « ${article.title} »`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes — mobile */}
          <div className="sm:hidden divide-y divide-stone-200">
            {articlesState.map((article) => (
              <div key={article.id} className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-stone-900 leading-snug">{article.title}</p>
                  <p className="text-[13px] text-stone-600 mt-0.5">/{article.slug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge article={article} />
                  <SeoBadge score={seoScores[article.id]} />
                  <span className="text-[13px] text-stone-600 ml-auto whitespace-nowrap">
                    {formatDate(article.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer" aria-label={`Voir l'article « ${article.title} » sur le site`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors">
                    <Eye size={15} /> Voir
                  </a>
                  <Link href={`/admin/blog/edit/${article.id}`} aria-label={`Modifier l'article « ${article.title} »`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold hover:bg-stone-200 transition-colors">
                    <Edit size={15} /> Modifier
                  </Link>
                  <button type="button" onClick={() => handleDelete(article.id)} aria-label={`Supprimer l'article « ${article.title} »`}
                    className="flex items-center justify-center gap-1.5 h-10 rounded-lg border border-red-200 bg-white text-red-700 text-[13px] font-semibold hover:bg-red-50 transition-colors cursor-pointer">
                    <Trash2 size={15} /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ article }: { article: Article }) {
  if (article.published) return <Badge tone="success">Publié</Badge>;
  if (article.scheduled_at) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Badge tone="warning">Programmé</Badge>
        <span className="text-[13px] text-stone-600">
          le {new Date(article.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      </span>
    );
  }
  return <Badge tone="neutral">Brouillon</Badge>;
}

function SeoBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return <span className="text-stone-600 text-[13px]" title="Pas encore analysé">—</span>;
  const tone = score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger';
  return <Badge tone={tone}>{score} / 100</Badge>;
}
