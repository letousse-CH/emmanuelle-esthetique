"use client";

import { useEffect, useState } from 'react';

/**
 * `true` quand la page tourne dans la web app installée (raccourci écran
 * d'accueil), `false` dans un onglet de navigateur.
 *
 * Deux détections, parce qu'aucune ne couvre les deux plateformes :
 *  · `display-mode: standalone` — Android/Chrome et les navigateurs de bureau ;
 *  · `navigator.standalone` — Safari iOS, qui n'implémente toujours pas la
 *    media query pour les apps ajoutées à l'écran d'accueil.
 *
 * La valeur initiale est `false` côté serveur comme au premier rendu client.
 * Depuis le shell mobile commun (AdminShell), la navigation est identique dans
 * l'onglet et dans l'app : le mode app ne change que de petits détails, donc
 * rien ne clignote au chargement.
 */
export function useAppMode(): boolean {
  return useAppModeState() === 'app';
}

/**
 * Comme `useAppMode`, mais distingue « pas encore mesuré » (`'unknown'`, rendu
 * serveur et premier rendu client) de « onglet de navigateur » (`'browser'`).
 * Sert aux éléments qui ne doivent apparaître que dans un onglet — par exemple
 * l'invitation à installer l'app — sans jamais s'afficher une fraction de
 * seconde dans l'app installée.
 */
export type AppModeState = 'unknown' | 'app' | 'browser';

export function useAppModeState(): AppModeState {
  const [state, setState] = useState<AppModeState>('unknown');

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const compute = () =>
      setState(
        mql.matches || (window.navigator as { standalone?: boolean }).standalone === true ? 'app' : 'browser',
      );

    compute();
    mql.addEventListener('change', compute);
    return () => mql.removeEventListener('change', compute);
  }, []);

  return state;
}
