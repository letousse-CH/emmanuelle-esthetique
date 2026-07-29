"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const DEFAULTS = {
  style_font_headings: 'Cormorant Garamond',
  style_font_body: 'Inter',
  style_color_primary: '#8A9A7B',
  style_color_btn_dark_bg: '#3A3730',
  style_color_btn_dark_text: '#ffffff',
  style_color_btn_dark_hover_bg: '#8A9A7B',
  style_color_btn_light_bg: '#ffffff',
  style_color_btn_light_text: '#3A3730',
  style_color_btn_light_border: '#E2D9CB',
  style_color_btn_light_hover_bg: '#F5F0E8',
  style_color_btn_light_hover_text: '#8A9A7B',
  style_color_btn_light_hover_border: '#8A9A7B',
  style_border_radius_base: '14px',
  style_color_text_h2: '#3A3730',
  style_color_text_body: '#3A3730',
};

type StyleConfig = typeof DEFAULTS;

export default function GlobalStyles() {
  const [styles, setStyles] = useState<StyleConfig | null>(null);

  useEffect(() => {
    // 1. Try to load from localStorage for instant apply
    const cached = localStorage.getItem('site_global_styles');
    if (cached) {
      try {
        setStyles(JSON.parse(cached));
      } catch (e) {
        console.error('Error parsing cached styles', e);
      }
    }

    // 2. Fetch fresh styles from Supabase
    const fetchStyles = async () => {
      try {
        const keys = Object.keys(DEFAULTS);
        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', keys);

        if (error) throw error;

        if (data) {
          const fetchedMap = Object.fromEntries(data.map(r => [r.key, r.value]));
          const mergedStyles = { ...DEFAULTS } as any;
          
          // La table `settings` fait autorité : ce qui est réglé dans
          // /admin/settings (onglet Design & Style) l'emporte, et DEFAULTS ne
          // sert que pour les clés absentes. Ne pas réintroduire de liste noire
          // de valeurs « héritées » : elle empêcherait de choisir ces couleurs
          // depuis l'admin.
          for (const key of keys) {
            if (fetchedMap[key] !== undefined && fetchedMap[key] !== null && fetchedMap[key] !== '') {
              mergedStyles[key] = fetchedMap[key];
            }
          }

          setStyles(mergedStyles);
          localStorage.setItem('site_global_styles', JSON.stringify(mergedStyles));
        } else {
          setStyles(DEFAULTS);
        }
      } catch (err) {
        console.error('Failed to load global styles:', err);
        if (!cached) {
          setStyles(DEFAULTS);
        }
      }
    };

    fetchStyles();
  }, []);

  if (!styles) {
    return null;
  }

  const {
    style_font_headings: headingFont,
    style_font_body: bodyFont,
    style_color_primary: primaryColor,
    style_color_btn_dark_bg: btnDarkBg,
    style_color_btn_dark_text: btnDarkText,
    style_color_btn_dark_hover_bg: btnDarkHoverBg,
    style_color_btn_light_bg: btnLightBg,
    style_color_btn_light_text: btnLightText,
    style_color_btn_light_border: btnLightBorder,
    style_color_btn_light_hover_bg: btnLightHoverBg,
    style_color_btn_light_hover_text: btnLightHoverText,
    style_color_btn_light_hover_border: btnLightHoverBorder,
    style_border_radius_base: borderRadiusBase,
    style_color_text_h2: textH2Color,
    style_color_text_body: textBodyColor,
  } = styles;

  const headingFontUrl = headingFont.replace(/ /g, '+');
  const bodyFontUrl = bodyFont.replace(/ /g, '+');
  const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${headingFontUrl}:wght@300;400;500;600;700;800&family=${bodyFontUrl}:wght@300;400;500;600;700&display=swap`;

  const css = `
    :root {
      --color-sage: ${primaryColor} !important;
      --color-copper: ${primaryColor} !important;
      --color-stone-deep: ${textBodyColor} !important;
      --color-text-h2: ${textH2Color} !important;
      --color-paper: #FAF7F2 !important;
      --font-serif: "${headingFont}", sans-serif !important;
      --font-sans: "${bodyFont}", sans-serif !important;
      --border-radius-base: ${borderRadiusBase} !important;
    }

    /* Redefine tailwind default border radii using the scaling factor */
    .rounded-sm, img.rounded-sm { border-radius: calc(var(--border-radius-base) * 0.25) !important; }
    .rounded, img.rounded { border-radius: calc(var(--border-radius-base) * 0.5) !important; }
    .rounded-md, img.rounded-md { border-radius: calc(var(--border-radius-base) * 0.5) !important; }
    .rounded-lg, img.rounded-lg { border-radius: var(--border-radius-base) !important; }
    .rounded-xl, img.rounded-xl { border-radius: calc(var(--border-radius-base) * 1.5) !important; }
    .rounded-2xl, img.rounded-2xl { border-radius: calc(var(--border-radius-base) * 2) !important; }
    .rounded-3xl, img.rounded-3xl { border-radius: calc(var(--border-radius-base) * 3) !important; }
    
    /* Target arbitrary rounded classes used in tailwind */
    [class*="rounded-[1rem]"]  { border-radius: calc(var(--border-radius-base) * 2) !important; }
    [class*="rounded-[1.5rem]"] { border-radius: calc(var(--border-radius-base) * 3) !important; }
    [class*="rounded-[2rem]"]  { border-radius: calc(var(--border-radius-base) * 4) !important; }
    [class*="rounded-[2.5rem]"] { border-radius: calc(var(--border-radius-base) * 5) !important; }
    [class*="rounded-[3rem]"]  { border-radius: calc(var(--border-radius-base) * 6) !important; }

    /* Enforce global border radius on article images, editor content images, and block images */
    .ql-editor img, .prose img, article img, .image-rounded img {
      border-radius: calc(var(--border-radius-base) * 1.5) !important;
    }

    /* Force tags to follow fonts */
    h1, h2, h3, h4, h5, h6, .font-serif {
      font-family: var(--font-serif) !important;
    }
    body, p, li, .font-sans {
      font-family: var(--font-sans) !important;
    }

    /* Enforce text colors */
    h2, .text-h2 {
      color: var(--color-text-h2) !important;
    }
    body, p, .text-body {
      color: var(--color-stone-deep);
    }
    .text-white h2, .bg-stone-900 h2, .text-white p, .bg-stone-900 p,
    .text-white-important h2, .text-white-important p {
      color: inherit !important;
    }

    /* Bold weight in rich text fields */
    strong { font-weight: 800 !important; }

    /* Selection highlight */
    ::selection {
      background-color: ${primaryColor}33 !important;
    }

    /* Dark button overrides (applying to bg-sage, bg-stone-900, or bg-copper buttons with text-white) */
    button.bg-sage, a.bg-sage, .btn.bg-sage,
    button.bg-stone-900, a.bg-stone-900, .btn.bg-stone-900,
    button.bg-copper, a.bg-copper, .btn.bg-copper {
      background-color: ${btnDarkBg} !important;
      color: ${btnDarkText} !important;
    }
    button.bg-sage:hover, a.bg-sage:hover, .btn.bg-sage:hover,
    button.bg-stone-900:hover, a.bg-stone-900:hover, .btn.bg-stone-900:hover,
    button.bg-copper:hover, a.bg-copper:hover, .btn.bg-copper:hover {
      background-color: ${btnDarkHoverBg} !important;
    }

    /* Light button overrides (applying to bg-white or bg-stone-100 buttons) */
    button.bg-white, a.bg-white, .btn.bg-white,
    button.bg-stone-100, a.bg-stone-100, .btn.bg-stone-100 {
      background-color: ${btnLightBg} !important;
      color: ${btnLightText} !important;
      border-color: ${btnLightBorder} !important;
    }
    button.bg-white:hover, a.bg-white:hover, .btn.bg-white:hover,
    button.bg-stone-100:hover, a.bg-stone-100:hover, .btn.bg-stone-100:hover {
      background-color: ${btnLightHoverBg} !important;
      color: ${btnLightHoverText} !important;
      border-color: ${btnLightHoverBorder} !important;
    }
  `;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={googleFontsUrl} />
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
