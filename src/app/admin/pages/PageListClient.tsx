"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Loader2, Database, Globe, LayoutTemplate, Home, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { fetchAllPages, deletePage } from '../../../services/dynamicPages';
import type { DynamicPage } from '../../../services/dynamicPages';
import { seedDefaultPages } from '../../../services/seeder';
import SiteImportPanel from '../../../components/pagebuilder/SiteImportPanel';
import TemplatePicker from '../../../components/pagebuilder/TemplatePicker';
import AutoGenerateSiteModal from '../../../components/pagebuilder/AutoGenerateSiteModal';

/*
  Quelle page sert d'accueil.

  La racine du site ne connaissait que « home » puis « accueil » : une page
  importée sous un autre slug — « accueil-importe » — laissait le site afficher
  « Page introuvable » à son adresse principale, sans rien pour le corriger
  depuis l'admin. Le choix se fait maintenant ici et se range dans le réglage
  `home_page_slug`.
*/
const HOME_SLUG_KEY = 'home_page_slug';
const LEGACY_HOME_SLUGS = ['home', 'accueil'];

export default function PageList() {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
  const [pages, setPages]     = useState<DynamicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [homeSlug, setHomeSlug] = useState('');
  const [savingHome, setSavingHome] = useState<string | null>(null);

  /*
    Slug effectivement servi à la racine : le réglage s'il existe, sinon le
    premier nom historique réellement présent — c'est ce que fait le serveur.
  */
  const effectiveHomeSlug =
    homeSlug || LEGACY_HOME_SLUGS.find((s) => pages.some((p) => p.slug === s)) || '';

  const getPagePath = (slug: string) => (slug === effectiveHomeSlug ? '/' : `/${slug}`);

  const setAsHome = async (page: DynamicPage) => {
    setSavingHome(page.id);
    const { error } = await supabase
      .from('settings')
      .upsert([{ key: HOME_SLUG_KEY, value: page.slug }], { onConflict: 'key' });
    setSavingHome(null);
    if (error) { alert("Impossible d'enregistrer la page d'accueil : " + error.message); return; }
    setHomeSlug(page.slug);
  };


  /**
   * Crée une page à partir de sections déjà construites, puis l'ouvre.
   *
   * Toujours en brouillon : ces contenus — repris d'un ancien site ou issus
   * d'un modèle — doivent être relus avant d'apparaître en ligne.
   */
  const createFromSections = async (sections: unknown[], title: string) => {
    const base = (title || 'nouvelle-page')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'nouvelle-page';

    // Un slug déjà pris ferait échouer l'insertion : on suffixe si besoin.
    const taken = new Set(pages.map((p) => p.slug));
    let slug = base;
    for (let i = 2; taken.has(slug); i += 1) slug = `${base}-${i}`;

    const { data, error } = await supabase
      .from('dynamic_pages')
      .insert({ title: title || 'Nouvelle page', slug, sections, published: false })
      .select('id')
      .single();

    if (error || !data) {
      alert(`Création impossible : ${error?.message ?? 'erreur inconnue'}`);
      return;
    }
    router.push(`/admin/pages/edit/${data.id}`);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [list, { data }] = await Promise.all([
        fetchAllPages(),
        supabase.from('settings').select('value').eq('key', HOME_SLUG_KEY).maybeSingle(),
      ]);
      setPages(list);
      setHomeSlug(((data as { value?: string } | null)?.value ?? '').trim());
    } finally { setLoading(false); }
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
          <p className="text-[12.5px] font-medium text-stone-700 mb-1">Site</p>
          <h1 className="text-2xl font-semibold text-stone-900">Pages dynamiques</h1>
          <p className="mt-1 text-sm text-stone-600">Créez et gérez vos pages CMS.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleSeed} disabled={seeding}
            className="flex items-center gap-2 border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 cursor-pointer">
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Pages par défaut
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
          >
            <Globe size={14} /> Importer un site
          </button>
          <button
            type="button"
            onClick={() => setTemplateOpen(true)}
            className="flex items-center gap-2 border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-800 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
          >
            <LayoutTemplate size={14} /> Partir d'une structure
          </button>
          <button
            type="button"
            onClick={() => setAutoGenerateOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all cursor-pointer"
          >
            <Sparkles size={15} /> Créer le site automatiquement
          </button>
          <Link href="/admin/pages/new" className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors">
            <Plus size={15} /> Nouvelle page
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-sage animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] text-center py-24">
          <p className="text-stone-500 text-lg font-light mb-2">Aucune page</p>
          <p className="text-stone-500 text-sm">Créez votre première page dynamique.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_rgba(28,25,23,0.04)] overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Titre</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Slug</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Sections</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Statut</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-600 text-left">Modifié</th>
                  <th className="px-6 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-stone-900">{page.title}</td>
                    <td className="px-6 py-4 font-mono text-[12.5px] text-stone-500">
                      <span className="inline-flex items-center gap-1.5">
                        {getPagePath(page.slug)}
                        {page.slug === effectiveHomeSlug && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage/10 text-sage text-[11px] font-sans font-medium">
                            <Home size={10} /> Accueil
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">{page.sections.length}</td>
                    <td className="px-6 py-4">
                      <PageStatusBadge published={page.published} />
                    </td>
                    <td className="px-6 py-4 text-[12.5px] text-stone-500 whitespace-nowrap">
                      {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        {page.published && (
                          <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Voir" aria-label={`Voir la page « ${page.title} »`}>
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {page.slug !== effectiveHomeSlug && (
                          <button onClick={() => setAsHome(page)} disabled={savingHome === page.id}
                            className="p-1.5 text-stone-500 hover:text-sage rounded-md hover:bg-sage/10 transition-colors cursor-pointer disabled:opacity-50"
                            title="Définir comme page d'accueil" aria-label={`Faire de « ${page.title} » la page d'accueil`}>
                            {savingHome === page.id ? <Loader2 size={13} className="animate-spin" /> : <Home size={13} />}
                          </button>
                        )}
                        <Link href={`/admin/pages/edit/${page.id}`}
                          className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Modifier" aria-label={`Modifier « ${page.title} »`}>
                          <Pencil size={13} />
                        </Link>
                        <button onClick={() => handleDelete(page)}
                          className="p-1.5 text-stone-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer « ${page.title} »`}>
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
                  <p className="text-[12.5px] text-stone-500 mt-0.5 font-mono">{getPagePath(page.slug)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PageStatusBadge published={page.published} />
                  {page.slug === effectiveHomeSlug && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage/10 text-sage text-[11px] font-medium">
                      <Home size={10} /> Accueil
                    </span>
                  )}
                  <span className="text-[12.5px] text-stone-500">{page.sections.length} section{page.sections.length !== 1 ? 's' : ''}</span>
                  <span className="text-[12.5px] text-stone-500 ml-auto whitespace-nowrap">
                    {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {/* Le nombre de colonnes suit le nombre de boutons réellement rendus. */}
                <div className="grid gap-2 pt-1 grid-cols-2">
                  {page.published && (
                    <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer" aria-label={`Voir la page « ${page.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium active:bg-stone-100 transition-colors">
                      <ExternalLink size={14} /> Voir
                    </a>
                  )}
                  {page.slug !== effectiveHomeSlug && (
                    <button onClick={() => setAsHome(page)} disabled={savingHome === page.id}
                      aria-label={`Faire de « ${page.title} » la page d'accueil`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-medium active:bg-stone-100 transition-colors disabled:opacity-50">
                      {savingHome === page.id ? <Loader2 size={14} className="animate-spin" /> : <Home size={14} />} Accueil
                    </button>
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
      {importOpen && (
        <SiteImportPanel
          onClose={() => setImportOpen(false)}
          onApplySingle={(sections, title) => {
            setImportOpen(false);
            void createFromSections(sections, title);
          }}
        />
      )}

      {templateOpen && (
        <TemplatePicker
          onClose={() => setTemplateOpen(false)}
          onApply={(sections, template) => {
            setTemplateOpen(false);
            void createFromSections(sections, template.name);
          }}
        />
      )}

      {autoGenerateOpen && (
        <AutoGenerateSiteModal
          isOpen={autoGenerateOpen}
          onClose={() => setAutoGenerateOpen(false)}
          onComplete={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}

function PageStatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${published ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
      {published ? <Eye size={10} /> : <EyeOff size={10} />}
      {published ? 'Publié' : 'Brouillon'}
    </span>
  );
}
