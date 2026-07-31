import React from 'react';
import type { Metadata, Viewport } from 'next';
import CaisseTabBar from '../../../components/admin/CaisseTabBar';

/**
 * Layout de la web app « Caisse ».
 *
 * C'est ici — et nulle part ailleurs — qu'est déclaré le manifeste : le site
 * public ne l'annonce pas, donc il ne proposera jamais d'être installé. Seules
 * les pages sous /admin/caisse offrent « Ajouter à l'écran d'accueil ».
 *
 * Ce layout est un composant serveur imbriqué sous /admin/layout.tsx, qui est
 * lui « use client » : c'est permis, un composant serveur passé en `children`
 * traverse un composant client sans être converti.
 */
export const metadata: Metadata = {
  title: 'Caisse',
  manifest: '/admin/caisse/manifest',
  appleWebApp: {
    capable: true,
    title: 'Caisse',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/caisse-192.png',
    apple: '/icons/caisse-apple-180.png',
  },
  // La caisse contient des données clientes : on interdit explicitement
  // l'indexation, même si /admin n'est de toute façon pas atteignable sans
  // session.
  robots: { index: false, follow: false },
  other: {
    // Next n'émet que `mobile-web-app-capable`. Safari lit le manifeste depuis
    // iOS 16.4, mais les iPhone plus anciens ouvriraient l'app avec la barre
    // d'adresse sans cette balise historique — elle ne coûte rien à garder.
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#8A9A7B',
  // `cover` laisse le contenu passer sous l'encoche et la barre d'accueil de
  // l'iPhone ; les `env(safe-area-inset-*)` de la barre d'onglets s'en chargent.
  viewportFit: 'cover',
};

export default function CaisseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      // Hauteur de la barre d'onglets, lue par la barre d'encaissement flottante
      // de l'écran de caisse pour se poser juste au-dessus.
      style={{ ['--caisse-tabbar-h' as string]: '4rem' }}
      className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      {children}
      <CaisseTabBar />
    </div>
  );
}
