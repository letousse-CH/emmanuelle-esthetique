"use client";

import React from 'react';
import Link from 'next/link';
import { Check, MessageCircle, Phone, Info } from 'lucide-react';
import { PERIODE_LABEL, type PublicBookingView } from '../../../types/booking';
import { formatDateLong } from './dates';
import { chf } from './format';

interface ConfirmationStepProps {
  booking: PublicBookingView;
  prenom: string;
  businessPhone?: string;
  /** Total affiché à la cliente avant l'envoi, pour signaler un écart avec celui du serveur. */
  estimatedTotal: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

/**
 * Écran final. Il dit la vérité : la demande est ENREGISTRÉE, elle n'est pas
 * CONFIRMÉE — c'est Emmanuelle qui fixe l'horaire exact au téléphone. D'où
 * l'absence de fichier .ics : une demande non confirmée n'a rien à faire dans
 * un agenda.
 */
export default function ConfirmationStep({
  booking,
  prenom,
  businessPhone,
  estimatedTotal,
  headingRef,
}: ConfirmationStepProps) {
  const dateLong = formatDateLong(booking.date_rdv);
  const periode = PERIODE_LABEL[booking.periode] ?? booking.periode;
  const phoneDigits = businessPhone ? businessPhone.replace(/[^\d+]/g, '') : '';
  const totalDiffers = Math.abs((Number(booking.total_chf) || 0) - estimatedTotal) > 0.009;

  return (
    <div className="space-y-8 animate-fadein">
      <div
        data-surface
        className="bg-surface rounded-[var(--radius-base,1.5rem)] p-6 sm:p-10 border border-sage/30 shadow-md text-center space-y-6"
      >
        <div
          className="w-16 h-16 rounded-full bg-sage/10 border border-sage/30 text-sage flex items-center justify-center mx-auto shadow-inner"
          aria-hidden="true"
        >
          <Check className="w-8 h-8 stroke-[2.5]" />
        </div>

        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-sage">Demande enregistrée</span>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl sm:text-3xl font-serif text-stone-deep font-normal focus:outline-none"
          >
            Merci {prenom}, votre demande est bien reçue.
          </h2>
          <p className="text-stone-deep text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            <strong className="font-semibold">Ce n&apos;est pas encore une confirmation.</strong>{' '}
            Emmanuelle vous
            appelle (ou vous écrit) pour confirmer l&apos;horaire exact de votre rendez-vous.
          </p>
        </div>

        {/* Détail de la demande */}
        <div className="bg-paper rounded-[var(--radius-base,1rem)] p-5 sm:p-6 max-w-lg mx-auto text-left border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs text-muted">Référence de la demande</span>
            <span className="text-xs font-mono font-semibold text-stone-deep">
              {booking.id?.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted font-medium">Soin demandé</div>
            <div className="text-base font-serif font-bold text-stone-deep">{booking.service_nom}</div>
            {booking.options?.length > 0 && (
              <ul className="text-xs text-muted space-y-0.5">
                {booking.options.map((o, i) => (
                  <li key={`${o.nom}-${i}`}>
                    + {o.nom}
                    {o.prix_chf > 0 ? ` (${chf(o.prix_chf)})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
            <div>
              <span className="text-xs text-muted block">Jour et période demandés</span>
              <span className="text-sm font-semibold text-stone-deep capitalize block">{dateLong}</span>
              <span className="text-sm font-semibold text-sage block">{periode}</span>
              <span className="text-[11px] text-muted block font-light mt-0.5">Horaire exact à convenir avec Emmanuelle</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Durée prévue</span>
              <span className="text-sm font-semibold text-stone-deep">{booking.service_duree_minutes} minutes</span>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Total, à régler sur place</span>
            <span className="text-xl font-serif font-bold text-sage">{chf(booking.total_chf)}</span>
          </div>

          {totalDiffers && (
            <p className="text-xs text-stone-deep bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2" role="note">
              <Info className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
              <span>
                Le total enregistré ({chf(booking.total_chf)}) diffère de l&apos;estimation affichée pendant la
                réservation ({chf(estimatedTotal)}). Emmanuelle vous confirmera le tarif exact au téléphone.
              </span>
            </p>
          )}
        </div>

        <p className="text-xs text-muted max-w-md mx-auto font-light leading-relaxed">
          Aucun paiement n&apos;est demandé en ligne. Si vous ne recevez pas d&apos;appel d&apos;ici un jour ouvré, ou si
          vous devez modifier votre demande, contactez directement l&apos;institut.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              data-btn="secondary"
              className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              Appeler l&apos;institut{businessPhone ? ` · ${businessPhone}` : ''}
            </a>
          )}

          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Bonjour Emmanuelle, je viens de faire une demande de rendez-vous en ligne pour le soin ${booking.service_nom}, le ${dateLong} (${periode.toLowerCase()}).`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              data-btn="primary"
              className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Écrire sur WhatsApp
              <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
            </a>
          )}

          <Link
            href="/"
            data-btn="ghost"
            className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-semibold transition-all"
          >
            Retourner à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
