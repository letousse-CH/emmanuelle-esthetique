"use client";

import React from 'react';
import { useModuleFlags } from '../../../../hooks/useModuleFlags';
import MobileHomeView from './MobileHomeView';
import { useHomeData } from './homeData';
import type { HomeData } from './homeTypes';

const PLACEHOLDER: HomeData = {
  today: '',
  schedule: { status: 'loading' },
  pending: { status: 'loading' },
  money: { status: 'loading' },
  alerts: { status: 'loading' },
};

/** Accueil de l'application (téléphone) : récupère les données, puis les passe à la vue. */
export default function MobileHome() {
  const flags = useModuleFlags();
  const { data, retry } = useHomeData(flags.caisse);
  return (
    <MobileHomeView
      data={data ?? PLACEHOLDER}
      caisseEnabled={flags.caisse}
      onRetry={retry}
    />
  );
}
