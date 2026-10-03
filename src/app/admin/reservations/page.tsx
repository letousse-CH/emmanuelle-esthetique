"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, CalendarOff, List, Phone, Plus, RefreshCw } from 'lucide-react';
import type { Booking } from '../../../types/booking';
import { listClientStats } from '../../../services/caisse';
import { Button } from '../../../components/admin/ui';
import AgendaView from '../../../components/admin/reservations/AgendaView';
import BlocksSection from '../../../components/admin/reservations/BlocksSection';
import BookingPanel from '../../../components/admin/reservations/BookingPanel';
import { FeedbackProvider } from '../../../components/admin/reservations/Feedback';
import ListView from '../../../components/admin/reservations/ListView';
import NewBookingPanel from '../../../components/admin/reservations/NewBookingPanel';
import Overlay from '../../../components/admin/reservations/Overlay';
import SyncClientsButton from '../../../components/admin/reservations/SyncClientsButton';
import TodoView from '../../../components/admin/reservations/TodoView';
import MobileAgenda, { agendaRange } from '../../../components/admin/reservations/MobileAgenda';
import type { MobileVue } from '../../../components/admin/reservations/MobileAgenda';
import { useAgenda, useBookingSettings, useCatalog, useIsLg } from '../../../components/admin/reservations/hooks';
import { DEFAULT_COUPURE, adminFetch, announceBookingsChanged, errorMessage, todayZurich } from '../../../components/admin/reservations/lib';

type View = 'traiter' | 'agenda' | 'liste';

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'traiter', label: 'À traiter', icon: Phone },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'liste', label: 'Liste', icon: List },
];

export default function ReservationsAdminPage() {
  return (
    <FeedbackProvider>
      {/* useSearchParams (liens `?id=`, `?nouveau=1`, `?vue=`, `?date=`) exige une frontière Suspense. */}
      <Suspense fallback={null}>
        <ReservationsScreen />
      </Suspense>
    </FeedbackProvider>
  );
}

