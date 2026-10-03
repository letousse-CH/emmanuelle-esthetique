"use client";

/**
 * Vue de l'accueil mobile (sous `lg`). Pure : tout arrive par props (`data`),
 * rien n'est lu ni écrit ici. La récupération vit dans `homeData.ts` ; c'est ce
 * qui permet de tester la vue avec des données d'exemple.
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSettings } from '../../../../hooks/useSettings';
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gift,
  LayoutGrid,
  Package,
  Phone,
  PhoneCall,
  RefreshCw,
  Sun,
  UserPlus,
} from 'lucide-react';
import type { Booking } from '../../../../types/booking';
import { PERIODE_LABEL, STATUT_LABEL } from '../../../../types/booking';
import { formatCHF } from '../../../../types/caisse';
import { ActionTile, EmptyState, ListGroup, PageSection, Skeleton, StatTile } from '../ui';
import InstallCard from '../InstallCard';
import type { Block, HomeBlockKey, HomeData } from './homeTypes';
import { addDays, dayOfMonth, formatLongDate, formatShortDay, TZ, zurichHour } from './zurich';

export interface MobileHomeViewProps {
  data: HomeData;
  /** Module Caisse actif : sinon encaisser, clientes, recettes et alertes disparaissent. */
  caisseEnabled: boolean;
  onRetry: (key: HomeBlockKey) => void;
  /** Appelé à la première ouverture de la carte « Statistiques du site ». */
  onSiteStatsOpen: () => void;
  /** Forcer l'heure (tests visuels). Sinon l'horloge réelle, mise à jour chaque minute. */
  now?: Date;
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const CARD = 'rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]';
const BTN =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold active:scale-[0.98] transition-transform';

// ── Utilitaires ──────────────────────────────────────────────────────────────

function useNow(override?: Date): Date | null {
  const [now, setNow] = useState<Date | null>(override ?? null);
  useEffect(() => {
    if (override) {
      setNow(override);
      return;
    }
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, [override]);
  return now;
}

function minutesOfDay(d: Date): number {
  const m = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, minute: '2-digit' }).format(d);
  return zurichHour(d) * 60 + parseInt(m, 10);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** `14:30` → `14h30`. */
const heureFr = (hhmm: string) => hhmm.slice(0, 5).replace(':', 'h');

function dureeFr(min: number): string {
  if (!min || min < 1) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Numéro suisse saisi à la main (079…) → format international attendu par wa.me. */
function waNumber(phone: string): string {
  let d = phone.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `41${d.slice(1)}`;
  return d;
}

function ago(iso: string, now: Date | null): string {
  if (!now) return '';
  const diff = now.getTime() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return '';
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

function soins(b: Booking): string {
  const extra = (b.options ?? []).map((o) => o.nom);
  return [b.service_nom, ...extra].filter(Boolean).join(' + ');
}

function fullName(b: Booking) {
  return `${b.prenom ?? ''} ${b.nom ?? ''}`.trim() || 'Cliente';
}

const isLive = (b: Booking) => b.statut !== 'annule' && b.statut !== 'refuse';

// ── Blocs génériques ─────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry, className = '' }: { message: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 ${className}`}>
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-red-950">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className={`${BTN} mt-3 border border-red-300 bg-white text-red-800 active:bg-red-100 ${FOCUS}`}
        >
          <RefreshCw size={16} aria-hidden="true" /> Réessayer
        </button>
      </div>
    </div>
  );
}

function LinkButton({ href, children, tone = 'accent' }: { href: string; children: React.ReactNode; tone?: 'accent' | 'plain' }) {
  return (
    <Link
      href={href}
      className={`${BTN} w-full ${FOCUS} ${tone === 'accent' ? 'bg-accent text-accent-fg' : 'border border-stone-300 bg-white text-stone-900'}`}
    >
      {children}
    </Link>
  );
}

function RowSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className={`${CARD} divide-y divide-stone-100`} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-10 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── En-tête ──────────────────────────────────────────────────────────────────

function Greeting({ now }: { now: Date | null }) {
  if (!now) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
    );
  }
  const hello = zurichHour(now) < 18 ? 'Bonjour' : 'Bonsoir';
  return (
    <div>
      <p className="text-[15px] font-medium text-stone-600 first-letter:uppercase">{formatLongDate(now)}</p>
      <p className="mt-0.5 text-[28px] font-semibold leading-tight tracking-tight text-stone-950">{hello} Emmanuelle</p>
    </div>
  );
}

// ── Aujourd'hui ──────────────────────────────────────────────────────────────

