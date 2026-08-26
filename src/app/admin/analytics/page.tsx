import React from 'react';
import AnalyticsDashboardClient from './AnalyticsDashboardClient';

export const metadata = {
  title: 'Tableau de Bord & Analytics | Admin Studio',
  description: 'Suivi didactique des visiteurs, clics et taux de conversion de vos pages.',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboardClient />;
}
