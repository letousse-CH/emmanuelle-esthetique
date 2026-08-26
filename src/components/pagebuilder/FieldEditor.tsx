import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  X,
  RotateCcw,
  Bold,
  Italic,
  Link as LinkIcon,
  Moon,
  Pipette,
  Sun,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

import { useThemePalette } from './useThemePalette';
import PaletteColorInput from '../admin/PaletteColorInput';
import {
  BUTTON_VARIANT_OPTIONS, buttonVariantOf,
  HERO_IMAGE_SIDE_OPTIONS, HERO_IMAGE_WIDTH_OPTIONS, HERO_TEXT_OVERLAP_OPTIONS,
  HERO_TEXT_WIDTH_OPTIONS, SECTION_PATTERN_OPTIONS,
  SECTION_PATTERN_SCALE_OPTIONS, SECTION_PATTERN_REPEAT_OPTIONS,
} from './sectionLayout';

function AutoTextarea({
  value,
  onChange,
  className,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={`${className} overflow-hidden`}
      style={{ resize: 'none' }}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
    />
  );
}

function RichTextarea({
  value,
  onChange,
  className,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  useEffect(() => {
    resize();
  }, [value]);

  const wrap = (open: string, close: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + open + selected + close + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + open.length, end + open.length);
    }, 0);
  };

  const wrapTag = (tag: string) => wrap(`<${tag}>`, `</${tag}>`);

  const insertLink = () => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const raw = window.prompt('URL du lien :', 'https://');
    if (!raw) return;
    const url = raw.trim();
    // Le contenu est réinjecté via dangerouslySetInnerHTML côté page publique :
    // on refuse les schémas exécutables (javascript:, data:).
    if (/^\s*(javascript|data|vbscript):/i.test(url)) {
      window.alert(
        'URL refusée : seuls les liens http(s), mailto:, tel: et les chemins internes (/…) sont acceptés.',
      );
      return;
    }
    const label = value.slice(start, end) || 'texte du lien';
    const open = `<a href="${url.replace(/"/g, '&quot;')}">`;
    const next = value.slice(0, start) + open + label + '</a>' + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + open.length, start + open.length + label.length);
    }, 0);
  };

  const btn =
    'px-2 py-1 border border-zinc-300 rounded-[5px] text-[11px] font-semibold text-zinc-800 bg-white hover:bg-zinc-900 hover:text-white transition-all cursor-pointer shadow-2xs';

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        <button
          type="button"
          title="Gras"
          onMouseDown={(e) => {
            e.preventDefault();
            wrapTag('strong');
          }}
          className={btn}
        >
          <Bold size={11} />
        </button>
        <button
          type="button"
          title="Italique"
          onMouseDown={(e) => {
            e.preventDefault();
            wrapTag('em');
          }}
          className={`${btn} italic`}
        >
          <Italic size={11} />
        </button>
        <button
          type="button"
          title="Titre H2"
          onMouseDown={(e) => {
            e.preventDefault();
            wrapTag('h2');
          }}
          className={btn}
        >
          H2
        </button>
        <button
          type="button"
          title="Titre H3"
          onMouseDown={(e) => {
            e.preventDefault();
            wrapTag('h3');
          }}
          className={btn}
        >
          H3
        </button>
        <button
          type="button"
          title="Paragraphe"
          onMouseDown={(e) => {
            e.preventDefault();
            wrapTag('p');
          }}
          className={btn}
        >
          ¶
        </button>
        <button
          type="button"
          title="Liste à puces"
          onMouseDown={(e) => {
            e.preventDefault();
            wrap('<ul>\n  <li>', '</li>\n</ul>');
          }}
          className={btn}
        >
          • Liste
        </button>
        <button
          type="button"
          title="Insérer un lien"
          onMouseDown={(e) => {
            e.preventDefault();
            insertLink();
          }}
          className={btn}
        >
          <LinkIcon size={11} />
        </button>
      </div>
      <textarea
        ref={ref}
        rows={minRows}
        className={`${className} overflow-hidden`}
        style={{ resize: 'none' }}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          resize();
        }}
      />
    </div>
  );
}

/**
 * Repli quand aucune palette n'est encore définie dans « Design & Style ».
 * Deux neutres seulement : proposer des teintes de marque inventées reviendrait
 * à imposer un goût, ce que le reste du template s'interdit.
 */
const NEUTRAL_PRESETS = [
  { name: 'Blanc', value: '#FFFFFF' },
  { name: 'Noir', value: '#1C1917' },
];

/**
 * Libellés lisibles des champs — l'éditeur affichait jusqu'ici la clé technique
 * brute (`cta_primary_href`, `bg_image_opacity`…), illisible pour l'éditrice du
 * site. Toute clé absente de cette table retombe sur un formatage automatique.
 */
