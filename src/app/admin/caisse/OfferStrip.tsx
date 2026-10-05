"use client";

import React from 'react';
import { BadgePercent } from 'lucide-react';
import type { Offer, OfferStats } from '../../../types/offers';
import { EMPTY_STATS, daysLeft, placesPrises, placesRestantes } from '../../../types/offers';
import { formatCHF } from '../../../types/caisse';

/**
 * Offres du moment en tête du catalogue de caisse, pendant leur période.
 *
 * Une offre complète reste encaissable : les clientes qui ont réservé une des
 * places doivent pouvoir être facturées. La tuile le signale, sans bloquer —
 * même logique que le stock à zéro.
 */
export default function OfferStrip({ offers, stats, inCart, today, onPick, mobile = false }: {
  offers: Offer[];
  stats: Map<string, OfferStats>;
  /** Quantité de chaque offre déjà dans le panier. */
  inCart: Map<string, number>;
  today: string;
  onPick: (o: Offer) => void;
  mobile?: boolean;
}) {
  if (offers.length === 0) return null;
  return (
    <div className={mobile ? 'space-y-2.5' : 'space-y-2'}>
      <p className={`flex items-center gap-1.5 font-semibold text-accent ${mobile ? 'text-[15px]' : 'text-[13px]'}`}>
        <BadgePercent size={mobile ? 17 : 14} aria-hidden="true" />
        Offre{offers.length > 1 ? 's' : ''} du moment
      </p>
      <div className={mobile ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'}>
        {offers.map((o) => {
          const s = stats.get(o.id) ?? { offer_id: o.id, ...EMPTY_STATS };
          const q = inCart.get(o.id) ?? 0;
          // Places affichées APRÈS la vente en cours, comme le stock des produits.
          const restantes = placesRestantes(o, s);
          const apres = restantes == null ? null : restantes - q;
          const complete = apres != null && apres <= 0;
          const jours = daysLeft(o.date_fin, today);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o)}
              className={`relative flex items-stretch gap-3 overflow-hidden rounded-xl border text-left transition-all cursor-pointer ${
                q > 0 ? 'border-accent bg-accent/8' : 'border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/8'
              } ${mobile ? 'min-h-[92px] rounded-2xl active:scale-[0.98]' : ''}`}
            >
              {o.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.image_url} alt="" className={`shrink-0 object-cover ${mobile ? 'w-28' : 'w-24'} aspect-video self-center rounded-lg ml-2.5`} />
              )}
              <span className={`flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-3 ${o.image_url ? 'pr-3' : 'px-3.5'}`}>
                <span className={`block font-semibold leading-snug text-stone-950 line-clamp-2 ${mobile ? 'text-[15px] pr-7' : 'text-sm pr-6'}`}>
                  {o.titre}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`font-semibold tabular-nums text-stone-900 ${mobile ? 'text-[16px]' : 'text-[13px]'}`}>
                    {formatCHF(o.prix_chf)}
                  </span>
                  {o.prix_normal_chf != null && (
                    <span className="text-[12px] text-stone-500 line-through tabular-nums">{formatCHF(o.prix_normal_chf)}</span>
                  )}
                  {o.places_max != null && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[12px] font-semibold tabular-nums ${
                        complete ? 'bg-amber-100 text-amber-900' : 'bg-white/80 text-stone-700'
                      }`}
                      title={complete ? 'Toutes les places sont prises — l’encaissement reste possible' : 'Places prises sur le total'}
                    >
                      {complete ? 'Complet · ' : ''}{placesPrises(s) + q}/{o.places_max}
                    </span>
                  )}
                  <span className="text-[12px] text-stone-600">
                    {jours <= 0 ? 'Dernier jour' : `Encore ${jours + 1} j`}
                  </span>
                </span>
              </span>
              {q > 0 && (
                <span aria-label={`${q} dans le panier`} className="absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[13px] font-bold text-accent-fg">{q}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
