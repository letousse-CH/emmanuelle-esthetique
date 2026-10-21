"use client";

/**
 * Éléments d'interface du formulaire de réservation (styles `rsv-*`,
 * reservation.css). Aucun appel réseau ici : tout l'état vit dans
 * `ReservationClient`.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  DoorClosed,
  Plus,
  UserRoundCheck,
  Wallet,
  X,
} from 'lucide-react';
import type { PublicOffer } from '../../../types/offers';
import { formatOfferDuration, formatOfferPeriod } from '../../../types/offers';
import { optimizedImgProps } from '../../../utils/imageOptim';
import type { PrestationItem, PrivilegeOption } from './catalog';
import { chf } from './format';
import { familyOf, getFamily, type Family } from './families';
import { formatDuree, type Pick, type Seance } from './seance';

// ── Étapes ───────────────────────────────────────────────────────────────────

export type StepNum = 1 | 2 | 3 | 4;

const STEPS: Array<{ num: 1 | 2 | 3; label: string }> = [
  { num: 1, label: 'Vos soins' },
  { num: 2, label: 'Date & heure' },
  { num: 3, label: 'Coordonnées' },
];

export function Stepper({ step, onGo }: { step: StepNum; onGo: (s: StepNum) => void }) {
  return (
    <nav className="rsv-steps" aria-label="Étapes de réservation">
      <div className="rsv-container">
        <ol>
          {STEPS.map((s, i) => {
            const active = s.num === step;
            const done = s.num < step;
            return (
              <li key={s.num}>
                <button
                  type="button"
                  className={`rsv-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                  onClick={() => done && onGo(s.num)}
                  disabled={!done && !active}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Étape ${i + 1} sur ${STEPS.length} : ${s.label}${done ? ' (terminée, revenir)' : active ? ' (en cours)' : ''}`}
                >
                  <span className="rsv-step__num" aria-hidden="true">
                    {done ? <Check /> : `0${i + 1}`}
                  </span>
                  <span className="rsv-step__label" aria-hidden="true">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

// ── Engagements de l'institut ────────────────────────────────────────────────

export function Assurances({ ownerFirstName }: { ownerFirstName?: string }) {
  return (
    <ul className="rsv-assure">
      <li>
        <Wallet aria-hidden="true" />
        Aucun paiement en ligne : vous réglez sur place
      </li>
      <li>
        <UserRoundCheck aria-hidden="true" />
        {ownerFirstName ? `${ownerFirstName} confirme personnellement` : 'Confirmation personnelle'} votre rendez-vous
      </li>
      <li>
        <DoorClosed aria-hidden="true" />
        Cabine privée : une seule cliente à la fois
      </li>
    </ul>
  );
}

// ── Offre du moment ──────────────────────────────────────────────────────────

export function OfferCard({
  offer,
  picked,
  disabled,
  onToggle,
}: {
  offer: PublicOffer;
  picked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const places = offer.places_restantes;
  return (
    <article className="rsv-offer" aria-labelledby={`rsv-offre-${offer.id}`}>
      {offer.image_url && (
        <div className="rsv-offer__img">
          {/* Visuel carré, cadré comme partout ailleurs (site, caisse, admin). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...optimizedImgProps(offer.image_url, '(min-width: 1280px) 280px, (min-width: 640px) 240px, 100vw')} alt="" />
        </div>
      )}
      <div className="rsv-offer__body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/algue.svg" alt="" aria-hidden="true" className="rsv-offer__algue" />
        <div className="rsv-eyebrow">Offre du moment · {formatOfferPeriod(offer.date_debut, offer.date_fin)}</div>
        <h3 id={`rsv-offre-${offer.id}`} className="rsv-offer__title">{offer.titre}</h3>
        <div className="rsv-offer__meta">
          <span className="rsv-offer__price">{chf(offer.prix_chf)}</span>
          {offer.prix_normal_chf != null && offer.prix_normal_chf > offer.prix_chf && (
            <span>
              au lieu de <span className="rsv-offer__was">{chf(offer.prix_normal_chf)}</span>
            </span>
          )}
          <span>{formatOfferDuration(offer.duree_minutes)}</span>
          {places != null && (
            <span>
              {places === 1 ? 'Dernière place' : places <= 5 ? `Plus que ${places} places` : `${places} places disponibles`}
            </span>
          )}
        </div>
        <div className="rsv-offer__foot">
          {offer.conditions ? <div className="rsv-offer__conditions">{offer.conditions}</div> : <span />}
          <AddButton picked={picked} disabled={disabled} onClick={onToggle} name={offer.titre} />
        </div>
      </div>
    </article>
  );
}

// ── Bouton « Ajouter » ───────────────────────────────────────────────────────

export function AddButton({
  picked,
  disabled,
  onClick,
  name,
  round,
}: {
  picked: boolean;
  disabled?: boolean;
  onClick: () => void;
  name: string;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rsv-add${round ? ' rsv-add--round' : ''}`}
      aria-pressed={picked}
      disabled={disabled && !picked}
      onClick={onClick}
      aria-label={round ? `${picked ? 'Retirer' : 'Ajouter'} ${name}${picked ? ' de' : ' à'} votre séance` : undefined}
      title={disabled && !picked ? 'Vous avez atteint le nombre maximal de soins pour une séance.' : undefined}
    >
      {picked ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      {!round && (picked ? 'Ajouté' : 'Ajouter')}
      {!round && <span className="sr-only"> {name}{picked ? ' (dans votre séance, cliquer pour retirer)' : ' à votre séance'}</span>}
    </button>
  );
}

// ── Univers ──────────────────────────────────────────────────────────────────

export interface FamilyEntry {
  family: Family;
  count: number;
  picked: number;
}

/** Barre collante des univers : un raccourci vers chaque section, qui suit le défilement. */
export function FamilyNav({
  families,
  active,
  onSelect,
}: {
  families: FamilyEntry[];
  active: string;
  onSelect: (id: Family['id']) => void;
}) {
  // Sur téléphone la barre défile en largeur : l'univers en cours y reste visible.
  const innerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const inner = innerRef.current;
    const item = inner?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!inner || !item || inner.scrollWidth <= inner.clientWidth) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    inner.scrollTo({
      left: Math.max(0, item.offsetLeft - (inner.clientWidth - item.offsetWidth) / 2),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [active]);

  return (
    <nav className="rsv-fnav" aria-label="Univers de soins">
      <div className="rsv-fnav__inner" ref={innerRef}>
        {families.map(({ family, count, picked }) => (
          <button
            key={family.id}
            type="button"
            className="rsv-fnav__item"
            aria-current={active === family.id ? 'true' : undefined}
            aria-controls={`rsv-f-${family.id}`}
            onClick={() => onSelect(family.id)}
          >
            <span className="rsv-fnav__thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img {...optimizedImgProps(family.image, '40px', [384])} alt="" decoding="async" />
            </span>
            <span>
              <span className="rsv-fnav__label">{family.label}</span>
              <span className="rsv-fnav__count">
                {picked > 0 ? (
                  <span className="rsv-fnav__picked">
                    {picked} choisi{picked > 1 ? 's' : ''}
                  </span>
                ) : (
                  `${count} soin${count > 1 ? 's' : ''}`
                )}
              </span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Une rubrique de la carte : grand bandeau photo, accroche, puis ses soins. */
export function FamilySection({
  entry,
  sectionRef,
  children,
}: {
  entry: FamilyEntry;
  sectionRef: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const { family, count } = entry;
  return (
    <section id={`rsv-f-${family.id}`} ref={sectionRef} className="rsv-fsec" aria-labelledby={`rsv-f-${family.id}-titre`}>
      <div className="rsv-fsec__banner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...optimizedImgProps(family.image, '(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw', [640, 828, 1200])}
          alt={family.imageAlt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: family.focus }}
        />
        <div className="rsv-fsec__caption">
          <div className="rsv-eyebrow">
            {family.label} · {count} soin{count > 1 ? 's' : ''}
          </div>
          <h2 id={`rsv-f-${family.id}-titre`} className="rsv-h2">
            {family.title}
          </h2>
        </div>
      </div>
      <div className="rsv-fsec__intro">
        <div className="rsv-lead">{family.tagline}</div>
        <Link href={family.path} target="_blank" className="rsv-link">
          En savoir plus
          <ArrowRight aria-hidden="true" />
          <span className="sr-only"> sur ces soins (s&apos;ouvre dans un nouvel onglet)</span>
        </Link>
      </div>
      <div className="rsv-soins">{children}</div>
    </section>
  );
}

/** Compléments proposés juste sous le soin principal, au moment où on le choisit. */
export function QuickComplements({
  options,
  picks,
  full,
  onToggle,
}: {
  options: PrivilegeOption[];
  picks: Pick[];
  full: boolean;
  onToggle: (key: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="rsv-quick" role="group" aria-label="Compléments pour ce soin">
      <span className="rsv-quick__label">Pour le sublimer</span>
      {options.map((o) => {
        const picked = picks.some((p) => p.key === o.id);
        return (
          <button
            key={o.id}
            type="button"
            className="rsv-chip"
            aria-pressed={picked}
            disabled={full && !picked}
            onClick={() => onToggle(o.id)}
          >
            {picked ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
            <span>{shortComplementName(o.nom)}</span>
            <span className="rsv-chip__price">
              + {chf(o.prix_chf)} · {formatDuree(o.duree_minutes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** « Option Boue Marine Auto-Chauffante Dos » → « Boue Marine Auto-Chauffante Dos ». */
function shortComplementName(nom: string): string {
  return nom.replace(/^option\s+/i, '').replace(/^./, (c) => c.toUpperCase());
}

// ── Un soin de la carte ──────────────────────────────────────────────────────

export function SoinRow({
  item,
  pick,
  full,
  onToggle,
  onVariant,
  children,
}: {
  item: PrestationItem;
  pick: Pick | undefined;
  full: boolean;
  onToggle: (variantIndex: number) => void;
  onVariant: (variantIndex: number) => void;
  /** Affiché sous le soin une fois choisi (compléments proposés). */
  children?: React.ReactNode;
}) {
  const [localVariant, setLocalVariant] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const variantIndex = pick ? pick.variantIndex : localVariant;
  const v = item.variants?.[variantIndex];
  const price = v?.priceChf ?? item.priceChf;
  const duration = v?.durationLabel ?? item.durationLabel;
  // Sur téléphone, une longue description se replie en trois lignes (la carte se parcourt d'un coup d'œil).
  const longDesc = (item.description?.length ?? 0) > 150;
  const descId = `rsv-desc-${item.id}`;

  return (
    <div className={`rsv-soin${pick ? ' is-picked' : ''}`}>
      <div>
        {item.tag && <div className="rsv-soin__tag">{item.tag}</div>}
        <h3 className="rsv-soin__name">{item.name}</h3>
        {item.description && (
          <div id={descId} className={`rsv-soin__desc${longDesc && !expanded ? ' is-clamped' : ''}`}>
            {item.description}
          </div>
        )}
        {longDesc && (
          <button
            type="button"
            className="rsv-more"
            aria-expanded={expanded}
            aria-controls={descId}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Réduire' : 'Lire la suite'}
          </button>
        )}
        {item.variants && item.variants.length > 1 && (
          <div className="rsv-variants" role="group" aria-label={`Durée : ${item.name}`}>
            {item.variants.map((vv, idx) => (
              <button
                key={vv.durationMinutes}
                type="button"
                className="rsv-variant"
                aria-pressed={variantIndex === idx}
                onClick={() => (pick ? onVariant(idx) : setLocalVariant(idx))}
              >
                <strong>{vv.durationLabel}</strong>
                {chf(vv.priceChf)}
              </button>
            ))}
          </div>
        )}
        {pick && children}
      </div>
      <div className="rsv-soin__side">
        <div className="rsv-price">
          <div className="rsv-price__amount">{chf(price)}</div>
          <div className="rsv-price__dur">
            <Clock aria-hidden="true" />
            {duration}
          </div>
        </div>
        <AddButton picked={!!pick} disabled={full} onClick={() => onToggle(variantIndex)} name={item.name} />
      </div>
    </div>
  );
}

export function SoinSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rsv-skeleton">
          <span style={{ width: '18%' }} />
          <span style={{ width: '56%', height: 18 }} />
          <span style={{ width: '82%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Prolonger le moment ──────────────────────────────────────────────────────

export function PlusSection({
  id,
  mainName,
  complements,
  pairings,
  picks,
  full,
  onToggle,
}: {
  id: string;
  mainName: string;
  complements: PrivilegeOption[];
  pairings: PrestationItem[];
  picks: Pick[];
  full: boolean;
  onToggle: (key: string) => void;
}) {
  if (complements.length === 0 && pairings.length === 0) return null;
  const isPicked = (key: string) => picks.some((p) => p.key === key);
  return (
    <section id={id} className="rsv-plus animate-fadein" aria-labelledby={`${id}-titre`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/algue.svg" alt="" aria-hidden="true" className="rsv-plus__algue" />
      <div className="rsv-section-head" style={{ marginBottom: 0 }}>
        <div className="rsv-eyebrow">Pour prolonger le moment</div>
        <h2 id={`${id}-titre`} className="rsv-h2">Complétez votre séance</h2>
        <div className="rsv-lead">
          Ajoutés à « {mainName} », ils s’enchaînent dans la même séance, sans attente : la durée totale vous est
          réservée.
        </div>
      </div>

      {complements.length > 0 && (
        <div>
          <div className="rsv-plus__group-title">Les compléments</div>
          {complements.map((o) => {
            const picked = isPicked(o.id);
            return (
              <div key={o.id} className="rsv-extra">
                <div>
                  <div className="rsv-extra__name">{o.nom}</div>
                  {o.description && <div className="rsv-extra__desc">{o.description}</div>}
                </div>
                <div className="rsv-extra__price">
                  <span className="rsv-serif">+ {chf(o.prix_chf)}</span>
                  <span className="rsv-muted">+ {formatDuree(o.duree_minutes)}</span>
                </div>
                <AddButton round picked={picked} disabled={full} onClick={() => onToggle(o.id)} name={o.nom} />
              </div>
            );
          })}
        </div>
      )}

      {pairings.length > 0 && (
        <div>
          <div className="rsv-plus__group-title">Ils s’accordent avec votre soin</div>
          <div className="rsv-pairs">
            {pairings.map((s) => {
              const fam = getFamily(familyOf(s));
              return (
                <div key={s.id} className="rsv-pair">
                  <div className="rsv-pair__img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...optimizedImgProps(fam.image, '(min-width: 640px) 240px, 92px', [384, 640])}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="rsv-pair__body">
                    <div className="rsv-pair__family">{fam.label}</div>
                    <div className="rsv-pair__name">{s.name}</div>
                    <div className="rsv-pair__foot">
                      <div className="rsv-pair__meta">
                        <span className="rsv-serif">{chf(s.priceChf)}</span> · {s.durationLabel}
                      </div>
                      <AddButton round picked={isPicked(s.id)} disabled={full} onClick={() => onToggle(s.id)} name={s.name} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Récapitulatif « Votre séance » ───────────────────────────────────────────

export interface SummaryProps {
  seance: Seance;
  /** « mardi 21 octobre 2026 » et « 10h00 à 11h15 », une fois choisis. */
  when: { day: string; time: string } | null;
  onRemove: (key: string) => void;
  /** Bouton d'action de l'étape (choisir la date, continuer, envoyer). */
  cta: React.ReactNode;
  /** Message sous le bouton (ce qui manque pour continuer). */
  hint?: string | null;
  /** Invitation à ajouter un complément, à l'étape des soins. */
  nudge?: { label: string; onClick: () => void } | null;
  ownerFirstName?: string;
  /** Lignes non modifiables (après l'étape des soins) : on revient à l'étape 1 pour les changer. */
  locked?: boolean;
  onEdit?: () => void;
}

export function SeanceSummary({ seance, when, onRemove, cta, hint, nudge, ownerFirstName, locked, onEdit }: SummaryProps) {
  const count = seance.lines.length;
  return (
    <div className="rsv-summary">
      <div className="rsv-summary__head">
        <div className="rsv-summary__top">
          <div className="rsv-eyebrow">Votre séance</div>
          {locked && onEdit && (
            <button type="button" className="rsv-line__remove" onClick={onEdit}>
              Modifier<span className="sr-only"> mes soins</span>
            </button>
          )}
        </div>
        <div className="rsv-summary__title">
          {count === 0 ? 'À composer' : `${count} soin${count > 1 ? 's' : ''} · ${formatDuree(seance.durationMinutes)}`}
        </div>
      </div>

      {count === 0 ? (
        <div className="rsv-summary__empty">
          Choisissez un premier soin : vous pourrez ensuite lui associer un complément ou un autre soin, qui
          s’enchaîneront dans la même séance.
        </div>
      ) : (
        <>
          <ul className="rsv-lines">
            {seance.lines.map((l) => (
              <li key={l.key} className="rsv-line">
                <div className="rsv-line__name">
                  {l.kind !== 'soin' || l !== seance.main ? (
                    <span className="rsv-line__kind">
                      {l.kind === 'offre' ? 'Offre du moment' : l.kind === 'complement' ? 'Complément' : 'En plus'}
                    </span>
                  ) : null}
                  {l.name}
                </div>
                <div className="rsv-line__price">{chf(l.priceChf)}</div>
                <div className="rsv-line__meta">{formatDuree(l.durationMinutes)}</div>
                {!locked && (
                  <button type="button" className="rsv-line__remove" onClick={() => onRemove(l.key)}>
                    Retirer<span className="sr-only"> {l.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="rsv-totals">
            <div className="rsv-totals__row">
              <span>Durée totale</span>
              <span>{formatDuree(seance.durationMinutes)}</span>
            </div>
            <div className="rsv-totals__row rsv-totals__row--total">
              <span>Total</span>
              <span key={seance.priceChf} className="rsv-serif rsv-bump">
                {chf(seance.priceChf)}
              </span>
            </div>
            <div className="rsv-totals__note">À régler sur place, le jour de votre soin.</div>
          </div>
        </>
      )}

      {when && (
        <div className="rsv-when">
          <CalendarDays aria-hidden="true" />
          <div>
            <strong>
              <span>{when.day}</span>
            </strong>
            {when.time}
          </div>
        </div>
      )}

      <div className="rsv-summary__cta">
        {nudge && (
          <button type="button" className="rsv-nudge" onClick={nudge.onClick}>
            <Plus aria-hidden="true" />
            <span>{nudge.label}</span>
          </button>
        )}
        {cta}
        {hint && <div className="rsv-summary__hint">{hint}</div>}
      </div>

      <Assurances ownerFirstName={ownerFirstName} />
    </div>
  );
}

// ── Barre du bas (mobile, tablette) ──────────────────────────────────────────

export function MobileBar({
  seance,
  step,
  open,
  hidden,
  onToggle,
  cta,
  barRef,
}: {
  seance: Seance;
  step: 1 | 2 | 3;
  open: boolean;
  /** Escamotée pendant la saisie (le clavier occupe déjà le bas de l'écran). */
  hidden?: boolean;
  onToggle: () => void;
  cta: React.ReactNode;
  barRef?: React.Ref<HTMLDivElement>;
}) {
  const count = seance.lines.length;
  return (
    <div className={`rsv-bar${hidden ? ' is-hidden' : ''}`} id="rsv-bar" ref={barRef}>
      <div className="rsv-bar__progress" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? 'is-on' : undefined} />
        ))}
      </div>
      <div className="rsv-bar__inner">
        <button
          type="button"
          className="rsv-bar__toggle"
          aria-expanded={open}
          aria-controls="rsv-drawer"
          onClick={onToggle}
          disabled={count === 0}
        >
          <span className="rsv-bar__label">
            {count > 0 ? (
              <>
                <span className="sr-only">Votre séance : </span>
                {count} soin{count > 1 ? 's' : ''}
              </>
            ) : (
              'Votre séance'
            )}
            {count > 0 && <ChevronDown aria-hidden="true" />}
          </span>
          <span className="rsv-bar__total">
            {count === 0 ? (
              <span className="rsv-muted">Choisissez un soin</span>
            ) : (
              <>
                <span key={seance.priceChf} className="rsv-bump">{chf(seance.priceChf)}</span>{' '}
                <span className="rsv-muted">· {formatDuree(seance.durationMinutes)}</span>
              </>
            )}
          </span>
        </button>
        {cta}
      </div>
    </div>
  );
}

// ── Volet « Votre séance » (mobile, tablette) ────────────────────────────────

/**
 * Volet qui monte du bas de l'écran, au-dessus de la barre (dont le bouton
 * reste utilisable). Se ferme d'un glissement vers le bas, d'un toucher sur le
 * voile, par la croix ou par Échap ; la page dessous ne défile plus.
 */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      setDragY(0);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    startY.current = null;
    if (dragY > 72) onClose();
    else setDragY(0);
  };

  return (
    <>
      <button type="button" className="rsv-scrim" aria-label="Fermer le récapitulatif" tabIndex={-1} onClick={onClose} />
      <div
        id="rsv-drawer"
        role="dialog"
        aria-label="Votre séance"
        className={`rsv-drawer${dragY ? ' is-dragging' : ''}`}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div className="rsv-sheet__head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="rsv-sheet__handle" aria-hidden="true" />
          <button ref={closeRef} type="button" className="rsv-sheet__close" onClick={onClose} aria-label="Fermer le récapitulatif">
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/**
 * Confirmation furtive d'un ajout, au-dessus de la barre du bas. Un toucher
 * ouvre la séance. Purement visuelle : la région `aria-live` de la page
 * annonce déjà l'ajout aux lecteurs d'écran.
 */
export function AddedToast({ toast, onOpen }: { toast: { id: number; text: string } | null; onOpen: () => void }) {
  if (!toast) return null;
  return (
    <button key={toast.id} type="button" className="rsv-toast" onClick={onOpen} tabIndex={-1} aria-hidden="true">
      <Check />
      <span className="rsv-toast__text">
        <strong>Ajouté</strong> · {toast.text}
      </span>
      <span className="rsv-toast__cta">Voir</span>
    </button>
  );
}

export function NextIcon() {
  return <ArrowRight aria-hidden="true" />;
}
