/**
 * Publication des articles arrivés à échéance.
 *
 * Partagé entre la tâche planifiée `/api/cron/publish` et l'action
 * d'automatisation « Publier les articles programmés » : le client choisit son
 * rythme depuis l'admin sans qu'on duplique la logique de publication.
 */
import { revalidatePath } from 'next/cache';

import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { SITE_CONFIG } from '../config/site';

export interface PublishSummary {
  published: string[];
  failed: string[];
}

export async function publishScheduledArticles(): Promise<PublishSummary> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase non configuré.');

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('articles')
    .select('id, title, slug')
    .eq('published', false)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now);
  if (error) throw new Error(error.message);

  const articles = (data ?? []) as { id: string; title: string; slug: string }[];
  const summary: PublishSummary = { published: [], failed: [] };

  for (const article of articles) {
    const { error: updateError } = await admin
      .from('articles')
      .update({ published: true, scheduled_at: null })
      .eq('id', article.id);

    if (updateError) {
      console.error('[publish-scheduled]', article.slug, updateError.message);
      summary.failed.push(article.slug);
      continue;
    }

    summary.published.push(article.slug);
    revalidatePath('/blog');
    revalidatePath(`/blog/${article.slug}`);
    try {
      await fetch(
        `https://www.bing.com/indexnow?url=${encodeURIComponent(`${SITE_CONFIG.url}/blog/${article.slug}`)}&key=${SITE_CONFIG.bingIndexNowKey}`,
      );
    } catch {
      /* signalement aux moteurs : non critique */
    }
  }

  return summary;
}
