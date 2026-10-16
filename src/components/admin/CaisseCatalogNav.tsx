"use client";

import React from 'react';
import { Sparkles, Package, FlaskConical } from 'lucide-react';
import { SubNav } from './ui';

/**
 * Les trois vues du catalogue : ce que l'on facture (prestations), ce que l'on
 * revend (produits) et ce que l'on consomme en cabine. Cockpit, dépenses et
 * bilan ont leur propre entrée dans le menu : les répéter ici doublait la
 * navigation sans rien apprendre de plus.
 */
const LINKS = [
  { label: 'Prestations', href: '/admin/caisse/prestations', icon: Sparkles },
  { label: 'Produits vente', href: '/admin/caisse/produits', icon: Package },
  { label: 'Stock cabine', href: '/admin/caisse/cabine', icon: FlaskConical },
];

export default function CaisseCatalogNav() {
  return <SubNav items={LINKS} label="Catalogue" />;
}
