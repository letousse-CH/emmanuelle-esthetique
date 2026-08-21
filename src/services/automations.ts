import { supabase } from './supabase';
import type { Automation, AutomationRun } from '../types/automations';

export async function fetchAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('[automations] fetch:', error.message);
  return (data ?? []) as Automation[];
}

export async function saveAutomation(
  automation: Partial<Automation> & { name: string; action_type: Automation['action_type'] },
): Promise<{ success: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase
    .from('automations')
    .upsert({ ...automation, updated_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id as string };
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('automations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteAutomation(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function fetchRuns(automationId?: string, limit = 50): Promise<AutomationRun[]> {
  let query = supabase
    .from('automation_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (automationId) query = query.eq('automation_id', automationId);
  const { data, error } = await query;
  if (error) console.error('[automations] fetchRuns:', error.message);
  return (data ?? []) as AutomationRun[];
}

/**
 * Déclenche une automatisation depuis l'admin. L'exécution réelle se fait
 * côté serveur : la clé de service et les jetons de webhook ne doivent jamais
 * transiter par le navigateur.
 */
export async function runAutomation(
  id: string,
): Promise<{ success: boolean; error?: string; detail?: unknown }> {
  try {
    const response = await fetch('/api/automations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, triggeredBy: 'manual' }),
    });
    const payload = await response.json();
    if (!response.ok) return { success: false, error: payload?.error ?? 'Échec' };
    return { success: true, detail: payload };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Fréquences exprimées comme on en parle, pas comme cron les écrit.
 *
 * Le client n'a pas à connaître `0 6 * * 1`. L'interface manipule une
 * fréquence, une heure et un jour ; la conversion se fait ici, dans les deux
 * sens, pour qu'une automatisation créée hier reste modifiable demain.
 */
export type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Schedule {
  frequency: Frequency;
  /** Heure de déclenchement (0–23). Ignorée pour « toutes les heures ». */
  hour: number;
  /** Jour de la semaine, 1 = lundi … 7 = dimanche. Fréquence hebdomadaire. */
  weekday: number;
  /** Jour du mois (1–28). Au-delà de 28, certains mois sauteraient un passage. */
  monthday: number;
  /** Expression brute, pour la fréquence « avancée ». */
  raw: string;
}

export const DEFAULT_SCHEDULE: Schedule = {
  frequency: 'daily',
  hour: 6,
  weekday: 1,
  monthday: 1,
  raw: '0 6 * * *',
};

export const WEEKDAYS = [
  { value: 1, label: 'lundi' },
  { value: 2, label: 'mardi' },
  { value: 3, label: 'mercredi' },
  { value: 4, label: 'jeudi' },
  { value: 5, label: 'vendredi' },
  { value: 6, label: 'samedi' },
  { value: 7, label: 'dimanche' },
];

/** Cron correspondant à une fréquence choisie dans l'interface. */
export function scheduleToCron(schedule: Schedule): string {
  const hour = Math.min(23, Math.max(0, schedule.hour));
  switch (schedule.frequency) {
    case 'hourly':
      return '0 * * * *';
    case 'weekly':
      // Cron compte dimanche = 0 ; l'interface parle en « lundi = 1 ».
      return `0 ${hour} * * ${schedule.weekday % 7}`;
    case 'monthly':
      return `0 ${hour} ${Math.min(28, Math.max(1, schedule.monthday))} * *`;
    case 'custom':
      return schedule.raw.trim() || DEFAULT_SCHEDULE.raw;
    case 'daily':
    default:
      return `0 ${hour} * * *`;
  }
}

/** Relit une expression cron pour repeupler l'interface. */
export function cronToSchedule(expression?: string): Schedule {
  const raw = (expression ?? '').trim();
  if (!raw) return { ...DEFAULT_SCHEDULE };

  const fields = raw.split(/\s+/);
  if (fields.length !== 5) return { ...DEFAULT_SCHEDULE, frequency: 'custom', raw };

  const [minute, hourField, dayOfMonth, month, dayOfWeek] = fields;
  const hour = Number.parseInt(hourField, 10);
  const simpleHour = Number.isFinite(hour) && String(hour) === hourField;

  if (minute === '0' && hourField === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...DEFAULT_SCHEDULE, frequency: 'hourly', raw };
  }
  if (minute === '0' && simpleHour && month === '*') {
    if (dayOfMonth === '*' && dayOfWeek === '*') {
      return { ...DEFAULT_SCHEDULE, frequency: 'daily', hour, raw };
    }
    const weekday = Number.parseInt(dayOfWeek, 10);
    if (dayOfMonth === '*' && Number.isFinite(weekday) && String(weekday) === dayOfWeek) {
      return { ...DEFAULT_SCHEDULE, frequency: 'weekly', hour, weekday: weekday === 0 ? 7 : weekday, raw };
    }
    const monthday = Number.parseInt(dayOfMonth, 10);
    if (dayOfWeek === '*' && Number.isFinite(monthday) && String(monthday) === dayOfMonth) {
      return { ...DEFAULT_SCHEDULE, frequency: 'monthly', hour, monthday, raw };
    }
  }
  return { ...DEFAULT_SCHEDULE, frequency: 'custom', raw };
}

/** Décrit une expression cron en français, quelle qu'elle soit. */
export function describeCron(expression?: string): string {
  if (!expression) return 'Aucune fréquence définie';
  const schedule = cronToSchedule(expression);
  const hour = `${String(schedule.hour).padStart(2, '0')}:00`;
  switch (schedule.frequency) {
    case 'hourly':
      return 'Toutes les heures';
    case 'daily':
      return `Chaque jour à ${hour}`;
    case 'weekly':
      return `Chaque ${WEEKDAYS.find((d) => d.value === schedule.weekday)?.label ?? 'lundi'} à ${hour}`;
    case 'monthly':
      return `Le ${schedule.monthday === 1 ? '1er' : schedule.monthday} de chaque mois à ${hour}`;
    default:
      return `Expression avancée : ${expression}`;
  }
}

/**
 * Prochaine occurrence prévue, en clair.
 *
 * L'ordonnanceur passe toutes les cinq minutes : on annonce donc une heure
 * approchée, jamais une promesse à la seconde qu'on ne tiendrait pas.
 */
export function describeNextRun(expression?: string): string | null {
  const schedule = cronToSchedule(expression);
  if (schedule.frequency === 'custom') return null;

  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (schedule.frequency === 'hourly') {
    next.setMinutes(0);
    if (next <= now) next.setHours(next.getHours() + 1);
  } else {
    next.setHours(schedule.hour, 0, 0, 0);
    if (schedule.frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (schedule.frequency === 'weekly') {
      const target = schedule.weekday % 7;
      while (next.getDay() !== target || next <= now) next.setDate(next.getDate() + 1);
    } else {
      next.setDate(schedule.monthday);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }
  }

  return next.toLocaleString('fr-CH', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}
