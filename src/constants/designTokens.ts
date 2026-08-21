/**
 * Jetons de design pilotables depuis l'admin (Paramètres > Design & Style).
 *
 * Deux régimes, volontairement différents :
 *
 * — **Les couleurs partent vides.** Aucune teinte n'est imposée : une palette
 *   livrée en dur ferait hériter chaque nouveau site du goût du précédent.
 *   Tant que rien n'est choisi, le site reste en gris neutre.
 *
 * — **Les mesures partent réglées.** Tailles, graisses, interlignes et
 *   espacements ont des valeurs recommandées, parce qu'un site sans échelle
 *   typographique n'est pas « neutre », il est cassé. Ces valeurs sont un point
 *   de départ raisonnable, modifiable champ par champ.
 *
 * Les tailles se saisissent en **rem**, tout simplement. La fluidité — le fait
 * qu'un titre rétrécisse sur mobile plutôt que de déborder — est calculée par
 * `GlobalStyles` et n'a pas à encombrer l'interface.
 */

export interface TokenField {
  key: string;
  label: string;
  /** `color` ouvre un sélecteur, `text` un champ libre, `select` une liste */
  type: 'color' | 'text' | 'select';
  /** Valeur appliquée à l'installation. Vide = le jeton n'émet aucune règle. */
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  help?: string;
}

export interface TokenGroup {
  id: string;
  label: string;
  description: string;
  fields: TokenField[];
}

/**
 * Échelle typographique d'un niveau.
 *
 * Les tailles de titre sont fluides (`clamp`) : elles suivent la largeur de
 * l'écran sans point de rupture, ce qui évite les titres qui débordent sur
 * mobile et ceux qui paraissent minuscules sur grand écran.
 */
function typeScale(
  prefix: string,
  colorLabel: string,
  d: { size: string; weight: string; leading: string; tracking: string },
): TokenField[] {
  return [
    { key: `style_${prefix}_size`, label: 'Taille', type: 'text',
      defaultValue: d.size,
      help: 'Taille en rem. 1rem = 16 px.' },
    { key: `style_${prefix}_weight`, label: 'Graisse', type: 'select',
      defaultValue: d.weight,
      options: ['', '300', '400', '500', '600', '700', '800'] },
    { key: `style_${prefix}_leading`, label: 'Interligne', type: 'text',
      defaultValue: d.leading },
    { key: `style_${prefix}_tracking`, label: 'Interlettrage', type: 'text',
      defaultValue: d.tracking },
    { key: `style_${prefix}_color`, label: `Couleur ${colorLabel}`, type: 'color' },
  ];
}

/** Jeu de couleurs d'une variante de bouton — tout part vide. */
function buttonVariant(prefix: string, label: string): TokenField[] {
  return [
    { key: `style_btn_${prefix}_bg`, label: 'Fond', type: 'color' },
    { key: `style_btn_${prefix}_text`, label: 'Texte', type: 'color' },
    { key: `style_btn_${prefix}_border`, label: 'Bordure', type: 'color' },
    { key: `style_btn_${prefix}_hover_bg`, label: 'Fond au survol', type: 'color' },
    { key: `style_btn_${prefix}_hover_text`, label: 'Texte au survol', type: 'color' },
    { key: `style_btn_${prefix}_hover_border`, label: 'Bordure au survol', type: 'color',
      help: `S'applique aux boutons « ${label} ».` },
  ];
}

