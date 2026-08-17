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
  | 'logos_1';

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
  | Logos1Data;

export interface PageSection {
  type: SectionType;
  data: SectionData;
}

interface WireframeEntry {
  component: ComponentType<{ data: any; sectionIndex?: number }>;
  description: string;
  dataSchema: Record<string, string>;
}

export const WIREFRAME_REGISTRY: Record<SectionType, WireframeEntry> = {
  hero_1: {
    component: Hero1,
    description: 'Hero plein écran avec image de fond, titre, sous-titre italique et 2 boutons CTA',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      title_italic: 'string (optionnel)',
      description: 'string (optionnel)',
      cta_primary_text: 'string (optionnel)',
      cta_primary_href: 'string (optionnel)',
      cta_secondary_text: 'string (optionnel)',
      cta_secondary_href: 'string (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_opacity: 'opacity (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  hero_2: {
    component: Hero2,
    description: 'Hero centré sans image, texte uniquement, un seul CTA',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      min_height: 'height (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  hero_3: {
    component: Hero3,
    description: 'Hero centré avec portrait en arche sous le titre, mots-clés en pastilles et 2 boutons',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      title_italic: 'string (optionnel)',
      description: 'string (optionnel)',
      items: 'string[] (pastilles, optionnel)',
      cta_primary_text: 'string (optionnel)',
      cta_primary_href: 'string (optionnel)',
      cta_secondary_text: 'string (optionnel)',
      cta_secondary_href: 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  hero_4: {
    component: Hero4,
    description: 'Hero éditorial : photo plein cadre, titre ancré en bas et carte d\'informations flottante',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      title_italic: 'string (optionnel)',
      description: 'string (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_opacity: 'opacity (optionnel)',
      card_title: 'string (optionnel)',
      card_text: 'string (optionnel)',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      min_height: 'height (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  hero_5: {
    component: Hero5,
    description: 'Bandeau de page compact (hauteur réduite) pour les pages intérieures, avec lien discret',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      align: "'center' | 'left' (optionnel)",
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_opacity: 'opacity (optionnel)',
      min_height: 'height (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  intro_1: {
    component: Intro1,
    description: 'Section split : image gauche + texte citation droite',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      quote: 'string',
      text: 'string',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_position: "'left' | 'right' (optionnel)",
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  features_1: {
    component: Features1,
    description: 'Section texte centré avec liste de points et citation optionnelle',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      quote: 'string (optionnel)',
      items: 'string[] (optionnel)',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      show_image: 'boolean (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_position: "'left' | 'right' (optionnel)",
      stretch_image: 'boolean (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  features_2: {
    component: Features2,
    description: 'Grille de 3 cartes features avec emoji/icône, titre et description',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      'cards[].title': 'string',
      'cards[].description': 'string',
      'cards[].icon': 'string emoji (optionnel)',
      'cards[].icon_image': 'image (optionnel)',
      'cards[].link_text': 'string (optionnel)',
      'cards[].link_href': 'string (optionnel)',
      show_image: 'boolean (optionnel)',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_position: "'left' | 'right' (optionnel)",
      stretch_image: 'boolean (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      cards_theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  features_3: {
    component: Features3,
    description: 'Grille 2 cartes services style pricing avec liste de bénéfices et CTA',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      'cards[].title': 'string',
      'cards[].description': 'string',
      'cards[].items': 'string[] (optionnel)',
      'cards[].cta_text': 'string (optionnel)',
      'cards[].cta_href': 'string (optionnel)',
      'cards[].badge': 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  cta_1: {
    component: Cta1,
    description: 'Section CTA fond sombre, centré, un seul bouton',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      cta_text: 'string',
      cta_href: 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  testimonial_1: {
    component: Testimonial1,
    description: 'Citation client/témoignage centré avec auteur et rôle',
    dataSchema: {
      quote: 'string',
      author: 'string (optionnel)',
      role: 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  text_1: {
    component: Text1,
    description: 'Bloc texte simple centré avec eyebrow et titre optionnels',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      content: 'string',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  text_image_1: {
    component: TextImage1,
    description: 'Bloc texte enrichi (liens, titres H2, listes) avec une image à gauche ou à droite, taille d\'image et proportion des colonnes réglables',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      content: 'string',
      image_url: 'image (optionnel)',
      image_alt: 'string (optionnel)',
      image_position: "'left' | 'right' (optionnel)",
      ratio: 'ratio (optionnel)',
      image_width: 'width-percent (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  gallery_grid: {
    component: GalleryGrid,
    description: 'Galerie en grille responsive avec colonnes personnalisables et visionneuse Lightbox',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      description: 'string (optionnel)',
      'cards[].image': 'image',
      'cards[].title': 'string (optionnel)',
      'cards[].description': 'string (optionnel)',
      'cards[].link': 'string (optionnel)',
      columns: "'2' | '3' | '4' (optionnel)",
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  gallery_carousel: {
    component: GalleryCarousel,
    description: 'Galerie en carrousel de défilement horizontal avec boutons et visionneuse Lightbox',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      description: 'string (optionnel)',
      'cards[].image': 'image',
      'cards[].title': 'string (optionnel)',
      'cards[].description': 'string (optionnel)',
      'cards[].link': 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  gallery_masonry: {
    component: GalleryMasonry,
    description: 'Galerie en cascade (style Pinterest) avec visionneuse Lightbox',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      description: 'string (optionnel)',
      'cards[].image': 'image',
      'cards[].title': 'string (optionnel)',
      'cards[].description': 'string (optionnel)',
      'cards[].link': 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  faq_1: {
    component: Faq1,
    description: 'Section Foire Aux Questions (FAQ) avec accordéons pliables/dépliables',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      'cards[].question': 'string',
      'cards[].answer': 'string',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  reviews_1: {
    component: Reviews1,
    description: 'Carrousel d\'avis clients avec étoiles, badge Google et navigation',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      title_bold: 'string (optionnel)',
      description: 'string (optionnel)',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      'cards[].name': 'string',
      'cards[].date': 'string (optionnel)',
      'cards[].rating': 'number 1-5',
      'cards[].text': 'string',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  marquee_1: {
    component: Marquee1,
    description: 'Bandeau défilant (marquee) avec mots personnalisés, couleur de fond, séparateur et vitesse',
    dataSchema: {
      // Déclaré comme string[] : les clés en `xxx[]` sont ignorées par
      // FieldEditor (réservées aux cartes), les mots du bandeau étaient donc
      // impossibles à modifier depuis le panneau.
      items: 'string[] (texte défilant)',
      bg_color: 'string couleur CSS (optionnel)',
      text_color: 'string couleur CSS (optionnel)',
      separator: "'★' | '●' | '•' | '◆' | '—' | '/' | '|' (optionnel)",
      speed: "'slow' | 'normal' | 'fast' (optionnel)",
      italic: 'boolean (optionnel)',
    },
  },
  pricing_1: {
    component: Pricing1,
    description: 'Carte tarif unique : prix, badge, liste de ce qui est inclus (2 colonnes), CTA et note de bas de carte',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string',
      description: 'string (optionnel)',
      badge: 'string (optionnel)',
      price: 'string',
      price_original: 'string prix barré (optionnel)',
      price_note: 'string (optionnel)',
      items: 'string[] (optionnel)',
      cta_text: 'string (optionnel)',
      cta_href: 'string (optionnel)',
      button_style: "'green' | 'white' (optionnel)",
      footnote: 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_color: 'string couleur CSS (optionnel)',
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  stats_1: {
    component: Stats1,
    description: 'Rangée de chiffres clés (statistiques) avec valeur et légende',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      'cards[].value': 'string (ex: 500+, 98%)',
      'cards[].label': 'string',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  timeline_1: {
    component: Timeline1,
    description: 'Étapes numérotées d\'un processus ou d\'un parcours, alignées horizontalement',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      title: 'string (optionnel)',
      description: 'string (optionnel)',
      'cards[].title': 'string',
      'cards[].description': 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
      bg_image: 'image (optionnel)',
      bg_image_opacity: 'opacity (optionnel)',
      bg_image_position: 'position (optionnel)',
    },
  },
  logos_1: {
    component: Logos1,
    description: 'Bandeau de logos (partenaires, presse, "vu dans") en niveaux de gris',
    dataSchema: {
      eyebrow: 'string (optionnel)',
      'cards[].image': 'image',
      'cards[].alt': 'string (optionnel)',
      'cards[].link': 'string (optionnel)',
      theme: "'light' | 'dark' (optionnel)",
    },
  },
};

export const AVAILABLE_SECTION_TYPES = Object.keys(WIREFRAME_REGISTRY) as SectionType[];
