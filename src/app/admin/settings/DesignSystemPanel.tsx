'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Check, Droplet, Image as ImageIcon, Palette, RotateCcw, Ruler,
  Save, Sparkles, SquareStack, Type, Wand2,
} from 'lucide-react';

import { supabase } from '../../../services/supabase';
import {
  DESIGN_TOKEN_DEFAULTS,
  DESIGN_TOKEN_GROUPS,
  DESIGN_TOKEN_KEYS,
  type TokenField,
} from '../../../constants/designTokens';
import { FONT_CATALOG, FONT_CATALOG_STYLESHEET, FONT_MOODS, FONT_PAIRINGS } from '../../../constants/googleFonts';
import { Button, Callout, Card, CardBody, CardHeader, Field, FormMessage, Input, Select, Tabs } from '../../../components/admin/ui';
import StylePreview from './StylePreview';
import PaletteColorInput, { type PaletteSwatch } from '../../../components/admin/PaletteColorInput';
import SizeInput from '../../../components/admin/SizeInput';

/**
 * Jetons qui portent une mesure, et méritent donc des flèches.
 *
 * Toutes ces valeurs se saisissaient en `rem` au clavier : pour passer un titre
 * de 2,5 à 2,6 rem il fallait sélectionner, retaper, et recommencer pour juger
 * dans l'aperçu. La durée de transition est écartée — elle s'exprime en
 * millisecondes et n'a pas la même granularité.
 */
const MEASURED = /(_size|_padding|_radius|_max|_gutter|_gap|_leading|_tracking|_border_width)$/;
import { proxyUrl } from '../../../utils/media';
import {
  BUTTON_STYLES, extractColorsFromImage, generateButtonStyles, generatePalette,
  HARMONIES, type ButtonStyleId, type Harmony,
} from '../../../utils/colorHarmony';

/**
 * Contrôle global du style.
 *
 * Tous les champs partent **vides**, et un champ vide n'émet aucune règle CSS :
 * le site retombe alors sur le repli neutre de `index.css`. C'est ce qui permet
 * à une nouvelle installation d'être réellement vierge, au lieu d'hériter du
 * goût du client précédent.
 *
 * L'écran s'organise en deux colonnes : les réglages à gauche, l'aperçu à
 * droite. Auparavant, un accordéon de treize groupes présentait quatre-vingt-dix
 * champs sans jamais montrer ce qu'ils produisaient — il fallait enregistrer,
 * puis aller recharger une page publique pour juger.
 */

const PALETTE_KEYS = [
  { key: 'style_color_primary', label: 'Primaire', role: 'Accents, liens, bouton principal.' },
  { key: 'style_color_bg', label: 'Fond', role: 'La couleur de page.' },
  { key: 'style_color_surface', label: 'Surface', role: 'Cartes et blocs posés sur le fond.' },
  { key: 'style_color_text', label: 'Texte', role: 'La couleur de lecture.' },
  { key: 'style_color_text_muted', label: 'Texte secondaire', role: 'Descriptions, légendes.' },
  { key: 'style_color_border', label: 'Bordures', role: 'Séparations discrètes.' },
];

/**
 * Palettes proposées.
 *
 * Six aplats vides devant quelqu'un qui n'est pas graphiste, c'est une page
 * blanche. Ces harmonies s'appliquent d'un clic et restent modifiables.
 */