export const DESIGN_TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'palette',
    label: 'Palette',
    description:
      "Les six couleurs qui suffisent à tenir un site. Laissées vides, le site reste en gris neutre.",
    fields: [
      { key: 'style_color_primary', label: 'Primaire', type: 'color',
        help: 'Accents, liens, boutons principaux.' },
      { key: 'style_color_bg', label: 'Fond', type: 'color' },
      { key: 'style_color_surface', label: 'Surface', type: 'color',
        help: 'Fond des cartes et des blocs posés sur la page.' },
      { key: 'style_color_text', label: 'Texte', type: 'color' },
      { key: 'style_color_text_muted', label: 'Texte secondaire', type: 'color',
        help: "Descriptions, légendes et textes d'accompagnement." },
      { key: 'style_color_border', label: 'Bordures', type: 'color' },
    ],
  },
  {
    id: 'rhythm',
    label: 'Rythme & espacement',
    description:
      "Le réglage le plus rentable d'un site : l'air entre les sections. Il s'applique partout d'un coup.",
    fields: [
      { key: 'style_section_padding_y', label: 'Hauteur de section (bureau)', type: 'text',
        defaultValue: '6rem',
        help: "Espace vertical au-dessus et en dessous de chaque section. Une section dont vous avez choisi la densité dans le constructeur garde la sienne." },
      { key: 'style_section_padding_y_mobile', label: 'Hauteur de section (mobile)', type: 'text',
        defaultValue: '3.5rem' },
      { key: 'style_container_max', label: 'Largeur maximale du contenu', type: 'text',
        defaultValue: '80rem',
        help: "Largeur par défaut. Une section dont vous avez choisi la largeur dans le constructeur garde la sienne." },
      { key: 'style_gutter', label: 'Marge latérale', type: 'text', defaultValue: '1.5rem' },
      { key: 'style_block_gap', label: 'Espace entre blocs', type: 'text', defaultValue: '2rem',
        help: "Écart vertical entre les blocs empilés à l'intérieur d'une section (titre, contenu, appel à l'action)." },
      { key: 'style_border_radius_base', label: 'Rayon des angles', type: 'text',
        defaultValue: '0px', help: '0 pour des angles vifs.' },
    ],
  },
  {
    id: 'fonts',
    label: 'Polices',
    description: 'Deux familles suffisent. Toute police Google Fonts est acceptée.',
    fields: [
      { key: 'style_font_headings', label: 'Titres', type: 'text', defaultValue: 'Inter' },
      { key: 'style_font_body', label: 'Texte courant', type: 'text', defaultValue: 'Inter' },
    ],
  },
  {
    id: 'buttons',
    label: 'Boutons — forme',
    description:
      'La forme est commune à toutes les variantes : seules les couleurs changent ensuite.',
    fields: [
      { key: 'style_btn_padding_y', label: 'Hauteur (padding vertical)', type: 'text',
        defaultValue: '0.875rem' },
      { key: 'style_btn_padding_x', label: 'Largeur (padding horizontal)', type: 'text',
        defaultValue: '1.75rem' },
      { key: 'style_btn_radius', label: 'Rayon des angles', type: 'text',
        defaultValue: '0px', help: 'Laisser vide pour suivre le rayon global.' },
      { key: 'style_btn_font_size', label: 'Taille du texte', type: 'text',
        defaultValue: '0.9375rem' },
      { key: 'style_btn_font_weight', label: 'Graisse', type: 'select',
        defaultValue: '500', options: ['', '400', '500', '600', '700'] },
      { key: 'style_btn_tracking', label: 'Interlettrage', type: 'text', defaultValue: '0' },
      { key: 'style_btn_border_width', label: 'Épaisseur de bordure', type: 'text',
        defaultValue: '1px' },
      { key: 'style_btn_transition', label: 'Durée de transition', type: 'text',
        defaultValue: '150ms', help: 'Appliquée au survol.' },
    ],
  },
  {
    id: 'btn_primary',
    label: 'Bouton principal',
    description: "L'action que vous voulez voir cliquée. Une seule par écran, idéalement.",
    fields: buttonVariant('primary', 'principal'),
  },
  {
    id: 'btn_secondary',
    label: 'Bouton secondaire',
    description: 'Action de repli, contour ou fond clair.',
    fields: buttonVariant('secondary', 'secondaire'),
  },
  {
    id: 'btn_ghost',
    label: 'Bouton discret',
    description: 'Sans fond ni bordure — pour les actions mineures.',
    fields: buttonVariant('ghost', 'discret'),
  },
  {
    id: 'h1',
    label: 'Titre H1',
    description: "Le titre principal d'une page. Un seul par page.",
    fields: typeScale('h1', 'du titre', {
      size: '3.5rem',
      weight: '600', leading: '1.05', tracking: '-0.03em',
    }),
  },
  {
    id: 'h2',
    label: 'Titre H2',
    description: 'Les titres de section.',
    fields: typeScale('h2', 'du titre', {
      size: '2.5rem',
      weight: '600', leading: '1.15', tracking: '-0.02em',
    }),
  },
  {
    id: 'h3',
    label: 'Titre H3',
    description: "Les sous-titres à l'intérieur d'une section.",
    fields: typeScale('h3', 'du titre', {
      size: '1.375rem', weight: '600', leading: '1.3', tracking: '-0.01em',
    }),
  },
  {
    id: 'h4',
    label: 'Titre H4',
    description: 'Les intitulés de carte ou de bloc.',
    fields: typeScale('h4', 'du titre', {
      size: '1.0625rem', weight: '600', leading: '1.4', tracking: '0',
    }),
  },
  {
    id: 'body',
    label: 'Paragraphe',
    description: 'Le texte courant — celui que vos visiteurs lisent vraiment.',
    fields: typeScale('body', 'du texte', {
      size: '1rem', weight: '400', leading: '1.65', tracking: '0',
    }),
  },
  {
    id: 'small',
    label: 'Petit texte',
    description: 'Légendes, mentions, notes de bas de bloc.',
    fields: typeScale('small', 'du texte', {
      size: '0.875rem', weight: '400', leading: '1.55', tracking: '0',
    }),
  },
];

/** Toutes les clés, à plat — sert au chargement et à l'enregistrement. */
export const DESIGN_TOKEN_KEYS: string[] = DESIGN_TOKEN_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.key),
);

/** Valeurs de départ : mesures réglées, couleurs vides. */
export const DESIGN_TOKEN_DEFAULTS: Record<string, string> = Object.fromEntries(
  DESIGN_TOKEN_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f.defaultValue ?? '']),
);

/** Variantes de bouton et sélecteurs CSS correspondants. */
export const BUTTON_VARIANTS = [
  { prefix: 'primary', selector: '.btn-primary, [data-btn="primary"]' },
  { prefix: 'secondary', selector: '.btn-secondary, [data-btn="secondary"]' },
  { prefix: 'ghost', selector: '.btn-ghost, [data-btn="ghost"]' },
] as const;
