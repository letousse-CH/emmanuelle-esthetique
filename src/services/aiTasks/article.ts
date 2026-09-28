/**
 * Rédaction d'un article de blog complet (environ 2 400 mots) à partir d'une
 * fiche de sujet. C'est la génération la plus longue du site : elle ne tient
 * pas dans les 60 s d'une fonction Netlify synchrone et passe donc par une
 * tâche de fond (`services/aiJobs`, types `article` et `automation-article`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { callClaude } from '../../utils/ai';
import { buildPrompt, type ArticleIdea } from '../../utils/articleGeneration';
import { getSupabaseAdmin } from '../../utils/supabaseAdmin';
import { AiTaskError, getSettingsPlain, type AiTaskMode } from './shared';

const ARTICLE_SETTING_KEYS = [
  'site_activity_context',
  'site_target_persona',
  'site_tone_of_voice',
  'site_brand_tone',
];

/** Texte HTML de l'article. Réflexion coupée, comme dans la version en flux. */
export async function writeArticle(idea: ArticleIdea, mode: AiTaskMode = 'long'): Promise<string> {
  const settings = await getSettingsPlain(ARTICLE_SETTING_KEYS);
  const completion = await callClaude({
    feature: 'article',
    mode,
    max_tokens: 16000,
    // La réflexion partagerait `max_tokens` avec l'article et rallongerait la
    // rédaction sans bénéfice net sur ce format.
    disableThinking: true,
    messages: [{ role: 'user', content: buildPrompt(idea, settings) }],
  });
  const content = completion.content.map((block) => block.text).join('').trim();
  if (!content) throw new AiTaskError('Le modèle a renvoyé un article vide.', 502);
  return content;
}

/** Type de tâche `article` : écran Blog, bouton « Générer l'article complet ». */
export async function generateArticleTask(input: { idea?: any }): Promise<{ content: string }> {
  const idea = input?.idea;
  if (!idea?.keyword) throw new AiTaskError('Brief incomplet', 400);
  return { content: await writeArticle(idea as ArticleIdea, 'long') };
}

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

/**
 * Type de tâche `automation-article` : action « Générer un brouillon
 * d'article » des automatisations. Rédige un brouillon à partir de la plus
 * ancienne idée en file, et la retire de la file une fois l'article créé.
 * L'article reste **non publié** : une automatisation ne met jamais un texte
 * en ligne sans relecture.
 *
 * Idempotence vis-à-vis des réessais Netlify : l'idée choisie est figée dans
 * l'entrée de la tâche (`ideaId`) au moment de sa création ; si elle a déjà
 * été consommée, la tâche s'arrête sans créer de doublon.
 */
export async function generateAutomationArticle(input: {
  ideaId?: string;
}): Promise<Record<string, unknown>> {
  const admin: SupabaseClient | null = getSupabaseAdmin();
  if (!admin) throw new AiTaskError('Supabase non configuré.', 500);
  if (!input?.ideaId) throw new AiTaskError('Idée à rédiger non précisée.', 400);

  const { data: next } = await admin
    .from('saved_ideas')
    .select('id, title, data')
    .eq('id', input.ideaId)
    .maybeSingle();
  if (!next) {
    return { skipped: true, message: "Cette idée a déjà été rédigée ou supprimée." };
  }

  const idea = { ...((next.data ?? {}) as Record<string, unknown>) } as unknown as ArticleIdea;
  if (!idea.keyword) idea.keyword = next.title as string;
  if (!idea.suggestedTitle) idea.suggestedTitle = next.title as string;

  const content = await writeArticle(idea, 'long');

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