const PALETTE_PRESETS: { name: string; note: string; colors: Record<string, string> }[] = [
  {
    name: 'Encre',
    note: 'Noir et blanc, contraste maximal.',
    colors: {
      style_color_primary: '#1C1917', style_color_bg: '#FFFFFF', style_color_surface: '#F5F5F4',
      style_color_text: '#1C1917', style_color_text_muted: '#78716C', style_color_border: '#E7E5E4',
    },
  },
  {
    name: 'Sauge',
    note: 'Végétal et calme — soin, bien-être.',
    colors: {
      style_color_primary: '#7C9A8A', style_color_bg: '#FAF9F6', style_color_surface: '#FFFFFF',
      style_color_text: '#2F3A33', style_color_text_muted: '#6B7A70', style_color_border: '#E2E6E0',
    },
  },
  {
    name: 'Terre',
    note: 'Terracotta et sable — artisanat, chaleur.',
    colors: {
      style_color_primary: '#C0704F', style_color_bg: '#FDF8F4', style_color_surface: '#FFFFFF',
      style_color_text: '#3B2C24', style_color_text_muted: '#8A7263', style_color_border: '#EADDD3',
    },
  },
  {
    name: 'Nuit',
    note: 'Fond sombre — studios, technique.',
    colors: {
      style_color_primary: '#C9A227', style_color_bg: '#12100E', style_color_surface: '#1C1917',
      style_color_text: '#FAFAF9', style_color_text_muted: '#A8A29E', style_color_border: '#2E2A26',
    },
  },
  {
    name: 'Azur',
    note: 'Bleu franc — services, conseil.',
    colors: {
      style_color_primary: '#2563EB', style_color_bg: '#FFFFFF', style_color_surface: '#F8FAFC',
      style_color_text: '#0F172A', style_color_text_muted: '#64748B', style_color_border: '#E2E8F0',
    },
  },
  {
    name: 'Rosé',
    note: 'Poudré et doux — beauté, enfance.',
    colors: {
      style_color_primary: '#B76E79', style_color_bg: '#FFFAF9', style_color_surface: '#FFFFFF',
      style_color_text: '#3D2B2E', style_color_text_muted: '#8B6F73', style_color_border: '#F0E0E1',
    },
  },
];

/** Les six couleurs en cours d'édition, prêtes à être proposées partout. */
function workingSwatches(values: Record<string, string>): PaletteSwatch[] {
  return PALETTE_KEYS
    .map(({ key, label, role }) => ({ key, label, value: (values[key] ?? '').trim(), hint: role }))
    .filter((s) => !!s.value);
}

/** La palette en cours, sous la forme attendue par le générateur de boutons. */
function paletteInput(values: Record<string, string>) {
  const get = (key: string, fallback: string) => (values[key] ?? '').trim() || fallback;
  return {
    primary: get('style_color_primary', '#1C1917'),
    bg: get('style_color_bg', '#FFFFFF'),
    surface: get('style_color_surface', '#F5F5F4'),
    text: get('style_color_text', '#1C1917'),
    border: get('style_color_border', '#E7E5E4'),
  };
}

const SECTIONS = [
  { id: 'palette', label: 'Couleurs', icon: Palette },
  { id: 'fonts', label: 'Polices', icon: Type },
  { id: 'rhythm', label: 'Espacement', icon: Ruler },
  { id: 'type', label: 'Titres & textes', icon: SquareStack },
  { id: 'buttons', label: 'Boutons', icon: Sparkles },
];

/** Groupes de jetons rattachés à chaque section de l'écran. */
const GROUPS_BY_SECTION: Record<string, string[]> = {
  rhythm: ['rhythm'],
  type: ['h1', 'h2', 'h3', 'h4', 'body', 'small'],
  buttons: ['buttons', 'btn_primary', 'btn_secondary', 'btn_ghost'],
};

