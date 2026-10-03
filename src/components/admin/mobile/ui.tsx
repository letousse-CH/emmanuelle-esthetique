"use client";

/**
 * KIT UI MOBILE de l'admin — les briques de l'« application » sous 1024 px.
 *
 * USAGE
 *   import { PageSection, ActionTile, StatTile, ListGroup, ListRow, ChipBar, Chip,
 *            BottomSheet, Fab, EmptyState, Skeleton, SegmentedControl,
 *            StickyActionBar } from '@/components/admin/mobile/ui';
 *   (chemins relatifs dans ce dépôt : `../../../components/admin/mobile/ui`)
 *
 * RÈGLES DU KIT
 *   · Cibles tactiles ≥ 44 px, texte courant ≥ 15 px, libellés ≥ 12 px.
 *   · Couleur d'action = `accent` (la couleur du site, via useAdminAccent) ;
 *     fonds pierre/crème, coins 16–20 px, ombres très douces.
 *   · Aucun composant n'écrit de donnée : ce sont des briques d'affichage.
 *   · Les composants se rangent dans la page ; seules les pièces « collées »
 *     (`Fab`, `StickyActionBar`) sont positionnées au-dessus de la barre
 *     d'onglets via `--admin-tabbar-h` (0 sur ordinateur, donc sans effet).
 *   · Les montants passent par `formatCHF` (`src/types/caisse.ts`, convention
 *     suisse `CHF 1'234.50`) — jamais de calcul de montant ici.
 *
 * COMPOSANTS
 *   PageSection      titre de section + action facultative ; range un bloc de la page.
 *   ActionTile       grosse tuile cliquable icône / titre / sous-titre / pastille.
 *   StatTile         chiffre clé + libellé + variation (montant ou nombre).
 *   ListGroup        carte arrondie qui regroupe des ListRow séparées par un filet.
 *   ListRow          ligne tactile 60 px+ : avant / titre / sous-titre / après / chevron.
 *   Chip, ChipBar    pastilles (filtre ou navigation) dans une rangée défilante.
 *   BottomSheet      feuille qui monte du bas (modale centrée ≥ lg).
 *   Fab              bouton d'action flottant, au-dessus de la barre d'onglets.
 *   StickyActionBar  barre d'actions collée au-dessus de la barre d'onglets.
 *   SegmentedControl choix exclusif entre 2 à 4 options (Jour / Semaine / Mois).
 *   EmptyState       « rien ici » avec consigne et action.
 *   Skeleton         gabarit de chargement.
 */

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Loader2, Minus, X } from 'lucide-react';
import { formatCHF } from '../../../types/caisse';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const CARD = 'rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]';

/** Rend un lien interne, un lien externe ou un bouton selon les props. */
type Pressable = {
  href?: string;
  /** Lien vers un autre site : s'ouvre dans un nouvel onglet. */
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  disabled?: boolean;
};

function renderPressable(
  { href, external, onClick, disabled }: Pressable,
  className: string,
  children: React.ReactNode,
  extra: { 'aria-label'?: string; 'aria-current'?: 'page' | undefined; 'aria-pressed'?: boolean; 'data-selected'?: boolean } = {},
) {
  if (href && !disabled) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} {...extra}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} onClick={onClick} className={className} {...extra}>
        {children}
      </Link>
    );
  }
  if (onClick || disabled) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className} {...extra}>
        {children}
      </button>
    );
  }
  return (
    <div className={className} {...(extra['aria-label'] ? { 'aria-label': extra['aria-label'] } : {})}>
      {children}
    </div>
  );
}

// ── PageSection ──────────────────────────────────────────────────────────────

export type PageSectionAction = { label: string; href?: string; onClick?: () => void };

export interface PageSectionProps {
  title: string;
  /** Phrase d'aide sous le titre. */
  description?: React.ReactNode;
  /** Lien « Tout voir » à droite du titre, ou un nœud libre (bouton…). */
  action?: PageSectionAction | React.ReactNode;
  /** Titre visuellement masqué (reste lu par les lecteurs d'écran). */
  hideTitle?: boolean;
  className?: string;
  children: React.ReactNode;
}

