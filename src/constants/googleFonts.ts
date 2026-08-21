/**
 * Catalogue de polices proposées dans « Design & Style ».
 *
 * Chaque entrée porte de quoi la **montrer** : sa catégorie et une phrase sur
 * le registre qu'elle installe. Le sélecteur affichait jusqu'ici une liste
 * déroulante de noms en police système — on choisissait à l'aveugle, et il
 * fallait enregistrer puis recharger le site pour découvrir le résultat.
 */
export interface FontOption {
  name: string;
  category: 'serif' | 'sans';
  /** Ce que la police fait au ton du site, en quelques mots. */
  note: string;
  stack: string;
}

export const FONT_CATALOG: FontOption[] = [
  { name: 'Playfair Display', category: 'serif', note: 'Contrasté, éditorial — luxe et mode.', stack: "'Playfair Display', serif" },
  { name: 'Cormorant Garamond', category: 'serif', note: 'Fin et classique — élégance discrète.', stack: "'Cormorant Garamond', serif" },
  { name: 'Lora', category: 'serif', note: 'Chaleureux, très lisible en long texte.', stack: "'Lora', serif" },
  { name: 'Merriweather', category: 'serif', note: 'Solide et posé — sérieux, institutionnel.', stack: "'Merriweather', serif" },
  { name: 'EB Garamond', category: 'serif', note: 'Livresque — culture, artisanat.', stack: "'EB Garamond', serif" },
  { name: 'Libre Baskerville', category: 'serif', note: 'Presse et récit, généreux à l’écran.', stack: "'Libre Baskerville', serif" },
  { name: 'Spectral', category: 'serif', note: 'Serif d’écran, moderne et net.', stack: "'Spectral', serif" },
  { name: 'Cinzel', category: 'serif', note: 'Capitales romaines — enseigne, monogramme.', stack: "'Cinzel', serif" },

  { name: 'Inter', category: 'sans', note: 'Neutre et net — la valeur sûre.', stack: "'Inter', sans-serif" },
  { name: 'Outfit', category: 'sans', note: 'Géométrique et actuel — studios, tech.', stack: "'Outfit', sans-serif" },
  { name: 'Poppins', category: 'sans', note: 'Rond et amical — services aux particuliers.', stack: "'Poppins', sans-serif" },
  { name: 'Montserrat', category: 'sans', note: 'Large et affirmé — titres qui portent.', stack: "'Montserrat', sans-serif" },
  { name: 'Nunito', category: 'sans', note: 'Doux, arrondi — soin, enfance, bien-être.', stack: "'Nunito', sans-serif" },
  { name: 'Open Sans', category: 'sans', note: 'Passe-partout, très lisible.', stack: "'Open Sans', sans-serif" },
  { name: 'Roboto', category: 'sans', note: 'Compact et sobre — beaucoup de contenu.', stack: "'Roboto', sans-serif" },
  { name: 'Raleway', category: 'sans', note: 'Élancé — architecture, décoration.', stack: "'Raleway', sans-serif" },
];

/** Feuille Google Fonts couvrant tout le catalogue, pour l'aperçu du sélecteur. */
export const FONT_CATALOG_STYLESHEET =
  'https://fonts.googleapis.com/css2?' +
  FONT_CATALOG.map((f) => `family=${f.name.replace(/ /g, '+')}:wght@400;600`).join('&') +
  '&display=swap';

/**
 * Ambiances typographiques.
 *
 * Personne ne choisit une police « Merriweather » : on choisit un ton. On part
 * donc de l'intention — sérieux, chaleureux, affirmé — et le choix des deux
 * familles en découle. Seize listes déroulantes ne remplacent pas cette
 * question-là.
 */
export interface FontMood {
  id: string;
  label: string;
  description: string;
}

export const FONT_MOODS: FontMood[] = [
  { id: 'editorial', label: 'Éditorial', description: 'Titres qui portent, texte qui s’efface. Magazine, marque de goût.' },
  { id: 'elegant', label: 'Élégant', description: 'Fin, aéré, un peu précieux. Beauté, bijou, hôtellerie.' },
  { id: 'chaleureux', label: 'Chaleureux', description: 'Formes rondes, ton accueillant. Soin, enfance, artisanat.' },
  { id: 'moderne', label: 'Moderne', description: 'Linéales nettes, sans ornement. Studio, conseil, technique.' },
  { id: 'institutionnel', label: 'Institutionnel', description: 'Posé et sérieux. Cabinet, formation, santé.' },
];

/**
 * Accords éprouvés titre / texte.
 *
 * Choisir deux polices qui s'entendent est le point où l'on se perd le plus
 * vite : trois propositions sûres par ambiance valent mieux qu'un catalogue.
 */
export interface FontPairing {
  label: string;
  mood: string;
  headings: string;
  body: string;
  note: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  // Éditorial
  { label: 'Playfair + Inter', mood: 'editorial', headings: 'Playfair Display', body: 'Inter', note: 'Le contraste des titres, la neutralité du texte.' },
  { label: 'Spectral + Inter', mood: 'editorial', headings: 'Spectral', body: 'Inter', note: 'Serif d’écran, moins tranché que Playfair.' },
  { label: 'Libre Baskerville + Raleway', mood: 'editorial', headings: 'Libre Baskerville', body: 'Raleway', note: 'Presse classique, texte élancé.' },

  // Élégant
  { label: 'Cormorant + Montserrat', mood: 'elegant', headings: 'Cormorant Garamond', body: 'Montserrat', note: 'Finesse en titre, largeur en texte.' },
  { label: 'Cormorant + Raleway', mood: 'elegant', headings: 'Cormorant Garamond', body: 'Raleway', note: 'Deux tracés fins, très aérien.' },
  { label: 'Cinzel + Raleway', mood: 'elegant', headings: 'Cinzel', body: 'Raleway', note: 'Capitales romaines — à réserver aux titres courts.' },

  // Chaleureux
  { label: 'Lora + Nunito', mood: 'chaleureux', headings: 'Lora', body: 'Nunito', note: 'Deux formes rondes, ton accueillant.' },
  { label: 'EB Garamond + Poppins', mood: 'chaleureux', headings: 'EB Garamond', body: 'Poppins', note: 'Livresque en titre, amical en texte.' },
  { label: 'Lora + Open Sans', mood: 'chaleureux', headings: 'Lora', body: 'Open Sans', note: 'Chaleureux et parfaitement lisible.' },

  // Moderne
  { label: 'Outfit + Inter', mood: 'moderne', headings: 'Outfit', body: 'Inter', note: 'Tout en linéale, très actuel.' },
  { label: 'Montserrat + Inter', mood: 'moderne', headings: 'Montserrat', body: 'Inter', note: 'Titres larges, texte discret.' },
  { label: 'Poppins + Roboto', mood: 'moderne', headings: 'Poppins', body: 'Roboto', note: 'Géométrique et compact.' },

  // Institutionnel
  { label: 'Merriweather + Open Sans', mood: 'institutionnel', headings: 'Merriweather', body: 'Open Sans', note: 'Sérieux et sans effort de lecture.' },
  { label: 'Lora + Roboto', mood: 'institutionnel', headings: 'Lora', body: 'Roboto', note: 'Posé, dense, efficace.' },
  { label: 'Spectral + Open Sans', mood: 'institutionnel', headings: 'Spectral', body: 'Open Sans', note: 'Sobre, adapté aux textes longs.' },
];