export default function DesignSystemPanel() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [section, setSection] = useState('palette');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('settings').select('key, value').in('key', DESIGN_TOKEN_KEYS);
      const map: Record<string, string> = { ...DESIGN_TOKEN_DEFAULTS };
      for (const row of data ?? []) {
        if (row.key in map) map[row.key] = row.value ?? '';
      }
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const filledCount = useMemo(
    () => DESIGN_TOKEN_KEYS.filter((k) => (values[k] ?? '').trim()).length,
    [values],
  );

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const setMany = (patch: Record<string, string>) => setValues((v) => ({ ...v, ...patch }));

  async function save() {
    setSaving(true);
    setMessage(null);
    const rows = DESIGN_TOKEN_KEYS.map((key) => ({ key, value: (values[key] ?? '').trim() }));
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: `Enregistrement impossible : ${error.message}` });
      return;
    }
    // Le cache local sert à éviter un saut de style au chargement suivant :
    // il doit disparaître, sinon l'ancien réglage réapparaîtrait brièvement.
    localStorage.removeItem('site_design_tokens');
    setMessage({ type: 'success', text: 'Style enregistré. Rechargez une page publique pour le voir.' });
  }

  function resetAll() {
    if (!confirm('Revenir aux valeurs recommandées ? Les couleurs seront vidées, les tailles et espacements reprendront leurs valeurs de départ.')) return;
    setValues({ ...DESIGN_TOKEN_DEFAULTS });
  }

  if (loading) return <p className="text-sm text-stone-600">Chargement…</p>;

  return (
    <>
      {/* Le catalogue est chargé une fois : chaque police se montre elle-même. */}
      <link rel="stylesheet" href={FONT_CATALOG_STYLESHEET} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-stone-600">
              {filledCount} réglage{filledCount > 1 ? 's' : ''} actif{filledCount > 1 ? 's' : ''}. Un champ vide n’impose rien au site.
            </p>
            <div className="flex items-center gap-2">
              <FormMessage message={message} />
              <Button size="sm" icon={RotateCcw} onClick={resetAll}>Valeurs recommandées</Button>
              <Button variant="primary" size="sm" icon={saving ? undefined : Save} loading={saving} onClick={() => void save()}>
                Enregistrer
              </Button>
            </div>
          </div>

          <Tabs label="Sections du style" active={section} onChange={setSection} items={SECTIONS} />

          {section === 'palette' && (
            <PaletteSection values={values} onSet={set} onSetMany={setMany} />
          )}

          {section === 'fonts' && (
            <FontsSection values={values} onSet={set} onSetMany={setMany} />
          )}

          {section === 'buttons' && (
            <ButtonStyleProposals values={values} onSetMany={setMany} />
          )}

          {(section === 'rhythm' || section === 'type' || section === 'buttons') && (
            <TokenGroups
              ids={GROUPS_BY_SECTION[section]}
              values={values}
              onSet={set}
              swatches={workingSwatches(values)}
              autoValues={section === 'buttons' ? generateButtonStyles(paletteInput(values), 'plein') : undefined}
            />
          )}
        </div>

        {/* Aperçu : collant, pour rester sous les yeux pendant qu'on règle. */}
        <div className="xl:sticky xl:top-20">
          <p className="mb-2 text-[13px] font-medium text-stone-800">Aperçu en direct</p>
          <StylePreview values={values} />
          <p className="mt-2 text-[12.5px] leading-relaxed text-stone-600">
            Rendu approché des réglages en cours. Le site reste inchangé tant que vous n’avez pas enregistré.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Couleurs ───────────────────────────────────────────────────────────────

type PaletteSource = 'couleur' | 'image' | 'harmonie';

const SOURCES: { id: PaletteSource; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'couleur', label: 'Depuis une couleur', hint: 'Vous en avez une en tête — on décline les cinq autres.', icon: Droplet },
  { id: 'image', label: 'Depuis une image', hint: 'Votre logo ou une photo : on y prend les teintes.', icon: ImageIcon },
  { id: 'harmonie', label: 'Une palette toute faite', hint: 'Six harmonies prêtes à l’emploi.', icon: Palette },
];