function TodaySection({
  block,
  today,
  now,
  onRetry,
}: {
  block: Block<Booking[]>;
  today: string;
  now: Date | null;
  onRetry: () => void;
}) {
  const list = useMemo(() => {
    if (block.status !== 'ready') return [];
    return block.data
      .filter((b) => b.date_rdv === today && b.horaire_fixe && isLive(b))
      .sort((a, b) => a.heure_rdv.localeCompare(b.heure_rdv));
  }, [block, today]);

  const nextLine = useMemo(() => {
    if (!now) return null;
    const nm = minutesOfDay(now);
    const upcoming = list.filter((b) => b.statut !== 'termine' && toMinutes(b.heure_rdv) + (b.service_duree_minutes || 0) > nm);
    const b = upcoming[0];
    if (!b) return null;
    const started = toMinutes(b.heure_rdv) <= nm;
    return { b, started };
  }, [list, now]);

  return (
    <PageSection title="Aujourd’hui" action={{ label: 'Agenda', href: '/admin/reservations' }}>
      {block.status === 'loading' && <RowSkeleton rows={3} />}
      {block.status === 'error' && <ErrorCard message={block.message} onRetry={onRetry} />}
      {block.status === 'ready' &&
        (list.length === 0 ? (
          <EmptyState
            icon={Sun}
            title="Journée libre"
            description="Aucun rendez-vous à l’agenda aujourd’hui."
            action={<LinkButton href="/admin/reservations">Voir l’agenda</LinkButton>}
          />
        ) : (
          <>
            {now && (
              <p
                className={`rounded-2xl px-4 py-3 text-[15px] leading-snug ${
                  nextLine ? 'bg-accent-soft text-stone-900' : 'bg-stone-100 text-stone-700'
                }`}
              >
                {nextLine ? (
                  <>
                    <span className="font-semibold">{nextLine.started ? 'En cours' : 'Prochaine'} : </span>
                    {nextLine.started ? '' : `${heureFr(nextLine.b.heure_rdv)} — `}
                    {nextLine.b.prenom || fullName(nextLine.b)}, {nextLine.b.service_nom.toLowerCase()}
                  </>
                ) : (
                  'Les rendez-vous du jour sont terminés.'
                )}
              </p>
            )}
            <ListGroup label="Rendez-vous du jour">
              {list.map((b) => (
                <TimelineRow key={b.id} b={b} />
              ))}
            </ListGroup>
          </>
        ))}
    </PageSection>
  );
}

