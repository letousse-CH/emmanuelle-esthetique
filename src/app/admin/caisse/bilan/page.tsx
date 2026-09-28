import React from 'react';
import BilanClient from './BilanClient';

export const metadata = {
  title: 'Compte de Résultat, AVS & Bilan Fiscal Vaud — Caisse',
  description: 'Pilotage financier complet, calcul des cotisations AVS pour indépendant vaudois, trésorerie et préparation du formulaire fiscal.',
};

export default function BilanPage() {
  return <BilanClient />;
}
