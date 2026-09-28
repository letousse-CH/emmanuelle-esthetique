"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Couche de mouvement du site public (page builder v2).
 *
 * Trois choses, toutes additives :
 *  1. défilement lissé avec inertie (Lenis) ;
 *  2. révélations : chaque bloc reçoit `.is-in` quand il entre dans l'écran, en
 *     cascade quand plusieurs arrivent ensemble ;
 *  3. parallaxe douce des images (`[data-parallax]`).
 *
 * Les états « cachés » vivent uniquement dans le CSS (blocks.css, section
 * Mouvement) et sont gardés par la classe `pb-motion` de <html>. Cette classe
 * est posée avant le premier rendu par le script du layout racine ; ce
 * composant la retire dans l'admin et pour `prefers-reduced-motion`, si bien
 * que le contenu reste toujours visible quand la couche n'est pas active.
 */

const BLOCK = '.pb-page:not(.pb-editing) .pb-col > *';
const SECTION = '.pb-page:not(.pb-editing) .pb-section';
/** Éléments de grille : révélés chacun à leur entrée dans l'écran (et non avec leur bloc). */
const ITEMS = '.pb-page:not(.pb-editing) :is(.pb-cards, .pb-steps, .pb-offers, .pb-stats, .pb-testis, .pb-prices, .pb-gallery) > *';
const PARALLAX = '.pb-page:not(.pb-editing) [data-parallax]';
/** Grilles dont les éléments d'une même ligne se décalent en défilant. */
const ROWS = '.pb-page:not(.pb-editing) :is(.pb-cards, .pb-steps, .pb-offers, .pb-testis)';
/** Sections à plusieurs colonnes (hors « flush » : des colonnes de couleur décalées laisseraient des trous). */
const COLUMNS = '.pb-page:not(.pb-editing) .pb-grid:not(.pb-flush)';

/**
 * Retard à l'arrivée, par rang de colonne (0 = la première colonne ne bouge pas,
 * 1 = retard maximal). Les voisines n'arrivent donc pas ensemble, puis chacune
 * reprend sa place quand le bloc est entièrement affiché — comme sur la page
 * Phytomer (`data-scroll-speed` différent par colonne).
 */
const SPEEDS = [0.35, 1, 0.6, 0.85];

/**
 * Ligne guide : une onde verticale en fond de section, qui se trace vers le bas
 * au fil du défilement et s'achève sur une algue. Sections à fond clair
 * (blanc, gris clair, crème, sable) de toutes les pages du builder — ni les
 * fonds sombres ni l'accent, où le bleu clair disparaîtrait.
 */
const GUIDE = '.pb-page:not(.pb-editing) .pb-section:is(.pb-bg-transparent, .pb-bg-surface, .pb-bg-warm, .pb-bg-warm-strong)';
/** Hauteur minimale d'une section pour porter la ligne : en dessous, l'algue n'a pas la place. */
const GUIDE_MIN_HEIGHT = 420;
/** Où se trouve la « pointe » du tracé à l'écran, en fraction de la hauteur. */
const GUIDE_TIP = 0.75;
/** Doit rester égal au `bottom` du filet dans blocks.css : le filet s'arrête sur l'algue. */
const GUIDE_INSET = 58;

interface Group { root: HTMLElement; items: HTMLElement[]; speeds: number[]; amp: number }

/** Écart entre deux blocs qui entrent en même temps (ms). */
const STAGGER = 90;

