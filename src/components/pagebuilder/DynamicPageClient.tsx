"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil } from 'lucide-react';
import DynamicPageRenderer from './DynamicPageRenderer';
import InlinePageEditor from './InlinePageEditor';
import { fetchPageBySlug } from '../../services/dynamicPages';
import type { DynamicPage as DynamicPageType } from '../../services/dynamicPages';
import { supabase } from '../../services/supabase';
import { seedPageBySlug } from '../../services/seeder';

interface DynamicPageClientProps {
  initialPage: DynamicPageType | null;
  slug: string;
  fallback?: React.ReactNode;
  forceShow?: boolean;
}

export default function DynamicPageClient({ initialPage, slug, fallback, forceShow }: DynamicPageClientProps) {
  const [page, setPage] = useState<DynamicPageType | null>(initialPage);
  const [loading, setLoading] = useState(!initialPage && !fallback);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Check session first, then refetch if admin to get draft contents
    supabase.auth.getSession().then(({ data }) => {
      const admin = !!data.session;
      setIsAdmin(admin);
      
      const shouldShowLoader = !initialPage && !fallback;
      if (admin || !initialPage) {
        if (shouldShowLoader) {
          setLoading(true);
        }
        fetchPageBySlug(slug, admin || !!forceShow).then((p) => {
          if (p) {
            setPage(p);
          } else if (slug === 'home') {
            fetchPageBySlug('accueil', admin || !!forceShow).then((p2) => {
              if (p2) setPage(p2);
            });
          } else if (!initialPage) {
            setPage(null);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const admin = !!session;
      setIsAdmin(admin);
      if (admin) {
        // Refetch draft version silencieusement
        fetchPageBySlug(slug, true).then((p) => {
          if (p) {
            setPage(p);
          } else if (slug === 'home') {
            fetchPageBySlug('accueil', true).then((p2) => {
              if (p2) setPage(p2);
            });
          } else if (!page) {
            setPage(null);
          }
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [slug, initialPage, fallback]);

  const handleCreatePage = async () => {
    setCreating(true);
    try {
      const newPage = await seedPageBySlug(slug);
      setPage(newPage);
      alert("Page initialisée avec succès dans le CMS ! Vous pouvez maintenant la modifier.");
    } catch (err: any) {
      console.error("Error creating page:", err);
      alert(
        "Erreur lors de la création de la page dans la base de données.\n\n" +
        "Si vous travaillez en local, vérifiez que vous avez configuré la variable SUPABASE_SERVICE_ROLE_KEY dans votre fichier .env pour activer la synchronisation de l'authentification locale, ou connectez-vous avec un compte administrateur Supabase."
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-stone-500" size={32} />
      </div>
    );
  }

  if (!page) {
    if (fallback) {
      return (
        <>
          {fallback}
          {isAdmin && (
            <button
              onClick={handleCreatePage}
              disabled={creating}
              className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm font-bold hover:bg-stone-900 transition-colors duration-300 disabled:opacity-50 cursor-pointer"
            >
              {creating ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Pencil size={15} />
              )}
              Activer l'éditeur pour cette page
            </button>
          )}
        </>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-stone-500 gap-4">
        <p className="font-serif text-4xl font-light">Page introuvable</p>
        <Link href="/" className="text-stone-900 hover:underline text-sm">← Retour à l'accueil</Link>
      </div>
    );
  }

  const [isEditMode, setIsEditMode] = useState(true);

  return (
    <>
      {isAdmin && isEditMode ? (
        <InlinePageEditor
          pageId={page.id}
          initialSections={page.sections}
          onExit={() => setIsEditMode(false)}
        />
      ) : (
        <>
          <DynamicPageRenderer sections={page.sections} />
          {isAdmin && !isEditMode && (
            <div className="fixed bottom-6 left-6 z-[9990] flex items-center gap-2 bg-zinc-900/95 text-white px-3.5 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-zinc-700/80 backdrop-blur-md text-xs font-bold select-none animate-in slide-in-from-bottom duration-300">
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-full transition-all hover:scale-105 cursor-pointer shadow-xs"
                title="Réactiver l'édition en direct sur cette page"
              >
                <Pencil size={12} className="text-white" />
                <span>Mode Édition</span>
              </button>

              <div className="h-4 w-px bg-zinc-700 my-auto" />

              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white rounded-full transition-all hover:scale-105 cursor-pointer font-bold"
                title="Retourner au tableau de bord d'administration"
              >
                <span>Admin</span>
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
