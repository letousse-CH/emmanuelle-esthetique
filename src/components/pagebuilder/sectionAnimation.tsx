'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { MotionConfig } from 'motion/react';

import {
  animationVariants,
  LAYOUT_DEFAULTS,
  type Animation,
  type SectionAnimationVariants,
} from './sectionLayout';

/**
 * Distribution du réglage « Animation » d'une section.
 *
 * Les trente-trois sections animent leurs éléments avec deux jeux de variantes
 * partagés. Tant qu'ils étaient de simples constantes de module, le choix fait
 * dans le constructeur ne pouvait rien piloter : il était enregistré dans la
 * page et ignoré au rendu. Un contexte règle ça sans toucher au balisage de
 * chaque section — le fournisseur est posé par le rendu de page, au-dessus du
 * composant, puisque `SectionWrapper` est rendu *à l'intérieur* de celui-ci et
 * arriverait donc trop tard.
 */
const SectionAnimationContext = createContext<SectionAnimationVariants>(
  animationVariants(LAYOUT_DEFAULTS.animation),
);

export function SectionAnimationProvider({
  animation,
  children,
}: {
  animation?: string;
  children: React.ReactNode;
}) {
  const resolved = (animation as Animation | undefined) ?? LAYOUT_DEFAULTS.animation;
  const value = useMemo(() => animationVariants(resolved), [resolved]);

  /*
    Deux corrections portées par `MotionConfig` :

    1. **« Aucune animation » n'arrêtait pas tout.** Treize éléments — cartes de
       grille, vignettes de galerie — portent leurs propres `initial` /
       `whileInView` en dur, hors des variantes partagées. Ils continuaient donc
       à bouger alors que la section était réglée sur « Aucune ». Une durée nulle
       les fige sans avoir à réécrire chacun d'eux.

    2. **La promesse d'accessibilité était fausse.** Le panneau annonçait que les
       animations se coupent pour qui a demandé à son système de réduire les
       mouvements ; rien ne le faisait. `reducedMotion="user"` le fait vraiment.
  */
  return (
    <MotionConfig
      reducedMotion="user"
      {...(resolved === 'none' ? { transition: { duration: 0 } } : {})}
    >
      <SectionAnimationContext.Provider value={value}>{children}</SectionAnimationContext.Provider>
    </MotionConfig>
  );
}

export function useSectionAnimation(): SectionAnimationVariants {
  return useContext(SectionAnimationContext);
}
