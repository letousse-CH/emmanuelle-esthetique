"use client";

import React, { useEffect, useState } from 'react';

import { supabase } from '../services/supabase';
import {
  BUTTON_VARIANTS,
  DESIGN_TOKEN_DEFAULTS,
  DESIGN_TOKEN_KEYS,
} from '../constants/designTokens';

/**
 * Feuille de style pilotée par les réglages.
 *
 * Deux principes gouvernent ce composant :
 *
 * 1. **Rien n'est imposé.** Une règle CSS n'est émise que pour un jeton
 *    réellement renseigné dans l'admin. Un template qui livrerait une palette
 *    en dur imposerait le goût d'un client à tous les suivants ; ici, tant que
 *    l'admin est vide, le site retombe sur le repli neutre de `index.css`.
 *
 * 2. **Des variables, pas des `!important` partout.** On alimente des
 *    propriétés personnalisées que la feuille de base consomme. Seuls les
 *    éléments de texte reçoivent des règles directes, car ils doivent
 *    l'emporter sur les classes utilitaires héritées des anciens contenus.
 *
 * 3. **Tout est confiné.** Chaque règle est préfixée par `SCOPE` : le style du
 *    site ne doit jamais déborder sur le back-office, sinon la palette d'un
 *    client rendrait l'admin illisible. Le site public porte l'attribut ; le
 *    back-office ne le porte pas, et garde donc son apparence propre.
 */


/**
 * Transforme une taille simple en taille fluide.
 *
 * L'utilisateur saisit « 3.5rem » ; on en dérive un `clamp()` qui descend
 * jusqu'à `ratio × 3.5rem` sur petit écran et remonte à la valeur saisie à
 * partir de 80rem de large. Un titre trop grand qui déborde sur mobile est le
 * défaut le plus courant d'un site, et il ne devrait pas être au client de
 * connaître `clamp()` pour l'éviter.
 *
 * Toute valeur qui n'est pas un rem simple (px, %, ou un clamp écrit à la
 * main) est renvoyée telle quelle : on ne réécrit jamais une intention
 * explicite.
 */
function fluid(value: string, ratio: number): string {
  const match = value.match(/^(\d*\.?\d+)rem$/);
  if (!match) return value;

  const max = parseFloat(match[1]);
  const min = Math.round(max * ratio * 1000) / 1000;
  if (min >= max) return value;

  // Interpolation linéaire entre 20rem et 80rem de largeur de fenêtre.
  const slope = ((max - min) / 60) * 100;
  const intercept = Math.round((min - (slope * 20) / 100) * 1000) / 1000;
  return `clamp(${min}rem, ${intercept}rem + ${slope.toFixed(2)}vw, ${max}rem)`;
}

/** Amplitude de réduction par niveau : un H1 rétrécit plus qu'un H4. */
const FLUID_RATIO: Record<string, number> = {
  h1: 0.58,
  h2: 0.68,
  h3: 0.82,
  h4: 0.92,
};

/** Sélecteur porté par le site public — et par l'aperçu du constructeur. */
const SCOPE = '[data-site-theme]';

/** Niveaux typographiques pilotables, et le sélecteur CSS correspondant. */
const TYPE_LEVELS: { prefix: string; selector: string }[] = [
  { prefix: 'h1', selector: 'h1' },
  { prefix: 'h2', selector: 'h2' },
  { prefix: 'h3', selector: 'h3' },
  { prefix: 'h4', selector: 'h4, h5, h6' },
  { prefix: 'body', selector: 'body, p, li' },
  { prefix: 'small', selector: 'small, figcaption, .text-caption' },
];

