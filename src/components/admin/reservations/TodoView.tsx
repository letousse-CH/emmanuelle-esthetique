"use client";

import React, { useMemo } from 'react';
import { CalendarDays, CheckCircle2, Clock, PhoneCall } from 'lucide-react';
import type { Booking } from '../../../types/booking';
import { PERIODE_LABEL, bookingTotal, formatCHF } from '../../../types/booking';
import { Button, EmptyState } from '../ui';
import { ClientBadge, ContactButtons, ServiceSummary } from './Bits';
import {
  ageInDays,
  cap,
  formatDateLong,
  formatDuration,
  formatInstant,
  fullName,
  relativeAgo,
  requestedDate,
  requestedPeriode,
} from './lib';

/**
 * File des demandes à rappeler : la plus ancienne en premier, pour qu'aucune
 * cliente n'attende plus longtemps qu'une autre.
 */
export default function TodoView({
  bookings,
  visitsByClient,
  coupure,
  onOpen,
}: {
  bookings: Booking[];
  visitsByClient: Map<string, number>;
  coupure: string;
  onOpen: (id: string) => void;
}) {
  const queue = useMemo(
    () =>
      bookings
        .filter((b) => b.statut === 'en_attente')
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    [bookings],
  );

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Aucune demande à traiter"
        description="Toutes les demandes ont été rappelées. Les nouvelles demandes en ligne apparaîtront ici."
      />
    );
  }

  return (
    <ul className="space-y-4" aria-label="Demandes à traiter, de la plus ancienne à la plus récente">
      {queue.map((b, index) => {
        const dem = requestedDate(b);
        const per = requestedPeriode(b, coupure);
        const total = b.total_chf ?? bookingTotal(b);
        const old = ageInDays(b.created_at) >= 1;
        const message =
          `Bonjour ${b.prenom}, c’est Emmanuelle de l’institut. ` +
          `Je reviens vers vous au sujet de votre demande de rendez-vous pour « ${b.service_nom} » ` +
          `le ${formatDateLong(dem)} (${PERIODE_LABEL[per].toLowerCase()}). ` +
          `Quand pouvons-nous en parler ?`;
        return (
          <li key={b.id} className="rounded-2xl border border-stone-300 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-stone-700">
                <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-stone-900 text-[12px] text-white">
                  {index + 1}
                </span>
                <span className={old ? 'text-amber-800' : ''} title={`Reçue le ${formatInstant(b.created_at)}`}>
                  Demande reçue {relativeAgo(b.created_at)}
                </span>
              </p>
              <ClientBadge clientId={b.client_id} visites={b.client_id ? (visitsByClient.get(b.client_id) ?? 0) : 0} />
            </div>

            <h3 className="mt-3 text-[20px] font-semibold leading-tight text-stone-950">{fullName(b)}</h3>
            <p className="text-[14px] text-stone-700">{b.telephone}</p>

            <dl className="mt-3 space-y-2 text-[15px] text-stone-800">
              <div className="flex items-start gap-2.5">
                <CalendarDays size={18} className="mt-0.5 shrink-0 text-stone-600" aria-hidden="true" />
                <div>
                  <dt className="sr-only">Date demandée</dt>
                  <dd>
                    <span className="font-semibold text-stone-950">{cap(formatDateLong(dem))}</span> ·{' '}
                    <span className="font-semibold">{PERIODE_LABEL[per]}</span>
                    {b.date_rdv !== dem && (
                      <span className="block text-[13px] text-stone-600">
                        Déplacée au {formatDateLong(b.date_rdv)}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock size={18} className="mt-0.5 shrink-0 text-stone-600" aria-hidden="true" />
                <div>
                  <dt className="sr-only">Soins demandés</dt>
                  <dd>
                    <ServiceSummary booking={b} />
                    <span className="block text-[14px] text-stone-700">
                      {formatDuration(b.service_duree_minutes)} · <strong>{formatCHF(total)}</strong>
                    </span>
                  </dd>
                </div>
              </div>
            </dl>

            {b.notes_cliente && (
              <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-[14px] italic text-stone-700">
                « {b.notes_cliente} »
              </p>
            )}

            <ContactButtons booking={b} whatsappMessage={message} className="mt-4" />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {b.contacte_at ? (
                <p className="flex items-center gap-1.5 text-[14px] font-medium text-emerald-800">
                  <PhoneCall size={15} aria-hidden="true" /> Appelée {relativeAgo(b.contacte_at)}
                </p>
              ) : (
                <span />
              )}
              <Button variant="primary" className="h-12 w-full px-6 text-[16px] sm:w-auto" onClick={() => onOpen(b.id)}>
                Traiter la demande
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