function PaletteSection({
  values, onSet, onSetMany,
}: {
  values: Record<string, string>;
  onSet: (key: string, value: string) => void;
  onSetMany: (patch: Record<string, string>) => void;
}) {
  const [source, setSource] = useState<PaletteSource>('couleur');
  const [base, setBase] = useState(values.style_color_primary || '#7C9A8A');
  const [harmony, setHarmony] = useState<Harmony>('camaieu');
  const [dark, setDark] = useState(false);

  // Extraction depuis une image
  const [imageUrl, setImageUrl] = useState('');
  const [extracted, setExtracted] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [siteLogo, setSiteLogo] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'global_logo').maybeSingle();
      setSiteLogo(((data?.value as string) ?? '').trim());
    })();
  }, []);

  const generated = useMemo(() => generatePalette(base, harmony, dark), [base, harmony, dark]);

  /*
    Le primaire est parfois assombri pour rester lisible en couleur de lien.
    Le dire évite de croire à un bug quand un jaune vif ressort en moutarde.
  */
  const primaryAdjusted =
    generated && base && generated.style_color_primary.toLowerCase() !== base.toLowerCase();

  async function extract(src: string) {
    if (!src.trim()) return;
    setExtracting(true);
    setExtractError('');
    setExtracted([]);
    try {
      const colors = await extractColorsFromImage(proxyUrl(src.trim()));
      setExtracted(colors);
      setBase(colors[0]);
    } catch (error) {
      setExtractError((error as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  const activePreset = PALETTE_PRESETS.find((preset) =>
    Object.entries(preset.colors).every(([k, v]) => (values[k] ?? '').toLowerCase() === v.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Composer l’ambiance"
          description="Trois points de départ. Dans tous les cas, les six couleurs restent modifiables une par une ensuite."
        />
        <CardBody className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {SOURCES.map((item) => {
              const active = source === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSource(item.id)}
                  className={`rounded-lg border p-3 text-left transition-colors cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                      active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                >
                  <span className="flex items-center gap-2 text-[13.5px] font-medium">
                    <item.icon size={15} /> {item.label}
                  </span>
                  <span className={`mt-1 block text-[12px] leading-snug ${active ? 'text-stone-300' : 'text-stone-600'}`}>
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {source === 'harmonie' && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PALETTE_PRESETS.map((preset) => {
                const active = activePreset?.name === preset.name;
                return (
                  <li key={preset.name}>
                    <button
                      type="button"
                      onClick={() => onSetMany(preset.colors)}
                      aria-pressed={active}
                      className={`w-full overflow-hidden rounded-xl border text-left transition-colors cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                          active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400'
                        }`}
                    >
                      <span className="flex h-14">
                        {['style_color_primary', 'style_color_bg', 'style_color_surface', 'style_color_text', 'style_color_border'].map((k) => (
                          <span key={k} className="flex-1" style={{ backgroundColor: preset.colors[k] }} />
                        ))}
                      </span>
                      <span className="block px-3 py-2.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-medium text-stone-900">{preset.name}</span>
                          {active && <Check size={14} className="text-stone-900" />}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-snug text-stone-600">{preset.note}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {source === 'image' && (
            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Adresse de l’image" htmlFor="palette-image" className="min-w-[14rem] flex-1"
                  hint="Un logo, une photo d’ambiance, une image de votre médiathèque.">
                  <Input id="palette-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
                </Field>
                <div className="mb-[1.375rem] flex gap-2">
                  <Button icon={Wand2} loading={extracting} onClick={() => void extract(imageUrl)} disabled={!imageUrl.trim()}>
                    Analyser
                  </Button>
                  {siteLogo && (
                    <Button variant="ghost" onClick={() => { setImageUrl(siteLogo); void extract(siteLogo); }}>
                      Utiliser le logo du site
                    </Button>
                  )}
                </div>
              </div>

              {extractError && <Callout tone="warning">{extractError}</Callout>}

              {extracted.length > 0 && (
                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-stone-800">
                    Teintes trouvées — choisissez celle qui portera l’identité.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {extracted.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setBase(hex)}
                        aria-pressed={base.toLowerCase() === hex.toLowerCase()}
                        title={hex}
                        className={`size-11 rounded-lg border transition-transform cursor-pointer
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                            base.toLowerCase() === hex.toLowerCase()
                              ? 'border-stone-900 ring-2 ring-stone-900 ring-offset-1'
                              : 'border-stone-300 hover:scale-105'
                          }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {source !== 'harmonie' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Couleur de départ" className="w-auto">
                  <div className="flex items-center gap-2">
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-stone-300" style={{ backgroundColor: base }}>
                      <input
                        type="color"
                        aria-label="Couleur de départ"
                        value={base}
                        onChange={(e) => setBase(e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                    <Input value={base} onChange={(e) => setBase(e.target.value)} className="w-28 font-mono text-[12.5px]" aria-label="Code de la couleur de départ" />
                  </div>
                </Field>

                <Field label="Ambiance générale" className="w-auto">
                  <div className="flex gap-1.5">
                    {[{ v: false, label: 'Fond clair' }, { v: true, label: 'Fond sombre' }].map((option) => (
                      <button
                        key={String(option.v)}
                        type="button"
                        aria-pressed={dark === option.v}
                        onClick={() => setDark(option.v)}
                        className={`h-10 rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-pointer ${
                          dark === option.v ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-700 hover:border-stone-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-stone-800">Comment décliner</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {HARMONIES.map((option) => {
                    const active = harmony === option.id;
                    const sample = generatePalette(base, option.id, dark);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setHarmony(option.id)}
                        className={`overflow-hidden rounded-lg border text-left transition-colors cursor-pointer
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                            active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-300 hover:border-stone-400'
                          }`}
                      >
                        <span className="flex h-8">
                          {sample && Object.values(sample).map((hex, i) => (
                            <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
                          ))}
                        </span>
                        <span className="block px-2.5 py-2">
                          <span className="text-[13px] font-medium text-stone-900">{option.label}</span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-stone-600">{option.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {generated && (
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="flex h-16 overflow-hidden rounded-md">
                    {Object.entries(generated).map(([key, hex]) => (
                      <span key={key} className="flex-1" style={{ backgroundColor: hex }} title={hex} />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12.5px] leading-snug text-stone-600">
                      Texte et texte secondaire sont ajustés pour rester lisibles sur ce fond
                      {primaryAdjusted && <> ; la couleur d’accent a été {dark ? 'éclaircie' : 'assombrie'} pour la même raison</>}.
                    </p>
                    <Button variant="primary" size="sm" icon={Check} onClick={() => onSetMany(generated)}>
                      Appliquer cette palette
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Ajuster couleur par couleur"
          description="Six couleurs suffisent à tenir une identité. Laissées vides, le site reste en gris neutre."
        />
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PALETTE_KEYS.map(({ key, label, role }) => {
              const value = (values[key] ?? '').trim();
              return (
                <li key={key} className="overflow-hidden rounded-xl border border-stone-200">
                  <label className="block cursor-pointer">
                    <span
                      className="relative flex h-20 items-end justify-between p-3"
                      style={{ backgroundColor: value || 'transparent', backgroundImage: value ? undefined : 'repeating-conic-gradient(#f5f5f4 0% 25%, #ffffff 0% 50%) 50% / 14px 14px' }}
                    >
                      <input
                        type="color"
                        aria-label={`${label} — choisir la couleur`}
                        value={value || '#000000'}
                        onChange={(e) => onSet(key, e.target.value)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                    <span className="block border-t border-stone-200 px-3 py-2.5">
                      <span className="text-[13.5px] font-medium text-stone-900">{label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-stone-600">{role}</span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2 border-t border-stone-200 px-3 py-2">
                    <Input
                      value={value}
                      placeholder="non définie"
                      onChange={(e) => onSet(key, e.target.value)}
                      className="h-8 flex-1 font-mono text-[12px]"
                      aria-label={`${label} — code couleur`}
                    />
                    {value && (
                      <button
                        type="button"
                        onClick={() => onSet(key, '')}
                        className="rounded p-1 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
                        aria-label={`Effacer ${label}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

// ── Polices ────────────────────────────────────────────────────────────────

/**
 * Choix des polices, en trois temps.
 *
 * Le sélecteur unique posait la mauvaise question : « quelle police ? », alors
 * que personne ne choisit « Merriweather » — on choisit un ton. On demande donc
 * d'abord l'intention, on propose trois accords qui la servent, et on ne
 * descend au réglage fin que si l'on y tient.
 */
function FontsSection({
  values, onSet, onSetMany,
}: {
  values: Record<string, string>;
  onSet: (key: string, value: string) => void;
  onSetMany: (patch: Record<string, string>) => void;
}) {
  const headings = (values.style_font_headings ?? '').trim();
  const body = (values.style_font_body ?? '').trim();

  const currentPairing = FONT_PAIRINGS.find((p) => p.headings === headings && p.body === body);
  const [mood, setMood] = useState<string | null>(currentPairing?.mood ?? null);
  const [step, setStep] = useState<1 | 2 | 3>(currentPairing ? 2 : 1);

  const proposals = FONT_PAIRINGS.filter((p) => p.mood === mood);

  const stepper = (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
      {[
        { n: 1 as const, label: 'Le ton' },
        { n: 2 as const, label: 'L’accord' },
        { n: 3 as const, label: 'Réglage fin' },
      ].map((item, index) => (
        <li key={item.n} className="flex items-center gap-2">
          {index > 0 && <span className="text-stone-300">›</span>}
          <button
            type="button"
            onClick={() => { if (item.n === 1 || mood) setStep(item.n); }}
            disabled={item.n > 1 && !mood}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer ${
              step === item.n ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span className={`grid size-4 place-items-center rounded-full text-[10px] font-semibold ${
              step === item.n ? 'bg-white text-stone-900' : 'bg-stone-200 text-stone-700'
            }`}>
              {item.n}
            </span>
            {item.label}
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Choisir les polices"
          description="Deux familles suffisent : une pour les titres, une pour le texte. L’essentiel est qu’elles s’entendent."
          actions={stepper}
        />

        {/* Étape 1 — l'intention */}
        {step === 1 && (
          <CardBody className="space-y-3">
            <p className="text-[13px] text-stone-700">Quel ton voulez-vous donner au site ?</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FONT_MOODS.map((item) => {
                const example = FONT_PAIRINGS.find((p) => p.mood === item.id);
                const active = mood === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => { setMood(item.id); setStep(2); }}
                      className={`h-full w-full rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                          active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                    >
                      <span className="block text-2xl text-stone-900" style={{ fontFamily: `'${example?.headings}', serif` }}>
                        {item.label}
                      </span>
                      <span className="mt-1.5 block text-[12.5px] leading-snug text-stone-600">{item.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        )}

        {/* Étape 2 — l'accord */}
        {step === 2 && (
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-stone-700">
                Trois accords pour le ton «&nbsp;{FONT_MOODS.find((m) => m.id === mood)?.label}&nbsp;».
              </p>
              <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setStep(1)}>Changer de ton</Button>
            </div>
            <ul className="grid gap-3 lg:grid-cols-3">
              {proposals.map((pair) => {
                const active = headings === pair.headings && body === pair.body;
                return (
                  <li key={pair.label}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSetMany({ style_font_headings: pair.headings, style_font_body: pair.body })}
                      className={`h-full w-full rounded-xl border px-4 py-4 text-left transition-colors cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                          active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                    >
                      <span className="block text-[26px] leading-tight text-stone-900" style={{ fontFamily: `'${pair.headings}', serif` }}>
                        Prendre rendez-vous
                      </span>
                      <span className="mt-2 block text-[14px] leading-relaxed text-stone-700" style={{ fontFamily: `'${pair.body}', sans-serif` }}>
                        Le texte que vos visiteurs lisent vraiment, dans la police du corps.
                      </span>
                      <span className="mt-3 flex items-center justify-between gap-2 border-t border-stone-200 pt-2">
                        <span className="text-[12px] text-stone-600">{pair.headings} + {pair.body}</span>
                        {active && <Check size={14} className="shrink-0 text-stone-900" />}
                      </span>
                      <span className="mt-1 block text-[12px] leading-snug text-stone-600">{pair.note}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={() => setStep(3)}>Régler dans le détail</Button>
            </div>
          </CardBody>
        )}

        {/* Étape 3 — le réglage fin */}
        {step === 3 && (
          <CardBody className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-stone-700">
                Chaque proposition s’affiche dans sa propre typographie.
              </p>
              <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setStep(2)}>Revenir aux accords</Button>
            </div>

            <FontPicker
              legend="Police des titres"
              hint="Elle donne le ton."
              sample="Prendre rendez-vous"
              sampleClass="text-2xl"
              current={headings}
              onPick={(name) => onSet('style_font_headings', name)}
            />

            <FontPicker
              legend="Police du texte courant"
              hint="Celle que vos visiteurs lisent vraiment : privilégiez la lisibilité."
              sample="Le texte que vos visiteurs lisent."
              sampleClass="text-[15px] leading-relaxed"
              current={body}
              onPick={(name) => onSet('style_font_body', name)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Autre police pour les titres" htmlFor="font-headings-custom" hint="Le nom exact, tel qu’il figure sur fonts.google.com.">
                <Input id="font-headings-custom" value={headings} onChange={(e) => onSet('style_font_headings', e.target.value)} placeholder="Inter" />
              </Field>
              <Field label="Autre police pour le texte" htmlFor="font-body-custom">
                <Input id="font-body-custom" value={body} onChange={(e) => onSet('style_font_body', e.target.value)} placeholder="Inter" />
              </Field>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}

function FontPicker({
  legend, hint, sample, sampleClass, current, onPick,
}: {
  legend: string;
  hint: string;
  sample: string;
  sampleClass: string;
  current: string;
  onPick: (name: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-stone-800">{legend}</legend>
      <p className="mb-2 mt-0.5 text-[12.5px] text-stone-600">{hint}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FONT_CATALOG.map((font) => {
          const active = current === font.name;
          return (
            <li key={font.name}>
              <button
                type="button"
                onClick={() => onPick(font.name)}
                aria-pressed={active}
                className={`h-full w-full rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                    active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                  }`}
              >
                <span className={`block text-stone-900 ${sampleClass}`} style={{ fontFamily: font.stack }}>
                  {sample}
                </span>
                <span className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-stone-800">{font.name}</span>
                  {active && <Check size={13} className="shrink-0 text-stone-900" />}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-stone-600">{font.note}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

// ── Propositions de boutons ────────────────────────────────────────────────

/**
 * Trois styles de bouton prêts à poser, dérivés de la palette.
 *
 * Renseigner dix-huit couleurs à la main — fond, texte, bordure, et les mêmes
 * au survol, pour trois variantes — est le genre de formulaire qu'on abandonne
 * à mi-chemin. Chaque proposition s'affiche avec de vrais boutons, survol
 * compris : on juge avant d'appliquer, et on retouche ensuite si on veut.
 */
function ButtonStyleProposals({
  values, onSetMany,
}: {
  values: Record<string, string>;
  onSetMany: (patch: Record<string, string>) => void;
}) {
  const palette = paletteInput(values);

  /** Le style dont les couleurs correspondent exactement à ce qui est réglé. */
  const active = BUTTON_STYLES.find((style) => {
    const generated = generateButtonStyles(palette, style.id);
    return Object.entries(generated).every(
      ([key, hex]) => (values[key] ?? '').toLowerCase() === hex.toLowerCase(),
    );
  });

  return (
    <Card>
      <CardHeader
        title="Proposer un style de boutons"
        description="Trois traitements cohérents, calculés depuis votre palette. Le libellé de chaque bouton est vérifié pour rester lisible, au repos comme au survol."
      />
      <CardBody>
        <ul className="grid gap-3 lg:grid-cols-3">
          {BUTTON_STYLES.map((style) => {
            const tokens = generateButtonStyles(palette, style.id);
            const isActive = active?.id === style.id;
            return (
              <li key={style.id}>
                <div
                  className={`flex h-full flex-col rounded-xl border transition-colors ${
                    isActive ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200'
                  }`}
                >
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-t-xl border-b border-stone-200 p-4"
                    style={{ backgroundColor: palette.bg }}
                  >
                    {(['primary', 'secondary', 'ghost'] as const).map((role) => (
                      <PreviewButton
                        key={role}
                        tokens={tokens}
                        role={role}
                        values={values}
                        label={role === 'primary' ? 'Action' : role === 'secondary' ? 'En savoir plus' : 'Écrire'}
                      />
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div>
                      <p className="text-[13.5px] font-medium text-stone-900">{style.label}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-stone-600">{style.description}</p>
                    </div>
                    <div className="mt-auto pt-1">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-stone-900">
                          <Check size={13} /> Style appliqué
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => onSetMany(tokens)}>Appliquer</Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[12.5px] leading-relaxed text-stone-600">
          Une fois appliqué, chaque couleur reste modifiable dans les blocs ci-dessous — et le
          survol se teste directement dans l’aperçu, à droite.
        </p>
      </CardBody>
    </Card>
  );
}

/** Bouton d'exemple, survol compris, aux jetons proposés. */
function PreviewButton({
  tokens, role, values, label,
}: {
  tokens: Record<string, string>;
  role: 'primary' | 'secondary' | 'ghost';
  values: Record<string, string>;
  label: string;
}) {
  const [hover, setHover] = useState(false);
  const pick = (suffix: string) => tokens[`style_btn_${role}_${suffix}`] ?? 'transparent';
  const shape = (key: string, fallback: string) => (values[key] ?? '').trim() || fallback;

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: hover ? pick('hover_bg') : pick('bg'),
        color: hover ? pick('hover_text') : pick('text'),
        border: `${shape('style_btn_border_width', '1px')} solid ${hover ? pick('hover_border') : pick('border')}`,
        borderRadius: shape('style_btn_radius', shape('style_border_radius_base', '0px')),
        paddingBlock: '0.4rem',
        paddingInline: '0.75rem',
        fontSize: '12px',
        fontWeight: Number(shape('style_btn_font_weight', '500')),
        transition: `background-color ${shape('style_btn_transition', '150ms')} ease, color ${shape('style_btn_transition', '150ms')} ease, border-color ${shape('style_btn_transition', '150ms')} ease`,
      }}
    >
      {label}
    </span>
  );
}

// ── Groupes de jetons (espacement, échelle typographique, boutons) ─────────

function TokenGroups({
  ids, values, onSet, swatches, autoValues,
}: {
  ids: string[];
  values: Record<string, string>;
  onSet: (key: string, value: string) => void;
  swatches: PaletteSwatch[];
  /** Couleur réellement appliquée quand le champ est vide, par clé. */
  autoValues?: Record<string, string>;
}) {
  const groups = DESIGN_TOKEN_GROUPS.filter((g) => ids.includes(g.id));

  return (
    <div className="space-y-5">
      {ids.includes('buttons') && (
        <Callout tone="info">
          La forme est commune aux trois variantes ; seules les couleurs changent. Le rôle de
          chaque bouton — principal, secondaire, discret — se choisit section par section dans
          le constructeur de pages.
        </Callout>
      )}
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader title={group.label} description={group.description} />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => (
                <TokenField
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  swatches={swatches}
                  autoValue={autoValues?.[field.key]}
                  onChange={(next) => onSet(field.key, next)}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function TokenField({
  field, value, onChange, swatches, autoValue,
}: {
  field: TokenField;
  value: string;
  onChange: (value: string) => void;
  swatches: PaletteSwatch[];
  autoValue?: string;
}) {
  const id = `token-${field.key}`;

  /*
    Couleur de bouton, de titre, de bordure au survol… : toutes puisent dans la
    palette du site. Le sélecteur natif seul obligeait à retrouver le code de sa
    couleur primaire de mémoire, à chaque champ.
  */
  if (field.type === 'color') {
    return (
      <Field label={field.label} hint={field.help}>
        <PaletteColorInput
          value={value}
          onChange={onChange}
          swatches={swatches}
          ariaLabel={field.label}
          autoLabel="Automatique"
          autoValue={autoValue}
          autoHint={autoValue ? 'La valeur proposée depuis votre palette.' : "Le thème d'origine s'applique."}
        />
      </Field>
    );
  }

  if (field.type === 'select') {
    return (
      <Field label={field.label} htmlFor={id} hint={field.help}>
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option || '— par défaut —'}</option>
          ))}
        </Select>
      </Field>
    );
  }

  if (MEASURED.test(field.key)) {
    return (
      <Field label={field.label} htmlFor={id} hint={field.help}>
        <SizeInput
          id={id}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          ariaLabel={field.label}
          fallback={field.key.endsWith('_leading') || field.key.endsWith('_tracking') ? '1' : '1rem'}
        />
      </Field>
    );
  }

  return (
    <Field label={field.label} htmlFor={id} hint={field.help}>
      <Input id={id} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
