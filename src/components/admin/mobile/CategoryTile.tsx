"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';

/**
 * Photos de la médiathèque (table `media_assets`, lecture publique) pour illustrer
 * les grosses tuiles de l'application mobile. On cherche une image dont le nom
 * contient un mot-clé lié à la catégorie ; sans correspondance, la tuile reste
 * sans photo (jamais d'image cassée).
 */
type Asset = { file_name: string; url: string; alt_text: string | null };

let cache: Promise<Asset[]> | null = null;
function loadAssets(): Promise<Asset[]> {
  cache ??= Promise.resolve(
    supabase.from('media_assets').select('file_name,url,alt_text').order('created_at', { ascending: false }).limit(200),
  ).then(({ data }) => (data as Asset[] | null) ?? []).catch(() => []);
  return cache;
}

/** Mots-clés (sans accent, minuscules) cherchés dans le nom du fichier, par thème. */
const THEMES: { match: RegExp; files: string[] }[] = [
  { match: /visage|facial|eclat|anti-age|jeunesse/, files: ['1790587791640', 'soins-visages'] },
  { match: /corps|massage|rituel|minceur/, files: ['1790587819698', 'soins-corps'] },
  { match: /epilation|cire|sucre/, files: ['epilation (1)', 'epilation'] },
  { match: /regard|cil|sourcil|maquillage/, files: ['1790587847303', 'portrait (1)'] },
  { match: /main|pied|beaute des/, files: ['textures-cremes', 'compose-marin'] },
  { match: /produit|creme|soin maison/, files: ['creme de soin', 'textures-cremes (1)'] },
  { match: /bon|cadeau/, files: ['algues-marines'] },
  { match: /divers|autre|forfait/, files: ['algues-marines', 'le-mont-saint-michel'] },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function pickPhoto(label: string, assets: Asset[]): string | null {
  const theme = THEMES.find(t => t.match.test(norm(label)));
  if (!theme) return null;
  for (const f of theme.files) {
    const a = assets.find(x => norm(x.file_name).includes(f) || norm(x.url).includes(f.replace(/ /g, '-')));
    if (a) return a.url;
  }
  return null;
}

export function useMediaAssets(): Asset[] {
  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    let live = true;
    loadAssets().then(a => { if (live) setAssets(a); });
    return () => { live = false; };
  }, []);
  return assets;
}

/** Grosse tuile : photo de fond sous un dégradé sombre, libellé en blanc. */
export function CategoryTile({ label, sub, photo, icon, onClick, className = '' }: {
  label: string;
  sub?: string;
  photo?: string | null;
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ background: '#292524' }}
      className={`relative flex min-h-[132px] flex-col items-start justify-end gap-0.5 overflow-hidden rounded-2xl border border-stone-200 p-3.5 text-left shadow-[0_1px_2px_rgba(28,25,23,0.06)] cursor-pointer transition-transform duration-150 active:scale-[0.97] ${className}`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-accent, #6b8f71), #292524)' }} />
      )}
      <span className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.25) 60%, rgba(0,0,0,0))' }} />
      {icon && <span className="absolute right-3 top-3 text-white/90">{icon}</span>}
      <span className="relative text-[18px] font-semibold leading-tight text-white drop-shadow">{label}</span>
      {sub && <span className="relative text-[13px]" style={{ color: 'rgba(255,255,255,.88)' }}>{sub}</span>}
    </button>
  );
}
