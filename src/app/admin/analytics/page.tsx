import React from 'react';
import AnalyticsDashboardClient from './AnalyticsDashboardClient';

export const metadata = {
  title: 'Statistiques | Administration',
  description: 'Pages consultées, clics sur les boutons et demandes de contact reçues.',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboardClient />;
}