function isActionObject(a: unknown): a is PageSectionAction {
  return !!a && typeof a === 'object' && !React.isValidElement(a) && 'label' in (a as object);
}

export function PageSection({ title, description, action, hideTitle, className, children }: PageSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx('space-y-3', className)}>
      <div className={cx('flex items-center justify-between gap-3', hideTitle && 'sr-only')}>
        <h2 id={id} className="min-w-0 text-[19px] font-semibold leading-tight tracking-tight text-stone-950">
          {title}
        </h2>
        {isActionObject(action)
          ? renderPressable(
              { href: action.href, onClick: action.onClick },
              cx(
                '-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-accent',
                FOCUS_RING,
              ),
              <>
                {action.label}
                <ChevronRight size={16} aria-hidden="true" />
              </>,
            )
          : action}
      </div>
      {description && <p className="-mt-1 text-[15px] leading-relaxed text-stone-600">{description}</p>}
      {children}
    </section>
  );
}

// ── Pastille numérique ───────────────────────────────────────────────────────

function CountBadge({ value, label, className }: { value: number | string; label?: string; className?: string }) {
  return (
    <span
      aria-label={label}
      className={cx(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[12px] font-bold leading-none text-white',
        className,
      )}
    >
      {value}
    </span>
  );
}

// ── ActionTile ───────────────────────────────────────────────────────────────

export type TileTone = 'default' | 'accent' | 'warning' | 'danger';

export interface ActionTileProps extends Pressable {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  /** Pastille (nombre de demandes, « Nouveau »…). 0 ou vide : pas de pastille. */
  badge?: number | string;
  /** Texte de lecteur d'écran de la pastille (« 3 demandes à appeler »). */
  badgeLabel?: string;
  tone?: TileTone;
  /** `lg` : tuile plus haute, pour une action principale d'écran. */
  size?: 'md' | 'lg';
  /** Petite mention discrète sous le texte (« Plutôt sur ordinateur »). */
  hint?: string;
  className?: string;
}

const TILE_TONE: Record<TileTone, { box: string; icon: string; sub: string }> = {
  default: { box: 'bg-white text-stone-950 border-stone-200', icon: 'bg-accent-soft text-accent', sub: 'text-stone-600' },
  accent: { box: 'bg-accent text-accent-fg border-transparent', icon: 'bg-white/20 text-accent-fg', sub: 'text-accent-fg/80' },
  warning: { box: 'bg-amber-50 text-amber-950 border-amber-200', icon: 'bg-amber-100 text-amber-700', sub: 'text-amber-900/80' },
  danger: { box: 'bg-red-50 text-red-950 border-red-200', icon: 'bg-red-100 text-red-700', sub: 'text-red-900/80' },
};

export function ActionTile({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeLabel,
  tone = 'default',
  size = 'md',
  hint,
  className,
  ...press
}: ActionTileProps) {
  const t = TILE_TONE[tone];
  const interactive = !!(press.href || press.onClick);
  const body = (
    <>
      <span className={cx('grid shrink-0 place-items-center rounded-xl', size === 'lg' ? 'size-12' : 'size-11', t.icon)}>
        <Icon size={size === 'lg' ? 24 : 22} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="mt-3 block min-w-0">
        <span className={cx('block font-semibold leading-snug', size === 'lg' ? 'text-[17px]' : 'text-[15px]')}>{title}</span>
        {subtitle && <span className={cx('mt-0.5 block text-[13px] leading-snug', t.sub)}>{subtitle}</span>}
        {hint && <span className={cx('mt-1.5 block text-[12px] leading-snug italic', t.sub)}>{hint}</span>}
      </span>
      {badge !== undefined && badge !== 0 && badge !== '' && (
        <CountBadge value={badge} label={badgeLabel} className="absolute right-3 top-3" />
      )}
    </>
  );
  const cls = cx(
    'relative flex w-full flex-col items-start rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
    size === 'lg' ? 'min-h-[132px]' : 'min-h-[108px]',
    t.box,
    interactive && 'cursor-pointer transition-[transform,background-color] duration-150 active:scale-[0.98]',
    interactive && tone === 'default' && 'active:bg-stone-50',
    FOCUS_RING,
    className,
  );
  return renderPressable(press, cls, body);
}

