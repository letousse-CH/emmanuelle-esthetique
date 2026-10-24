/**
 * Photos du parcours « Offrir un bon cadeau » : prises en cabine à
 * Palézieux-Gare (bibliothèque médias, R2), toutes en portrait. Les univers de
 * soins reprennent celles de la réservation (`reservation/families.ts`).
 */
import { FAMILIES, type FamilyId } from '../../app/(public)/reservation/families';

const R2 = 'https://pub-e4b5844034214d1087c574b78e760bce.r2.dev';

export interface Visual { url: string; alt: string; focus?: string }

export const GIFT_VISUALS = {
  /** En-tête : les pots Phytomer, bleu profond. */
  hero: { url: `${R2}/1791296575733-cabine-soins-esthetiques-palezieux-gare-portrait_89C6862.CR2.webp`, alt: 'Soins Phytomer en cabine', focus: 'center 45%' },
  /** « Un montant » : le bocal de coquillages, comme sur le bon imprimé. */
  montant: { url: `${R2}/1791296566952-cabine-soins-esthetiques-palezieux-gare-portrait_89C6848.CR2.webp`, alt: 'Bocal de coquillages dans la cabine', focus: 'center 60%' },
  /** « Des soins » : modelage du visage. */
  soins: { url: `${R2}/1790588946469-soins-esthetiques-palezieux-gare-portrait2.jpg`, alt: 'Modelage du visage pendant un soin Phytomer', focus: 'center 38%' },
  /** « Pour qui ? » : deux tasses, un moment partagé. */
  pour: { url: `${R2}/1791296582160-cabine-soins-esthetiques-palezieux-gare-portrait_89C6871.CR2.webp`, alt: 'Deux tasses de thé en cabine', focus: 'center 55%' },
  /** Coordonnées : le sérum Hydralgue. */
  coord: { url: `${R2}/1791296579020-cabine-soins-esthetiques-palezieux-gare-portrait_89C6866.CR2.webp`, alt: 'Sérum Phytomer Hydralgue', focus: 'center 40%' },
  /** Paiement : l'eau et les algues. */
  marin: { url: `${R2}/1790598352885-Algues-marines.jpg`, alt: 'Algues marines sous l’eau', focus: 'center' },
} satisfies Record<string, Visual>;

export function familyVisual(id: FamilyId): Visual {
  const f = FAMILIES.find((x) => x.id === id) ?? FAMILIES[0];
  return { url: f.image, alt: f.imageAlt, focus: f.focus };
}

export function familyTitle(id: FamilyId): { title: string; tagline: string } {
  const f = FAMILIES.find((x) => x.id === id) ?? FAMILIES[0];
  return { title: f.title, tagline: f.tagline };
}
