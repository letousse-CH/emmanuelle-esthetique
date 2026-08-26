"use client";

import { useEffect } from 'react';

export default function ScrollAnimations() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // ── 1. Cursor glow (desktop only) ──────────────────────────────────────
    if (!isTouchDevice && !reduced) {
      const glow = document.createElement('div');
      glow.id = 'sde-cursor-glow';
      document.body.appendChild(glow);

      let mx = window.innerWidth / 2;
      let my = window.innerHeight / 2;
      let cx = mx, cy = my;
      let raf: number;

      const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
      document.addEventListener('mousemove', onMove);

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const tick = () => {
        cx = lerp(cx, mx, 0.075);
        cy = lerp(cy, my, 0.075);
        glow.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`;
        raf = requestAnimationFrame(tick);
      };
      tick();

      // Pulse on hovering interactive elements
      const onEnter = () => glow.classList.add('sde-cursor-active');
      const onLeave = () => glow.classList.remove('sde-cursor-active');
      const hoverCleanups: (() => void)[] = [];
      document.querySelectorAll('a, button, [role="button"]').forEach(el => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
        hoverCleanups.push(() => {
          el.removeEventListener('mouseenter', onEnter);
          el.removeEventListener('mouseleave', onLeave);
        });
      });

      // Cleanup stored on element for return
      (glow as any)._cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        cancelAnimationFrame(raf);
        hoverCleanups.forEach(fn => fn());
        glow.remove();
      };
    }

    // ── 2. Scroll reveal ───────────────────────────────────────────────────
    if (reduced) return;

    const seen = new WeakSet<Element>();
    const vw = window.innerWidth;

    const getDirection = (el: Element): 'up' | 'left' | 'right' | 'scale' => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const fraction = cx / vw;
      if (rect.width > vw * 0.65) return 'up';
      if (fraction < 0.38) return 'left';
      if (fraction > 0.62) return 'right';
      return 'up';
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.07, rootMargin: '0px 0px -48px 0px' }
    );

    const mark = (el: Element, delay = 0, forceType?: string) => {
      if (seen.has(el)) return;
      if (el.closest('nav, footer, [data-admin], [data-admin-panel]')) return;
      if ((el as HTMLElement).className?.toString?.().includes('hero-')) return;
      if (el.hasAttribute('data-no-reveal')) return;

      seen.add(el);
      const type = forceType ?? getDirection(el);
      el.setAttribute('data-reveal', type);
      if (delay > 0) {
        (el as HTMLElement).style.setProperty('--reveal-delay', `${delay}ms`);
      }
      observer.observe(el);
    };

    // Grid items with stagger
    document.querySelectorAll('main [class*="grid-cols"]').forEach((grid) => {
      Array.from(grid.children).forEach((child, i) => mark(child, i * 90));
    });

    // Direct children of section wrappers
    document.querySelectorAll('main section > div > *').forEach((el) => mark(el));

    // Images
    document.querySelectorAll('main section img').forEach((el) => mark(el, 0, 'scale'));

    // Standalone headings
    document.querySelectorAll('main section h1, main section h2, main section h3').forEach((el) => mark(el));

    // ── 3. Card 3D tilt ────────────────────────────────────────────────────
    const cards = document.querySelectorAll<HTMLElement>('main section .rounded-3xl.border');
    const cardCleanups: (() => void)[] = [];

    cards.forEach((card) => {
      const onMove = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(700px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg) translateY(-5px) scale(1.01)`;
      };
      const onLeave = () => { card.style.transform = ''; };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      cardCleanups.push(() => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
      });
    });

    // ── 4. Number counter ──────────────────────────────────────────────────
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const raw = el.getAttribute('data-count-to') ?? '';
        const target = parseFloat(raw);
        if (isNaN(target)) return;

        const suffix = el.getAttribute('data-count-suffix') ?? '';
        const duration = 1600;
        const start = performance.now();

        const step = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const val = target * easeOut(p);
          el.textContent = (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        countObserver.unobserve(el);
      });
    }, { threshold: 0.5 });

    // Detect and prepare numeric elements (standalone large text)
    document.querySelectorAll<HTMLElement>('main section *').forEach((el) => {
      if (el.children.length > 0) return;
      const text = el.textContent?.trim() ?? '';
      const match = text.match(/^(\d+(?:[.,]\d+)?)(\s*[%+a-zA-Z\/° CHF]*)$/);
      if (!match) return;
      const classes = el.className?.toString() ?? '';
      if (!classes.match(/text-(4xl|5xl|6xl|7xl|8xl|3xl)/)) return;

      const num = parseFloat(match[1].replace(',', '.'));
      const suffix = match[2];
      el.setAttribute('data-count-to', String(num));
      el.setAttribute('data-count-suffix', suffix);
      el.textContent = '0' + suffix;
      countObserver.observe(el);
    });

    return () => {
      observer.disconnect();
      countObserver.disconnect();
      cardCleanups.forEach((fn) => fn());
      const glowEl = document.getElementById('sde-cursor-glow');
      if ((glowEl as any)?._cleanup) (glowEl as any)._cleanup();
    };
  }, []);

  return null;
}
