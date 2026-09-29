/**
 * Bouton d'appel collé en bas de l'écran, mobile uniquement (`md:hidden`).
 * Ne s'affiche pas tant qu'aucun numéro n'est renseigné dans /admin/settings.
 */
export default function MobileCallBar({ phone }: { phone?: string }) {
  const tel = (phone ?? '').replace(/[^\d+]/g, '');
  if (!tel) return null;

  return (
    <>
      {/* Réserve la hauteur de la barre pour ne pas masquer le pied de page. */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <a
          href={`tel:${tel}`}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-sage px-6 py-3 text-sm font-medium text-white shadow-sm"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Appeler pour réserver
        </a>
      </div>
    </>
  );
}
