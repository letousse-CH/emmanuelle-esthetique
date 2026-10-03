import React from 'react';
import type { Metadata, Viewport } from 'next';
import './admin.css';
import AdminShell from './AdminShell';

/**
 * Layout de l'admin : composant serveur qui porte les métadonnées de la web app,
 * et délègue tout l'interface (client) à `AdminShell`.
 *
 * C'est ici — et nulle part ailleurs — qu'est déclaré le manifeste : le site
 * public ne l'annonce pas, donc il ne proposera jamais d'être installé. Les
 * pages sous /admin offrent « Ajouter à l'écran d'accueil ».
 */
export const metadata: Metadata = {
  title: 'Gestion',
  manifest: '/admin/manifest',
  appleWebApp: {
    capable: true,
    title: 'Gestion',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/caisse-192.png',
    apple: '/icons/caisse-apple-180.png',
  },
  // L'admin contient des données clientes : on interdit explicitement
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
  // l'iPhone ; les `env(safe-area-inset-*)` de l'en-tête et de la barre
  // d'onglets s'en chargent.
  viewportFit: 'cover',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
