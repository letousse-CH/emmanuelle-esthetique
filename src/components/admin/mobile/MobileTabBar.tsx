"use client";

import React from 'react';
import Link from 'next/link';
import { CalendarDays, CreditCard, Image as ImageIcon, Layers, LayoutGrid, Users, House } from 'lucide-react';
import { activeTabFor, type TabId } from './nav';

type Tab = { id: TabId; name: string; path: string; icon: React.ElementType; center?: boolean; badge?: number };

/**
 * Barre d'onglets basse de l'admin sur téléphone (visible sous `lg`).
 *
 * Cinq entrées, la Caisse au centre, mise en avant. Si le module Caisse est
 * désactivé, Caisse et Clientes cèdent la place à Pages et Médiathèque et
 * l'Agenda prend le centre.
 *
 * La hauteur (4 rem + zone sûre) est publiée par le shell dans
 * `--admin-tabbar-h` : pages, Fab et StickyActionBar s'y réfèrent.
 */
export default function MobileTabBar({
  pathname,
  caisseEnabled,
  toCallCount,
}: {
  pathname: string;
  caisseEnabled: boolean;
  toCallCount: number;
}) {
  const active = activeTabFor(pathname, caisseEnabled);

  const tabs: Tab[] = caisseEnabled
    ? [
        { id: 'home', name: 'Accueil', path: '/admin', icon: House },
        { id: 'agenda', name: 'Agenda', path: '/admin/reservations', icon: CalendarDays, badge: toCallCount },
        { id: 'caisse', name: 'Caisse', path: '/admin/caisse', icon: CreditCard, center: true },
        { id: 'clients', name: 'Clientes', path: '/admin/caisse/clients', icon: Users },
        { id: 'plus', name: 'Plus', path: '/admin/plus', icon: LayoutGrid },
      ]
    : [
        { id: 'home', name: 'Accueil', path: '/admin', icon: House },
        { id: 'pages', name: 'Pages', path: '/admin/pages', icon: Layers },
        { id: 'agenda', name: 'Agenda', path: '/admin/reservations', icon: CalendarDays, center: true, badge: toCallCount },
        { id: 'medias', name: 'Médias', path: '/admin/medias', icon: ImageIcon },
        { id: 'plus', name: 'Plus', path: '/admin/plus', icon: LayoutGrid },
      ];

  return (
    <nav
      aria-label="Sections principales"
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-200 lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const badgeLabel = tab.badge ? `${tab.badge} demande${tab.badge > 1 ? 's' : ''} à appeler` : undefined;
          const common =
            'relative flex h-full min-h-14 w-full flex-col items-center justify-end gap-0.5 pb-1.5 text-[12px] tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60';

          if (tab.center) {
            return (
              <li key={tab.id} className="relative">
                <Link
                  href={tab.path}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={badgeLabel ? `${tab.name}, ${badgeLabel}` : undefined}
                  className={`${common} ${isActive ? 'font-bold text-accent' : 'font-semibold text-accent'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute -top-5 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_6px_16px_rgba(28,25,23,0.25)] ring-4 ring-white transition-transform duration-150 active:scale-95 ${
                      isActive ? 'outline-2 outline-offset-2 outline-accent' : ''
                    }`}
                  >
                    <tab.icon size={26} strokeWidth={2.1} />
                    {tab.badge ? (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[12px] font-bold leading-none text-white ring-2 ring-white">
                        {tab.badge > 99 ? '99+' : tab.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{tab.name}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.id}>
              <Link
                href={tab.path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={badgeLabel ? `${tab.name}, ${badgeLabel}` : undefined}
                className={`${common} justify-center pb-1 transition-colors ${
                  isActive ? 'font-bold text-accent' : 'font-medium text-stone-600 active:text-stone-900'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors ${isActive ? 'bg-accent-soft' : ''}`}
                >
                  <tab.icon size={22} strokeWidth={isActive ? 2.3 : 1.9} />
                  {tab.badge ? (
                    <span className="absolute -top-0.5 right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[12px] font-bold leading-none text-white ring-2 ring-white">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  ) : null}
                </span>
                <span>{tab.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
