"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Loader2, Pencil } from 'lucide-react';
import type { DynamicPage as DynamicPageType } from '../../services/dynamicPages';
import { hasStoredSession } from '../../services/supabaseLite';

/*
  Ce composant est monté par /mentions-legales et /politique-cookies, que le
  pied de page de *chaque* page publique pointe : Next.js préchauffe donc leur
  graphe de modules pour tout visiteur. En important ici directement le moteur
  de sections Studio, l'éditeur en ligne, le semeur de pages et le client
  Supabase, on leur faisait télécharger ~330 Ko de JS et ~95 Ko de CSS sans
  jamais s'en servir. Tout ce qui est lourd est donc chargé à la demande.
*/
const DynamicPageRenderer = dynamic(() => import('./DynamicPageRenderer'), { ssr: true });
const InlinePageEditor = dynamic(() => import('./InlinePageEditor'), { ssr: false });

const loadDynamicPages = () => import('../../services/dynamicPages');
const fetchPageBySlug = (slug: string, includeDrafts?: boolean) =>
  loadDynamicPages().then((m) => m.fetchPageBySlug(slug, includeDrafts));

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
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const shouldShowLoader = !initialPage && !fallback;

    // Visiteur sans session : ni client Supabase ni abonnement aux connexions
    // n'ont à être chargés — on ne relit la page que si le serveur n'a rien fourni.
    const anonymous = () => {
      if (!initialPage) {
        if (shouldShowLoader) setLoading(true);
        fetchPageBySlug(slug, !!forceShow).then((p) => {
          if (!active) return;
          if (p) setPage(p);
          else if (slug === 'home') fetchPageBySlug('accueil', !!forceShow).then((p2) => { if (active && p2) setPage(p2); });
          else setPage(null);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };

    const withSession = () => {
      import('../../services/supabase').then(({ supabase }) => {
        if (!active) return;
        // Check session first, then refetch if admin to get draft contents
        supabase.auth.getSession().then(({ data }) => {
          if (!active) return;
          const admin = !!data.session;
          setIsAdmin(admin);

          if (admin || !initialPage) {
            if (shouldShowLoader) {
              setLoading(true);
            }
            fetchPageBySlug(slug, admin || !!forceShow).then((p) => {
              if (!active) return;
              if (p) {
                setPage(p);
              } else if (slug === 'home') {
                fetchPageBySlug('accueil', admin || !!forceShow).then((p2) => {
                  if (active && p2) setPage(p2);
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
              if (!active) return;
              if (p) {
                setPage(p);
              } else if (slug === 'home') {
                fetchPageBySlug('accueil', true).then((p2) => {
                  if (active && p2) setPage(p2);
                });
              } else if (!page) {
                setPage(null);
              }
            });
          }
        });
        unsubscribe = () => subscription.unsubscribe();
        if (!active) unsubscribe();
      });
    };

    if (hasStoredSession()) {
      withSession();
    } else {
      anonymous();
    }

    // Connexion depuis un autre onglet : la clé de session apparaît dans localStorage.
    const onStorage = () => {
      if (!unsubscribe && hasStoredSession()) withSession();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
      unsubscribe?.();
    };
  }, [slug, initialPage, fallback]);

  const handleCreatePage = async () => {
    setCreating(true);
    try {
      const { seedPageBySlug } = await import('../../services/seeder');
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
        <DynamicPageRenderer sections={page.sections} />
      )}
    </>
  );
}
