/**
 * Polices servies par le site lui-même (next/font, voir app/layout.tsx) : préchargées,
 * sans requête vers Google, avec une police de repli aux métriques ajustées — c'est ce
 * qui évite le saut de mise en page quand la police définitive arrive.
 *
 * Les autres polices du catalogue « Design & Style » restent chargées depuis Google Fonts
 * par GlobalStyles (Inter et Cormorant Garamond, déclarées aussi dans le layout, n'y figurent pas :
 * leurs variables `--font-sans` / `--font-serif` sont celles que GlobalStyles réécrit). Pour en auto-héberger une de plus : la déclarer dans app/layout.tsx
 * avec `variable`, puis l'ajouter ici.
 */
export const SELF_HOSTED_FONTS: Record<string, string> = {
  Lora: 'var(--font-lora)',
  'Open Sans': 'var(--font-open-sans)',
};
