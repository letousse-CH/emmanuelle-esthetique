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
    const selected = value.slice(start, end) || 'texte du lien';
    const url = window.prompt('URL du lien :', 'https://');
    if (!url) return;
    wrap(`<a href="${url}">`, '</a>');
    // si rien n'était sélectionné, on injecte un libellé par défaut
    if (start === end) {
      const open = `<a href="${url}">`;
      const next = value.slice(0, start) + open + selected + '</a>' + value.slice(end);
      onChange(next);
    }
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
  { name: 'Noir', value: '#0A0A0A' },
  { name: 'Gris foncé', value: '#1c1c1c' },
  { name: 'Papier', value: '#fcfbf7' },
  { name: 'Blanc', value: '#ffffff' },
  { name: 'Sauge', value: '#5b7e5a' },
  { name: 'Cuivre', value: '#B87333' },
];
const CARD_FIELDS_BY_TYPE: Record<string, string[]> = {
  features_2: ['title', 'description', 'icon', 'link_text', 'link_href', 'theme'],
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
      {/* ── Couleur de fond — toujours visible ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Couleur de fond</label>
          {(data.bg_color as string | undefined) && (
            <button onClick={() => onUpdate(i, 'bg_color', '')} className="text-[10px] text-stone-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
              <RotateCcw size={9} /> Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {BG_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onUpdate(i, 'bg_color', p.value)}
              style={{ backgroundColor: p.value }}
              title={p.name}
              className={`w-6 h-6 rounded-full border transition-all cursor-pointer shrink-0 ${
                (data.bg_color as string | undefined)?.toLowerCase() === p.value.toLowerCase()
                  ? 'border-sage ring-2 ring-sage/40 scale-110 shadow'
                  : 'border-stone-300 hover:scale-110'
              }`}
            />
          ))}
          <div className="relative w-6 h-6 rounded-full border border-stone-300 overflow-hidden shrink-0">
            <input
              type="color"
              value={(data.bg_color as string | undefined) || '#ffffff'}
              onChange={(e) => onUpdate(i, 'bg_color', e.target.value)}
              className="absolute inset-0 w-[150%] h-[150%] -translate-x-[15%] -translate-y-[15%] cursor-pointer border-none p-0"
              title="Couleur personnalisée"
            />
          </div>
          <input
            type="text"
            value={(data.bg_color as string | undefined) || ''}
            onChange={(e) => onUpdate(i, 'bg_color', e.target.value)}
            placeholder="Auto"
            className="flex-1 min-w-0 border border-stone-200 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-sage text-stone-700"
          />
        </div>
      </div>

      {/* ── Thème ☀️ / 🌙 — toujours en premier ── */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Thème</label>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((opt) => {
            const current = (data.theme as string | undefined) ?? (section.type === 'cta_1' ? 'dark' : 'light');
            return (
              <button
                key={opt}
                onClick={() => onUpdate(i, 'theme', opt)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
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

      {/* ── Champs scalaires du schema (hors cards, theme, button_style) ── */}
      {Object.entries(schema).map(([key, typeHint]) => {
        if (key.includes('[]')) return null;
        if (key === 'cards') return null;
        if (key === 'theme') return null; // affiché ci-dessus

        const val = data[key];
        const hint = typeHint as string;
        const isImage = hint === 'image (optionnel)' || hint.startsWith('image');
        const isArray = hint.startsWith('string[]') || hint.startsWith('array');

        // ── Thème des cartes ──
        if (key === 'cards_theme') {
          return (
            <div key={key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Thème des cartes</label>
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
                {key === 'show_image' ? "Afficher l'image" : key === 'stretch_image' ? "Étirer l'image en hauteur" : key}
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Opacité de l'image</label>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Hauteur minimale</label>
                <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                  {heightVal > 0 ? `${heightVal}px` : 'Auto (100vh)'}
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Position de l'image de fond</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Proportion image / texte</label>
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Taille de l'image</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Couleur du bouton</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">Position de l'image</label>
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{key}</label>
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

        // ── string[] ──
        if (isArray && Array.isArray(val)) {
          const arr = val as string[];
          return (
            <div key={key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{key}</label>
              {arr.map((item, j) => (
                <div key={j} className="flex gap-2 mb-2 items-start">
                  <div className="flex-1">
                    <RichTextarea className={inputCls} value={item}
                      onChange={(v) => { const n = [...arr]; n[j] = v; onUpdate(i, key, n); }} />
                  </div>
                  <button onClick={() => onUpdate(i, key, arr.filter((_, k) => k !== j))}
                    className="text-stone-400 hover:text-red-500 px-2 mt-6">✕</button>
                </div>
              ))}
              <button onClick={() => onUpdate(i, key, [...arr, ''])} className="text-xs text-sage hover:underline mt-1">
                + Ajouter
              </button>
            </div>
          );
        }

        // ── scalar ──
        const isLong = ['description', 'text', 'content', 'quote'].some((k) => key.includes(k));
        return (
          <div key={key}>
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 block">{key}</label>
            {isLong ? (
              <RichTextarea
                className={inputCls}
                value={String(val ?? '')}
                onChange={(v) => onUpdate(i, key, v)}
                minRows={2}
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
                <button
                  onClick={() => onUpdate(i, 'cards', cards.filter((_: unknown, k: number) => k !== j))}
                  className="text-[10px] text-stone-400 hover:text-red-500"
                >✕ Supprimer</button>
              </div>
              {(CARD_FIELDS_BY_TYPE[section.type] || Object.keys(card)).map((field) => {
                const isCardImage = field === 'image' || field.includes('image');
                const isLongCardField = ['description', 'answer'].includes(field);
                const val = card[field] ?? (field === 'items' ? [] : undefined);
                return (
                  <div key={field}>
                    <label className="text-[10px] text-stone-400 uppercase tracking-widest block mb-0.5">{field}</label>
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
