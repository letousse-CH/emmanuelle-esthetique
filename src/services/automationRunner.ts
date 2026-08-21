/**
 * Exécution des automatisations — logique unique, trois points d'entrée.
 *
 * Le bouton « Exécuter » de l'admin, la tâche planifiée et les événements
 * applicatifs passent tous par ici. C'est ce qui manquait : `trigger_type`
 * acceptait `schedule` et `event` depuis le début, mais rien dans le code
 * n'allait chercher les automatisations dues, et aucun endroit du projet
 * n'émettait le moindre événement. Une automatisation planifiée était donc un
 * réglage qui ne se déclenchait jamais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { callClaude } from '../utils/ai';
import { buildPrompt, type ArticleIdea } from '../utils/articleGeneration';
import { runSocialAutomation } from './socialAutomation';
import { publishScheduledArticles } from './publishScheduled';
import { getSettingsServer } from './settingsServer';
import { SITE_CONFIG } from '../config/site';
import type { Automation } from '../types/automations';

export type AutomationEvent =
  | 'lead.created'
  | 'agent.qualified'
  | 'sale.created'
  | 'subscriber.created'
  | 'article.published';

/** Slug d'article dérivé d'un titre — même règle que l'éditeur de blog. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ── Actions ────────────────────────────────────────────────────────────────

async function actionWebhook(config: Record<string, string>, automation: Automation) {
  const url = config.url;
  if (!url) throw new Error('URL de webhook non renseignée.');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.secret ? { Authorization: config.secret } : {}),
    },
    body: JSON.stringify({ automation: automation.name, triggeredAt: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Le webhook a répondu ${response.status}.`);
  return { status: response.status };
}

async function actionEmail(config: Record<string, string>, automation: Automation) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = config.to;
  if (!apiKey) throw new Error('RESEND_API_KEY manquante.');
  if (!to) throw new Error('Destinataire non renseigné.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: config.subject || `Automatisation : ${automation.name}`,
      text: `L'automatisation « ${automation.name} » s'est déclenchée le ${new Date().toLocaleString('fr-CH')}.`,
    }),
  });
  if (!response.ok) throw new Error(`Resend a répondu ${response.status}.`);
  return { sentTo: to };
}

async function actionKeywordScan(origin: string) {
  const response = await fetch(`${origin}/api/keyword-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CRON_SECRET ? { 'x-cron-secret': process.env.CRON_SECRET } : {}),
    },
    body: JSON.stringify({ source: 'automation' }),
  });
  if (!response.ok) throw new Error(`Le scan a répondu ${response.status}.`);
  return await response.json().catch(() => ({}));
}

/**
 * Rédige un brouillon à partir de la plus ancienne idée en file, et la retire
 * de la file une fois l'article créé. L'article reste **non publié** : une
 * automatisation ne met jamais un texte en ligne sans relecture.
 */
async function actionGenerateArticle(admin: SupabaseClient, config: Record<string, string>) {
  let query = admin
    .from('saved_ideas')
    .select('id, title, data')
    .eq('type', 'article')
    .order('created_at', { ascending: true })
    .limit(20);

  const { data: rows } = await query;
  let candidates = (rows ?? []) as { id: string; title: string; data: Record<string, unknown> }[];

  const pillar = (config.pillar ?? '').trim().toLowerCase();
  if (pillar) {
    const filtered = candidates.filter(
      (row) => String(row.data?.category ?? '').toLowerCase().includes(pillar),
    );
    if (filtered.length > 0) candidates = filtered;
  }

  const next = candidates[0];
  if (!next) throw new Error("Aucune idée en file : ajoutez-en depuis l'espace SEO.");

  const idea = { ...(next.data as Record<string, unknown>) } as unknown as ArticleIdea;
  if (!idea.keyword) idea.keyword = next.title;
  if (!idea.suggestedTitle) idea.suggestedTitle = next.title;

  const settings = await getSettingsServer([
    'site_activity_context',
    'site_target_persona',
    'site_tone_of_voice',
    'site_brand_tone',
  ]);

  const completion = await callClaude({
    feature: 'article',
    max_tokens: 16000,
    messages: [{ role: 'user', content: buildPrompt(idea, settings) }],
  });

  const content = completion.content.map((block) => block.text).join('').trim();
  if (!content) throw new Error('Le modèle a renvoyé un article vide.');

  const baseSlug = idea.suggestedSlug?.trim() || slugify(idea.suggestedTitle);
  const slug = `${baseSlug}-${Date.now().toString(36)}`.slice(0, 90);

  const { data: created, error } = await admin
    .from('articles')
    .insert({
      title: idea.suggestedTitle,
      slug,
      content,
      category: idea.category ?? null,
      meta_keywords: idea.keyword,
      published: false,
    })
    .select('id, slug')
    .single();
  if (error) throw new Error(error.message);

  await admin.from('saved_ideas').delete().eq('id', next.id);

  return { articleId: created?.id, slug: created?.slug, title: idea.suggestedTitle, published: false };
}

