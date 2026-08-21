"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, ExternalLink, FolderOpen, FolderPlus,
  Link2, Plus, Save, Scale, Trash2,
} from 'lucide-react';

import { supabase } from '../../../services/supabase';
import { fetchAllPages, type DynamicPage } from '../../../services/dynamicPages';
import {
  Badge, Button, Callout, Card, CardBody, CardFooter, CardHeader, EmptyState,
  Field, FormMessage, Input, PageHeader, Spinner,
} from '../../../components/admin/ui';

interface MenuChild { name: string; path: string; }
interface MenuItem { name: string; path?: string; type?: 'link' | 'dropdown'; children?: MenuChild[]; }
interface LegalLink { name: string; path: string; }

const MENU_KEY = 'navigation_menu';
const LEGAL_KEY = 'footer_legal_links';

export default function MenuClient() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [legalLinks, setLegalLinks] = useState<LegalLink[]>([]);
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, allPages] = await Promise.all([
        supabase.from('settings').select('key, value').in('key', [MENU_KEY, LEGAL_KEY]),
        fetchAllPages(),
      ]);
      const map = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
      const parse = (raw: string | undefined, fallback: any[]) => {
        try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : fallback; }
        catch { return fallback; }
      };
      setMenuItems(parse(map[MENU_KEY], []));
      setLegalLinks(parse(map[LEGAL_KEY], []));
      setPages(allPages);
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de charger le menu.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Manipulation du menu ─────────────────────────────────────────────
  const moveItem = (i: number, d: -1 | 1) => {
    const next = [...menuItems];
    if (i + d < 0 || i + d >= next.length) return;
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setMenuItems(next);
  };
  const updateItem = (i: number, key: keyof MenuItem, value: any) =>
    setMenuItems((prev) => prev.map((item, j) => (j === i ? { ...item, [key]: value } : item)));
  const deleteItem = (i: number) => setMenuItems((prev) => prev.filter((_, j) => j !== i));
  const addDropdown = () =>
    setMenuItems((prev) => [...prev, { name: 'Nouveau menu', type: 'dropdown', children: [] }]);
  const addPage = (page: DynamicPage) =>
    setMenuItems((prev) => [...prev, { name: page.title, path: page.slug === 'home' ? '/' : `/${page.slug}` }]);
  const addCustom = () => setMenuItems((prev) => [...prev, { name: 'Nouveau lien', path: '/' }]);

  const addSubItem = (i: number) =>
    updateItem(i, 'children', [...(menuItems[i].children ?? []), { name: 'Sous-lien', path: '/' }]);
  const updateSubItem = (i: number, si: number, key: keyof MenuChild, value: string) => {
    const children = [...(menuItems[i].children ?? [])];
    children[si] = { ...children[si], [key]: value };
    updateItem(i, 'children', children);
  };
  const moveSubItem = (i: number, si: number, d: -1 | 1) => {
    const children = [...(menuItems[i].children ?? [])];
    if (si + d < 0 || si + d >= children.length) return;
    [children[si], children[si + d]] = [children[si + d], children[si]];
    updateItem(i, 'children', children);
  };
  const deleteSubItem = (i: number, si: number) =>
    updateItem(i, 'children', (menuItems[i].children ?? []).filter((_, j) => j !== si));

  // Une page déjà présente dans le menu ne se re-propose pas.
  const usedPaths = new Set<string>([
    ...menuItems.flatMap((item) => [item.path, ...(item.children ?? []).map((c) => c.path)]),
    ...legalLinks.map((link) => link.path),
  ].filter(Boolean) as string[]);

  const pagePath = (page: DynamicPage) => (page.slug === 'home' ? '/' : `/${page.slug}`);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('settings').upsert(
      [
        { key: MENU_KEY, value: JSON.stringify(menuItems) },
        { key: LEGAL_KEY, value: JSON.stringify(legalLinks.filter((l) => l.name.trim() && l.path.trim())) },
      ],
      { onConflict: 'key' },
    );
    setSaving(false);
    setMessage(
      error
        ? { type: 'error', text: error.message }
        : { type: 'success', text: 'Navigation enregistrée. Rechargez le site pour la voir.' },
    );
  };

  const availablePages = pages.filter((page) => !usedPaths.has(pagePath(page)));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Navigation"
        description="Ce que vos visiteurs voient dans l'en-tête et en bas de page. Rien n'est proposé par défaut : vous choisissez parmi vos pages réelles."
        actions={
          <Button variant="primary" icon={saving ? undefined : Save} loading={saving} onClick={() => void save()}>
            Enregistrer
          </Button>
        }
      />

      {message && <FormMessage message={message} />}

      {loading ? (
        <Spinner label="Chargement de la navigation…" />
      ) : (
        <>
          {/* ── Menu principal ──────────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Menu principal"
              description="Affiché dans l'en-tête du site, dans cet ordre."
              actions={<Badge>{menuItems.length} entrée{menuItems.length > 1 ? 's' : ''}</Badge>}
            />
            <CardBody className="space-y-3">
              {menuItems.length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="Le menu est vide"
                  description="Tant qu'il l'est, l'en-tête n'affiche que votre logo. Ajoutez vos pages ci-dessous."
                />
              ) : (
                menuItems.map((item, idx) => {
                  const isDropdown = item.type === 'dropdown';
                  return (
                    <div key={idx} className="rounded-lg border border-stone-200 p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <span className="mb-2 grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600">
                          {isDropdown ? <FolderOpen size={15} /> : <Link2 size={15} />}
                        </span>

                        <Field label="Intitulé" htmlFor={`menu-name-${idx}`} className="min-w-[9rem] flex-1">
                          <Input
                            id={`menu-name-${idx}`}
                            value={item.name}
                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                          />
                        </Field>

                        {isDropdown ? (
                          <div className="mb-1 flex-1">
                            <Button size="sm" icon={Plus} onClick={() => addSubItem(idx)}>
                              Ajouter un sous-lien
                            </Button>
                          </div>
                        ) : (
                          <Field label="Adresse" htmlFor={`menu-path-${idx}`} className="min-w-[11rem] flex-[2]">
                            <Input
                              id={`menu-path-${idx}`}
                              value={item.path ?? ''}
                              onChange={(e) => updateItem(idx, 'path', e.target.value)}
                              className="font-mono text-[13px]"
                            />
                          </Field>
                        )}

                        <div className="mb-1 flex shrink-0 items-center gap-0.5">
                          <IconAction label={`Monter « ${item.name} »`} disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                            <ChevronUp size={15} />
                          </IconAction>
                          <IconAction label={`Descendre « ${item.name} »`} disabled={idx === menuItems.length - 1} onClick={() => moveItem(idx, 1)}>
                            <ChevronDown size={15} />
                          </IconAction>
                          <IconAction label={`Retirer « ${item.name} »`} danger onClick={() => deleteItem(idx)}>
                            <Trash2 size={15} />
                          </IconAction>
                        </div>
                      </div>

                      {isDropdown && (
                        <div className="mt-3 space-y-2 border-l-2 border-stone-200 pl-4">
                          {(item.children ?? []).length === 0 ? (
                            <p className="py-1 text-[12.5px] text-stone-600">Aucun sous-lien pour l'instant.</p>
                          ) : (
                            (item.children ?? []).map((child, si) => (
                              <div key={si} className="flex flex-wrap items-end gap-3 rounded-lg bg-stone-50 p-3">
                                <Field label="Intitulé" className="min-w-[8rem] flex-1">
                                  <Input value={child.name} onChange={(e) => updateSubItem(idx, si, 'name', e.target.value)} />
                                </Field>
                                <Field label="Adresse" className="min-w-[10rem] flex-[2]">
                                  <Input
                                    value={child.path}
                                    onChange={(e) => updateSubItem(idx, si, 'path', e.target.value)}
                                    className="font-mono text-[13px]"
                                  />
                                </Field>
                                <div className="mb-1 flex shrink-0 items-center gap-0.5">
                                  <IconAction label="Monter" disabled={si === 0} onClick={() => moveSubItem(idx, si, -1)}>
                                    <ChevronUp size={14} />
                                  </IconAction>
                                  <IconAction label="Descendre" disabled={si === (item.children?.length ?? 0) - 1} onClick={() => moveSubItem(idx, si, 1)}>
                                    <ChevronDown size={14} />
                                  </IconAction>
                                  <IconAction label="Retirer" danger onClick={() => deleteSubItem(idx, si)}>
                                    <Trash2 size={14} />
                                  </IconAction>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardBody>
            <CardFooter hint="Un menu déroulant regroupe plusieurs pages sous un même intitulé.">
              <Button size="sm" icon={Plus} onClick={addCustom}>Lien libre</Button>
              <Button size="sm" icon={FolderPlus} onClick={addDropdown}>Menu déroulant</Button>
            </CardFooter>
          </Card>

          {/* ── Pages disponibles ───────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Vos pages"
              description="Cliquez pour ajouter une page au menu. Seules les pages qui existent vraiment sont proposées."
            />
            <CardBody>
              {pages.length === 0 ? (
                <p className="text-[13px] text-stone-600">
                  Aucune page n'a encore été créée. Rendez-vous dans <strong>Pages</strong> pour en ajouter une.
                </p>
              ) : availablePages.length === 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] text-stone-600">
                  <Check size={14} className="text-emerald-600" />
                  Toutes vos pages figurent déjà dans la navigation.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {availablePages.map((page) => (
                    <li key={page.id}>
                      <button
                        type="button"
                        onClick={() => addPage(page)}
                        className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[13px] text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-50 cursor-pointer
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
                      >
                        <Plus size={13} className="text-stone-500" />
                        {page.title}
                        <span className="font-mono text-[11.5px] text-stone-500">{pagePath(page)}</span>
                        {!page.published && <Badge tone="warning">brouillon</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* ── Liens de bas de page ────────────────────────────────── */}
          <Card>
            <CardHeader
              title="Liens de bas de page"
              description="Mentions légales, CGV, confidentialité… Affichés tout en bas, sur toutes les pages."
              actions={
                <Button size="sm" icon={Plus} onClick={() => setLegalLinks((prev) => [...prev, { name: '', path: '/' }])}>
                  Ajouter
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <Callout tone="info">
                Ces liens étaient auparavant écrits en dur dans le pied de page et pointaient vers des
                pages que ce site n'a pas forcément. N'ajoutez ici que des pages réellement créées.
              </Callout>

              {legalLinks.length === 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] text-stone-600">
                  <Scale size={14} className="text-stone-500" />
                  Aucun lien : la ligne du bas n'affichera que votre nom et l'année.
                </p>
              ) : (
                legalLinks.map((link, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 p-3">
                    <Field label="Intitulé" className="min-w-[9rem] flex-1">
                      <Input
                        value={link.name}
                        placeholder="Mentions légales"
                        onChange={(e) =>
                          setLegalLinks((prev) => prev.map((l, j) => (j === idx ? { ...l, name: e.target.value } : l)))
                        }
                      />
                    </Field>
                    <Field label="Adresse" className="min-w-[10rem] flex-[2]">
                      <Input
                        value={link.path}
                        placeholder="/mentions-legales"
                        className="font-mono text-[13px]"
                        onChange={(e) =>
                          setLegalLinks((prev) => prev.map((l, j) => (j === idx ? { ...l, path: e.target.value } : l)))
                        }
                      />
                    </Field>
                    <div className="mb-1 shrink-0">
                      <IconAction label={`Retirer « ${link.name || 'ce lien'} »`} danger onClick={() => setLegalLinks((prev) => prev.filter((_, j) => j !== idx))}>
                        <Trash2 size={15} />
                      </IconAction>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-6 py-4">
            <p className="text-[13px] text-stone-600">
              Les changements ne sont visibles sur le site qu'une fois enregistrés.
            </p>
            <div className="flex items-center gap-2">
              <Button icon={ExternalLink} onClick={() => window.open('/', '_blank', 'noopener')}>
                Voir le site
              </Button>
              <Button variant="primary" icon={saving ? undefined : Save} loading={saving} onClick={() => void save()}>
                Enregistrer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconAction({
  label, onClick, disabled, danger, children,
}: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-lg text-stone-500 transition-colors disabled:opacity-25 cursor-pointer disabled:cursor-default
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
          danger ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-stone-100 hover:text-stone-900'
        }`}
    >
      {children}
    </button>
  );
}
