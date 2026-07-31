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
 * La valeur initiale est `false` côté serveur comme au premier rendu client :
 * l'admin s'affiche donc avec sa navigation habituelle, puis bascule en mode
 * app après hydratation. C'est volontaire — l'inverse ferait clignoter la
 * barre latérale sur le téléphone.
 */
export function useAppMode(): boolean {
  const [appMode, setAppMode] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const compute = () =>
      setAppMode(mql.matches || (window.navigator as { standalone?: boolean }).standalone === true);

    compute();
    mql.addEventListener('change', compute);
    return () => mql.removeEventListener('change', compute);
  }, []);

  return appMode;
}
