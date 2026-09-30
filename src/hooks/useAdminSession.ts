"use client";

import { useEffect, useState } from 'react';
import { hasStoredSession } from '../services/supabaseLite';

/**
 * Indique si une administratrice est connectée, sans imposer le client Supabase
 * (~215 Ko de JS) aux visiteurs.
 *
 * Une session Supabase laisse une clé `sb-…-auth-token` dans localStorage :
 * sans elle, la réponse est « non » sans rien charger. Avec elle, le vrai
 * client est importé à la demande pour confirmer la session (jeton encore
 * valide) et suivre connexions/déconnexions.
 */
export function useAdminSession(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const attach = () => {
      if (unsubscribe || !hasStoredSession()) return;
      import('../services/supabase').then(({ supabase }) => {
        if (!active) return;
        supabase.auth.getSession().then(({ data }) => {
          if (active) setIsAdmin(!!data?.session);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
          if (active) setIsAdmin(!!session);
        });
        unsubscribe = () => subscription.unsubscribe();
        if (!active) unsubscribe();
      });
    };

    attach();
    // Connexion depuis un autre onglet : la clé apparaît dans localStorage.
    const onStorage = () => attach();
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
      unsubscribe?.();
    };
  }, []);

  return isAdmin;
}