function TimelineRow({ b }: { b: Booking }) {
  const done = b.statut === 'termine';
  return (
    <div role="listitem" className="flex items-stretch">
      <Link
        href={`/admin/reservations?id=${b.id}`}
        className={`flex min-h-[68px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 active:bg-stone-100 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
      >
        <span className="w-14 shrink-0 text-center">
          <span className="block text-[18px] font-semibold leading-tight tabular-nums text-stone-950">{heureFr(b.heure_rdv)}</span>
          <span className="block text-[13px] leading-tight text-stone-600">{dureeFr(b.service_duree_minutes)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium leading-snug text-stone-950">{fullName(b)}</span>
          <span className="line-clamp-2 text-[14px] leading-snug text-stone-600">{soins(b)}</span>
          {b.statut !== 'confirme' && (
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {done && <Check size={12} aria-hidden="true" />}
              {STATUT_LABEL[b.statut]}
            </span>
          )}
        </span>
      </Link>
      {b.telephone && (
        <a
          href={telHref(b.telephone)}
          aria-label={`Appeler ${fullName(b)}`}
          className={`grid w-14 shrink-0 place-items-center border-l border-stone-100 text-accent active:bg-stone-100 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
        >
          <Phone size={20} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

// ── À rappeler ───────────────────────────────────────────────────────────────

function requestedWhen(b: Booking): string {
  const date = b.date_demandee ?? b.date_rdv;
  const periode = b.periode_demandee ?? b.periode;
  const day = formatShortDay(date);
  if (b.horaire_fixe) return `${day} à ${heureFr(b.heure_rdv)}`;
  return periode ? `${day} · ${PERIODE_LABEL[periode].toLowerCase()}` : day;
}

function CallbackCard({ b, now }: { b: Booking; now: Date | null }) {
  const total = b.total_chf ?? b.service_prix_chf;
  const when = requestedWhen(b);
  const msg = encodeURIComponent(
    `Bonjour ${b.prenom}, c'est Emmanuelle d'Emmanuelle Esthétique au sujet de votre demande de rendez-vous (${when}).`,
  );
  const age = ago(b.created_at, now);
  return (
    <article className={`${CARD} border-amber-200 p-4`} aria-label={`Demande de ${fullName(b)}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-semibold leading-snug first-letter:uppercase text-stone-950">{when}</p>
        {age && <p className="shrink-0 text-[13px] text-stone-600">{age}</p>}
      </div>
      <p className="mt-1 text-[16px] font-medium leading-snug text-stone-900">{fullName(b)}</p>
      <p className="mt-0.5 text-[14px] leading-snug text-stone-600">
        {soins(b)}
        {Number(total) > 0 && <span className="whitespace-nowrap"> · {formatCHF(Number(total))}</span>}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {b.telephone ? (
          <a href={telHref(b.telephone)} className={`${BTN} border border-stone-300 bg-white px-2 text-stone-900 ${FOCUS}`}>
            Appeler
          </a>
        ) : (
          <span className={`${BTN} border border-stone-200 px-2 text-stone-400`}>Sans numéro</span>
        )}
        {b.telephone ? (
          <a
            href={`https://wa.me/${waNumber(b.telephone)}?text=${msg}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BTN} border border-stone-300 bg-white px-2 text-stone-900 ${FOCUS}`}
          >
            WhatsApp
          </a>
        ) : (
          <span />
        )}
        <Link href={`/admin/reservations?id=${b.id}`} className={`${BTN} bg-accent px-2 text-accent-fg ${FOCUS}`}>
          Traiter
        </Link>
      </div>
    </article>
  );
}

function CallbackSection({ block, now, onRetry }: { block: Block<Booking[]>; now: Date | null; onRetry: () => void }) {
  const list = useMemo(() => {
    if (block.status !== 'ready') return [];
    return [...block.data].sort((a, b) =>
      `${a.date_demandee ?? a.date_rdv} ${a.heure_rdv}`.localeCompare(`${b.date_demandee ?? b.date_rdv} ${b.heure_rdv}`),
    );
  }, [block]);

  return (
    <PageSection
      title="À rappeler"
      description={block.status === 'ready' && list.length > 0 ? 'Appelez-les pour fixer l’horaire.' : undefined}
    >
      {block.status === 'loading' && <Skeleton className="h-36 w-full rounded-2xl" />}
      {block.status === 'error' && <ErrorCard message={block.message} onRetry={onRetry} />}
      {block.status === 'ready' &&
        (list.length === 0 ? (
          <div className={`${CARD} flex items-center gap-3 p-4`}>
            <CheckCircle2 size={24} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <p className="text-[15px] leading-snug text-stone-800">
              <span className="font-semibold">Rien à rappeler.</span> Toutes les demandes ont été traitées.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.slice(0, 3).map((b) => (
              <CallbackCard key={b.id} b={b} now={now} />
            ))}
            {list.length > 3 && (
              <LinkButton href="/admin/reservations?vue=a-traiter" tone="plain">
                Voir toutes ({list.length})
              </LinkButton>
            )}
          </div>
        ))}
    </PageSection>
  );
}

// ── Chiffres ─────────────────────────────────────────────────────────────────

function FiguresSection({
  data,
  caisseEnabled,
  onRetry,
}: {
  data: HomeData;
  caisseEnabled: boolean;
  onRetry: (k: HomeBlockKey) => void;
}) {
  const { schedule, money, today } = data;
  const tomorrow = today ? addDays(today, 1) : '';

  const counts = useMemo(() => {
    if (schedule.status !== 'ready' || !today) return null;
    const fixed = schedule.data.filter((b) => b.horaire_fixe && isLive(b));
    const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    const sunday = addDays(monday, 6);
    return {
      tomorrow: fixed.filter((b) => b.date_rdv === tomorrow).length,
      week: fixed.filter((b) => b.date_rdv >= monday && b.date_rdv <= sunday).length,
    };
  }, [schedule, today, tomorrow]);

  const delta =
    money.status === 'ready' && money.data.prevMonthToDate > 0
      ? ((money.data.month - money.data.prevMonthToDate) / money.data.prevMonthToDate) * 100
      : null;

  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

  return (
    <PageSection title="Chiffres">
      <div className="grid grid-cols-2 gap-3">
        {caisseEnabled &&
          (money.status === 'error' ? (
            <ErrorCard className="col-span-2" message={money.message} onRetry={() => onRetry('money')} />
          ) : (
            <>
              <StatTile
                label="Encaissé aujourd’hui"
                amount={money.status === 'ready' ? money.data.today : undefined}
                loading={money.status === 'loading'}
                hint={
                  money.status === 'ready'
                    ? money.data.todayCount > 0
                      ? plural(money.data.todayCount, 'encaissement', 'encaissements')
                      : 'Aucun encaissement'
                    : undefined
                }
                href="/admin/caisse/journal"
              />
              <StatTile
                label="Encaissé ce mois"
                amount={money.status === 'ready' ? money.data.month : undefined}
                loading={money.status === 'loading'}
                delta={delta}
                href="/admin/caisse/journal"
              />
            </>
          ))}
        {schedule.status === 'error' ? (
          <ErrorCard className="col-span-2" message={schedule.message} onRetry={() => onRetry('schedule')} />
        ) : (
          <>
            <StatTile
              label="Demain"
              value={counts ? plural(counts.tomorrow, 'rendez-vous', 'rendez-vous') : undefined}
              loading={schedule.status === 'loading'}
              href={`/admin/reservations?date=${tomorrow}`}
            />
            <StatTile
              label="Cette semaine"
              value={counts ? plural(counts.week, 'rendez-vous', 'rendez-vous') : undefined}
              loading={schedule.status === 'loading'}
              href="/admin/reservations"
            />
          </>
        )}
      </div>
      {caisseEnabled && delta !== null && (
        <p className="text-[13px] leading-snug text-stone-600">
          Variation du 1<sup>er</sup> au {dayOfMonth(today)} du mois, comparée à la même période du mois précédent.
        </p>
      )}
    </PageSection>
  );
}

// ── À surveiller ─────────────────────────────────────────────────────────────

function AlertRow({ href, icon: Icon, title, subtitle, tone }: { href: string; icon: React.ElementType; title: string; subtitle: string; tone: 'warn' | 'danger' }) {
  return (
    <div role="listitem">
      <Link
        href={href}
        className={`flex min-h-[60px] items-center gap-3 px-4 py-2.5 active:bg-stone-100 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium leading-snug text-stone-950">{title}</span>
          <span className="block truncate text-[14px] leading-snug text-stone-600">{subtitle}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />
      </Link>
    </div>
  );
}

function AlertsSection({ block, onRetry }: { block: Block<import('./homeTypes').AlertsData>; onRetry: () => void }) {
  if (block.status === 'loading') return null;
  if (block.status === 'error') {
    return (
      <PageSection title="À surveiller">
        <ErrorCard message={block.message} onRetry={onRetry} />
      </PageSection>
    );
  }
  const { lowStock, expiringCards } = block.data;
  if (lowStock.length === 0 && expiringCards.length === 0) return null;
  const stock = lowStock.slice(0, 4);
  return (
    <PageSection title="À surveiller">
      <ListGroup label="Alertes">
        {stock.map((p) => (
          <AlertRow
            key={p.id}
            href="/admin/caisse/produits"
            icon={Package}
            tone={p.stock <= 0 ? 'danger' : 'warn'}
            title={p.nom}
            subtitle={p.stock <= 0 ? 'En rupture de stock' : `Stock bas : plus que ${p.stock}`}
          />
        ))}
        {lowStock.length > stock.length && (
          <AlertRow
            href="/admin/caisse/produits"
            icon={Package}
            tone="warn"
            title={`+ ${lowStock.length - stock.length} autre${lowStock.length - stock.length > 1 ? 's' : ''} produit${lowStock.length - stock.length > 1 ? 's' : ''}`}
            subtitle="Voir le stock"
          />
        )}
        {expiringCards.slice(0, 3).map((c) => (
          <AlertRow
            key={c.id}
            href="/admin/caisse/bons"
            icon={Gift}
            tone="warn"
            title={`Bon cadeau ${c.code}`}
            subtitle={`${formatCHF(c.montantRestant)} · ${c.joursRestants <= 0 ? 'échoit aujourd’hui' : `échoit dans ${c.joursRestants} jour${c.joursRestants > 1 ? 's' : ''}`}`}
          />
        ))}
      </ListGroup>
    </PageSection>
  );
}

// ── Statistiques du site ─────────────────────────────────────────────────────

function SiteStatsCard({ block, onOpen, onRetry }: { block: Block<import('./homeTypes').SiteStatsData>; onOpen: () => void; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const fmt = (n: number) => n.toLocaleString('fr-CH');
  return (
    <section className={CARD} aria-label="Statistiques du site">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        className={`flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-2.5 text-left ${FOCUS}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <BarChart3 size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-[16px] font-medium text-stone-950">Statistiques du site</span>
        <ChevronDown size={20} className={`shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-stone-100 px-4 py-4">
          {block.status === 'loading' && <Skeleton className="h-16 w-full" />}
          {block.status === 'error' && <ErrorCard message={block.message} onRetry={onRetry} />}
          {block.status === 'ready' && (
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-stone-50 p-3">
                <dt className="text-[14px] text-stone-600">Visites aujourd’hui</dt>
                <dd className="mt-0.5 text-[24px] font-semibold tabular-nums text-stone-950">{fmt(block.data.today)}</dd>
              </div>
              <div className="rounded-xl bg-stone-50 p-3">
                <dt className="text-[14px] text-stone-600">7 derniers jours</dt>
                <dd className="mt-0.5 text-[24px] font-semibold tabular-nums text-stone-950">{fmt(block.data.week)}</dd>
              </div>
            </dl>
          )}
          <Link href="/admin/analytics" className={`inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-accent ${FOCUS} rounded-xl`}>
            Voir les statistiques détaillées <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Vue ──────────────────────────────────────────────────────────────────────

/** Logo du site (réglage `global_logo`), centré en tête de l'accueil ; le nom de l'entreprise sert de repli. */
function HomeLogo() {
  const settings = useSettings(['global_logo', 'business_name']);
  const [broken, setBroken] = useState(false);
  const logo = settings.global_logo;
  const name = settings.business_name || 'Emmanuelle Esthétique';
  return (
    <div className="flex justify-center pt-1">
      {logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} onError={() => setBroken(true)} className="h-14 w-auto max-w-[70%] object-contain" />
      ) : (
        <p className="text-[20px] font-semibold tracking-tight text-stone-900">{name}</p>
      )}
    </div>
  );
}

export default function MobileHomeView({ data, caisseEnabled, onRetry, onSiteStatsOpen, now: nowProp }: MobileHomeViewProps) {
  const now = useNow(nowProp);
  const pendingN = data.pending.status === 'ready' ? data.pending.data.length : 0;
  const pendingState = data.pending.status;

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <h1 className="sr-only">Accueil</h1>
      <HomeLogo />
      <Greeting now={now} />

      <PageSection title="Actions rapides" hideTitle>
        <div className="grid grid-cols-2 gap-3">
          {caisseEnabled && (
            <ActionTile
              icon={CreditCard}
              title="Encaisser"
              subtitle="Nouvelle vente"
              tone="accent"
              size="lg"
              href="/admin/caisse"
            />
          )}
          <ActionTile
            icon={CalendarPlus}
            title="Nouveau rendez‑vous"
            subtitle="Ajouter à l’agenda"
            size="lg"
            href="/admin/reservations?nouveau=1"
          />
          <ActionTile
            icon={PhoneCall}
            title="À rappeler"
            subtitle={
              pendingState === 'loading'
                ? 'Chargement…'
                : pendingState === 'error'
                  ? 'Indisponible'
                  : pendingN > 0
                    ? `${pendingN} demande${pendingN > 1 ? 's' : ''}`
                    : 'Rien en attente'
            }
            tone={pendingN > 0 ? 'warning' : 'default'}
            size="lg"
            href="/admin/reservations?vue=a-traiter"
          />
          {caisseEnabled && (
            <ActionTile
              icon={UserPlus}
              title="Nouvelle cliente"
              subtitle="Créer une fiche"
              size="lg"
              href="/admin/caisse/clients?nouvelle=1"
            />
          )}
        </div>
      </PageSection>

      <TodaySection block={data.schedule} today={data.today} now={now} onRetry={() => onRetry('schedule')} />
      <CallbackSection block={data.pending} now={now} onRetry={() => onRetry('pending')} />
      <FiguresSection data={data} caisseEnabled={caisseEnabled} onRetry={onRetry} />
      {caisseEnabled && <AlertsSection block={data.alerts} onRetry={() => onRetry('alerts')} />}

      <div className="space-y-3">
        <SiteStatsCard block={data.siteStats} onOpen={onSiteStatsOpen} onRetry={() => onRetry('siteStats')} />
        <InstallCard />
        <Link
          href="/admin/plus"
          className={`${CARD} flex min-h-[60px] items-center gap-3 px-4 py-2.5 active:bg-stone-100 ${FOCUS}`}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700">
            <LayoutGrid size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium text-stone-950">Voir tout</span>
            <span className="block text-[14px] text-stone-600">Pages, articles, réglages…</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-stone-400" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
