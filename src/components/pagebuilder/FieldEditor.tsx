import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, X, RotateCcw, Bold, Italic, Link as LinkIcon } from 'lucide-react';

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

  useEffect(() => { resize(); }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={`${className} overflow-hidden`}
      style={{ resize: 'none' }}
      value={value}
      onChange={(e) => { onChange(e.target.value); resize(); }}
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

  useEffect(() => { resize(); }, [value]);

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
      window.alert('URL refusée : seuls les liens http(s), mailto:, tel: et les chemins internes (/…) sont acceptés.');
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

  const btn = 'px-1.5 py-0.5 border border-stone-200 rounded text-[10px] font-bold text-stone-600 hover:bg-stone-100 transition-colors';

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        <button type="button" title="Gras" onMouseDown={(e) => { e.preventDefault(); wrapTag('strong'); }} className={btn}>
          <Bold size={11} />
        </button>
        <button type="button" title="Italique" onMouseDown={(e) => { e.preventDefault(); wrapTag('em'); }} className={`${btn} italic`}>
          <Italic size={11} />
        </button>
        <button type="button" title="Titre H2" onMouseDown={(e) => { e.preventDefault(); wrapTag('h2'); }} className={btn}>H2</button>
        <button type="button" title="Titre H3" onMouseDown={(e) => { e.preventDefault(); wrapTag('h3'); }} className={btn}>H3</button>
        <button type="button" title="Paragraphe" onMouseDown={(e) => { e.preventDefault(); wrapTag('p'); }} className={btn}>¶</button>
        <button type="button" title="Liste à puces" onMouseDown={(e) => { e.preventDefault(); wrap('<ul>\n  <li>', '</li>\n</ul>'); }} className={btn}>• Liste</button>
        <button type="button" title="Insérer un lien" onMouseDown={(e) => { e.preventDefault(); insertLink(); }} className={btn}>
          <LinkIcon size={11} />
        </button>
      </div>
      <textarea
        ref={ref}
        rows={minRows}
        className={`${className} overflow-hidden`}
        style={{ resize: 'none' }}
        value={value}
        onChange={(e) => { onChange(e.target.value); resize(); }}
      />
    </div>
  );
}

const BG_PRESETS = [
  { name: 'Crème', value: '#FAF7F2' },
  { name: 'Blanc', value: '#FFFFFF' },
  { name: 'Lin', value: '#F1EAE0' },
  { name: 'Sauge profond', value: '#5E6B52' },
  { name: 'Taupe', value: '#3A3730' },
  { name: 'Terracotta', value: '#C08768' },
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
};

function labelFor(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const pretty = key.replace(/_/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Les champs `*_href`, `*_url` et libellés courts tiennent sur une seule ligne. */
const SINGLE_LINE_RE = /(_href|_url|_alt|^slug$|^icon$|^separator$)/;

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

function ColorField({
  label,
  value,
  onChange,
  presets = BG_PRESETS,
  fallback = '#ffffff',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets?: { name: string; value: string }[];
  fallback?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] text-stone-400 hover:text-red-500 flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={9} /> Réinitialiser
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            style={{ backgroundColor: p.value }}
            title={p.name}
            aria-label={p.name}
            className={`w-6 h-6 rounded-full border transition-all cursor-pointer shrink-0 ${
              value?.toLowerCase() === p.value.toLowerCase()
                ? 'border-sage ring-2 ring-sage/40 scale-110 shadow'
                : 'border-stone-300 hover:scale-110'
            }`}
          />
        ))}
        <div className="relative w-6 h-6 rounded-full border border-stone-300 overflow-hidden shrink-0">
          <input
            type="color"
            value={value || fallback}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none p-0"
            title="Couleur personnalisée"
          />
        </div>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Auto"
          className="flex-1 min-w-0 border border-stone-200 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-sage text-stone-700"
        />
      </div>
    </div>
  );
}
const CARD_FIELDS_BY_TYPE: Record<string, string[]> = {
  features_2: ['title', 'description', 'icon', 'icon_image', 'icon_image_bleed', 'link_text', 'link_href', 'theme'],
  features_3: ['title', 'description', 'items', 'cta_text', 'cta_href', 'badge', 'theme'],
  gallery_grid: ['image', 'title', 'description', 'link'],
  gallery_carousel: ['image', 'title', 'description', 'link'],
  gallery_masonry: ['image', 'title', 'description', 'link'],
  faq_1: ['question', 'answer'],
  reviews_1: ['name', 'date', 'rating', 'text'],
  stats_1: ['value', 'label'],
  timeline_1: ['title', 'description'],
  logos_1: ['image', 'alt', 'link'],
};
/** Champs de carte à rendre en case à cocher plutôt qu'en input texte. */
const CARD_BOOLEAN_FIELDS = new Set(['icon_image_bleed']);