export default function MotionLayer() {
  const pathname = usePathname();
  const isAdmin = !!pathname && pathname.startsWith('/admin');
  const lenisRef = useRef<{ scrollTo: (t: number, o?: { immediate?: boolean }) => void } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isAdmin || reduced) {
      root.classList.remove('pb-motion');
      return;
    }
    root.classList.add('pb-motion');
    (window as unknown as { __pbMotion?: boolean }).__pbMotion = true;

    let disposed = false;
    const cleanups: Array<() => void> = [];

    // ── 1. Défilement lissé ────────────────────────────────────────────────
    // Chargé à part : la couche de révélation ne doit pas attendre Lenis.
    import('lenis')
      .then(({ default: Lenis }) => {
        if (disposed) return;
        const lenis = new Lenis({
          lerp: 0.085,
          wheelMultiplier: 0.9,
          smoothWheel: true,
          anchors: true,
          // Menus et panneaux qui défilent eux-mêmes (navigation mobile, chat) gardent leur défilement natif.
          allowNestedScroll: true,
        });
        lenisRef.current = lenis;
        let raf = 0;
        const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        cleanups.push(() => { cancelAnimationFrame(raf); lenis.destroy(); lenisRef.current = null; });
      })
      .catch(() => { /* défilement natif : rien à faire */ });

    // ── 2. Révélations ─────────────────────────────────────────────────────
    const seen = new WeakSet<Element>();

    const io = new IntersectionObserver((entries) => {
      // Ceux qui entrent ensemble arrivent en cascade, dans l'ordre de lecture.
      const entering = entries.filter((e) => e.isIntersecting).sort((a, b) => {
        const ra = a.boundingClientRect, rb = b.boundingClientRect;
        return ra.top - rb.top || ra.left - rb.left;
      });
      entering.forEach((e, i) => {
        const el = e.target as HTMLElement;
        if (el.matches('.pb-section')) {
          el.classList.add('is-seen');
        } else {
          el.style.setProperty('--bd', `${i * STAGGER}ms`);
          el.classList.add('is-in');
        }
        io.unobserve(el);
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    // ── 3. Parallaxe ───────────────────────────────────────────────────────
    const parallax = new Set<HTMLElement>();
    let ticking = false;

    // Groupes de colonnes : le rang de chaque élément dépend de la mise en page
    // (3 cartes sur une ligne au bureau, une seule colonne sur mobile) — recalculé
    // au balayage et au redimensionnement.
    const groups = new Map<HTMLElement, Group>();
    const layoutGroup = (g: Group) => {
      const lefts = Array.from(new Set(g.items.map((el) => Math.round(el.offsetLeft)))).sort((a, b) => a - b);
      g.speeds = g.items.map((el) => (lefts.length < 2 ? 0 : SPEEDS[lefts.indexOf(Math.round(el.offsetLeft)) % SPEEDS.length]));
    };
    const addGroup = (root: HTMLElement, items: HTMLElement[], ampFactor: number) => {
      if (groups.has(root) || items.length < 2) return;
      const g: Group = { root, items, speeds: [], amp: ampFactor };
      layoutGroup(g);
      groups.set(root, g);
    };
    let relayout = false;

    const guides = new Set<HTMLElement>();
    const guideCandidates = new WeakSet<HTMLElement>();
    // Une section porte la ligne seulement si elle est assez haute ; sa hauteur change
    // (images qui chargent, largeur d'écran), d'où l'observateur.
    const guideRO = new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        if (el.offsetHeight >= GUIDE_MIN_HEIGHT) {
          guides.add(el);
          el.classList.add('pb-guide');
        } else {
          guides.delete(el);
          el.classList.remove('pb-guide', 'pb-guide-done');
        }
      });
      schedule();
    });

    const paint = () => {
      ticking = false;
      const vh = window.innerHeight;
      const amp = Math.min(140, window.innerWidth * 0.1);
      groups.forEach((g, root) => {
        if (!root.isConnected) { groups.delete(root); return; }
        if (relayout) layoutGroup(g);
        const box = root.getBoundingClientRect();
        if (box.bottom < -120 || box.top > vh + 120) return;
        // q : 1 quand le bloc affleure en bas de l'écran, 0 quand il est entièrement
        // affiché (ou, pour un bloc plus haut que 70 % de l'écran, après 70 % de
        // course) — et 0 ensuite, en sortie comme au repos.
        const q = Math.max(0, Math.min(1, (box.top - (vh - Math.min(box.height, vh * 0.7))) / Math.min(box.height, vh * 0.7)));
        g.items.forEach((el, i) => el.style.setProperty('--cy', `${(q * amp * g.amp * g.speeds[i]).toFixed(1)}px`));
      });
      relayout = false;
      guides.forEach((el) => {
        if (!el.isConnected) { guides.delete(el); return; }
        const box = el.getBoundingClientRect();
        if (box.bottom < -50 || box.top > vh + 50) return;
        const len = Math.max(1, box.height - GUIDE_INSET);
        const drawn = Math.max(0, Math.min(len, vh * GUIDE_TIP - box.top));
        el.style.setProperty('--gp', (drawn / len).toFixed(4));
        el.classList.toggle('pb-guide-done', drawn >= len - 1);
      });
      const reads: Array<[HTMLElement, number]> = [];
      parallax.forEach((el) => {
        if (!el.isConnected) { parallax.delete(el); return; }
        const box = (el.parentElement ?? el).getBoundingClientRect();
        if (box.bottom < -50 || box.top > vh + 50) return;
        const p = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2); // -1 … 1
        const amp = parseFloat(el.dataset.parallax || '') || 0.05;
        reads.push([el, Math.max(-1, Math.min(1, p)) * amp * box.height]);
      });
      reads.forEach(([el, y]) => el.style.setProperty('--py', `${y.toFixed(1)}px`));
      // Bas de page atteint : un bloc court collé au pied pourrait rester sous la
      // marge de l'observateur — on révèle ce qui reste.
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        document.querySelectorAll(`${BLOCK}:not(.is-in), ${ITEMS}:not(.is-in)`).forEach((el) => el.classList.add('is-in'));
      }
    };
    const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };

    // ── Balayage : les pages arrivent aussi par navigation, sans rechargement ─
    const scan = () => {
      document.querySelectorAll(`${BLOCK}, ${SECTION}, ${ITEMS}`).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
      document.querySelectorAll<HTMLElement>(PARALLAX).forEach((el) => parallax.add(el));
      document.querySelectorAll<HTMLElement>(ROWS).forEach((root) => addGroup(root, Array.from(root.children) as HTMLElement[], 1));
      document.querySelectorAll<HTMLElement>(COLUMNS).forEach((root) => {
        const cols = (Array.from(root.children) as HTMLElement[]).filter((c) => c.matches('.pb-col:not(.pb-col-bg):not(.pb-col-fill)'));
        addGroup(root, cols, 0.7);
      });
      document.querySelectorAll<HTMLElement>(GUIDE).forEach((el) => {
        if (guideCandidates.has(el)) return;
        guideCandidates.add(el);
        guideRO.observe(el);
      });
      schedule();
    };
    let scanQueued = false;
    const queueScan = () => { if (!scanQueued) { scanQueued = true; requestAnimationFrame(() => { scanQueued = false; scan(); }); } };

    const mo = new MutationObserver(queueScan);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, { passive: true });
    const onResize = () => { relayout = true; schedule(); };
    window.addEventListener('resize', onResize);
    scan();

    // Page trop courte pour défiler : ce qui est dans l'écran mais sous la marge
    // de l'observateur se révèle quand même.
    const settle = window.setTimeout(() => {
      document.querySelectorAll(`${BLOCK}:not(.is-in), ${ITEMS}:not(.is-in)`).forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      });
    }, 1800);
    cleanups.push(() => window.clearTimeout(settle));

    cleanups.push(() => {
      guides.forEach((el) => el.classList.remove('pb-guide', 'pb-guide-done'));
      guideRO.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', onResize);
    });

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, [isAdmin]);

  // Nouvelle page : on repart du haut, sans que l'inertie ne ramène à l'ancienne position.
  useEffect(() => {
    if (!window.location.hash) lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return null;
}
