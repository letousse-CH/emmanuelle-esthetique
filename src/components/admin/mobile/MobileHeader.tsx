"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, LogOut, Search, Settings } from 'lucide-react';
import SystemHealthPill from '../SystemHealthPill';
import { getRouteInfo } from './nav';
import { useAdminShell } from './shellContext';
import { BottomSheet, ListGroup, ListRow } from './ui';
import InstallCard from './InstallCard';

/**
 * En-tête de l'admin sur téléphone (sous `lg`) : retour automatique sur les
 * sous-pages, titre de l'écran, recherche, état des services, compte.
 * Fixe et compact (56 px + zone sûre haute) ; collé en haut par le shell.
 */
export default function MobileHeader({
  pathname,
  title: titleOverride,
  siteUrl,
}: {
  pathname: string;
  title?: string | null;
  siteUrl: string;
}) {
  const { openSearch, userEmail, logout, appMode } = useAdminShell();
  const [accountOpen, setAccountOpen] = useState(false);
  const info = getRouteInfo(pathname);
  const title = titleOverride || info.title;
  const initial = userEmail?.charAt(0).toUpperCase() ?? 'A';

  return (
    <header className="mobile-header border-b border-stone-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <div className="flex h-14 items-center gap-1 pl-2 pr-2">
        {info.backHref ? (
          <Link
            href={info.backHref}
            aria-label="Retour"
            className="grid size-11 shrink-0 place-items-center rounded-full text-stone-900 transition-colors active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <ArrowLeft size={22} aria-hidden="true" />
          </Link>
        ) : null}
        <p
          className={`min-w-0 flex-1 truncate font-semibold tracking-tight text-stone-950 ${
            info.backHref ? 'text-[19px]' : 'pl-2 text-[24px]'
          }`}
        >
          {title}
        </p>

        <button
          type="button"
          onClick={openSearch}
          aria-label="Rechercher dans l’administration"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-stone-800 transition-colors active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Search size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <SystemHealthPill compact />
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label={userEmail ? `Mon compte (${userEmail})` : 'Mon compte'}
          aria-haspopup="dialog"
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <span className="grid size-9 place-items-center rounded-full bg-accent text-[15px] font-semibold text-accent-fg" aria-hidden="true">
            {initial}
          </span>
        </button>
      </div>

      <BottomSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Mon compte"
        description={userEmail ? `Connectée en tant que ${userEmail}` : undefined}
      >
        <div className="space-y-4">
          {appMode === 'browser' && <InstallCard />}
          <ListGroup label="Compte">
            <ListRow
              href="/admin/settings"
              onClick={() => setAccountOpen(false)}
              leading={<Settings size={21} className="text-stone-700" aria-hidden="true" />}
              title="Paramètres"
            />
            <ListRow
              href={siteUrl}
              external
              chevron={false}
              leading={<ExternalLink size={21} className="text-stone-700" aria-hidden="true" />}
              title="Voir le site"
              trailing={<span className="text-[13px] text-stone-500">Nouvel onglet</span>}
            />
            <ListRow
              onClick={() => {
                setAccountOpen(false);
                void logout();
              }}
              tone="danger"
              chevron={false}
              leading={<LogOut size={21} className="text-red-700" aria-hidden="true" />}
              title="Se déconnecter"
            />
          </ListGroup>
        </div>
      </BottomSheet>
    </header>
  );
}
