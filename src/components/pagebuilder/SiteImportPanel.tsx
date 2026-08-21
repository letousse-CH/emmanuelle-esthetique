'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Globe,
  Layers,
  Loader2,
  XCircle,
} from 'lucide-react';

import { supabase } from '../../services/supabase';
import type { PageSection } from './wireframes.config';

/**
 * Import d'un site existant, page par page.
 *
 * Trois temps : on explore le site, l'utilisateur coche ce qu'il veut, puis
 * chaque page est reconstruite l'une après l'autre.
 *
 * Le traitement est **séquentiel et non parallèle**. C'est délibéré : chaque
 * page consomme un appel au modèle, et lancer quinze requêtes simultanées
 * ferait exploser la note tout en risquant la limitation de débit. Une par une,
 * on voit l'avancement et on peut arrêter en cours de route.
 */

type Kind = 'page' | 'article';

interface Discovered {
  url: string;
  path: string;
  kind: Kind;
  title?: string;
  lastmod?: string;
}

interface RowState {
  status: 'pending' | 'working' | 'done' | 'error';
  message?: string;
  sections?: number;
}

export default function SiteImportPanel({
  onApplySingle,
  onClose,
}: {
  /** Applique une page unique au brouillon ouvert dans le constructeur. */
  onApplySingle: (sections: PageSection[], pageTitle: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<'input' | 'exploring' | 'choose' | 'importing' | 'done'>('input');
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [source, setSource] = useState<'sitemap' | 'links' | 'none'>('none');
  const [pages, setPages] = useState<Discovered[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const abortRef = React.useRef(false);

  const counts = useMemo(
    () => ({
      pages: pages.filter((p) => p.kind === 'page').length,
      articles: pages.filter((p) => p.kind === 'article').length,
    }),
    [pages],
  );

  async function headers() {
    const { data } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    };
  }

  async function explore() {
    if (!url.trim()) return;
    setError(null);
    setPhase('exploring');

    try {
      const response = await fetch('/api/import-site/discover', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? 'Exploration impossible.');
        setPhase('input');
        return;
      }
      setOrigin(payload.origin);
      setSource(payload.source);
      setPages(payload.pages);
      // Les pages de structure sont pré-cochées, pas les articles : reprendre
      // trente billets de blog est rarement ce qu'on veut d'emblée.
      setSelected(new Set(payload.pages.filter((p: Discovered) => p.kind === 'page').map((p: Discovered) => p.url)));
      setPhase('choose');
    } catch {
      setError('La connexion a échoué.');
      setPhase('input');
    }
  }

  function toggle(target: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  function selectGroup(kind: Kind | 'all' | 'none') {
    if (kind === 'none') return setSelected(new Set());
    if (kind === 'all') return setSelected(new Set(pages.map((p) => p.url)));
    setSelected(new Set(pages.filter((p) => p.kind === kind).map((p) => p.url)));
  }

  async function runImport() {
    abortRef.current = false;
    setPhase('importing');
    const targets = pages.filter((p) => selected.has(p.url));
    const h = await headers();

    for (const target of targets) {
      if (abortRef.current) break;
      setRows((r) => ({ ...r, [target.url]: { status: 'working' } }));

      try {
        const response = await fetch('/api/import-site', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ url: target.url }),
        });
        const payload = await response.json();

        if (!response.ok) {
          setRows((r) => ({
            ...r,
            [target.url]: { status: 'error', message: payload?.error ?? 'Échec' },
          }));
          continue;
        }

        // Une seule page choisie et un brouillon ouvert : on la charge dans le
        // constructeur plutôt que de créer une page de plus.
        if (targets.length === 1) {
          onApplySingle(payload.sections, payload.pageTitle);
          setRows((r) => ({ ...r, [target.url]: { status: 'done', sections: payload.sections.length } }));
          setPhase('done');
          return;
        }

        const slug =
          target.path === '/' ? 'accueil-importe' : target.path.replace(/^\/|\/$/g, '').replace(/\//g, '-');

        const { error: insertError } = await supabase.from('dynamic_pages').insert({
          title: payload.pageTitle || target.title || slug,
          slug,
          sections: payload.sections,
          // Jamais publié d'office : ces contenus doivent être relus avant
          // d'apparaître sur le site.
          published: false,
        });

        setRows((r) => ({
          ...r,
          [target.url]: insertError
            ? { status: 'error', message: insertError.message }
            : { status: 'done', sections: payload.sections.length },
        }));
      } catch {
        setRows((r) => ({ ...r, [target.url]: { status: 'error', message: 'Erreur réseau' } }));
      }
    }

    setPhase('done');
  }

  const doneCount = Object.values(rows).filter((r) => r.status === 'done').length;
  const errorCount = Object.values(rows).filter((r) => r.status === 'error').length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Importer un site" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] cursor-default" />

      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col bg-white shadow-2xl">
        <header className="border-b border-stone-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Globe size={18} className="text-stone-500" />
            Importer un site existant
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {phase === 'choose' || phase === 'importing' || phase === 'done'
              ? origin
              : "On explore le site, vous choisissez ce qu'on reprend."}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Saisie ─────────────────────────────────────────────────── */}
          {(phase === 'input' || phase === 'exploring') && (
            <>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && phase === 'input' && explore()}
                  placeholder="exemple.ch"
                  disabled={phase === 'exploring'}
                  className="flex-1 border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:outline-none disabled:bg-stone-50"
                />
                <button
                  type="button"
                  onClick={() => void explore()}
                  disabled={phase === 'exploring' || !url.trim()}
                  className="flex items-center gap-2 bg-stone-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-stone-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  {phase === 'exploring' ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
                  Explorer
                </button>
              </div>
              {phase === 'exploring' && (
                <p className="mt-4 text-sm text-stone-600">
                  Lecture du plan de site, puis des liens de la page d&apos;accueil…
                </p>
              )}
            </>
          )}

          {/* ── Sélection ──────────────────────────────────────────────── */}
          {phase === 'choose' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                <p className="text-sm text-stone-500">
                  <strong className="text-stone-800">{pages.length}</strong> adresses trouvées
                  {' · '}
                  {counts.pages} pages, {counts.articles} articles
                  <span className="text-stone-500">
                    {' '}
                    ({source === 'sitemap' ? 'plan du site' : 'liens de la page d’accueil'})
                  </span>
                </p>
                <div className="flex gap-1 text-xs">
                  {[
                    { key: 'all' as const, label: 'Tout' },
                    { key: 'page' as const, label: 'Pages' },
                    { key: 'article' as const, label: 'Articles' },
                    { key: 'none' as const, label: 'Rien' },
                  ].map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => selectGroup(b.key)}
                      className="border border-stone-200 px-2.5 py-1 text-stone-500 transition-colors hover:border-stone-400 cursor-pointer"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <ul className="mt-3 space-y-1">
                {pages.map((page) => (
                  <li key={page.url}>
                    <label className="flex cursor-pointer items-center gap-3 border border-stone-100 px-3 py-2 transition-colors hover:border-stone-300">
                      <input
                        type="checkbox"
                        checked={selected.has(page.url)}
                        onChange={() => toggle(page.url)}
                        className="size-4 shrink-0 accent-stone-900"
                      />
                      {page.kind === 'article' ? (
                        <FileText size={14} className="shrink-0 text-stone-500" />
                      ) : (
                        <Layers size={14} className="shrink-0 text-stone-500" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-stone-800">
                          {page.title || page.path}
                        </span>
                        <span className="block truncate text-[12.5px] text-stone-500">{page.path}</span>
                      </span>
                      <span className="shrink-0 text-[12px] tracking-wider text-stone-500 uppercase">
                        {page.kind === 'article' ? 'article' : 'page'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ── Import en cours / terminé ──────────────────────────────── */}
          {(phase === 'importing' || phase === 'done') && (
            <>
              <p className="mb-4 text-sm text-stone-500">
                {phase === 'importing'
                  ? `Reconstruction en cours — ${doneCount + errorCount} sur ${selected.size}.`
                  : `Terminé : ${doneCount} page${doneCount > 1 ? 's' : ''} créée${doneCount > 1 ? 's' : ''}${errorCount ? `, ${errorCount} en échec` : ''}.`}
              </p>

              <ul className="space-y-1">
                {pages
                  .filter((p) => selected.has(p.url))
                  .map((page) => {
                    const state = rows[page.url];
                    return (
                      <li
                        key={page.url}
                        className="flex items-center gap-3 border border-stone-100 px-3 py-2 text-sm"
                      >
                        {state?.status === 'working' && (
                          <Loader2 size={14} className="shrink-0 animate-spin text-stone-500" />
                        )}
                        {state?.status === 'done' && (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        )}
                        {state?.status === 'error' && (
                          <XCircle size={14} className="shrink-0 text-red-500" />
                        )}
                        {!state && <span className="size-3.5 shrink-0 border border-stone-200" />}

                        <span className="min-w-0 flex-1 truncate text-stone-700">{page.path}</span>

                        <span className="shrink-0 text-[12.5px] text-stone-500">
                          {state?.status === 'done' && `${state.sections} sections`}
                          {state?.status === 'error' && state.message}
                        </span>
                      </li>
                    );
                  })}
              </ul>

              {phase === 'done' && doneCount > 0 && (
                <p className="mt-5 border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
                  Les pages sont créées <strong>en brouillon</strong> — rien n&apos;est
                  publié. Les textes viennent du site d&apos;origine : relisez-les,
                  ils peuvent être datés ou maladroits, ce qui est souvent la
                  raison même de la refonte.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="mt-6 flex gap-3 border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm leading-relaxed text-amber-900">{error}</p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-stone-200 px-6 py-4">
          <p className="text-[12.5px] text-stone-500">
            {phase === 'choose' && `${selected.size} sélectionnée${selected.size > 1 ? 's' : ''}`}
            {phase === 'importing' && 'Une page à la fois, pour maîtriser le coût.'}
          </p>
          <div className="flex gap-2">
            {phase === 'importing' ? (
              <button
                type="button"
                onClick={() => { abortRef.current = true; }}
                className="px-4 py-2 text-sm text-stone-500 transition-colors hover:text-stone-800 cursor-pointer"
              >
                Arrêter
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-stone-500 transition-colors hover:text-stone-800 cursor-pointer"
              >
                {phase === 'done' ? 'Fermer' : 'Annuler'}
              </button>
            )}

            {phase === 'choose' && (
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => void runImport()}
                className="bg-stone-900 px-5 py-2 text-sm text-white transition-colors hover:bg-stone-700 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                Importer {selected.size > 0 && `(${selected.size})`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
