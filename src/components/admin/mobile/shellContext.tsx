"use client";

import React from 'react';
import type { AppModeState } from '../../../hooks/useAppMode';

/**
 * Ce que le shell de l'admin met à disposition des écrans (téléphone surtout).
 *
 *  · `openSearch()`      ouvre le menu de commandes (⌘K) ;
 *  · `toCallCount`       demandes de rendez-vous à rappeler (pastille de l'agenda) ;
 *  · `appMode`           `'app'` quand l'admin tourne installée sur l'écran d'accueil ;
 *  · `install`           invitation à installer l'app (Android : invite native ; iOS : consigne) ;
 *  · `logout()`          déconnexion ;
 *  · `setPageTitle(t)`   remplace le titre de l'en-tête mobile (écran à titre dynamique) ;
 *  · `userEmail`         e-mail de la personne connectée.
 */
export type AdminShellValue = {
  openSearch: () => void;
  toCallCount: number;
  appMode: AppModeState;
  install: { canPrompt: boolean; isIOS: boolean; prompt: () => Promise<void> };
  logout: () => void | Promise<void>;
  setPageTitle: (title: string | null) => void;
  userEmail: string | null;
};

const noop = () => {};

export const AdminShellContext = React.createContext<AdminShellValue>({
  openSearch: noop,
  toCallCount: 0,
  appMode: 'unknown',
  install: { canPrompt: false, isIOS: false, prompt: async () => {} },
  logout: noop,
  setPageTitle: noop,
  userEmail: null,
});

export function useAdminShell(): AdminShellValue {
  return React.useContext(AdminShellContext);
}

/**
 * Pour un écran dont le titre n'est connu qu'après chargement (« Modifier
 * l'article » → le titre de l'article). `null`/`undefined` : titre par défaut.
 */
export function useMobilePageTitle(title: string | null | undefined) {
  const { setPageTitle } = useAdminShell();
  React.useEffect(() => {
    setPageTitle(title ?? null);
    return () => setPageTitle(null);
  }, [title, setPageTitle]);
}
