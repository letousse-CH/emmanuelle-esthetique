"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Package, FlaskConical, Receipt, PieChart, Target } from 'lucide-react';

const LINKS = [
  { name: 'Cockpit & Objectifs',   path: '/admin/caisse/cockpit',     icon: Target },
  { name: 'Prestations',          path: '/admin/caisse/prestations', icon: Sparkles },
  { name: 'Produits Vente',       path: '/admin/caisse/produits',    icon: Package },
  { name: 'Stock Cabine & Soins', path: '/admin/caisse/cabine',      icon: FlaskConical },
  { name: 'Factures & Dépenses',  path: '/admin/caisse/depenses',    icon: Receipt },
  { name: 'Bilan & Fiscalité',    path: '/admin/caisse/bilan',       icon: PieChart },
];

export default function CaisseCatalogNav() {
  const pathname = usePathname();

  return (
    // Même rendu que le contrôle segmenté `Tabs` du kit : ce sont deux vues
    // d'un même catalogue, pas deux pages sans rapport.
    <nav aria-label="Catalogue" className="inline-flex gap-1 rounded-lg bg-stone-100 p-1">
      {LINKS.map(l => {
        const isActive = pathname.startsWith(l.path);
        return (
          <Link
            key={l.path}
            href={l.path}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md px-3.5 h-9 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              isActive
                ? 'bg-white text-stone-950 font-semibold shadow-xs ring-1 ring-stone-200'
                : 'text-stone-700 font-medium hover:text-stone-950'
            }`}
          >
            <l.icon size={15} /> {l.name}
          </Link>
        );
      })}
    </nav>
  );
}
