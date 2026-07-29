"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  CalendarDays, MapPin, Users, Clock, ArrowLeft,
  CheckCircle, AlertCircle, CreditCard, Layers,
  ChevronRight, Video, RepeatIcon, Gift
} from 'lucide-react';
import { proxyUrl } from '../../../../utils/media';
import { SdeEvent, CATEGORY_LABELS, CATEGORY_COLORS, INSTALLMENT_THRESHOLD_CHF } from '../../../../types/events';
import { NewsletterBanner } from '../../../../components/NewsletterBanner';
import AdminEditButton from '../../../../components/AdminEditButton';

function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDateRange(start: string, end: string | null) {
  if (!end) return formatDateLong(start);
  const ds = new Date(start);
  const de = new Date(end);
  const sameMonth = ds.getMonth() === de.getMonth() && ds.getFullYear() === de.getFullYear();
  if (sameMonth) {
    return `du ${ds.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} au ${de.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return `du ${ds.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${de.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

interface EventDetailClientProps {
  event: SdeEvent;
}

export default function EventDetailClient({ event }: EventDetailClientProps) {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const cancelled = searchParams.get('cancelled') === 'true';

  const isFree = event.price_chf === 0;
  const canInstallment = event.price_chf > INSTALLMENT_THRESHOLD_CHF;

  // Lien visio visible la veille et le jour J
  const showVisioLink = (() => {
    if (!event.visio_url || !event.date_start) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayBefore = new Date(event.date_start); dayBefore.setDate(dayBefore.getDate() - 1); dayBefore.setHours(0, 0, 0, 0);
    return today >= dayBefore;
  })();

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* ── IMAGE HERO ── */}
      {event.image_url && (
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img src={proxyUrl(event.image_url)} alt={event.title} className="w-full h-full object-cover" fetchPriority="high" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-6 left-6">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 ${CATEGORY_COLORS[event.category as keyof typeof CATEGORY_COLORS]}`}>
              {CATEGORY_LABELS[event.category as keyof typeof CATEGORY_LABELS]}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Retour */}
        <Link href="/ateliers" className="inline-flex items-center gap-2 text-stone-400 hover:text-sage text-sm mb-8 transition-colors">
          <ArrowLeft size={15} /> Tous les événements
        </Link>

        {/* Alertes paiement */}
        {success && (
          <div className="mb-8 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4">
            <CheckCircle size={20} className="shrink-0" />
            <div>
              <p className="font-bold">Inscription confirmée !</p>
              <p className="text-sm mt-0.5">Vous recevrez une confirmation par e-mail. À bientôt !</p>
            </div>
          </div>
        )}
        {cancelled && (
          <div className="mb-8 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm">Paiement annulé. Vous pouvez réessayer ci-dessous.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-12 items-start">

          {/* ── Colonne gauche : contenu ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight mb-4">
                {event.title}
              </h1>
              {event.excerpt && (
                <p className="text-stone-500 text-lg leading-relaxed italic border-l-2 border-sage pl-5 mb-8">
                  {event.excerpt}
                </p>
              )}

              {event.description && (
                <div
                  className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:leading-relaxed prose-p:text-stone-600 prose-li:text-stone-600 prose-li:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
              )}
            </motion.div>
          </div>

          {/* ── Colonne droite : infos + inscription ── */}
          <div className="space-y-6 lg:sticky lg:top-24">

            {/* Infos pratiques */}
            <div className="bg-stone-50 border border-stone-200 p-6 space-y-4">
              <h2 className="font-bold text-stone-900 uppercase tracking-widest text-xs mb-4">Infos pratiques</h2>

              {event.date_start && (
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <CalendarDays size={16} className="text-sage shrink-0 mt-0.5" />
                  <span className="capitalize">{formatDateRange(event.date_start, event.date_end)}</span>
                </div>
              )}
              {event.time_start && (
                <div className="flex items-center gap-3 text-sm text-stone-600">
                  <Clock size={16} className="text-sage shrink-0" />
                  <span>{event.time_start}{event.time_end ? ` – ${event.time_end}` : ''}</span>
                </div>
              )}
              {!event.is_online && (
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <MapPin size={16} className="text-sage shrink-0 mt-0.5" />
                  <div>
                    <p>{event.location}</p>
                    {event.address && <p className="text-stone-400 text-xs mt-0.5">{event.address}</p>}
                  </div>
                </div>
              )}
              {event.max_participants && (
                <div className="flex items-center gap-3 text-sm text-stone-600">
                  <Users size={16} className="text-sage shrink-0" />
                  <span>Max. {event.max_participants} participants</span>
                </div>
              )}

              {/* Récurrence */}
              {event.is_recurring && (
                <div className="flex items-start gap-3 text-sm text-stone-600">
                  <RepeatIcon size={16} className="text-sage shrink-0 mt-0.5" />
                  <div>
                    {event.recurrence_sessions && (
                      <p className="font-medium">{event.recurrence_sessions} séances incluses</p>
                    )}
                    {event.recurrence_day && (
                      <p className="text-stone-400 text-xs capitalize">Tous les {event.recurrence_day}s</p>
                    )}
                    {event.recurrence_description && (
                      <p className="text-stone-400 text-xs italic">{event.recurrence_description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Visio */}
              {event.is_online && (
                <div className="flex items-center gap-3 text-sm text-stone-600">
                  <Video size={16} className="text-sage shrink-0" />
                  <span>Événement en ligne</span>
                </div>
              )}

              <div className="border-t border-stone-200 pt-4 mt-2 flex items-center justify-between">
                <span className="text-xs text-stone-400 uppercase tracking-widest font-bold">Tarif</span>
                {isFree ? (
                  <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 text-sm font-bold uppercase tracking-widest">
                    <Gift size={14} /> Gratuit
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-stone-900">CHF {event.price_chf}.-</span>
                )}
              </div>
              {canInstallment && (
                <p className="text-xs text-stone-400 italic">Paiement en 3× disponible</p>
              )}

              {/* Lien visio (visible la veille) */}
              {showVisioLink && event.visio_url && (
                <div className="border border-sage/40 bg-sage/5 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-sage flex items-center gap-1.5">
                    <Video size={12} /> Lien de connexion
                  </p>
                  <a
                    href={event.visio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-sage font-bold hover:underline break-all"
                  >
                    Rejoindre la séance en ligne →
                  </a>
                </div>
              )}
              {event.is_online && !showVisioLink && (
                <p className="text-xs text-stone-400 italic">
                  Le lien de connexion sera affiché ici et envoyé par e-mail la veille de l'événement.
                </p>
              )}
            </div>

            {/* Formulaire d'inscription */}
            {!success && (
              <RegistrationForm event={event} />
            )}
          </div>
        </div>
      </div>
      <NewsletterBanner />
      <AdminEditButton />
    </div>
  );
}

function getInstallmentDates(eventDateStr: string | null): { date2: Date; date3: Date } {
  const now = new Date();
  if (!eventDateStr) {
    return {
      date2: new Date(now.getTime() + 30 * 86400000),
      date3: new Date(now.getTime() + 60 * 86400000),
    };
  }
  const eventDate = new Date(eventDateStr);
  const lastPayment = new Date(eventDate.getTime() - 10 * 86400000);
  const daysToEvent = Math.floor((eventDate.getTime() - now.getTime()) / 86400000);
  if (daysToEvent <= 45) {
    const interval = Math.max(7, Math.floor(daysToEvent / 3));
    return {
      date2: new Date(now.getTime() + interval * 86400000),
      date3: lastPayment < new Date(now.getTime() + interval * 2 * 86400000) ? lastPayment : new Date(now.getTime() + interval * 2 * 86400000),
    };
  }
  const date3Candidate = new Date(now.getTime() + 60 * 86400000);
  return {
    date2: new Date(now.getTime() + 30 * 86400000),
    date3: date3Candidate < lastPayment ? date3Candidate : lastPayment,
  };
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function RegistrationForm({ event }: { event: SdeEvent }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [paymentType, setPaymentType] = useState<'full' | 'installment'>('full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [freeSuccess, setFreeSuccess] = useState(false);

  const canInstallment = event.price_chf > INSTALLMENT_THRESHOLD_CHF;
  const { date2, date3 } = getInstallmentDates(event.date_start);
  const installmentChf = Math.ceil(event.price_chf / 3);
  const remainder = event.price_chf - installmentChf * 2;

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      setError('Merci de remplir tous les champs obligatoires.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Point checkouts to Next.js route handler /api/create-checkout
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          paymentType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue.');
        setLoading(false);
        return;
      }

      if (data.free) {
        setFreeSuccess(true);
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Impossible de contacter le serveur. Veuillez réessayer.');
      setLoading(false);
    }
  };

  if (freeSuccess) return (
    <div className="bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3">
      <CheckCircle size={32} className="text-emerald-600 mx-auto" />
      <p className="font-bold text-emerald-800 uppercase tracking-widest text-sm">Inscription confirmée !</p>
      <p className="text-sm text-emerald-600">Un e-mail de confirmation vous a été envoyé.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 p-6 space-y-4">
      <h2 className="font-bold text-stone-900 uppercase tracking-widest text-xs mb-4">
        {event.price_chf === 0 ? "S'inscrire gratuitement" : 'Réserver ma place'}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-1">Prénom *</label>
          <input
            type="text"
            required
            value={form.firstName}
            onChange={set('firstName')}
            className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-sage transition-colors"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={form.lastName}
            onChange={set('lastName')}
            className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-sage transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-1">E-mail *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-sage transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-1">Téléphone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          className="w-full border border-stone-200 px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-sage transition-colors"
        />
      </div>

      {/* Option paiement fractionné */}
      {canInstallment && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Paiement</p>
          <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${paymentType === 'full' ? 'border-sage bg-sage/5' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="payment" value="full" checked={paymentType === 'full'} onChange={() => setPaymentType('full')} className="mt-0.5 accent-sage" />
            <div>
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-sage" />
                <span className="text-sm font-bold text-stone-900">Paiement intégral</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">CHF {event.price_chf}.- en une fois par carte</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${paymentType === 'installment' ? 'border-sage bg-sage/5' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="payment" value="installment" checked={paymentType === 'installment'} onChange={() => setPaymentType('installment')} className="mt-0.5 accent-sage" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-sage" />
                <span className="text-sm font-bold text-stone-900">Payer en 3 fois</span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">Sans frais supplémentaires · Liens de paiement envoyés par e-mail</p>
            </div>
          </label>

          {/* Calendrier de paiement détaillé */}
          {paymentType === 'installment' && (
            <div className="bg-stone-50 border border-stone-200 p-4 space-y-2 text-xs">
              <p className="font-bold text-stone-500 uppercase tracking-widest text-[10px] mb-3">Échéancier de paiement</p>
              {[
                { label: '1er versement', date: "Aujourd'hui (à la réservation)", amount: installmentChf, highlight: true },
                { label: '2e versement', date: fmtShort(date2), amount: installmentChf, highlight: false },
                { label: '3e versement', date: fmtShort(date3), amount: remainder, highlight: false },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between py-2 ${i < 2 ? 'border-b border-stone-200' : ''}`}>
                  <div className="flex items-center gap-2">
                    <ChevronRight size={11} className="text-sage shrink-0" />
                    <div>
                      <p className={`font-bold ${row.highlight ? 'text-stone-900' : 'text-stone-600'}`}>{row.label}</p>
                      <p className="text-stone-400">{row.date}</p>
                    </div>
                  </div>
                  <p className={`font-bold ${row.highlight ? 'text-sage' : 'text-stone-700'}`}>CHF {row.amount}.-</p>
                </div>
              ))}
              <p className="text-stone-400 italic pt-1">
                Les liens pour les 2e et 3e versements vous seront envoyés par e-mail après confirmation du 1er paiement.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-stone-900 text-white py-4 font-bold text-sm uppercase tracking-widest hover:bg-sage transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading
          ? (event.price_chf === 0 ? 'Inscription…' : 'Redirection…')
          : event.price_chf === 0
            ? "Confirmer mon inscription"
            : paymentType === 'installment'
              ? `Réserver — 1er versement CHF ${installmentChf}.-`
              : `Réserver — CHF ${event.price_chf}.-`
        }
      </button>

      <p className="text-[11px] text-stone-400 text-center">
        {event.price_chf === 0
          ? 'Inscription gratuite · Confirmation par e-mail'
          : 'Paiement sécurisé via Stripe · Confirmation par e-mail'}
      </p>
    </form>
  );
}
