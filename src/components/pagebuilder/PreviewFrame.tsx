'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Aperçu à une largeur d'écran donnée.
 *
 * Le constructeur se contentait d'appliquer un `max-width` à une div : la page
 * rétrécissait, mais les points de rupture de Tailwind (`md:`, `lg:`) lisent la
 * largeur de la **fenêtre**, pas celle du conteneur. Choisir « mobile » donnait
 * donc une mise en page de bureau comprimée dans 390 pixels — exactement ce
 * qu'on cherchait à vérifier, et exactement ce qu'on ne voyait pas.
 *
 * Un iframe rétablit une vraie fenêtre : les media queries s'y évaluent pour de
 * bon. Le contenu React est projeté dedans, et les feuilles de style du
 * document parent y sont recopiées — puis tenues à jour, sinon le
 * rechargement à chaud du serveur de développement laisserait l'aperçu sans
 * styles.
 */
export default function PreviewFrame({
  width,
  children,
  onClickCapture,
  onDocument,
}: {
  width: number;
  children: React.ReactNode;
  /** Clic intercepté dans le document de l'aperçu (sélection d'une section). */
  onClickCapture?: (event: MouseEvent) => void;
  /** Donne accès au document de l'aperçu — pour y faire défiler une section. */
  onDocument?: (doc: Document | null) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // Le gestionnaire passe par une référence : le document de l'aperçu n'est
  // construit qu'une fois, on ne veut pas le reconstruire à chaque rendu du
  // parent juste parce que la fonction a changé d'identité.
  const handlerRef = useRef(onClickCapture);
  handlerRef.current = onClickCapture;
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;

    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
    doc.close();

    const syncStyles = () => {
      const head = doc.head;
      if (!head) return;
      head.querySelectorAll('[data-copie-apercu]').forEach((node) => node.remove());
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute('data-copie-apercu', 'true');
        head.appendChild(clone);
      });
    };
    syncStyles();

    // Le serveur de développement injecte de nouvelles feuilles à chaque
    // recompilation : sans observation, l'aperçu se retrouverait dépouillé.
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true });

    const mount = doc.createElement('div');
    mount.setAttribute('data-site-theme', '');
    doc.body.style.margin = '0';
    doc.body.appendChild(mount);
    setRoot(mount);
    onDocument?.(doc);

    // Hauteur ajustée au contenu : un iframe ne grandit pas tout seul.
    const resize = () => setHeight(Math.max(400, doc.body.scrollHeight));
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(doc.body);
    const interval = window.setInterval(resize, 500);

    const clickHandler = (event: MouseEvent) => handlerRef.current?.(event);
    doc.addEventListener('click', clickHandler, true);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.clearInterval(interval);
      doc.removeEventListener('click', clickHandler, true);
      onDocument?.(null);
    };
    /*
      Le document n'est bâti qu'une fois. Le reconstruire à chaque changement de
      largeur détachait le nœud dans lequel React projetait la page : l'iframe
      passait bien à 820 px, mais on continuait de mesurer l'ancien document
      resté à 390. Un iframe se remet en page tout seul quand sa taille change —
      il n'y a rien à refaire.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Aperçu de la page"
      style={{ width, height }}
      className="mx-auto block border-0 bg-white shadow-sm transition-all duration-300"
    >
      {root && createPortal(children, root)}
    </iframe>
  );
}
