"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../services/supabase';
import type { Booking } from '../../../../types/booking';
import { isVenteProduct, recetteEncaissee, stockLevel, type Product } from '../../../../types/caisse';
import type {
  AlertsData,
  Block,
  ExpiringCard,
  HomeBlockKey,
  HomeData,
  LowStockItem,
  MoneyData,
} from './homeTypes';
import {
  addDays,
  dayOfMonth,
  daysInMonth,
  firstOfMonth,
  firstOfPreviousMonth,
  mondayOf,
  zurichDate,
  zurichMidnightISO,
} from './zurich';

const REFRESH_MS = 2 * 60 * 1000;
const EXPIRY_WINDOW_DAYS = 30;

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Session expirée : reconnectez-vous.');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function fetchBookings(query: string): Promise<Booking[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/admin/bookings?${query}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Impossible de lire l’agenda (erreur ${res.status}).`);
  const json = await res.json();
  return (json.bookings ?? []) as Booking[];
}

/** Rendez-vous de la semaine en cours (+ demain si on est dimanche). */
export function loadSchedule(today: string): Promise<Booking[]> {
  const from = mondayOf(today);
  const sunday = addDays(from, 6);
  const tomorrow = addDays(today, 1);
  return fetchBookings(`from=${from}&to=${tomorrow > sunday ? tomorrow : sunday}&limit=1000`);
}

/** Demandes à rappeler : en attente et jamais contactées (même règle que la pastille de l'agenda). */
export async function loadPending(): Promise<Booking[]> {
  const all = await fetchBookings('statut=en_attente&limit=1000');
  return all.filter((b) => b.statut === 'en_attente' && !b.contacte_at);
}

