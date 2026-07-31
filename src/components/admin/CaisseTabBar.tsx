"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, BookOpenCheck, Users, Sparkles } from 'lucide-react';

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
const TABS = [
  { name: 'Caisse',      path: '/admin/caisse',              icon: CreditCard,    exact: true },
  { name: 'Journal',     path: '/admin/caisse/journal',      icon: BookOpenCheck },
  { name: 'Clientes',    path: '/admin/caisse/clients',      icon: Users },
  { name: 'Prestations', path: '/admin/caisse/prestations',  icon: Sparkles },
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
                  isActive ? 'text-sage' : 'text-stone-400 active:text-stone-700'
                }`}
              >
                <tab.icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium tracking-tight">{tab.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
