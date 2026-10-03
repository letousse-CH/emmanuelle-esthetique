"use client";

import { useCallback, useEffect, useState } from 'react';

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Invitation à installer l'admin sur l'écran d'accueil.
 *
 *  · Android / Chrome : `beforeinstallprompt` est retenu pour être déclenché au
 *    tap d'un bouton « Installer » ;
 *  · iOS Safari : aucune invite programmable — on affiche la consigne
 *    « Partager → Sur l'écran d'accueil » (`isIOS`).
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    // iPadOS se présente comme un Mac : on regarde aussi les points de contact.
    setIsIOS(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  return { canPrompt: !!deferred, isIOS, prompt };
}