const FIELD_LABELS: Record<string, string> = {
  eyebrow: 'Sur-titre',
  title: 'Titre',
  title_italic: 'Titre — suite en italique',
  title_bold: 'Titre — suite en gras',
  title_highlight: 'Titre — partie mise en valeur',
  personas: 'Profils clients cibles',
  painPoints: 'Comparatif Avant vs. Solution',
  voiceFeatures: 'Fonctionnalités vocales',
  inclusions: 'Prestations incluses',
  faqs: 'Questions & réponses FAQ',
  speechExample: 'Exemple vocal dicté',
  aiResult: 'Résultat IA généré',
  beforeTitle: 'Avant — Titre du problème',
  beforeDesc: 'Avant — Description du problème',
  afterTitle: 'Avec la Solution — Titre de l\'avantage',
  afterDesc: 'Avec la Solution — Description de l\'avantage',
  subtitle: 'Sous-titre',
  stepNumber: 'Numéro d\'étape',
  invoiceNumber: 'N° Facture Caisse',
  invoiceClient: 'Nom de la cliente',
  invoiceAmount: 'Montant encaissé',
  card1_title: 'Carte 1 — Titre',
  card1_desc: 'Carte 1 — Description',
  card2_title: 'Carte 2 — Titre',
  card2_desc: 'Carte 2 — Description',
  card3_title: 'Carte 3 — Titre',
  card3_desc: 'Carte 3 — Description',
  card4_title: 'Carte 4 — Titre',
  card4_desc: 'Carte 4 — Description',
  card5_title: 'Carte 5 — Titre',
  card5_desc: 'Carte 5 — Description',
  q: 'Question',
  a: 'Réponse',
  desc: 'Description',
  description: 'Description',
  content: 'Contenu',
  text: 'Texte',
  quote: 'Citation',
  author: 'Auteur',
  role: 'Rôle / fonction',
  items: 'Liste de points',
  cta_text: 'Bouton — libellé',
  cta_href: 'Bouton — lien',
  cta_primary_text: 'Bouton principal — libellé',
  cta_primary_href: 'Bouton principal — lien',
  cta_secondary_text: 'Bouton secondaire — libellé',
  cta_secondary_href: 'Bouton secondaire — lien',
  button_style: 'Couleur du bouton',
  image_url: 'Image',
  image_alt: 'Image — texte alternatif',
  image_opacity: "Opacité de l'image",
  image_position: "Position de l'image",
  image_width: "Taille de l'image",
  text_box_width: 'Largeur du bloc de texte',
  show_image: "Afficher l'image",
  stretch_image: "Étirer l'image en hauteur",
  ratio: 'Proportion image / texte',
  bg_image: 'Image de fond',
  bg_image_opacity: "Opacité de l'image de fond",
  bg_image_position: "Cadrage de l'image de fond",
  bg_color: 'Couleur de fond',
  text_color: 'Couleur du texte',
  min_height: 'Hauteur minimale',
  columns: 'Nombre de colonnes',
  separator: 'Séparateur',
  speed: 'Vitesse de défilement',
  italic: 'Texte en italique',
  badge: 'Badge',
  price: 'Prix',
  price_original: 'Prix barré',
  price_note: 'Note sous le prix',
  footnote: 'Note de bas de section',
  guarantee: 'Garantie',
  theme: 'Thème',
  cards_theme: 'Thème des cartes',
  align: 'Alignement du texte',
  card_title: 'Carte — titre',
  card_text: 'Carte — texte',
  // Champs de cartes
  icon: 'Icône (emoji)',
  icon_image: 'Icône (image)',
  icon_image_bleed: "Coller l'image aux bords de la carte",
  link: 'Lien',
  link_text: 'Lien — libellé',
  link_href: 'Lien — URL',
  image: 'Image',
  alt: 'Texte alternatif',
  question: 'Question',
  answer: 'Réponse',
  name: 'Nom',
  date: 'Date',
  rating: 'Note',
  value: 'Valeur',
  label: 'Légende',
  video_poster: 'Image d’aperçu vidéo',
  video_url: 'Lien vidéo (YouTube / Vimeo)',
  trust_text: 'Texte de réassurance / preuve',
  yearly_discount_badge: 'Badge de réduction annuelle (ex: -20%)',
  price_monthly: 'Prix mensuel',
  price_yearly: 'Prix annuel',
  period: 'Période (ex: /mois)',
  popular: 'Mettre en avant cette formule',
  highlight: 'Mettre en avant cette carte (fond sage)',
  privacy_note: 'Note de confidentialité (ex: Pas de spam)',
  placeholder: 'Texte d’invite du champ',
  button_text: 'Libellé du bouton',
  metric: 'Chiffre / Statistique',
  sublabel: 'Sous-titre / Légende',
  tag: 'Tag / Badge de carte',
};

const FIELD_TOOLTIPS: Record<string, string> = {
  eyebrow: 'Texte d\'accroche au-dessus du titre principal.',
  title: 'Titre principal de la section.',
  description: 'Paragraphe de présentation détaillé.',
  cta_primary_href: 'Lien de destination du bouton principal (ex: /contact).',
  cta_primary_text: 'Texte affiché sur le bouton principal.',
  cta_secondary_href: 'Lien de destination du bouton secondaire.',
  cta_secondary_text: 'Texte affiché sur le bouton secondaire.',
  image_url: 'URL ou image importée depuis la médiathèque.',
  image_opacity: 'Réglage de la transparence de l\'image de fond (0% à 100%).',
  bg_color: 'Couleur de fond spécifique pour cette section.',
  theme: 'Bascule entre thème clair, foncé, surface ou primaire.',
  bg_pattern: 'Motif géométrique vectoriel discret en arrière-plan.',
};

function labelFor(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const pretty = key.replace(/_/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Les champs `*_href`, `*_url` et libellés courts tiennent sur une seule ligne. */
const SINGLE_LINE_RE = /(_href|_url|_alt|^slug$|^icon$|^separator$|^video_url$|^video_poster$)/;

/** Libellés des valeurs d'énumération affichées en boutons segmentés. */
const ENUM_LABELS: Record<string, string> = {
  slow: 'Lente',
  normal: 'Normale',
  fast: 'Rapide',
  left: 'Gauche',
  center: 'Centré',
  right: 'Droite',
};

/** Extrait les valeurs d'une union littérale du schéma : "'2' | '3' | '4'". */
function parseEnumHint(hint: string): string[] | null {
  if (!hint) return null;
  const matches = hint.match(/'([^']*)'/g);
  if (!matches || matches.length < 2) return null;
  return matches.map((m) => m.slice(1, -1));
}

function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Choix d'une couleur dans la charte du site.
 *
 * Les pastilles viennent des jetons enregistrés dans « Design & Style » ; la
 * mécanique est celle de `PaletteColorInput`, partagée avec le panneau de
 * style pour que le geste soit le même des deux côtés.
 */
function ThemeColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  const { swatches } = useThemePalette();
  // Tant qu'aucune palette n'est définie, deux neutres valent mieux que rien :
  // proposer des teintes inventées reviendrait à imposer un goût.
  const palette = swatches.length > 0
    ? swatches
    : NEUTRAL_PRESETS.map((p) => ({ key: p.value, label: p.name, value: p.value }));

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-medium text-stone-800">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">{hint}</p>}
      </div>
      <PaletteColorInput
        value={value}
        onChange={onChange}
        swatches={palette}
        ariaLabel={label}
        autoHint="Suivre le thème clair ou foncé de la section."
      />
    </div>
  );
}

/**
 * Clair ou foncé, montré avec les vraies couleurs du site.
 *
 * Les deux boutons portaient un émoji et un aplat gris fixe : on choisissait
 * sans voir ce que ça allait donner.
 */
