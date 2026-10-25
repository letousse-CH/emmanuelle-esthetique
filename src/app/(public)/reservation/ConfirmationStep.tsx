"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Gift, MessageCircle, Phone, Info } from 'lucide-react';
import { PERIODE_LABEL, type PublicBookingView } from '../../../types/booking';
import { optimizedImgProps } from '../../../utils/imageOptim';
import { formatDateLong, formatHeure } from './dates';
import { chf } from './format';
import { addMinutes, formatDuree } from './seance';

interface ConfirmationStepProps {
  booking: PublicBookingView;
  prenom: string;
  businessPhone?: string;
  ownerFirstName?: string;
  /** Total affiché à la cliente avant l'envoi, pour signaler un écart avec celui du serveur. */
  estimatedTotal: number;
  /** Photo de l'univers du soin principal. */
  image?: { url: string; alt: string } | null;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

/**
 * Écran final. Il dit la vérité : la demande est ENREGISTRÉE et son horaire
 * réservé, mais elle n'est pas CONFIRMÉE — c'est Emmanuelle qui la confirme.
 * D'où l'absence de fichier .ics : une demande non confirmée n'a rien à faire
 * dans un agenda.
 */
export default function ConfirmationStep({
  booking,
  prenom,
  businessPhone,
  ownerFirstName,
  estimatedTotal,
  image,
  headingRef,
}: ConfirmationStepProps) {
  const owner = ownerFirstName || 'Emmanuelle';
  const dateLong = formatDateLong(booking.date_rdv);
  const periode = PERIODE_LABEL[booking.periode] ?? booking.periode;
  const debut = booking.heure_rdv ?? null;
  const fin = debut ? addMinutes(debut, Number(booking.service_duree_minutes) || 0) : null;
  const quand = debut ? `${formatHeure(debut)} à ${formatHeure(fin)}` : periode;
  const phoneDigits = businessPhone ? businessPhone.replace(/[^\d+]/g, '') : '';
  const totalDiffers = Math.abs((Number(booking.total_chf) || 0) - estimatedTotal) > 0.009;

  return (
    <div className="rsv-done animate-fadein">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/algue.svg" alt="" aria-hidden="true" className="rsv-done__mark" />
        <div className="rsv-eyebrow">Demande enregistrée</div>
        <h2 ref={headingRef} tabIndex={-1} className="rsv-h2" style={{ marginTop: 16, outline: 'none' }}>
          Merci {prenom}, votre demande est bien reçue.
        </h2>
        <div className="rsv-done__text">
          <strong>Ce n&apos;est pas encore une confirmation.</strong>{' '}
          {debut
            ? `Votre horaire vous est réservé ; ${owner} vous recontacte pour confirmer votre rendez-vous.`
            : `${owner} vous appelle (ou vous écrit) pour confirmer l’horaire exact de votre rendez-vous.`}{' '}
          Aucun paiement n&apos;est demandé en ligne.
        </div>

        <div className="rsv-done__recap">
          <div className="rsv-done__row">
            <div className="rsv-done__k">{booking.options?.length ? 'Vos soins' : 'Votre soin'}</div>
            <div className="rsv-done__v">
              <span className="rsv-serif" style={{ fontSize: 18 }}>
                {booking.service_nom}
              </span>
              {booking.options?.map((o, i) => (
                <div key={`${o.nom}-${i}`} className="rsv-muted" style={{ fontSize: 14 }}>
                  + {o.nom}
                  {o.prix_chf > 0 ? ` (${chf(o.prix_chf)})` : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="rsv-done__row">
            <div className="rsv-done__k">{debut ? 'Jour et heure demandés' : 'Jour et période demandés'}</div>
            <div className="rsv-done__v">
              {dateLong}, {quand}
              <div className="rsv-muted" style={{ fontSize: 13 }}>
                Durée prévue : {formatDuree(Number(booking.service_duree_minutes) || 0)} · à confirmer par {owner}
              </div>
            </div>
          </div>
          <div className="rsv-done__row">
            <div className="rsv-done__total">
              <span className="rsv-done__k">Total, à régler sur place</span>
              <span className="rsv-serif">{chf(booking.total_chf)}</span>
            </div>
            <div className="rsv-muted" style={{ fontSize: 12.5 }}>
              Référence {booking.id?.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        {totalDiffers && (
          <div className="rsv-notice rsv-notice--info" role="note" style={{ marginTop: 16 }}>
            <Info aria-hidden="true" />
            <span>
              Le total enregistré ({chf(booking.total_chf)}) diffère de l&apos;estimation affichée pendant la
              réservation ({chf(estimatedTotal)}). {owner} vous confirmera le tarif exact.
            </span>
          </div>
        )}

        <div className="rsv-done__text rsv-muted" style={{ fontSize: 14 }}>
          Sans nouvelles d&apos;ici un jour ouvré, ou pour modifier votre demande, contactez directement l&apos;institut.
        </div>

        <div className="rsv-done__actions">
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Bonjour ${owner}, je viens de faire une demande de rendez-vous en ligne pour le soin ${booking.service_nom}, le ${dateLong} (${debut ? `à ${formatHeure(debut)}` : periode.toLowerCase()}).`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              data-btn="primary"
            >
              <MessageCircle aria-hidden="true" />
              Écrire sur WhatsApp
              <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
            </a>
          )}
          {phoneDigits && (
            <a href={`tel:${phoneDigits}`} data-btn="secondary">
              <Phone aria-hidden="true" />
              {businessPhone}
            </a>
          )}
          <Link href="/" data-btn="ghost">
            Retour à l&apos;accueil
          </Link>
        </div>

        {/* Le moment où l'on pense aux autres : offrir le même soin. */}
        <Link href={`/bon-cadeau?soin=${encodeURIComponent(booking.service_nom)}`} className="rsv-gift">
          <Gift aria-hidden="true" />
          <span>
            <strong>Ce soin ferait plaisir à quelqu&apos;un ?</strong> Offrez-le en bon cadeau, avec votre petit mot.
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      {image && (
        <div className="rsv-done__img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...optimizedImgProps(image.url, '380px', [384, 828])} alt={image.alt} />
        </div>
      )}
    </div>
  );
}
