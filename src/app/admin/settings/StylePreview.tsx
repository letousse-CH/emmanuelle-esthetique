'use client';

import React, { useState } from 'react';

/**
 * Aperçu du style global.
 *
 * Les réglages de « Design & Style » ne se voyaient qu'après enregistrement,
 * puis rechargement d'une page publique. On travaillait donc à l'aveugle sur
 * une centaine de valeurs. Ce panneau applique les jetons en cours d'édition à
 * une page miniature — mêmes règles que `GlobalStyles`, mais confinées ici par
 * des variables CSS locales.
 */
export default function StylePreview({ values }: { values: Record<string, string> }) {
  const get = (key: string, fallback = '') => (values[key] ?? '').trim() || fallback;

  const bg = get('style_color_bg', '#FFFFFF');
  const surface = get('style_color_surface', '#F5F5F4');
  const text = get('style_color_text', '#1C1917');
  const muted = get('style_color_text_muted', '#78716C');
  const primary = get('style_color_primary', '#1C1917');
  const border = get('style_color_border', '#E7E5E4');
  const radius = get('style_border_radius_base', '0px');

  const headingFont = get('style_font_headings', 'Inter');
  const bodyFont = get('style_font_body', 'Inter');
  const headingStack = `'${headingFont}', ui-serif, Georgia, serif`;
  const bodyStack = `'${bodyFont}', ui-sans-serif, system-ui, sans-serif`;

  /*
    Les boutons de l'aperçu sont **survolables**. Les six jetons de survol se
    réglaient à l'aveugle : rien ne les montrait, il fallait enregistrer puis
    aller passer la souris sur le site pour découvrir le résultat.
  */
  const button = (variant: 'primary' | 'secondary' | 'ghost', label: string) => (
    <PreviewButton
      key={variant}
      variant={variant}
      label={label}
      get={get}
      fallbacks={{ primary, bg, text }}
      bodyStack={bodyStack}
      radius={radius}
    />
  );

  const heading = (level: 'h1' | 'h2' | 'h3', fallbackSize: string) => ({
    fontFamily: headingStack,
    fontSize: get(`style_${level}_size`, fallbackSize),
    fontWeight: Number(get(`style_${level}_weight`, '600')),
    lineHeight: get(`style_${level}_leading`, '1.2'),
    letterSpacing: get(`style_${level}_tracking`, '0'),
    color: get(`style_${level}_color`, text),
    margin: 0,
  });

  return (
    <div
      className="overflow-hidden rounded-xl border border-stone-200"
      style={{ backgroundColor: bg }}
    >
      <div
        style={{
          paddingBlock: '2.25rem',
          paddingInline: get('style_gutter', '1.5rem'),
          display: 'grid',
          gap: get('style_block_gap', '1.5rem'),
        }}
      >
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <span
            style={{
              fontFamily: bodyStack,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: primary,
            }}
          >
            Aperçu
          </span>
          <h1 style={heading('h1', '2.25rem')}>Un titre de page</h1>
          <p
            style={{
              fontFamily: bodyStack,
              fontSize: get('style_body_size', '1rem'),
              lineHeight: get('style_body_leading', '1.65'),
              color: get('style_body_color', muted),
              margin: 0,
            }}
          >
            Une phrase de présentation, dans la police et la couleur du texte courant.
            Elle sert à juger la lisibilité autant que le ton.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
            {button('primary', 'Prendre rendez-vous')}
            {button('secondary', 'En savoir plus')}
            {button('ghost', 'Nous écrire')}
          </div>
          <p style={{ fontFamily: bodyStack, fontSize: '0.75rem', color: muted, margin: 0 }}>
            Passez la souris sur un bouton pour voir ses couleurs de survol.
          </p>
        </div>

        <div
          style={{
            backgroundColor: surface,
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: '1.25rem',
            display: 'grid',
            gap: '0.375rem',
          }}
        >
          <h3 style={heading('h3', '1.125rem')}>Un bloc posé sur le fond</h3>
          <p
            style={{
              fontFamily: bodyStack,
              fontSize: get('style_small_size', '0.875rem'),
              lineHeight: get('style_small_leading', '1.55'),
              color: get('style_small_color', muted),
              margin: 0,
            }}
          >
            La couleur « surface » et les bordures se jugent ici.
          </p>
        </div>

        <h2 style={heading('h2', '1.5rem')}>Un titre de section</h2>
      </div>
    </div>
  );
}

/**
 * Un bouton de l'aperçu, au repos et au survol.
 *
 * Les valeurs de repli reproduisent ce que `GlobalStyles` applique quand un
 * jeton est vide : l'aperçu doit montrer le site tel qu'il sera, pas un état
 * intermédiaire propre à cet écran.
 */
function PreviewButton({
  variant, label, get, fallbacks, bodyStack, radius,
}: {
  variant: 'primary' | 'secondary' | 'ghost';
  label: string;
  get: (key: string, fallback?: string) => string;
  fallbacks: { primary: string; bg: string; text: string };
  bodyStack: string;
  radius: string;
}) {
  const [hover, setHover] = useState(false);

  const restBg = get(`style_btn_${variant}_bg`, variant === 'primary' ? fallbacks.primary : 'transparent');
  const restText = get(`style_btn_${variant}_text`, variant === 'primary' ? fallbacks.bg : fallbacks.text);
  const restBorder = get(`style_btn_${variant}_border`, variant === 'secondary' ? fallbacks.text : 'transparent');

  const bgColor = hover ? get(`style_btn_${variant}_hover_bg`, restBg) : restBg;
  const color = hover ? get(`style_btn_${variant}_hover_text`, restText) : restText;
  const borderColor = hover ? get(`style_btn_${variant}_hover_border`, restBorder) : restBorder;

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      // Aperçu : le bouton ne mène nulle part, il se contente de se montrer.
      onClick={(event) => event.preventDefault()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backgroundColor: bgColor,
        color,
        border: `${get('style_btn_border_width', '1px')} solid ${borderColor}`,
        borderRadius: get('style_btn_radius', radius),
        paddingBlock: get('style_btn_padding_y', '0.75rem'),
        paddingInline: get('style_btn_padding_x', '1.5rem'),
        fontFamily: bodyStack,
        fontSize: get('style_btn_font_size', '0.9375rem'),
        fontWeight: Number(get('style_btn_font_weight', '500')),
        letterSpacing: get('style_btn_tracking', '0'),
        lineHeight: 1.2,
        transition: `background-color ${get('style_btn_transition', '150ms')} ease, color ${get('style_btn_transition', '150ms')} ease, border-color ${get('style_btn_transition', '150ms')} ease`,
      }}
    >
      {label}
    </button>
  );
}