async function actionGenerateSocial(config: Record<string, string>) {
  const count = Math.min(10, Math.max(1, Number.parseInt(config.count ?? '3', 10) || 3));
  const summary = await runSocialAutomation(count);
  if (summary.errors.length > 0 && summary.generated === 0) {
    throw new Error(summary.errors.join(' · '));
  }
  return summary as unknown as Record<string, unknown>;
}

/**
 * Assemble un brouillon de campagne depuis les articles publiés après la
 * dernière newsletter. Le brouillon n'est **pas** envoyé : l'envoi reste un
 * geste humain, dans l'éditeur de newsletter.
 */
async function actionNewsletterDigest(admin: SupabaseClient) {
  const { data: last } = await admin
    .from('newsletters')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = (last?.created_at as string | undefined)
    ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data: articles } = await admin
    .from('articles')
    .select('title, slug, meta_description, created_at')
    .eq('published', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(8);

  const rows = (articles ?? []) as { title: string; slug: string; meta_description: string | null }[];
  if (rows.length === 0) throw new Error('Aucun article publié depuis la dernière campagne.');

  const items = rows
    .map(
      (article) => `<li style="margin-bottom:14px">
  <a href="${SITE_CONFIG.url}/blog/${article.slug}" style="font-weight:700;color:#1c1917;text-decoration:none">${article.title}</a>
  ${article.meta_description ? `<div style="color:#57534e;font-size:14px;margin-top:4px">${article.meta_description}</div>` : ''}
</li>`,
    )
    .join('\n');

  const subject = rows.length === 1 ? rows[0].title : `${rows.length} nouveaux articles à lire`;
  const html = `<h2>Les derniers articles</h2>\n<ul style="padding-left:18px">\n${items}\n</ul>`;

  const { data: created, error } = await admin
    .from('newsletters')
    .insert({ subject, html, sent_count: 0, failed_count: 0 })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  return { newsletterId: created?.id, subject, articles: rows.length, sent: false };
}

async function actionPublishScheduled() {
  const summary = await publishScheduledArticles();
  if (summary.published.length === 0 && summary.failed.length === 0) {
    return { published: 0, message: 'Aucun article n’était arrivé à échéance.' };
  }
  return { published: summary.published.length, slugs: summary.published, failed: summary.failed };
}

// ── Aiguillage ─────────────────────────────────────────────────────────────

export async function executeAutomation(
  automation: Automation,
  origin: string,
): Promise<Record<string, unknown>> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase non configuré.');
  const config = (automation.action_config ?? {}) as Record<string, string>;

  switch (automation.action_type) {
    case 'webhook':          return actionWebhook(config, automation);
    case 'email':            return actionEmail(config, automation);
    case 'keyword_scan':     return actionKeywordScan(origin);
    case 'generate_article': return actionGenerateArticle(admin, config);
    case 'generate_social':  return actionGenerateSocial(config);
    case 'newsletter_digest':return actionNewsletterDigest(admin);
    case 'publish_scheduled':return actionPublishScheduled();
    default:
      throw new Error(`Action inconnue : ${automation.action_type}`);
  }
}

/** Exécute une automatisation et journalise le passage, quoi qu'il arrive. */
export async function runAutomation(
  automation: Automation,
  triggeredBy: string,
  origin: string,
): Promise<{ ok: boolean; detail?: Record<string, unknown>; error?: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: 'Supabase non configuré.' };

  const { data: run } = await admin
    .from('automation_runs')
    .insert({ automation_id: automation.id, status: 'running', triggered_by: triggeredBy })
    .select('id')
    .single();
  const runId = run?.id as string | undefined;

  try {
    const detail = await executeAutomation(automation, origin);
    await Promise.all([
      runId && admin.from('automation_runs')
        .update({ status: 'success', detail, finished_at: new Date().toISOString() })
        .eq('id', runId),
      admin.from('automations')
        .update({ last_run_at: new Date().toISOString(), last_status: 'success' })
        .eq('id', automation.id),
    ]);
    return { ok: true, detail };
  } catch (error) {
    const message = (error as Error).message;
    await Promise.all([
      runId && admin.from('automation_runs')
        .update({ status: 'error', error: message, finished_at: new Date().toISOString() })
        .eq('id', runId),
      admin.from('automations')
        .update({ last_run_at: new Date().toISOString(), last_status: 'error' })
        .eq('id', automation.id),
    ]);
    return { ok: false, error: message };
  }
}

