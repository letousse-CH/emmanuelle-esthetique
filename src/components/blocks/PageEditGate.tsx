"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Pencil } from 'lucide-react';
import { supabase } from '../../services/supabase';

// Le code de l'éditeur n'est téléchargé qu'au clic, et seulement par une admin connectée.
const PageBuilder = dynamic(() => import('./editor/PageBuilder'), { ssr: false, loading: () => null });

export default function PageEditGate({ pageId }: { pageId: string }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setIsAdmin(!!data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setIsAdmin(!!s));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1') setOpen(true);
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (open) return <PageBuilder pageId={pageId} mode="overlay" onClose={() => { setOpen(false); window.location.reload(); }} />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="admin-exclude fixed bottom-6 right-6 z-[9990] inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-sky-700"
    >
      <Pencil size={16} /> Modifier cette page
    </button>
  );
}
