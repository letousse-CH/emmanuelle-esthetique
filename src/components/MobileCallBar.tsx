'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Phone } from 'lucide-react';

/**
 * Bouton d'accès rapide collé en bas de l'écran, mobile uniquement (`md:hidden`).
 * Permet de réserver en ligne directement ou d'appeler l'institut.
 * Respecte les jetons de charte du site (data-btn="primary") et la couleur primaire en base.
 * Masqué automatiquement sur la page de réservation pour ne pas encombrer le formulaire.
 */
export default function MobileCallBar({ phone }: { phone?: string }) {
  const pathname = usePathname();
  const tel = (phone ?? '').replace(/[^\d+]/g, '');

  // Ne pas afficher la barre sticky sur la page de réservation elle-même
  if (pathname?.startsWith('/reservation')) {
    return null;
  }

  return (
    <>
      {/* Réserve la hauteur de la barre pour ne pas masquer le pied de page. */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <aside
        aria-label="Réservation rapide"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-paper/95 px-3 pt-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden shadow-lg"
      >
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <Link
            data-btn="primary"
            href="/reservation"
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-sage text-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-sm hover:opacity-90 transition-all"
          >
            <Calendar className="h-4 w-4 shrink-0 text-white/90" />
            <span>Réserver en ligne</span>
          </Link>
          {tel && (
            <a
              data-btn="secondary"
              href={`tel:${tel}`}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-stone-100 px-3.5 py-2.5 text-xs font-medium text-stone-deep shadow-xs hover:bg-stone-200 transition-colors"
              title="Appeler l'institut"
            >
              <Phone className="h-3.5 w-3.5 text-stone-600" />
              <span>Appel</span>
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
