"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Loader2, Database } from 'lucide-react';
import { fetchAllPages, deletePage } from '../../../services/dynamicPages';
import type { DynamicPage } from '../../../services/dynamicPages';
import { seedDefaultPages } from '../../../services/seeder';

const getPagePath = (slug: string) => slug === 'home' ? '/' : `/${slug}`;

export default function PageList() {
  const [pages, setPages]     = useState<DynamicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setPages(await fetchAllPages()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (page: DynamicPage) => {
    if (!confirm(`Supprimer "${page.title}" ?`)) return;
    await deletePage(page.id);
    setPages(prev => prev.filter(p => p.id !== page.id));
  };

  const handleSeed = async () => {
    if (!confirm("Voulez-vous importer ou réinitialiser les pages par défaut ?")) return;
    setSeeding(true);
    try { await seedDefaultPages(); alert("Importation réussie !"); await load(); }
    catch (err) { console.error(err); alert("Erreur lors de l'importation."); }
    finally { setSeeding(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">Site</p>
          <h1 className="text-2xl font-semibold text-stone-900">Pages dynamiques</h1>
          <p className="text-stone-400 text-sm mt-1">Créez et gérez vos pages CMS.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSeed} disabled={seeding}
            className="flex items-center gap-2 border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 cursor-pointer">
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Pages par défaut
          </button>
          <Link href="/admin/pages/new" className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sage/80 transition-colors">
            <Plus size={15} /> Nouvelle page
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm text-center py-24">
          <p className="text-stone-400 text-lg font-light mb-2">Aucune page</p>
          <p className="text-stone-400 text-sm">Créez votre première page dynamique.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">Titre</th>
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">Slug</th>
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">Sections</th>
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">Statut</th>
                  <th className="px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400 text-left">Modifié</th>
                  <th className="px-6 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-stone-900">{page.title}</td>
                    <td className="px-6 py-4 font-mono text-xs text-stone-400">{getPagePath(page.slug)}</td>
                    <td className="px-6 py-4 text-sm text-stone-400">{page.sections.length}</td>
                    <td className="px-6 py-4">
                      <PageStatusBadge published={page.published} />
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-400 whitespace-nowrap">
                      {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        {page.published && (
                          <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-stone-300 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors" title="Voir" aria-label={`Voir la page « ${page.title} »`}>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <Link href={`/admin/pages/edit/${page.id}`}
                          className="p-1.5 text-stone-300 hover:text-sage rounded-md hover:bg-sage/10 transition-colors" title="Modifier" aria-label={`Modifier « ${page.title} »`}>
                          <Pencil size={13} />
                        </Link>
                        <button onClick={() => handleDelete(page)}
                          className="p-1.5 text-stone-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer « ${page.title} »`}>
                          <Trash2 size={13} />
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
            {pages.map(page => (
              <div key={page.id} className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-stone-900 leading-snug">{page.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5 font-mono">{getPagePath(page.slug)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PageStatusBadge published={page.published} />
                  <span className="text-[11px] text-stone-400">{page.sections.length} section{page.sections.length !== 1 ? 's' : ''}</span>
                  <span className="text-[11px] text-stone-400 ml-auto whitespace-nowrap">
                    {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className={`grid gap-2 pt-1 ${page.published ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {page.published && (
                    <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer" aria-label={`Voir la page « ${page.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium active:bg-stone-100 transition-colors">
                      <ExternalLink size={14} /> Voir
                    </a>
                  )}
                  <Link href={`/admin/pages/edit/${page.id}`} aria-label={`Modifier « ${page.title} »`}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-sage/30 bg-sage/5 text-sage text-xs font-medium active:bg-sage/10 transition-colors">
                    <Pencil size={14} /> Modifier
                  </Link>
                  <button onClick={() => handleDelete(page)} aria-label={`Supprimer « ${page.title} »`}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-100 text-red-500 text-xs font-medium active:bg-red-50 transition-colors cursor-pointer">
                    <Trash2 size={14} /> Supprimer
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

function PageStatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${published ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
      {published ? <Eye size={10} /> : <EyeOff size={10} />}
      {published ? 'Publié' : 'Brouillon'}
    </span>
  );
}