/** Recettes du jour, de la semaine et du mois, depuis la table des transactions (lecture seule). */
export async function loadMoney(today: string): Promise<MoneyData> {
  const monthStart = firstOfMonth(today);
  const prevStart = firstOfPreviousMonth(today);
  // Même nombre de jours écoulés le mois précédent (plafonné à la longueur de ce mois-là).
  const prevEndExclusive = addDays(prevStart, Math.min(dayOfMonth(today), daysInMonth(prevStart)));

  const todayStartMs = Date.parse(zurichMidnightISO(today));
  // Le lundi tombe au plus 6 jours avant : toujours après le 1er du mois précédent, donc dans la requête.
  const weekStartMs = Date.parse(zurichMidnightISO(mondayOf(today)));
  const monthStartMs = Date.parse(zurichMidnightISO(monthStart));
  const prevStartISO = zurichMidnightISO(prevStart);
  const prevEndMs = Date.parse(zurichMidnightISO(prevEndExclusive));

  const { data, error } = await supabase
    .from('transactions')
    .select('created_at,status,total_ttc,montant_bon')
    .gte('created_at', prevStartISO)
    .limit(5000);
  if (error) throw new Error('Impossible de lire les encaissements.');

  const out: MoneyData = { today: 0, todayCount: 0, week: 0, weekCount: 0, month: 0, monthCount: 0, prevMonthToDate: 0 };
  for (const t of data ?? []) {
    const ms = Date.parse(t.created_at as string);
    const amount = recetteEncaissee({
      status: t.status as 'payee' | 'annulee',
      total_ttc: Number(t.total_ttc),
      montant_bon: Number(t.montant_bon ?? 0),
    });
    const counted = t.status !== 'annulee' ? 1 : 0;
    if (ms >= monthStartMs) {
      out.month += amount;
      out.monthCount += counted;
    } else if (ms < prevEndMs) {
      out.prevMonthToDate += amount;
    }
    if (ms >= weekStartMs) {
      out.week += amount;
      out.weekCount += counted;
    }
    if (ms >= todayStartMs) {
      out.today += amount;
      out.todayCount += counted;
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { ...out, today: r(out.today), week: r(out.week), month: r(out.month), prevMonthToDate: r(out.prevMonthToDate) };
}

/** Stock bas et bons cadeaux proches de l'échéance. Requêtes directes : pas de repli sur des données locales. */
export async function loadAlerts(today: string): Promise<AlertsData> {
  const limitDate = addDays(today, EXPIRY_WINDOW_DAYS);
  const [prodRes, cardRes] = await Promise.all([
    supabase.from('products').select('id,nom,reference,usage_type,stock,seuil_alerte,active').eq('active', true).limit(2000),
    supabase
      .from('gift_cards')
      .select('id,code,libelle,montant_restant,expire_le,status')
      .eq('status', 'active')
      .gt('montant_restant', 0)
      .gte('expire_le', today)
      .lte('expire_le', limitDate)
      .order('expire_le', { ascending: true })
      .limit(50),
  ]);
  if (prodRes.error || cardRes.error) throw new Error('Impossible de lire le stock et les bons cadeaux.');

  const lowStock: LowStockItem[] = ((prodRes.data ?? []) as unknown as Product[])
    .filter((p) => isVenteProduct(p) && stockLevel(p) !== 'ok')
    .map((p) => ({ id: p.id, nom: p.nom, stock: Number(p.stock), seuil: Number(p.seuil_alerte) }))
    .sort((a, b) => a.stock - b.stock || a.nom.localeCompare(b.nom, 'fr'));

  const dayMs = 86400000;
  const base = Date.parse(`${today}T12:00:00Z`);
  const expiringCards: ExpiringCard[] = (cardRes.data ?? []).map((c) => ({
    id: c.id as string,
    code: c.code as string,
    libelle: (c.libelle as string) ?? '',
    montantRestant: Number(c.montant_restant),
    expireLe: c.expire_le as string,
    joursRestants: Math.round((Date.parse(`${c.expire_le}T12:00:00Z`) - base) / dayMs),
  }));
  return { lowStock, expiringCards };
}

const LOADING: Block<never> = { status: 'loading' };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue.');

/**
 * Données de l'accueil mobile. Chaque bloc a son propre état ; un rafraîchissement
 * (retour sur l'onglet, toutes les 2 min) garde les données déjà affichées si la
 * requête échoue, pour ne pas faire clignoter l'écran en erreur.
 */
export function useHomeData(caisseEnabled: boolean): {
  data: HomeData | null;
  retry: (key: HomeBlockKey) => void;
} {
  const [today, setToday] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Block<Booking[]>>(LOADING);
  const [pending, setPending] = useState<Block<Booking[]>>(LOADING);
  const [money, setMoney] = useState<Block<MoneyData>>(LOADING);
  const [alerts, setAlerts] = useState<Block<AlertsData>>(LOADING);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    function <T>(set: React.Dispatch<React.SetStateAction<Block<T>>>, task: () => Promise<T>, hard: boolean) {
      if (hard) set(LOADING);
      task().then(
        (data) => mounted.current && set({ status: 'ready', data }),
        (e) =>
          mounted.current &&
          set((prev) => (prev.status === 'ready' && !hard ? prev : { status: 'error', message: errMsg(e) })),
      );
    },
    [],
  );

  const refresh = useCallback(
    (keys: HomeBlockKey[], hard: boolean) => {
      const day = zurichDate();
      setToday(day);
      for (const k of keys) {
        if (k === 'schedule') run(setSchedule, () => loadSchedule(day), hard);
        if (k === 'pending') run(setPending, () => loadPending(), hard);
        if (k === 'money' && caisseEnabled) run(setMoney, () => loadMoney(day), hard);
        if (k === 'alerts' && caisseEnabled) run(setAlerts, () => loadAlerts(day), hard);
      }
    },
    [run, caisseEnabled],
  );

  useEffect(() => {
    refresh(['schedule', 'pending', 'money', 'alerts'], true);
    const tick = () => {
      refresh(['schedule', 'pending', 'money', 'alerts'], false);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const retry = useCallback((key: HomeBlockKey) => refresh([key], true), [refresh]);

  const data: HomeData | null = today ? { today, schedule, pending, money, alerts } : null;
  return { data, retry };
}
