"use client";

import { useEffect } from 'react';

/**
 * Sous `lg`, les tableaux de l'admin deviennent des listes de cartes (voir
 * admin.css). Ce composant recopie l'en-tête de chaque colonne dans l'attribut
 * `data-label` des cellules pour que la carte affiche « Libellé : valeur ».
 * Il suit les tableaux rendus après coup (chargement asynchrone).
 */
export default function TableStacker() {
  useEffect(() => {
    const root = document.getElementById('admin-main-content');
    if (!root) return;
    let queued = false;
    const annotate = () => {
      queued = false;
      root.querySelectorAll<HTMLTableElement>('table').forEach((t) => {
        const heads = Array.from(t.querySelectorAll('thead th')).map((h) => (h.textContent ?? '').trim());
        if (heads.length === 0) return;
        t.querySelectorAll('tbody tr').forEach((tr) => {
          let col = 0;
          Array.from(tr.children).forEach((td) => {
            const el = td as HTMLElement;
            const label = heads[col] ?? '';
            if (label && el.getAttribute('data-label') !== label) el.setAttribute('data-label', label);
            col += (el as HTMLTableCellElement).colSpan || 1;
          });
        });
        t.setAttribute('data-stack', '');
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(annotate);
    };
    annotate();
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
