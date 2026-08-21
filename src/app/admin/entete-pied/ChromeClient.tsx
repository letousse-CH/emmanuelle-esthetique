'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Save } from 'lucide-react';

import { supabase } from '../../../services/supabase';
import { settingsCache } from '../../../hooks/useSettings';
import {
  FOOTER_VARIANTS, HEADER_VARIANTS,
  type ChromeVariantSpec, type FooterVariant, type HeaderVariant,
} from '../../../constants/chromeVariants';
import {
  Button, Callout, Card, CardBody, CardHeader, Field, FormMessage, PageHeader, Spinner,
} from '../../../components/admin/ui';
import PaletteColorInput, { type PaletteSwatch } from '../../../components/admin/PaletteColorInput';

/** Palette du site, proposée pour le fond du pied de page. */
const PALETTE_TOKEN_LABELS = [
  { key: 'style_color_bg', label: 'Fond du site' },
  { key: 'style_color_surface', label: 'Surface' },
  { key: 'style_color_primary', label: 'Primaire' },
  { key: 'style_color_text', label: 'Sombre' },
  { key: 'style_color_border', label: 'Bordure' },
];
const PALETTE_TOKEN_KEYS = PALETTE_TOKEN_LABELS.map((t) => t.key);

/**
 * Choix des modèles d'en-tête et de pied de page.
 *
 * Le site n'avait qu'une barre de menu et qu'un pied possibles, écrits dans les
 * composants : en changer demandait de toucher au code. Chaque modèle est
 * représenté par une maquette au trait — pas une capture, qui vieillirait au
 * premier changement de palette, mais un schéma qui montre l'agencement.
 */
const HEADER_KEY = 'header_variant';
const FOOTER_KEY = 'footer_variant';
const FOOTER_THEME_KEY = 'footer_theme';
const FOOTER_BG_KEY = 'footer_bg_color';

