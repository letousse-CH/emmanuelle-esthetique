"use client";

import React, { useEffect, useState } from 'react';
import { SITE_CONFIG } from '../../../config/site';
import Link from 'next/link';
import { fetchAllArticles, deleteArticle, updateArticleContent } from '../../../services/articles';
import { supabase } from '../../../services/supabase';
import { Article } from '../../../types/blog';
import { Plus, Edit, Trash2, CheckCircle, Eye, Clock, FileText, Link2 } from 'lucide-react';
import { injectInternalLinks } from '../../../utils/internalLinks';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import ModuleDisabledBanner from '../../../components/admin/ModuleDisabledBanner';

export default function BlogList() {
  const moduleFlags = useModuleFlags();
  const [articlesState, setArticlesState] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [meshingProgress, setMeshingProgress] = useState<{ done: number; total: number } | null>(null);
  const [seoScores, setSeoScores] = useState<Record<string, number>>({});

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
    setMeshingProgress({ done: 0, total: published.length });
    const lookup = published.map(a => ({ title: a.title, slug: a.slug }));
    for (let i = 0; i < published.length; i++) {
      const article = published[i];
      const linked = injectInternalLinks(article.content || '', lookup, article.slug);
      await updateArticleContent(article.id, linked);
      setMeshingProgress({ done: i + 1, total: published.length });
    }
    setMeshingProgress(null);
    fetchArticles();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) {
      const article = articlesState.find(a => a.id === id);
      const result = await deleteArticle(id);
      if (!result.success) { alert(result.error ?? "Erreur lors de la suppression."); return; }
      setArticlesState(articlesState.filter(a => a.id !== id));
      if (article) pingIndexNow(`${SITE_CONFIG.url}/blog/${article.slug}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {!moduleFlags.blog && <ModuleDisabledBanner moduleLabel="Blog" />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Contenu</p>
          <h1 className="text-2xl font-semibold text-stone-900">Articles du blog</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleApplyMeshing}
            disabled={!!meshingProgress || loading}
            title="Injecte les liens internes dans tous les articles publiés"
            className="flex items-center gap-2 border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-900 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Link2 size={14} />
            {meshingProgress ? `Maillage… ${meshingProgress.done}/${meshingProgress.total}` : 'Maillage interne'}
          </button>
          <Link href="/admin/blog/new" className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors">
            <Plus size={15} /> Nouvel article
          </Link>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-stone-500 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" /> Chargement…
          </div>
        ) : articlesState.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-600">Aucun article trouvé.</p>
        ) : (
          <>
            {/* Tableau — écrans sm et plus */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/50">
                    <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600">Titre</th>
                    <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600">Date</th>
                    <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-center">Statut</th>
                    <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-center">SEO</th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {articlesState.map((article) => (
                    <tr key={article.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-medium text-stone-900">{article.title}</p>
                        <p className="text-[12.5px] text-stone-500 mt-0.5 font-mono">/{article.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-stone-500 text-xs whitespace-nowrap">
                        {new Date(article.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge article={article} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <SeoBadge score={seoScores[article.id]} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                          <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer"
                            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Voir" aria-label={`Voir l'article « ${article.title} »`}>
                            <Eye size={14} />
                          </a>
                          <Link href={`/admin/blog/edit/${article.id}`}
                            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Modifier" aria-label={`Modifier l'article « ${article.title} »`}>
                            <Edit size={14} />
                          </Link>
                          <button onClick={() => handleDelete(article.id)}
                            className="p-1.5 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer l'article « ${article.title} »`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes — mobile */}
            <div className="sm:hidden divide-y divide-stone-100">
              {articlesState.map((article) => (
                <div key={article.id} className="p-4 space-y-3">
                  <div>
                    <p className="font-medium text-stone-900 leading-snug">{article.title}</p>
                    <p className="text-[12.5px] text-stone-500 mt-0.5 font-mono">/{article.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge article={article} />
                    <SeoBadge score={seoScores[article.id]} />
                    <span className="text-[12.5px] text-stone-500 ml-auto whitespace-nowrap">
                      {new Date(article.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer" aria-label={`Voir l'article « ${article.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium active:bg-stone-100 transition-colors">
                      <Eye size={14} /> Voir
                    </a>
                    <Link href={`/admin/blog/edit/${article.id}`} aria-label={`Modifier l'article « ${article.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-sage/30 bg-sage/5 text-sage text-xs font-medium active:bg-sage/10 transition-colors">
                      <Edit size={14} /> Modifier
                    </Link>
                    <button onClick={() => handleDelete(article.id)} aria-label={`Supprimer l'article « ${article.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium active:bg-red-50 transition-colors cursor-pointer">
                      <Trash2 size={14} /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ article }: { article: Article }) {
  if (article.published) {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-[12px] font-semibold">
        <CheckCircle size={10} /> Publié
      </span>
    );
  }
  if (article.scheduled_at) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-[12px] font-semibold">
          <Clock size={10} /> Programmé
        </span>
        <span className="text-[12px] text-amber-500">
          {new Date(article.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full text-[12px] font-semibold">
      <FileText size={10} /> Brouillon
    </span>
  );
}

function SeoBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return <span className="text-stone-500 text-xs">—</span>;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[12px] font-bold ${
      score >= 75 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    }`}>{score}%</span>
  );
}