// ── Déclencheurs ───────────────────────────────────────────────────────────

// Un champ cron accepte-t-il cette valeur ? Formes gérées : joker, valeur
// exacte, liste séparée par des virgules, intervalle `a-b`, et pas `/n`.
function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number.parseInt(stepRaw, 10) : 1;
    if (!Number.isFinite(step) || step < 1) return false;

    let start: number;
    let end: number;
    if (range === '*') {
      start = -Infinity;
      end = Infinity;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map((n) => Number.parseInt(n, 10));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      start = a;
      end = b;
    } else {
      const exact = Number.parseInt(range, 10);
      if (!Number.isFinite(exact)) return false;
      return stepRaw ? value >= exact && (value - exact) % step === 0 : value === exact;
    }

    if (value < start || value > end) return false;
    if (step === 1) return true;
    const base = Number.isFinite(start) ? start : 0;
    return (value - base) % step === 0;
  });
}

function cronMatches(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  return (
    fieldMatches(minute, date.getMinutes()) &&
    fieldMatches(hour, date.getHours()) &&
    fieldMatches(dayOfMonth, date.getDate()) &&
    fieldMatches(month, date.getMonth() + 1) &&
    fieldMatches(dayOfWeek, date.getDay())
  );
}

/**
 * Dernière occurrence prévue par l'expression, au plus tard maintenant.
 *
 * On ne teste pas « la minute courante correspond-elle ? » : la tâche planifiée
 * ne tourne pas à la minute près, et une occurrence tomberait à l'eau à chaque
 * décalage. On cherche donc la dernière occurrence passée (jusqu'à 24 h en
 * arrière) et on compare à la date de dernière exécution.
 */
function lastOccurrence(expression: string, now: Date): Date | null {
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  for (let i = 0; i < 60 * 24; i += 1) {
    if (cronMatches(expression, cursor)) return new Date(cursor);
    cursor.setMinutes(cursor.getMinutes() - 1);
  }
  return null;
}

export function isDue(automation: Automation, now = new Date()): boolean {
  const expression = automation.trigger_config?.cron?.trim();
  if (!expression) return false;
  const occurrence = lastOccurrence(expression, now);
  if (!occurrence) return false;
  if (!automation.last_run_at) return true;
  return new Date(automation.last_run_at).getTime() < occurrence.getTime();
}

/** Exécute toutes les automatisations planifiées dont l'échéance est passée. */
export async function runDueAutomations(origin: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ran: 0, results: [] as Record<string, unknown>[] };

  const { data } = await admin
    .from('automations')
    .select('*')
    .eq('enabled', true)
    .eq('trigger_type', 'schedule');

  const due = ((data ?? []) as Automation[]).filter((automation) => isDue(automation));
  const results: Record<string, unknown>[] = [];
  for (const automation of due) {
    const outcome = await runAutomation(automation, 'schedule', origin);
    results.push({ id: automation.id, name: automation.name, ...outcome });
  }
  return { ran: due.length, results };
}

/**
 * Signale un événement applicatif aux automatisations qui l'écoutent.
 *
 * Ne lève jamais : une automatisation en échec ne doit pas faire tomber
 * l'action métier qui l'a déclenchée (un envoi d'e-mail, un encaissement).
 */
export async function emitAutomationEvent(event: AutomationEvent, origin: string): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;

    const { data } = await admin
      .from('automations')
      .select('*')
      .eq('enabled', true)
      .eq('trigger_type', 'event');

    const listeners = ((data ?? []) as Automation[]).filter(
      (automation) => automation.trigger_config?.event === event,
    );
    for (const automation of listeners) {
      await runAutomation(automation, `event:${event}`, origin);
    }
  } catch (error) {
    console.error('[automations] émission de', event, ':', error);
  }
}
