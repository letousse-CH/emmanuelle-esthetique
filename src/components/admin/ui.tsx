'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ChevronRight, Info, Loader2, XCircle } from 'lucide-react';

/**
 * Kit d'interface du back-office.
 *
 * Un seul endroit décide de la typographie, des contrastes, des rayons et de la
 * place des boutons. Avant, chaque écran réinventait les siens : d'où des
 * libellés en capitales étroites illisibles, du texte gris clair sur blanc, et
 * des boutons d'enregistrement à des endroits différents d'un onglet à l'autre.
 *
 * Trois règles tiennent l'ensemble :
 *
 * 1. **Le texte est lisible avant d'être élégant.** Titres en `stone-900`,
 *    texte courant en `stone-600`, jamais plus clair que `stone-500` pour une
 *    information utile. Les capitales espacées sont réservées aux surtitres de
 *    quelques mots.
 * 2. **L'action principale est toujours au même endroit** — en bas à droite du
 *    bloc qu'elle valide, ou en haut à droite de la page pour une action de
 *    page. Une seule action pleine par écran.
 * 3. **Rien ne flotte.** Tout contenu vit dans une `Card` qui porte son titre
 *    et, s'il y a lieu, son pied d'action.
 */

// ── Boutons ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ' +
  'disabled:opacity-45 disabled:pointer-events-none cursor-pointer';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // Noir plutôt que couleur de marque : l'action principale doit se voir sur
  // n'importe quelle palette client, y compris une palette très claire.
  primary: 'bg-stone-900 text-white hover:bg-stone-700',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 hover:border-stone-400',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-300',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className = '',
  children,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ElementType;
}) {
  return (
    <Link
      href={href}
      {...props}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      {Icon && <Icon size={15} />}
      {children}
    </Link>
  );
}

// ── En-tête de page ────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="mb-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="mb-2 flex items-center gap-1 text-[13px] text-stone-500">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && <ChevronRight size={13} className="text-stone-500" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-stone-900 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-stone-700">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900">{title}</h1>
          {description && <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ── Carte ──────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  as: Tag = 'section',
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag
      {...props}
      className={`rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

/** Pied de carte : c'est là, et nulle part ailleurs, que se valide un bloc. */
export function CardFooter({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-stone-200 bg-stone-50 px-6 py-3.5">
      <div className="min-w-0 text-[13px] text-stone-600">{hint}</div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

// ── Champs ─────────────────────────────────────────────────────────────────

export const inputClass =
  'rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 ' +
  'transition-colors focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 ' +
  'disabled:bg-stone-50 disabled:text-stone-500';

export const inputHeight = 'h-10';

/**
 * Largeur pleine par défaut, sauf si l'appelant en impose une.
 *
 * `w-full` inscrit en dur dans la classe de base ne peut pas être surchargé :
 * Tailwind range les utilitaires de largeur dans son propre ordre, pas dans
 * celui de la chaîne, donc un `w-auto` ajouté après restait sans effet — d'où
 * des sélecteurs de filtre qui prenaient toute la ligne au lieu de se ranger
 * côte à côte.
 */
function withWidth(className: string): string {
  return /(^|\s)(w-|min-w-|max-w-|flex-1|basis-)/.test(className) ? className : `w-full ${className}`;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className = '',
}: {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-stone-800">
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[12.5px] leading-relaxed text-stone-500">{hint}</p>}
      {error && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-red-600">
          <XCircle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const extra = props.className ?? '';
  return <input {...props} className={withWidth(`${inputClass} ${inputHeight} ${extra}`.trim())} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const extra = props.className ?? '';
  return <textarea {...props} className={withWidth(`${inputClass} py-2.5 leading-relaxed ${extra}`.trim())} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const extra = props.className ?? '';
  return <select {...props} className={withWidth(`${inputClass} ${inputHeight} pr-8 ${extra}`.trim())} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2
        disabled:opacity-45 disabled:pointer-events-none ${checked ? 'bg-stone-900' : 'bg-stone-300'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.185rem]'
        }`}
      />
    </button>
  );
}

/** Ligne « libellé + description + interrupteur », alignée partout pareil. */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900">{title}</p>
        {description && <p className="mt-0.5 text-[13px] leading-relaxed text-stone-600">{description}</p>}
      </div>
      <div className="pt-0.5">
        <Toggle checked={checked} onChange={onChange} label={title} disabled={disabled} />
      </div>
    </div>
  );
}

// ── Signalements ───────────────────────────────────────────────────────────

type Tone = 'info' | 'success' | 'warning' | 'danger';

const CALLOUT: Record<Tone, { box: string; icon: React.ElementType; iconClass: string }> = {
  info: { box: 'border-stone-200 bg-stone-50 text-stone-700', icon: Info, iconClass: 'text-stone-500' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: Check, iconClass: 'text-emerald-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconClass: 'text-amber-600' },
  danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: XCircle, iconClass: 'text-red-600' },
};

export function Callout({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const spec = CALLOUT[tone];
  const Icon = spec.icon;
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${spec.box}`}>
      <Icon size={15} className={`mt-0.5 shrink-0 ${spec.iconClass}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

const BADGE: Record<Tone | 'neutral', string> = {
  neutral: 'bg-stone-100 text-stone-700 border-stone-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-medium ${BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid size-11 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500">
          <Icon size={20} />
        </span>
      )}
      <p className="text-[15px] font-semibold text-stone-900">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-stone-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── Onglets ────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  description?: string;
}

/**
 * Onglets horizontaux, soulignés.
 *
 * Les anciennes pastilles en capitales étroites étaient à la fois peu
 * contrastées et impossibles à parcourir dès qu'elles passaient à la ligne.
 * Un soulignement lit mieux et supporte le défilement horizontal sur mobile.
 */
export function Tabs({
  items,
  active,
  onChange,
  label,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto border-b border-stone-200">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1 px-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-900'
                }`}
            >
              {item.icon && <item.icon size={15} />}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Navigation de rubriques en colonne, pour les écrans à sections nombreuses.
 *
 * Huit onglets en ligne ne tiennent pas : ils passaient à la ligne et on ne
 * savait plus lequel était actif. En colonne, chaque rubrique garde son nom
 * complet et sa description courte.
 */
export function SideNav({
  items,
  active,
  onChange,
  label,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-20">
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={`group flex w-full min-w-max items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 lg:min-w-0 ${
                  isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
            >
              {item.icon && (
                <item.icon size={15} className={`mt-0.5 shrink-0 ${isActive ? 'text-white' : 'text-stone-500 group-hover:text-stone-600'}`} />
              )}
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{item.label}</span>
                {item.description && (
                  <span className={`mt-0.5 hidden text-[12px] leading-snug lg:block ${isActive ? 'text-stone-500' : 'text-stone-500'}`}>
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Divers ─────────────────────────────────────────────────────────────────

export function Spinner({ label = 'Chargement' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-8 text-sm text-stone-600">
      <Loader2 size={16} className="animate-spin text-stone-500" />
      {label}
    </div>
  );
}

/** Message de résultat d'un formulaire, toujours au même endroit et au même ton. */
export function FormMessage({ message }: { message: { type: 'success' | 'error'; text: string } | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={`flex items-center gap-1.5 text-[13px] font-medium ${
        message.type === 'success' ? 'text-emerald-700' : 'text-red-700'
      }`}
    >
      {message.type === 'success' ? <Check size={14} /> : <XCircle size={14} />}
      {message.text}
    </p>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">
      {children}
    </kbd>
  );
}
