import React from 'react';
import type { SectionType } from './wireframes.config';

/**
 * Libellés lisibles pour le panneau "Ajouter une section" — remplace les slugs
 * techniques (hero_1, text_image_1…) par un nom compréhensible en un coup d'œil.
 */
export const SECTION_LABELS: Record<string, string> = {
  hero_1: 'Hero plein écran',
  hero_2: 'Hero centré',
  hero_3: 'Hero portrait en arche',
  hero_4: 'Hero éditorial photo',
  hero_5: 'Bandeau de page',
  intro_1: 'Intro : image + citation',
  features_1: 'Liste de points clés',
  features_2: 'Grille de 3 atouts',
  features_3: 'Deux offres comparées',
  cta_1: "Appel à l'action",
  testimonial_1: 'Témoignage unique',
  text_1: 'Bloc de texte',
  text_image_1: 'Texte riche + image',
  gallery_grid: 'Galerie en grille',
  gallery_carousel: 'Galerie en carrousel',
  gallery_masonry: 'Galerie en cascade',
  faq_1: 'Questions fréquentes',
  reviews_1: 'Avis clients',
  marquee_1: 'Bandeau défilant',
  pricing_1: 'Carte tarif',
  stats_1: 'Chiffres clés',
  timeline_1: 'Étapes / processus',
  logos_1: 'Bandeau de logos',
  cta_2: "Bandeau d'appel à l'action",
  cta_3: 'Appel discret en ligne',
  testimonial_2: 'Trois témoignages',
  team_1: 'Équipe en grille',
  contact_1: 'Coordonnées pratiques',
  steps_1: 'Étapes numérotées',
  stats_2: 'Bandeau de chiffres',
  faq_2: 'FAQ deux colonnes',
  compare_1: 'Tableau comparatif',
  banner_1: "Bandeau d'annonce",
  hero_video: "Hero vidéo d'impact",
  pricing_2: 'Tarification avec bascule',
  stats_3: 'Grille de métriques Bento',
  newsletter_1: "Capture d'email newsletter",
  bento_grid_1: 'Grille Bento moderne',
};

/* ── Primitives de dessin ─────────────────────────────────────────────── */
const L = (x: number, y: number, w: number, h = 4, cls = 'fill-stone-300') => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cls} />
);
const Pill = (x: number, y: number, w: number, cls = 'fill-stone-400') => (
  <rect x={x} y={y} width={w} height={9} rx={4.5} className={cls} />
);
const Img = (x: number, y: number, w: number, h: number, cls = 'fill-stone-200') => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={4} className={cls} />
    <circle cx={x + w * 0.26} cy={y + h * 0.3} r={Math.min(w, h) * 0.11} className="fill-stone-300/80" />
    <path
      d={`M ${x + 2} ${y + h - 3} L ${x + w * 0.38} ${y + h * 0.5} L ${x + w * 0.6} ${y + h * 0.7} L ${x + w * 0.8} ${y + h * 0.42} L ${x + w - 2} ${y + h - 3} Z`}
      className="fill-stone-300/80"
    />
  </g>
);
const Frame = ({ dark, children }: { dark?: boolean; children: React.ReactNode }) => (
  <svg viewBox="0 0 160 100" className="w-full h-full">
    <rect x="0" y="0" width="160" height="100" rx="6" className={dark ? 'fill-stone-800' : 'fill-stone-50'} />
    {children}
  </svg>
);

