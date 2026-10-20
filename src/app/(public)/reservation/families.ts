/**
 * Les cinq univers de soins du formulaire de réservation, tels que le site les
 * présente (une page pilier chacun, voir `carteSoins.ts`).
 *
 * L'API range les soins en quatre catégories (`visage`, `corps`, `epilation`,
 * `services`) : `services` réunit mains, pieds et réhaussement de cils. Le
 * formulaire les sépare en « Mains & pieds » et « Regard », comme la carte.
 *
 * Les photos sont celles des pages piliers (bibliothèque médias, R2), toutes en
 * format portrait : les visuels « paysage » de la bibliothèque portent un
 * bandeau en pied qui se verrait une fois recadrés.
 */

import { getCategory, type CarteCategoryId } from '../../../constants/carteSoins';
import type { PrestationItem } from './catalog';

export type FamilyId = CarteCategoryId;

export interface Family {
  id: FamilyId;
  /** Libellé court de la vignette. */
  label: string;
  /** Titre de la rubrique, celui de la carte. */
  title: string;
  tagline: string;
  /** Page pilier du site. */
  path: string;
  image: string;
  imageAlt: string;
  /** Cadrage de la photo dans le bandeau large (`object-position`). */
  focus: string;
  /** Univers proposés en accompagnement, du plus naturel au moins évident. */
  pairsWith: FamilyId[];
}

const R2 = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev';

const VISUALS: Record<FamilyId, { label: string; image: string; imageAlt: string; focus: string; pairsWith: FamilyId[] }> = {
  visage: {
    label: 'Visage',
    image: `${R2}/1790588946469-soins-esthetiques-palezieux-gare-portrait2.jpg`,
    imageAlt: 'Modelage du visage pendant un soin Phytomer',
    focus: 'center 38%',
    pairsWith: ['corps', 'regard', 'mains-pieds'],
  },
  corps: {
    label: 'Corps',
    image: `${R2}/1790588957135-soins-esthetiques-palezieux-gare-portrait9.jpg`,
    imageAlt: 'Massage relaxant du dos',
    focus: 'center 72%',
    pairsWith: ['visage', 'mains-pieds', 'regard'],
  },
  'mains-pieds': {
    label: 'Mains & pieds',
    image: `${R2}/1790588963448-soins-esthetiques-palezieux-gare-portrait14.jpg`,
    imageAlt: 'Soin des mains',
    focus: 'center 50%',
    pairsWith: ['mains-pieds', 'visage', 'regard'],
  },
  regard: {
    label: 'Regard',
    image: `${R2}/1790588973449-soins-esthetiques-palezieux-gare-portrait19.jpg`,
    imageAlt: 'Cils recourbés après un réhaussement',
    focus: 'center 45%',
    pairsWith: ['visage', 'mains-pieds', 'corps'],
  },
  epilation: {
    label: 'Épilation',
    image: `${R2}/1790596693340-epilation--1-.jpg`,
    imageAlt: 'Pâte de sucre pour l’épilation',
    focus: 'center 55%',
    pairsWith: ['regard', 'mains-pieds', 'visage'],
  },
};

export const FAMILY_ORDER: FamilyId[] = ['visage', 'corps', 'mains-pieds', 'regard', 'epilation'];

export const FAMILIES: Family[] = FAMILY_ORDER.map((id) => {
  const c = getCategory(id);
  return { id, title: c.label, tagline: c.tagline, path: c.path, ...VISUALS[id] };
});

export function getFamily(id: FamilyId): Family {
  return FAMILIES.find((f) => f.id === id) ?? FAMILIES[0];
}

/** Univers d'un soin du catalogue de réservation. */
export function familyOf(item: Pick<PrestationItem, 'category' | 'name'>): FamilyId {
  if (item.category !== 'services') return item.category;
  return /cils|sourcil|regard|rehauss|réhauss/i.test(item.name) ? 'regard' : 'mains-pieds';
}

/** `?category=` : les anciens liens écrivent encore `services`. */
export function familyFromParam(v: string | null | undefined): FamilyId | null {
  if (!v) return null;
  if (v === 'services' || v === 'mains-et-pieds') return 'mains-pieds';
  return (FAMILY_ORDER as string[]).includes(v) ? (v as FamilyId) : null;
}
