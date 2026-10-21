/**
 * Cycle hebdomadaire des réseaux sociaux (serveur).
 *
 * Le jour réglé (mercredi par défaut), la tâche planifiée propose le plan de
 * la semaine suivante sur les créneaux du rythme et prévient l'institut
 * (notification). L'exploitante valide alors le plan, fait préparer les
 * publications dans la foulée (textes, visuels, Reels — dans le navigateur),
 * les relit et les valide : elles partent seules aux heures prévues.
 *
 * Réglages (table `settings`, non secrets) : `social_autopilot` ('on' | 'off',
 * actif par défaut), `social_weekly_day` (1 = lundi … 7 = dimanche),
 * `social_rhythm` (créneaux).
 */
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import {
  nextWeekStart, parseWeeklyDay, PILLAR_LABEL, shouldPrepareNextWeek, weekEnd, weekLabel, weekRange, weekStart,
  zurichDayKey, type SocialNetwork,
} from '../types/social';
import { proposePlan } from './socialPlan';
import { getPublishTarget } from './metaConnection';
import { sendPushToAll } from './pushNotifications';

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('La clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) manque sur le serveur.');
  return admin;
}

export interface AutopilotSettings {
  on: boolean;
  weeklyDay: number;
}

export async function readAutopilot(): Promise<AutopilotSettings> {
  const { data } = await db().from('settings').select('key, value').in('key', ['social_autopilot', 'social_weekly_day']);
  const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, String(r.value ?? '')]));
  return { on: map.social_autopilot !== 'off', weeklyDay: parseWeeklyDay(map.social_weekly_day) };
}

/**
 * Propose les sujets de la semaine (créneaux libres seulement). `replace` :
 * retire d'abord les sujets de cette semaine qui ne sont pas encore préparés.
 */
export async function proposeWeek(week: string, opts: { replace?: boolean; instruction?: string } = {}): Promise<{ created: number }> {
  const start = weekStart(week);
  const { from, to } = weekRange(start);
  // Avant toute suppression : « Refaire » sur une semaine passée effaçait ses sujets, puis refusait.
  const today = zurichDayKey(new Date());
  if (weekEnd(start) < today) throw new Error('Cette semaine est passée.');
  if (opts.replace) {
    const { error } = await db()
      .from('social_posts')
      .delete()
      .eq('status', 'draft')
      .eq('caption', '')
      .gte('planned_at', from)
      .lt('planned_at', to);
    if (error) throw new Error(error.message);
  }

  const fromDay = start < today ? today : start;
  const days = Math.round((Date.parse(`${weekEnd(start)}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86_400_000) + 1;

  const [{ proposals }, target] = await Promise.all([
    proposePlan({ fromDayKey: fromDay, days: Math.max(1, days), instruction: opts.instruction, exact: true }),
    getPublishTarget(),
  ]);
  if (!proposals.length) return { created: 0 };

  const networks: SocialNetwork[] = target ? (target.instagramId ? ['instagram', 'facebook'] : ['facebook']) : ['instagram', 'facebook'];
  const rows = proposals.map((p) => ({
    kind: p.kind,
    source_type: p.source.kind,
    source_ref: p.source.kind === 'idee' ? 'idee' : p.source.id,
    title: p.subject,
    caption: '',
    hashtags: '',
    link_path: '/reservation',
    visual: { layout: p.kind === 'story' ? 'marine' : 'photo', format: p.kind === 'post' ? 'portrait' : 'story', eyebrow: PILLAR_LABEL[p.pillar], headline: p.subject, photo_url: null },
    networks,
    planned_at: p.at,
    pillar: p.pillar,
    plan_note: p.angle || p.subject,
    content: {},
    status: 'draft',
  }));
  const { error } = await db().from('social_posts').insert(rows);
  if (error) throw new Error(error.message);
  return { created: rows.length };
}

export interface WeeklySummary {
  skipped?: string;
  week?: string;
  created?: number;
}

/** Tâche planifiée (chaque matin) : le jour réglé, propose la semaine suivante et prévient. */
export async function runWeeklyAutopilot(now: Date = new Date()): Promise<WeeklySummary> {
  const settings = await readAutopilot();
  if (!settings.on) return { skipped: 'pilote en pause' };
  const today = zurichDayKey(now);
  if (!shouldPrepareNextWeek(today, settings.weeklyDay)) return { skipped: 'pas encore le jour de préparation' };

  const week = nextWeekStart(today);
  const { from, to } = weekRange(week);
  // Déjà préparée (ou commencée à la main) : on n'y touche pas.
  const { count } = await db()
    .from('social_posts')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'archived')
    .or(`and(planned_at.gte.${from},planned_at.lt.${to}),and(scheduled_at.gte.${from},scheduled_at.lt.${to})`);
  if ((count ?? 0) > 0) return { skipped: 'semaine déjà planifiée', week };

  const { created } = await proposeWeek(week);
  if (created > 0) {
    await sendPushToAll({
      title: 'Réseaux sociaux : la semaine prochaine est prête',
      body: `${created} publication${created > 1 ? 's' : ''} ${weekLabel(week)} : validez le plan, tout se prépare ensuite.`,
      url: `/admin/social?semaine=${week}`,
      tag: `social-week-${week}`,
    });
  }
  return { week, created };
}
