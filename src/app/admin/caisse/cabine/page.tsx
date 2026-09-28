import React from 'react';
import CabineStockClient from './CabineStockClient';

export const metadata = {
  title: 'Stock Cabine & Coût de Revient des Soins — Caisse',
  description: 'Gestion du stock professionnel cabine (Phytomer grand format) et calcul du coût matière par prestation.',
};

export default function CabinePage() {
  return <CabineStockClient />;
}
