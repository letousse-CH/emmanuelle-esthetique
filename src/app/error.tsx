'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Filet de sécurité pour toute erreur non rattrapée dans un segment de l'app
 * (page publique comme écran d'admin). Sans ce fichier, Next affiche son écran
 * d'erreur générique — hors charte et sans issue pour le visiteur.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <main className="flex-grow flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl text-stone-deep mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-stone-deep/70 leading-relaxed mb-10">
          La page n&apos;a pas pu s&apos;afficher correctement. Vous pouvez
          réessayer — si le problème persiste, n&apos;hésitez pas à nous
          écrire.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="text-xs tracking-[0.15em] uppercase text-stone-deep border-b border-stone-deep pb-1 hover:text-sage hover:border-sage transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="text-xs tracking-[0.15em] uppercase text-stone-deep/60 border-b border-stone-deep/30 pb-1 hover:text-sage hover:border-sage transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
