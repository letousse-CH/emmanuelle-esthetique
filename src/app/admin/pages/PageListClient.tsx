"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Loader2, Database, Globe, LayoutTemplate, Home, Sparkles, FileText } from 'lucide-react';
import { PageHeader, Button, LinkButton, EmptyState, Callout } from '../../../components/admin/ui';
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

import { useModuleFlags } from '../../../hooks/useModuleFlags';

export default function PageList() {
  const router = useRouter();
  const moduleFlags = useModuleFlags();
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
  const [pages, setPages]     = useState<DynamicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [homeSlug, setHomeSlug] = useState('');
  const [savingHome, setSavingHome] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  /*
    Slug effectivement servi à la racine : le réglage s'il existe, sinon le
    premier nom historique réellement présent — c'est ce que fait le serveur.
  */
  const effectiveHomeSlug =
    homeSlug || LEGACY_HOME_SLUGS.find((s) => pages.some((p) => p.slug === s)) || '';

  const getPagePath = (slug: string) => (slug === effectiveHomeSlug ? '/' : `/${slug}`);

  const setAsHome = async (page: DynamicPage) => {
    setSavingHome(page.id);
    setNotice(null);
    const { error } = await supabase
      .from('settings')
      .upsert([{ key: HOME_SLUG_KEY, value: page.slug }], { onConflict: 'key' });
    setSavingHome(null);
    if (error) {
      setNotice({ tone: 'danger', text: `La page d'accueil n'a pas pu être changée (${error.message}). Vérifiez votre connexion puis réessayez.` });
      return;
    }
    setHomeSlug(page.slug);
    setNotice({ tone: 'success', text: `« ${page.title} » est maintenant la page d'accueil du site.` });
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
      setNotice({ tone: 'danger', text: `La page n'a pas pu être créée (${error?.message ?? 'erreur inconnue'}). Réessayez dans un instant.` });
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
    const isHome = page.slug === effectiveHomeSlug;
    const warning = isHome
      ? `« ${page.title} » est la page d'accueil du site. Si vous la supprimez, l'adresse principale du site n'affichera plus rien tant que vous n'aurez pas choisi une autre page d'accueil.\n\nSupprimer définitivement cette page ?`
      : `Supprimer définitivement la page « ${page.title} » ? Elle disparaîtra du site et ne pourra pas être récupérée.`;
    if (!confirm(warning)) return;
    setNotice(null);
    try {
      await deletePage(page.id);
      setPages(prev => prev.filter(p => p.id !== page.id));
      setNotice({ tone: 'success', text: `La page « ${page.title} » a été supprimée.` });
    } catch (err) {
      console.error(err);
      setNotice({ tone: 'danger', text: `La page « ${page.title} » n'a pas pu être supprimée. Vérifiez votre connexion puis réessayez.` });
    }
  };

  /*
    Recrée les pages d'exemple (accueil « home », « a-propos », « contact »).
    Attention : si une page porte déjà l'une de ces adresses, son contenu est
    remplacé. La confirmation le dit en toutes lettres.
  */
  const handleSeed = async () => {
    const ok = confirm(
      "Les pages d'exemple (Accueil /home, À propos /a-propos, Contact /contact) vont être créées.\n\n" +
      "Si l'une de ces pages existe déjà, son contenu actuel sera remplacé par le contenu d'exemple et vos modifications seront perdues.\n\nContinuer ?"
    );
    if (!ok) return;
    setSeeding(true);
    setNotice(null);
    try {
      await seedDefaultPages();
      await load();
      setNotice({ tone: 'success', text: "Les pages d'exemple ont été créées." });
    } catch (err) {
      console.error(err);
      setNotice({ tone: 'danger', text: "Les pages d'exemple n'ont pas pu être créées. Réessayez dans un instant." });
    } finally { setSeeding(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages du site"
        description="Créez les pages de votre site, choisissez celle qui sert d'accueil et publiez-les quand elles sont prêtes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" icon={LayoutTemplate} onClick={() => setTemplateOpen(true)}>
              Partir d'un modèle
            </Button>
            <Button type="button" variant="secondary" icon={Globe} onClick={() => setImportOpen(true)}>
              Importer un site
            </Button>
            {moduleFlags.ai_generation && (
              <Button type="button" variant="secondary" icon={Sparkles} onClick={() => setAutoGenerateOpen(true)}>
                Créer le site automatiquement
              </Button>
            )}
            <Button type="button" variant="ghost" icon={seeding ? undefined : Database} loading={seeding} onClick={handleSeed}>
              Pages d'exemple
            </Button>
            <LinkButton href="/admin/pages/new" variant="primary" icon={Plus}>
              Nouvelle page
            </LinkButton>
          </div>
        }
      />

      {notice && (
        <Callout tone={notice.tone}>
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-[13px] font-semibold underline underline-offset-2 cursor-pointer">
              Fermer
            </button>
          </span>
        </Callout>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-accent animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune page pour l'instant"
          description="Créez votre première page, ou partez d'un modèle pour avoir une mise en page déjà prête."
          action={<LinkButton href="/admin/pages/new" variant="primary" icon={Plus}>Nouvelle page</LinkButton>}
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {/* Tableau — écrans sm et plus */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/50">
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-700 text-left">Titre</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-700 text-left">Adresse</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-700 text-left">Sections</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-700 text-left">Statut</th>
                  <th className="px-6 py-3.5 text-[12px] font-semibold uppercase tracking-wide text-stone-700 text-left">Modifiée le</th>
                  <th className="px-6 py-3.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-stone-900">{page.title}</td>
                    <td className="px-6 py-4 font-mono text-[13px] text-stone-600">
                      <span className="inline-flex items-center gap-1.5">
                        {getPagePath(page.slug)}
                        {page.slug === effectiveHomeSlug && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[12px] font-sans font-medium">
                            <Home size={12} /> Accueil
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-700">{page.sections.length}</td>
                    <td className="px-6 py-4">
                      <PageStatusBadge published={page.published} />
                    </td>
                    <td className="px-6 py-4 text-[13px] text-stone-600 whitespace-nowrap">
                      {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        {page.published && (
                          <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer"
                            className="p-2 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Voir" aria-label={`Voir la page « ${page.title} »`}>
                            <ExternalLink size={15} />
                          </a>
                        )}
                        {page.slug !== effectiveHomeSlug && (
                          <button onClick={() => setAsHome(page)} disabled={savingHome === page.id}
                            className="p-2 text-stone-600 hover:text-accent rounded-md hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50"
                            title="Définir comme page d'accueil" aria-label={`Faire de « ${page.title} » la page d'accueil`}>
                            {savingHome === page.id ? <Loader2 size={15} className="animate-spin" /> : <Home size={15} />}
                          </button>
                        )}
                        <Link href={`/admin/pages/edit/${page.id}`}
                          className="p-2 text-stone-600 hover:text-stone-900 rounded-md hover:bg-stone-100 transition-colors" title="Modifier" aria-label={`Modifier « ${page.title} »`}>
                          <Pencil size={15} />
                        </Link>
                        <button onClick={() => handleDelete(page)}
                          className="p-2 text-stone-600 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer" title="Supprimer" aria-label={`Supprimer « ${page.title} »`}>
                          <Trash2 size={15} />
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
            {pages.map(page => (
              <div key={page.id} className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-stone-900 leading-snug">{page.title}</p>
                  <p className="text-[13px] text-stone-600 mt-0.5 font-mono">{getPagePath(page.slug)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PageStatusBadge published={page.published} />
                  {page.slug === effectiveHomeSlug && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-[12px] font-medium">
                      <Home size={12} /> Accueil
                    </span>
                  )}
                  <span className="text-[13px] text-stone-600">{page.sections.length} section{page.sections.length !== 1 ? 's' : ''}</span>
                  <span className="text-[13px] text-stone-600 ml-auto whitespace-nowrap">
                    {new Date(page.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="grid gap-2 pt-1 grid-cols-2">
                  {page.published && (
                    <a href={getPagePath(page.slug)} target="_blank" rel="noopener noreferrer" aria-label={`Voir la page « ${page.title} »`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold active:bg-stone-200 transition-colors">
                      <ExternalLink size={14} /> Voir
                    </a>
                  )}
                  {page.slug !== effectiveHomeSlug && (
                    <button onClick={() => setAsHome(page)} disabled={savingHome === page.id}
                      aria-label={`Faire de « ${page.title} » la page d'accueil`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold active:bg-stone-200 transition-colors disabled:opacity-50">
                      {savingHome === page.id ? <Loader2 size={14} className="animate-spin" /> : <Home size={14} />} Mettre en accueil
                    </button>
                  )}
                  <Link href={`/admin/pages/edit/${page.id}`} aria-label={`Modifier « ${page.title} »`}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-stone-100 text-stone-900 text-[13px] font-semibold active:bg-stone-200 transition-colors">
                    <Pencil size={14} /> Modifier
                  </Link>
                  <button onClick={() => handleDelete(page)} aria-label={`Supprimer « ${page.title} »`}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-red-200 text-red-700 text-[13px] font-semibold active:bg-red-50 transition-colors cursor-pointer">
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${published ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
      {published ? <Eye size={12} /> : <EyeOff size={12} />}
      {published ? 'Publié' : 'Brouillon'}
    </span>
  );
}