export default function ChromeClient() {
  const [header, setHeader] = useState<HeaderVariant>('classique');
  const [footer, setFooter] = useState<FooterVariant>('complet');
  const [footerTheme, setFooterTheme] = useState<'dark' | 'light'>('dark');
  const [footerBg, setFooterBg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [swatches, setSwatches] = useState<PaletteSwatch[]>([]);

  const load = useCallback(async () => {
    const [{ data }, { data: tokens }] = await Promise.all([
      supabase.from('settings').select('key, value')
        .in('key', [HEADER_KEY, FOOTER_KEY, FOOTER_THEME_KEY, FOOTER_BG_KEY]),
      supabase.from('settings').select('key, value').in('key', PALETTE_TOKEN_KEYS),
    ]);
    const map = Object.fromEntries((data ?? []).map((row: any) => [row.key, (row.value ?? '').trim()]));
    setHeader((map[HEADER_KEY] as HeaderVariant) || 'classique');
    setFooter((map[FOOTER_KEY] as FooterVariant) || 'complet');
    setFooterTheme(map[FOOTER_THEME_KEY] === 'light' ? 'light' : 'dark');
    setFooterBg(map[FOOTER_BG_KEY] ?? '');

    const palette = Object.fromEntries((tokens ?? []).map((row: any) => [row.key, (row.value ?? '').trim()]));
    setSwatches(
      PALETTE_TOKEN_LABELS
        .map(({ key, label }) => ({ key, label, value: palette[key] ?? '' }))
        .filter((s) => !!s.value),
    );
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const cleanBg = (footerBg || '').trim();
      const rows = [
        { key: HEADER_KEY, value: header },
        { key: FOOTER_KEY, value: footer },
        { key: FOOTER_THEME_KEY, value: footerTheme },
        { key: FOOTER_BG_KEY, value: cleanBg },
      ];
      const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
      setSaving(false);
      if (error) {
        console.error('[ChromeClient] Error saving footer settings:', error);
        setMessage({ type: 'error', text: `Erreur d’enregistrement : ${error.message}` });
        return;
      }
      settingsCache.set(HEADER_KEY, header);
      settingsCache.set(FOOTER_KEY, footer);
      settingsCache.set(FOOTER_THEME_KEY, footerTheme);
      settingsCache.set(FOOTER_BG_KEY, cleanBg);
      setMessage({ type: 'success', text: 'Modèles d’en-tête et de pied de page enregistrés avec succès.' });
    } catch (err: any) {
      setSaving(false);
      console.error('[ChromeClient] Exception:', err);
      setMessage({ type: 'error', text: `Une erreur s’est produite : ${err?.message || 'Impossible d’enregistrer'}` });
    }
  }

  if (loading) return <Spinner label="Chargement des modèles…" />;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="En-tête & pied de page"
        description="L’habillage qui entoure toutes vos pages : la barre de menu en haut, le pied en bas."
        actions={
          <>
            <Button icon={ExternalLink} onClick={() => window.open('/', '_blank', 'noopener')}>Voir le site</Button>
            <Button variant="primary" icon={saving ? undefined : Save} loading={saving} onClick={() => void save()}>
              Enregistrer
            </Button>
          </>
        }
      />

      {message && <FormMessage message={message} />}

      <Callout tone="info">
        Le contenu — liens du menu, coordonnées, réseaux, liens légaux — se règle dans{' '}
        <strong>Navigation</strong> et <strong>Paramètres</strong>. Ici, on ne choisit que
        l’agencement.
      </Callout>

      <Card>
        <CardHeader title="Barre de menu" description="Ce que le visiteur voit en haut de chaque page." />
        <CardBody>
          <VariantGrid
            items={HEADER_VARIANTS}
            current={header}
            onPick={(id) => setHeader(id)}
            sketch={(id) => <HeaderSketch variant={id} />}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pied de page" description="La bande de fin, présente sur toutes les pages." />
        <CardBody>
          <VariantGrid
            items={FOOTER_VARIANTS}
            current={footer}
            onPick={(id) => setFooter(id)}
            sketch={(id) => <FooterSketch variant={id} tone={footerTheme} />}
          />

          {/*
            Ambiance et fond du pied. Il était noir en dur, avec du texte blanc :
            impossible d'avoir un bas de page clair, et une palette claire
            donnait une fin de page sans rapport avec le reste du site.
          */}
          <div className="mt-6 grid gap-5 border-t border-stone-200 pt-5 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-stone-800">Ambiance</p>
              <p className="text-[12.5px] leading-snug text-stone-600">
                Elle décide de la couleur du texte et des séparations.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'dark' as const, label: 'Foncé', bg: swatches.find(s => s.key === 'style_color_text')?.value || '#1C1917', fg: swatches.find(s => s.key === 'style_color_bg')?.value || '#FFFFFF' },
                  { id: 'light' as const, label: 'Clair', bg: swatches.find(s => s.key === 'style_color_bg')?.value || '#FFFFFF', fg: swatches.find(s => s.key === 'style_color_text')?.value || '#1C1917' },
                ]).map((option) => {
                  const active = footerTheme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFooterTheme(option.id)}
                      className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                          active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-300 hover:border-stone-400'
                        }`}
                    >
                      <span
                        className="grid size-8 shrink-0 place-items-center rounded-md border border-stone-300 text-[11px] font-semibold"
                        style={{ backgroundColor: option.bg, color: option.fg }}
                      >
                        Aa
                      </span>
                      <span className="text-[13px] font-medium text-stone-800">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field
              label="Couleur de fond"
              hint="« Automatique » utilise le fond ou la teinte sombre de la charte du site."
            >
              <PaletteColorInput
                value={footerBg}
                onChange={setFooterBg}
                swatches={swatches}
                ariaLabel="Fond du pied de page"
                autoValue={footerTheme === 'light' ? (swatches.find(s => s.key === 'style_color_bg')?.value || '#FFFFFF') : (swatches.find(s => s.key === 'style_color_text')?.value || '#1C1917')}
                autoHint="Suivre le fond clair ou sombre du site."
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-6 py-4">
        <p className="text-[13px] text-stone-600">
          Les modèles ne s’appliquent au site qu’une fois enregistrés.
        </p>
        <Button variant="primary" icon={saving ? undefined : Save} loading={saving} onClick={() => void save()}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

function VariantGrid<T extends string>({
  items, current, onPick, sketch,
}: {
  items: ChromeVariantSpec<T>[];
  current: T;
  onPick: (id: T) => void;
  sketch: (id: T) => React.ReactNode;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {items.map((item) => {
        const active = current === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onPick(item.id)}
              className={`h-full w-full overflow-hidden rounded-xl border text-left transition-colors cursor-pointer
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                  active ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200 hover:border-stone-400'
                }`}
            >
              <span className="block border-b border-stone-200 bg-stone-50 p-4">{sketch(item.id)}</span>
              <span className="block px-4 py-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-stone-900">{item.label}</span>
                  {active && <Check size={14} className="shrink-0 text-stone-900" />}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-stone-600">{item.description}</span>
                <span className="mt-1 block text-[12px] leading-snug text-stone-500">{item.fits}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Maquettes au trait ──────────────────────────────────────────────────
   Un schéma vieillit mieux qu'une capture : il montre l'agencement sans
   dépendre de la palette ni du contenu du client. */

const bar = 'rounded-sm bg-stone-300';
const strong = 'rounded-sm bg-stone-800';

function HeaderSketch({ variant }: { variant: HeaderVariant }) {
  if (variant === 'centre') {
    return (
      <span className="block space-y-2 rounded-md border border-stone-200 bg-white p-3">
        <span className={`mx-auto block h-3 w-16 ${strong}`} />
        <span className="flex justify-center gap-2">
          {[10, 8, 12, 8].map((w, i) => <span key={i} className={`h-1.5 ${bar}`} style={{ width: w * 3 }} />)}
        </span>
      </span>
    );
  }
  if (variant === 'minimal') {
    return (
      <span className="flex items-center justify-between rounded-md border border-stone-200 bg-white p-3">
        <span className={`h-3 w-16 ${strong}`} />
        <span className="space-y-1">
          {[0, 1, 2].map((i) => <span key={i} className={`block h-0.5 w-4 ${bar}`} />)}
        </span>
      </span>
    );
  }
  return (
    <span className={`flex items-center justify-between rounded-md border p-3 ${
      variant === 'plein' ? 'border-stone-300 bg-white shadow-sm' : 'border-dashed border-stone-300 bg-white/60'
    }`}>
      <span className={`h-3 w-14 ${strong}`} />
      <span className="flex items-center gap-2">
        {[10, 8, 12].map((w, i) => <span key={i} className={`h-1.5 ${bar}`} style={{ width: w * 3 }} />)}
        <span className={`h-4 w-12 rounded-sm bg-stone-800`} />
      </span>
    </span>
  );
}

function FooterSketch({ variant, tone }: { variant: FooterVariant; tone: 'dark' | 'light' }) {
  // La maquette prend l'ambiance choisie : un schéma noir pour un pied clair
  // montrerait le contraire de ce qui sera rendu.
  const box = tone === 'light' ? 'bg-stone-100 border border-stone-300' : 'bg-stone-800';
  const inkStrong = tone === 'light' ? 'bg-stone-500' : 'bg-white/50';
  const inkSoft = tone === 'light' ? 'bg-stone-300' : 'bg-white/20';
  const inkDot = tone === 'light' ? 'bg-stone-400' : 'bg-white/40';

  if (variant === 'simple') {
    return (
      <span className={`flex items-center justify-between rounded-md p-3 ${box}`}>
        <span className={`h-1.5 w-16 rounded-sm ${inkDot}`} />
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className={`size-1.5 rounded-full ${inkDot}`} />)}
        </span>
      </span>
    );
  }
  if (variant === 'colonnes') {
    return (
      <span className={`block space-y-2 rounded-md p-3 ${box}`}>
        <span className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((c) => (
            <span key={c} className="space-y-1">
              <span className={`block h-1 w-8 rounded-sm ${inkStrong}`} />
              {[0, 1, 2].map((i) => <span key={i} className={`block h-1 w-full rounded-sm ${inkSoft}`} />)}
            </span>
          ))}
        </span>
        <span className={`block h-1 w-full rounded-sm ${inkSoft}`} />
      </span>
    );
  }
  return (
    <span className={`block space-y-2 rounded-md p-3 ${box}`}>
      <span className="grid grid-cols-3 items-end gap-2">
        <span className={`block h-8 rounded-sm ${inkSoft}`} />
        <span className="space-y-1">
          <span className={`block h-1.5 w-full rounded-sm ${inkStrong}`} />
          <span className={`block h-1 w-3/4 rounded-sm ${inkSoft}`} />
        </span>
        <span className="flex justify-end gap-1.5">
          {[0, 1, 2].map((i) => <span key={i} className={`size-2 rounded-full ${inkDot}`} />)}
        </span>
      </span>
      <span className="grid grid-cols-3 gap-2 pt-1">
        {[0, 1, 2].map((c) => (
          <span key={c} className="space-y-1">
            {[0, 1].map((i) => <span key={i} className={`block h-1 w-full rounded-sm ${inkSoft}`} />)}
          </span>
        ))}
      </span>
    </span>
  );
}