// ── StatTile ─────────────────────────────────────────────────────────────────

export interface StatTileProps {
  label: string;
  /** Montant en francs : formaté à la suisse (`CHF 1'234.50`). Prioritaire sur `value`. */
  amount?: number | string | null;
  /** Valeur déjà formatée ou nombre (« 12 », « 4 h 30 »…). */
  value?: React.ReactNode;
  /** Variation en % par rapport à la période précédente (positive = hausse). */
  delta?: number | null;
  deltaLabel?: string;
  /** Pour une dépense : une hausse est une mauvaise nouvelle. */
  invertDelta?: boolean;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  tone?: 'default' | 'accent';
  loading?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function StatTile({
  label,
  amount,
  value,
  delta,
  deltaLabel,
  invertDelta,
  hint,
  icon: Icon,
  tone = 'default',
  loading,
  href,
  onClick,
  className,
}: StatTileProps) {
  const accent = tone === 'accent';
  const shown = amount !== undefined ? formatCHF(amount) : value;
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const up = hasDelta && delta! > 0;
  const flat = hasDelta && Math.abs(delta!) < 0.05;
  const good = flat ? null : invertDelta ? !up : up;
  const DeltaIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const deltaWords = hasDelta
    ? `${flat ? 'stable' : up ? 'en hausse de' : 'en baisse de'} ${flat ? '' : `${Math.abs(delta!).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %`}`
    : '';

  const body = (
    <>
      <span className={cx('flex items-center gap-2 text-[14px] font-medium', accent ? 'text-accent-fg/85' : 'text-stone-600')}>
        {Icon && <Icon size={16} aria-hidden="true" />}
        {label}
      </span>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <span className={cx('mt-1 block text-[26px] font-semibold leading-tight tracking-tight tabular-nums', accent ? 'text-accent-fg' : 'text-stone-950')}>
          {shown ?? '—'}
        </span>
      )}
      {!loading && hasDelta && (
        <span
          className={cx(
            'mt-1 inline-flex items-center gap-1 text-[13px] font-semibold',
            accent ? 'text-accent-fg/90' : good === null ? 'text-stone-600' : good ? 'text-emerald-700' : 'text-red-700',
          )}
        >
          <DeltaIcon size={14} aria-hidden="true" />
          <span aria-hidden="true">
            {flat ? '0 %' : `${up ? '+' : '−'}${Math.abs(delta!).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %`}
          </span>
          <span className="sr-only">{deltaWords}</span>
          {deltaLabel && <span className={cx('font-normal', accent ? 'text-accent-fg/75' : 'text-stone-600')}>{deltaLabel}</span>}
        </span>
      )}
      {hint && <span className={cx('mt-1 block text-[13px]', accent ? 'text-accent-fg/80' : 'text-stone-600')}>{hint}</span>}
    </>
  );

  const cls = cx(
    'flex w-full flex-col items-start rounded-2xl border p-4 text-left shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
    accent ? 'border-transparent bg-accent text-accent-fg' : 'border-stone-200 bg-white',
    (href || onClick) && 'cursor-pointer transition-transform duration-150 active:scale-[0.98]',
    FOCUS_RING,
    className,
  );
  return renderPressable({ href, onClick }, cls, body);
}

// ── ListGroup / ListRow ──────────────────────────────────────────────────────

export function ListGroup({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  /** Nom de la liste pour les lecteurs d'écran. */
  label?: string;
  className?: string;
}) {
  return (
    <div role="list" aria-label={label} className={cx(CARD, 'divide-y divide-stone-100 overflow-hidden', className)}>
      {children}
    </div>
  );
}

