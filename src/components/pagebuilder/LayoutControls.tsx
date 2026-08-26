'use client';

import React, { useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Type,
  Layout,
  Sliders,
} from 'lucide-react';

import {
  CARD_TEXT_SIZE_PRESETS, CARD_TITLE_SIZE_PRESETS, LAYOUT_DEFAULTS, LAYOUT_OPTIONS,
} from './sectionLayout';
import SizeInput from '../admin/SizeInput';

function ApparenceAccordion({
  title,
  icon: Icon,
  hint,
  isOpenState,
  onToggle,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  hint?: string;
  isOpenState?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isOpenState !== undefined ? isOpenState : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className="border border-zinc-300 rounded-lg overflow-hidden shadow-2xs bg-white mb-3 transition-all">
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
          {Icon && <Icon size={15} className={isOpen ? 'text-amber-300' : 'text-zinc-500'} />}
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

function Segmented({
  label,
  hint,
  options,
  value,
  onChange,
  icons,
}: {
  label: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  icons?: Record<string, React.ReactNode>;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold text-zinc-900 mb-0.5">{label}</p>
      {hint && <p className="mb-2 text-[11.5px] leading-snug text-zinc-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 rounded-[5px] border px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                  : 'border-zinc-300 text-zinc-800 bg-white hover:bg-zinc-100'
              }`}
            >
              {icons?.[option.value]}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LayoutControls({
  data,
  onChange,
  hasCards = false,
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  hasCards?: boolean;
}) {
  const get = (key: keyof typeof LAYOUT_DEFAULTS): string =>
    String((data[key] as string | number | undefined) ?? LAYOUT_DEFAULTS[key]);

  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {/* Barre Tout ouvrir / Tout fermer */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 select-none">
        <span className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
          Réglages d'Apparence
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpenBlocks({ spacing: true, typo: true, layout: true })}
            className="text-[11px] font-bold text-zinc-800 hover:text-white bg-zinc-100 hover:bg-zinc-900 border border-zinc-300 px-2 py-0.5 rounded-[5px] transition-all cursor-pointer"
          >
            Tout ouvrir
          </button>
          <button
            type="button"
            onClick={() => setOpenBlocks({})}
            className="text-[11px] font-bold text-zinc-800 hover:text-white bg-zinc-100 hover:bg-zinc-900 border border-zinc-300 px-2 py-0.5 rounded-[5px] transition-all cursor-pointer"
          >
            Tout fermer
          </button>
        </div>
      </div>

      {/* ── 1. Espacement & Dimensions ── */}
      <ApparenceAccordion
        title="Espacement & Dimensions"
        icon={Maximize2}
        hint="Hauteur de la section et largeur du texte"
        isOpenState={openBlocks['spacing']}
        onToggle={() => setOpenBlocks((prev) => ({ ...prev, spacing: !prev.spacing }))}
      >
        <div className="px-4 py-5 bg-indigo-50/50 border-0 rounded-none">
          <Segmented
            label="Espacement vertical (Densité)"
            hint="Aéré donne un rendu haut de gamme ; serré densifie une page."
            options={LAYOUT_OPTIONS.density}
            value={get('density')}
            onChange={(v) => onChange('density', v)}
          />
        </div>

        <div className="px-4 py-5 bg-white border-0 rounded-none">
          <Segmented
            label="Largeur du contenu"
            hint="Étroit convient aux paragraphes, large aux grilles d'éléments."
            options={LAYOUT_OPTIONS.width}
            value={get('width')}
            onChange={(v) => onChange('width', v)}
          />
        </div>
      </ApparenceAccordion>

      {/* ── 2. Typographie & Tailles de Texte ── */}
      <ApparenceAccordion
        title="Typographie & Tailles de Texte"
        icon={Type}
        hint="Taille des titres et descriptions"
        isOpenState={openBlocks['typo']}
        onToggle={() => setOpenBlocks((prev) => ({ ...prev, typo: !prev.typo }))}
      >
        <div className="px-4 py-5 bg-indigo-50/50 border-0 rounded-none">
          <Segmented
            label="Taille du titre principal"
            hint="Personnalisez l'échelle typographique du grand titre de la section."
            options={LAYOUT_OPTIONS.title_size}
            value={String(data.title_size || data.title_font_size || '')}
            onChange={(v) => {
              onChange('title_size', v);
              onChange('title_font_size', v);
            }}
          />
        </div>

        <div className="px-4 py-5 bg-white border-0 rounded-none">
          <Segmented
            label="Taille du texte / description"
            hint="Ajuste la taille du paragraphe principal."
            options={LAYOUT_OPTIONS.content_size}
            value={String(data.content_size || data.content_font_size || '')}
            onChange={(v) => {
              onChange('content_size', v);
              onChange('content_font_size', v);
            }}
          />
        </div>

        {hasCards && (
          <div className="px-4 py-5 bg-indigo-50/50 border-0 rounded-none space-y-3">
            <p className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Tailles dans les Cartes</p>
            <CardSize
              label="Taille du titre de carte"
              hint="Par défaut, suit la taille de la grille."
              presets={CARD_TITLE_SIZE_PRESETS}
              value={String(data.cards_title_size ?? '')}
              onChange={(v) => onChange('cards_title_size', v)}
            />
            <CardSize
              label="Taille du texte de carte"
              hint="N'agit que sur les éléments internes des cartes."
              presets={CARD_TEXT_SIZE_PRESETS}
              value={String(data.cards_text_size ?? '')}
              onChange={(v) => onChange('cards_text_size', v)}
            />
          </div>
        )}
      </ApparenceAccordion>

      {/* ── 3. Disposition & Alignement ── */}
      <ApparenceAccordion
        title="Disposition & Alignement"
        icon={Layout}
        hint="Cadrage de l'image et alignement du texte"
        isOpenState={openBlocks['layout']}
        onToggle={() => setOpenBlocks((prev) => ({ ...prev, layout: !prev.layout }))}
      >
        {('image_url' in data || 'image_side' in data || 'image_position' in data || 'show_image' in data) && (
          <div className="px-4 py-5 bg-indigo-50/50 border-0 rounded-none">
            <Segmented
              label="Position de l'image"
              hint="Place l'image principale à gauche ou à droite du texte."
              options={LAYOUT_OPTIONS.image_side}
              value={String(data.image_side || data.image_position || 'right')}
              onChange={(v) => {
                onChange('image_side', v);
                onChange('image_position', v);
              }}
            />
          </div>
        )}

        <div className="px-4 py-5 bg-white border-0 rounded-none">
          <Segmented
            label="Alignement du texte"
            hint="Centré attire l'œil sur les sections courtes ; à gauche se lit mieux avec du texte."
            options={LAYOUT_OPTIONS.align}
            value={get('align')}
            onChange={(v) => onChange('align', v)}
            icons={{
              left: <AlignLeft size={14} />,
              center: <AlignCenter size={14} />,
            }}
          />
        </div>
      </ApparenceAccordion>
    </div>
  );
}

export function AnimationControls({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  const value = (data.animation as string | undefined) ?? LAYOUT_DEFAULTS.animation;

  return (
    <div className="space-y-4">
      <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-none">
        <Segmented
          label="Apparition au défilement"
          hint="Effet d'apparition quand le visiteur fait défiler la page."
          options={LAYOUT_OPTIONS.animation}
          value={value}
          onChange={(v) => onChange('animation', v)}
        />
      </div>

      <p className="rounded-none border border-zinc-200 bg-white p-3 text-[11.5px] leading-relaxed text-zinc-500">
        Les animations sont désactivées pour les visiteurs ayant configuré la réduction des mouvements dans leur système d'exploitation (norme WCAG/accessibilité).
      </p>
    </div>
  );
}

function CardSize({
  label,
  hint,
  presets,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  presets: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const current = value.trim();
  const isPreset = presets.some((p) => p.value === current);
  const [libre, setLibre] = React.useState(!isPreset && !!current);

  return (
    <div>
      <p className="text-xs font-bold text-zinc-900">{label}</p>
      <p className="mb-2 text-[11.5px] text-zinc-500">{hint}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => {
          const active = !libre && current === preset.value;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => { setLibre(false); onChange(preset.value); }}
              className={`rounded-[5px] border px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 text-zinc-800 bg-white hover:bg-zinc-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={libre}
          onClick={() => setLibre((l) => !l)}
          className={`rounded-[5px] border px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
            libre
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-300 text-zinc-800 bg-white hover:bg-zinc-100'
          }`}
        >
          Taille précise
        </button>
      </div>

      {libre && (
        <div className="mt-2 flex items-center gap-2">
          <SizeInput
            value={current}
            onChange={onChange}
            placeholder="1rem"
            ariaLabel={label}
            className="w-32"
          />
          <span className="text-[11.5px] text-zinc-500">
            En <code>rem</code> ou <code>px</code>.
          </span>
        </div>
      )}
    </div>
  );
}