function ThemeChoice({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { swatches } = useThemePalette();
  const light = swatches.find((s) => s.key === 'style_color_bg')?.value || '#FFFFFF';
  const dark = swatches.find((s) => s.key === 'style_color_text')?.value || '#1C1917';
  const surface = swatches.find((s) => s.key === 'style_color_surface')?.value || '#F5F5F4';
  const primary = swatches.find((s) => s.key === 'style_color_primary')?.value || '#000000';

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-medium text-stone-800">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">{hint}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { key: 'light', label: 'Clair', bg: light, fg: dark, icon: <Sun size={14} /> },
          { key: 'dark', label: 'Foncé', bg: dark, fg: light, icon: <Moon size={14} /> },
          { key: 'surface', label: 'Surface', bg: surface, fg: dark, icon: <Sun size={14} /> },
          { key: 'primary', label: 'Primaire', bg: primary, fg: '#FFFFFF', icon: <Sun size={14} /> },
        ].map((option) => {
          const active = (value || 'light') === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.key)}
              className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-stone-900 ring-1 ring-stone-900'
                    : 'border-stone-300 hover:border-stone-400'
                }`}
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-md border border-stone-300 shadow-xs"
                style={{ backgroundColor: option.bg, color: option.fg }}
              >
                {option.icon}
              </span>
              <span className="text-[12px] font-medium text-stone-800">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PatternChoice({
  pattern,
  scale,
  repeat,
  opacity,
  onChangePattern,
  onChangeScale,
  onChangeRepeat,
  onChangeOpacity,
}: {
  pattern: string;
  scale: string;
  repeat: string;
  opacity: number;
  onChangePattern: (v: string) => void;
  onChangeScale: (v: string) => void;
  onChangeRepeat: (v: string) => void;
  onChangeOpacity: (v: number) => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <p className="text-[13px] font-medium text-stone-800">Motif de fond (SVG vectoriel)</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">
          Texture géométrique pour habiller l'arrière-plan avec répétition et taille réglables.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
        {SECTION_PATTERN_OPTIONS.map((opt) => {
          const active = (pattern || 'none') === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChangePattern(opt.value)}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                active
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <div className="text-[11.5px] font-bold">{opt.label}</div>
              <div className={`text-[9.5px] truncate ${active ? 'text-stone-300' : 'text-stone-500'}`}>
                {opt.hint}
              </div>
            </button>
          );
        })}
      </div>

      {pattern && pattern !== 'none' && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 space-y-3 mt-2">
          {/* Échelle / Taille */}
          <div className="space-y-1">
            <label className="text-[11.5px] font-medium text-stone-700">Taille du motif (Échelle)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {SECTION_PATTERN_SCALE_OPTIONS.map((opt) => {
                const active = (scale || 'normal') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeScale(opt.value)}
                    className={`rounded-md border px-2 py-1 text-center text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Répétition */}
          <div className="space-y-1">
            <label className="text-[11.5px] font-medium text-stone-700">Mode de répétition (Tiling)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {SECTION_PATTERN_REPEAT_OPTIONS.map((opt) => {
                const active = (repeat || 'repeat') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeRepeat(opt.value)}
                    className={`rounded-md border px-2 py-1 text-center text-[10.5px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opacité */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11.5px] font-medium text-stone-700">Opacité du motif</label>
              <span className="text-[11px] font-bold text-stone-800">{opacity}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={opacity}
              onChange={(e) => onChangeOpacity(Number(e.target.value))}
              className="w-full accent-stone-900 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}

const CARD_FIELDS_BY_TYPE: Record<string, string[]> = {
  features_2: [
    'title',
    'description',
    'icon',
    'icon_image',
    'icon_image_bleed',
    'link_text',
    'link_href',
    'theme',
  ],
  features_3: ['title', 'description', 'items', 'cta_text', 'cta_href', 'badge', 'theme'],
  gallery_grid: ['image', 'title', 'description', 'link'],
  gallery_carousel: ['image', 'title', 'description', 'link'],
  gallery_masonry: ['image', 'title', 'description', 'link'],
  faq_1: ['question', 'answer'],
  reviews_1: ['name', 'date', 'rating', 'text'],
  stats_1: ['value', 'label'],
  timeline_1: ['title', 'description'],
  logos_1: ['image', 'alt', 'link'],
  pricing_2: ['name', 'price_monthly', 'price_yearly', 'period', 'description', 'badge', 'popular', 'features', 'cta_text', 'cta_href'],
  stats_3: ['metric', 'label', 'sublabel', 'highlight'],
  bento_grid_1: ['title', 'description', 'tag', 'image_url', 'metric'],
};
/**
 * Regroupement des champs de l'onglet « Contenu ».
 *
 * Ils s'affichaient à la file, dans l'ordre du schéma : le surtitre, le titre,
 * l'adresse d'un bouton et l'opacité d'une image de fond se suivaient sans
 * rien pour les distinguer. On les range par rôle, dans l'ordre où on les
 * remplit — ce qu'on écrit d'abord, l'action ensuite, le décor en dernier.
 */
const FIELD_GROUPS: { id: string; title: string; hint: string; match: (key: string) => boolean }[] = [
  {
    id: 'texte',
    title: 'Texte',
    hint: 'Ce que le visiteur lit en premier.',
    match: (k) => ['eyebrow', 'title', 'title_italic', 'subtitle', 'description', 'content', 'text', 'quote',
      'author', 'role', 'card_title', 'card_text', 'price', 'price_note', 'items', 'separator',
      'trust_text', 'privacy_note', 'yearly_discount_badge', 'placeholder', 'button_text',
].includes(k),
  },
  {
    id: 'action',
    title: 'Appel à l’action',
    hint: 'Le bouton et sa destination.',
    match: (k) => k.startsWith('cta_') || k === 'button_style' || k === 'link_text' || k === 'link_href',
  },
  {
    id: 'image',
    title: 'Images & Médias',
    hint: 'Visuel principal ou vidéo de la section.',
    match: (k) =>
      (k.startsWith('image') && !k.startsWith('image_bg')) || k === 'logo' || k === 'avatar' || k.startsWith('video_')
      // La rencontre du texte et de l'image et la largeur du bloc de texte se
      // règlent en regardant l'image : elles restent à côté d'elle.
      || k === 'text_overlap' || k === 'text_box_width',
  },
  {
    id: 'fond',
    title: 'Arrière-plan',
    hint: 'Ce qui passe derrière le contenu.',
    match: (k) => k.startsWith('bg_') || k === 'text_color',
  },
  {
    id: 'cartes',
    title: 'Habillage des cartes',
    hint: 'Leur fond et leur ambiance. Leur contenu se règle dans l’onglet « Contenu ».',
    // La taille du texte des cartes relève du contenu : elle reste dans
    // l'onglet « Contenu », avec le reste de ce qu'on écrit.
    match: (k) => k.startsWith('cards_') && k !== 'cards_text_scale',
  },
  {
    id: 'mise_en_forme',
    title: 'Mise en forme',
    hint: 'Colonnes, hauteur, défilement.',
    match: (k) => ['columns', 'min_height', 'speed', 'italic', 'stretch_image'].includes(k),
  },
];

/** Groupes présentés dans l'onglet « Fond » de la modale du constructeur. */
const BACKGROUND_GROUPS = ['fond', 'cartes'];

/** Groupe d'un champ ; tout ce qui n'entre nulle part atterrit dans « Réglages ». */
function groupOf(key: string): string {
  return FIELD_GROUPS.find((g) => g.match(key))?.id ?? 'autres';
}

/** Champs de carte à rendre en case à cocher plutôt qu'en input texte. */
const CARD_BOOLEAN_FIELDS = new Set(['icon_image_bleed', 'popular', 'highlight']);

import { WIREFRAME_REGISTRY } from './wireframes.config';
import type { PageSection } from './wireframes.config';
import MediaLibrary from '../MediaLibrary';

interface Props {
  section: PageSection;
  sectionIndex: number;
  onUpdate: (i: number, key: string, value: unknown) => void;
  compact?: boolean;
}

function AccordionGroup({
  title,
  hint,
  defaultOpen = false,
  isOpenState,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  isOpenState?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isOpenState !== undefined ? isOpenState : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs transition-all bg-white mb-3 hover:border-zinc-300">
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all cursor-pointer select-none ${
          isOpen
            ? 'bg-zinc-900 text-white font-extrabold border-b border-zinc-800'
            : 'bg-zinc-100/80 hover:bg-zinc-200 text-zinc-900 font-bold'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hint && (
            <span className={`text-[11px] hidden sm:inline ${isOpen ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {hint}
            </span>
          )}
          {isOpen ? <ChevronDown size={15} className="text-amber-300" /> : <ChevronRight size={15} className="text-zinc-600" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-0 divide-y divide-zinc-200 border-t border-zinc-200">
          {children}
        </div>
      )}
    </div>
  );
}