export interface ListRowProps extends Pressable {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Avant le texte : avatar, icône, heure… */
  leading?: React.ReactNode;
  /** Après le texte : montant, statut, pastille… */
  trailing?: React.ReactNode;
  /** Chevron de fin ; par défaut affiché quand la ligne est cliquable. */
  chevron?: boolean;
  tone?: 'default' | 'danger';
  /** Ligne isolée (hors ListGroup) : lui donne sa propre carte. */
  card?: boolean;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  tone = 'default',
  card,
  className,
  ...press
}: ListRowProps) {
  const interactive = !!(press.href || press.onClick) && !press.disabled;
  const showChevron = chevron ?? interactive;
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[16px] font-medium leading-snug', tone === 'danger' ? 'text-red-700' : 'text-stone-950')}>
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-[14px] leading-snug text-stone-600">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-[15px] text-stone-700">{trailing}</span>}
      {showChevron && <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />}
    </>
  );
  const cls = cx(
    'flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left',
    card && CARD,
    interactive && 'cursor-pointer transition-colors duration-150 active:bg-stone-100',
    press.disabled && 'opacity-50',
    FOCUS_RING,
    'focus-visible:ring-inset focus-visible:ring-offset-0',
    className,
  );
  const node = renderPressable(press, cls, body);
  // Dans un `ListGroup` (role="list"), chaque ligne est un élément de liste.
  return <div role="listitem">{node}</div>;
}

// ── Chip / ChipBar ───────────────────────────────────────────────────────────

export interface ChipProps extends Pressable {
  children: React.ReactNode;
  /** Pastille active (filtre choisi, page courante). */
  selected?: boolean;
  icon?: React.ElementType;
  /** Petit compteur après le libellé. */
  count?: number;
  className?: string;
}

/**
 * Pastille de 44 px. Avec `href` c'est un lien de navigation (`aria-current`),
 * avec `onClick` un filtre à bascule (`aria-pressed`).
 */
export function Chip({ children, selected, icon: Icon, count, className, ...press }: ChipProps) {
  const cls = cx(
    'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[15px] font-medium',
    'cursor-pointer select-none transition-colors duration-150 active:scale-[0.97]',
    selected
      ? 'border-transparent bg-accent text-accent-fg font-semibold'
      : 'border-stone-200 bg-white text-stone-800 active:bg-stone-100',
    FOCUS_RING,
    className,
  );
  const body = (
    <>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
      {typeof count === 'number' && (
        <span
          className={cx(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold leading-5',
            selected ? 'bg-white/25 text-accent-fg' : 'bg-stone-100 text-stone-700',
          )}
        >
          {count}
        </span>
      )}
    </>
  );
  return renderPressable(
    press,
    cls,
    body,
    press.href
      ? { 'aria-current': selected ? 'page' : undefined, 'data-selected': !!selected }
      : { 'aria-pressed': !!selected, 'data-selected': !!selected },
  );
}

export interface ChipBarProps {
  children: React.ReactNode;
  /** Nom de la rangée pour les lecteurs d'écran. */
  label: string;
  /** Change quand la sélection change : fait défiler la pastille choisie dans la vue. */
  activeKey?: string | number | null;
  /** Déborde sur les marges de la page pour défiler bord à bord (par défaut oui). */
  bleed?: boolean;
  className?: string;
}

/** Rangée de pastilles qui défile horizontalement ; la pastille sélectionnée est ramenée dans la vue. */
export function ChipBar({ children, label, activeKey, bleed = true, className }: ChipBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const el = bar?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!bar || !el) return;
    const target = el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [activeKey]);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cx('hide-scrollbar flex gap-2 overflow-x-auto py-1', bleed && '-mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0', className)}
      style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  );
}

