"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, BookOpenCheck, Users, Gift } from 'lucide-react';

/**
 * Navigation basse de la web app Caisse — l'équivalent téléphone de la barre
 * latérale de l'admin, qui est masquée quand la page tourne en mode app.
 *
 * Visible sous `lg`, donc aussi dans un onglet mobile normal : pratique pour
 * essayer l'interface avant de l'installer sur l'écran d'accueil.
 *
 * La hauteur est publiée dans `--caisse-tabbar-h` (voir le layout) pour que la
 * barre d'encaissement de la caisse sache où se poser.
 */
// Quatre onglets au maximum : au-delà, les libellés deviennent illisibles sur
// un écran de téléphone. « Prestations » reste accessible depuis le catalogue
// de l'écran de caisse.
const TABS = [
  { name: 'Caisse',   path: '/admin/caisse',          icon: CreditCard, exact: true },
  { name: 'Journal',  path: '/admin/caisse/journal',  icon: BookOpenCheck },
  { name: 'Bons',     path: '/admin/caisse/bons',     icon: Gift },
  { name: 'Clientes', path: '/admin/caisse/clients',  icon: Users },
];

export default function CaisseTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation de la caisse"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-stone-100 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-16">
        {TABS.map(tab => {
          const isActive = tab.exact
            ? pathname === tab.path
            : pathname.startsWith(tab.path);
          return (
            <li key={tab.path} className="flex-1">
              <Link
                href={tab.path}
                aria-current={isActive ? 'page' : undefined}
                className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-sage' : 'text-stone-500 active:text-stone-700'
                }`}
              >
                <tab.icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[12px] font-medium tracking-tight">{tab.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