export default function FieldEditor({
  section,
  sectionIndex: i,
  onUpdate,
  compact = false,
  contentOnly = false,
  scope = 'all',
}: Props & { contentOnly?: boolean; scope?: 'all' | 'content' | 'background' }) {
  const data = section.data as unknown as Record<string, unknown>;
  const schema = WIREFRAME_REGISTRY[section.type]?.dataSchema ?? {};
  const [mediaPickerKey, setMediaPickerKey] = useState<string | null>(null);
  const [openCardIdx, setOpenCardIdx] = useState<number | null>(null);
  const [openGroupKeys, setOpenGroupKeys] = useState<Record<string, boolean>>({});

  const px = compact ? 'px-2 py-1' : 'px-3 py-2';
  const sz = compact ? 'text-xs' : 'text-sm';
  const inputCls = `w-full border border-zinc-300 rounded-[5px] ${px} ${sz} focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 text-zinc-900 font-medium leading-relaxed bg-white shadow-2xs`;

  const cardsKey = Array.isArray(data.plans) ? 'plans' : 'cards';
  const cards = Array.isArray(data[cardsKey]) ? (data[cardsKey] as Record<string, unknown>[]) : null;
  const customArrayKeys = Object.keys(data).filter(
    (k) => Array.isArray(data[k]) && k !== 'items[]' && !k.endsWith('[]') && k !== cardsKey
  );

  /*
    Rendu d'un champ. Extrait de la boucle pour pouvoir ranger les champs par
    groupe : ils défilaient jusqu'ici dans l'ordre brut du schéma, surtitre et
    opacité d'image de fond à la suite, sans rien pour séparer ce qu'on écrit
    de ce qui décore.
  */
  const renderScalarField = (key: string, typeHint: string) => {
    if (key.includes('[]')) return null;
    if (key === 'cards') return null;
    // Ces trois-là se règlent dans l'onglet « Apparence ».
    if (key === 'cards_text_size' || key === 'cards_title_size' || key === 'text_scale') return null;
    if (key === 'theme') return null; // affiché ci-dessus
    if (key === 'bg_color') return null; // idem — évitait un doublon sur marquee_1 / pricing_1

    const val = data[key];
    const hint = (typeHint || '') as string;
    const isImage = hint === 'image (optionnel)' || hint.startsWith('image');
    const isArray = hint.startsWith('string[]') || hint.startsWith('array');

    // ── Couleur (autre que bg_color, ex. text_color du bandeau défilant) ──
    if (key.endsWith('_color') || hint.includes('couleur')) {
      return (
        <ThemeColorField
          key={key}
          label={labelFor(key)}
          value={String(val ?? '')}
          onChange={(v) => onUpdate(i, key, v)}
          fallback="#000000"
        />
      );
    }

    /*
      Réglages à choix fermé. Sans traitement explicite, ils tombaient dans le
      champ texte générique : on devait taper « twoThirds » à la main pour
      élargir l'image d'un hero.
    */
    const SEGMENTED: Record<string, { label: string; hint?: string; options: readonly { value: string; label: string }[] }> = {
      image_width: { label: "Largeur de l'image", hint: 'Sur grand écran. En dessous, image et texte s’empilent.', options: HERO_IMAGE_WIDTH_OPTIONS },
      image_side: { label: "Côté de l'image", options: HERO_IMAGE_SIDE_OPTIONS },
      text_overlap: { label: 'Rencontre du texte et de l’image', hint: 'Le texte peut rester à côté, déborder légèrement, ou passer par-dessus.', options: HERO_TEXT_OVERLAP_OPTIONS },
      text_box_width: { label: 'Largeur du bloc de texte', hint: 'Le texte grandit avec la colonne. Quand il passe par-dessus l’image, c’est cette largeur qui règle le recouvrement.', options: HERO_TEXT_WIDTH_OPTIONS },
    };

    if (key in SEGMENTED) {
      const spec = SEGMENTED[key];
      const current = String(val ?? spec.options[0].value);
      return (
        <div key={key} className="space-y-2">
          <div>
            <p className="text-[13px] font-medium text-stone-800">{spec.label}</p>
            {spec.hint && <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">{spec.hint}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spec.options.map((option) => {
              const active = current === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onUpdate(i, key, option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Ambiance des cartes (grilles d'atouts, tarifs, témoignages) ──
    if (key === 'cards_theme') {
      return (
        <ThemeChoice
          key={key}
          label="Ambiance des cartes"
          hint="Les cartes posées sur la section — atouts, offres, témoignages."
          value={String(val ?? 'light')}
          onChange={(v) => onUpdate(i, key, v)}
        />
      );
    }

    // ── Fond des cartes, choisi dans la charte ──
    if (key === 'cards_bg_color') {
      return (
        <ThemeColorField
          key={key}
          label="Fond des cartes"
          hint="« Automatique » laisse les cartes suivre le thème de la section."
          value={String(val ?? '')}
          onChange={(v) => onUpdate(i, key, v)}
        />
      );
    }

    // ── boolean (checkbox) ──
    if (hint.startsWith('boolean')) {
      const checked = !!val;
      return (
        <div key={key} className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            id={`field-${i}-${key}`}
            checked={checked}
            onChange={(e) => onUpdate(i, key, e.target.checked)}
            className="w-4 h-4 cursor-pointer accent-stone-900 rounded border-stone-300 focus:ring-stone-900"
          />
          <label
            htmlFor={`field-${i}-${key}`}
            className="text-xs font-bold text-stone-700 cursor-pointer select-none"
          >
            {labelFor(key)}
          </label>
        </div>
      );
    }

    // ── Opacité image ──
    if (hint.startsWith('opacity')) {
      const opacityVal = typeof val === 'number' ? val : parseInt(String(val ?? '70'), 10) || 70;
      return (
        <div key={key}>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[12.5px] font-medium text-stone-700">{labelFor(key)}</label>
            <span className="text-[12px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
              {opacityVal}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={opacityVal}
            onChange={(e) => onUpdate(i, key, parseInt(e.target.value))}
            className="w-full cursor-pointer accent-stone-900"
          />
        </div>
      );
    }

    // ── Hauteur minimale ──
    if (hint.startsWith('height')) {
      const heightVal = typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) || 0;
      return (
        <div key={key}>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[12.5px] font-medium text-stone-700">{labelFor(key)}</label>
            <span className="text-[12px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
              {heightVal > 0 ? `${heightVal}px` : 'Auto'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1200"
            step="50"
            value={heightVal}
            onChange={(e) => onUpdate(i, key, parseInt(e.target.value))}
            className="w-full cursor-pointer accent-stone-900"
          />
          <div className="flex justify-between text-[11.5px] text-stone-500 mt-0.5">
            <span>Auto</span>
            <span>600px</span>
            <span>1200px</span>
          </div>
        </div>
      );
    }

    // ── Position de l'image de fond ──
    if (hint.startsWith('position')) {
      const positions = [
        { label: 'Centre', value: 'center' },
        { label: 'Haut', value: 'top' },
        { label: 'Bas', value: 'bottom' },
        { label: 'Gauche', value: 'left' },
        { label: 'Droite', value: 'right' },
        { label: 'H. gauche', value: 'top left' },
        { label: 'H. droite', value: 'top right' },
        { label: 'B. gauche', value: 'bottom left' },
        { label: 'B. droite', value: 'bottom right' },
      ];
      const current = (val as string | undefined) || 'center';
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          <div className="grid grid-cols-3 gap-1">
            {positions.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onUpdate(i, key, p.value)}
                className={`py-1 rounded-lg text-[12px] font-bold border transition-all cursor-pointer ${
                  current === p.value
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── Proportion des colonnes (texte + image) ──
    if (hint.startsWith('ratio')) {
      const ratios = [
        { label: '¼ / ¾', value: 'quarter' },
        { label: '⅓ / ⅔', value: 'third' },
        { label: '½ / ½', value: 'half' },
      ];
      const current = (val as string | undefined) || 'half';
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          <div className="flex gap-2">
            {ratios.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onUpdate(i, key, r.value)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  current === r.value
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── Taille de l'image (% de la colonne) ──
    if (hint.startsWith('width-percent')) {
      const widthVal = typeof val === 'number' ? val : parseInt(String(val ?? '100'), 10) || 100;
      return (
        <div key={key}>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[12.5px] font-medium text-stone-700">{labelFor(key)}</label>
            <span className="text-[12px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
              {widthVal}%
            </span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            step="5"
            value={widthVal}
            onChange={(e) => onUpdate(i, key, parseInt(e.target.value))}
            className="w-full cursor-pointer accent-stone-900"
          />
        </div>
      );
    }

    /*
    Variante de bouton.

    Le réglage s'appelait « Couleur du bouton » et proposait « 🟢 Vert » ou
    « ⚪ Blanc » : les deux teintes du site d'origine. Il ne décrivait plus
    rien dès qu'un client réglait sa propre palette, et surtout il ne
    pilotait pas les jetons de boutons de « Design & Style ». On choisit
    désormais un **rôle** ; la couleur en découle.
    */
    if (key === 'button_style') {
      const current = buttonVariantOf(val);
      return (
        <div key={key} className="space-y-2">
          <div>
            <p className="text-[13px] font-medium text-stone-800">Style du bouton</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-stone-600">
              Les couleurs viennent de Paramètres → Design &amp; style.
            </p>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {BUTTON_VARIANT_OPTIONS.map((option) => {
              const active = current === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  title={option.hint}
                  onClick={() => onUpdate(i, key, option.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                    active
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  <span className="block text-[13px] font-medium">{option.label}</span>
                  <span
                    className={`mt-0.5 block text-[12px] leading-snug ${active ? 'text-stone-500' : 'text-stone-600'}`}
                  >
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Position de l'image (split section intro_1) ──
    if (key === 'image_position') {
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          <div className="flex gap-2">
            {(['left', 'right'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => onUpdate(i, key, opt)}
                aria-pressed={(val ?? 'left') === opt}
                className={`flex-1 rounded-lg border py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                  (val ?? 'left') === opt
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                }`}
              >
                {opt === 'left' ? 'À gauche' : 'À droite'}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── Champ image — picker bibliothèque ──
    if (isImage) {
      const imgUrl = String(val ?? '');
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          {imgUrl && (
            <div className="relative mb-2 group">
              <img
                src={imgUrl}
                alt=""
                className="w-full h-24 object-cover rounded-lg border border-stone-200"
              />
              <button
                onClick={() => onUpdate(i, key, '')}
                className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} className="text-stone-600" />
              </button>
            </div>
          )}
          <button
            onClick={() => setMediaPickerKey(key)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-lg py-2 text-xs text-stone-500 hover:border-stone-400 hover:text-stone-900 transition-colors font-medium"
          >
            <ImageIcon size={14} />
            {imgUrl ? "Changer l'image" : 'Choisir dans la bibliothèque'}
          </button>
          {mediaPickerKey === key && (
            <MediaLibrary
              onClose={() => setMediaPickerKey(null)}
              onSelect={(url) => {
                onUpdate(i, key, url);
                setMediaPickerKey(null);
              }}
            />
          )}
        </div>
      );
    }

    // ── string[] — liste réordonnable ──
    if (isArray && Array.isArray(val)) {
      const arr = val as string[];
      const moveItem = (from: number, to: number) => {
        if (to < 0 || to >= arr.length) return;
        const n = [...arr];
        const [it] = n.splice(from, 1);
        n.splice(to, 0, it);
        onUpdate(i, key, n);
      };
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          {arr.map((item, j) => (
            <div key={j} className="flex gap-1.5 mb-2 items-start">
              <div className="flex-1 min-w-0">
                <RichTextarea
                  className={inputCls}
                  value={item}
                  onChange={(v) => {
                    const n = [...arr];
                    n[j] = v;
                    onUpdate(i, key, n);
                  }}
                />
              </div>
              <div className="flex flex-col gap-0.5 mt-6 shrink-0">
                <button
                  type="button"
                  title="Monter"
                  onClick={() => moveItem(j, j - 1)}
                  disabled={j === 0}
                  className="text-stone-500 hover:text-stone-700 disabled:opacity-20 cursor-pointer leading-none text-[12px]"
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Descendre"
                  onClick={() => moveItem(j, j + 1)}
                  disabled={j === arr.length - 1}
                  className="text-stone-500 hover:text-stone-700 disabled:opacity-20 cursor-pointer leading-none text-[12px]"
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                title="Supprimer cette ligne"
                onClick={() =>
                  onUpdate(
                    i,
                    key,
                    arr.filter((_, k) => k !== j),
                  )
                }
                className="text-stone-500 hover:text-red-500 px-1 mt-6 shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onUpdate(i, key, [...arr, ''])}
            className="text-xs text-stone-900 hover:underline mt-1 cursor-pointer"
          >
            + Ajouter une ligne
          </button>
        </div>
      );
    }

    // ── Union littérale du schéma (colonnes, séparateur, vitesse…) ──
    const enumValues = parseEnumHint(hint);
    if (enumValues && enumValues.length <= 8) {
      const current = String(val ?? enumValues[0]);
      return (
        <div key={key}>
          <label className="block text-[12.5px] font-medium text-stone-700 mb-1">{labelFor(key)}</label>
          <div className="flex gap-1.5 flex-wrap">
            {enumValues.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onUpdate(i, key, opt)}
                className={`flex-1 min-w-8 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  current === opt
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {ENUM_LABELS[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // ── scalar ──
    const isLong = ['description', 'text', 'content', 'quote'].some((k) => key.includes(k));
    const isSingleLine = SINGLE_LINE_RE.test(key);
    return (
      <div key={key}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="block text-sm font-extrabold text-zinc-900 tracking-tight">{labelFor(key)}</label>
          {FIELD_TOOLTIPS[key] && (
            <span title={FIELD_TOOLTIPS[key]} className="inline-flex cursor-help text-zinc-400 hover:text-zinc-900 transition-colors">
              <HelpCircle size={13} />
            </span>
          )}
        </div>
        {isLong ? (
          <RichTextarea
            className={inputCls}
            value={String(val ?? '')}
            onChange={(v) => onUpdate(i, key, v)}
            minRows={2}
          />
        ) : isSingleLine ? (
          // Un lien ou une URL ne doit pas pouvoir contenir de retour ligne.
          <input
            type="text"
            className={inputCls}
            placeholder={key.endsWith('_href') ? '/contact ou https://…' : undefined}
            value={String(val ?? '')}
            onChange={(e) => onUpdate(i, key, e.target.value)}
          />
        ) : (
          <AutoTextarea
            className={inputCls}
            value={String(val ?? '')}
            onChange={(v) => onUpdate(i, key, v)}
          />
        )}
      </div>
    );
  };

  /** Champs pilotés ailleurs : cartes, ambiance et fond ont leur propre bloc.
   * On combine toutes les clés du schéma ET de data pour qu'absolument n'importe quel texte ou option de la section soit éditable.
   */
  const allDataKeys = Object.keys(data || {});
  const allSchemaKeys = Object.keys(schema || {});
  const combinedKeys = Array.from(new Set([...allSchemaKeys, ...allDataKeys]));

  const scalarKeys = combinedKeys.filter(
    (key) =>
      !key.includes('[]') &&
      key !== 'cards' &&
      key !== 'plans' &&
      key !== 'personas' &&
      key !== 'painPoints' &&
      key !== 'voiceFeatures' &&
      key !== 'faqs' &&
      key !== 'inclusions' &&
      key !== 'features' &&
      key !== 'theme' &&
      key !== 'bg_color' &&
      key !== 'bg_pattern' &&
      key !== 'bg_pattern_scale' &&
      key !== 'bg_pattern_repeat' &&
      key !== 'bg_pattern_opacity' &&
      !Array.isArray(data[key]) &&
      (typeof data[key] !== 'object' || data[key] === null)
  );

  return (
    <div className="space-y-3">
      {/* ── Barre Tout ouvrir / Tout fermer ── */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 select-none">
        <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
          Réglages de section
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const all: Record<string, boolean> = { bg: true, cards: true };
              FIELD_GROUPS.forEach((g) => { all[g.id] = true; });
              all['autres'] = true;
              setOpenGroupKeys(all);
            }}
            className="text-[11px] font-bold text-zinc-800 hover:text-white bg-zinc-100 hover:bg-zinc-900 border border-zinc-300 px-2 py-0.5 rounded-[5px] transition-all cursor-pointer"
          >
            Tout ouvrir
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenGroupKeys({});
            }}
            className="text-[11px] font-bold text-zinc-800 hover:text-white bg-zinc-100 hover:bg-zinc-900 border border-zinc-300 px-2 py-0.5 rounded-[5px] transition-all cursor-pointer"
          >
            Tout fermer
          </button>
        </div>
      </div>
      {/* ── Couleur, Ambiance & Motif de Fond ── */}
      {(scope === 'background' || (scope === 'all' && !contentOnly)) && (
        <AccordionGroup
          title="Couleurs, Ambiance & Motif de Fond"
          hint="Couleur, thème clair/foncé et texture vectorielle"
          defaultOpen={false}
          isOpenState={openGroupKeys['bg']}
          onToggle={() => setOpenGroupKeys((prev) => ({ ...prev, bg: !prev.bg }))}
        >
          <div className="px-4 py-5 bg-zinc-100/80 border-0 rounded-none">
            <ThemeColorField
              label="Fond de la section"
              hint="« Automatique » suit le thème clair ou foncé choisi ci-dessous."
              value={(data.bg_color as string | undefined) || ''}
              onChange={(v) => onUpdate(i, 'bg_color', v)}
            />
          </div>

          {'theme' in schema && (
            <div className="px-4 py-5 bg-white border-0 rounded-none">
              <ThemeChoice
                label="Ambiance & Thème"
                hint="Alterner clair, sauge, sable et foncé d'une section à l'autre découpe la page avec harmonie."
                value={(data.theme as string | undefined) ?? (section.type === 'cta_1' ? 'dark' : 'light')}
                onChange={(v) => onUpdate(i, 'theme', v)}
              />
            </div>
          )}

          <div className="px-4 py-5 bg-zinc-100/80 border-0 rounded-none">
            <PatternChoice
              pattern={(data.bg_pattern as string | undefined) || 'none'}
              scale={(data.bg_pattern_scale as string | undefined) || 'normal'}
              repeat={(data.bg_pattern_repeat as string | undefined) || 'repeat'}
              opacity={data.bg_pattern_opacity !== undefined ? Number(data.bg_pattern_opacity) : 12}
              onChangePattern={(v) => onUpdate(i, 'bg_pattern', v)}
              onChangeScale={(v) => onUpdate(i, 'bg_pattern_scale', v)}
              onChangeRepeat={(v) => onUpdate(i, 'bg_pattern_repeat', v)}
              onChangeOpacity={(v) => onUpdate(i, 'bg_pattern_opacity', v)}
            />
          </div>
        </AccordionGroup>
      )}

      {/* ── Champs du schéma, rangés par rôle et pliés en accordéons (fermés par défaut) ── */}
      {[...FIELD_GROUPS, { id: 'autres', title: 'Autres réglages', hint: '', match: () => false }]
        .filter((group) =>
          scope === 'all'
            ? true
            : scope === 'background'
              ? BACKGROUND_GROUPS.includes(group.id)
              : !BACKGROUND_GROUPS.includes(group.id),
        )
        .map(
        (group) => {
          const keys = scalarKeys.filter((key) => groupOf(key) === group.id);
          if (keys.length === 0) return null;
          return (
            <AccordionGroup
              key={group.id}
              title={group.title}
              hint={group.hint}
              defaultOpen={false}
              isOpenState={openGroupKeys[group.id]}
              onToggle={() => setOpenGroupKeys((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
            >
                {keys.map((key, keyIdx) => (
                  <div
                    key={key}
                    className={`px-4 py-5 border-0 rounded-none ${
                      keyIdx % 2 === 0
                        ? 'bg-indigo-50/50 text-zinc-900'
                        : 'bg-white text-zinc-900'
                    }`}
                  >
                    {renderScalarField(key, (schema[key] || '') as string)}
                  </div>
                ))}
            </AccordionGroup>
          );
        },
      )}
      {cards && scope !== 'background' && (
        <AccordionGroup
          title={cardsKey === 'plans' ? 'Gestion des Formules' : 'Gestion des Cartes & Éléments'}
          hint="Ajoutez, réordonnez ou éditez chaque carte"
          defaultOpen={false}
          isOpenState={openGroupKeys['cards']}
          onToggle={() => setOpenGroupKeys((prev) => ({ ...prev, cards: !prev.cards }))}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-zinc-900 uppercase tracking-wider">
              Éléments
            </p>
            <button
              onClick={() => {
                let tpl: any = { title: '', description: '', icon: '', link_text: '', link_href: '' };
                const st = section.type as string;
                if (st === 'pricing_2') {
                  tpl = { name: 'Nouvelle formule', price_monthly: '49 €', price_yearly: '39 €', period: '/mois', description: '', popular: false, features: ['Avantage 1'], cta_text: 'Choisir', cta_href: '#' };
                } else if (st === 'stats_3') {
                  tpl = { metric: '100%', label: 'Indicateur', sublabel: '', highlight: false };
                } else if (st === 'bento_grid_1') {
                  tpl = { title: 'Nouvelle fonctionnalité', description: '', tag: 'Nouveau', metric: '', image_url: '' };
                } else if (st === 'features_3') {
                  tpl = { title: '', description: '', items: [''], cta_text: '', cta_href: '#' };
                } else if (st === 'faq_1') {
                  tpl = { question: '', answer: '' };
                } else if (st === 'reviews_1') {
                  tpl = { name: '', date: '', rating: 5, text: '' };
                } else if (['gallery_grid', 'gallery_carousel', 'gallery_masonry'].includes(st)) {
                  tpl = { title: '', description: '', image: '', link: '' };
                } else if (section.type === 'stats_1') {
                  tpl = { value: '', label: '' };
                } else if (section.type === 'timeline_1') {
                  tpl = { title: '', description: '' };
                } else if (section.type === 'logos_1') {
                  tpl = { image: '', alt: '', link: '' };
                }
                onUpdate(i, cardsKey, [...cards, tpl]);
              }}
              className="text-xs text-zinc-900 hover:underline font-extrabold cursor-pointer"
            >
              + {cardsKey === 'plans' ? 'Ajouter une formule' : 'Ajouter une carte'}
            </button>
          </div>
          {cards.map((card, j) => {
            const isCardOpen = openCardIdx === j;
            const cardTitle = (card.title || card.name || card.question || card.label || card.metric || '') as string;
            const displayTitle = cardTitle ? cardTitle : (cardsKey === 'plans' ? 'Formule' : 'Carte');
            return (
              <div key={j} className="border border-zinc-300 mb-2 bg-white overflow-hidden rounded-none">
                {/* Header de carte cliquable */}
                <div
                  onClick={() => setOpenCardIdx(isCardOpen ? null : j)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors ${
                    isCardOpen ? 'bg-zinc-900 text-white font-extrabold' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs uppercase tracking-wider font-extrabold truncate">
                      {displayTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      title="Monter"
                      disabled={j === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(i, cardsKey, moveInArray(cards, j, j - 1));
                      }}
                      className="p-1 hover:bg-white/20 rounded text-[11px] disabled:opacity-20 cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Descendre"
                      disabled={j === cards.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(i, cardsKey, moveInArray(cards, j, j + 1));
                      }}
                      className="p-1 hover:bg-white/20 rounded text-[11px] disabled:opacity-20 cursor-pointer"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      title="Dupliquer cet élément"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(i, cardsKey, [
                          ...cards.slice(0, j + 1),
                          JSON.parse(JSON.stringify(card)),
                          ...cards.slice(j + 1),
                        ]);
                      }}
                      className="p-1 hover:bg-white/20 rounded text-[11px] cursor-pointer"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!window.confirm(`Supprimer ${cardsKey === 'plans' ? 'la formule' : 'la carte'} ${j + 1} ?`)) return;
                        onUpdate(
                          i,
                          cardsKey,
                          cards.filter((_: unknown, k: number) => k !== j),
                        );
                      }}
                      className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[11px] cursor-pointer"
                    >
                      ✕
                    </button>
                    {isCardOpen ? <ChevronDown size={14} className="text-amber-300" /> : <ChevronRight size={14} className="text-zinc-500" />}
                  </div>
                </div>

                {/* Corps de la carte visible seulement quand sélectionnée */}
                {isCardOpen && (
                  <div className="py-2.5 px-0 divide-y divide-zinc-200 border-t border-zinc-200">
              {(CARD_FIELDS_BY_TYPE[section.type] || Object.keys(card)).map((field) => {
                const isCardImage =
                  field !== 'icon_image_bleed' && (field === 'image' || field.includes('image'));
                const isLongCardField = ['description', 'answer'].includes(field);
                const val = card[field] ?? (field === 'features' || field === 'items' ? [] : undefined);
                if (CARD_BOOLEAN_FIELDS.has(field)) {
                  return (
                    <div key={field} className="flex items-center gap-2 px-4 py-3 bg-white">
                      <input
                        type="checkbox"
                        id={`card-${i}-${j}-${field}`}
                        checked={!!val}
                        onChange={(e) => onUpdate(i, `${cardsKey}[${j}].${field}`, e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-zinc-900 rounded border-zinc-300 focus:ring-zinc-900"
                      />
                      <label
                        htmlFor={`card-${i}-${j}-${field}`}
                        className="text-xs font-bold text-zinc-900 cursor-pointer select-none"
                      >
                        {labelFor(field)}
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={field} className="px-4 py-3 bg-white">
                    <label className="text-[12px] font-bold text-zinc-900 block mb-1">
                      {labelFor(field)}
                    </label>
                    {field === 'rating' ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => onUpdate(i, `${cardsKey}[${j}].rating`, s)}
                            className={`text-lg transition-colors ${s <= (Number(val) || 5) ? 'text-yellow-400' : 'text-stone-200'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    ) : field === 'theme' ? (
                      <div className="flex gap-2">
                        {(['light', 'dark', ''] as const).map((opt) => (
                          <button
                            key={opt || 'auto'}
                            type="button"
                            onClick={() => onUpdate(i, `${cardsKey}[${j}].theme`, opt || undefined)}
                            aria-pressed={(card.theme ?? '') === opt}
                            className={`flex-1 rounded-lg border py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                              (card.theme ?? '') === opt
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                            }`}
                          >
                            {opt === 'light' ? 'Clair' : opt === 'dark' ? 'Foncé' : 'Auto'}
                          </button>
                        ))}
                      </div>
                    ) : Array.isArray(val) ? (
                      <div>
                        {(val as string[]).map((item, k) => (
                          <div key={k} className="flex gap-1 mb-1">
                            <div className="flex-1">
                              <RichTextarea
                                className="w-full border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-stone-900 leading-relaxed"
                                value={item}
                                onChange={(v) => {
                                  const next = [...(val as string[])];
                                  next[k] = v;
                                  onUpdate(i, `${cardsKey}[${j}].${field}`, next);
                                }}
                              />
                            </div>
                            <button
                              onClick={() =>
                                onUpdate(
                                  i,
                                  `${cardsKey}[${j}].${field}`,
                                  (val as string[]).filter((_: unknown, m: number) => m !== k),
                                )
                              }
                              className="text-stone-500 hover:text-red-500 px-1 text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => onUpdate(i, `${cardsKey}[${j}].${field}`, [...(val as string[]), ''])}
                          className="text-xs text-stone-900 hover:underline cursor-pointer font-semibold"
                        >
                          + Ajouter
                        </button>
                      </div>
                    ) : isCardImage ? (
                      <div className="space-y-1.5">
                        {typeof val === 'string' && val ? (
                          <div className="relative group">
                            <img
                              src={val}
                              alt=""
                              className="w-full h-16 object-cover rounded-xl border border-stone-200"
                            />
                            <button
                              onClick={() => onUpdate(i, `${cardsKey}[${j}].${field}`, '')}
                              className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <X size={10} className="text-stone-600" />
                            </button>
                          </div>
                        ) : null}
                        <button
                          onClick={() => setMediaPickerKey(`${cardsKey}[${j}].${field}`)}
                          className="w-full flex items-center justify-center gap-1 border-2 border-dashed border-stone-200 rounded-xl py-2 text-[12px] text-stone-500 hover:border-stone-400 hover:text-stone-900 transition-colors font-medium cursor-pointer"
                        >
                          <ImageIcon size={12} />
                          {val ? "Changer l'image" : 'Choisir une image'}
                        </button>
                        {mediaPickerKey === `${cardsKey}[${j}].${field}` && (
                          <MediaLibrary
                            onClose={() => setMediaPickerKey(null)}
                            onSelect={(url) => {
                              onUpdate(i, `cards[${j}].${field}`, url);
                              setMediaPickerKey(null);
                            }}
                          />
                        )}
                      </div>
                    ) : isLongCardField ? (
                      <RichTextarea
                        className="w-full border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-stone-900 leading-relaxed"
                        minRows={2}
                        value={String(val ?? '')}
                        onChange={(v) => onUpdate(i, `cards[${j}].${field}`, v)}
                      />
                    ) : (
                      <input
                        className="w-full border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-stone-900"
                        value={String(val ?? '')}
                        onChange={(e) => onUpdate(i, `cards[${j}].${field}`, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
                  </div>
                )}
              </div>
            );
          })}
        </AccordionGroup>
      )}
      {scope !== 'background' && customArrayKeys.map((arrKey) => {
        const arrItems = data[arrKey] as Record<string, unknown>[];
        if (!Array.isArray(arrItems) || arrItems.length === 0) return null;
        const groupTitle = labelFor(arrKey);

        return (
          <AccordionGroup
            key={arrKey}
            title={`Gestion : ${groupTitle} (${arrItems.length})`}
            hint="Ajoutez, réordonnez ou éditez chaque élément"
            defaultOpen={false}
            isOpenState={openGroupKeys[arrKey]}
            onToggle={() => setOpenGroupKeys((prev) => ({ ...prev, [arrKey]: !prev[arrKey] }))}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-zinc-900 uppercase tracking-wider">
                {groupTitle}
              </p>
              <button
                type="button"
                onClick={() => {
                  let tpl: any = { title: '', description: '' };
                  if (arrKey === 'personas') {
                    tpl = { title: 'Nouveau profil', description: '', badge: 'Secteur' };
                  } else if (arrKey === 'painPoints') {
                    tpl = { beforeTitle: 'Contrainte', beforeDesc: '', afterTitle: 'Avantage solution', afterDesc: '' };
                  } else if (arrKey === 'voiceFeatures') {
                    tpl = { title: 'Nouvelle commande vocale', subtitle: '', description: '', speechExample: '', aiResult: '', badge: 'Vocal' };
                  } else if (arrKey === 'inclusions') {
                    tpl = { title: 'Nouvel élément inclus', desc: '' };
                  } else if (arrKey === 'faqs') {
                    tpl = { q: 'Question ?', a: 'Réponse...' };
                  } else if (arrItems.length > 0 && typeof arrItems[0] === 'object' && arrItems[0] !== null) {
                    tpl = Object.keys(arrItems[0]).reduce((acc, k) => ({ ...acc, [k]: '' }), {});
                  }
                  onUpdate(i, arrKey, [...arrItems, tpl]);
                }}
                className="text-xs text-zinc-900 hover:underline font-extrabold cursor-pointer"
              >
                + Ajouter ({groupTitle})
              </button>
            </div>

            {arrItems.map((item, j) => {
              const uniqueIndex = (j + 100);
              const isItemOpen = openCardIdx === uniqueIndex;
              const itemTitle = (typeof item === 'object' && item !== null ? (item.title || item.name || item.q || item.question || item.beforeTitle || item.label || '') : String(item)) as string;
              const displayTitle = itemTitle ? itemTitle : `${groupTitle} #${j + 1}`;

              return (
                <div key={j} className="border border-zinc-300 mb-2 bg-white overflow-hidden rounded-none">
                  {/* Header */}
                  <div
                    onClick={() => setOpenCardIdx(isItemOpen ? null : uniqueIndex)}
                    className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors ${
                      isItemOpen ? 'bg-zinc-900 text-white font-extrabold' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 font-bold'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider font-extrabold truncate">
                      {displayTitle}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        title="Monter"
                        disabled={j === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(i, arrKey, moveInArray(arrItems, j, j - 1));
                        }}
                        className="p-1 hover:bg-white/20 rounded text-[11px] disabled:opacity-20 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        title="Descendre"
                        disabled={j === arrItems.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(i, arrKey, moveInArray(arrItems, j, j + 1));
                        }}
                        className="p-1 hover:bg-white/20 rounded text-[11px] disabled:opacity-20 cursor-pointer"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        title="Dupliquer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(i, arrKey, [
                            ...arrItems.slice(0, j + 1),
                            JSON.parse(JSON.stringify(item)),
                            ...arrItems.slice(j + 1),
                          ]);
                        }}
                        className="p-1 hover:bg-white/20 rounded text-[11px] cursor-pointer"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Supprimer cet élément ?`)) return;
                          onUpdate(
                            i,
                            arrKey,
                            arrItems.filter((_: unknown, k: number) => k !== j),
                          );
                        }}
                        className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[11px] cursor-pointer"
                      >
                        ✕
                      </button>
                      {isItemOpen ? <ChevronDown size={14} className="text-amber-300" /> : <ChevronRight size={14} className="text-zinc-500" />}
                    </div>
                  </div>

                  {/* Body */}
                  {isItemOpen && typeof item === 'object' && item !== null && (
                    <div className="py-2.5 px-0 divide-y divide-zinc-200 border-t border-zinc-200">
                      {Object.keys(item).map((field) => {
                        const val = (item as any)[field];
                        const isLong = ['description', 'desc', 'a', 'answer', 'speechExample', 'aiResult', 'beforeDesc', 'afterDesc'].includes(field);
                        return (
                          <div key={field} className="px-4 py-3 bg-white space-y-1">
                            <label className="block text-xs font-bold text-zinc-900">
                              {labelFor(field)}
                            </label>
                            {isLong ? (
                              <RichTextarea
                                className={inputCls}
                                value={String(val ?? '')}
                                onChange={(v) => onUpdate(i, `${arrKey}[${j}].${field}`, v)}
                                minRows={2}
                              />
                            ) : (
                              <input
                                type="text"
                                className={inputCls}
                                value={String(val ?? '')}
                                onChange={(e) => onUpdate(i, `${arrKey}[${j}].${field}`, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </AccordionGroup>
        );
      })}
    </div>
  );
}
