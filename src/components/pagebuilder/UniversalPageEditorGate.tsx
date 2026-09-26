"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../services/supabase';

/*
  L'éditeur de page en ligne (`UniversalPageEditor`) et ses dépendances
  (sélecteur de médias, recherche d'images, upload R2…) ne servent qu'à
  l'administratrice connectée — mais le composant vivant dans le layout racine,
  son bundle partait à *chaque* visiteur anonyme, qui le téléchargeait et le
  parsait pour rien (~une bonne part du JS d'hydratation sur mobile).

  Ce portillon ne charge le vrai éditeur qu'une fois une session confirmée.
  Un visiteur non connecté ne récupère jamais ce code.
*/
const UniversalPageEditor = dynamic(() => import('./UniversalPageEditor'), {
  ssr: false,
  loading: () => null,
});

export default function UniversalPageEditorGate() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data?.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!hasSession) return null;
  return <UniversalPageEditor />;
}