function ReservationsScreen() {
  const { catalog } = useCatalog();
  const settings = useBookingSettings();
  const coupure = settings?.heure_coupure_periode || DEFAULT_COUPURE;

  const isLg = useIsLg();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>('traiter');
  // Téléphone : vue par défaut = la journée d'aujourd'hui.
  const [mVue, setMVue] = useState<MobileVue>('jour');
  const [mDate, setMDate] = useState(() => todayZurich());
  // Bureau : jour affiché par l'agenda à l'ouverture (lien `?date=`).
  const [agendaDate, setAgendaDate] = useState<string | undefined>(undefined);
  const [agendaKey, setAgendaKey] = useState(0);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Map<string, number>>(new Map());
  const [refreshKey, setRefreshKey] = useState(0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<{ date?: string; time?: string | null; clientId?: string } | null>(null);
  // `date` : « Je ne travaille pas » depuis un jour précis (téléphone : ouvre le formulaire tout de suite).
  const [blocksOpen, setBlocksOpen] = useState<{ date?: string } | null>(null);

  // « Aujourd'hui » à Zurich, recalculé si l'onglet reste ouvert après minuit.
  const [today, setToday] = useState(() => todayZurich());
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayZurich()), 60000);
    return () => window.clearInterval(t);
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminFetch<{ bookings?: Booking[] }>('/api/admin/bookings?limit=1000');
      setBookings(json.bookings ?? []);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
    fetchBookings();
    announceBookingsChanged();
  }, [fetchBookings]);

  useEffect(() => {
    fetchBookings();
    listClientStats()
      .then((m) => setStats(new Map(Array.from(m.entries()).map(([id, s]) => [id, s.nb_visites]))))
      .catch(() => {
        /* Confort d'affichage : sans les visites, le badge dit « Nouvelle cliente ». */
      });
  }, [fetchBookings]);

  // Liens directs (accueil, notifications) : `?id=` ouvre le rendez-vous, `?nouveau=1` (+ `&client=`, `&date=`)
  // la création, `?vue=a-traiter|jour|semaine|liste` une vue, `?date=YYYY-MM-DD` un jour de l'agenda.
  useEffect(() => {
    const id = searchParams.get('id');
    const nouveau = searchParams.get('nouveau');
    const vue = searchParams.get('vue');
    const d = searchParams.get('date');
    const client = searchParams.get('client');
    if (!id && !nouveau && !vue && !d) return;
    const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
    if (date) {
      setMDate(date);
      setAgendaDate(date);
      setAgendaKey((k) => k + 1);
      setMVue('jour');
      setView('agenda');
    }
    if (vue === 'a-traiter' || vue === 'traiter') {
      setMVue('a-traiter');
      setView('traiter');
    } else if (vue === 'liste') {
      setMVue('liste');
      setView('liste');
    } else if (vue === 'semaine') {
      setMVue('semaine');
      setView('agenda');
    } else if (vue === 'jour' || vue === 'agenda') {
      setMVue('jour');
      setView('agenda');
    }
    if (id) setOpenId(id);
    else if (nouveau) setNewDraft({ date, clientId: client || undefined });
    window.history.replaceState(null, '', window.location.pathname);
  }, [searchParams]);

  const visitsByClient = useMemo(() => {
    const m = new Map(stats);
    const done = new Map<string, number>();
    for (const b of bookings) {
      if (b.client_id && b.statut === 'termine') done.set(b.client_id, (done.get(b.client_id) ?? 0) + 1);
    }
    for (const [id, n] of done) m.set(id, Math.max(m.get(id) ?? 0, n));
    return m;
  }, [stats, bookings]);

  const range = useMemo(() => agendaRange(mDate), [mDate]);
  const agenda = useAgenda(range.from, range.to, refreshKey, isLg === false);

  const toCall = bookings.filter((b) => b.statut === 'en_attente').length;
  const notCalled = bookings.filter((b) => b.statut === 'en_attente' && !b.contacte_at).length;


  const desktopView = (
    <div className="mx-auto max-w-7xl space-y-6 p-2 sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-stone-950 sm:text-[28px]">Réservations</h1>
          <p className="mt-1 text-[15px] text-stone-700">
            {notCalled > 0
              ? `${notCalled} demande${notCalled > 1 ? 's' : ''} à rappeler.`
              : toCall > 0
                ? `${toCall} demande${toCall > 1 ? 's' : ''} en attente de confirmation.`
                : 'Aucune demande en attente.'}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button variant="primary" icon={Plus} className="h-12 flex-1 sm:flex-none" onClick={() => setNewDraft({})}>
            Nouveau rendez-vous
          </Button>
          <Button icon={CalendarOff} className="h-12 flex-1 sm:flex-none" onClick={() => setBlocksOpen({})}>
            Je ne travaille pas
          </Button>
          <Button icon={RefreshCw} loading={loading} className="h-12 px-3.5" onClick={reload} aria-label="Actualiser la page" title="Actualiser">
            <span className="sr-only">Actualiser</span>
          </Button>
        </div>
      </header>

      <div role="tablist" aria-label="Vue des réservations" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-grid sm:grid-cols-[repeat(3,minmax(8rem,1fr))]">
        {VIEWS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(v.id)}
              className={`flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[14px] transition-colors sm:gap-2 sm:px-3 sm:text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                active ? 'bg-white font-semibold text-stone-950 shadow-xs ring-1 ring-stone-200' : 'font-medium text-stone-700 hover:text-stone-950'
              }`}
            >
              <v.icon size={17} aria-hidden="true" className="hidden shrink-0 sm:block" />
              {v.label}
              {v.id === 'traiter' && toCall > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[12px] font-bold text-white" aria-label={`${toCall} en attente`}>
                  {toCall}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {bookings.length >= 1000 && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14.5px] text-amber-950">
          Affichage limité aux 1000 dernières réservations. Utilisez l’Agenda pour consulter une date précise.
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-950">
          <span>{error}</span>
          <Button onClick={fetchBookings} className="h-11">
            Réessayer
          </Button>
        </div>
      )}

      <div role="tabpanel" aria-label={VIEWS.find((v) => v.id === view)?.label}>
        {view === 'traiter' && (
          loading && bookings.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-stone-700">Chargement des demandes…</p>
          ) : (
            <TodoView bookings={bookings} visitsByClient={visitsByClient} coupure={coupure} onOpen={setOpenId} />
          )
        )}
        {view === 'agenda' && (
          <AgendaView
            key={agendaKey}
            refreshKey={refreshKey}
            today={today}
            initialDate={agendaDate}
            onOpenBooking={setOpenId}
            onNewAt={(date, time) => setNewDraft({ date, time })}
            onOpenBlocks={() => setBlocksOpen({})}
          />
        )}
        {view === 'liste' && <ListView bookings={bookings} today={today} coupure={coupure} onOpen={setOpenId} />}
      </div>

      <details className="rounded-xl border border-stone-300 bg-white">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-[15px] font-semibold text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          Outils
        </summary>
        <div className="border-t border-stone-200 p-4">
          <SyncClientsButton onDone={reload} />
        </div>
      </details>
    </div>
  );

  const mobileView = (
    <MobileAgenda
      vue={mVue}
      onVue={setMVue}
      date={mDate}
      onDate={setMDate}
      today={today}
      bookings={bookings}
      bookingsLoading={loading}
      bookingsError={error}
      onRetryBookings={fetchBookings}
      agenda={agenda.data}
      agendaLoading={agenda.loading}
      agendaError={agenda.error}
      onRetryAgenda={agenda.retry}
      visitsByClient={visitsByClient}
      coupure={coupure}
      onOpen={setOpenId}
      onNew={(date, time) => setNewDraft({ date, time })}
      onOpenBlocks={(date) => setBlocksOpen({ date })}
      onReload={reload}
    />
  );

  return (
    <>
      {isLg === null ? null : isLg ? desktopView : mobileView}

      {openId && (
        <BookingPanel
          key={openId}
          bookingId={openId}
          catalog={catalog}
          settings={settings}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onOpenOther={(id) => setOpenId(id)}
        />
      )}

      {newDraft && (
        <NewBookingPanel
          catalog={catalog}
          initialDate={newDraft.date}
          initialTime={newDraft.time}
          initialClientId={newDraft.clientId}
          onClose={() => setNewDraft(null)}
          onCreated={() => {
            setNewDraft(null);
            reload();
          }}
        />
      )}

      {blocksOpen && (
        <Overlay title="Mes indisponibilités" subtitle="Jours de congé, vacances, plages horaires" onClose={() => setBlocksOpen(null)}>
          <BlocksSection
            initialDate={blocksOpen.date}
            autoOpenForm={blocksOpen.date !== undefined}
            onChanged={reload}
            onOpenBooking={(id) => {
              setBlocksOpen(null);
              setOpenId(id);
            }}
          />
        </Overlay>
      )}
    </>
  );
}
