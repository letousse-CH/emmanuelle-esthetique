"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { CalendarDays, Clock, MapPin, ArrowRight } from 'lucide-react';
import { proxyUrl } from '../../utils/media';
import { fetchUpcomingEvents } from '../../services/events';
import { SdeEvent, CATEGORY_LABELS, CATEGORY_COLORS } from '../../types/events';
import { fadeUp, stagger, AnimatedHeading } from './shared';

export default function EventsPreviewSection() {
  const [events, setEvents] = useState<SdeEvent[] | null>(null);

  useEffect(() => {
    fetchUpcomingEvents(4).then(setEvents);
  }, []);

  if (events === null) {
    return (
      <section className="py-28 bg-stone-50 px-6 border-y border-stone-100" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse mb-14 text-center space-y-4">
            <div className="h-3 bg-stone-200 rounded w-40 mx-auto" />
            <div className="h-8 bg-stone-200 rounded w-80 mx-auto" />
            <div className="h-4 bg-stone-200 rounded w-64 mx-auto" />
          </div>
          <div className="flex flex-col gap-5">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse grid md:grid-cols-[280px_1fr] bg-white border border-stone-100 overflow-hidden">
                <div className="h-52 md:h-48 bg-stone-200" />
                <div className="p-7 space-y-3">
                  <div className="h-3 bg-stone-200 rounded w-24" />
                  <div className="h-6 bg-stone-200 rounded w-3/4" />
                  <div className="h-4 bg-stone-200 rounded w-full" />
                  <div className="h-4 bg-stone-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (events.length === 0) return null;

  return (
    <section className="py-28 bg-stone-50 px-6 border-y border-stone-100">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="mb-14 text-center"
        >
          <motion.span variants={fadeUp} className="text-sage font-bold tracking-[0.35em] uppercase text-[11px] block mb-3">
            Prochains ateliers & retraites
          </motion.span>
          <AnimatedHeading className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-5">
            Rejoignez un espace de transformation
          </AnimatedHeading>
          <motion.p variants={fadeUp} className="text-stone-500 text-lg max-w-xl mx-auto leading-relaxed">
            Des rencontres en petit groupe pour aller au cœur de ce qui compte vraiment — le rêve, l'ombre, la présence.
          </motion.p>
          <motion.div variants={fadeUp} className="w-16 h-0.5 bg-sage/50 mx-auto mt-6" />
        </motion.div>

        <div className="flex flex-col gap-5">
          {events.map((ev, i) => {
            const d    = ev.date_start ? new Date(ev.date_start) : null;
            const dEnd = ev.date_end   ? new Date(ev.date_end)   : null;
            const day     = d ? d.toLocaleDateString('fr-FR', { day: 'numeric' }) : '—';
            const month   = d ? d.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : '';
            const weekday = d ? d.toLocaleDateString('fr-FR', { weekday: 'long' }) : '';
            const isFree  = ev.price_chf === 0;
            const hasLimit = !!ev.max_participants;

            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.07 }}
                className="group grid md:grid-cols-[280px_1fr] bg-white border border-stone-100 hover:border-sage/50 hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="relative h-52 md:h-full overflow-hidden">
                  {ev.image_url ? (
                    <>
                      <img src={proxyUrl(ev.image_url)} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" width={280} height={208} />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/50 to-transparent pointer-events-none" />
                    </>
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                      <CalendarDays size={36} className="text-stone-300" />
                    </div>
                  )}
                  {d && (
                    <div className="absolute top-4 left-4 bg-white px-3 py-2 text-center shadow-md min-w-[52px]">
                      <p className="font-bold text-stone-900 text-2xl leading-none">{day}</p>
                      <p className="text-sage text-[10px] font-bold uppercase tracking-wider mt-0.5">{month}</p>
                    </div>
                  )}
                  {hasLimit && (
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-stone-900/80 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 backdrop-blur-sm">
                        Places limitées
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-7 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 ${CATEGORY_COLORS[ev.category as keyof typeof CATEGORY_COLORS]}`}>
                        {CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS]}
                      </span>
                      {isFree && (
                        <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
                          ✦ Gratuit
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl font-bold text-stone-900 leading-snug group-hover:text-sage transition-colors">
                      {ev.title}
                    </h3>
                    {ev.excerpt && (
                      <p className="text-stone-500 text-sm leading-relaxed line-clamp-2">{ev.excerpt}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-100">
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-stone-500">
                      {d && (
                        <span className="flex items-center gap-1.5 capitalize">
                          <CalendarDays size={13} className="text-sage" />
                          {dEnd
                            ? `du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${dEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : `${weekday} ${day} ${month}`}
                        </span>
                      )}
                      {ev.time_start && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-sage" />
                          {ev.time_start}{ev.time_end ? ` – ${ev.time_end}` : ''}
                        </span>
                      )}
                      {!ev.is_online && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-sage" />
                          {ev.location}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {!isFree && (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900">CHF {ev.price_chf}.-</span>
                            {ev.is_recurring && ev.recurrence_sessions && (
                              <span className="text-xs text-stone-400 font-medium">pour {ev.recurrence_sessions} séances</span>
                            )}
                          </div>
                          {ev.discount_label && (
                            <span className="text-[11px] text-emerald-600 font-semibold italic">{ev.discount_label}</span>
                          )}
                        </div>
                      )}
                      <Link
                        href={`/ateliers/${ev.slug}`}
                        className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-sage transition-colors group/btn"
                      >
                        {isFree ? "S'inscrire" : 'Réserver'} <ArrowRight size={12} className="group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 text-center"
        >
          <Link
            href="/ateliers"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-stone-400 hover:text-sage transition-colors border-b border-stone-200 hover:border-sage pb-0.5"
          >
            Voir tous les ateliers & retraites <ArrowRight size={13} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