/** Petite vignette wireframe illustrant la mise en page de chaque type de section. */
export function SectionPreview({ type }: { type: SectionType | string }) {
  switch (type) {
    case 'hero_1':
      return (
        <Frame>
          <rect x="0" y="0" width="160" height="100" rx="6" className="fill-stone-300" />
          <rect x="0" y="52" width="160" height="48" className="fill-stone-900/45" />
          {L(66, 64, 10, 3, 'fill-stone-400')}
          {L(42, 71, 76, 5, 'fill-white')}
          {L(55, 79, 50, 4, 'fill-white/70')}
          {Pill(52, 87, 26)}
          <rect x="82" y="87" width="26" height="9" rx="4.5" className="fill-white/15 stroke-white/70" strokeWidth={1} />
        </Frame>
      );
    case 'hero_2':
      return (
        <Frame>
          {L(66, 26, 12, 3, 'fill-stone-400')}
          {L(30, 36, 100, 7, 'fill-stone-700')}
          {L(45, 48, 70, 7, 'fill-stone-700')}
          {L(42, 62, 76, 4, 'fill-stone-300')}
          {Pill(65, 74, 30)}
        </Frame>
      );
    case 'hero_3':
      return (
        <Frame>
          {L(70, 12, 20, 3, 'fill-stone-400')}
          {L(38, 20, 84, 6, 'fill-stone-700')}
          {L(55, 30, 50, 4, 'fill-stone-400/60')}
          <rect x="34" y="38" width="18" height="6" rx="3" className="fill-stone-200" />
          <rect x="56" y="38" width="22" height="6" rx="3" className="fill-stone-200" />
          <rect x="82" y="38" width="18" height="6" rx="3" className="fill-stone-200" />
          {Pill(52, 48, 26)}
          {/* portrait en arche */}
          <path d="M 62 100 L 62 76 A 18 18 0 0 1 98 76 L 98 100 Z" className="fill-stone-200" />
          <circle cx="72" cy="78" r="3" className="fill-stone-300" />
        </Frame>
      );
    case 'hero_4':
      return (
        <Frame>
          <rect x="0" y="0" width="160" height="100" rx="6" className="fill-stone-300" />
          <rect x="0" y="44" width="160" height="56" className="fill-stone-900/55" />
          {L(10, 56, 16, 3, 'fill-stone-400')}
          {L(10, 64, 66, 7, 'fill-white')}
          {L(10, 76, 44, 5, 'fill-white/60')}
          {L(10, 87, 54, 3, 'fill-white/40')}
          {/* carte flottante */}
          <rect x="98" y="56" width="52" height="36" rx="5" className="fill-white" />
          {L(104, 62, 30, 4, 'fill-stone-700')}
          {L(104, 70, 38, 3, 'fill-stone-300')}
          {Pill(104, 78, 40)}
        </Frame>
      );
    case 'hero_5':
      return (
        <Frame>
          <rect x="0" y="24" width="160" height="52" className="fill-stone-300" />
          <rect x="0" y="24" width="160" height="52" className="fill-stone-900/45" />
          {L(70, 34, 20, 3, 'fill-stone-400')}
          {L(44, 42, 72, 6, 'fill-white')}
          {L(66, 53, 28, 2, 'fill-stone-400')}
          {L(50, 59, 60, 3, 'fill-white/60')}
          {L(66, 68, 28, 3, 'fill-white/80')}
        </Frame>
      );
    case 'intro_1':
      return (
        <Frame>
          {Img(6, 15, 62, 70)}
          <text x="80" y="42" className="fill-stone-200 font-serif" fontSize="34">“</text>
          {L(84, 46, 68, 4, 'fill-stone-700')}
          {L(84, 54, 60, 4, 'fill-stone-700')}
          {L(84, 66, 66, 3, 'fill-stone-300')}
          {L(84, 72, 50, 3, 'fill-stone-300')}
          {Pill(84, 82, 34)}
        </Frame>
      );
    case 'features_1':
      return (
        <Frame>
          {L(60, 10, 40, 3, 'fill-stone-400')}
          {L(38, 18, 84, 6, 'fill-stone-700')}
          <circle cx="42" cy="42" r="2" className="fill-stone-400" />
          {L(48, 39, 58, 4)}
          <circle cx="42" cy="53" r="2" className="fill-stone-400" />
          {L(48, 50, 68, 4)}
          <circle cx="42" cy="64" r="2" className="fill-stone-400" />
          {L(48, 61, 48, 4)}
          {Pill(60, 78, 40)}
        </Frame>
      );
    case 'features_2':
      return (
        <Frame>
          {L(55, 8, 50, 3, 'fill-stone-400')}
          {L(44, 15, 72, 6, 'fill-stone-700')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={8 + i * 52} y="30" width="46" height="58" rx="5" className="fill-white stroke-stone-200" strokeWidth={1} />
              <circle cx={31 + i * 52} cy="42" r="5" className="fill-stone-400/25" />
              {L(14 + i * 52, 53, 34, 4, 'fill-stone-600')}
              {L(14 + i * 52, 61, 34, 3, 'fill-stone-300')}
              {L(14 + i * 52, 67, 24, 3, 'fill-stone-300')}
            </g>
          ))}
        </Frame>
      );
    case 'features_3':
      return (
        <Frame>
          {[0, 1].map((i) => (
            <g key={i}>
              <rect x={8 + i * 76} y="10" width="70" height="80" rx="6" className={i === 0 ? 'fill-white stroke-stone-400' : 'fill-white stroke-stone-200'} strokeWidth={1.5} />
              {L(16 + i * 76, 18, 24, 4, i === 0 ? 'fill-stone-400' : 'fill-stone-300')}
              {L(16 + i * 76, 30, 40, 5, 'fill-stone-700')}
              <circle cx={20 + i * 76} cy="44" r="1.6" className="fill-stone-400" />
              {L(24 + i * 76, 42.5, 30, 3)}
              <circle cx={20 + i * 76} cy="52" r="1.6" className="fill-stone-400" />
              {L(24 + i * 76, 50.5, 34, 3)}
              <circle cx={20 + i * 76} cy="60" r="1.6" className="fill-stone-400" />
              {L(24 + i * 76, 58.5, 26, 3)}
              {Pill(16 + i * 76, 72, 40, i === 0 ? 'fill-stone-400' : 'fill-stone-200')}
            </g>
          ))}
        </Frame>
      );
    case 'cta_1':
      return (
        <Frame dark>
          {L(65, 30, 30, 3, 'fill-stone-400')}
          {L(35, 42, 90, 7, 'fill-white')}
          {L(48, 55, 64, 4, 'fill-stone-400')}
          {Pill(62, 68, 36)}
        </Frame>
      );
    case 'testimonial_1':
      return (
        <Frame>
          <text x="80" y="36" textAnchor="middle" className="fill-stone-200 font-serif" fontSize="30">“</text>
          {L(35, 42, 90, 4, 'fill-stone-600')}
          {L(48, 50, 64, 4, 'fill-stone-600')}
          <circle cx="72" cy="70" r="7" className="fill-stone-200" />
          {L(83, 67, 30, 3, 'fill-stone-500')}
          {L(83, 73, 20, 3, 'fill-stone-300')}
        </Frame>
      );
    case 'text_1':
      return (
        <Frame>
          {L(65, 14, 30, 3, 'fill-stone-400')}
          {L(45, 22, 70, 6, 'fill-stone-700')}
          {L(30, 40, 100, 3, 'fill-stone-300')}
          {L(30, 47, 100, 3, 'fill-stone-300')}
          {L(30, 54, 80, 3, 'fill-stone-300')}
          {L(30, 65, 100, 3, 'fill-stone-300')}
          {L(30, 72, 60, 3, 'fill-stone-300')}
        </Frame>
      );
    case 'text_image_1':
      return (
        <Frame>
          {L(10, 16, 34, 3, 'fill-stone-400')}
          {L(10, 25, 74, 5, 'fill-stone-700')}
          {L(10, 38, 76, 3, 'fill-stone-300')}
          {L(10, 45, 76, 3, 'fill-stone-300')}
          {L(10, 52, 60, 3, 'fill-stone-300')}
          {L(10, 63, 34, 3, 'fill-stone-400')}
          {Img(92, 12, 60, 76)}
        </Frame>
      );
    case 'gallery_grid':
      return (
        <Frame>
          {L(60, 8, 40, 3, 'fill-stone-300')}
          {Img(8, 18, 68, 36)}
          {Img(84, 18, 68, 36)}
          {Img(8, 58, 68, 34)}
          {Img(84, 58, 68, 34)}
        </Frame>
      );
    case 'gallery_carousel':
      return (
        <Frame>
          {L(60, 8, 40, 3, 'fill-stone-300')}
          {Img(8, 20, 52, 60)}
          {Img(66, 20, 52, 60)}
          <rect x="124" y="20" width="40" height="60" rx="4" className="fill-stone-200/60" />
          <circle cx="150" cy="50" r="9" className="fill-white stroke-stone-300" strokeWidth={1} />
          <path d="M 148 46 L 153 50 L 148 54" className="stroke-stone-500" strokeWidth={1.5} fill="none" />
        </Frame>
      );
    case 'gallery_masonry':
      return (
        <Frame>
          {Img(8, 10, 46, 40)}
          {Img(8, 54, 46, 36)}
          {Img(57, 10, 46, 60)}
          {Img(57, 74, 46, 16)}
          {Img(106, 10, 46, 24)}
          {Img(106, 38, 46, 52)}
        </Frame>
      );
    case 'faq_1':
      return (
        <Frame>
          {L(60, 8, 40, 3, 'fill-stone-400')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="14" y={22 + i * 22} width="132" height="16" rx="4" className={i === 0 ? 'fill-stone-400/8 stroke-stone-300' : 'fill-white stroke-stone-200'} strokeWidth={1} />
              {L(22, 28 + i * 22, i === 0 ? 70 : 90, 3, i === 0 ? 'fill-stone-400' : 'fill-stone-500')}
              <path d={`M 138 ${28 + i * 22} l 4 4 l 4 -4`} className={i === 0 ? 'stroke-stone-400' : 'stroke-stone-300'} strokeWidth={1.4} fill="none" />
            </g>
          ))}
        </Frame>
      );
    case 'reviews_1':
      return (
        <Frame>
          {L(55, 8, 50, 3, 'fill-stone-300')}
          {[0, 1, 2, 3, 4].map((i) => (
            <text key={i} x={62 + i * 9} y="22" className="fill-stone-400" fontSize="9">★</text>
          ))}
          <rect x="34" y="30" width="92" height="46" rx="6" className="fill-white stroke-stone-200" strokeWidth={1} />
          {L(44, 40, 72, 3, 'fill-stone-500')}
          {L(44, 47, 60, 3, 'fill-stone-500')}
          <circle cx="50" cy="62" r="5" className="fill-stone-200" />
          {L(58, 60, 28, 3, 'fill-stone-400')}
          <circle cx="18" cy="53" r="6" className="fill-white stroke-stone-300" strokeWidth={1} />
          <circle cx="142" cy="53" r="6" className="fill-white stroke-stone-300" strokeWidth={1} />
        </Frame>
      );
    case 'marquee_1':
      return (
        <Frame dark>
          <rect x="0" y="40" width="160" height="20" className="fill-stone-900" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              {L(6 + i * 40, 47, 24, 5, 'fill-stone-400/70')}
              <text x={32 + i * 40} y="53" className="fill-stone-400/50" fontSize="6">★</text>
            </g>
          ))}
        </Frame>
      );
    case 'pricing_1':
      return (
        <Frame>
          <rect x="34" y="10" width="92" height="80" rx="8" className="fill-white stroke-stone-400" strokeWidth={1.5} />
          <rect x="34" y="10" width="92" height="3" className="fill-stone-400" />
          {L(44, 22, 30, 4, 'fill-stone-300')}
          {L(44, 32, 44, 9, 'fill-stone-800')}
          <circle cx="46" cy="52" r="1.6" className="fill-stone-400" />
          {L(50, 50.5, 30, 3)}
          <circle cx="46" cy="60" r="1.6" className="fill-stone-400" />
          {L(50, 58.5, 34, 3)}
          <circle cx="86" cy="52" r="1.6" className="fill-stone-400" />
          {L(90, 50.5, 26, 3)}
          <circle cx="86" cy="60" r="1.6" className="fill-stone-400" />
          {L(90, 58.5, 28, 3)}
          {Pill(44, 72, 72)}
        </Frame>
      );
    case 'stats_1':
      return (
        <Frame>
          {L(60, 12, 40, 3, 'fill-stone-300')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <text x={30 + i * 50} y="52" textAnchor="middle" className="fill-stone-400 font-serif font-bold" fontSize="18">{['5+', '98', '12'][i]}</text>
              {L(14 + i * 50, 62, 32, 3, 'fill-stone-400')}
            </g>
          ))}
        </Frame>
      );
    case 'timeline_1':
      return (
        <Frame>
          {L(60, 10, 40, 3, 'fill-stone-300')}
          <line x1="18" y1="42" x2="142" y2="42" className="stroke-stone-200" strokeWidth={1.5} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx={30 + i * 50} cy="42" r="8" className="fill-white stroke-stone-400" strokeWidth={1.5} />
              <text x={30 + i * 50} y="45" textAnchor="middle" className="fill-stone-400 font-bold" fontSize="8">{i + 1}</text>
              {L(14 + i * 50, 60, 32, 4, 'fill-stone-600')}
              {L(14 + i * 50, 68, 32, 3, 'fill-stone-300')}
            </g>
          ))}
        </Frame>
      );
    case 'logos_1':
      return (
        <Frame>
          {L(60, 16, 40, 3, 'fill-stone-300')}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={14 + i * 34} y="44" width="24" height="12" rx="2" className="fill-stone-300" />
          ))}
        </Frame>
      );
    /* ── Sections complémentaires ─────────────────────────────────────── */
    case 'cta_2':
      return (
        <Frame>
          {L(46, 34, 68, 7, 'fill-stone-400')}
          {L(56, 46, 48, 4)}
          {Pill(64, 56, 32)}
        </Frame>
      );
    case 'cta_3':
      return (
        <Frame>
          <rect x="14" y="30" width="132" height="40" rx="3" className="fill-none stroke-stone-300" strokeWidth={1} />
          {L(24, 40, 54, 6, 'fill-stone-400')}
          {L(24, 51, 40, 4)}
          {Pill(104, 44, 32)}
        </Frame>
      );
    case 'testimonial_2':
      return (
        <Frame>
          {L(62, 20, 36, 5, 'fill-stone-400')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={12 + i * 46} y="32" width="40" height="46" rx="3" className="fill-none stroke-stone-200" strokeWidth={1} />
              {L(18 + i * 46, 40, 28, 3)}
              {L(18 + i * 46, 47, 24, 3)}
              {L(18 + i * 46, 54, 26, 3)}
              {L(18 + i * 46, 66, 18, 4, 'fill-stone-400')}
            </g>
          ))}
        </Frame>
      );
    case 'team_1':
      return (
        <Frame>
          {L(64, 16, 32, 5, 'fill-stone-400')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              {Img(14 + i * 46, 28, 40, 38)}
              {L(14 + i * 46, 71, 26, 4, 'fill-stone-400')}
              {L(14 + i * 46, 79, 18, 3)}
            </g>
          ))}
        </Frame>
      );
    case 'contact_1':
      return (
        <Frame>
          {L(62, 16, 36, 5, 'fill-stone-400')}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={12 + i * 35} y="32" width="31" height="44" rx="3" className="fill-none stroke-stone-200" strokeWidth={1} />
              <circle cx={20 + i * 35} cy="41" r="4" className="fill-stone-400" />
              {L(17 + i * 35, 52, 16, 3)}
              {L(17 + i * 35, 60, 21, 4, 'fill-stone-400')}
            </g>
          ))}
        </Frame>
      );
    case 'steps_1':
      return (
        <Frame>
          {L(62, 16, 36, 5, 'fill-stone-400')}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={12 + i * 35} y="32" width="31" height="2" className="fill-stone-400" />
              <text x={12 + i * 35} y="46" className="fill-stone-400" fontSize="10" fontWeight="700">
                {`0${i + 1}`}
              </text>
              {L(12 + i * 35, 52, 24, 4, 'fill-stone-400')}
              {L(12 + i * 35, 60, 18, 3)}
            </g>
          ))}
        </Frame>
      );
    case 'stats_2':
      return (
        <Frame>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              {i > 0 && <rect x={i * 40} y="36" width="1" height="28" className="fill-stone-200" />}
              {L(10 + i * 40, 42, 22, 7, 'fill-stone-400')}
              {L(12 + i * 40, 54, 18, 3)}
            </g>
          ))}
        </Frame>
      );
    case 'faq_2':
      return (
        <Frame>
          {L(14, 18, 44, 5, 'fill-stone-400')}
          {[0, 1].map((col) =>
            [0, 1].map((row) => (
              <g key={`${col}-${row}`}>
                {L(14 + col * 74, 34 + row * 26, 42, 4, 'fill-stone-400')}
                {L(14 + col * 74, 42 + row * 26, 60, 3)}
                {L(14 + col * 74, 49 + row * 26, 48, 3)}
              </g>
            )),
          )}
        </Frame>
      );
    case 'compare_1':
      return (
        <Frame>
          {L(60, 16, 40, 5, 'fill-stone-400')}
          <rect x="20" y="28" width="120" height="52" rx="2" className="fill-none stroke-stone-200" strokeWidth={1} />
          <rect x="104" y="28" width="36" height="52" className="fill-stone-400/10" />
          {L(26, 34, 24, 3)}
          {L(74, 34, 18, 3)}
          {L(112, 34, 20, 3, 'fill-stone-400')}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="20" y={44 + i * 12} width="120" height="1" className="fill-stone-200" />
              {L(26, 48 + i * 12, 30, 3)}
              <circle cx="84" cy={50 + i * 12} r="2.5" className="fill-stone-300" />
              <circle cx="122" cy={50 + i * 12} r="2.5" className="fill-stone-400" />
            </g>
          ))}
        </Frame>
      );
    case 'banner_1':
      return (
        <Frame>
          <rect x="0" y="44" width="160" height="16" className="fill-stone-100" />
          {L(38, 50, 58, 4)}
          {L(102, 50, 22, 4, 'fill-stone-400')}
        </Frame>
      );
    default:
      return (
        <Frame>
          {L(50, 46, 60, 6, 'fill-stone-300')}
        </Frame>
      );
  }
}
