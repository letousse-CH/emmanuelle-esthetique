/**
 * Automatisation du contenu réseaux sociaux : détecte les nouvelles sources
 * (flux RSS configurés, articles de blog publiés, suggestions SEO sauvegardées)
 * pas encore transformées en post, génère le contenu Instagram/LinkedIn/Facebook
 * via utils/socialGeneration, et l'enregistre dans `social_posts` avec une date
 * de planification pour le calendrier admin.
 *
 * Appelé par la route cron (planifiée en externe) et par le déclenchement
 * manuel "Générer maintenant" — même logique, deux points d'entrée.
 */
import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import { generateSocialContent } from '../utils/socialGeneration';
import { addDaysToKey, todayKey } from '../utils/dateKey';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface Candidate {
  sourceType: 'article' | 'rss' | 'suggestion';
  sourceRef: string;
  title: string;
  content?: string;
  intro?: string;
  coverImage?: string;
}

export interface SocialAutomationSummary {
  generated: number;
  skipped: number;
  errors: string[];
  /** Dates de planification attribuées aux posts créés, pour l'affichage admin. */
  plannedDates: string[];
}

async function collectRssCandidates(client: any, existingRss: Set<string>): Promise<Candidate[]> {
  const { data: feeds } = await client.from('rss_feeds').select('id, url, label').eq('active', true);
  if (!feeds || feeds.length === 0) return [];

  // Timeout court + lecture des flux en parallèle : la fonction serverless
  // qui héberge cette route a un budget total de quelques secondes, un flux
  // lent (ou hors ligne) ne doit jamais bloquer les autres ni faire dépasser
  // la limite d'exécution.
  const parser = new Parser({ timeout: 6000 });

  const perFeedResults = await Promise.all(
    (feeds as { id: string; url: string; label: string | null }[]).map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        const items: Candidate[] = [];
        for (const item of (parsed.items || []).slice(0, 10)) {
          const ref = item.guid || item.link || item.title;
          if (!ref || existingRss.has(ref)) continue;
          const title = (item.title || '').trim();
          if (!title) continue;
          const intro = (item.contentSnippet || item.summary || item.content || '').toString().slice(0, 2000);
          items.push({ sourceType: 'rss', sourceRef: ref, title, intro });
        }
        return items;
      } catch (err: any) {
        console.error(`[socialAutomation] Échec de lecture du flux RSS ${feed.url}:`, err?.message || err);
        return [];
      }
    })
  );
  return perFeedResults.flat();
}

async function collectArticleCandidates(client: any, existingArticles: Set<string>): Promise<Candidate[]> {
  const { data: articles } = await client
    .from('articles')
    .select('id, title, content, cover_image')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!articles) return [];
  return (articles as { id: string; title: string; content: string; cover_image: string | null }[])
    .filter((a) => !existingArticles.has(a.id))
    .map((a) => ({ sourceType: 'article' as const, sourceRef: a.id, title: a.title, content: a.content, coverImage: a.cover_image || undefined }));
}

async function collectSuggestionCandidates(client: any, existingSuggestions: Set<string>): Promise<Candidate[]> {
  const { data: ideas } = await client
    .from('saved_ideas')
    .select('id, data')
    .eq('type', 'article')
    .order('created_at', { ascending: false })
    .limit(20);
  if (!ideas) return [];
  return (ideas as { id: string; data: any }[])
    .filter((row) => !existingSuggestions.has(row.id))
    .map((row) => ({
      sourceType: 'suggestion' as const,
      sourceRef: row.id,
      title: row.data?.suggestedTitle || row.data?.keyword || 'Suggestion',
      intro: row.data?.suggestedIntro || '',
    }));
}

/** Exécute un cycle d'automatisation : jusqu'à `maxItems` nouveaux posts générés. */
export async function runSocialAutomation(maxItems = 3): Promise<SocialAutomationSummary> {
  const summary: SocialAutomationSummary = { generated: 0, skipped: 0, errors: [], plannedDates: [] };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    summary.errors.push('Configuration Supabase manquante (SUPABASE_SERVICE_ROLE_KEY).');
    return summary;
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: existingRows } = await client.from('social_posts').select('source_type, source_ref');
  const existingByType: Record<string, Set<string>> = { article: new Set(), rss: new Set(), suggestion: new Set(), manual: new Set() };
  for (const row of (existingRows || []) as { source_type: string; source_ref: string }[]) {
    (existingByType[row.source_type] ||= new Set()).add(row.source_ref);
  }

  const [rssCandidates, articleCandidates, suggestionCandidates] = await Promise.all([
    collectRssCandidates(client, existingByType.rss),
    collectArticleCandidates(client, existingByType.article),
    collectSuggestionCandidates(client, existingByType.suggestion),
  ]);

  const candidates = [...rssCandidates, ...articleCandidates, ...suggestionCandidates].slice(0, maxItems);

  if (candidates.length === 0) {
    return summary;
  }

  // Poursuit la file du calendrier après le dernier post déjà planifié (ou
  // démarre demain), un post par jour, pour étaler la relecture.
  const today = todayKey();
  const { data: lastPlanned } = await client
    .from('social_posts')
    .select('planned_date')
    .gte('planned_date', today)
    .order('planned_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextDate = addDaysToKey((lastPlanned?.planned_date as string) || today, 1);

  // Les appels IA (5-10s chacun) sont lancés en parallèle plutôt qu'en
  // séquence : la fonction serverless qui héberge cette route a un budget
  // d'exécution total limité, et `maxItems` appels à la suite le
  // dépasseraient largement. L'insertion en base, elle, reste séquentielle
  // (rapide) pour assigner les dates de planification dans l'ordre.
  const generations = await Promise.allSettled(
    candidates.map((candidate) => generateSocialContent({ title: candidate.title, content: candidate.content, intro: candidate.intro }))
  );

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const generation = generations[i];

    if (generation.status === 'rejected') {
      summary.errors.push(`${candidate.sourceType}:${candidate.title} — ${generation.reason?.message || 'erreur inconnue'}`);
      continue;
    }

    try {
      const { error } = await client.from('social_posts').insert({
        source_type: candidate.sourceType,
        source_ref: candidate.sourceRef,
        title: candidate.title,
        cover_image: candidate.coverImage || null,
        content: generation.value,
        planned_date: nextDate,
        status: 'ready',
      });
      if (error) {
        // Conflit unique (déjà traité entre-temps) : on passe simplement au suivant.
        if (error.code === '23505') { summary.skipped++; continue; }
        throw error;
      }
      summary.generated++;
      summary.plannedDates.push(nextDate);
      nextDate = addDaysToKey(nextDate, 1);
    } catch (err: any) {
      summary.errors.push(`${candidate.sourceType}:${candidate.title} — ${err?.message || 'erreur inconnue'}`);
    }
  }

  return summary;
}
