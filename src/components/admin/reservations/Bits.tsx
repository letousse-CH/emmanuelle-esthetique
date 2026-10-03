"use client";

import React from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import type { Booking, BookingStatus } from '../../../types/booking';
import { STATUT_LABEL } from '../../../types/booking';
import { STATUS_STYLE, telHref, waHref } from './lib';

export function StatusPill({ statut }: { statut: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold ${STATUS_STYLE[statut]}`}
    >
      {STATUT_LABEL[statut]}
    </span>
  );
}

/** « Nouvelle cliente » ou « Cliente connue (3 visites) ». */
export function ClientBadge({ clientId, visites }: { clientId: string | null; visites: number }) {
  if (!clientId) {
    return (
      <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-2.5 py-0.5 text-[12.5px] font-medium text-stone-700">
        Pas encore dans la clientèle
      </span>
    );
  }
  if (visites > 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-emerald-900">
        Cliente connue ({visites} visite{visites > 1 ? 's' : ''})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[12.5px] font-semibold text-sky-900">
      Nouvelle cliente
    </span>
  );
}

const BIG_BTN =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

/** Gros boutons Appeler (tel:) et WhatsApp. */
export function ContactButtons({
  booking,
  whatsappMessage,
  className = '',
}: {
  booking: Pick<Booking, 'telephone' | 'prenom'>;
  whatsappMessage: string;
  className?: string;
}) {
  const wa = waHref(booking.telephone, whatsappMessage);
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a
        href={telHref(booking.telephone)}
        className={`${BIG_BTN} flex-1 bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:ring-emerald-600 sm:min-w-[10rem] sm:flex-none`}
        aria-label={`Appeler ${booking.prenom} au ${booking.telephone}`}
      >
        <Phone size={18} /> Appeler
        <span className="hidden font-normal sm:inline">· {booking.telephone}</span>
      </a>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BIG_BTN} flex-1 border border-emerald-700 bg-white text-emerald-900 hover:bg-emerald-50 focus-visible:ring-emerald-600 sm:flex-none`}
          aria-label={`Écrire à ${booking.prenom} sur WhatsApp`}
        >
          <MessageCircle size={18} /> WhatsApp
        </a>
      ) : null}
    </div>
  );
}

/** « Soin principal + options » sur une ligne lisible. */
export function ServiceSummary({ booking }: { booking: Pick<Booking, 'service_nom' | 'options'> }) {
  const opts = booking.options ?? [];
  return (
    <span>
      <span className="font-semibold text-stone-950">{booking.service_nom}</span>
      {opts.length > 0 && (
        <span className="text-stone-700">
          {' '}
          + {opts.map((o) => o.nom).join(', ')}
        </span>
      )}
    </span>
  );
}
