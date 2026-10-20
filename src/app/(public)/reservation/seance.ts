/**
 * La séance que compose la cliente : un soin principal (soin de la carte ou
 * offre du moment), puis d'autres soins ou des compléments qui s'enchaînent.
 *
 * Règles pures, sans React. Les prix et durées servent à l'affichage : le
 * serveur les recalcule à partir des seuls identifiants.
 */

import type { PublicOffer } from '../../../types/offers';
import type { PrestationItem, PrivilegeOption } from './catalog';
import { familyOf, getFamily, type FamilyId } from './families';

/** Nombre maximal de soins ajoutés au premier (limite du serveur). */
export const MAX_EXTRAS = 6;

export const OFFER_PREFIX = 'offre:';

/** Ce que la cliente a ajouté, dans l'ordre de ses clics. */
export interface Pick {
  /** Identifiant du catalogue, ou `offre:<uuid>`. */
  key: string;
  /** Durée choisie pour un soin à plusieurs durées (index dans `variants`). */
  variantIndex: number;
}

export interface SeanceLine {
  key: string;
  kind: 'offre' | 'soin' | 'complement';
  name: string;
  durationMinutes: number;
  priceChf: number;
  /** Durée de la variante choisie, à transmettre au serveur (`null` = durée par défaut). */
  variantMinutes: number | null;
  family: FamilyId | null;
  offerId: string | null;
}

export interface Catalogs {
  services: PrestationItem[];
  options: PrivilegeOption[];
  offers: PublicOffer[];
}

export function resolveLine(pick: Pick, c: Catalogs): SeanceLine | null {
  if (pick.key.startsWith(OFFER_PREFIX)) {
    const id = pick.key.slice(OFFER_PREFIX.length);
    const o = c.offers.find((x) => x.id === id);
    if (!o) return null;
    return {
      key: pick.key,
      kind: 'offre',
      name: o.titre,
      durationMinutes: o.duree_minutes,
      priceChf: o.prix_chf,
      variantMinutes: null,
      family: null,
      offerId: o.id,
    };
  }
  const s = c.services.find((x) => x.id === pick.key);
  if (s) {
    const v = s.variants?.[pick.variantIndex];
    return {
      key: s.id,
      kind: 'soin',
      name: s.name,
      durationMinutes: v?.durationMinutes ?? s.durationMinutes,
      priceChf: v?.priceChf ?? s.priceChf,
      variantMinutes: v ? v.durationMinutes : null,
      family: familyOf(s),
      offerId: null,
    };
  }
  const o = c.options.find((x) => x.id === pick.key);
  if (o) {
    return {
      key: o.id,
      kind: 'complement',
      name: o.nom,
      durationMinutes: o.duree_minutes,
      priceChf: o.prix_chf,
      variantMinutes: null,
      family: null,
      offerId: null,
    };
  }
  return null;
}

export interface Seance {
  /** Offre du moment s'il y en a une, sinon le premier soin choisi. */
  main: SeanceLine | null;
  extras: SeanceLine[];
  /** `main` puis `extras` : l'ordre affiché. */
  lines: SeanceLine[];
  durationMinutes: number;
  priceChf: number;
}

export function buildSeance(picks: Pick[], c: Catalogs): Seance {
  const all = picks.map((p) => resolveLine(p, c)).filter((l): l is SeanceLine => l !== null);
  const main = all.find((l) => l.kind === 'offre') ?? all.find((l) => l.kind === 'soin') ?? null;
  const extras = all.filter((l) => l !== main);
  const lines = main ? [main, ...extras] : extras;
  return {
    main,
    extras,
    lines,
    durationMinutes: lines.reduce((t, l) => t + l.durationMinutes, 0),
    priceChf: lines.reduce((t, l) => t + l.priceChf, 0),
  };
}

/**
 * Ajoute ou retire un élément. Une seule offre à la fois : en choisir une
 * remplace la précédente. Refuse (renvoie `null`) au-delà de la limite du serveur.
 */
export function togglePick(picks: Pick[], key: string, variantIndex = 0): Pick[] | null {
  if (picks.some((p) => p.key === key)) return picks.filter((p) => p.key !== key);
  const isOffer = key.startsWith(OFFER_PREFIX);
  const kept = isOffer ? picks.filter((p) => !p.key.startsWith(OFFER_PREFIX)) : picks;
  if (kept.length >= MAX_EXTRAS + 1) return null;
  const pick = { key, variantIndex };
  return isOffer ? [pick, ...kept] : [...kept, pick];
}

/** Un complément est-il pertinent pour ce soin ? (les teintures vont au regard, la boue marine au corps) */
function complementAffinity(o: PrivilegeOption): FamilyId | null {
  const n = o.nom.toLowerCase();
  if (/cils|sourcil|regard/.test(n)) return 'regard';
  if (/dos|boue/.test(n)) return 'corps';
  return null;
}

/** Compléments proposés : ceux qui vont avec le soin principal d'abord. */
export function rankComplements(options: PrivilegeOption[], main: SeanceLine | null): PrivilegeOption[] {
  const fam = main?.family ?? null;
  const score = (o: PrivilegeOption) => {
    const a = complementAffinity(o);
    if (a === null) return 1;
    return a === fam ? 0 : 2;
  };
  return [...options].sort((a, b) => score(a) - score(b));
}

/** Jusqu'à trois soins d'autres univers qui s'accordent avec le soin principal. */
export function suggestPairings(services: PrestationItem[], seance: Seance, max = 3): PrestationItem[] {
  const taken = new Set(seance.lines.map((l) => l.key));
  const order: FamilyId[] = seance.main?.family
    ? getFamily(seance.main.family).pairsWith
    : ['visage', 'corps', 'regard'];
  const out: PrestationItem[] = [];
  for (const fam of order) {
    const candidate = services.find((s) => familyOf(s) === fam && !taken.has(s.id) && !out.includes(s));
    if (candidate) out.push(candidate);
    if (out.length >= max) break;
  }
  return out;
}

/** `75` → `1h15`, `60` → `1h`, `45` → `45 min`. */
export function formatDuree(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Heure de fin d'une séance (`09:00` + 70 min → `10:10`). */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