import { WIREFRAME_REGISTRY } from './wireframes.config';
import type { PageSection } from './wireframes.config';
import MediaLibrary from '../MediaLibrary';

interface Props {
  section: PageSection;
  sectionIndex: number;
  onUpdate: (i: number, key: string, value: unknown) => void;
  compact?: boolean;
}

export default function FieldEditor({ section, sectionIndex: i, onUpdate, compact = false }: Props) {
  const data = section.data as unknown as Record<string, unknown>;
  const schema = WIREFRAME_REGISTRY[section.type]?.dataSchema ?? {};
  const [mediaPickerKey, setMediaPickerKey] = useState<string | null>(null);

  const px = compact ? 'px-2 py-1' : 'px-3 py-2';
  const sz = compact ? 'text-xs' : 'text-sm';
  const inputCls = `w-full border border-stone-200 rounded-lg ${px} ${sz} focus:outline-none focus:ring-1 focus:ring-sage`;

  const cards = Array.isArray(data.cards) ? (data.cards as Record<string, unknown>[]) : null;

  return (
    <div className="space-y-3">
      {/* ── Couleur de fond — toujours visible (toutes les sections la gèrent) ── */}
      <ColorField
        label={labelFor('bg_color')}
        value={(data.bg_color as string | undefined) || ''}
        onChange={(v) => onUpdate(i, 'bg_color', v)}
      />

      {/* ── Thème ☀️ / 🌙 — uniquement pour les sections qui le gèrent ── */}
      {'theme' in schema && (
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Thème</label>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map((opt) => {
              const current = (data.theme as string | undefined) ?? (section.type === 'cta_1' ? 'dark' : 'light');
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onUpdate(i, 'theme', opt)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    current === opt
                      ? opt === 'dark'
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-900 border-stone-300 shadow'
                      : 'border-stone-200 text-stone-400 hover:border-stone-400'
                  }`}
                >
                  {opt === 'light' ? '☀️ Clair' : '🌙 Sombre'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Champs scalaires du schema (hors cards, theme, button_style) ── */}
      {Object.entries(schema).map(([key, typeHint]) => {
        if (key.includes('[]')) return null;
        if (key === 'cards') return null;
        if (key === 'theme') return null;   // affiché ci-dessus
        if (key === 'bg_color') return null; // idem — évitait un doublon sur marquee_1 / pricing_1

        const val = data[key];
        const hint = typeHint as string;
        const isImage = hint === 'image (optionnel)' || hint.startsWith('image');
        const isArray = hint.startsWith('string[]') || hint.startsWith('array');

        // ── Couleur (autre que bg_color, ex. text_color du bandeau défilant) ──
        if (key.endsWith('_color') || hint.includes('couleur')) {
          return (
            <ColorField
              key={key}
              label={labelFor(key)}
              value={String(val ?? '')}
              onChange={(v) => onUpdate(i, key, v)}
              fallback="#000000"
            />
          );
        }

        // ── Thème des cartes ──
        if (key === 'cards_theme') {
          return (
            <div key={key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="flex gap-2">
                {(['light', 'dark'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onUpdate(i, key, opt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      (val ?? 'light') === opt
                        ? opt === 'dark'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-stone-50 text-stone-900 border-stone-300 shadow'
                        : 'border-stone-200 text-stone-400 hover:border-stone-400'
                    }`}
                  >
                    {opt === 'light' ? '☀️ Clair' : '🌙 Sombre'}
                  </button>
                ))}
              </div>
            </div>
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
                className="w-4 h-4 cursor-pointer accent-sage rounded border-stone-300 focus:ring-sage"
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{labelFor(key)}</label>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{opacityVal}%</span>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{labelFor(key)}</label>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
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
              <div className="flex justify-between text-[9px] text-stone-400 mt-0.5">
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="grid grid-cols-3 gap-1">
                {positions.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdate(i, key, p.value)}
                    className={`py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      current === p.value
                        ? 'bg-sage text-white border-sage'
                        : 'border-stone-200 text-stone-400 hover:border-stone-400'
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="flex gap-2">
                {ratios.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onUpdate(i, key, r.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      current === r.value
                        ? 'bg-sage text-white border-sage'
                        : 'border-stone-200 text-stone-400 hover:border-stone-400'
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{labelFor(key)}</label>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{widthVal}%</span>
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

        // ── Couleur bouton ──
        if (key === 'button_style') {
          return (
            <div key={key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="flex gap-2">
                {(['green', 'white'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onUpdate(i, key, opt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      (val ?? 'green') === opt
                        ? opt === 'green' ? 'bg-sage text-white border-sage' : 'bg-white text-stone-900 border-stone-400 shadow'
                        : 'border-stone-200 text-stone-400 hover:border-stone-400'
                    }`}
                  >
                    {opt === 'green' ? '🟢 Vert' : '⚪ Blanc'}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        // ── Position de l'image (split section intro_1) ──
        if (key === 'image_position') {
          return (
            <div key={key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="flex gap-2">
                {(['left', 'right'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onUpdate(i, key, opt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      (val ?? 'left') === opt
                        ? 'bg-sage text-white border-sage'
                        : 'border-stone-200 text-stone-400 hover:border-stone-400'
                    }`}
                  >
                    {opt === 'left' ? '👈 Gauche' : '👉 Droite'}
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              {imgUrl && (
                <div className="relative mb-2 group">
                  <img src={imgUrl} alt="" className="w-full h-24 object-cover rounded-lg border border-stone-200" />
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
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 rounded-lg py-2 text-xs text-stone-500 hover:border-sage hover:text-sage transition-colors font-medium"
              >
                <ImageIcon size={14} />
                {imgUrl ? 'Changer l\'image' : 'Choisir dans la bibliothèque'}
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              {arr.map((item, j) => (
                <div key={j} className="flex gap-1.5 mb-2 items-start">
                  <div className="flex-1 min-w-0">
                    <RichTextarea className={inputCls} value={item}
                      onChange={(v) => { const n = [...arr]; n[j] = v; onUpdate(i, key, n); }} />
                  </div>
                  <div className="flex flex-col gap-0.5 mt-6 shrink-0">
                    <button type="button" title="Monter" onClick={() => moveItem(j, j - 1)} disabled={j === 0}
                      className="text-stone-300 hover:text-stone-700 disabled:opacity-20 cursor-pointer leading-none text-[10px]">▲</button>
                    <button type="button" title="Descendre" onClick={() => moveItem(j, j + 1)} disabled={j === arr.length - 1}
                      className="text-stone-300 hover:text-stone-700 disabled:opacity-20 cursor-pointer leading-none text-[10px]">▼</button>
                  </div>
                  <button type="button" title="Supprimer cette ligne" onClick={() => onUpdate(i, key, arr.filter((_, k) => k !== j))}
                    className="text-stone-400 hover:text-red-500 px-1 mt-6 shrink-0 cursor-pointer">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => onUpdate(i, key, [...arr, ''])} className="text-xs text-sage hover:underline mt-1 cursor-pointer">
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
              <div className="flex gap-1.5 flex-wrap">
                {enumValues.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onUpdate(i, key, opt)}
                    className={`flex-1 min-w-8 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      current === opt
                        ? 'bg-sage text-white border-sage'
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{labelFor(key)}</label>
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
      })}
      {cards && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Cartes ({cards.length})</p>
            <button
              onClick={() => {
                let tpl: any = { title: '', description: '', icon: '', link_text: '', link_href: '' };
                if (section.type === 'features_3') {
                  tpl = { title: '', description: '', items: [''], cta_text: '', cta_href: '#' };
                } else if (section.type === 'faq_1') {
                  tpl = { question: '', answer: '' };
                } else if (section.type === 'reviews_1') {
                  tpl = { name: '', date: '', rating: 5, text: '' };
                } else if (['gallery_grid', 'gallery_carousel', 'gallery_masonry'].includes(section.type)) {
                  tpl = { title: '', description: '', image: '', link: '' };
                } else if (section.type === 'stats_1') {
                  tpl = { value: '', label: '' };
                } else if (section.type === 'timeline_1') {
                  tpl = { title: '', description: '' };
                } else if (section.type === 'logos_1') {
                  tpl = { image: '', alt: '', link: '' };
                }
                onUpdate(i, 'cards', [...cards, tpl]);
              }}
              className="text-xs text-sage hover:underline font-bold"
            >+ Carte</button>
          </div>
          {cards.map((card, j) => (
            <div key={j} className="bg-stone-50 rounded-xl p-3 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-stone-500 uppercase">Carte {j + 1}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Monter"
                    disabled={j === 0}
                    onClick={() => onUpdate(i, 'cards', moveInArray(cards, j, j - 1))}
                    className="text-[10px] text-stone-400 hover:text-stone-800 disabled:opacity-20 cursor-pointer"
                  >▲</button>
                  <button
                    type="button"
                    title="Descendre"
                    disabled={j === cards.length - 1}
                    onClick={() => onUpdate(i, 'cards', moveInArray(cards, j, j + 1))}
                    className="text-[10px] text-stone-400 hover:text-stone-800 disabled:opacity-20 cursor-pointer"
                  >▼</button>
                  <button
                    type="button"
                    title="Dupliquer cette carte"
                    onClick={() => onUpdate(i, 'cards', [
                      ...cards.slice(0, j + 1),
                      JSON.parse(JSON.stringify(card)),
                      ...cards.slice(j + 1),
                    ])}
                    className="text-[10px] text-stone-400 hover:text-sage cursor-pointer"
                  >⧉</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Supprimer la carte ${j + 1} ?`)) return;
                      onUpdate(i, 'cards', cards.filter((_: unknown, k: number) => k !== j));
                    }}
                    className="text-[10px] text-stone-400 hover:text-red-500 cursor-pointer"
                  >✕ Supprimer</button>
                </div>
              </div>
              {(CARD_FIELDS_BY_TYPE[section.type] || Object.keys(card)).map((field) => {
                const isCardImage = field !== 'icon_image_bleed' && (field === 'image' || field.includes('image'));
                const isLongCardField = ['description', 'answer'].includes(field);
                const val = card[field] ?? (field === 'items' ? [] : undefined);
                if (CARD_BOOLEAN_FIELDS.has(field)) {
                  return (
                    <div key={field} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id={`card-${i}-${j}-${field}`}
                        checked={!!val}
                        onChange={(e) => onUpdate(i, `cards[${j}].${field}`, e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-sage rounded border-stone-300 focus:ring-sage"
                      />
                      <label
                        htmlFor={`card-${i}-${j}-${field}`}
                        className="text-xs font-bold text-stone-700 cursor-pointer select-none"
                      >
                        {labelFor(field)}
                      </label>
                    </div>
                  );
                }
                return (
                  <div key={field}>
                    <label className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">{labelFor(field)}</label>
                    {field === 'rating' ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => onUpdate(i, `cards[${j}].rating`, s)}
                            className={`text-lg transition-colors ${s <= (Number(val) || 5) ? 'text-yellow-400' : 'text-stone-200'}`}
                          >★</button>
                        ))}
                      </div>
                    ) : field === 'theme' ? (
                      <div className="flex gap-2">
                        {(['light', 'dark', ''] as const).map((opt) => (
                          <button
                            key={opt || 'auto'}
                            type="button"
                            onClick={() => onUpdate(i, `cards[${j}].theme`, opt || undefined)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              (card.theme ?? '') === opt
                                ? opt === 'dark' ? 'bg-stone-900 text-white border-stone-900'
                                  : opt === 'light' ? 'bg-stone-50 text-stone-900 border-stone-300 shadow'
                                  : 'bg-sage/10 text-sage border-sage'
                                : 'border-stone-200 text-stone-400 hover:border-stone-400'
                            }`}
                          >
                            {opt === 'light' ? '☀️ Clair' : opt === 'dark' ? '🌙 Sombre' : '⚙️ Auto'}
                          </button>
                        ))}
                      </div>
                    ) : Array.isArray(val) ? (
                      <div>
                        {(val as string[]).map((item, k) => (
                          <div key={k} className="flex gap-1 mb-1">
                            <div className="flex-1">
                              <RichTextarea
                                className="w-full border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage"
                                value={item}
                                onChange={(v) => {
                                  const next = [...(val as string[])];
                                  next[k] = v;
                                  onUpdate(i, `cards[${j}].${field}`, next);
                                }}
                              />
                            </div>
                            <button onClick={() => onUpdate(i, `cards[${j}].${field}`, (val as string[]).filter((_: unknown, m: number) => m !== k))}
                              className="text-stone-400 hover:text-red-500 px-1 text-xs">✕</button>
                          </div>
                        ))}
                        <button onClick={() => onUpdate(i, `cards[${j}].${field}`, [...(val as string[]), ''])}
                          className="text-xs text-sage hover:underline">+ Ajouter</button>
                      </div>
                    ) : isCardImage ? (
                      <div className="space-y-1.5">
                        {typeof val === 'string' && val ? (
                          <div className="relative group">
                            <img src={val} alt="" className="w-full h-16 object-cover rounded-lg border border-stone-200" />
                            <button
                              onClick={() => onUpdate(i, `cards[${j}].${field}`, '')}
                              className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} className="text-stone-600" />
                            </button>
                          </div>
                        ) : null}
                        <button
                          onClick={() => setMediaPickerKey(`cards[${j}].${field}`)}
                          className="w-full flex items-center justify-center gap-1 border-2 border-dashed border-stone-200 rounded-lg py-1.5 text-[10px] text-stone-500 hover:border-sage hover:text-sage transition-colors font-medium"
                        >
                          <ImageIcon size={12} />
                          {val ? 'Changer l\'image' : 'Choisir une image'}
                        </button>
                        {mediaPickerKey === `cards[${j}].${field}` && (
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
                        className="w-full border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage"
                        minRows={2}
                        value={String(val ?? '')}
                        onChange={(v) => onUpdate(i, `cards[${j}].${field}`, v)}
                      />
                    ) : (
                      <input
                        className="w-full border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sage"
                        value={String(val ?? '')}
                        onChange={(e) => onUpdate(i, `cards[${j}].${field}`, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
