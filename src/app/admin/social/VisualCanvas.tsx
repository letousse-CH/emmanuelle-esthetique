"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { SocialVisual } from '../../../types/social';
import { loadVisualAssets, renderVisual, VISUAL_SIZE, type VisualAssets, type VisualBrand } from '../../../utils/socialVisual';
import { sessionToken } from './api';

/** Aperçu du visuel, dessiné par le même code que le JPEG publié. */
export default function VisualCanvas({ visual, brand, className = '' }: { visual: SocialVisual; brand: VisualBrand; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<VisualAssets | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setAssets(null);
    sessionToken()
      .then((token) => loadVisualAssets(visual, brand, token))
      .then((a) => {
        if (!alive) return;
        setPhotoFailed(Boolean(visual.photo_url && !a.photo));
        setAssets(a);
      });
    return () => { alive = false; };
  }, [visual.photo_url, brand]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!assets || !canvas.current) return;
    const id = requestAnimationFrame(() => canvas.current && renderVisual(canvas.current, visual, brand, assets));
    return () => cancelAnimationFrame(id);
  }, [assets, visual, brand]);

  const { w, h } = VISUAL_SIZE[visual.format];
  return (
    <div className={`relative w-full bg-stone-100 ${className}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <canvas ref={canvas} width={w} height={h} className="absolute inset-0 h-full w-full" aria-label={`Visuel : ${visual.headline}`} role="img" />
      {!assets && (
        <div className="absolute inset-0 grid place-items-center text-stone-600">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
      {photoFailed && (
        <p className="absolute inset-x-3 top-3 rounded bg-white/90 px-3 py-2 text-[12.5px] text-red-700">
          La photo n’a pas pu être chargée : choisissez-en une autre.
        </p>
      )}
    </div>
  );
}
