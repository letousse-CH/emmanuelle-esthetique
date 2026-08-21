import type { ComponentType } from 'react';
import {
  Hero1, type Hero1Data,
  Hero2, type Hero2Data,
  Hero3, type Hero3Data,
  Hero4, type Hero4Data,
  Hero5, type Hero5Data,
  Intro1, type Intro1Data,
  Features1, type Features1Data,
  Features2, type Features2Data,
  Features3, type Features3Data,
  Cta1, type Cta1Data,
  Testimonial1, type Testimonial1Data,
  Text1, type Text1Data,
  TextImage1, type TextImage1Data,
  GalleryGrid, type GalleryGridData,
  GalleryCarousel, type GalleryCarouselData,
  GalleryMasonry, type GalleryMasonryData,
  Faq1, type Faq1Data,
  Reviews1, type Reviews1Data,
  Marquee1, type Marquee1Data,
  Pricing1, type Pricing1Data,
  Stats1, type Stats1Data,
  Timeline1, type Timeline1Data,
  Logos1, type Logos1Data,
} from './sections';

import {
  Cta2, type Cta2Data,
  Cta3, type Cta3Data,
  Testimonial2, type Testimonial2Data,
  Team1, type Team1Data,
  Contact1, type Contact1Data,
  Steps1, type Steps1Data,
  Stats2, type Stats2Data,
  Faq2, type Faq2Data,
  Compare1, type Compare1Data,
  Banner1, type Banner1Data,
  HeroVideo, type HeroVideoData,
  Pricing2, type Pricing2Data,
  Stats3, type Stats3Data,
  Newsletter1, type Newsletter1Data,
  BentoGrid1, type BentoGrid1Data,
} from './sections.extra';

import { SECTION_META } from './sectionMeta';

export type SectionType =
  | 'hero_1'
  | 'hero_2'
  | 'hero_3'
  | 'hero_4'
  | 'hero_5'
  | 'intro_1'
  | 'features_1'
  | 'features_2'
  | 'features_3'
  | 'cta_1'
  | 'testimonial_1'
  | 'text_1'
  | 'text_image_1'
  | 'gallery_grid'
  | 'gallery_carousel'
  | 'gallery_masonry'
  | 'faq_1'
  | 'reviews_1'
  | 'marquee_1'
  | 'pricing_1'
  | 'stats_1'
  | 'timeline_1'
  | 'logos_1'
  | 'cta_2'
  | 'cta_3'
  | 'testimonial_2'
  | 'team_1'
  | 'contact_1'
  | 'steps_1'
  | 'stats_2'
  | 'faq_2'
  | 'compare_1'
  | 'banner_1'
  | 'hero_video'
  | 'pricing_2'
  | 'stats_3'
  | 'newsletter_1'
  | 'bento_grid_1';

export type SectionData =
  | Hero1Data
  | Hero2Data
  | Hero3Data
  | Hero4Data
  | Hero5Data
  | Intro1Data
  | Features1Data
  | Features2Data
  | Features3Data
  | Cta1Data
  | Testimonial1Data
  | Text1Data
  | TextImage1Data
  | GalleryGridData
  | GalleryCarouselData
  | GalleryMasonryData
  | Faq1Data
  | Reviews1Data
  | Marquee1Data
  | Pricing1Data
  | Stats1Data
  | Timeline1Data
  | Logos1Data
  | Cta2Data
  | Cta3Data
  | Testimonial2Data
  | Team1Data
  | Contact1Data
  | Steps1Data
  | Stats2Data
  | Faq2Data
  | Compare1Data
  | Banner1Data
  | HeroVideoData
  | Pricing2Data
  | Stats3Data
  | Newsletter1Data
  | BentoGrid1Data;

export interface PageSection {
  type: SectionType;
  data: SectionData;
}

interface WireframeEntry {
  component: ComponentType<{ data: any; sectionIndex?: number }>;
  description: string;
  dataSchema: Record<string, string>;
}

/**
 * Association type de section → composant.
 *
 * ⚠️ La description et le schéma de champs de chaque section **ne sont plus
 * écrits ici**. Ils vivaient en double, dans ce fichier et dans
 * `sectionMeta.ts` : cinq cents lignes recopiées, que rien ne tenait
 * synchronisées. Modifier un champ dans l'un laissait l'autre en arrière — et
 * comme l'éditeur lit ce registre tandis que les routes IA lisent les
 * métadonnées, l'écran de configuration et le modèle ne voyaient déjà plus les
 * mêmes champs.
 *
 * Ce fichier ne décide plus que d'une chose : quel composant rend quel type.
 */
const SECTION_COMPONENTS: Record<SectionType, ComponentType<{ data: any; sectionIndex?: number }>> = {
  hero_1: Hero1,
  hero_2: Hero2,
  hero_3: Hero3,
  hero_4: Hero4,
  hero_5: Hero5,
  intro_1: Intro1,
  features_1: Features1,
  features_2: Features2,
  features_3: Features3,
  cta_1: Cta1,
  testimonial_1: Testimonial1,
  text_1: Text1,
  text_image_1: TextImage1,
  gallery_grid: GalleryGrid,
  gallery_carousel: GalleryCarousel,
  gallery_masonry: GalleryMasonry,
  faq_1: Faq1,
  reviews_1: Reviews1,
  marquee_1: Marquee1,
  pricing_1: Pricing1,
  stats_1: Stats1,
  timeline_1: Timeline1,
  logos_1: Logos1,
  cta_2: Cta2,
  cta_3: Cta3,
  testimonial_2: Testimonial2,
  team_1: Team1,
  contact_1: Contact1,
  steps_1: Steps1,
  stats_2: Stats2,
  faq_2: Faq2,
  compare_1: Compare1,
  banner_1: Banner1,
  hero_video: HeroVideo,
  pricing_2: Pricing2,
  stats_3: Stats3,
  newsletter_1: Newsletter1,
  bento_grid_1: BentoGrid1,
};

export const WIREFRAME_REGISTRY = (() => {
  const registry = {} as Record<SectionType, WireframeEntry>;
  for (const type of Object.keys(SECTION_COMPONENTS) as SectionType[]) {
    registry[type] = {
      component: SECTION_COMPONENTS[type],
      description: SECTION_META[type].description,
      dataSchema: SECTION_META[type].dataSchema,
    };
  }
  return registry;
})();

export const AVAILABLE_SECTION_TYPES = Object.keys(WIREFRAME_REGISTRY) as SectionType[];
