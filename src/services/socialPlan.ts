/**
 * Plan éditorial des réseaux sociaux (serveur).
 *
 * Le rythme (réglage `social_rhythm`) donne des créneaux ; l'IA propose un
 * sujet par créneau, en tournant sur les thèmes de la carte, en plaçant
 * l'offre du moment pendant sa période et les bons cadeaux avant les fêtes,
 * sans répéter ce qui vient d'être publié. Rien n'est créé ici : l'écran
 * montre la proposition, l'exploitante la corrige, puis l'ajoute au plan.
 * Règles de contrôle (pures) : `normalizePlan`, `rhythmSlots` (types/social).
 */
import { callClaude, extractJson } from '../utils/ai';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { flatCarte } from '../constants/carteSoins';
import {
  normalizePlan, parseRhythm, PILLARS, rhythmSlots, seasonalMoments, zurichDayKey,
  KIND_LABEL, type PlanProposal, type PlanSlot, type Rhythm,
} from '../types/social';
import { brandContext, readEditorialSettings } from './socialWriting';

function db() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('La clé de service Supabase (SUPABASE_SERVICE_ROLE_KEY) manque sur le serveur.');
  return admin;
}

export async function readRhythm(): Promise<Rhythm> {
  const { data } = await db().from('settings').select('value').eq('key', 'social_rhythm').maybeSingle();
  return parseRhythm(data?.value);
}

const addDays = (dayKey: string, n: number) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export interface PlanResult {
  slots: PlanSlot[];
  proposals: PlanProposal[];
}

/** `exact` : exactement `days` jours (semaine en cours) ; sinon entre 7 et 42. */
export async function proposePlan(opts: { fromDayKey?: string; days?: number; instruction?: string; exact?: boolean }): Promise<PlanResult> {
  const today = zurichDayKey(new Date());
  const from = opts.fromDayKey && opts.fromDayKey >= today ? opts.fromDayKey : today;
  const days = opts.exact ? Math.min(42, Math.max(1, opts.days || 7)) : Math.min(42, Math.max(7, opts.days || 28));
  const to = addDays(from, days - 1);

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [rhythm, settings, { data: existing }, { data: offers }, { data: articles }] = await Promise.all([
    readRhythm(),
    readEditorialSettings(),
    db().from('social_posts').select('title, pillar, kind, status, scheduled_at, planned_at, published_at, source_type, source_ref')
      .neq('status', 'archived').or(`scheduled_at.gte.${since},planned_at.gte.${since},published_at.gte.${since},updated_at.gte.${since}`),
    db().from('monthly_offers').select('id, titre, date_debut, date_fin').eq('active', true).is('archived_at', null)
      .lte('date_debut', to).gte('date_fin', from),
    db().from('articles').select('id, title').eq('published', true).order('created_at', { ascending: false }).limit(30),
  ]);

  // Un jour qui a déjà une publication (programmée ou au plan) ne reçoit rien de plus.
  const taken = new Set<string>();
  for (const p of existing ?? []) {
    const at = p.scheduled_at || p.planned_at;
    if (at && (p.status === 'scheduled' || p.status === 'draft' || p.status === 'publishing')) taken.add(zurichDayKey(new Date(at)));
  }
  const slots = rhythmSlots(rhythm, from, days, taken);
  if (!slots.length) return { slots, proposals: [] };

  const carte = flatCarte();
  const recent = (existing ?? [])
    .filter((p) => p.published_at || p.scheduled_at || p.planned_at)
    .map((p) => `- ${p.title}${p.pillar ? ` [${p.pillar}]` : ''}`)
    .slice(0, 40)
    .join('\n');
  const moments = seasonalMoments(from, addDays(to, 30));

  const system = `Tu établis le plan éditorial Instagram et Facebook de ${settings.business_name || 'l’institut'}.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour.

${brandContext(settings)}

━━━ RÈGLES DU PLAN ━━━
- Un sujet par créneau, dans l'ordre des créneaux. Chaque sujet est précis (un soin, un geste, une question de cliente), jamais vague.
- Varier les thèmes : jamais deux fois le même thème de suite ; sur le mois, chaque catégorie de la carte revient au moins une fois.
- Environ un sujet sur cinq est un conseil beauté ou une présentation de l'institut, sans vente.
- L'offre du moment : au plus un sujet par semaine, et seulement sur un créneau compris dans sa période.
- Bons cadeaux : les proposer à l'approche des fêtes listées plus bas.
- Ne pas reprendre un sujet déjà traité récemment (liste plus bas).
- Le format du créneau est imposé : un Reel raconte en images (gestes, ambiance, étapes d'un soin) ; une story est un message bref ; une publication développe un conseil ou un soin.
- "angle" : en une phrase, ce que la publication doit dire ou montrer — c'est la consigne donnée ensuite à la rédaction.

━━━ FORMAT ━━━
{ "items": [ { "slot": 0, "pillar": "${PILLARS.map((p) => p.id).join('" | "')}", "source": "soin" | "offre" | "article" | "idee", "ref": "identifiant du soin, de l'offre ou de l'article, sinon vide", "subject": "le sujet en quelques mots", "angle": "…" } ] }`;

  const user = `Créneaux à remplir :
${slots.map((s, i) => `${i}. ${new Date(s.at).toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} — ${KIND_LABEL[s.kind]}`).join('\n')}

Soins de la carte (identifiant : nom) :
${carte.map((i) => `- ${i.id} : ${i.name} (${i.category.label})`).join('\n')}

Offres du moment pendant la période :
${(offers ?? []).length ? (offers ?? []).map((o) => `- ${o.id} : ${o.titre}, du ${o.date_debut} au ${o.date_fin}`).join('\n') : '- aucune'}

Articles du blog qu'on peut relayer :
${(articles ?? []).length ? (articles ?? []).map((a) => `- ${a.id} : ${a.title}`).join('\n') : '- aucun'}

Moments de l'année à venir :
${moments.length ? moments.map((m) => `- ${m.day} : ${m.label}`).join('\n') : '- aucun'}

Déjà publié ou prévu récemment (à ne pas répéter) :
${recent || '- rien encore'}
${opts.instruction?.trim() ? `\nConsigne de l'institut pour ce plan : ${opts.instruction.trim()}\n` : ''}
Propose le plan.`;

  const res = await callClaude({ feature: 'social-plan', max_tokens: 3500, system, messages: [{ role: 'user', content: user }] });
  const proposals = normalizePlan(extractJson(res.content[0].text), {
    slots,
    soinIds: new Set(carte.map((i) => i.id)),
    articleIds: new Set((articles ?? []).map((a) => a.id)),
    offers: (offers ?? []) as { id: string; date_debut: string; date_fin: string }[],
  });
  if (!proposals.length) throw new Error('Le plan est revenu vide. Réessayez.');
  return { slots, proposals };
}
