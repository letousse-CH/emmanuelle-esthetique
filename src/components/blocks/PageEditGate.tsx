"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LayoutDashboard, Pencil } from 'lucide-react';
import { useAdminSession } from '../../hooks/useAdminSession';

// Le code de l'éditeur n'est téléchargé qu'au clic, et seulement par une admin connectée.
const PageBuilder = dynamic(() => import('./editor/PageBuilder'), { ssr: false, loading: () => null });

export default function PageEditGate({ pageId }: { pageId: string }) {
  const isAdmin = useAdminSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1') setOpen(true);
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (open) return <PageBuilder pageId={pageId} mode="overlay" onClose={() => { setOpen(false); window.location.reload(); }} />;
  return (
    <div className="admin-exclude fixed bottom-6 right-6 z-[9990] flex items-center gap-2">
      {/* Retour à l'administration, à côté de l'édition : le pendant du « Voir le site » de l'admin. */}
      <a
        href="/admin"
        className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-stone-700"
      >
        <LayoutDashboard size={16} /> Administration
      </a>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-sky-700"
      >
        <Pencil size={16} /> Modifier cette page
      </button>
    </div>
  );
}
