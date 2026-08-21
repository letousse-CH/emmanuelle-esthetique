'use client';

import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  Moon,
  Sun,
} from 'lucide-react';

import {
  CARD_TEXT_SIZE_PRESETS, CARD_TITLE_SIZE_PRESETS, LAYOUT_DEFAULTS, LAYOUT_OPTIONS,
} from './sectionLayout';
import SizeInput from '../admin/SizeInput';
import { useThemePalette } from './useThemePalette';

/**
 * Réglages d'apparence d'une section.
 *
 * Chaque réglage est un **choix parmi trois ou quatre**, jamais un champ
 * libre : c'est ce qui garantit qu'une page reste présentable et responsive
 * quoi que fasse la personne qui l'édite. Chaque groupe porte une phrase qui
 * dit ce qu'il fait — un libellé seul (« Densité ») ne suffit pas à quelqu'un
 * qui découvre.
 */

function Segmented({
  label,
  hint,
  options,
  value,
  onChange,
  icons,
}: {
  label: string;
  hint: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  icons?: Record<string, React.ReactNode>;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-stone-800">{label}</p>
      <p className="mb-2 mt-0.5 text-[12.5px] leading-snug text-stone-600">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-stone-50'
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

/**
 * Clair ou foncé, montré avec les couleurs réellement enregistrées.
 *
 * Les deux vignettes étaient un blanc et un `stone-900` en dur : on choisissait
 * une ambiance sans voir ce qu'elle donnerait sur ce site-ci.
 */
export function ThemeControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { swatches } = useThemePalette();
  const light = swatches.find((s) => s.key === 'style_color_bg')?.value ?? '#FFFFFF';
  const dark = swatches.find((s) => s.key === 'style_color_text')?.value ?? '#1C1917';

  return (
    <div>
      <p className="text-[13px] font-medium text-stone-800">Ambiance</p>
      <p className="mb-2 mt-0.5 text-[12.5px] leading-snug text-stone-600">
        Alterner clair et foncé d&apos;une section à l&apos;autre découpe la page
        et évite l&apos;effet « long document ».
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: 'light', label: 'Clair', icon: <Sun size={15} />, bg: light, fg: dark },
          { value: 'dark', label: 'Foncé', icon: <Moon size={15} />, bg: dark, fg: light },
        ].map((option) => {
          const active = (value || 'light') === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-300 hover:border-stone-400'
                }`}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md border border-stone-300"
                style={{ backgroundColor: option.bg, color: option.fg }}
              >
                {option.icon}
              </span>
              <span className="text-[13px] font-medium text-stone-800">{option.label}</span>
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
  /** La section contient-elle une grille de cartes ? */
  hasCards?: boolean;
}) {
  const get = (key: keyof typeof LAYOUT_DEFAULTS): string =>
    String((data[key] as string | number | undefined) ?? LAYOUT_DEFAULTS[key]);

  return (
    <div className="space-y-7">
      {/* Le clair / foncé a rejoint l'onglet « Fond », avec le reste de
          l'arrière-plan : il n'a plus rien à faire ici. */}
      <Segmented
        label="Espacement"
        hint="La hauteur de la section. « Aéré » donne un rendu plus haut de gamme, « serré » densifie une page longue."
        options={LAYOUT_OPTIONS.density}
        value={get('density')}
        onChange={(v) => onChange('density', v)}
      />

      <Segmented
        label="Largeur du contenu"
        hint="Un texte trop large fatigue à la lecture. « Étroit » convient aux paragraphes, « large » aux grilles."
        options={LAYOUT_OPTIONS.width}
        value={get('width')}
        onChange={(v) => onChange('width', v)}
      />

      {hasCards && (
        <div className="space-y-5 rounded-lg border border-stone-200 bg-stone-50 p-4">
          <p className="text-[13px] font-medium text-stone-800">Textes des cartes</p>
          <CardSize
            label="Taille du titre"
            hint="Vide : le titre suit la taille du texte."
            presets={CARD_TITLE_SIZE_PRESETS}
            value={String(data.cards_title_size ?? '')}
            onChange={(v) => onChange('cards_title_size', v)}
          />
          <CardSize
            label="Taille du texte"
            hint="N’agit que sur les cartes — pas sur le titre de la section."
            presets={CARD_TEXT_SIZE_PRESETS}
            value={String(data.cards_text_size ?? '')}
            onChange={(v) => onChange('cards_text_size', v)}
          />
        </div>
      )}

      <Segmented
        label="Taille du titre principal"
        hint="Personnalisez la taille de la police du titre de la section."
        options={LAYOUT_OPTIONS.title_size}
        value={String(data.title_size || data.title_font_size || '')}
        onChange={(v) => {
          onChange('title_size', v);
          onChange('title_font_size', v);
        }}
      />

      <Segmented
        label="Taille du texte / description"
        hint="Personnalisez la taille de la police du paragraphe ou de la description."
        options={LAYOUT_OPTIONS.content_size}
        value={String(data.content_size || data.content_font_size || '')}
        onChange={(v) => {
          onChange('content_size', v);
          onChange('content_font_size', v);
        }}
      />

      {('image_url' in data || 'image_side' in data || 'image_position' in data || 'show_image' in data) && (
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
      )}

      <Segmented
        label="Alignement"
        hint="Centré attire l'œil sur une section courte ; à gauche se lit mieux dès qu'il y a du texte."
        options={LAYOUT_OPTIONS.align}
        value={get('align')}
        onChange={(v) => onChange('align', v)}
        icons={{
          left: <AlignLeft size={14} />,
          center: <AlignCenter size={14} />,
        }}
      />
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
    <div className="space-y-6">
      <Segmented
        label="Apparition"
        hint="Comment la section se révèle quand le visiteur y arrive. En cascade, les éléments entrent l'un après l'autre."
        options={LAYOUT_OPTIONS.animation}
        value={value}
        onChange={(v) => onChange('animation', v)}
      />

      <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-[12.5px] leading-relaxed text-stone-600">
        Les animations sont coupées pour les visiteurs qui ont demandé à leur
        système de réduire les mouvements — une exigence d&apos;accessibilité, et
        un réglage courant chez les personnes sujettes au mal des transports.
      </p>
    </div>
  );
}

/**
 * Une taille de carte : trois crans courants, ou la valeur de votre choix.
 *
 * Le réglage a d'abord agi sur toute la section — grossir une grille d'atouts
 * grossissait aussi son titre. Il ne touche plus que les cartes, et le titre a
 * sa propre taille, parce qu'agrandir un intitulé sans agrandir le paragraphe
 * est justement ce qu'on cherche à faire la plupart du temps.
 */
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
      <p className="text-[12.5px] font-medium text-stone-800">{label}</p>
      <p className="mb-2 mt-0.5 text-[12px] leading-snug text-stone-600">{hint}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => {
          const active = !libre && current === preset.value;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => { setLibre(false); onChange(preset.value); }}
              className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  active
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-white'
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
          className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
              libre
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-white'
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
          <span className="text-[12px] leading-snug text-stone-600">
            En <code>rem</code> ou en <code>px</code>. Les flèches ajustent d&apos;un pixel.
          </span>
        </div>
      )}
    </div>
  );
}
