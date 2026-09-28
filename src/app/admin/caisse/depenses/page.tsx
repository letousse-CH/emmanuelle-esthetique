import React from 'react';
import DepensesClient from './DepensesClient';

export const metadata = {
  title: 'Factures, Dépenses & Achats Fournisseurs — Caisse',
  description: 'Enregistrement des factures fournisseurs, réassort du stock cabine/vente et classement des charges selon le plan comptable suisse.',
};

export default function DepensesPage() {
  return <DepensesClient />;
}
