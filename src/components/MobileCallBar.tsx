import Link from 'next/link';

/**
 * Bouton d'accès rapide collé en bas de l'écran, mobile uniquement (`md:hidden`).
 * Permet de réserver en ligne directement ou d'appeler l'institut.
 */
export default function MobileCallBar({ phone }: { phone?: string }) {
  const tel = (phone ?? '').replace(/[^\d+]/g, '');

  return (
    <>
      {/* Réserve la hauteur de la barre pour ne pas masquer le pied de page. */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <aside aria-label="Réservation rapide" className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pt-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <Link
            href="/reservation"
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#183B36] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm hover:bg-[#234E46] transition-colors"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-[#A3B899]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Réserver en ligne
          </Link>
          {tel && (
            <a
              href={`tel:${tel}`}
              className="flex items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-stone-100 px-3.5 py-2.5 text-xs font-medium text-stone-800 shadow-xs hover:bg-stone-200 transition-colors"
              title="Appeler l'institut"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-stone-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Appel</span>
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