// ── Skeleton / EmptyState ────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('block animate-pulse rounded-xl bg-stone-200/70', className)} />;
}

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  /** Bouton ou lien d'action (à fournir déjà stylé, ex. `LinkButton` de ui.tsx). */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
      <p className="text-[17px] font-semibold text-stone-950">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-stone-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── SegmentedControl ─────────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
  /** Compteur facultatif après le libellé. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom du choix pour les lecteurs d'écran (« Période »). */
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex w-full gap-1 rounded-2xl bg-stone-100 p-1', className)}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-[15px] transition-all duration-150',
              active
                ? 'bg-white font-semibold text-stone-950 shadow-[0_1px_3px_rgba(28,25,23,0.12)]'
                : 'font-medium text-stone-700 active:bg-white/60',
              FOCUS_RING,
            )}
          >
            {o.icon && <o.icon size={16} aria-hidden="true" />}
            <span className="truncate">{o.label}</span>
            {typeof o.count === 'number' && (
              <span className="rounded-full bg-stone-200/80 px-1.5 text-[12px] font-semibold leading-5 text-stone-700">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Fab ──────────────────────────────────────────────────────────────────────

export interface FabProps {
  icon: React.ElementType;
  /** Libellé : lu par les lecteurs d'écran, et affiché si `extended`. */
  label: string;
  href?: string;
  onClick?: () => void;
  /** Affiche aussi le libellé (« Nouveau rendez-vous »). */
  extended?: boolean;
  /** À monter au-dessus d'une `StickyActionBar` présente sur le même écran. */
  raised?: boolean;
  loading?: boolean;
  /** Visible aussi sur ordinateur (par défaut : téléphone uniquement). */
  desktop?: boolean;
}

/** Bouton d'action flottant, posé au-dessus de la barre d'onglets, à droite. */
export function Fab({ icon: Icon, label, href, onClick, extended, raised, loading, desktop }: FabProps) {
  const cls = cx(
    'admin-fab fixed right-4 z-30 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-accent text-accent-fg',
    'shadow-[0_6px_20px_rgba(28,25,23,0.22)] cursor-pointer transition-transform duration-150 active:scale-95',
    extended ? 'px-5 text-[16px] font-semibold' : 'w-14',
    !desktop && 'lg:hidden',
    FOCUS_RING,
  );
  const style: React.CSSProperties = {
    bottom: `calc(var(--admin-tabbar-h, 0px) + env(safe-area-inset-bottom) + ${raised ? '5.25rem' : '1rem'})`,
  };
  const body = loading ? (
    <Loader2 size={22} className="animate-spin" aria-hidden="true" />
  ) : (
    <Icon size={24} strokeWidth={2} aria-hidden="true" />
  );
  const content = (
    <>
      {body}
      {extended ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={loading} className={cls} style={style} aria-label={extended ? undefined : label}>
      {content}
    </button>
  );
}

// ── StickyActionBar ──────────────────────────────────────────────────────────

export interface StickyActionBarProps {
  children: React.ReactNode;
  /** Message court à gauche (« 3 lignes · CHF 120.00 »). */
  summary?: React.ReactNode;
  /** Réserve la place de la barre en bas de page (évite qu'elle masque le contenu). Par défaut oui. */
  reserveSpace?: boolean;
  /** Nom de la barre pour les lecteurs d'écran. */
  label?: string;
  className?: string;
}

/**
 * Barre d'actions collée juste au-dessus de la barre d'onglets (en bas de
 * l'écran sur ordinateur, elle se pose simplement à la suite du contenu).
 * Une seule action pleine (`variant="primary"`) par barre.
 */
export function StickyActionBar({ children, summary, reserveSpace = true, label = 'Actions', className }: StickyActionBarProps) {
  return (
    <>
      {reserveSpace && <div className="h-24 lg:hidden" aria-hidden="true" />}
      <div
        role="region"
        aria-label={label}
        className={cx(
          'admin-sticky-bar fixed inset-x-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur',
          'shadow-[0_-4px_16px_rgba(28,25,23,0.06)]',
          'lg:static lg:mt-6 lg:rounded-2xl lg:border lg:shadow-none',
          className,
        )}
        style={{ bottom: 'calc(var(--admin-tabbar-h, 0px) + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 lg:max-w-none">
          {summary && <div className="min-w-0 flex-1 text-[15px] font-medium text-stone-800">{summary}</div>}
          <div className={cx('flex items-center gap-2', summary ? 'shrink-0' : 'w-full [&>*]:flex-1')}>{children}</div>
        </div>
      </div>
    </>
  );
}

// ── BottomSheet ──────────────────────────────────────────────────────────────

const sheetStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Titre visuellement masqué (la feuille garde son nom accessible). */
  hideTitle?: boolean;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Pied collé en bas de la feuille (boutons). */
  footer?: React.ReactNode;
  /** `full` : feuille haute (jusqu'à 94 % de l'écran). Par défaut, hauteur du contenu. */
  size?: 'auto' | 'full';
  zIndex?: number;
}

/**
 * Feuille qui monte du bas : poignée, fermeture par glisser vers le bas, Échap
 * ou toucher du fond. `role="dialog"` + `aria-modal`, focus piégé puis rendu à
 * l'élément d'origine, défilement de la page verrouillé. À partir de `lg`,
 * modale centrée.
 */
export function BottomSheet({ open, onClose, title, hideTitle, description, children, footer, size = 'auto', zIndex = 100 }: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = `sheet-${useId().replace(/:/g, '')}`;

  // Entrée / sortie animées (sans animation si l'utilisatrice préfère le mouvement réduit).
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setShown(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setMounted(false), reduce ? 0 : 240);
    return () => window.clearTimeout(t);
  }, [open]);

  // Focus piégé, Échap, verrouillage du défilement.
  useEffect(() => {
    if (!open || !mounted) return;
    const token = Symbol('sheet');
    sheetStack.push(token);
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root || root.contains(document.activeElement)) return;
      (root.querySelector<HTMLElement>('[data-autofocus]') ?? root).focus({ preventScroll: true });
    }, 40);

    const onKey = (e: KeyboardEvent) => {
      if (sheetStack[sheetStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      const i = sheetStack.indexOf(token);
      if (i >= 0) sheetStack.splice(i, 1);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, mounted]);

  // Glisser vers le bas depuis la poignée / l'en-tête.
  const drag = useRef<{ startY: number; startT: number; dy: number; active: boolean }>({ startY: 0, startT: 0, dy: 0, active: false });
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    if ((e.target as HTMLElement).closest('button, a')) return;
    drag.current = { startY: e.clientY, startT: performance.now(), dy: 0, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = 'none';
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    if (panelRef.current) panelRef.current.style.translate = `0 ${d.dy}px`;
  }, []);
  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const panel = panelRef.current;
    const velocity = d.dy / Math.max(1, performance.now() - d.startT); // px/ms
    if (panel) {
      panel.style.transition = '';
      panel.style.translate = '';
    }
    if (d.dy > 110 || (d.dy > 40 && velocity > 0.6)) closeRef.current();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* déjà relâché */
    }
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const node = (
    <div className="fixed inset-0" style={{ zIndex }}>
      <div
        aria-hidden="true"
        onClick={() => closeRef.current()}
        className={cx(
          'absolute inset-0 bg-stone-900/45 transition-opacity duration-200 motion-reduce:transition-none',
          shown ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center lg:items-center lg:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            'pointer-events-auto flex w-full flex-col overflow-hidden bg-white shadow-[0_-8px_32px_rgba(28,25,23,0.18)] focus:outline-none',
            'rounded-t-[22px] lg:max-w-lg lg:rounded-[22px] lg:shadow-2xl',
            size === 'full' ? 'h-[94dvh] lg:h-auto lg:max-h-[88dvh]' : 'max-h-[90dvh] lg:max-h-[88dvh]',
            'transition-[translate,opacity,scale] duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            shown ? 'translate-y-0 opacity-100 lg:scale-100' : 'translate-y-full opacity-100 lg:translate-y-0 lg:scale-95 lg:opacity-0',
          )}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="shrink-0 touch-none select-none"
          >
            <div className="flex justify-center pb-1 pt-2.5 lg:hidden" aria-hidden="true">
              <span className="h-1.5 w-11 rounded-full bg-stone-300" />
            </div>
            <div className={cx('flex items-start justify-between gap-3 px-5 pb-2 pt-1 lg:pt-5', hideTitle && 'sr-only')}>
              <div className="min-w-0">
                <h2 id={titleId} className="text-[20px] font-semibold leading-tight tracking-tight text-stone-950">
                  {title}
                </h2>
                {description && <p className="mt-1 text-[15px] leading-snug text-stone-600">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => closeRef.current()}
                aria-label="Fermer"
                className={cx('-mr-2 -mt-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-stone-700 active:bg-stone-100', FOCUS_RING)}
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
          {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