export default function GlobalStyles() {
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    // Application immédiate depuis le cache, pour éviter un saut de style au
    // premier rendu ; la base fait ensuite autorité.
    const cached = localStorage.getItem('site_design_tokens');
    if (cached) {
      try {
        setTokens(JSON.parse(cached));
      } catch {
        localStorage.removeItem('site_design_tokens');
      }
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', DESIGN_TOKEN_KEYS);
        if (error) throw error;

        const map: Record<string, string> = { ...DESIGN_TOKEN_DEFAULTS };
        for (const row of data ?? []) {
          const value = (row.value ?? '').trim();
          // Une valeur enregistrée l'emporte, y compris une chaîne vide :
          // vider un champ dans l'admin doit réellement retirer la règle.
          if (row.key in map) map[row.key] = value;
        }
        setTokens(map);
        localStorage.setItem('site_design_tokens', JSON.stringify(map));
      } catch (err) {
        console.error('[GlobalStyles] chargement des jetons :', err);
        if (!cached) setTokens({ ...DESIGN_TOKEN_DEFAULTS });
      }
    })();
  }, []);

  if (!tokens) return null;

  const get = (key: string) => tokens[key]?.trim() || '';

  /** N'émet la déclaration que si la valeur existe. */
  const decl = (property: string, value: string, important = false) =>
    value ? `  ${property}: ${value}${important ? ' !important' : ''};\n` : '';

  // ── Variables globales ────────────────────────────────────────────────────
  let root = `${SCOPE} {\n`;
  if (get('style_color_primary')) {
    root += decl('--brand-primary', get('style_color_primary'));
    root += `  --color-sage: var(--brand-primary);\n`;
    root += `  --color-wood: var(--brand-primary);\n`;
    root += `  --color-copper: var(--brand-primary);\n`;
  }
  if (get('style_color_bg')) {
    root += decl('--brand-bg', get('style_color_bg'));
    root += `  --color-paper: var(--brand-bg);\n`;
  }
  if (get('style_color_surface')) {
    root += decl('--brand-surface', get('style_color_surface'));
    root += `  --color-stone-muted: var(--brand-surface);\n`;
  }
  if (get('style_color_text')) {
    root += decl('--brand-text', get('style_color_text'));
    root += `  --color-stone-deep: var(--brand-text);\n`;
  }
  root += decl('--brand-text-muted', get('style_color_text_muted'));
  if (get('style_color_border')) {
    root += decl('--brand-border', get('style_color_border'));
    root += `  --color-border: var(--brand-border);\n`;
  }

  root += decl('--section-py', get('style_section_padding_y'));
  root += decl('--section-py-mobile', get('style_section_padding_y_mobile'));
  root += decl('--container-max', get('style_container_max'));
  root += decl('--gutter', get('style_gutter'));
  root += decl('--block-gap', get('style_block_gap'));
  root += decl('--radius-base', get('style_border_radius_base'));

  const headingFont = get('style_font_headings');
  const bodyFont = get('style_font_body');
  root += headingFont ? `  --font-serif: "${headingFont}", ui-sans-serif, system-ui, sans-serif;\n` : '';
  root += bodyFont ? `  --font-sans: "${bodyFont}", ui-sans-serif, system-ui, sans-serif;\n` : '';
  root += '}\n';

  // ── Échelle typographique ─────────────────────────────────────────────────
  let typography = '';
  for (const { prefix, selector } of TYPE_LEVELS) {
    let block = '';
    // Les titres deviennent fluides ; le texte courant reste fixe, une
    // taille de lecture qui bouge avec la fenêtre étant désagréable.
    const rawSize = get(`style_${prefix}_size`);
    const size = FLUID_RATIO[prefix] ? fluid(rawSize, FLUID_RATIO[prefix]) : rawSize;
    block += decl('font-size', size, false);
    block += decl('font-weight', get(`style_${prefix}_weight`), false);
    block += decl('line-height', get(`style_${prefix}_leading`), true);
    block += decl('letter-spacing', get(`style_${prefix}_tracking`), true);
    block += decl('color', get(`style_${prefix}_color`), true);
    // `body` devient le conteneur lui-même une fois confiné.
    const scoped = selector
      .split(', ')
      .map((s) => (s === 'body' ? SCOPE : `${SCOPE} ${s}`))
      .join(', ');
    if (block) typography += `${scoped} {\n${block}}\n`;
  }

  // ── Rythme vertical et gabarit ────────────────────────────────────────────
  let layout = '';
  if (get('style_section_padding_y_mobile')) {
    layout += `${SCOPE} [data-section]:not([data-density]) {\n  padding-block: var(--section-py-mobile) !important;\n}\n`;
  }
  if (get('style_section_padding_y')) {
    layout += `@media (min-width: 768px) {\n  ${SCOPE} [data-section]:not([data-density]) {\n    padding-block: var(--section-py) !important;\n  }\n}\n`;
  }
  if (get('style_container_max')) {
    layout += `${SCOPE} [data-container]:not([data-width]) {\n  max-width: var(--container-max) !important;\n}\n`;
  }
  if (get('style_gutter')) {
    layout += `${SCOPE} [data-container]:not([data-gutter]) {\n  padding-inline: var(--gutter) !important;\n}\n`;
  }
  if (get('style_block_gap')) {
    layout += `${SCOPE} [data-block-stack] > * + * {\n  margin-top: var(--block-gap) !important;\n}\n`;
  }

  // ── Couleurs appliquées (Mode clair & Thème global) ──────────────────────
  let applied = '';
  if (get('style_color_primary')) {
    applied += `${SCOPE} .text-primary, ${SCOPE} a.text-primary, ${SCOPE} .text-sage, ${SCOPE} .text-wood, ${SCOPE} .text-copper, ${SCOPE} .hover\\:text-sage:hover, ${SCOPE} .hover\\:text-wood:hover { color: var(--brand-primary) !important; }\n`;
    applied += `${SCOPE} .bg-primary, ${SCOPE} .bg-sage, ${SCOPE} .bg-wood, ${SCOPE} .bg-copper, ${SCOPE} .hover\\:bg-sage:hover, ${SCOPE} .hover\\:bg-wood:hover { background-color: var(--brand-primary) !important; }\n`;
    applied += `${SCOPE} .border-primary, ${SCOPE} .border-sage, ${SCOPE} .border-wood, ${SCOPE} .border-copper, ${SCOPE} .focus\\:border-sage:focus { border-color: var(--brand-primary) !important; }\n`;
    applied += `${SCOPE} :focus-visible { outline-color: var(--brand-primary) !important; }\n`;
    applied += `${SCOPE} ::selection { background-color: color-mix(in srgb, var(--brand-primary) 25%, transparent); }\n`;
  }
  if (get('style_color_bg')) {
    applied += `${SCOPE}, ${SCOPE} body, ${SCOPE} .bg-paper { background-color: var(--brand-bg) !important; }\n`;
  }
  if (get('style_color_text')) {
    applied += `${SCOPE}, ${SCOPE} .text-stone-deep, ${SCOPE} .text-stone-900, ${SCOPE} .text-stone-800, ${SCOPE} .text-stone-700 { color: var(--brand-text) !important; }\n`;
  }
  if (get('style_color_surface')) {
    applied += `${SCOPE} [data-surface], ${SCOPE} .bg-surface, ${SCOPE} .bg-white, ${SCOPE} .bg-stone-50, ${SCOPE} .bg-stone-100 { background-color: var(--brand-surface) !important; }\n`;
  }
  if (get('style_color_text_muted')) {
    applied += `${SCOPE} [data-muted], ${SCOPE} .text-muted, ${SCOPE} .text-stone-600, ${SCOPE} .text-stone-500, ${SCOPE} .text-stone-400, ${SCOPE} .text-stone-300 { color: var(--brand-text-muted) !important; }\n`;
  }
  if (get('style_color_border')) {
    applied += `${SCOPE} [data-bordered], ${SCOPE} .border-muted, ${SCOPE} .border-stone-200, ${SCOPE} .border-stone-300, ${SCOPE} .border-stone-100 { border-color: var(--brand-border) !important; }\n`;
  }
  if (get('style_border_radius_base')) {
    applied += `${SCOPE} [data-radius-base] { border-radius: var(--radius-base); }\n`;
  }
  if (headingFont) applied += `${SCOPE} h1, ${SCOPE} h2, ${SCOPE} h3, ${SCOPE} h4, ${SCOPE} h5, ${SCOPE} h6 { font-family: var(--font-serif) !important; }\n`;
  if (bodyFont) applied += `${SCOPE}, ${SCOPE} p, ${SCOPE} li, ${SCOPE} button, ${SCOPE} input, ${SCOPE} textarea, ${SCOPE} select { font-family: var(--font-sans) !important; }\n`;

  // ── Boutons ───────────────────────────────────────────────────────────────
  // La forme est commune, seules les couleurs distinguent les variantes. Les
  // sélecteurs visent une classe explicite (`.btn-primary`) et un attribut
  // (`data-btn`), ce qui évite d'attraper au hasard tout ce qui a un fond.
  const btnShape = [
    decl('padding-block', get('style_btn_padding_y'), true),
    decl('padding-inline', get('style_btn_padding_x'), true),
    decl('border-radius', get('style_btn_radius'), true),
    decl('font-size', get('style_btn_font_size'), true),
    decl('font-weight', get('style_btn_font_weight'), true),
    decl('letter-spacing', get('style_btn_tracking'), true),
    decl('border-width', get('style_btn_border_width'), true),
    get('style_btn_transition')
      ? `  transition: background-color ${get('style_btn_transition')} ease, color ${get('style_btn_transition')} ease, border-color ${get('style_btn_transition')} ease;\n`
      : '',
  ].join('');

  const scopeSelector = (selector: string) =>
    selector
      .split(', ')
      .map((s) => `${SCOPE} ${s}`)
      .join(', ');

  const allButtons = BUTTON_VARIANTS.map((v) => scopeSelector(v.selector)).join(', ');
  let buttons = btnShape
    ? `${allButtons} {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-style: solid;\n  cursor: pointer;\n${btnShape}}\n`
    : '';

  for (const { prefix, selector } of BUTTON_VARIANTS) {
    const base = [
      decl('background-color', get(`style_btn_${prefix}_bg`), true),
      decl('color', get(`style_btn_${prefix}_text`), true),
      decl('border-color', get(`style_btn_${prefix}_border`), true),
    ].join('');
    if (base) buttons += `${scopeSelector(selector)} {\n${base}}\n`;

    const hover = [
      decl('background-color', get(`style_btn_${prefix}_hover_bg`), true),
      decl('color', get(`style_btn_${prefix}_hover_text`), true),
      decl('border-color', get(`style_btn_${prefix}_hover_border`), true),
    ].join('');
    if (hover) {
      const hoverSelector = selector
        .split(', ')
        .map((s) => `${SCOPE} ${s}:hover`)
        .join(', ');
      buttons += `${hoverSelector} {\n${hover}}\n`;
    }
  }

  const css = root + typography + layout + buttons + applied;

  // Les polices ne sont chargées que si elles sont choisies : pas de requête
  // vers Google Fonts sur une installation qui n'a rien réglé.
  const families = [headingFont, bodyFont]
    .filter(Boolean)
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800`);
  const fontsUrl = families.length
    ? `https://fonts.googleapis.com/css2?${[...new Set(families)].join('&')}&display=swap`
    : null;

  return (
    <>
      {fontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontsUrl} />
        </>
      )}
      {css.trim() && <style dangerouslySetInnerHTML={{ __html: css }} />}
    </>
  );
}
