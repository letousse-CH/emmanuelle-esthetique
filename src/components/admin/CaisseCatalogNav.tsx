"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Package } from 'lucide-react';

/**
 * Bascule entre les deux moitiés du catalogue : ce qui se fait (prestations et
 * forfaits) et ce qui se vend (marchandise).
 *
 * Elle existe parce que la barre d'onglets de la web app n'a que quatre places
 * et que la barre latérale de l'admin disparaît en mode app : sans ce lien,
 * l'écran produits serait inatteignable depuis un téléphone.
 */
const LINKS = [
  { name: 'Prestations', path: '/admin/caisse/prestations', icon: Sparkles },
  { name: 'Produits',    path: '/admin/caisse/produits',    icon: Package },
];

export default function CaisseCatalogNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Catalogue" className="flex gap-1.5">
      {LINKS.map(l => {
        const isActive = pathname.startsWith(l.path);
        return (
          <Link
            key={l.path}
            href={l.path}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isActive
                ? 'border-sage bg-sage/8 text-sage'
                : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            <l.icon size={13} /> {l.name}
          </Link>
        );
      })}
    </nav>
  );
}
