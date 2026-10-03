"use client";

import React, { useMemo, useState } from 'react';
import { ExternalLink, LogOut, Search, SearchX, Settings, X } from 'lucide-react';
import { useModuleFlags } from '../../../hooks/useModuleFlags';
import { SITE_CONFIG } from '../../../config/site';
import { buildPlusGroups, type PlusEntry } from '../../../components/admin/mobile/nav';
import { useAdminShell } from '../../../components/admin/mobile/shellContext';
import { ActionTile, EmptyState, PageSection } from '../../../components/admin/mobile/ui';
import InstallCard from '../../../components/admin/mobile/InstallCard';

/**
 * Écran « Plus » : tout le reste de l'admin, en grosses tuiles rangées par
 * usage. Les groupes viennent de la même source que la barre latérale
 * (`components/admin/mobile/nav.ts`) — une entrée ajoutée là apparaît ici.
 */

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function PlusPage() {
  const flags = useModuleFlags();
  const { toCallCount, logout } = useAdminShell();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => buildPlusGroups(flags, toCallCount), [flags, toCallCount]);

  const q = fold(query.trim());
  const visible = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => fold(`${e.name} ${e.description ?? ''} ${g.label}`).includes(q)),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, q]);

  const settingsMatches = !q || fold('paramètres réglages voir le site se déconnecter déconnexion').includes(q);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <h1 className="sr-only">Plus d’outils</h1>

      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un outil…"
          aria-label="Chercher un outil"
          enterKeyHint="search"
          autoComplete="off"
          className="h-13 w-full rounded-2xl border border-stone-300 bg-white pl-12 pr-12 text-[16px] text-stone-900 placeholder:text-stone-500 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Effacer la recherche"
            className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-stone-600 active:bg-stone-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {!q && <InstallCard />}

      {visible.map((group) => (
        <PageSection key={group.label} title={group.label}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.entries.map((e) => (
              <Tile key={e.id} entry={e} />
            ))}
          </div>
        </PageSection>
      ))}

      {settingsMatches && (
        <PageSection title="Réglages">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ActionTile icon={Settings} title="Paramètres" subtitle="Entreprise, design, modules" href="/admin/settings" />
            <ActionTile icon={ExternalLink} title="Voir le site" subtitle="S’ouvre dans un nouvel onglet" href={SITE_CONFIG.url} external />
            <ActionTile icon={LogOut} title="Se déconnecter" tone="danger" onClick={() => void logout()} />
          </div>
        </PageSection>
      )}

      {q && visible.length === 0 && !settingsMatches && (
        <EmptyState icon={SearchX} title="Aucun outil trouvé" description={`Rien ne correspond à « ${query.trim()} ». Essayez un autre mot.`} />
      )}
    </div>
  );
}

function Tile({ entry }: { entry: PlusEntry }) {
  return (
    <ActionTile
      icon={entry.icon}
      title={entry.name}
      subtitle={entry.description}
      href={entry.path}
      badge={entry.badge}
      badgeLabel={entry.badge ? `${entry.badge} demande${entry.badge > 1 ? 's' : ''} à appeler` : undefined}
      hint={entry.heavy ? 'Plutôt sur ordinateur' : undefined}
    />
  );
}
