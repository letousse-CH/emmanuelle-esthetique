import React from 'react';

/**
 * Layout de la Caisse.
 *
 * Le manifeste, les métadonnées de web app, la barre d'onglets et la
 * sous-navigation (`CaisseSubNav`) vivent dans le shell global de l'admin
 * (`app/admin/layout.tsx` + `AdminShell.tsx`).
 *
 * `--caisse-tabbar-h`, lue par la barre d'encaissement flottante de
 * `CaisseClient` pour se poser au-dessus de la barre d'onglets, est publiée par
 * le shell (voir `admin.css`) — ne pas la redéfinir ici.
 */
export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
