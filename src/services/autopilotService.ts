import { supabase } from './supabase';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';
import { getAutomaticArticleImages, injectInlineImagesIntoContent } from '../utils/articleImages';
import { getSettingsServer } from './settingsServer';

export interface AutopilotConfig {
  enabled: boolean;
  frequency: 'weekly_1' | 'weekly_2' | 'monthly_1';
  mode: 'autonomous' | 'review_required';
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export async function getAutopilotConfig(): Promise<AutopilotConfig> {
  const settings = await getSettingsServer([
    'autopilot_enabled',
    'autopilot_frequency',
    'autopilot_mode',
    'autopilot_last_run',
    'autopilot_next_run',
  ]);

  return {
    enabled: settings.autopilot_enabled === 'true',
    frequency: (settings.autopilot_frequency as any) || 'weekly_1',
    mode: (settings.autopilot_mode as any) || 'autonomous',
    lastRunAt: settings.autopilot_last_run || null,
    nextRunAt: settings.autopilot_next_run || calculateNextRunDate(settings.autopilot_frequency || 'weekly_1'),
  };
}

export async function saveAutopilotConfig(config: Partial<AutopilotConfig>): Promise<boolean> {
  const dbClient = getSupabaseAdmin() || supabase;
  const updates: Array<{ key: string; value: string }> = [];

  if (config.enabled !== undefined) {
    updates.push({ key: 'autopilot_enabled', value: config.enabled ? 'true' : 'false' });
  }
  if (config.frequency) {
    updates.push({ key: 'autopilot_frequency', value: config.frequency });
    const nextDate = calculateNextRunDate(config.frequency);
    updates.push({ key: 'autopilot_next_run', value: nextDate });
  }
  if (config.mode) {
    updates.push({ key: 'autopilot_mode', value: config.mode });
  }
  if (config.lastRunAt) {
    updates.push({ key: 'autopilot_last_run', value: config.lastRunAt });
  }

  for (const item of updates) {
    await dbClient.from('settings').upsert({ key: item.key, value: item.value });
  }

  return true;
}

export function calculateNextRunDate(frequency: string): string {
  const now = new Date();
  if (frequency === 'weekly_2') {
    now.setDate(now.getDate() + 3.5);
  } else if (frequency === 'monthly_1') {
    now.setMonth(now.getMonth() + 1);
  } else {
    now.setDate(now.getDate() + 7);
  }
  return now.toISOString();
}

/**
 * Exécute un cycle complet de création autonome (1 Article Long-Form + Visuels HD + 3 Posts Sociaux)
 */
export async function runAutopilotCycle(origin: string = ''): Promise<{ ok: boolean; articleTitle?: string; error?: string }> {
  const dbClient = getSupabaseAdmin() || supabase;

  try {
    // 1. Chercher le meilleur mot-clé / sujet dans la table 'seo_clusters' ou 'saved_ideas'
    let { data: clusters } = await dbClient
      .from('seo_clusters')
      .select('id, focus_keyword, suggested_title, suggested_slug, opportunity, rel_bridge')
      .order('created_at', { ascending: false })
      .limit(1);

    let selectedKeyword = 'développement d\'activité';
    let selectedTitle = 'Les 5 leviers indispensables pour développer votre activité en 2026';
    let selectedSlug = 'leviers-indispensables-developpement-2026';
    let selectedIntro = 'Découvrez les stratégies concrètes pour capturer l\'attention de vos prospects.';
    let clusterIdToClean: string | null = null;

    if (clusters && clusters.length > 0) {
      const top = clusters[0];
      selectedKeyword = top.focus_keyword || selectedKeyword;
      selectedTitle = top.suggested_title || selectedTitle;
      selectedSlug = top.suggested_slug || selectedSlug;
      selectedIntro = top.rel_bridge || top.opportunity || selectedIntro;
      clusterIdToClean = top.id;
    } else {
      // Si la liste de mots-clés est épuisée, relancer un scan automatique
      try {
        if (origin) {
          await fetch(`${origin}/api/keyword-scan`, { method: 'POST' });
        }
      } catch (scanErr) {
        console.warn('[AutopilotEngine] Automatic scan trigger:', scanErr);
      }
    }

    // 2. Obtenir l'illustration HD automatique (Couverture + 2 images d'illustration)
    const autoImages = getAutomaticArticleImages(selectedTitle);

    // 3. Rédiger l'article long-form et générer l'ensemble des balises SEO (meta_title, meta_description, meta_keywords)
    let articleHtml = '';
    let metaTitle = selectedTitle;
    let metaDescription = selectedIntro;
    let metaKeywords = selectedKeyword;
    let category = 'Conseils';

    try {
      const aiRes = await fetch(`${origin || ''}/api/admin/generate-blog-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: selectedTitle, keyword: selectedKeyword }),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        articleHtml = data.content || '';
        if (data.meta_title) metaTitle = data.meta_title;
        if (data.meta_description) metaDescription = data.meta_description;
        if (data.meta_keywords) metaKeywords = data.meta_keywords;
        if (data.category) category = data.category;
        if (data.suggested_slug) selectedSlug = data.suggested_slug;
      }
    } catch { /* fallback html below */ }

    if (!articleHtml) {
      articleHtml = `<p class="lead">${selectedIntro}</p>
<h2>Pourquoi ${selectedKeyword} est un levier de croissance stratégique</h2>
<p>Dans un environnement numérique en perpétuelle évolution, optimiser votre visibilité sur <strong>${selectedKeyword}</strong> constitue un facteur clé de différenciation pour votre entreprise.</p>
<h2>Les 3 piliers à mettre en œuvre</h2>
<p>Voici la méthode recommandée pour capturer l'attention de vos prospects qualifiés :</p>
<ul>
  <li><strong>1. Positionnement clair :</strong> Mettez en avant votre expertise unique et vos garanties.</li>
  <li><strong>2. Contenu à haute valeur :</strong> Répondez aux questions fréquentes de vos clients.</li>
  <li><strong>3. Tunnel de conversion fluide :</strong> Facilitez la prise de rendez-vous et la demande de devis.</li>
</ul>
<h2>Conclusion & Prochaines Étapes</h2>
<p>En appliquant ces principes, vous construisez une présence en ligne solide et durable. Notre équipe reste à votre disposition pour vous accompagner !</p>`;
    }

    const finalHtmlContent = injectInlineImagesIntoContent(articleHtml, autoImages.inlineImages, selectedTitle);

    // 4. Inscrire l'article et TOUTES ses balises SEO dans Supabase 'articles'
    const { data: createdArticle, error: artErr } = await dbClient.from('articles').insert([
      {
        title: selectedTitle,
        slug: `${selectedSlug}-${Date.now().toString(36).slice(-4)}`,
        meta_title: metaTitle,
        meta_description: metaDescription,
        meta_keywords: metaKeywords,
        content: finalHtmlContent,
        category: category,
        cover_image: autoImages.coverImage,
        published: true,
      },
    ]).select('id').single();

    if (artErr) throw new Error(artErr.message);

    // 5. Nettoyer le mot-clé consommé si nécessaire
    if (clusterIdToClean) {
      await dbClient.from('seo_clusters').delete().eq('id', clusterIdToClean);
    }

    // 6. Publier sur les canaux sociaux
    try {
      await fetch(`${origin || ''}/api/admin/social-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'all',
          title: `Lot Hebdomadaire - ${selectedTitle}`,
          caption: `💡 NOUVEL ARTICLE : ${selectedTitle}\n\nRetrouvez nos conseils exclusifs sur le blog !\n\n👉 En savoir plus sur notre site !`,
          imageUrl: autoImages.coverImage,
        }),
      });
    } catch { /* ignore non critical */ }

    // 7. Mettre à jour la date de dernière exécution et prochaine exécution
    const config = await getAutopilotConfig();
    const nextDate = calculateNextRunDate(config.frequency);
    await saveAutopilotConfig({ lastRunAt: new Date().toISOString(), nextRunAt: nextDate });

    return { ok: true, articleTitle: selectedTitle };
  } catch (err: any) {
    console.error('[AutopilotCycle] Erreur:', err);
    return { ok: false, error: err.message };
  }
}
