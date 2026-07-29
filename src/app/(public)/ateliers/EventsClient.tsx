"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CalendarDays, MapPin, Users, ArrowRight, Clock } from 'lucide-react';
import { proxyUrl } from '../../../utils/media';
import { SdeEvent, EventCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '../../../types/events';

const CATEGORIES: { value: EventCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'retraite_spirituelle', label: 'Retraites' },
  { value: 'atelier_groupe', label: 'Ateliers' },
  { value: 'module', label: 'Modules' },
  { value: 'evenement_regulier', label: 'Réguliers' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateRange(start: string, end: string | null) {
  if (!end) return formatDate(start);
  const ds = new Date(start);
  const de = new Date(end);
  const sameMonth = ds.getMonth() === de.getMonth() && ds.getFullYear() === de.getFullYear();
  if (sameMonth) {
    return `du ${ds.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} au ${de.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return `du ${ds.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${de.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function groupByMonth(events: SdeEvent[]): Record<string, SdeEvent[]> {
  const groups: Record<string, SdeEvent[]> = {};
  for (const ev of events) {
    if (!ev.date_start) {
      const key = 'Date à confirmer';
      groups[key] = [...(groups[key] || []), ev];
      continue;
    }
    const d = new Date(ev.date_start);
    const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
    groups[key] = [...(groups[key] || []), ev];
  }
  return groups;
}

interface EventsClientProps {
  initialEvents: SdeEvent[];
}

export default function EventsClient({ initialEvents }: EventsClientProps) {
  const [activeCategory, setActiveCategory] = useState<EventCategory | 'all'>('all');

  const filtered = activeCategory === 'all'
    ? initialEvents
    : initialEvents.filter(e => e.category === activeCategory);

  const groups = groupByMonth(filtered);

  return (
    <div className="min-h-screen bg-white pt-24">
      {/* ── HERO ── */}
      <section className="relative bg-stone-50 border-b border-stone-100 py-16 md:py-24 px-6 text-center">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #1c1917 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-sage font-bold tracking-[0.35em] uppercase text-[11px]">
              Rencontres & Pratique
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mt-3 leading-tight">
              Ateliers &amp; Événements
            </h1>
            <p className="text-stone-500 mt-5 leading-relaxed text-lg">
              Des espaces pour explorer, ressentir et avancer ensemble —
              <br className="hidden md:block" />à votre rythme, sans injonction.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FILTRES ── */}
      <div className="sticky top-16 z-30 bg-white border-b border-stone-100 px-6 py-3">
        <div className="max-w-5xl mx-auto flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value as EventCategory | 'all')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                activeCategory === cat.value
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTE ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        {filtered.length === 0 ? (
          <p className="text-center text-stone-400 italic py-16">Aucun événement à venir dans cette catégorie.</p>
        ) : (
          <div className="space-y-16">
            {Object.entries(groups).map(([month, monthEvents]) => (
              <div key={month}>
                {/* En-tête de mois */}
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="font-serif text-2xl font-bold text-stone-900">{month}</h2>
                  <div className="flex-1 h-px bg-stone-100" />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {monthEvents.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface EventCardProps { event: SdeEvent; index: number }
function EventCard({ event: ev, index }: EventCardProps) {
  const spotsLeft = ev.max_participants;
  const isFree = ev.price_chf === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="group flex flex-col bg-white border border-stone-100 hover:border-sage/40 hover:shadow-md transition-all overflow-hidden"
    >
      {/* Image */}
      {ev.image_url && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={proxyUrl(ev.image_url)}
            alt={ev.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
          {/* Badge catégorie */}
          <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 ${CATEGORY_COLORS[ev.category as keyof typeof CATEGORY_COLORS]}`}>
            {CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS]}
          </span>
        </div>
      )}

      <div className="flex flex-col flex-1 p-6 space-y-4">
        {/* Sans image : badge inline */}
        {!ev.image_url && (
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 w-fit ${CATEGORY_COLORS[ev.category as keyof typeof CATEGORY_COLORS]}`}>
            {CATEGORY_LABELS[ev.category as keyof typeof CATEGORY_LABELS]}
          </span>
        )}

        <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug group-hover:text-sage transition-colors">
          {ev.title}
        </h3>

        {ev.excerpt && (
          <p className="text-stone-500 text-sm leading-relaxed line-clamp-2">{ev.excerpt}</p>
        )}

        {/* Méta */}
        <div className="space-y-2 text-xs text-stone-500">
          {ev.date_start && (
            <div className="flex items-center gap-2">
              <CalendarDays size={13} className="text-sage shrink-0" />
              <span className="capitalize">{formatDateRange(ev.date_start, ev.date_end)}</span>
            </div>
          )}
          {ev.time_start && (
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-sage shrink-0" />
              <span>{ev.time_start}{ev.time_end ? ` – ${ev.time_end}` : ''}</span>
            </div>
          )}
          {!ev.is_online && (
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-sage shrink-0" />
              <span>{ev.location}</span>
            </div>
          )}
          {spotsLeft && (
            <div className="flex items-center gap-2">
              <Users size={13} className="text-sage shrink-0" />
              <span>Max. {spotsLeft} participant{spotsLeft > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 mt-auto border-t border-stone-100">
          <div className="flex flex-col gap-0.5">
            {isFree ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest">
                ✦ Gratuit
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 text-sm">CHF {ev.price_chf}.-</span>
                {ev.is_recurring && ev.recurrence_sessions && (
                  <span className="text-xs text-stone-400 font-medium">pour {ev.recurrence_sessions} séances</span>
                )}
              </div>
            )}
            {ev.discount_label && (
              <span className="text-[11px] text-emerald-600 font-semibold italic">{ev.discount_label}</span>
            )}
          </div>
          <Link
            href={`/ateliers/${ev.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-sage hover:text-stone-900 transition-colors"
          >
            Réserver <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
